#!/usr/bin/env python3
"""
Generate detailed exception usage analysis with file and line information
"""

import os
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


def find_exception_issues(directory):
    """Find all exception calls with 'code=' parameter"""
    issues = defaultdict(list)
    
    for root, dirs, files in os.walk(directory):
        # Skip __pycache__
        dirs[:] = [d for d in dirs if d != '__pycache__']
        
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        for i, line in enumerate(f, 1):
                            # Look for any Exception with code= parameter
                            if 'Exception(' in line and 'code=' in line:
                                # Skip if it's error_code=
                                if 'error_code=' not in line:
                                    relative_path = filepath.replace(directory + '/', '')
                                    issues[relative_path].append((i, line.strip()))
                except Exception as e:
                    logger.error(f"Error reading {filepath}: {e}")
    
    return issues

def categorize_issues(issues):
    """Categorize issues by exception type and fix needed"""
    categorized = {
        'FynloException_code_to_error_code': [],
        'AuthenticationException_remove_code': [],
        'ValidationException_remove_code': [],
        'ResourceNotFoundException_remove_code': [],
        'BusinessLogicException_remove_code': [],
        'Other_exceptions': []
    }
    
    for file, lines in issues.items():
        for line_no, line in lines:
            if 'FynloException(' in line:
                categorized['FynloException_code_to_error_code'].append((file, line_no, line))
            elif 'AuthenticationException(' in line:
                categorized['AuthenticationException_remove_code'].append((file, line_no, line))
            elif 'ValidationException(' in line:
                categorized['ValidationException_remove_code'].append((file, line_no, line))
            elif 'ResourceNotFoundException(' in line:
                categorized['ResourceNotFoundException_remove_code'].append((file, line_no, line))
            elif 'BusinessLogicException(' in line:
                categorized['BusinessLogicException_remove_code'].append((file, line_no, line))
            else:
                categorized['Other_exceptions'].append((file, line_no, line))
    
    return categorized

def main():
    app_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
    app_dir = os.path.normpath(app_dir)
    
    logger.error("Detailed Exception Usage Analysis")
    logger.info("=" * 80)
    
    issues = find_exception_issues(app_dir)
    categorized = categorize_issues(issues)
    
    # Print summary
    total_issues = sum(len(lines) for lines in issues.values())
    logger.info(f"\nTotal issues found: {total_issues}")
    logger.info(f"Files affected: {len(issues)}\n")
    
    # Print by category
    for category, items in categorized.items():
        if items:
            logger.info(f"\n## {category.replace('_', ' ')} ({len(items)} issues)")
            logger.info("-" * 80)
            
            # Group by file
            by_file = defaultdict(list)
            for file, line_no, line in items:
                by_file[file].append((line_no, line))
            
            for file in sorted(by_file.keys()):
                logger.info(f"\n### {file}")
                for line_no, line in sorted(by_file[file]):
                    logger.info(f"  Line {line_no}: {line[:100]}...")
    
    # Generate fix commands
    logger.info("\n\n## Automated Fix Commands")
    logger.info("-" * 80)
    logger.error("\n1. Fix FynloException (change 'code=' to 'error_code='):")
    logger.error("   find app -name '*.py' -exec sed -i '' 's/FynloException(\\(.*\\)code=/FynloException(\\1error_code=/g' {} +")
    
    logger.error("\n2. Fix AuthenticationException (remove 'code' parameter):")
    logger.info("   Manual review recommended - patterns vary")
    
    logger.error("\n3. Fix ValidationException (remove 'code' parameter):")
    logger.info("   Manual review recommended - patterns vary")
    
    logger.info("\n\n## Files to Review (sorted by issue count):")
    file_issue_counts = [(file, len(lines)) for file, lines in issues.items()]
    for file, count in sorted(file_issue_counts, key=lambda x: x[1], reverse=True):
        logger.info(f"  {count:3d} issues: {file}")

if __name__ == "__main__":
    main()
