#!/usr/bin/env python3
"""
Fix syntax errors caused by incorrectly placed docstrings.
The achieve_100_percent_quality.py script added docstrings in the wrong position.
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

def fix_malformed_docstrings(content: str) -> str:
    """Fix malformed docstrings that appear between function definition and parameters."""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Pattern 1: def function_name(
        #             """docstring"""
        #             param1: type,
        if re.match(r'^\s*def\s+\w+\s*\($', line) and i + 1 < len(lines):
            next_line = lines[i + 1]
            # Check if next line is a docstring
            if re.match(r'^\s*""".*""".*$', next_line):
                # Extract the docstring
                docstring_match = re.match(r'^(\s*)"""(.*)""".*$', next_line)
                if docstring_match:
                    indent = docstring_match.group(1)
                    docstring_content = docstring_match.group(2)
                    
                    # Add the function definition line
                    fixed_lines.append(line)
                    
                    # Skip the malformed docstring line
                    i += 1
                    
                    # Collect all parameters until the closing parenthesis
                    param_lines = []
                    i += 1
                    while i < len(lines) and not re.search(r'\).*:', lines[i]):
                        param_lines.append(lines[i])
                        i += 1
                    
                    # Add the closing parenthesis line
                    if i < len(lines):
                        fixed_lines.append(lines[i])
                        
                        # Now add the docstring properly indented
                        func_indent = re.match(r'^(\s*)', line).group(1)
                        fixed_lines.append(f'{func_indent}    """{docstring_content}"""')
                        
                        # Add the parameter lines
                        for param_line in param_lines:
                            fixed_lines.append(param_line)
                else:
                    fixed_lines.append(line)
            else:
                fixed_lines.append(line)
        
        # Pattern 2: async def function_name(
        #             """docstring"""
        #             param1: type,
        elif re.match(r'^\s*async\s+def\s+\w+\s*\($', line) and i + 1 < len(lines):
            next_line = lines[i + 1]
            # Check if next line is a docstring
            if re.match(r'^\s*""".*""".*$', next_line):
                # Extract the docstring
                docstring_match = re.match(r'^(\s*)"""(.*)""".*$', next_line)
                if docstring_match:
                    indent = docstring_match.group(1)
                    docstring_content = docstring_match.group(2)
                    
                    # Add the function definition line
                    fixed_lines.append(line)
                    
                    # Skip the malformed docstring line
                    i += 1
                    
                    # Collect all parameters until the closing parenthesis
                    param_lines = []
                    i += 1
                    while i < len(lines) and not re.search(r'\).*:', lines[i]):
                        param_lines.append(lines[i])
                        i += 1
                    
                    # Add the closing parenthesis line
                    if i < len(lines):
                        fixed_lines.append(lines[i])
                        
                        # Now add the docstring properly indented
                        func_indent = re.match(r'^(\s*)', line).group(1)
                        fixed_lines.append(f'{func_indent}    """{docstring_content}"""')
                        
                        # Add the parameter lines
                        for param_line in param_lines:
                            fixed_lines.append(param_line)
                else:
                    fixed_lines.append(line)
            else:
                fixed_lines.append(line)
        
        # Pattern 3: def function_name(param1,
        #             """docstring"""
        #             param2):
        elif 'def ' in line and '"""' in line:
            # Handle inline docstrings in function definitions
            if re.search(r'def\s+\w+\s*\([^)]*"""[^"]*"""[^)]*\)', line):
                # Remove the docstring from the parameter list
                fixed_line = re.sub(r'(,\s*)"""[^"]*"""(\s*,?)', r'\1', line)
                fixed_lines.append(fixed_line)
            else:
                fixed_lines.append(line)
        else:
            fixed_lines.append(line)
        
        i += 1
    
    return '\n'.join(fixed_lines)

def validate_syntax(file_path: str, content: str) -> bool:
    """Validate Python syntax."""
    try:
        ast.parse(content)
        return True
    except SyntaxError as e:
        print(f"Syntax error in {file_path}: {e}")
        return False

def main():
    """Main function to fix syntax errors."""
    backend_dir = "/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend"
    
    # Find all Python files
    python_files = find_python_files(backend_dir)
    
    fixed_count = 0
    error_count = 0
    
    for file_path in python_files:
        try:
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Skip if already valid syntax
            if validate_syntax(file_path, content):
                continue
            
            # Fix malformed docstrings
            fixed_content = fix_malformed_docstrings(content)
            
            # Validate the fix
            if validate_syntax(file_path, fixed_content):
                with open(file_path, 'w') as f:
                    f.write(fixed_content)
                print(f"Fixed: {file_path}")
                fixed_count += 1
            else:
                print(f"Failed to fix: {file_path}")
                error_count += 1
                
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            error_count += 1
    
    print(f"\nFixed {fixed_count} files")
    if error_count > 0:
        print(f"Failed to fix {error_count} files")

if __name__ == "__main__":
    main()