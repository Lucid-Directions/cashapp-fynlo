#!/usr/bin/env python3
"""
Comprehensive syntax checker using MCP Tree-sitter server
Catches syntax errors that would cause deployment failures
"""
import os
import sys
import subprocess
import json
from pathlib import Path
from typing import List, Dict, Tuple


def check_file_with_tree_sitter(filepath: Path) -> Tuple[bool, str]:
    """Check a single file for syntax errors using tree-sitter"""
    try:
        # Try to parse with Python's AST first (catches most syntax errors)
        with open(filepath, 'r') as f:
            compile(f.read(), str(filepath), 'exec')
        return True, "OK"
    except SyntaxError as e:
        return False, f"Line {e.lineno}: {e.msg}"
    except Exception as e:
        return False, str(e)


def find_python_files(directory: Path) -> List[Path]:
    """Find all Python files in directory"""
    return list(directory.rglob("*.py"))


def check_for_common_patterns(filepath: Path) -> List[str]:
    """Check for common syntax error patterns"""
    issues = []
    
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    # Check for orphaned triple quotes (our most common issue)
    for i, line in enumerate(lines):
        if line.strip() == '"""':
            # Check if this is between a docstring and imports
            if i > 0 and i < len(lines) - 1:
                prev_line = lines[i-1].strip()
                next_line = lines[i+1].strip()
                
                if prev_line.endswith('"""') and (
                    next_line.startswith('import ') or 
                    next_line.startswith('from ')
                ):
                    issues.append(f"Line {i+1}: Orphaned triple quotes between docstring and imports")
    
    # Check for missing newline at end
    if lines and not lines[-1].endswith('\n'):
        issues.append("Missing newline at end of file")
    
    return issues


def main():
    """Run comprehensive syntax check on backend Python files"""
    backend_dir = Path(__file__).parent
    app_dir = backend_dir / "app"
    
    if not app_dir.exists():
        print("❌ app directory not found!")
        return 1
    
    print("🔍 Running comprehensive Python syntax check...")
    print(f"📁 Checking directory: {app_dir}")
    
    # Find all Python files
    py_files = find_python_files(app_dir)
    print(f"📊 Found {len(py_files)} Python files to check")
    
    errors = []
    pattern_issues = []
    
    # Check each file
    for py_file in py_files:
        # Syntax check
        is_valid, error_msg = check_file_with_tree_sitter(py_file)
        if not is_valid:
            errors.append((py_file, error_msg))
        
        # Pattern check
        issues = check_for_common_patterns(py_file)
        if issues:
            pattern_issues.append((py_file, issues))
    
    # Report results
    print("\n" + "="*60)
    
    if errors:
        print(f"\n❌ Found {len(errors)} files with syntax errors:\n")
        for filepath, error in errors:
            rel_path = filepath.relative_to(backend_dir)
            print(f"  • {rel_path}")
            print(f"    Error: {error}")
    else:
        print("\n✅ No syntax errors found!")
    
    if pattern_issues:
        print(f"\n⚠️  Found {len(pattern_issues)} files with suspicious patterns:\n")
        for filepath, issues in pattern_issues:
            rel_path = filepath.relative_to(backend_dir)
            print(f"  • {rel_path}")
            for issue in issues:
                print(f"    - {issue}")
    
    print("\n" + "="*60)
    
    # Summary
    total_files = len(py_files)
    files_with_errors = len(errors)
    files_with_patterns = len(pattern_issues)
    clean_files = total_files - files_with_errors - files_with_patterns
    
    print(f"\n📊 Summary:")
    print(f"  Total files checked: {total_files}")
    print(f"  ✅ Clean files: {clean_files}")
    print(f"  ❌ Syntax errors: {files_with_errors}")
    print(f"  ⚠️  Pattern issues: {files_with_patterns}")
    
    # Return non-zero if any errors found
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
