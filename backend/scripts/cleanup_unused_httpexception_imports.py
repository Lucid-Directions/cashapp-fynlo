#!/usr/bin/env python3
"""
Cleanup unused HTTPException imports from API endpoints
"""
import os
import re
from pathlib import Path

def remove_httpexception_from_imports(content):
    """Remove HTTPException from import statements if not used in the file"""
    
    # Check if HTTPException is actually used (not just imported)
    if re.search(r'\braise\s+HTTPException\b', content) or \
       re.search(r'\bexcept\s+HTTPException\b', content) or \
       re.search(r'\bHTTPException\s*\(', content):
        return content, False
    
    # Pattern to match fastapi imports with HTTPException
    import_pattern = r'from\s+fastapi\s+import\s+([^;\n]+)'
    
    def clean_import(match):
        imports = match.group(1)
        # Split imports and remove HTTPException
        import_list = [imp.strip() for imp in imports.split(',')]
        cleaned_imports = [imp for imp in import_list if 'HTTPException' not in imp]
        
        if not cleaned_imports:
            # If HTTPException was the only import, remove the line
            return ''
        
        # Reconstruct the import statement
        if len(cleaned_imports) == 1:
            return f'from fastapi import {cleaned_imports[0]}'
        else:
            # Format multi-line imports nicely
            return f'from fastapi import {", ".join(cleaned_imports)}'
    
    # Apply the cleaning
    new_content = re.sub(import_pattern, clean_import, content)
    
    # Remove any empty lines that resulted from removing imports
    new_content = re.sub(r'\n\n\n+', '\n\n', new_content)
    
    return new_content, new_content != content

def process_file(filepath):
    """Process a single file to remove unused HTTPException imports"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content, changed = remove_httpexception_from_imports(content)
        
        if changed:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    """Main function to process all API endpoint files"""
    endpoints_dir = Path('app/api/v1/endpoints')
    
    if not endpoints_dir.exists():
        print(f"Directory {endpoints_dir} not found!")
        return
    
    total_files = 0
    cleaned_files = 0
    
    for py_file in endpoints_dir.glob('*.py'):
        if py_file.name == '__init__.py':
            continue
            
        total_files += 1
        if process_file(py_file):
            cleaned_files += 1
            print(f"✓ Cleaned: {py_file}")
        else:
            print(f"  No changes: {py_file}")
    
    print(f"\nSummary:")
    print(f"- Files checked: {total_files}")
    print(f"- Files cleaned: {cleaned_files}")
    print(f"- Unused HTTPException imports removed: {cleaned_files}")

if __name__ == "__main__":
    main()