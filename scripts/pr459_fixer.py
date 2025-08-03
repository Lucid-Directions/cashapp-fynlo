#!/usr/bin/env python3
"""
PR #459 Comprehensive Fixer
Fixes syntax errors while preserving Ryan's cleanup work
"""

import ast
import re
import os
import sys
import json
import argparse
from pathlib import Path
from typing import List, Dict, Tuple
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class PR459Fixer:
    """Main fixer class for PR #459 syntax issues"""
    
    def __init__(self, backend_path: str = "backend"):
        self.backend_path = Path(backend_path)
        self.fixes_applied = 0
        self.files_processed = 0
        self.errors = []
        
    def find_python_files(self) -> List[Path]:
        """Find all Python files in backend directory"""
        return list(self.backend_path.rglob("*.py"))
    
    def check_syntax(self, file_path: Path) -> Tuple[bool, str]:
        """Check if a file has syntax errors"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            compile(content, str(file_path), 'exec')
            return True, ""
        except SyntaxError as e:
            return False, f"{e.msg} at line {e.lineno}"
    
    def fix_docstring_patterns(self, content: str) -> str:
        """Fix malformed docstring patterns"""
        # Pattern 1: """Execute operation.""" without function body
        content = re.sub(
            r'(def\s+\w+[^:]*:\s*\n\s*)("""Execute\s+\w+\s+operation\."""\s*)(\n|$)',
            r'\1\2\n\1pass\n',
            content
        )
        
        # Pattern 2: Decorator without function body
        content = re.sub(
            r'(@\w+(?:\([^)]*\))?\s*\n)(\s*def\s+\w+[^:]*:\s*)$',
            r'\1\2\n    """TODO: Implement function."""\n    pass',
            content,
            flags=re.MULTILINE
        )
        
        # Pattern 3: Class with only docstring
        content = re.sub(
            r'(class\s+\w+[^:]*:\s*\n\s*"""[^"]+"""\s*)(\n\s*(?:class|def|@|\Z))',
            r'\1\n    pass\n\2',
            content
        )
        
        return content
    
    def fix_incomplete_functions(self, content: str) -> str:
        """Fix functions that are incomplete"""
        lines = content.split('\n')
        fixed_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Check for function definition
            if re.match(r'^\s*def\s+\w+.*:\s*$', line):
                # Check if next line is another def, class, or decorator
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    if re.match(r'^\s*(def|class|@)', next_line) or next_line.strip() == '':
                        # Insert minimal function body
                        indent = len(line) - len(line.lstrip())
                        fixed_lines.append(line)
                        fixed_lines.append(' ' * (indent + 4) + 'pass')
                        i += 1
                        continue
            
            fixed_lines.append(line)
            i += 1
        
        return '\n'.join(fixed_lines)
    
    def fix_import_statements(self, content: str) -> str:
        """Fix incomplete import statements"""
        # Fix trailing 'from' statements
        content = re.sub(
            r'^\s*from\s*$',
            '',
            content,
            flags=re.MULTILINE
        )
        
        # Fix imports with missing modules
        content = re.sub(
            r'from\s+(\w+(?:\.\w+)*)\s+import\s*$',
            r'# TODO: Fix incomplete import from \1',
            content,
            flags=re.MULTILINE
        )
        
        return content
    
    def remove_duplicate_services(self):
        """Identify and report duplicate service implementations"""
        duplicates = {
            'payment_factory': [
                'app/services/payment_factory.py',
                'app/services/payment_providers/payment_factory.py'
            ],
            'platform_service': [
                'app/core/platform_service.py',
                'app/services/platform_service.py'
            ]
        }
        
        logger.info("\n🔍 Checking for duplicate services...")
        for service, paths in duplicates.items():
            existing = []
            for path in paths:
                full_path = self.backend_path / path
                if full_path.exists():
                    existing.append(str(full_path))
            
            if len(existing) > 1:
                logger.warning(f"Duplicate {service} found in:")
                for path in existing:
                    logger.warning(f"  - {path}")
    
    def fix_file(self, file_path: Path) -> bool:
        """Fix a single file"""
        try:
            # Read content
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            # Apply fixes
            content = original_content
            content = self.fix_docstring_patterns(content)
            content = self.fix_incomplete_functions(content)
            content = self.fix_import_statements(content)
            
            # Only write if changed
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                self.fixes_applied += 1
                logger.info(f"✓ Fixed: {file_path}")
                return True
            
            return False
            
        except Exception as e:
            self.errors.append(f"{file_path}: {str(e)}")
            logger.error(f"✗ Error fixing {file_path}: {e}")
            return False
    
    def validate_security(self):
        """Check for security issues"""
        logger.info("\n🔒 Checking security issues...")
        
        # Check for hardcoded secrets
        config_file = self.backend_path / "app/core/config.py"
        if config_file.exists():
            with open(config_file, 'r') as f:
                content = f.read()
            
            if 'SECRET_KEY: str = "your-super-secret-key-change-in-production"' in content:
                logger.warning("⚠️  Hardcoded SECRET_KEY found in config.py")
                logger.warning("   Fix: Ensure SECRET_KEY is loaded from environment")
    
    def run(self, fix: bool = True, validate_only: bool = False):
        """Run the fixer"""
        logger.info("🚀 Starting PR #459 Fix Process")
        logger.info("=" * 50)
        
        # Find all Python files
        python_files = self.find_python_files()
        logger.info(f"Found {len(python_files)} Python files")
        
        # Phase 1: Check syntax errors
        syntax_errors = []
        for file_path in python_files:
            valid, error = self.check_syntax(file_path)
            if not valid:
                syntax_errors.append((file_path, error))
        
        logger.info(f"\n📊 Syntax Status: {len(syntax_errors)} files with errors")
        
        if validate_only:
            for file_path, error in syntax_errors[:10]:  # Show first 10
                logger.error(f"  {file_path}: {error}")
            return
        
        # Phase 2: Apply fixes
        if fix and syntax_errors:
            logger.info("\n🔧 Applying fixes...")
            for file_path, _ in syntax_errors:
                self.fix_file(file_path)
                self.files_processed += 1
        
        # Phase 3: Re-validate
        remaining_errors = []
        for file_path, _ in syntax_errors:
            valid, error = self.check_syntax(file_path)
            if not valid:
                remaining_errors.append((file_path, error))
        
        # Phase 4: Check duplicates and security
        self.remove_duplicate_services()
        self.validate_security()
        
        # Summary
        logger.info("\n" + "=" * 50)
        logger.info("📊 SUMMARY REPORT")
        logger.info("=" * 50)
        logger.info(f"Files processed: {self.files_processed}")
        logger.info(f"Fixes applied: {self.fixes_applied}")
        logger.info(f"Initial syntax errors: {len(syntax_errors)}")
        logger.info(f"Remaining syntax errors: {len(remaining_errors)}")
        logger.info(f"Success rate: {((len(syntax_errors) - len(remaining_errors)) / len(syntax_errors) * 100):.1f}%" if syntax_errors else "N/A")
        
        if remaining_errors:
            logger.warning(f"\n⚠️  {len(remaining_errors)} files still have syntax errors:")
            for file_path, error in remaining_errors[:5]:  # Show first 5
                logger.warning(f"  {file_path}: {error}")
        else:
            logger.info("\n✅ All syntax errors fixed!")
        
        # Save detailed report
        report = {
            'files_processed': self.files_processed,
            'fixes_applied': self.fixes_applied,
            'initial_errors': len(syntax_errors),
            'remaining_errors': len(remaining_errors),
            'remaining_files': [str(f) for f, _ in remaining_errors],
            'process_errors': self.errors
        }
        
        with open('pr459_fix_report.json', 'w') as f:
            json.dump(report, f, indent=2)
        logger.info(f"\nDetailed report saved to: pr459_fix_report.json")

def main():
    parser = argparse.ArgumentParser(description='Fix PR #459 syntax errors')
    parser.add_argument('--backend-path', default='backend', help='Path to backend directory')
    parser.add_argument('--validate-only', action='store_true', help='Only validate, do not fix')
    parser.add_argument('--no-fix', action='store_true', help='Do not apply fixes')
    
    args = parser.parse_args()
    
    fixer = PR459Fixer(args.backend_path)
    fixer.run(fix=not args.no_fix, validate_only=args.validate_only)

if __name__ == '__main__':
    main()