#!/usr/bin/env python3
"""
Test that all endpoint files can be imported without errors
"""

import importlib
import sys
from pathlib import Path

def test_imports():
    """Test importing all endpoint modules"""
    endpoints_dir = Path("app/api/v1/endpoints")
    failed_imports = []
    successful_imports = []
    
    # Add backend directory to path
    sys.path.insert(0, str(Path.cwd()))
    
    for py_file in endpoints_dir.glob("*.py"):
        if py_file.name == "__init__.py":
            continue
            
        module_name = f"app.api.v1.endpoints.{py_file.stem}"
        
        try:
            importlib.import_module(module_name)
            successful_imports.append(module_name)
        except Exception as e:
            failed_imports.append((module_name, str(e)))
    
    print(f"✅ Successfully imported {len(successful_imports)} modules")
    
    if failed_imports:
        print(f"\n❌ Failed to import {len(failed_imports)} modules:")
        for module, error in failed_imports:
            print(f"  - {module}: {error}")
        return False
    
    return True

if __name__ == "__main__":
    success = test_imports()
    sys.exit(0 if success else 1)
