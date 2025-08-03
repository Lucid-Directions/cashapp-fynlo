#\!/usr/bin/env python3
"""
Fix line length issues by manually breaking long lines
"""

import re

def fix_file_line_lengths(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Fix specific patterns
    fixes = [
        # Long docstrings
        (r'"""([^"]{80,})"""', lambda m: f'"""\n    {m.group(1)}\n    """'),
        
        # Long comments
        (r'# ([^#\n]{80,})', lambda m: f'# {m.group(1)[:75]}\n    # {m.group(1)[75:]}' if len(m.group(1)) > 75 else m.group(0)),
        
        # Long f-strings
        (r'f"([^"]{80,})"', lambda m: f'(\n        f"{m.group(1)[:60]}"\n        f"{m.group(1)[60:]}"\n    )' if len(m.group(1)) > 80 else m.group(0)),
    ]
    
    for pattern, replacement in fixes:
        content = re.sub(pattern, replacement, content)
    
    with open(filepath, 'w') as f:
        f.write(content)

# Apply fixes to specific problematic files
files_to_fix = [
    'backend/app/crud/inventory.py',
    'backend/app/services/email_service.py', 
    'backend/app/services/payment_providers.py'
]

for filepath in files_to_fix:
    try:
        fix_file_line_lengths(filepath)
        print(f"Fixed {filepath}")
    except Exception as e:
        print(f"Error fixing {filepath}: {e}")
