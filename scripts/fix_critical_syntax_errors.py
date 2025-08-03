#!/usr/bin/env python3

"""
Fix critical syntax errors preventing Black from running
Focus on the most problematic files identified by the quality check
"""

import os
import re
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CriticalSyntaxFixer:
    def __init__(self):
        self.files_fixed = 0
        self.issues_fixed = 0
    
    def fix_all_critical_files(self):
        """Fix the most critical syntax errors"""
        logger.info("🔧 Fixing critical syntax errors...")
        
        # Files with critical syntax errors preventing Black
        critical_files = [
            'app/main_minimal.py',
            'app/debug_deployment.py', 
            'app/middleware/version_middleware.py',
            'app/middleware/rls_middleware.py',
            'app/middleware/feature_gate.py',
            'app/api/v1/endpoints/fees.py',
            'app/api/v1/endpoints/orders.py',
            'app/api/v1/endpoints/payment_configurations.py',
            'app/api/v1/endpoints/platform_admin.py',
            'app/api/v1/endpoints/tips.py',
        ]
        
        for file_path in critical_files:
            if os.path.exists(file_path):
                self.fix_file_critical_syntax(file_path)
        
        logger.info(f"✅ Fixed {self.issues_fixed} critical syntax issues in {self.files_fixed} files")
    
    def fix_file_critical_syntax(self, file_path: str):
        """Fix critical syntax issues in a specific file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            
            # Fix malformed function signatures that are just docstrings
            content = self.fix_bare_docstring_functions(content)
            
            # Fix incorrect indentation issues
            content = self.fix_indentation_errors(content)
            
            # Fix incomplete with statements
            content = self.fix_incomplete_with_statements(content)
            
            # Fix incomplete if statements 
            content = self.fix_incomplete_conditionals(content)
            
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                self.files_fixed += 1
                logger.info(f"   Fixed critical syntax in {file_path}")
        
        except Exception as e:
            logger.error(f"   Failed to fix {file_path}: {e}")
    
    def fix_bare_docstring_functions(self, content: str) -> str:
        """Fix function signatures that are missing and just have docstrings"""
        issues_found = 0
        
        # Pattern: docstring without function definition
        pattern = r'^(\s+)"""Execute (.+) operation\."""\s*\n(?!\s*def)'
        
        def replace_bare_docstring(match):
            nonlocal issues_found
            issues_found += 1
            
            indent = match.group(1)
            operation_name = match.group(2).replace(' ', '_')
            docstring = match.group(0)
            
            # Create proper function signature
            return f'{indent}def {operation_name}(self):\n{indent}    """Execute {match.group(2)} operation."""\n'
        
        content = re.sub(pattern, replace_bare_docstring, content, flags=re.MULTILINE)
        
        if issues_found > 0:
            self.issues_fixed += issues_found
            
        return content
    
    def fix_indentation_errors(self, content: str) -> str:
        """Fix obvious indentation errors"""
        issues_found = 0
        
        lines = content.split('\n')
        fixed_lines = []
        
        for i, line in enumerate(lines):
            # Fix lines that start without proper indentation after colon
            if i > 0:
                prev_line = lines[i-1].strip()
                if prev_line.endswith(':') and line.strip() and not line.startswith(' '):
                    # Previous line ended with colon, this line should be indented
                    if not line.startswith('    '):
                        line = '    ' + line
                        issues_found += 1
            
            fixed_lines.append(line)
        
        if issues_found > 0:
            self.issues_fixed += issues_found
            content = '\n'.join(fixed_lines)
            
        return content
    
    def fix_incomplete_with_statements(self, content: str) -> str:
        """Fix incomplete with statements"""
        issues_found = 0
        
        # Pattern: with statement followed by non-indented code
        pattern = r'^(\s*)with\s+[^:]+:\s*\n(\s*)([^\s].*?)$'
        
        def fix_with_statement(match):
            nonlocal issues_found
            issues_found += 1
            
            indent = match.group(1)
            next_line_indent = match.group(2)
            next_line_content = match.group(3)
            
            # If next line isn't properly indented, fix it
            if len(next_line_indent) <= len(indent):
                return f'{indent}with {match.group(0).split("with")[1].split(":")[0]}:\n{indent}    {next_line_content}'
            
            return match.group(0)
        
        content = re.sub(pattern, fix_with_statement, content, flags=re.MULTILINE)
        
        if issues_found > 0:
            self.issues_fixed += issues_found
            
        return content
    
    def fix_incomplete_conditionals(self, content: str) -> str:
        """Fix incomplete if/else statements"""
        issues_found = 0
        
        # Pattern: else: followed by non-indented content 
        pattern = r'^(\s*)(else:|elif .+:)\s*\n(\s*)([^\s\n].*?)$'
        
        def fix_conditional(match):
            nonlocal issues_found
            
            indent = match.group(1)
            conditional = match.group(2)
            next_indent = match.group(3)
            next_content = match.group(4)
            
            # If next line isn't properly indented after conditional
            if len(next_indent) <= len(indent):
                issues_found += 1
                return f'{indent}{conditional}\n{indent}    {next_content}'
            
            return match.group(0)
        
        content = re.sub(pattern, fix_conditional, content, flags=re.MULTILINE)
        
        if issues_found > 0:
            self.issues_fixed += issues_found
            
        return content

def main():
    """Main execution function"""
    logger.info("🚀 Starting critical syntax error fixes...")
    
    fixer = CriticalSyntaxFixer()
    fixer.fix_all_critical_files()
    
    logger.info("✅ Critical syntax fixes completed!")
    logger.info("💡 Now run Black formatter: python -m black app/ scripts/")

if __name__ == "__main__":
    main()