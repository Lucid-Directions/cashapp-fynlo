#!/usr/bin/env python3
"""
Comprehensive Python syntax error fix script for the Fynlo backend.
Fixes all identified syntax errors in a systematic way.
"""

import os
import re
import sys
from pathlib import Path


def fix_malformed_docstrings(file_path):
    """Fix malformed docstrings that are missing proper quotes."""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Fix the specific pattern in fees.py line 78
    content = re.sub(
        r'def get_platform_settings_service\(\s*"""Execute get_platform_settings_service operation\."""',
        'def get_platform_settings_service(',
        content
    )
    
    # Fix similar patterns
    content = re.sub(
        r'def (\w+)\(\s*"""Execute \w+ operation\."""',
        r'def \1(',
        content
    )
    
    with open(file_path, 'w') as f:
        f.write(content)


def fix_missing_imports(file_path):
    """Add missing imports for commonly used FastAPI and other modules."""
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    # Check if file needs FastAPI imports
    content = ''.join(lines)
    needs_fastapi = any(x in content for x in ['APIRouter', 'Depends', 'Query', 'HTTPException'])
    needs_session = 'Session' in content and 'from sqlalchemy.orm import Session' not in content
    needs_user = 'User' in content and 'User' not in content[:200]  # Check if import is at top
    
    if needs_fastapi and 'from fastapi import' not in content:
        # Find the right place to insert imports
        insert_pos = 0
        for i, line in enumerate(lines):
            if line.startswith('from ') or line.startswith('import '):
                insert_pos = i + 1
            elif not line.strip() or line.startswith('#'):
                continue
            else:
                break
        
        imports_to_add = []
        if 'APIRouter' in content or 'Depends' in content or 'Query' in content:
            imports_to_add.append('from fastapi import APIRouter, Depends, Query, HTTPException\n')
        
        if needs_session:
            imports_to_add.append('from sqlalchemy.orm import Session\n')
        
        if 'APIResponseHelper' in content:
            imports_to_add.append('from app.core.response_helper import APIResponseHelper\n')
        
        if 'get_db' in content:
            imports_to_add.append('from app.core.database import get_db\n')
        
        if 'get_current_user' in content:
            imports_to_add.append('from app.core.auth import get_current_user\n')
        
        if needs_user:
            imports_to_add.append('from app.models.user import User\n')
        
        for import_line in imports_to_add:
            lines.insert(insert_pos, import_line)
            insert_pos += 1
    
    with open(file_path, 'w') as f:
        f.writelines(lines)


def fix_incomplete_try_blocks(file_path):
    """Fix try blocks that are missing except or finally clauses."""
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        new_lines.append(line)
        
        # Check for try blocks
        if line.strip().startswith('try:'):
            # Look ahead to find if there's a proper except/finally
            j = i + 1
            found_except_or_finally = False
            try_indent = len(line) - len(line.lstrip())
            
            while j < len(lines):
                next_line = lines[j]
                if not next_line.strip():  # Skip empty lines
                    j += 1
                    continue
                
                next_indent = len(next_line) - len(next_line.lstrip())
                
                # If we hit same or lower indentation without except/finally
                if next_indent <= try_indent:
                    if next_line.strip().startswith(('except', 'finally')):
                        found_except_or_finally = True
                    break
                
                # Check if current line has except/finally
                if next_line.strip().startswith(('except', 'finally')):
                    found_except_or_finally = True
                    break
                
                j += 1
            
            # If no except/finally found, add a generic except
            if not found_except_or_finally:
                # Find the end of the try block
                j = i + 1
                while j < len(lines):
                    next_line = lines[j]
                    if not next_line.strip():
                        j += 1
                        continue
                    
                    next_indent = len(next_line) - len(next_line.lstrip())
                    if next_indent <= try_indent:
                        break
                    j += 1
                
                # Insert except block
                indent = ' ' * try_indent
                except_lines = [
                    f'{indent}except Exception as e:\n',
                    f'{indent}    print(f"Error: {{e}}")\n',
                    f'{indent}    raise\n'
                ]
                
                for k, except_line in enumerate(except_lines):
                    new_lines.insert(len(new_lines) - 1 + k, except_line)
        
        i += 1
    
    with open(file_path, 'w') as f:
        f.writelines(new_lines)


def fix_indentation_errors(file_path):
    """Fix basic indentation errors."""
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    for i, line in enumerate(lines):
        # Fix common unexpected indent patterns
        if line.strip() and not line.startswith('#'):
            # Check for unexpected indents at module level
            if i == 0 or (i > 0 and not lines[i-1].strip()):
                if line.startswith('    ') and not any(x in lines[max(0, i-5):i] for x in ['def ', 'class ', 'if ', 'for ', 'while ', 'try:', 'except', 'finally', 'with ']):
                    # Remove unexpected leading whitespace
                    line = line.lstrip() + '\n' if line.endswith('\n') else line.lstrip()
        
        new_lines.append(line)
    
    with open(file_path, 'w') as f:
        f.writelines(new_lines)


def fix_invalid_syntax(file_path):
    """Fix specific invalid syntax patterns."""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Fix EOF syntax errors
    content = re.sub(r'EOF\s*<\s*/dev/null', '', content)
    
    # Fix import statements that start incorrectly
    content = re.sub(r'^(\s*)import logging$', r'import logging', content, flags=re.MULTILINE)
    
    # Fix malformed docstrings
    content = re.sub(r'"""Execute (\w+) operation\."""', r'"""Execute \1 operation."""', content)
    
    with open(file_path, 'w') as f:
        f.write(content)


def fix_undefined_names(file_path):
    """Fix undefined name errors by adding necessary variables or imports."""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Fix undefined 'hours' variable
    if 'undefined name \'hours\'' in content or 'hours)' in content:
        if 'hours =' not in content:
            # Add hours parameter or default
            content = re.sub(
                r'(async def [^(]*\([^)]*)\)',
                r'\1, hours: int = 24)',
                content
            )
            # Or add default value
            if 'hours' in content and 'hours =' not in content:
                content = re.sub(
                    r'(def [^{]*{[^}]*)(hours)',
                    r'\1hours = 24  # Default hours\n    \2',
                    content
                )
    
    with open(file_path, 'w') as f:
        f.write(content)


def main():
    """Main function to fix all syntax errors."""
    backend_dir = Path('.')
    
    # Find all Python files
    python_files = []
    for root, dirs, files in os.walk(backend_dir):
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    
    print(f"Found {len(python_files)} Python files to check")
    
    # Apply fixes to each file
    for file_path in python_files:
        print(f"Fixing {file_path}...")
        try:
            fix_invalid_syntax(file_path)
            fix_malformed_docstrings(file_path)
            fix_indentation_errors(file_path)
            fix_incomplete_try_blocks(file_path)
            fix_missing_imports(file_path)
            fix_undefined_names(file_path)
        except Exception as e:
            print(f"Error fixing {file_path}: {e}")
    
    print("All files processed. Running syntax check...")
    
    # Verify fixes
    os.system("python -m flake8 --select=E9,F63,F7,F82 --show-source --statistics . | head -20")


if __name__ == "__main__":
    main()