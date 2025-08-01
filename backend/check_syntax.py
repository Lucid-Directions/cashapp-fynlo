#!/usr/bin/env python3
import ast
import os
import sys
from pathlib import Path

def check_file_syntax(filepath):
    """Check if a Python file has valid syntax."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        ast.parse(content)
        return True, None
    except SyntaxError as e:
        return False, str(e)
    except Exception as e:
        return False, f"Error reading file: {str(e)}"

def find_syntax_errors(directory):
    """Find all Python files with syntax errors in a directory."""
    errors = []
    total_files = 0
    
    for root, dirs, files in os.walk(directory):
        # Skip virtual environments and cache directories
        dirs[:] = [d for d in dirs if d not in ['venv', '__pycache__', '.git', 'env', '.env']]
        
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                total_files += 1
                
                valid, error = check_file_syntax(filepath)
                if not valid:
                    errors.append((filepath, error))
                    print(f"❌ {filepath}")
                    print(f"   Error: {error}")
                    print()
    
    return errors, total_files

if __name__ == "__main__":
    print("Checking Python syntax in all files...")
    print("=" * 60)
    
    errors, total = find_syntax_errors(".")
    
    print("=" * 60)
    print(f"Total files checked: {total}")
    print(f"Files with errors: {len(errors)}")
    
    if errors:
        print("\nSummary of files with syntax errors:")
        for filepath, _ in errors:
            print(f"  - {filepath}")