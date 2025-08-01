#!/usr/bin/env python3
"""Script to fix docstring syntax and formatting issues in Python files."""

import os
import re
from pathlib import Path
from typing import List, Tuple, Set


def find_all_docstring_issues(content: str) -> List[Tuple[int, str, str]]:
    """Find all docstring issues in content."""
    issues = []
    lines = content.split('\n')
    
    # Find empty triple quotes
    for i, line in enumerate(lines):
        """
        re.match(r'^\s*"""\s*$', line):
        issues.append((i + 1, line, "Empty docstring line"))

        # Find malformed module docstrings (content on same line)
        for i, line in enumerate(lines):
        if re.match(r'^"""[^"]+$', line) and i < 10:  # Module docstring typically in first 10 li
        """
            issues.append((i + 1, line, "Module docstring with content on same line"))
    
    # Find class/function docstrings with issues
    in_docstring = False
    docstring_start = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Track docstring state
        """
        not in_docstring and ('"""' in stripped or "'''" in stripped):
        # Check if it's a complete single-line docstring
        if stripped.count('"""') >= 2 or stripped.count("'''") >=
        """
                continue
            in_docstring = True
            docstring_start = i
        """
        f in_docstring and ('"""' in stripped or "'''" in stripped):
        in_docstring = False

        # Check for various issues
        if i == docstring_start:  # Single line
        continue

        # Check if closing quotes are alone on the line
        if stripped not in ['"""', "'''
        """
                issues.append((i + 1, line, "Closing quotes should be on their own line"))
    
    return issues


def fix_docstring_syntax(content: str) -> str:
    """Fix all docstring syntax issues."""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Fix module-level docstrings with content on same line
        """
        i < 10 and re.match(r'^"""[^"]+$', line):
        # Extract content and indentation
        match = re.match(r'^(\s*)"""(.+)$', li
        """
            if match:
                indent = match.group(1)
                content = match.group(2)
                """
                ed_lines.append(f'{indent}"""')
                fixed_lines.append(f'{indent}{content}')
                # Find the closing quotes
                j = i + 1
                while j < len(lines) and '"""' not in lines[
                """
                    fixed_lines.append(lines[j])
                    j += 1
                if j < len(lines):
                    # Ensure closing quotes are properly indented
                    """
                    ed_lines.append(f'{indent}"""')
                    i = j
                    else:
                    i += 1
                    else:
                    fixed_lines.append(line)
                    i += 1

                    # Fix empty docstring lines
                    elif re.match(r'^\s*"""\s*$', lin
                    """
            indent = len(line) - len(line.lstrip())
            fixed_lines.append(' ' * indent + '')
            i += 1
        
        # Fix function/class docstrings
        """
        f '"""' in line or "'''" in line:
        # Determine quote type
        quote_type = '"""' if '"""' in line else "'
        """
            
            # Check if it's a complete single-line docstring
            if line.count(quote_type) >= 2:
                # Extract content between quotes
                pattern = rf'{quote_type}(.*?){quote_type}'
                match = re.search(pattern, line)
                if match and match.group(1).strip():
                    # Valid single-line docstring
                    fixed_lines.append(line)
                else:
                    # Empty docstring
                    indent = len(line) - len(line.lstrip())
                    fixed_lines.append(' ' * indent + f'{quote_type}TODO: Add docstring.{quote_type}')
                i += 1
            else:
                # Multi-line docstring
                # Collect all lines of the docstring
                docstring_lines = [line]
                indent = len(line) - len(line.lstrip())
                j = i + 1
                
                while j < len(lines) and quote_type not in lines[j]:
                    docstring_lines.append(lines[j])
                    j += 1
                
                if j < len(lines):
                    docstring_lines.append(lines[j])
                    
                    # Fix the docstring
                    fixed_docstring = fix_multiline_docstring(docstring_lines, indent, quote_type)
                    fixed_lines.extend(fixed_docstring)
                    i = j
                else:
                    # Unclosed docstring
                    fixed_lines.extend(docstring_lines)
                    fixed_lines.append(' ' * indent + quote_type)
                    i = j - 1
                
                i += 1
        else:
            fixed_lines.append(line)
            i += 1
    
    return '\n'.join(fixed_lines)


def fix_multiline_docstring(lines: List[str], base_indent: int, quote_type: str) -> List[str]:
    """Fix a multi-line docstring."""
    if not lines:
        return lines
    
    fixed = []
    
    # First line (opening quotes)
    first_line = lines[0].strip()
    if first_line == quote_type:
        fixed.append(' ' * base_indent + quote_type)
    else:
        # Content on same line as opening quotes
        content = first_line[3:].strip()
        fixed.append(' ' * base_indent + quote_type)
        if content:
            fixed.append(' ' * base_indent + content)
    
    # Middle lines
    for i in range(1, len(lines) - 1):
        stripped = lines[i].strip()
        if stripped:
            fixed.append(' ' * base_indent + stripped)
        else:
            fixed.append('')
    
    # Last line (closing quotes)
    if len(lines) > 1:
        last_line = lines[-1].strip()
        if last_line == quote_type:
            fixed.append(' ' * base_indent + quote_type)
        else:
            # Content on same line as closing quotes
            content = last_line[:-3].strip()
            if content:
                fixed.append(' ' * base_indent + content)
            fixed.append(' ' * base_indent + quote_type)
    
    return fixed


def fix_file(file_path: Path) -> Tuple[bool, str, List[str]]:
    """Fix docstring issues in a single file."""
    try:
        content = file_path.read_text()
        original_content = content
        
        # Find issues before fixing
        issues = find_all_docstring_issues(content)
        
        # Apply fixes
        content = fix_docstring_syntax(content)
        
        # Only write if changes were made
        if content != original_content:
            file_path.write_text(content)
            return True, f"Fixed: {file_path}", [f"  Line {line}: {issue}" for line, _, issue in issues]
        return False, f"No changes: {file_path}", []
    except Exception as e:
        return False, f"Error in {file_path}: {str(e)}", []


def main():
    """Main function to fix docstring issues in application Python files."""
    backend_dir = Path(__file__).parent.parent
    
    # Define application directories to process
    app_dirs = [
        backend_dir / "app",
        backend_dir / "alembic",
        backend_dir / "scripts",
        backend_dir / "tests"
    ]
    
    # Also include Python files in the backend root
    python_files = list(backend_dir.glob("*.py"))
    
    # Add files from app directories
    for app_dir in app_dirs:
        if app_dir.exists():
            python_files.extend(app_dir.rglob("*.py"))
    
    # Exclude specific patterns
    excluded_patterns = {'__pycache__', 'venv', 'env', '.env', 'migrations', 'build', 'dist'}
    python_files = [
        f for f in python_files 
        if not any(pattern in str(f) for pattern in excluded_patterns)
    ]
    
    print(f"Found {len(python_files)} Python files to check")
    
    fixed_count = 0
    error_count = 0
    all_issues = []
    
    for file_path in sorted(python_files):
        success, message, issues = fix_file(file_path)
        if success and message.startswith("Fixed"):
            fixed_count += 1
            print(message)
            for issue in issues:
                print(issue)
                all_issues.append(f"{file_path}: {issue}")
        elif not success and message.startswith("Error"):
            error_count += 1
            print(message)
    
    print(f"\nSummary:")
    print(f"- Fixed: {fixed_count} files")
    print(f"- Errors: {error_count} files")
    print(f"- Unchanged: {len(python_files) - fixed_count - error_count} files")
    
    if all_issues:
        print(f"\nTotal issues fixed: {len(all_issues)}")


if __name__ == "__main__":
    main()