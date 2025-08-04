#!/usr/bin/env python3
"""Script to fix docstring formatting issues in Python files."""

import os
import re
from pathlib import Path
from typing import List, Tuple


def fix_single_line_docstrings(content: str) -> str:
    """Fix single-line docstrings to use proper format."""
    # Pattern for single-line docstrings with content
    pattern = r'^(\s*)("""[^"]+""")$'

    lines = content.split("\n")
    fixed_lines = []

    for line in lines:
        match = re.match(pattern, line)
        if match:
            indent = match.group(1)
            docstring_content = match.group(2)
            # Extract the content between quotes
            content_match = re.match(r'"""(.+)"""', docstring_content)
            if content_match:
                doc_text = content_match.group(1).strip()
                # Keep single line format for short docstrings
                fixed_lines.append(f'{indent}"""{doc_text}"""')
            else:
                fixed_lines.append(line)
        else:
            fixed_lines.append(line)

    return "\n".join(fixed_lines)


def fix_empty_docstring_lines(content: str) -> str:
    """Fix empty docstring lines (just triple quotes)."""
    lines = content.split("\n")
    fixed_lines = []

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Check for empty docstring line
        if stripped == '"""':
            indent = len(line) - len(line.lstrip())
            # Look ahead to see if this is opening or closing quotes
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                # If next line is not indented or is another triple quote, this is likely an empty docstring
                if not next_line or next_line == '"""':
                    fixed_lines.append(" " * indent + "")
                    # Skip the closing quotes if they exist
                    if i + 1 < len(lines) and lines[i + 1].strip() == '"""':
                        i += 1
                else:
                    fixed_lines.append(line)
            else:
                # Last line is just triple quotes
                fixed_lines.append(" " * indent + "")
        else:
            fixed_lines.append(line)

        i += 1

    return "\n".join(fixed_lines)


def fix_multiline_docstring_format(content: str) -> str:
    """Fix multi-line docstring formatting issues."""
    lines = content.split("\n")
    fixed_lines = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # Check for docstring start with content on same line (module docstrings)
        if i < 10 and re.match(r'^"""[^"]+$', line):
            # This is a module docstring with content on first line
            match = re.match(r'^(\s*)"""(.+)$', line)
            if match:
                indent = match.group(1)
                content = match.group(2).strip()

                # Add opening quotes
                fixed_lines.append(indent + '"""')
                # Add content
                fixed_lines.append(indent + content)

                # Process remaining lines until closing quotes
                i += 1
                while i < len(lines) and '"""' not in lines[i]:
                    fixed_lines.append(lines[i])
                    i += 1

                # Add closing quotes with proper indentation
                if i < len(lines):
                    fixed_lines.append(indent + '"""')
            else:
                fixed_lines.append(line)
        else:
            fixed_lines.append(line)

        i += 1

    return "\n".join(fixed_lines)


def fix_file(file_path: Path) -> Tuple[bool, str, int]:
    """Fix docstring issues in a single file."""
    try:
        content = file_path.read_text()
        original_content = content

        # Count issues before fixing
        issues = 0
        issues += len(re.findall(r'^(\s*)("""[^"]+""")$', content, re.MULTILINE))
        issues += len(re.findall(r'^\s*"""\s*$', content, re.MULTILINE))
        issues += len(
            re.findall(r'^"""[^"]+$', content[:500], re.MULTILINE)
        )  # Module docstrings

        # Apply fixes
        content = fix_single_line_docstrings(content)
        content = fix_empty_docstring_lines(content)
        content = fix_multiline_docstring_format(content)

        # Only write if changes were made
        if content != original_content:
            file_path.write_text(content)
            return True, f"Fixed: {file_path}", issues
        return False, f"No changes: {file_path}", 0
    except Exception as e:
        return False, f"Error in {file_path}: {str(e)}", 0


def main():
    """Main function to fix docstring issues in application Python files."""
    backend_dir = Path(__file__).parent.parent

    # Define directories to process
    app_dirs = [
        backend_dir / "app",
        backend_dir / "alembic",
        backend_dir / "scripts",
        backend_dir / "tests",
    ]

    # Include Python files in backend root
    python_files = list(backend_dir.glob("*.py"))

    # Add files from app directories
    for app_dir in app_dirs:
        if app_dir.exists():
            python_files.extend(app_dir.rglob("*.py"))

    # Exclude patterns
    excluded_patterns = {
        "__pycache__",
        "venv",
        "env",
        ".env",
        "build",
        "dist",
        "backend/backend",
    }
    python_files = [
        f
        for f in python_files
        if not any(pattern in str(f) for pattern in excluded_patterns)
    ]

    print(f"Scanning {len(python_files)} Python files for docstring issues...")

    fixed_count = 0
    error_count = 0
    total_issues = 0

    for file_path in sorted(python_files):
        success, message, issues = fix_file(file_path)
        if success and message.startswith("Fixed"):
            fixed_count += 1
            total_issues += issues
            print(f"{message} ({issues} issues)")
        elif not success and message.startswith("Error"):
            error_count += 1
            print(message)

    print(f"\nSummary:")
    print(f"- Files fixed: {fixed_count}")
    print(f"- Total issues fixed: {total_issues}")
    print(f"- Errors: {error_count}")
    print(f"- Unchanged: {len(python_files) - fixed_count - error_count}")


if __name__ == "__main__":
    main()
