#!/usr/bin/env python3
"""
Fix all remaining HTTPExceptions in core modules
"""

import os
import re
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)


def get_exception_mappings() -> Dict[str, Tuple[str, str]]:
    """Map error messages to appropriate FynloException types and error codes"""
    return {
        # Authentication/Authorization
        "tenant_mismatch": ("AuthenticationException", "TENANT_MISMATCH"),
        "access_denied": ("AuthenticationException", "ACCESS_DENIED"),
        "forbidden": ("AuthenticationException", "FORBIDDEN"),
        "unauthorized": ("AuthenticationException", "UNAUTHORIZED"),
        "not_authenticated": ("AuthenticationException", "NOT_AUTHENTICATED"),
        "invalid_token": ("AuthenticationException", "INVALID_TOKEN"),
        "invalid_credentials": ("AuthenticationException", "INVALID_CREDENTIALS"),
        
        # Not Found
        "not_found": ("ResourceNotFoundException", "NOT_FOUND"),
        "restaurant_not_found": ("ResourceNotFoundException", "NOT_FOUND"),
        "user_not_found": ("ResourceNotFoundException", "NOT_FOUND"),
        
        # Validation
        "validation_error": ("ValidationException", "VALIDATION_ERROR"),
        "invalid_data": ("ValidationException", "INVALID_DATA"),
        "missing_field": ("ValidationException", "MISSING_FIELD"),
        
        # Generic
        "server_error": ("FynloException", "INTERNAL_ERROR"),
        "bad_request": ("FynloException", "BAD_REQUEST"),
    }

def fix_file_httpexceptions(file_path: str) -> int:
    """Fix HTTPExceptions in a single file"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    original_content = content
    fixes_made = 0
    
    # Track needed imports
    needed_exceptions = set()
    
    # Pattern 1: HTTPException with status_code and detail
    pattern1 = r'raise\s+HTTPException\s*\(\s*status_code\s*=\s*(\d+)\s*,\s*detail\s*=\s*["\']([^"\']+)["\']\s*\)'
    
    def replace_httpexception(match):
        nonlocal fixes_made, needed_exceptions
        status_code = int(match.group(1))
        detail = match.group(2)
        
        # Determine exception type based on status code and message
        if status_code == 401:
            exc_type = "AuthenticationException"
            error_code = "AUTHENTICATION_FAILED"
        elif status_code == 403:
            exc_type = "AuthenticationException"
            error_code = "ACCESS_DENIED"
        elif status_code == 404:
            exc_type = "ResourceNotFoundException"
            error_code = "NOT_FOUND"
        elif status_code == 400:
            exc_type = "ValidationException"
            error_code = "VALIDATION_ERROR"
        elif status_code == 409:
            exc_type = "ConflictException"
            error_code = "CONFLICT"
        else:
            exc_type = "FynloException"
            error_code = "APPLICATION_ERROR"
        
        # Check message for more specific error codes
        detail_lower = detail.lower()
        for key, (exc, code) in get_exception_mappings().items():
            if key in detail_lower:
                exc_type = exc
                error_code = code
                break
        
        needed_exceptions.add(exc_type)
        fixes_made += 1
        
        # Use generic message to prevent information disclosure
        if exc_type == "AuthenticationException":
            message = "Authentication failed"
        elif exc_type == "ResourceNotFoundException":
            message = "Resource not found"
        elif exc_type == "ValidationException":
            message = "Validation failed"
        else:
            message = "Operation failed"
        
        return f'raise {exc_type}(message="{message}", code="{error_code}")'
    
    content = re.sub(pattern1, replace_httpexception, content)
    
    # Pattern 2: HTTPException with positional arguments
    pattern2 = r'raise\s+HTTPException\s*\(\s*(\d+)\s*,\s*["\']([^"\']+)["\']\s*\)'
    content = re.sub(pattern2, replace_httpexception, content)
    
    # Fix imports if changes were made
    if fixes_made > 0:
        # Remove HTTPException import if present
        content = re.sub(r'from\s+fastapi\s+import\s+.*?HTTPException.*?\n', '', content)
        
        # Add FynloException imports
        if 'from app.core.exceptions import' in content:
            # Update existing import
            existing_imports = re.search(r'from app\.core\.exceptions import ([^\n]+)', content)
            if existing_imports:
                current_imports = existing_imports.group(1).split(',')
                current_imports = [imp.strip() for imp in current_imports]
                
                # Add needed exceptions
                for exc in needed_exceptions:
                    if exc not in current_imports:
                        current_imports.append(exc)
                
                # Rebuild import statement
                new_import = f"from app.core.exceptions import {', '.join(sorted(current_imports))}"
                content = re.sub(r'from app\.core\.exceptions import [^\n]+', new_import, content)
        else:
            # Add new import after other imports
            import_line = f"from app.core.exceptions import {', '.join(sorted(needed_exceptions))}\n"
            
            # Find a good place to insert
            import_match = re.search(r'(from .+ import .+\n)+', content)
            if import_match:
                insert_pos = import_match.end()
                content = content[:insert_pos] + import_line + content[insert_pos:]
            else:
                # Just add at the top after docstring
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if line.strip() and not line.startswith('"""') and not line.startswith('#'):
                        lines.insert(i, import_line)
                        break
                content = '\n'.join(lines)
    
    # Write back if changes were made
    if content != original_content:
        with open(file_path, 'w') as f:
            f.write(content)
        logger.error(f"✅ Fixed {fixes_made} HTTPExceptions in {file_path}")
        return fixes_made
    
    return 0

def main():
    """Fix all remaining HTTPExceptions in core modules"""
    # Core modules that need fixing
    core_modules = [
        'app/core/tenant_security.py',
        'app/core/feature_gate.py',
        'app/core/two_factor_auth.py',
        'app/core/production_guard.py',
        'app/core/dependencies.py',
    ]
    
    total_fixed = 0
    
    logger.error("🔧 Fixing remaining HTTPExceptions in core modules...")
    logger.info("=" * 60)
    
    for module in core_modules:
        if os.path.exists(module):
            fixed = fix_file_httpexceptions(module)
            total_fixed += fixed
        else:
            logger.info(f"⚠️  File not found: {module}")
    
    logger.info("=" * 60)
    logger.error(f"✅ Total HTTPExceptions fixed: {total_fixed}")
    
    # Also check for any other files with HTTPException
    logger.error("\n🔍 Checking for other files with HTTPException...")
    
    for root, dirs, files in os.walk('app'):
        # Skip test directories
        if 'test' in root:
            continue
            
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                
                # Skip already processed files
                if file_path in core_modules:
                    continue
                
                # Check if file has HTTPException
                try:
                    with open(file_path, 'r') as f:
                        content = f.read()
                    
                    if 'HTTPException' in content and 'raise HTTPException' in content:
                        logger.error(f"\n📍 Found HTTPException in: {file_path}")
                        fixed = fix_file_httpexceptions(file_path)
                        total_fixed += fixed
                except:
                    pass
    
    logger.error(f"\n🎉 Grand total HTTPExceptions fixed: {total_fixed}")

if __name__ == "__main__":
    main()
