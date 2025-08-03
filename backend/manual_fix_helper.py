#!/usr/bin/env python3
"""Helper script to assist with manual syntax fixes."""

import ast
import subprocess
import sys
from pathlib import Path


def check_file_syntax(filepath):
    """Check if a file has valid syntax and show the error."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        ast.parse(content)
        return True, "Valid syntax"
    except SyntaxError as e:
        return False, f"Line {e.lineno}: {e.msg}"
    except Exception as e:
        return False, str(e)


def main():
    """Main helper function."""
    if len(sys.argv) > 1:
        # Check specific file
        filepath = Path(sys.argv[1])
        if filepath.exists():
            valid, error = check_file_syntax(filepath)
            if valid:
                print(f"✅ {filepath} - Valid syntax!")
            else:
                print(f"❌ {filepath} - {error}")
                
                # Show the problematic lines
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                # Extract line number from error
                try:
                    line_num = int(error.split('Line ')[1].split(':')[0])
                    print(f"\nContext around line {line_num}:")
                    start = max(0, line_num - 5)
                    end = min(len(lines), line_num + 5)
                    
                    for i in range(start, end):
                        prefix = ">>> " if i == line_num - 1 else "    "
                        print(f"{i+1:4d}{prefix}{lines[i]}", end='')
                except:
                    pass
        else:
            print(f"File not found: {filepath}")
    else:
        # List all files with syntax errors
        print("Files with syntax errors:")
        print("=" * 60)
        
        error_files = []
        for py_file in Path('.').rglob('*.py'):
            if any(skip in str(py_file) for skip in ['venv', '__pycache__', '.git']):
                continue
            
            valid, error = check_file_syntax(py_file)
            if not valid:
                error_files.append((py_file, error))
        
        for filepath, error in sorted(error_files):
            print(f"{filepath}: {error}")
        
        print(f"\nTotal: {len(error_files)} files with syntax errors")


if __name__ == "__main__":
    main()
