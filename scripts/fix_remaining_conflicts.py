#!/usr/bin/env python3
"""
Script to automatically fix remaining merge conflicts in Python files.
This script resolves simple conflicts by preferring the HEAD version.
"""

import os
import re
import glob

def fix_merge_conflicts_in_file(file_path):
    """Fix merge conflicts in a single file by keeping HEAD version."""
    print(f"Processing {file_path}...")
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Check if file has merge conflicts
    if '<<<<<<< HEAD' not in content:
        print(f"  No conflicts found in {file_path}")
        return False
    
    # Pattern to match merge conflict blocks
    conflict_pattern = re.compile(
        r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> origin/main',
        re.DOTALL
    )
    
    changes_made = False
    
    # Replace conflicts with HEAD version
    def replace_conflict(match):
        head_content = match.group(1)
        origin_content = match.group(2)
        
        # Special handling for import statements
        if 'import' in head_content or 'import' in origin_content:
            # Combine both imports if they're different
            head_lines = head_content.strip().split('\n')
            origin_lines = origin_content.strip().split('\n')
            
            combined_imports = []
            for line in head_lines:
                if line.strip():
                    combined_imports.append(line)
            for line in origin_lines:
                if line.strip() and line not in head_lines:
                    combined_imports.append(line)
            
            return '\n'.join(combined_imports)
        
        # For non-import conflicts, prefer HEAD
        return head_content
    
    # Apply the replacements
    new_content = conflict_pattern.sub(replace_conflict, content)
    
    if new_content != content:
        with open(file_path, 'w') as f:
            f.write(new_content)
        print(f"  Fixed conflicts in {file_path}")
        changes_made = True
    
    return changes_made

def main():
    """Main function to fix all conflicts."""
    # Find all Python files with conflicts
    python_files = []
    for root, dirs, files in os.walk('.'):
        # Skip virtual environments and __pycache__
        dirs[:] = [d for d in dirs if d not in ['venv', '__pycache__', '.git', 'node_modules']]
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    
    files_with_conflicts = []
    for file_path in python_files:
        try:
            with open(file_path, 'r') as f:
                if '<<<<<<< HEAD' in f.read():
                    files_with_conflicts.append(file_path)
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    
    print(f"Found {len(files_with_conflicts)} Python files with merge conflicts")
    
    fixed_count = 0
    for file_path in files_with_conflicts:
        try:
            if fix_merge_conflicts_in_file(file_path):
                fixed_count += 1
        except Exception as e:
            print(f"Error fixing {file_path}: {e}")
    
    print(f"\nFixed conflicts in {fixed_count} files")
    print(f"Remaining files with conflicts: {len(files_with_conflicts) - fixed_count}")

if __name__ == "__main__":
    main()