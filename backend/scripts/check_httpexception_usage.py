#!/usr/bin/env python3
"""
Script to check HTTPException usage and suggest FynloException replacements
"""

import os
import re
from pathlib import Path
from typing import List, Tuple
import logging

logger = logging.getLogger(__name__)


def find_httpexception_usage(file_path: Path) -> List[Tuple[int, str, int]]:
    """Find all HTTPException usages in a file"""
    findings = []
    
    with open(file_path, 'r') as f:
        lines = f.readlines()
        
    for i, line in enumerate(lines):
        if 'raise HTTPException' in line:
            # Extract status code if possible
            status_match = re.search(r'status_code\s*=\s*(\d+)', line)
            status_code = int(status_match.group(1)) if status_match else None
            findings.append((i + 1, line.strip(), status_code))
            
    return findings

def suggest_replacement(status_code: int, line: str) -> str:
    """Suggest FynloException replacement based on status code"""
    
    # Extract detail message if possible
    detail_match = re.search(r'detail\s*=\s*["\']([^"\']*)["\']', line)
    detail = detail_match.group(1) if detail_match else "Error message"
    
    replacements = {
        400: f'raise ValidationException("{detail}")',
        401: f'raise AuthenticationException("{detail}")',
        403: f'raise AuthorizationException("{detail}")',
        404: f'raise ResourceNotFoundException(resource="Resource", details={{}})',
        409: f'raise ConflictException("{detail}")',
        422: f'raise ValidationException("{detail}")',
        500: f'raise FynloException("{detail}", error_code=ErrorCodes.INTERNAL_ERROR)',
    }
    
    return replacements.get(status_code, f'raise FynloException("{detail}", status_code={status_code})')

def main():
    """Main function"""
    api_dir = Path(__file__).parent.parent / 'app' / 'api'
    
    logger.error("Checking HTTPException usage in API endpoints...\n")
    
    total_findings = 0
    files_with_issues = []
    
    for file_path in api_dir.rglob('*.py'):
        if '__pycache__' in str(file_path):
            continue
            
        findings = find_httpexception_usage(file_path)
        if findings:
            total_findings += len(findings)
            files_with_issues.append((file_path, findings))
    
    # Report findings
    logger.error(f"Found {total_findings} HTTPException usages in {len(files_with_issues)} files\n")
    
    # Show detailed findings for a few files
    for file_path, findings in files_with_issues[:5]:  # Show first 5 files
        logger.info(f"\n{file_path.relative_to(api_dir.parent.parent)}:")
        for line_no, line, status_code in findings[:3]:  # Show first 3 issues per file
            logger.info(f"  Line {line_no}: {line}")
            if status_code:
                logger.info(f"    Suggested: {suggest_replacement(status_code, line)}")
            logger.info()
    
    if len(files_with_issues) > 5:
        logger.info(f"\n... and {len(files_with_issues) - 5} more files")
    
    # Generate import suggestions
    logger.error("\n\nRequired imports for FynloException usage:")
    logger.error("from app.core.exceptions import (")
    logger.error("    FynloException, AuthenticationException, AuthorizationException,")
    logger.error("    ValidationException, ResourceNotFoundException, ConflictException,")
    logger.error("    BusinessLogicException, PaymentException, InventoryException")
    logger.info(")")
    logger.error("from app.core.responses import ErrorCodes")
    
    # List all files that need updating
    logger.info(f"\n\nFiles that need updating ({len(files_with_issues)} total):")
    for file_path, findings in files_with_issues:
        logger.info(f"  - {file_path.relative_to(api_dir.parent.parent)} ({len(findings)} occurrences)")

if __name__ == "__main__":
    main()