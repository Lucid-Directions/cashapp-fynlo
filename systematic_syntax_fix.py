#!/usr/bin/env python3
"""
Systematic fix for all Python syntax errors in the backend.
"""

import os
import re
import ast
from pathlib import Path


def fix_malformed_docstrings_in_params(file_path):
    """Fix docstrings that appear in function parameter lists."""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Pattern: function with docstring in parameters
    # def func_name(
    #     """docstring"""
    #     param: type
    # ):
    pattern = r'(def\s+\w+\s*\(\s*)\n\s*"""[^"]*"""\s*\n(\s*\w+.*?\):)'
    
    def replace_func(match):
        func_start = match.group(1)
        params_and_close = match.group(2)
        return f"{func_start}\n{params_and_close}"
    
    content = re.sub(pattern, replace_func, content, flags=re.MULTILINE | re.DOTALL)
    
    # Also fix simpler cases where docstring is on same line as function def
    content = re.sub(
        r'def\s+(\w+)\s*\(\s*"""[^"]*"""\s*',
        r'def \1(',
        content
    )
    
    with open(file_path, 'w') as f:
        f.write(content)


def fix_orphaned_try_blocks(file_path):
    """Fix try blocks that don't have proper structure."""
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check for orphaned try: followed by function definition
        if (line.strip() == 'try:' and 
            i + 1 < len(lines) and 
            lines[i + 1].strip().startswith('@router.')):
            # Skip the orphaned try
            i += 1
            continue
        
        new_lines.append(line)
        i += 1
    
    with open(file_path, 'w') as f:
        f.writelines(new_lines)


def fix_duplicate_functions(file_path):
    """Remove duplicate function definitions."""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find all function definitions
    func_pattern = r'@router\.\w+\([^)]*\)\s*\ndef\s+(\w+)\s*\([^{]*?\):'
    functions = {}
    
    for match in re.finditer(func_pattern, content, re.MULTILINE | re.DOTALL):
        func_name = match.group(1)
        if func_name in functions:
            # Remove the duplicate (keep the first occurrence)
            start = match.start()
            # Find the end of this function (next @router or end of file)
            next_func = re.search(r'@router\.\w+', content[match.end():])
            if next_func:
                end = match.end() + next_func.start()
            else:
                end = len(content)
            
            # Remove the duplicate function
            content = content[:start] + content[end:]
        else:
            functions[func_name] = True
    
    with open(file_path, 'w') as f:
        f.write(content)


def fix_missing_imports(file_path):
    """Add missing imports based on usage patterns."""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Check what imports are needed
    imports_needed = []
    
    if 'APIRouter' in content and 'from fastapi import' not in content:
        imports_needed.append('from fastapi import APIRouter, Depends, Query, HTTPException')
    
    if 'Session' in content and 'from sqlalchemy.orm import Session' not in content:
        imports_needed.append('from sqlalchemy.orm import Session')
    
    if 'APIResponseHelper' in content and 'from app.core.response_helper import APIResponseHelper' not in content:
        imports_needed.append('from app.core.response_helper import APIResponseHelper')
    
    if 'get_db' in content and 'from app.core.database import get_db' not in content:
        imports_needed.append('from app.core.database import get_db')
    
    if 'get_current_user' in content and 'from app.core.auth import get_current_user' not in content:
        imports_needed.append('from app.core.auth import get_current_user')
    
    if 'User' in content and 'from app.models.user import User' not in content:
        imports_needed.append('from app.models.user import User')
    
    # Add imports at the top
    if imports_needed:
        lines = content.split('\n')
        # Find where to insert imports (after existing imports)
        insert_pos = 0
        for i, line in enumerate(lines):
            if line.startswith('from ') or line.startswith('import '):
                insert_pos = i + 1
            elif line.strip() and not line.startswith('#') and not line.startswith('"""'):
                break
        
        for import_line in reversed(imports_needed):
            lines.insert(insert_pos, import_line)
        
        content = '\n'.join(lines)
    
    with open(file_path, 'w') as f:
        f.write(content)


def fix_indentation_errors(file_path):
    """Fix basic indentation issues."""
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    for i, line in enumerate(lines):
        # Remove unexpected indentation at start of file
        if i == 0 and line.startswith('    ') and not line.strip().startswith('#'):
            line = line.lstrip()
        
        new_lines.append(line)
    
    with open(file_path, 'w') as f:
        f.writelines(new_lines)


def check_syntax(file_path):
    """Check if file has valid Python syntax."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        ast.parse(content)
        return True, None
    except SyntaxError as e:
        return False, str(e)
    except Exception as e:
        return False, str(e)


def main():
    """Fix all syntax errors systematically."""
    
    # Find all Python files
    python_files = []
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    
    print(f"Found {len(python_files)} Python files")
    
    fixes_applied = 0
    
    for file_path in python_files:
        print(f"Processing {file_path}...")
        
        try:
            # Apply all fixes
            fix_indentation_errors(file_path)
            fix_malformed_docstrings_in_params(file_path)
            fix_orphaned_try_blocks(file_path)
            fix_duplicate_functions(file_path)
            fix_missing_imports(file_path)
            
            # Check if syntax is now valid
            is_valid, error = check_syntax(file_path)
            if is_valid:
                print(f"  ✅ {file_path} - syntax OK")
            else:
                print(f"  ❌ {file_path} - still has errors: {error}")
            
            fixes_applied += 1
            
        except Exception as e:
            print(f"  ⚠️  Error processing {file_path}: {e}")
    
    print(f"\nProcessed {fixes_applied} files")
    
    # Final syntax check
    print("\nRunning final syntax validation...")
    os.system("python -m flake8 --select=E9 --statistics . | tail -5")


if __name__ == "__main__":
    main()