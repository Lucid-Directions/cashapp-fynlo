#!/usr/bin/env python3

"""
Fix syntax issues found by Black formatter
These are specific issues that prevent Black from parsing the code
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

class SyntaxFixer:
    def __init__(self):
        self.files_fixed = 0
        self.issues_fixed = 0
    
    def fix_files(self):
        """Fix syntax issues in all files"""
        logger.info("🔧 Fixing syntax issues found by Black...")
        
        # Fix specific problematic files
        problematic_files = [
            'app/api/v1/endpoints/fees.py',
            'app/api/v1/endpoints/orders.py', 
            'app/api/v1/endpoints/payment_configurations.py',
            'app/api/v1/endpoints/platform_admin.py',
            'app/api/v1/endpoints/tips.py',
            'app/core/cache_service.py',
            'app/core/database_security.py',
            'app/core/analytics_engine.py',
            'app/core/file_upload.py',
            'app/core/mobile_id_mapping.py',
            'app/core/onboarding_helper.py',
            'app/core/database.py',
            'app/core/platform_service.py',
            'app/core/production_guard.py',
            'app/core/response_helper.py',
            'app/core/responses.py',
            'app/core/tenant_security.py',
            'app/core/tenant_security_current.py',
            'app/core/validation.py',
            'app/core/security.py',
            'app/crud/inventory.py',
            'app/debug_deployment.py',
            'app/main_minimal.py',
        ]
        
        for file_path in problematic_files:
            if os.path.exists(file_path):
                self.fix_file_syntax(file_path)
        
        logger.info(f"✅ Fixed {self.issues_fixed} syntax issues in {self.files_fixed} files")
    
    def fix_file_syntax(self, file_path: str):
        """Fix syntax issues in a specific file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            
            # Fix malformed function definitions that lack proper signature
            content = self.fix_malformed_function_defs(content)
            
            # Fix improperly indented docstrings in decorators  
            content = self.fix_decorator_indentation(content)
            
            # Fix missing function signatures
            content = self.fix_missing_signatures(content)
            
            # Fix improper decorator placements
            content = self.fix_decorator_placement(content)
            
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                self.files_fixed += 1
                logger.info(f"   Fixed syntax issues in {file_path}")
        
        except Exception as e:
            logger.error(f"   Failed to fix {file_path}: {e}")
    
    def fix_malformed_function_defs(self, content: str) -> str:
        """Fix malformed function definitions"""
        issues_found = 0
        
        # Pattern: Find lines with docstring but no function signature
        pattern = r'^(\s*"""Execute .+ operation\.""")\n(\s*)(.*?):'
        
        def replace_malformed_def(match):
            nonlocal issues_found
            issues_found += 1
            
            docstring = match.group(1)
            indent = match.group(2)
            remaining = match.group(3)
            
            # Extract function name from docstring
            doc_match = re.search(r'Execute (.+) operation', docstring)
            if doc_match:
                func_name = doc_match.group(1).replace(' ', '_')
                # Create proper function signature
                return f'{indent}def {func_name}(self):\n{indent}    {docstring}\n{indent}{remaining}:'
            
            return match.group(0)
        
        content = re.sub(pattern, replace_malformed_def, content, flags=re.MULTILINE)
        
        if issues_found > 0:
            self.issues_fixed += issues_found
            
        return content
    
    def fix_decorator_indentation(self, content: str) -> str:
        """Fix improperly indented content in decorators"""
        issues_found = 0
        
        # Fix logger statements that are incorrectly indented in decorators
        pattern = r'^(\s*)logger\.warning\(f"Production guard bypassed for \{func\.__name__\}"\)'
        replacement = r'\1if settings.ENVIRONMENT != "production":\n\1    logger.warning(f"Production guard bypassed for {func.__name__}")'
        
        if re.search(pattern, content, flags=re.MULTILINE):
            content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
            issues_found += 1
        
        if issues_found > 0:
            self.issues_fixed += issues_found
            
        return content
    
    def fix_missing_signatures(self, content: str) -> str:
        """Fix missing function signatures"""
        issues_found = 0
        
        # Pattern for functions that start with docstring instead of def
        lines = content.split('\n')
        fixed_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Check if this is a docstring that should be a function
            if re.match(r'^\s*"""Execute .+ operation\."""$', line):
                # Extract indentation and function name
                indent_match = re.match(r'^(\s*)', line)
                indent = indent_match.group(1) if indent_match else ''
                
                doc_match = re.search(r'Execute (.+) operation', line)
                if doc_match:
                    func_name = doc_match.group(1).replace(' ', '_')
                    
                    # Look ahead to see what follows
                    next_line = lines[i + 1] if i + 1 < len(lines) else ''
                    
                    # If next line doesn't start properly, add function signature
                    if not re.match(r'^\s*(def|class|\s*$)', next_line):
                        fixed_lines.append(f'{indent}def {func_name}(self):')
                        fixed_lines.append(f'{indent}    {line.strip()}')
                        issues_found += 1
                    else:
                        fixed_lines.append(line)
                else:
                    fixed_lines.append(line)
            else:
                fixed_lines.append(line)
            
            i += 1
        
        if issues_found > 0:
            self.issues_fixed += issues_found
            content = '\n'.join(fixed_lines)
            
        return content
    
    def fix_decorator_placement(self, content: str) -> str:
        """Fix decorator placement issues"""
        issues_found = 0
        
        # Fix @validator decorators that are missing proper function definition
        pattern = r'(@validator\([^)]+\))\s*\n\s*def validate_method\(cls, v\):'
        replacement = r'\1\n    def validate_method(cls, v):'
        
        if re.search(pattern, content, flags=re.MULTILINE):
            content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
            issues_found += 1
        
        if issues_found > 0:
            self.issues_fixed += issues_found
            
        return content

def main():
    """Main execution function"""
    logger.info("🚀 Starting syntax fixes for Black formatter...")
    
    fixer = SyntaxFixer()
    fixer.fix_files()
    
    logger.info("✅ Syntax fixes completed!")

if __name__ == "__main__":
    main()