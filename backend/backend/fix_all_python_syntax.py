#!/usr/bin/env python3
"""Script to fix ALL Python syntax errors in the backend directory."""

import ast
import os
import re
from pathlib import Path
from typing import Tuple, List


def check_syntax(content: str) -> Tuple[bool, str]:
    """Check if Python code has valid syntax."""
    try:
        ast.parse(content)
        return True, "Valid"
    except SyntaxError as e:
        return False, f"Line {e.lineno}: {e.msg}"
    except Exception as e:
        return False, str(e)


def fix_docstring_errors(content: str) -> str:
    """Fix all docstring-related syntax errors."""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Fix multiple """ at the start of file
        if i < 5 and line.strip() == '"""' and i + 1 < len(lines) and lines[i + 1].strip() == '"""':
            # Skip the extra """
            i += 1
            continue
            
        # Fix standalone """ after function/class definitions
        if i > 0 and re.match(r'^\s*(def|class)\s+', lines[i-1]) and line.strip() == '"""':
            # This is likely a malformed docstring start
            indent = len(line) - len(line.lstrip())
            if i + 1 < len(lines) and not lines[i + 1].strip().startswith('"""'):
                # There's content after, so this is a docstring start
                fixed_lines.append(line)
            else:
                # Skip this line
                i += 1
                continue
        else:
            fixed_lines.append(line)
        
        i += 1
    
    content = '\n'.join(fixed_lines)
    
    # Fix unclosed docstrings by ensuring all """ have matching pairs
    # Count """ occurrences
    quote_positions = []
    for match in re.finditer(r'"""', content):
        quote_positions.append(match.start())
    
    # If odd number of """, add one at the end
    if len(quote_positions) % 2 == 1:
        content += '\n"""\n'
    
    return content


def fix_complex_docstring_patterns(content: str) -> str:
    """Fix more complex docstring patterns."""
    lines = content.split('\n')
    fixed_lines = []
    in_docstring = False
    docstring_start_line = -1
    docstring_indent = 0
    
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Check if we're starting a docstring
        if not in_docstring and '"""' in line:
            # Count quotes to see if it's a complete single-line docstring
            quote_count = line.count('"""')
            if quote_count >= 2:
                # Single line docstring - keep as is
                fixed_lines.append(line)
            else:
                # Multi-line docstring start
                in_docstring = True
                docstring_start_line = i
                docstring_indent = len(line) - len(line.lstrip())
                fixed_lines.append(line)
        elif in_docstring:
            # We're inside a docstring
            if '"""' in line:
                # End of docstring
                in_docstring = False
                # Make sure closing """ is properly indented
                if stripped == '"""':
                    fixed_lines.append(' ' * docstring_indent + '"""')
                else:
                    fixed_lines.append(line)
            else:
                # Content line in docstring
                fixed_lines.append(line)
        else:
            # Regular code line
            fixed_lines.append(line)
        
        i += 1
    
    # If we ended while still in a docstring, close it
    if in_docstring:
        fixed_lines.append(' ' * docstring_indent + '"""')
    
    return '\n'.join(fixed_lines)


def fix_specific_patterns(content: str) -> str:
    """Fix specific corruption patterns found in the codebase."""
    # Fix the pattern where """ appears multiple times at file start
    if content.startswith('"""\n"""\n'):
        content = content.replace('"""\n"""\n', '"""\n', 1)
    
    # Fix empty docstrings that span multiple lines
    content = re.sub(r'(\s*)"""\s*\n\s*"""\s*\n', r'\1"""TODO: Add docstring."""\n', content)
    
    # Fix docstrings that have content after """ on the same line in function definitions
    content = re.sub(r'(\s*def\s+\w+[^:]*:\s*\n\s*)"""([^"\n]+)\n', r'\1"""\n\1\2\n', content)
    
    # Fix unclosed docstrings in specific patterns
    lines = content.split('\n')
    fixed_lines = []
    
    for i, line in enumerate(lines):
        if i > 0 and 'def ' in lines[i-1] and line.strip() == '"""' and i+1 < len(lines):
            # Check if next line is also """
            if lines[i+1].strip() == '"""':
                # Skip this line, it's a duplicate
                continue
        fixed_lines.append(line)
    
    return '\n'.join(fixed_lines)


def aggressive_fix(content: str) -> str:
    """Apply aggressive fixes for severely corrupted files."""
    # Remove completely empty """ """ pairs
    content = re.sub(r'"""\s*"""', '"""TODO: Add docstring."""', content)
    
    # Ensure module docstrings are properly formatted
    lines = content.split('\n')
    if len(lines) > 0 and lines[0] == '"""':
        # Find the closing """
        closing_found = False
        for i in range(1, min(20, len(lines))):
            if '"""' in lines[i]:
                closing_found = True
                break
        if not closing_found:
            # Insert a closing """ after first few lines
            lines.insert(3, '"""')
    
    return '\n'.join(lines)


def fix_file(filepath: Path) -> Tuple[bool, str]:
    """Fix syntax errors in a single Python file."""
    try:
        content = filepath.read_text(encoding='utf-8')
        original_content = content
        
        # Check initial syntax
        valid_before, error_before = check_syntax(content)
        
        if valid_before:
            return False, f"Already valid: {filepath}"
        
        # Apply fixes in order of increasing aggressiveness
        content = fix_docstring_errors(content)
        valid, _ = check_syntax(content)
        
        if not valid:
            content = fix_complex_docstring_patterns(content)
            valid, _ = check_syntax(content)
        
        if not valid:
            content = fix_specific_patterns(content)
            valid, _ = check_syntax(content)
        
        if not valid:
            content = aggressive_fix(content)
            valid, error_after = check_syntax(content)
        
        # Write back if fixed
        if valid and content != original_content:
            filepath.write_text(content, encoding='utf-8')
            return True, f"FIXED: {filepath}"
        elif valid:
            return False, f"No changes needed: {filepath}"
        else:
            return False, f"STILL BROKEN: {filepath} - {error_after}"
            
    except Exception as e:
        return False, f"ERROR reading {filepath}: {str(e)}"


def main():
    """Main function to fix all Python files."""
    backend_dir = Path(__file__).parent
    
    # Find all Python files
    python_files = []
    for pattern in ['*.py', '**/*.py']:
        python_files.extend(backend_dir.glob(pattern))
    
    # Remove duplicates and filter out unwanted directories
    python_files = list(set(python_files))
    python_files = [
        f for f in python_files
        if not any(skip in str(f) for skip in ['__pycache__', 'venv', '.git', 'build', 'dist'])
    ]
    
    print(f"Found {len(python_files)} Python files to check")
    
    # First, identify all files with syntax errors
    broken_files = []
    for filepath in python_files:
        try:
            content = filepath.read_text(encoding='utf-8')
            valid, error = check_syntax(content)
            if not valid:
                broken_files.append((filepath, error))
        except Exception as e:
            broken_files.append((filepath, str(e)))
    
    print(f"\nFound {len(broken_files)} files with syntax errors")
    
    # Fix all broken files
    fixed_count = 0
    still_broken = []
    
    for filepath, original_error in broken_files:
        success, message = fix_file(filepath)
        print(message)
        if success:
            fixed_count += 1
        elif "STILL BROKEN" in message:
            still_broken.append((filepath, message))
    
    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY:")
    print(f"Total Python files: {len(python_files)}")
    print(f"Files with syntax errors: {len(broken_files)}")
    print(f"Files successfully fixed: {fixed_count}")
    print(f"Files still broken: {len(still_broken)}")
    print(f"{'='*60}")
    
    if still_broken:
        print(f"\nFiles that still need manual attention:")
        for filepath, error in still_broken:
            print(f"  - {filepath}")
    
    # Final validation
    print(f"\nRunning final validation...")
    final_broken = 0
    for filepath in python_files:
        try:
            content = filepath.read_text(encoding='utf-8')
            valid, _ = check_syntax(content)
            if not valid:
                final_broken += 1
        except:
            final_broken += 1
    
    print(f"Final count of files with syntax errors: {final_broken}")
    
    return fixed_count, len(still_broken)


if __name__ == "__main__":
    fixed, remaining = main()
    exit(0 if remaining == 0 else 1)
