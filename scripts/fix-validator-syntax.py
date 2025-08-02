#!/usr/bin/env python3
"""Fix validator method syntax errors from PR #459"""

import re
import os
from pathlib import Path

def fix_validator_syntax(file_path):
    """Fix validator methods missing function definitions"""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        original_content = content
        fixes_made = []
        
        # Pattern to find validator decorators followed by missing method definitions
        # This captures validators that don't have proper method definitions
        patterns = [
            # Pattern 1: @validator followed by just if statement (missing def)
            (r'(@validator\([^)]+\))\s*\n\s*(if\s+)', r'\1\n    def validate_method(cls, v):\n        \2'),
            
            # Pattern 2: @validator with TODO comment and pass, followed by docstring
            (r'(@validator\([^)]+\))\s*\n\s*def\s+(\w+)\(cls,\s*v\):\s*\n\s*"""TODO:[^"]*"""\s*\n\s*pass\s*\n\s*"""([^"]+)"""', 
             r'\1\n    def \2(cls, v):\n        """\3"""'),
             
            # Pattern 3: Fix double docstrings and pass statements
            (r'def\s+(\w+)\(cls,\s*v\):\s*\n\s*"""TODO:[^"]*"""\s*\n\s*pass\s*\n(\s+)"""([^"]+)"""',
             r'def \1(cls, v):\n\2"""\3"""'),
             
            # Pattern 4: Add values parameter for validators that need it
            (r'@validator\(\'max_amount\'\)\s*\n\s*(if\s+)', 
             r"@validator('max_amount')\n    def validate_max_amount(cls, v, values):\n        \2"),
             
            (r'@validator\(\'max_price\'\)\s*\n\s*(if\s+)', 
             r"@validator('max_price')\n    def validate_max_price(cls, v, values):\n        \2"),
        ]
        
        for pattern, replacement in patterns:
            if re.search(pattern, content):
                content = re.sub(pattern, replacement, content)
                fixes_made.append(f"Fixed validator pattern: {pattern[:50]}...")
        
        # Fix specific validator methods that are missing function names
        validator_fixes = [
            # Fix validators with missing method names
            (r'@validator\(\'([^\']+)\'[^)]*\)\s*\n\s*if\s+v:',
             lambda m: f"@validator('{m.group(1)}')\n    def validate_{m.group(1).replace(',', '_').replace(' ', '').replace('\'', '')}(cls, v):\n        if v:"),
            
            # Fix validators that need the values parameter
            (r'def validate_max_amount\(cls, v\):\s*\n\s*if v and \'min_amount\' in values',
             r'def validate_max_amount(cls, v, values):\n        if v and \'min_amount\' in values'),
             
            (r'def validate_max_price\(cls, v\):\s*\n\s*if v and \'min_price\' in values',
             r'def validate_max_price(cls, v, values):\n        if v and \'min_price\' in values'),
        ]
        
        for pattern, replacement in validator_fixes:
            if callable(replacement):
                # Use lambda for dynamic replacements
                content = re.sub(pattern, replacement, content)
            else:
                content = re.sub(pattern, replacement, content)
        
        # Fix @validator('ids') missing method definition
        content = re.sub(
            r'@validator\(\'ids\'\)\s*\n\s*for id_val in v:',
            r"@validator('ids')\n    def validate_ids(cls, v):\n        for id_val in v:",
            content
        )
        
        # Clean up any remaining TODO comments with pass statements
        content = re.sub(
            r'"""TODO: Implement function\."""\s*\n\s*pass\s*\n',
            '',
            content
        )
        
        if content != original_content:
            with open(file_path, 'w') as f:
                f.write(content)
            return True, fixes_made
        return False, []
        
    except Exception as e:
        return False, [f"Error: {str(e)}"]

def main():
    """Main function to fix validator syntax errors"""
    backend_path = Path("/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/backend")
    
    # Target files with validator issues
    target_files = [
        "app/schemas/search_schemas.py",
        "app/schemas/employee_schemas.py",
        "app/schemas/subscription.py",
        "app/core/security.py",
        "app/core/validators.py",
    ]
    
    print("🔧 Fixing validator syntax errors...")
    print("=" * 50)
    
    fixed_count = 0
    for file_path in target_files:
        full_path = backend_path / file_path
        if full_path.exists():
            success, fixes = fix_validator_syntax(full_path)
            if success:
                print(f"✅ Fixed: {file_path}")
                for fix in fixes:
                    print(f"   - {fix}")
                fixed_count += 1
            else:
                if fixes and fixes[0].startswith("Error"):
                    print(f"❌ Error fixing {file_path}: {fixes[0]}")
                else:
                    print(f"ℹ️  No changes needed: {file_path}")
        else:
            print(f"⚠️  File not found: {file_path}")
    
    print(f"\n✅ Fixed {fixed_count} files")

if __name__ == "__main__":
    main()