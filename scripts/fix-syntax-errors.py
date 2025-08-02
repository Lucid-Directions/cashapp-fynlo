#!/usr/bin/env python3
"""
Fix all syntax errors identified in PR #459
Handles the remaining critical syntax errors
"""

import os
import sys
from pathlib import Path

def fix_file(filepath: str, fixes: list):
    """Apply fixes to a file"""
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        original = content
        for old, new in fixes:
            content = content.replace(old, new)
        
        if content != original:
            with open(filepath, 'w') as f:
                f.write(content)
            print(f"✅ Fixed: {filepath}")
            return True
        else:
            print(f"⚠️  No changes needed: {filepath}")
            return False
    except Exception as e:
        print(f"❌ Error fixing {filepath}: {e}")
        return False

def main():
    backend_path = Path("backend")
    
    # List of files and their fixes
    fixes = {
        "app/core/cache_service.py": [
            # Fix indentation issue at line 232
            ("    @cache_method_with_ttl(ttl=300)\n        return result", 
             "    @cache_method_with_ttl(ttl=300)\n    def get_cached_data(self, key: str):\n        return result")
        ],
        "app/core/tenant_security_current.py": [
            # Fix unterminated triple-quoted string
            ('"""\n    \n    # No closing triple quotes', 
             '"""\n    pass\n    """')
        ],
        "app/core/transaction_manager.py": [
            # Fix indentation at line 172
            ("    @contextmanager\n        try:", 
             "    @contextmanager\n    def transaction(self):\n        try:")
        ],
        "app/models/platform_audit.py": [
            # Fix 'return' outside function
            ("# Outside any function\nreturn audit_log", 
             "# Fixed return statement\n        return audit_log")
        ],
        "app/schemas/employee_schemas.py": [
            # Fix indentation at line 59
            ("    class Config:\n        pass", 
             "    class Config:\n        pass")
        ],
        "app/schemas/search_schemas.py": [
            # Fix indentation at line 24
            ("    @validator('query')\n        return v.strip()", 
             "    @validator('query')\n    def validate_query(cls, v):\n        return v.strip()")
        ],
        "app/schemas/subscription.py": [
            # Fix indentation at line 42
            ("    @validator('plan')\n        return v", 
             "    @validator('plan')\n    def validate_plan(cls, v):\n        return v")
        ],
        "app/services/activity_logger.py": [
            # Fix indentation at line 36
            ("    def log_activity(self, activity: str):\n        logger.info(activity)", 
             "    def log_activity(self, activity: str):\n        logger.info(activity)")
        ],
        "app/crud/inventory.py": [
            # Fix indentation at line 15
            ("def get_inventory_items(\n        db: Session,", 
             "def get_inventory_items(\n    db: Session,")
        ],
        "app/api/v1/endpoints/secure_payments.py": [
            # Fix indentation at line 41
            ("@router.post(\"/payments\")\n        async def create_payment(", 
             "@router.post(\"/payments\")\nasync def create_payment(")
        ]
    }
    
    fixed_count = 0
    for relative_path, file_fixes in fixes.items():
        filepath = backend_path / relative_path
        if filepath.exists():
            if fix_file(str(filepath), file_fixes):
                fixed_count += 1
        else:
            print(f"⚠️  File not found: {filepath}")
    
    print(f"\n📊 Summary: Fixed {fixed_count} files")
    
    # Now run a validation check
    print("\n🔍 Running validation check...")
    import subprocess
    result = subprocess.run(
        ["python3", "-m", "compileall", "-q", "backend/app/"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("✅ All syntax errors fixed!")
        return 0
    else:
        print("❌ Some syntax errors remain:")
        print(result.stderr)
        return 1

if __name__ == '__main__':
    os.chdir("/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo")
    sys.exit(main())