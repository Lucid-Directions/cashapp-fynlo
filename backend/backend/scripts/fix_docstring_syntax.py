#!/usr/bin/env python3
"""Script to fix docstring syntax and formatting issues in Python files."""

import os
import re
from pathlib import Path
from typing import List, Tuple


def fix_docstring_indentation(content: str) -> str:
    

   """Fix docstring indentation issues."""
    lines = content.split('\n')
    fixed_lines = []
    in_docstring = False
    docstring_indent = 0
    docstring_type = None  # track if it's 

    """
    or '''

    i = 0
    while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # Check for docstring start
    if not in_docstring:
    # Check for triple quotes
    if '

    """
    quote_type = '

    """' if '"""' in line else "'''"
    # Check if it's a single-line docstring
    if line.count(quote_type) >= 2:
    # Single line docstring - ensure it's properly formatted
    fixed_lines.append(line)
    else:
    # Multi-line docstring start
    in_docstring = True
    docstring_type = quote_type
    # Calculate the base indentation
    docstring_indent = len(line) - len(line.lstrip())
    fixed_lines.append(line)
    else:
    fixed_lines.append(line)
    else:
    # Inside a docstring
    if docstring_type in line:
    # End of docstring
    in_docstring = False
    # Ensure the closing quotes have the same indentation as opening
    fixed_line = ' ' * docstring_indent + docstring_type
    fixed_lines.append(fixed_line)
    docstring_type = None
    else:
    # Content line inside docstring
    # Remove any existing indentation and add correct indentation
    content_stripped = line.strip()
    if content_stripped:
    fixed_lines.append(' ' * docstring_indent + content_stripped)
    else:
    # Empty line in docstring
    fixed_lines.append('')

    i += 1

    return '\n'.join(fixed_lines)


    def fix_malformed_docstrings(content: str) -> str:


    """
    # Fix docstrings that have content on the same line as opening quotes
    content = re.sub(
        r'([ \t]*)

        """([^"\n]+)(\n|$)',
        r'\1

        """
\n\1\2\3',
        content
    )
    
    # Fix docstrings that have closing quotes on the same line as content
    content = re.sub(
        r'(\n[ \t]*)([^"\n]+)"""
        ',
        r'\1\2\n\1

        """
        ',
        content
        )

        # Fix empty docstrings to have proper format
        content = re.sub(
        r'([ \t]*)

        """
',
        r'\1

        
',
        content
    )
    
    return content


def fix_docstring_content(content: str) -> str:
    

   """Fix common docstring content issues."""
    lines = content.split('\n')
    fixed_lines = []
    in_docstring = False
    docstring_lines = []
    docstring_indent = 0
    
    for line in lines:
        stripped = line.strip()
        
        if not in_docstring and (stripped.startswith('

        """') or stripped.startswith("'''")):
        in_docstring = True
        docstring_indent = len(line) - len(line.lstrip())
        docstring_lines = [line]

        # Check if it's a single-line docstring
        if (stripped.endswith('

        """
                in_docstring = False
                fixed_lines.append(line)
                docstring_lines = []
        elif in_docstring:
            docstring_lines.append(line)
            if stripped.endswith('

            """') or stripped.endswith("'''"):
            in_docstring = False
            # Process the complete docstring
            fixed_docstring = process_docstring(docstring_lines, docstring_indent)
            fixed_lines.extend(fixed_docstring)
            docstring_lines = []
            else:
            fixed_lines.append(line)

            return '\n'.join(fixed_lines)


            def process_docstring(lines: List[str], base_indent: int) -> List[str]:


            """
    if len(lines) <= 2:
        return lines
    
    # Extract content lines (excluding opening and closing quotes)
    content_lines = []
    for i, line in enumerate(lines):
        if i == 0:  # Opening line
            content_lines.append(line)
        elif i == len(lines) - 1:  # Closing line
            # Ensure proper indentation for closing quotes
            content_lines.append(' ' * base_indent + '

            """
            ')
            else:
            # Content line
            stripped = line.strip()
            if stripped:
            # Add proper indentation
            content_lines.append(' ' * base_indent + stripped)
            else:
            content_lines.append('')

            return content_lines


            def fix_file(file_path: Path) -> Tuple[bool, str]:


            """
    try:
        content = file_path.read_text()
        original_content = content
        
        # Apply fixes
        content = fix_malformed_docstrings(content)
        content = fix_docstring_indentation(content)
        content = fix_docstring_content(content)
        
        # Only write if changes were made
        if content != original_content:
            file_path.write_text(content)
            return True, f"Fixed: {file_path}"
        return False, f"No changes: {file_path}"
    except Exception as e:
        return False, f"Error in {file_path}: {str(e)}"


def main():
    

   """Main function to fix docstring issues in all Python files."""
    backend_dir = Path(__file__).parent.parent
    python_files = list(backend_dir.rglob("*.py"))
    
    # Exclude migration files and __pycache__
    python_files = [
        f for f in python_files 
        if '__pycache__' not in str(f) and 'alembic/versions' not in str(f)
    ]
    
    print(f"Found {len(python_files)} Python files to check")
    
    fixed_count = 0
    error_count = 0
    
    for file_path in python_files:
        success, message = fix_file(file_path)
        if success and message.startswith("Fixed"):
            fixed_count += 1
            print(message)
        elif not success and message.startswith("Error"):
            error_count += 1
            print(message)
    
    print(f"\nSummary:")
    print(f"- Fixed: {fixed_count} files")
    print(f"- Errors: {error_count} files")
    print(f"- Unchanged: {len(python_files) - fixed_count - error_count} files")


if __name__ == "__main__":
    main()