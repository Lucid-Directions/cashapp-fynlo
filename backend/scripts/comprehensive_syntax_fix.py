#!/usr/bin/env python3
"""
Comprehensive syntax fix for all types of syntax errors introduced by automated tools.
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

def remove_all_docstrings_from_functions(content: str) -> str:
    """Remove all docstrings that were incorrectly added to function definitions."""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check for patterns like: """docstring""",
        if '"""' in line and line.strip().endswith(','):
            # Remove the entire line if it's just a docstring with a comma
            if re.match(r'^\s*"""[^"]*"""\s*,\s*$', line):
                i += 1
                continue
        
        # Remove inline docstrings from function definitions
        if '"""' in line:
            # Remove docstrings that appear in parameter lists
            line = re.sub(r',\s*"""[^"]*"""\s*,', ',', line)
            line = re.sub(r'\(\s*"""[^"]*"""\s*,', '(', line)
            line = re.sub(r',\s*"""[^"]*"""\s*\)', ')', line)
            line = re.sub(r'\(\s*"""[^"]*"""\s*\)', '()', line)
            # Remove docstrings between parameters
            line = re.sub(r'(\w+\s*[:,])\s*"""[^"]*"""\s*,', r'\1', line)
        
        fixed_lines.append(line)
        i += 1
    
    return '\n'.join(fixed_lines)

def fix_trailing_commas(content: str) -> str:
    """Fix trailing comma issues in import statements."""
    lines = content.split('\n')
    fixed_lines = []
    
    for line in lines:
        # Fix import statements with trailing commas
        if re.match(r'^from .* import .*,$', line.strip()):
            line = line.rstrip(',')
        fixed_lines.append(line)
    
    return '\n'.join(fixed_lines)

def fix_indentation_errors(content: str) -> str:
    """Fix common indentation errors."""
    lines = content.split('\n')
    fixed_lines = []
    expected_indent = 0
    indent_stack = [0]
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            fixed_lines.append(line)
            continue
        
        # Calculate current indentation
        current_indent = len(line) - len(line.lstrip())
        
        # Handle dedent keywords
        if stripped.startswith(('return', 'break', 'continue', 'pass', 'raise')):
            # These should match the current block indent
            if indent_stack:
                line = ' ' * indent_stack[-1] + stripped
        
        # Handle block start keywords
        elif stripped.endswith(':'):
            # This line should have proper indent
            if current_indent not in indent_stack:
                # Find closest valid indent
                valid_indent = min(indent_stack, key=lambda x: abs(x - current_indent))
                line = ' ' * valid_indent + stripped
            indent_stack.append(current_indent + 4)
        
        # Handle block end keywords
        elif stripped.startswith(('except', 'elif', 'else', 'finally')):
            if len(indent_stack) > 1:
                indent_stack.pop()
                line = ' ' * indent_stack[-1] + stripped
                if stripped.endswith(':'):
                    indent_stack.append(indent_stack[-1] + 4)
        
        # Regular lines
        else:
            if indent_stack and current_indent > max(indent_stack):
                # Fix over-indented lines
                line = ' ' * indent_stack[-1] + stripped
        
        fixed_lines.append(line)
    
    return '\n'.join(fixed_lines)

def remove_duplicate_docstrings(content: str) -> str:
    """Remove duplicate or misplaced docstrings."""
    # Remove multiple docstrings in a row
    content = re.sub(r'(\s*""".+?"""\s*\n){2,}', r'\1', content, flags=re.DOTALL)
    
    # Remove docstrings that appear right after another docstring
    lines = content.split('\n')
    fixed_lines = []
    prev_was_docstring = False
    
    for line in lines:
        stripped = line.strip()
        is_docstring = stripped.startswith('"""') and stripped.endswith('"""')
        
        if is_docstring and prev_was_docstring:
            # Skip this duplicate docstring
            continue
        
        fixed_lines.append(line)
        prev_was_docstring = is_docstring
    
    return '\n'.join(fixed_lines)

def validate_syntax(file_path: str, content: str) -> Tuple[bool, str]:
    """Validate Python syntax and return error message if any."""
    try:
        ast.parse(content)
        return True, ""
    except SyntaxError as e:
        return False, f"{e.msg} at line {e.lineno}"

def fix_file(file_path: str) -> bool:
    """Apply all fixes to a single file."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Skip if already valid
        valid, _ = validate_syntax(file_path, content)
        if valid:
            return True
        
        # Apply fixes in order
        fixed_content = content
        fixed_content = remove_all_docstrings_from_functions(fixed_content)
        fixed_content = fix_trailing_commas(fixed_content)
        fixed_content = fix_indentation_errors(fixed_content)
        fixed_content = remove_duplicate_docstrings(fixed_content)
        
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
    """Main function to fix all syntax errors."""
    backend_dir = "/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend"
    
    # Find all Python files
    python_files = find_python_files(backend_dir)
    
    fixed_count = 0
    failed_count = 0
    already_valid = 0
    
    for file_path in python_files:
        try:
            with open(file_path, 'r') as f:
                content = f.read()
            
            valid, _ = validate_syntax(file_path, content)
            if valid:
                already_valid += 1
                continue
            
            if fix_file(file_path):
                print(f"Fixed: {file_path}")
                fixed_count += 1
            else:
                failed_count += 1
                
        except Exception as e:
            print(f"Error checking {file_path}: {e}")
            failed_count += 1
    
    print(f"\nSummary:")
    print(f"Already valid: {already_valid}")
    print(f"Fixed: {fixed_count}")
    print(f"Failed to fix: {failed_count}")
    
    # Show specific files that still have errors
    if failed_count > 0:
        print("\nFiles that still need manual fixing:")
        for file_path in python_files:
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                valid, error = validate_syntax(file_path, content)
                if not valid:
                    print(f"  {file_path}: {error}")
            except:
                pass

if __name__ == "__main__":
    main()