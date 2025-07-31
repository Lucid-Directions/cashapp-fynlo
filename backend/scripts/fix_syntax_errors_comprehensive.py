#!/usr/bin/env python3
"""
Comprehensive fix for syntax errors introduced by the migration script
"""

import re
from pathlib import Path

def fix_file(filepath):
    """Fix syntax errors in a single file"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Fix patterns:
    # 1. Empty message with extra closing brackets: message="")}") or message=""))
    content = re.sub(r'message=""\)\}"\s*\)', r'message="")', content)
    content = re.sub(r'message=""\)\}"', r'message="")', content)
    content = re.sub(r'message=""\)\)', r'message="")', content)
    
    # 2. Fix status_code patterns with extra brackets
    content = re.sub(r'status_code=(\d+)\)\}"\)', r'status_code=\1)', content)
    content = re.sub(r'status_code=(\d+)\)\}"', r'status_code=\1)', content)
    content = re.sub(r'status_code=(\d+)\)\)', r'status_code=\1)', content)
    
    # 3. Fix combined patterns like message="", status_code=500)}")
    content = re.sub(r'(message="[^"]*",\s*status_code=\d+)\)\}"\)', r'\1)', content)
    content = re.sub(r'(message="[^"]*",\s*status_code=\d+)\)\}"', r'\1)', content)
    content = re.sub(r'(message="[^"]*",\s*status_code=\d+)\)\)', r'\1)', content)
    
    # 4. Unterminated strings in f-strings
    content = re.sub(r'(message=f"[^"]*)\'\s*\)', r'\1")', content)
    
    # 5. Fix specific secure_payments.py issue with default argument
    if 'secure_payments.py' in str(filepath):
        # Find the function with the issue and fix it
        # Look for the pattern where we have a default argument followed by non-default
        content = re.sub(
            r'(\s+)payment_provider: Optional\[str\] = None,\s*\n\s*request: Request,',
            r'\1request: Request,\n\1payment_provider: Optional[str] = None,',
            content
        )
    
    # Save if modified
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed: {filepath}")
        return True
    return False

def main():
    """Fix all files with syntax errors"""
    # All files that might have syntax errors
    files_to_fix = [
        "app/api/v1/endpoints/admin.py",
        "app/api/v1/endpoints/config.py",
        "app/api/v1/endpoints/fees.py",
        "app/api/v1/endpoints/inventory.py",
        "app/api/v1/endpoints/orders.py",
        "app/api/v1/endpoints/payment_configurations.py",
        "app/api/v1/endpoints/payments.py",
        "app/api/v1/endpoints/platform_settings_public.py",
        "app/api/v1/endpoints/platform_settings.py",
        "app/api/v1/endpoints/tips.py",
        "app/api/v1/endpoints/secure_payments.py"
    ]
    
    fixed_count = 0
    for filepath in files_to_fix:
        if Path(filepath).exists():
            if fix_file(filepath):
                fixed_count += 1
    
    print(f"\nFixed {fixed_count} files")

if __name__ == "__main__":
    main()