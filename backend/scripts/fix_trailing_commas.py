#!/usr/bin/env python3
"""
Fix trailing comma syntax errors in import statements
"""

import os
import re
from pathlib import Path

def fix_trailing_commas(file_path):
    """Fix trailing commas in import statements"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Pattern to match import statements with trailing commas
        # This matches lines that start with 'from' or 'import' and end with a comma
        import_pattern = r'^(from\s+[\w\.]+\s+import\s+.*?),\s*$'
        
        lines = content.split('\n')
        modified_lines = []
        changes_made = False
        
        for i, line in enumerate(lines):
            # Check if this line is an import with a trailing comma
            if re.match(r'^(from|import)\s+', line.strip()) and line.rstrip().endswith(','):
                # Remove the trailing comma
                modified_line = line.rstrip()[:-1]
                modified_lines.append(modified_line)
                changes_made = True
                print(f"Fixed trailing comma in {file_path}:{i+1}")
                print(f"  Before: {line.rstrip()}")
                print(f"  After:  {modified_line}")
            else:
                modified_lines.append(line)
        
        if changes_made:
            # Write back the fixed content
            fixed_content = '\n'.join(modified_lines)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(fixed_content)
            return True
        
        return False
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main function to fix trailing commas in all Python files"""
    
    # Get the backend directory
    backend_dir = Path(__file__).parent.parent
    
    # Files we know have trailing comma issues
    files_to_fix = [
        "app/api/v1/endpoints/auth.py",
        "app/api/v1/endpoints/analytics.py", 
        "app/api/v1/endpoints/products.py",
        "app/api/v1/platform/analytics.py",  # The one causing test failures
    ]
    
    total_fixed = 0
    
    # First, fix the known files
    print("Fixing known files with trailing comma issues...")
    for file_path in files_to_fix:
        full_path = backend_dir / file_path
        if full_path.exists():
            if fix_trailing_commas(full_path):
                total_fixed += 1
        else:
            print(f"Warning: File not found: {full_path}")
    
    # Now scan for any other files with trailing comma issues
    print("\nScanning for other files with trailing comma issues...")
    for py_file in backend_dir.rglob("*.py"):
        # Skip files we already fixed
        relative_path = py_file.relative_to(backend_dir)
        if str(relative_path) in files_to_fix:
            continue
            
        # Skip migration files and test files for now
        if 'alembic' in str(py_file) or '__pycache__' in str(py_file):
            continue
            
        if fix_trailing_commas(py_file):
            total_fixed += 1
    
    print(f"\nTotal files fixed: {total_fixed}")
    
    # Now let's also check if there are any other syntax issues
    print("\nChecking for any remaining syntax errors...")
    
    # Try to compile all Python files to check for syntax errors
    syntax_errors = []
    for py_file in backend_dir.rglob("*.py"):
        if 'alembic' in str(py_file) or '__pycache__' in str(py_file):
            continue
            
        try:
            with open(py_file, 'r', encoding='utf-8') as f:
                compile(f.read(), py_file, 'exec')
        except SyntaxError as e:
            syntax_errors.append((py_file, e))
    
    if syntax_errors:
        print(f"\nFound {len(syntax_errors)} files with syntax errors:")
        for file_path, error in syntax_errors:
            print(f"  {file_path}: {error}")
    else:
        print("\nNo syntax errors found!")
    
    return total_fixed > 0 or len(syntax_errors) == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
