#!/usr/bin/env python3
"""
Convert logger.info() statements to logger calls in Python files.
"""

import os
import re
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def has_logger_import(content):
    """Check if file already imports logging."""
    return bool(re.search(r'import\s+logging|from\s+logging\s+import', content))

def has_logger_setup(content):
    """Check if file already sets up logger."""
    return bool(re.search(r'logger\s*=\s*logging\.getLogger', content))

def add_logger_setup(content):
    """Add logging import and logger setup after imports."""
    lines = content.split('\n')
    
    # Find the last import line
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith(('import ', 'from ')) and not line.strip().startswith('from .'):
            last_import_idx = i
    
    # If no imports found, add at the beginning after docstring
    if last_import_idx == -1:
        # Skip docstring if present
        insert_idx = 0
        if lines[0].strip().startswith('"""'):
            for i, line in enumerate(lines[1:], 1):
                if line.strip().endswith('"""'):
                    insert_idx = i + 1
                    break
    else:
        insert_idx = last_import_idx + 1
    
    # Add logging import if not present
    if not has_logger_import(content):
        lines.insert(insert_idx, 'import logging')
        insert_idx += 1
    
    # Add blank line and logger setup if not present
    if not has_logger_setup(content):
        lines.insert(insert_idx, '')
        lines.insert(insert_idx + 1, 'logger = logging.getLogger(__name__)')
        lines.insert(insert_idx + 2, '')
    
    return '\n'.join(lines)

def convert_print_to_logger(content):
    """Convert print statements to logger calls."""
    # First ensure logging is set up
    if 'logger.info(' in content:
        content = add_logger_setup(content)
    
    # Pattern to match print statements (handles multi-line prints)
    print_pattern = re.compile(
        r'(\s*)print\s*\((.*?)\)(?=\s*(?:#|$|\n))',
        re.DOTALL | re.MULTILINE
    )
    
    def replace_logger.info(match):
        indent = match.group(1)
        args = match.group(2).strip()
        
        # Determine log level based on content
        if re.search(r'error|exception|fail|critical', args, re.IGNORECASE):
            level = 'error'
        elif re.search(r'warn|warning|caution', args, re.IGNORECASE):
            level = 'warning'
        elif re.search(r'debug|trace', args, re.IGNORECASE):
            level = 'debug'
        else:
            level = 'info'
        
        # Handle f-strings and format strings
        if args.startswith('f"') or args.startswith("f'"):
            return f'{indent}logger.{level}({args})'
        else:
            return f'{indent}logger.{level}({args})'
    
    # Replace all print statements
    content = print_pattern.sub(replace_print, content)
    
    return content

def process_file(filepath):
    """Process a single Python file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        # Skip if no print statements
        if 'logger.info(' not in original_content:
            return False
        
        # Convert prints to logger
        new_content = convert_print_to_logger(original_content)
        
        # Write back if changed
        if new_content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            logger.info(f"✓ Converted prints in: {filepath}")
            return True
        
        return False
    except Exception as e:
        logger.error(f"✗ Error processing {filepath}: {e}")
        return False

def main():
    """Main function to process all Python files."""
    converted_count = 0
    
    # Process all Python files in backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__)).replace('/scripts', '')
    
    for root, dirs, files in os.walk(backend_dir):
        # Skip virtual environments and cache directories
        dirs[:] = [d for d in dirs if d not in ['venv', '__pycache__', '.pytest_cache', 'htmlcov']]
        
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                if process_file(filepath):
                    converted_count += 1
    
    logger.info(f"\n✓ Converted print statements in {converted_count} files")

if __name__ == "__main__":
    main()
