#!/usr/bin/env python3
"""Resolve remaining merge conflicts from PR #459"""

import re
import os
from pathlib import Path

def resolve_conflicts(file_path):
    """Resolve merge conflicts by choosing the HEAD version (our changes)"""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        if '<<<<<<< HEAD' not in content:
            return False, "No conflicts found"
        
        original_content = content
        
        # Pattern to match merge conflicts
        # This captures everything from <<<<<<< HEAD to >>>>>>> origin/main
        conflict_pattern = r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> origin/main'
        
        # Function to choose the HEAD version (our changes)
        def choose_head(match):
            return match.group(1)  # Return the HEAD version
        
        # Replace all conflicts with HEAD version
        resolved_content = re.sub(conflict_pattern, choose_head, content, flags=re.DOTALL)
        
        # Also handle empty conflicts (where there's nothing between markers)
        empty_conflict_pattern = r'<<<<<<< HEAD\n=======\n>>>>>>> origin/main\n'
        resolved_content = re.sub(empty_conflict_pattern, '', resolved_content)
        
        # Handle conflicts with just newlines
        newline_conflict_pattern = r'<<<<<<< HEAD\n\n=======\n>>>>>>> origin/main'
        resolved_content = re.sub(newline_conflict_pattern, '\n', resolved_content)
        
        # Clean up any double blank lines
        resolved_content = re.sub(r'\n\n\n+', '\n\n', resolved_content)
        
        if resolved_content != original_content:
            with open(file_path, 'w') as f:
                f.write(resolved_content)
            return True, "Conflicts resolved"
        
        return False, "No changes made"
        
    except Exception as e:
        return False, f"Error: {str(e)}"

def find_conflicted_files(directory):
    """Find all Python files with merge conflicts"""
    conflicted_files = []
    
    for root, dirs, files in os.walk(directory):
        # Skip venv directory
        if 'venv' in root:
            continue
            
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r') as f:
                        content = f.read()
                        if '<<<<<<< HEAD' in content:
                            conflicted_files.append(file_path)
                except:
                    pass
    
    return conflicted_files

def main():
    """Main function to resolve remaining conflicts"""
    backend_path = "/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/backend"
    
    print("🔍 Finding files with merge conflicts...")
    conflicted_files = find_conflicted_files(backend_path)
    
    print(f"Found {len(conflicted_files)} files with conflicts")
    print("=" * 50)
    
    resolved_count = 0
    failed_count = 0
    
    for file_path in conflicted_files:
        relative_path = os.path.relpath(file_path, backend_path)
        success, message = resolve_conflicts(file_path)
        
        if success:
            print(f"✅ Resolved: {relative_path}")
            resolved_count += 1
        else:
            print(f"❌ Failed: {relative_path} - {message}")
            failed_count += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Summary:")
    print(f"   Resolved: {resolved_count}")
    print(f"   Failed: {failed_count}")
    print(f"   Success rate: {resolved_count / len(conflicted_files) * 100:.1f}%")
    
    # Check syntax of resolved files
    print("\n🔍 Checking syntax of resolved files...")
    syntax_errors = 0
    
    for file_path in conflicted_files:
        try:
            compile(open(file_path).read(), file_path, 'exec')
        except SyntaxError as e:
            print(f"❌ Syntax error in {os.path.relpath(file_path, backend_path)}: {e}")
            syntax_errors += 1
    
    if syntax_errors == 0:
        print("✅ All resolved files have valid syntax!")
    else:
        print(f"⚠️  {syntax_errors} files still have syntax errors")

if __name__ == "__main__":
    main()