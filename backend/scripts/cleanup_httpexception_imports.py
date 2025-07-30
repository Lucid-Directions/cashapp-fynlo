#!/usr/bin/env python3
"""
Clean up unused HTTPException imports after migration to FynloException.
"""

import os
import re
from pathlib import Path
from typing import List, Tuple

def find_unused_httpexception_imports(file_path: Path) -> bool:
    """Check if a file imports HTTPException but doesn't use it."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if HTTPException is imported
        import_pattern = r'from\s+fastapi\s+import\s+.*HTTPException'
        has_import = bool(re.search(import_pattern, content))
        
        if not has_import:
            return False
        
        # Check if HTTPException is actually used
        # Look for: raise HTTPException, except HTTPException, or HTTPException(
        usage_patterns = [
            r'raise\s+HTTPException',
            r'except\s+HTTPException',
            r'HTTPException\s*\(',
            r':\s*HTTPException',  # Type annotations
        ]
        
        for pattern in usage_patterns:
            if re.search(pattern, content):
                return False  # It's being used
        
        return True  # Imported but not used
    
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def remove_httpexception_from_imports(file_path: Path) -> bool:
    """Remove HTTPException from fastapi imports."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Pattern to match fastapi import line with HTTPException
        import_pattern = r'(from\s+fastapi\s+import\s+)(.*)'
        
        def replace_import(match):
            prefix = match.group(1)
            imports = match.group(2)
            
            # Split imports and remove HTTPException
            import_list = [imp.strip() for imp in imports.split(',')]
            import_list = [imp for imp in import_list if imp != 'HTTPException']
            
            if not import_list:
                # If no imports left, remove the entire line
                return ''
            
            # Reconstruct the import line
            return prefix + ', '.join(import_list)
        
        content = re.sub(import_pattern, replace_import, content)
        
        # Clean up any empty lines left behind
        content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
    
    except Exception as e:
        print(f"Error updating {file_path}: {e}")
        return False

def main():
    # Define the backend directory
    backend_dir = Path('/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend')
    
    # Find all Python files
    python_files = list(backend_dir.rglob('*.py'))
    
    print(f"Scanning {len(python_files)} Python files...")
    
    files_with_unused_imports = []
    
    # First, identify files with unused HTTPException imports
    for file_path in python_files:
        # Skip migration scripts and test files
        if 'fix_httpexception' in str(file_path) or '__pycache__' in str(file_path):
            continue
        
        if find_unused_httpexception_imports(file_path):
            files_with_unused_imports.append(file_path)
    
    print(f"\nFound {len(files_with_unused_imports)} files with unused HTTPException imports:")
    for file_path in files_with_unused_imports:
        print(f"  - {file_path.relative_to(backend_dir)}")
    
    if not files_with_unused_imports:
        print("\nNo files with unused HTTPException imports found.")
        return
    
    # Auto-confirm for automated run
    print("\nProceeding to remove unused imports...")
    
    # Clean up the files
    updated_count = 0
    for file_path in files_with_unused_imports:
        if remove_httpexception_from_imports(file_path):
            print(f"✓ Updated: {file_path.relative_to(backend_dir)}")
            updated_count += 1
        else:
            print(f"✗ Failed to update: {file_path.relative_to(backend_dir)}")
    
    print(f"\nSuccessfully updated {updated_count} files.")
    
    # List temporary files to remove
    temp_files = [
        backend_dir / 'scripts' / 'fix_auth_httpexceptions.py',
        backend_dir / 'scripts' / 'fix_final_httpexceptions.py',
        backend_dir / 'scripts' / 'fix_httpexception_advanced.py',
        backend_dir / 'scripts' / 'fix_httpexception_ultimate.py',
        backend_dir / 'scripts' / 'fix_remaining_httpexceptions.py',
        backend_dir / 'app' / 'api' / 'v1' / 'endpoints' / 'exports.py.bak',
        backend_dir / 'ultimate_fix_report.json',
    ]
    
    existing_temp_files = [f for f in temp_files if f.exists()]
    
    if existing_temp_files:
        print(f"\nFound {len(existing_temp_files)} temporary files to remove:")
        for file_path in existing_temp_files:
            print(f"  - {file_path.relative_to(backend_dir)}")
        
        print("\nProceeding to remove temporary files...")
        for file_path in existing_temp_files:
                try:
                    file_path.unlink()
                    print(f"✓ Removed: {file_path.relative_to(backend_dir)}")
                except Exception as e:
                    print(f"✗ Failed to remove {file_path.relative_to(backend_dir)}: {e}")

if __name__ == "__main__":
    main()