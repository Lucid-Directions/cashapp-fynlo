#!/usr/bin/env python3
"""
Fix specific pattern where docstrings were incorrectly added between function name and parameters.
"""

import os
import re
import ast
from typing import List, Tuple

def find_python_files(directory: str) -> List[str]:
    """Find all Python files in the directory."""
    python_files = []
    for root, dirs, files in os.walk(directory):
        # Skip virtual environments and cache directories
        dirs[:] = [d for d in dirs if d not in ['venv', '__pycache__', '.git', 'migrations']]
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    return python_files

def fix_function_docstring_pattern(content: str) -> str:
    """Fix the specific pattern where docstrings appear between function name and parameters."""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Pattern: function definition with opening parenthesis
        # Could be: def func(, async def func(, or method definition
        if re.match(r'^\s*(async\s+)?def\s+\w+\s*\($', line):
            # Look ahead to see if next line is a docstring
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                docstring_match = re.match(r'^(\s*)"""(.*)""".*$', next_line)
                
                if docstring_match:
                    # Found the problematic pattern
                    indent = len(re.match(r'^(\s*)', line).group(1))
                    
                    # Start collecting the function signature
                    func_lines = [line]
                    j = i + 2  # Skip the docstring line
                    
                    # Collect all lines until we find the closing parenthesis with colon
                    while j < len(lines) and not re.search(r'\).*:', lines[j]):
                        func_lines.append(lines[j])
                        j += 1
                    
                    # Add the closing line
                    if j < len(lines):
                        func_lines.append(lines[j])
                    
                    # Now add all collected function signature lines
                    fixed_lines.extend(func_lines)
                    
                    # Add the docstring with proper indentation (inside the function)
                    docstring_content = docstring_match.group(2).strip()
                    fixed_lines.append(f"{' ' * (indent + 4)}\"\"\"{docstring_content}\"\"\"")
                    
                    # Skip to after the function signature
                    i = j
                else:
                    fixed_lines.append(line)
            else:
                fixed_lines.append(line)
        
        # Also handle inline docstrings in function signatures
        elif re.search(r'def\s+\w+\s*\([^)]*"""[^"]*"""[^)]*\)', line):
            # Remove inline docstrings from function signatures
            fixed_line = re.sub(r'(\s*,\s*)"""[^"]*"""(\s*,?)', r'\1', line)
            fixed_line = re.sub(r'(\(\s*)"""[^"]*"""(\s*,)', r'\1', fixed_line)
            fixed_lines.append(fixed_line)
        
        else:
            fixed_lines.append(line)
        
        i += 1
    
    return '\n'.join(fixed_lines)

def validate_syntax(file_path: str, content: str) -> Tuple[bool, str]:
    """Validate Python syntax and return error message if any."""
    try:
        ast.parse(content)
        return True, ""
    except SyntaxError as e:
        return False, f"{e.msg} at line {e.lineno}"

def fix_file(file_path: str) -> bool:
    """Apply fixes to a single file."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Skip if already valid
        valid, _ = validate_syntax(file_path, content)
        if valid:
            return True
        
        # Apply the fix
        fixed_content = fix_function_docstring_pattern(content)
        
        # Validate the fix
        valid, error = validate_syntax(file_path, fixed_content)
        if valid:
            with open(file_path, 'w') as f:
                f.write(fixed_content)
            return True
        else:
            print(f"Failed to fix {file_path}: {error}")
            return False
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main function to fix syntax errors."""
    backend_dir = "/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend"
    
    # List of files that specifically have this issue
    problem_files = [
        "app/core/responses.py",
        "app/core/config.py",
        "app/core/tenant_security.py",
        "app/core/rate_limiter.py",
        "app/core/push_notifications.py",
        "app/core/onboarding_helper.py",
        "app/api/v1/endpoints/sumup.py",
        "app/api/v1/endpoints/tips.py",
        "app/api/v1/endpoints/dashboard.py",
        "app/services/payment_factory.py",
        "app/services/secure_payment_config.py",
        "app/services/payment_providers.py",
        "app/scripts/initialize_platform_defaults.py",
        "app/scripts/validate_migration.py"
    ]
    
    fixed_count = 0
    failed_count = 0
    
    for rel_path in problem_files:
        file_path = os.path.join(backend_dir, rel_path)
        if os.path.exists(file_path):
            if fix_file(file_path):
                print(f"Fixed: {file_path}")
                fixed_count += 1
            else:
                failed_count += 1
    
    # Also scan all files for this specific pattern
    python_files = find_python_files(backend_dir)
    
    for file_path in python_files:
        if any(file_path.endswith(pf) for pf in problem_files):
            continue  # Already processed
        
        try:
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Check if file has the specific pattern
            if re.search(r'def\s+\w+\s*\(\s*\n\s*""".*"""', content) or \
               re.search(r'def\s+\w+\s*\([^)]*"""[^"]*"""[^)]*\)', content):
                if fix_file(file_path):
                    print(f"Fixed: {file_path}")
                    fixed_count += 1
                else:
                    failed_count += 1
                    
        except Exception:
            pass
    
    print(f"\nSummary:")
    print(f"Fixed: {fixed_count}")
    print(f"Failed to fix: {failed_count}")

if __name__ == "__main__":
    main()