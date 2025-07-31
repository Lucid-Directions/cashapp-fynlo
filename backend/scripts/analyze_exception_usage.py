#!/usr/bin/env python3
"""
Analyze exception usage to find migration issues
"""

import os
import re
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

def main():
    app_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
    app_dir = os.path.normpath(app_dir)
    
    logger.error("Analyzing exception usage in:", app_dir)
    logger.info("=" * 80)
    
    issues = find_exception_issues(app_dir)
    
    # Count by exception type
    exception_counts = defaultdict(int)
    total_issues = 0
    
    for file, lines in issues.items():
        for line_no, line in lines:
            total_issues += 1
            # Extract exception type
            match = re.search(r'(\w+Exception)\s*\(', line)
            if match:
                exception_counts[match.group(1)] += 1
    
    logger.info(f"\nTotal issues found: {total_issues}")
    logger.info(f"Files affected: {len(issues)}")
    logger.error(f"\nIssues by exception type:")
    for exc_type, count in sorted(exception_counts.items()):
        logger.info(f"  {exc_type}: {count}")
    
    logger.info(f"\n\nFiles with issues:")
    for file in sorted(issues.keys()):
        logger.info(f"\n{file}: {len(issues[file])} issues")
        for line_no, line in issues[file][:3]:  # Show first 3 issues per file
            logger.info(f"  Line {line_no}: {line[:100]}...")
        if len(issues[file]) > 3:
            logger.info(f"  ... and {len(issues[file]) - 3} more")

if __name__ == "__main__":
    main()