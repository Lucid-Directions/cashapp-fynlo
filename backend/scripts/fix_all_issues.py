#!/usr/bin/env python3
"""
Comprehensive script to fix all PR Guardian issues:
1. Syntax errors (trailing commas)
2. HTTPException to FynloException migration
3. Empty error messages
4. except HTTPException blocks
"""

import os
import re
import ast
from pathlib import Path
from typing import List, Tuple

# Get the backend directory
BACKEND_DIR = Path(__file__).parent.parent

def fix_trailing_commas():
    """Fix trailing commas in import statements"""
    fixed_files = []
    
    # Pattern to match import statements with trailing commas
    patterns = [
        (r'from\s+\w+(?:\.\w+)*\s+import\s+[^,\n]+,\s*\n', lambda m: m.group(0).rstrip().rstrip(',') + '\n'),
        (r'from\s+fastapi\s+import\s+[^,\n]+,\s*\n', lambda m: m.group(0).rstrip().rstrip(',') + '\n'),
    ]
    
    for root, dirs, files in os.walk(BACKEND_DIR / "app"):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r') as f:
                        content = f.read()
                    
                    original_content = content
                    for pattern, replacement in patterns:
                        content = re.sub(pattern, replacement, content)
                    
                    if content != original_content:
                        with open(filepath, 'w') as f:
                            f.write(content)
                        fixed_files.append(filepath)
                except Exception as e:
                    print(f"Error processing {filepath}: {e}")
    
    return fixed_files

def migrate_httpexception_to_fynloexception():
    """Complete migration from HTTPException to FynloException"""
    fixed_files = []
    
    # Mapping of status codes to exception classes
    status_to_exception = {
        '400': 'BadRequestError',
        '401': 'UnauthorizedError',
        '403': 'ForbiddenError',
        '404': 'NotFoundError',
        '409': 'ConflictError',
        '422': 'ValidationError',
        '500': 'InternalServerError',
        '502': 'BadGatewayError',
        '503': 'ServiceUnavailableError',
    }
    
    for root, dirs, files in os.walk(BACKEND_DIR / "app"):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r') as f:
                        content = f.read()
                    
                    original_content = content
                    
                    # Fix HTTPException imports
                    content = re.sub(
                        r'from\s+fastapi\s+import\s+([^,\n]*?)(?:,\s*)?HTTPException(?:,\s*)?([^,\n]*)',
                        lambda m: f"from fastapi import {m.group(1).strip()}{', ' if m.group(1).strip() and m.group(2).strip() else ''}{m.group(2).strip()}".strip(),
                        content
                    )
                    
                    # Add FynloException import if needed
                    if 'HTTPException' in original_content and 'from app.core.exceptions import' not in content:
                        # Add import after other imports
                        import_match = re.search(r'(from .+ import .+\n)+', content)
                        if import_match:
                            insert_pos = import_match.end()
                            content = content[:insert_pos] + "from app.core.exceptions import FynloException\n" + content[insert_pos:]
                    
                    # Replace HTTPException raises with appropriate FynloException subclasses
                    def replace_raise(match):
                        status_code = match.group(1)
                        detail = match.group(2)
                        
                        # Extract numeric status code
                        status_num = re.search(r'(\d{3})', status_code)
                        if status_num:
                            exc_class = status_to_exception.get(status_num.group(1), 'FynloException')
                        else:
                            exc_class = 'FynloException'
                        
                        # Fix empty messages
                        if 'detail=""' in detail or "detail=''" in detail:
                            detail = detail.replace('detail=""', 'message="An error occurred"')
                            detail = detail.replace("detail=''", "message='An error occurred'")
                        else:
                            detail = detail.replace('detail=', 'message=')
                        
                        # Ensure the appropriate exception is imported
                        if exc_class != 'FynloException' and f'from app.core.exceptions import' in content:
                            import_line = re.search(r'from app\.core\.exceptions import (.+)', content)
                            if import_line and exc_class not in import_line.group(1):
                                new_imports = import_line.group(1).strip()
                                if not new_imports.endswith(','):
                                    new_imports += ', '
                                new_imports += exc_class
                                content_parts = content.split('\n')
                                for i, line in enumerate(content_parts):
                                    if 'from app.core.exceptions import' in line:
                                        content_parts[i] = f'from app.core.exceptions import {new_imports}'
                                        break
                        
                        return f"raise {exc_class}({detail}"
                    
                    content = re.sub(
                        r'raise\s+HTTPException\s*\(\s*status_code\s*=\s*([^,]+),\s*(.+?)\)',
                        replace_raise,
                        content,
                        flags=re.DOTALL
                    )
                    
                    # Fix except HTTPException blocks
                    content = re.sub(
                        r'except\s+HTTPException(?:\s+as\s+\w+)?:',
                        'except FynloException:',
                        content
                    )
                    
                    if content != original_content:
                        with open(filepath, 'w') as f:
                            f.write(content)
                        fixed_files.append(filepath)
                except Exception as e:
                    print(f"Error processing {filepath}: {e}")
    
    return fixed_files

def fix_empty_error_messages():
    """Fix all empty error messages"""
    fixed_files = []
    
    patterns = [
        (r'message\s*=\s*""', 'message="An error occurred"'),
        (r"message\s*=\s*''", "message='An error occurred'"),
        (r'detail\s*=\s*""', 'detail="An error occurred"'),
        (r"detail\s*=\s*''", "detail='An error occurred'"),
    ]
    
    for root, dirs, files in os.walk(BACKEND_DIR / "app"):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r') as f:
                        content = f.read()
                    
                    original_content = content
                    for pattern, replacement in patterns:
                        content = re.sub(pattern, replacement, content)
                    
                    if content != original_content:
                        with open(filepath, 'w') as f:
                            f.write(content)
                        fixed_files.append(filepath)
                except Exception as e:
                    print(f"Error processing {filepath}: {e}")
    
    return fixed_files

def main():
    print("🔧 Starting comprehensive fix for PR Guardian issues...")
    
    # Step 1: Fix syntax errors
    print("\n1️⃣ Fixing trailing comma syntax errors...")
    syntax_fixed = fix_trailing_commas()
    print(f"   Fixed {len(syntax_fixed)} files with syntax errors")
    
    # Step 2: Complete HTTPException migration
    print("\n2️⃣ Migrating HTTPException to FynloException...")
    migration_fixed = migrate_httpexception_to_fynloexception()
    print(f"   Migrated {len(migration_fixed)} files")
    
    # Step 3: Fix empty error messages
    print("\n3️⃣ Fixing empty error messages...")
    messages_fixed = fix_empty_error_messages()
    print(f"   Fixed {len(messages_fixed)} files with empty messages")
    
    # Summary
    print("\n✅ Fix complete!")
    print(f"Total files modified: {len(set(syntax_fixed + migration_fixed + messages_fixed))}")
    
    # Verify no HTTPException remains
    print("\n🔍 Verifying migration completeness...")
    remaining = []
    for root, dirs, files in os.walk(BACKEND_DIR / "app"):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r') as f:
                        content = f.read()
                    if 'HTTPException' in content:
                        remaining.append(filepath)
                except:
                    pass
    
    if remaining:
        print(f"⚠️  WARNING: {len(remaining)} files still contain HTTPException:")
        for f in remaining[:5]:
            print(f"   - {f}")
    else:
        print("✅ No HTTPException references found!")

if __name__ == "__main__":
    main()