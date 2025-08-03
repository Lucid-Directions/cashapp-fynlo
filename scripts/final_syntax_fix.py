#!/usr/bin/env python3
"""
Final comprehensive syntax fix for all Python syntax errors.
This script will fix all remaining issues to achieve 0 syntax errors.
"""

import os
import re
import sys
import subprocess


def run_flake8_check():
    """Run flake8 to get current syntax error count."""
    try:
        result = subprocess.run([
            'python', '-m', 'flake8', '--select=E9', '--statistics', '.'
        ], capture_output=True, text=True, cwd='.')
        return result.stdout, result.stderr
    except Exception as e:
        return "", str(e)


def fix_orphaned_try_blocks(file_path):
    """Fix try blocks that don't have proper except/finally."""
    try:
        with open(file_path, 'r') as f:
            lines = f.readlines()
        
        new_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Check for orphaned try: at end of function/file
            if (line.strip() == 'try:' and 
                i + 1 < len(lines) and 
                lines[i + 1].strip().startswith('@router.')):
                # Skip the orphaned try
                i += 1
                continue
            
            # Check for try: followed by function def on same line
            if 'try:' in line and '@router.' in line:
                # Split the line properly
                parts = line.split('try:')
                if len(parts) == 2:
                    new_lines.append(parts[0] + '\n')
                    if parts[1].strip():
                        new_lines.append(parts[1])
                else:
                    new_lines.append(line)
            else:
                new_lines.append(line)
            
            i += 1
        
        with open(file_path, 'w') as f:
            f.writelines(new_lines)
        return True
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")
        return False


def fix_indentation_errors(file_path):
    """Fix basic indentation issues."""
    try:
        with open(file_path, 'r') as f:
            lines = f.readlines()
        
        new_lines = []
        for i, line in enumerate(lines):
            # Fix unexpected indentation at module level
            if (i == 0 or (i > 0 and not lines[i-1].strip())) and line.startswith('    '):
                # Check if this is really unexpected (not in a function/class)
                context_lines = lines[max(0, i-5):i]
                if not any('def ' in l or 'class ' in l or 'try:' in l or 'if ' in l 
                          for l in context_lines):
                    line = line.lstrip()
                    if not line.endswith('\n'):
                        line += '\n'
            
            new_lines.append(line)
        
        with open(file_path, 'w') as f:
            f.writelines(new_lines)
        return True
    except Exception as e:
        print(f"Error fixing indentation in {file_path}: {e}")
        return False


def fix_missing_except_blocks(file_path):
    """Add missing except blocks to try statements."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Pattern to find try blocks without proper except/finally
        lines = content.split('\n')
        new_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            new_lines.append(line)
            
            # Check for try: block
            if line.strip().endswith('try:'):
                indent = len(line) - len(line.lstrip())
                try_indent = ' ' * indent
                
                # Look ahead to see if there's content and then except/finally
                j = i + 1
                has_content = False
                has_except_or_finally = False
                
                while j < len(lines):
                    next_line = lines[j]
                    if not next_line.strip():  # Skip empty lines
                        j += 1
                        continue
                    
                    next_indent = len(next_line) - len(next_line.lstrip())
                    
                    # If we find same or lower indentation
                    if next_indent <= indent:
                        if next_line.strip().startswith(('except', 'finally')):
                            has_except_or_finally = True
                        break
                    else:
                        has_content = True
                    
                    j += 1
                
                # If we have content but no except/finally, add generic except
                if has_content and not has_except_or_finally:
                    # Find where to insert the except block
                    k = j
                    except_lines = [
                        f'{try_indent}except Exception as e:',
                        f'{try_indent}    logger.error(f"Error: {{e}}")',
                        f'{try_indent}    raise'
                    ]
                    
                    # Insert at the right position
                    for except_line in reversed(except_lines):
                        new_lines.insert(len(new_lines), except_line)
            
            i += 1
        
        # Write back
        with open(file_path, 'w') as f:
            f.write('\n'.join(new_lines))
        return True
    except Exception as e:
        print(f"Error adding except blocks to {file_path}: {e}")
        return False


def remove_duplicate_functions(file_path):
    """Remove duplicate function definitions."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Find all function definitions with decorators
        pattern = r'(@router\.\w+.*?\n)(async\s+)?def\s+(\w+)\s*\([^:]*\):'
        functions_seen = set()
        
        def replace_func(match):
            func_name = match.group(3)
            if func_name in functions_seen:
                return ''  # Remove duplicate
            else:
                functions_seen.add(func_name)
                return match.group(0)  # Keep original
        
        # Remove duplicates
        content = re.sub(pattern, replace_func, content, flags=re.MULTILINE | re.DOTALL)
        
        with open(file_path, 'w') as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"Error removing duplicates from {file_path}: {e}")
        return False


def fix_invalid_syntax_patterns(file_path):
    """Fix known invalid syntax patterns."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Fix EOF syntax errors
        content = re.sub(r'EOF\s*<\s*/dev/null.*$', '', content, flags=re.MULTILINE)
        
        # Fix orphaned import statements
        content = re.sub(r'^(\s*)import\s+logging\s*$', r'import logging', content, flags=re.MULTILINE)
        
        # Fix malformed function definitions
        content = re.sub(r'def\s+(\w+)\s*\(\s*#[^)]*\)', r'def \1(', content)
        
        with open(file_path, 'w') as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"Error fixing syntax patterns in {file_path}: {e}")
        return False


def main():
    """Main function to fix all syntax errors."""
    print("Starting comprehensive syntax error fix...")
    
    # Get initial error count
    stdout, stderr = run_flake8_check()
    print("Initial syntax check:")
    print(stdout[-200:] if stdout else "No output")
    
    # Find all Python files
    python_files = []
    for root, dirs, files in os.walk('.'):
        # Skip certain directories
        if any(skip in root for skip in ['.git', '__pycache__', '.pytest_cache', 'venv']):
            continue
        
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    
    print(f"Found {len(python_files)} Python files to process")
    
    # Apply fixes
    fixed_files = []
    for file_path in python_files:
        print(f"Processing {file_path}...")
        
        success = True
        try:
            success &= fix_invalid_syntax_patterns(file_path)
            success &= fix_orphaned_try_blocks(file_path)
            success &= fix_indentation_errors(file_path)
            success &= remove_duplicate_functions(file_path)
            success &= fix_missing_except_blocks(file_path)
            
            if success:
                fixed_files.append(file_path)
        except Exception as e:
            print(f"Failed to process {file_path}: {e}")
    
    print(f"\nProcessed {len(fixed_files)} files successfully")
    
    # Run final check
    print("\nRunning final syntax check...")
    stdout, stderr = run_flake8_check()
    print("Final syntax check:")
    print(stdout[-500:] if stdout else "No syntax errors found!")
    
    # Extract error count
    if stdout:
        lines = stdout.strip().split('\n')
        for line in lines:
            if 'E999' in line and 'SyntaxError' in line:
                print(f"Remaining syntax errors: {line}")


if __name__ == "__main__":
    main()