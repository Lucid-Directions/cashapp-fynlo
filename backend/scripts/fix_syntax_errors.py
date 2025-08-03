#!/usr/bin/env python3
"""
Fix syntax errors introduced by the migration script
"""

import re
from pathlib import Path

def fix_file(filepath):
    """Fix syntax errors in a single file"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Fix patterns:
    # 1. Empty message with extra closing brackets: message="")}" or message=""))"
    content = re.sub(r'message=""\)\}"\s*\)', r'message="")', content)
    content = re.sub(r'message=""\)\}"', r'message="")', content)
    content = re.sub(r'message=""\)\)', r'message="")', content)
    
    # 2. Unterminated strings in f-strings
    # Fix truncated f-strings
    content = re.sub(r'(message=f"[^"]*)\'\s*\)', r'\1")', content)
    
    # 3. Fix specific known issues
    # Fix the fees.py issue
    if 'fees.py' in str(filepath):
        content = re.sub(
            r'message=f"Fee configuration not found for payment method \{request\.payment_method\.value\} for restaurant \{request\.restaurant_id or \'\)',
            r'message=f"Fee configuration not found for payment method {request.payment_method.value} for restaurant {request.restaurant_id or \'\'}")',
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
        "app/api/v1/endpoints/tips.py"
    ]
    
    fixed_count = 0
    for filepath in files_to_fix:
        if fix_file(filepath):
            fixed_count += 1
    
    print(f"\nFixed {fixed_count} files")

if __name__ == "__main__":
    main()
