#!/usr/bin/env python3
"""
Script to clean up unused imports identified by flake8
"""

import subprocess
import re
import os
from pathlib import Path

def get_unused_imports():
    """Get list of unused imports from flake8"""
    try:
        result = subprocess.run([
            'python', '-m', 'flake8', 'app/', '--select=F401', '--show-source'
        ], capture_output=True, text=True, cwd='/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend')
        
        return result.stdout.strip().split('\n') if result.stdout.strip() else []
    except Exception as e:
        print(f"Error running flake8: {e}")
        return []

def parse_unused_import(line):
    """Parse flake8 output line to extract file and unused import"""
    if not line or 'F401' not in line:
        return None, None
    
    # Pattern: app/path/file.py:line:col: F401 'module.import' imported but unused
    pattern = r"(app/[^:]+):(\d+):\d+: F401 '([^']+)' imported but unused"
    match = re.match(pattern, line)
    
    if match:
        file_path = match.group(1)
        line_num = int(match.group(2))
        import_name = match.group(3)
        return file_path, (line_num, import_name)
    
    return None, None

def remove_unused_import(file_path, line_num, import_name):
    """Remove unused import from file"""
    try:
        full_path = f"/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend/{file_path}"
        
        with open(full_path, 'r') as f:
            lines = f.readlines()
        
        if line_num <= len(lines):
            original_line = lines[line_num - 1].strip()
            
            # Check if it's a single import
            if f"import {import_name}" in original_line and original_line.count(',') == 0:
                # Remove entire line
                lines[line_num - 1] = ''
            else:
                # Remove specific import from multi-import line
                # Handle various import patterns
                if ', ' + import_name.split('.')[-1] in original_line:
                    lines[line_num - 1] = original_line.replace(', ' + import_name.split('.')[-1], '') + '\n'
                elif import_name.split('.')[-1] + ', ' in original_line:
                    lines[line_num - 1] = original_line.replace(import_name.split('.')[-1] + ', ', '') + '\n'
                elif import_name.split('.')[-1] in original_line:
                    # Last resort - remove the specific import
                    lines[line_num - 1] = original_line.replace(import_name.split('.')[-1], '') + '\n'
        
        # Write back to file
        with open(full_path, 'w') as f:
            f.writelines(lines)
            
        print(f"Removed unused import '{import_name}' from {file_path}:{line_num}")
        return True
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main cleanup function"""
    print("🧹 Starting unused imports cleanup...")
    
    # Get unused imports
    flake8_output = get_unused_imports()
    
    if not flake8_output:
        print("✅ No unused imports found!")
        return
    
    # Group by file
    files_to_clean = {}
    for line in flake8_output:
        file_path, import_info = parse_unused_import(line)
        if file_path and import_info:
            if file_path not in files_to_clean:
                files_to_clean[file_path] = []
            files_to_clean[file_path].append(import_info)
    
    print(f"Found {len(files_to_clean)} files with unused imports")
    
    # Clean each file
    total_removed = 0
    for file_path, imports in files_to_clean.items():
        print(f"\n📁 Cleaning {file_path}...")
        
        # Sort by line number in reverse order to avoid line number shifts
        imports.sort(key=lambda x: x[0], reverse=True)
        
        for line_num, import_name in imports:
            if remove_unused_import(file_path, line_num, import_name):
                total_removed += 1
    
    print(f"\n✅ Cleanup complete! Removed {total_removed} unused imports")
    
    # Run flake8 again to verify
    print("\n🔍 Verifying cleanup...")
    remaining = get_unused_imports()
    if remaining and any(line.strip() for line in remaining):
        print(f"⚠️  {len([l for l in remaining if l.strip()])} unused imports still remain")
    else:
        print("✅ All unused imports cleaned up!")

if __name__ == "__main__":
    main()
