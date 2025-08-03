#!/usr/bin/env python3
"""
Emergency syntax error fixer for critical Python compilation issues
"""

import os
import re
from pathlib import Path

def fix_indentation_errors():
    """Fix common indentation errors in Python files"""
    backend_path = Path("backend")
    
    fixes = [
        # Fix secure_payments.py line 62 issue
        {
            "file": backend_path / "app/api/v1/endpoints/secure_payments.py",
            "pattern": r"class RefundRequest\(BaseModel\):\n    \"\"\"Refund processing request\"\"\"",
            "replace": "class RefundRequest(BaseModel):\n    \"\"\"Refund processing request\"\"\"\n    pass  # TODO: Implement refund request fields"
        },
        
        # Fix config.py function definition
        {
            "file": backend_path / "app/core/config.py", 
            "pattern": r"def get_settings\(\) -> Settings:\n$",
            "replace": "def get_settings() -> Settings:\n    return settings"
        },
        
        # Fix production_guard.py indentation
        {
            "file": backend_path / "app/core/production_guard.py",
            "pattern": r"^    import logging",
            "replace": "import logging"
        },
        
        # Fix websocket events import issues
        {
            "file": backend_path / "app/integration/notification_events.py",
            "pattern": r"from app\.core\.websocket import \(\nimport logging",
            "replace": "import logging\n\nfrom app.core.websocket import ("
        },
        
        {
            "file": backend_path / "app/integration/websocket_events.py",
            "pattern": r"from app\.core\.websocket import \(\nimport logging",
            "replace": "import logging\n\nfrom app.core.websocket import ("
        }
    ]
    
    for fix in fixes:
        file_path = fix["file"]
        if file_path.exists():
            content = file_path.read_text()
            if fix["pattern"] in content or re.search(fix["pattern"], content, re.MULTILINE):
                new_content = re.sub(fix["pattern"], fix["replace"], content, flags=re.MULTILINE)
                file_path.write_text(new_content)
                print(f"Fixed {file_path}")

def fix_incomplete_functions():
    """Fix functions with missing implementations"""
    backend_path = Path("backend")
    
    # Find files with TODO functions that need basic implementations
    for py_file in backend_path.rglob("*.py"):
        try:
            content = py_file.read_text()
            
            # Fix empty function definitions
            patterns = [
                (r'def \w+\([^)]*\):\n\s*"""[^"]*"""\n\s*pass\s*$', 
                 lambda m: m.group(0).replace('pass', 'pass  # TODO: Implement')),
                
                # Fix functions with only docstring but no pass
                (r'(def \w+\([^)]*\):\n\s*"""[^"]*"""\s*)(\n\s*def|\nclass|\n$)',
                 lambda m: m.group(1) + '\n    pass  # TODO: Implement' + m.group(2))
            ]
            
            modified = False
            for pattern, replacement in patterns:
                new_content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
                if new_content != content:
                    content = new_content
                    modified = True
            
            if modified:
                py_file.write_text(content)
                print(f"Fixed incomplete functions in {py_file}")
                
        except Exception as e:
            print(f"Error processing {py_file}: {e}")

def add_missing_newlines():
    """Add missing newlines at end of files"""
    backend_path = Path("backend")
    
    for py_file in backend_path.rglob("*.py"):
        try:
            content = py_file.read_text()
            if content and not content.endswith('\n'):
                py_file.write_text(content + '\n')
                print(f"Added newline to {py_file}")
        except Exception as e:
            print(f"Error processing {py_file}: {e}")

def main():
    print("🔧 Fixing critical Python syntax errors...")
    
    # Change to project root
    os.chdir(Path(__file__).parent.parent)
    
    print("1. Fixing indentation errors...")
    fix_indentation_errors()
    
    print("2. Fixing incomplete functions...")
    fix_incomplete_functions()
    
    print("3. Adding missing newlines...")
    add_missing_newlines()
    
    print("✅ Syntax error fixes complete!")

if __name__ == "__main__":
    main()