#!/usr/bin/env python3
"""
Comprehensive fix for all syntax errors introduced by the achieve_100_percent_quality.py script.
This handles:
1. Trailing commas in import statements
2. Malformed docstrings in function definitions
3. Unexpected indentation
4. Invalid syntax from misplaced code
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

def fix_trailing_comma_imports(content: str) -> str:
    """Fix trailing commas in import statements."""
    lines = content.split('\n')
    fixed_lines = []
    
    for line in lines:
        # Fix trailing comma after 'from X import Y,' pattern
        if re.match(r'^from\s+\S+\s+import\s+\S+\s*,$', line):
            line = line.rstrip(',')
        # Fix trailing comma in parentheses like 'FastAPI,'
        elif re.search(r'(FastAPI|HTTPException|Request|Response|status)\s*,$', line):
            line = re.sub(r'(\w+)\s*,$', r'\1', line)
        fixed_lines.append(line)
    
    return '\n'.join(fixed_lines)

def fix_unexpected_indentation(content: str) -> str:
    """Fix unexpected indentation issues."""
    lines = content.split('\n')
    fixed_lines = []
    
    for i, line in enumerate(lines):
        # Check for lines that have excessive leading spaces
        if line.strip() and len(line) - len(line.lstrip()) > 100:
            # This line has way too much indentation, likely an error
            # Try to determine the correct indentation from context
            if i > 0:
                prev_indent = len(lines[i-1]) - len(lines[i-1].lstrip())
                # If previous line ends with colon, indent by 4 more
                if lines[i-1].rstrip().endswith(':'):
                    correct_indent = prev_indent + 4
                else:
                    correct_indent = prev_indent
                line = ' ' * correct_indent + line.strip()
        
        fixed_lines.append(line)
    
    return '\n'.join(fixed_lines)

def fix_malformed_docstrings(content: str) -> str:
    """Fix malformed docstrings in function definitions."""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Pattern: def func( followed by docstring on next line
        if re.match(r'^\s*(async\s+)?def\s+\w+\s*\($', line):
            if i + 1 < len(lines) and '"""' in lines[i + 1]:
                # Extract docstring content
                docstring_match = re.match(r'^\s*"""(.*)"""\s*,?\s*$', lines[i + 1])
                if docstring_match:
                    docstring_content = docstring_match.group(1).strip()
                    indent = len(re.match(r'^(\s*)', line).group(1))
                    
                    # Collect function signature
                    func_lines = [line]
                    j = i + 2  # Skip docstring line
                    
                    # Find the end of function signature
                    while j < len(lines) and not re.search(r'\).*:', lines[j]):
                        func_lines.append(lines[j])
                        j += 1
                    
                    if j < len(lines):
                        func_lines.append(lines[j])
                        j += 1
                    
                    # Add function signature
                    fixed_lines.extend(func_lines)
                    
                    # Add docstring inside function if content exists
                    if docstring_content and j < len(lines):
                        # Check if next line is already a docstring
                        if not (lines[j].strip().startswith('"""') and lines[j].strip().endswith('"""')):
                            fixed_lines.append(f"{' ' * (indent + 4)}\"\"\"{docstring_content}\"\"\"")
                    
                    i = j - 1
                else:
                    fixed_lines.append(line)
            else:
                fixed_lines.append(line)
        
        # Remove inline docstrings from function signatures
        elif 'def' in line and '"""' in line:
            fixed_line = re.sub(r'"""[^"]*"""\s*,?\s*', '', line)
            fixed_lines.append(fixed_line)
        
        # Skip standalone docstring lines with trailing commas
        elif line.strip().startswith('"""') and line.strip().endswith('",'):
            pass
        
        else:
            fixed_lines.append(line)
        
        i += 1
    
    return '\n'.join(fixed_lines)

def fix_invalid_await_assignment(content: str) -> str:
    """Fix invalid await assignments."""
    # Fix patterns like 'await = something' which should be 'result = await something'
    content = re.sub(r'(\s+)await\s*=\s*', r'\1result = await ', content)
    return content

def remove_duplicate_docstrings(content: str) -> str:
    """Remove consecutive duplicate docstrings."""
    lines = content.split('\n')
    fixed_lines = []
    prev_was_docstring = False
    prev_docstring_content = ""
    
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('"""') and stripped.endswith('"""'):
            current_docstring = stripped[3:-3].strip()
            if prev_was_docstring and current_docstring == prev_docstring_content:
                # Skip duplicate
                continue
            prev_was_docstring = True
            prev_docstring_content = current_docstring
        else:
            prev_was_docstring = False
            prev_docstring_content = ""
        
        fixed_lines.append(line)
    
    return '\n'.join(fixed_lines)

def validate_syntax(content: str) -> Tuple[bool, Optional[str], Optional[int]]:
    """Validate Python syntax and return (valid, error_message, line_number)."""
    try:
        ast.parse(content)
        return True, None, None
    except SyntaxError as e:
        return False, e.msg, e.lineno

def fix_file(file_path: str) -> Tuple[bool, Optional[str]]:
    """Apply all fixes to a single file."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Check current status
        valid, error, line_no = validate_syntax(content)
        if valid:
            return True, None
        
        original_error = f"{error} at line {line_no}"
        
        # Apply fixes in order
        fixed_content = fix_trailing_comma_imports(content)
        fixed_content = fix_unexpected_indentation(fixed_content)
        fixed_content = fix_malformed_docstrings(fixed_content)
        fixed_content = fix_invalid_await_assignment(fixed_content)
        fixed_content = remove_duplicate_docstrings(fixed_content)
        
        # Validate the fix
        valid, error, line_no = validate_syntax(fixed_content)
        if valid:
            # Check if content actually changed
            if fixed_content != content:
                with open(file_path, 'w') as f:
                    f.write(fixed_content)
                return True, None
            else:
                return False, f"No changes made, original error: {original_error}"
        else:
            return False, f"{error} at line {line_no}"
            
    except Exception as e:
        return False, str(e)

def main():
    """Main function to fix all syntax errors."""
    backend_dir = "/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend"
    
    # Find all Python files
    print("Scanning for Python files...")
    python_files = find_python_files(backend_dir)
    print(f"Found {len(python_files)} Python files")
    
    # First pass: identify files with syntax errors
    print("\nIdentifying files with syntax errors...")
    files_with_errors = []
    for file_path in python_files:
        try:
            with open(file_path, 'r') as f:
                content = f.read()
            valid, error, line_no = validate_syntax(content)
            if not valid:
                files_with_errors.append((file_path, f"{error} at line {line_no}"))
        except Exception as e:
            files_with_errors.append((file_path, str(e)))
    
    print(f"Found {len(files_with_errors)} files with syntax errors")
    
    # Second pass: fix the errors
    print("\nAttempting to fix errors...")
    fixed_count = 0
    failed_files = []
    
    for file_path, original_error in files_with_errors:
        print(f"Processing: {file_path}")
        success, error = fix_file(file_path)
        if success:
            print(f"  ✓ Fixed")
            fixed_count += 1
        else:
            print(f"  ✗ Failed: {error}")
            failed_files.append((file_path, error or original_error))
    
    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY:")
    print(f"{'='*60}")
    print(f"Total files scanned: {len(python_files)}")
    print(f"Files with syntax errors: {len(files_with_errors)}")
    print(f"Successfully fixed: {fixed_count}")
    print(f"Failed to fix: {len(failed_files)}")
    
    if failed_files:
        print(f"\n{'='*60}")
        print("FILES STILL REQUIRING MANUAL FIXES:")
        print(f"{'='*60}")
        for file_path, error in failed_files:
            rel_path = file_path.replace(backend_dir + '/', '')
            print(f"{rel_path}")
            print(f"  Error: {error}")
            print()

if __name__ == "__main__":
    main()
