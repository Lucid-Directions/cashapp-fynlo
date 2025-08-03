#!/usr/bin/env python3
"""
Final comprehensive fix for malformed docstrings that were incorrectly placed
between function definitions and their parameters.
"""

import os
import re
import ast
from typing import List, Tuple, Optional

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

def extract_docstring_content(line: str) -> Optional[str]:
    """Extract the content from a docstring line."""
    match = re.match(r'^\s*"""(.*)"""\s*,?\s*$', line)
    if match:
        return match.group(1).strip()
    return None

def fix_malformed_function_docstrings(content: str) -> str:
    """Fix the specific pattern where docstrings appear between function name and parameters."""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Pattern 1: Function definition with opening parenthesis on same line
        # def func( or async def func(
        if re.match(r'^\s*(async\s+)?def\s+\w+\s*\($', line):
            # Look ahead to see if next line is a docstring
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                docstring_content = extract_docstring_content(next_line)
                
                if docstring_content is not None:
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
                        j += 1
                    
                    # Now add all collected function signature lines
                    fixed_lines.extend(func_lines)
                    
                    # Add the docstring inside the function body (if content is not empty)
                    if docstring_content:
                        # Check if there's already a docstring in the function body
                        has_existing_docstring = False
                        if j < len(lines):
                            next_body_line = lines[j].strip()
                            if next_body_line.startswith('"""') and next_body_line.endswith('"""'):
                                has_existing_docstring = True
                        
                        if not has_existing_docstring:
                            fixed_lines.append(f"{' ' * (indent + 4)}\"\"\"{docstring_content}\"\"\"")
                    
                    # Skip to after the function signature
                    i = j - 1
                else:
                    fixed_lines.append(line)
            else:
                fixed_lines.append(line)
        
        # Pattern 2: Inline docstrings in function signatures
        elif 'def' in line and '"""' in line:
            # Remove inline docstrings from function signatures
            fixed_line = re.sub(r'(\s*,\s*)"""[^"]*"""(\s*,?)', r'\1', line)
            fixed_line = re.sub(r'(\(\s*)"""[^"]*"""(\s*,)', r'\1', fixed_line)
            fixed_line = re.sub(r'(,\s*)"""[^"]*"""(\s*\))', r'\1', fixed_line)
            fixed_line = re.sub(r'(\(\s*)"""[^"]*"""(\s*\))', r'\1\2', fixed_line)
            fixed_lines.append(fixed_line)
        
        # Pattern 3: Standalone docstring lines with trailing commas
        elif line.strip().startswith('"""') and line.strip().endswith('",'):
            # Skip these lines entirely
            pass
        
        else:
            fixed_lines.append(line)
        
        i += 1
    
    return '\n'.join(fixed_lines)

def remove_duplicate_docstrings(content: str) -> str:
    """Remove duplicate docstrings that appear consecutively in function bodies."""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this is a docstring line
        if line.strip().startswith('"""') and line.strip().endswith('"""'):
            # Look ahead to see if next line is also a docstring
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                if next_line.strip().startswith('"""') and next_line.strip().endswith('"""'):
                    # Found duplicate docstring, skip the current one
                    # Keep the second one as it's likely the correct placement
                    i += 1
                    continue
        
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

def fix_file(file_path: str) -> Tuple[bool, Optional[str]]:
    """Apply fixes to a single file. Returns (success, error_message)."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Skip if already valid
        valid, _ = validate_syntax(file_path, content)
        if valid:
            return True, None
        
        # Apply the fixes
        fixed_content = fix_malformed_function_docstrings(content)
        fixed_content = remove_duplicate_docstrings(fixed_content)
        
        # Validate the fix
        valid, error = validate_syntax(file_path, fixed_content)
        if valid:
            with open(file_path, 'w') as f:
                f.write(fixed_content)
            return True, None
        else:
            return False, error
            
    except Exception as e:
        return False, str(e)

def main():
    """Main function to fix syntax errors."""
    backend_dir = "/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend"
    
    # Find all Python files
    python_files = find_python_files(backend_dir)
    
    # First pass: identify files with syntax errors
    files_with_errors = []
    for file_path in python_files:
        try:
            with open(file_path, 'r') as f:
                content = f.read()
            valid, error = validate_syntax(file_path, content)
            if not valid:
                files_with_errors.append((file_path, error))
        except Exception:
            pass
    
    print(f"Found {len(files_with_errors)} files with syntax errors")
    
    # Second pass: fix the errors
    fixed_count = 0
    failed_files = []
    
    for file_path, original_error in files_with_errors:
        success, error = fix_file(file_path)
        if success:
            print(f"Fixed: {file_path}")
            fixed_count += 1
        else:
            failed_files.append((file_path, error or original_error))
    
    # Summary
    print(f"\nSummary:")
    print(f"Total files with errors: {len(files_with_errors)}")
    print(f"Successfully fixed: {fixed_count}")
    print(f"Failed to fix: {len(failed_files)}")
    
    if failed_files:
        print("\nFiles that still have errors:")
        for file_path, error in failed_files:
            print(f"  {file_path}: {error}")

if __name__ == "__main__":
    main()
