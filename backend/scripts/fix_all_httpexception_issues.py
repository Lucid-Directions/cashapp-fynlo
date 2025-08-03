#!/usr/bin/env python3
"""
Complete HTTPException to FynloException migration script.
This script will fix ALL remaining issues found by PR Guardian.
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Tuple, Set
from collections import defaultdict

# Base directory for the backend code
BASE_DIR = Path(__file__).parent.parent

# Files to exclude from processing
EXCLUDE_FILES = {
    "alembic/env.py",
    "alembic/versions",
    "tests",
    "__pycache__",
    ".pytest_cache",
    "venv",
    ".env",
    "scripts",
    "seeds",
    "app/core/exceptions.py",  # This file defines the exceptions
}

# Mapping of HTTPException status codes to appropriate FynloException subclasses
STATUS_CODE_TO_EXCEPTION = {
    400: "ValidationException",
    401: "AuthenticationException", 
    403: "AuthorizationException",
    404: "NotFoundException",
    409: "ConflictException",
    422: "ValidationException",
    429: "RateLimitException",
    500: "FynloException",
    501: "FynloException",
    502: "FynloException",
    503: "ServiceUnavailableError",
}

# Context-aware error messages for empty message="" cases
CONTEXT_ERROR_MESSAGES = {
    # admin.py
    ("admin.py", "187"): "Failed to generate 2FA backup codes",
    ("admin.py", "432"): "Error processing admin request",
    
    # config.py
    ("config.py", "66"): "Failed to retrieve restaurant configuration",
    ("config.py", "95"): "Error loading restaurant settings",
    ("config.py", "130"): "Configuration retrieval failed",
    ("config.py", "177"): "Error updating restaurant configuration",
    ("config.py", "202"): "Failed to save configuration changes",
    ("config.py", "246"): "Error processing configuration update",
    ("config.py", "273"): "Failed to update specific configuration item",
    ("config.py", "296"): "Configuration item update failed",
    ("config.py", "321"): "Error updating configuration field",
    ("config.py", "366"): "Failed to process bulk configuration update",
    ("config.py", "384"): "Bulk configuration update error",
    ("config.py", "408"): "Error applying configuration changes",
    ("config.py", "427"): "Failed to validate configuration",
    ("config.py", "459"): "Configuration validation error",
    ("config.py", "482"): "Error processing configuration request",
    
    # fees.py
    ("fees.py", "135"): "Failed to update fee configuration",
    ("fees.py", "154"): "Invalid fee configuration provided",
    ("fees.py", "157"): "Error processing fee update",
    ("fees.py", "211"): "Invalid fee settings",
    ("fees.py", "214"): "Failed to apply fee changes",
    
    # inventory.py
    ("inventory.py", "297"): "Invalid inventory update request",
    ("inventory.py", "361"): "Invalid stock adjustment data",
    
    # orders.py
    ("orders.py", "758"): "Failed to process order update",
    
    # payment_configurations.py
    ("payment_configurations.py", "92"): "Invalid payment configuration data",
    ("payment_configurations.py", "94"): "Payment configuration already exists",
    ("payment_configurations.py", "183"): "Invalid payment provider settings",
    ("payment_configurations.py", "185"): "Payment provider already configured",
    
    # payments.py
    ("payments.py", "570"): "Invalid payment request data",
    ("payments.py", "929"): "Payment processing failed",
    ("payments.py", "1012"): "Error retrieving payment status",
    
    # platform_settings.py
    ("platform_settings.py", "84"): "Failed to retrieve platform settings",
    ("platform_settings.py", "135"): "Invalid platform configuration",
    ("platform_settings.py", "162"): "Error loading platform configuration",
    ("platform_settings.py", "198"): "Invalid settings update request",
    ("platform_settings.py", "202"): "Failed to update platform settings",
    ("platform_settings.py", "249"): "Platform settings update error",
    ("platform_settings.py", "267"): "Error processing settings change",
    ("platform_settings.py", "297"): "Invalid configuration parameters",
    ("platform_settings.py", "299"): "Failed to apply configuration",
    ("platform_settings.py", "318"): "Configuration application error",
    ("platform_settings.py", "350"): "Error updating platform parameters",
    ("platform_settings.py", "378"): "Platform update failed",
    ("platform_settings.py", "399"): "Failed to validate platform settings",
    ("platform_settings.py", "425"): "Platform validation error",
    ("platform_settings.py", "463"): "Invalid platform data provided",
    ("platform_settings.py", "465"): "Error processing platform request",
    ("platform_settings.py", "511"): "Platform operation failed",
    ("platform_settings.py", "533"): "Critical platform error",
    
    # platform_settings_public.py
    ("platform_settings_public.py", "147"): "Failed to retrieve public settings",
    
    # tips.py
    ("tips.py", "68"): "Invalid tip configuration",
    ("tips.py", "71"): "Failed to update tip settings",
}

class HTTPExceptionMigrator:
    def __init__(self):
        self.files_processed = 0
        self.total_replacements = 0
        self.errors = []
        self.changes_by_file = defaultdict(list)
        
    def should_process_file(self, filepath: Path) -> bool:
        """Check if file should be processed."""
        str_path = str(filepath)
        
        # Skip excluded paths
        for exclude in EXCLUDE_FILES:
            if exclude in str_path:
                return False
                
        # Only process Python files
        if not str_path.endswith('.py'):
            return False
            
        # Skip migration files
        if 'alembic/versions' in str_path:
            return False
            
        return True
    
    def get_exception_type(self, status_code: int) -> str:
        """Get the appropriate exception type for a status code."""
        return STATUS_CODE_TO_EXCEPTION.get(status_code, "FynloException")
    
    def get_error_message(self, filename: str, line_num: str, context: str = "") -> str:
        """Get appropriate error message based on context."""
        # Check for predefined context-aware messages
        key = (filename, line_num)
        if key in CONTEXT_ERROR_MESSAGES:
            return CONTEXT_ERROR_MESSAGES[key]
        
        # Fallback to generic messages based on context
        if "auth" in context.lower():
            return "Authentication error occurred"
        elif "payment" in context.lower():
            return "Payment processing error"
        elif "config" in context.lower():
            return "Configuration error"
        elif "order" in context.lower():
            return "Order processing error"
        else:
            return "An error occurred processing the request"
    
    def fix_imports(self, content: str) -> Tuple[str, int]:
        """Fix import statements."""
        changes = 0
        
        # Pattern to find HTTPException imports
        import_patterns = [
            (r'from fastapi import (.*)HTTPException(.*)', r'from fastapi import \1\2'),
            (r'from fastapi import HTTPException', ''),
            (r'import HTTPException', ''),
        ]
        
        for pattern, replacement in import_patterns:
            matches = re.findall(pattern, content)
            if matches:
                content = re.sub(pattern, replacement, content)
                changes += len(matches)
        
        # Clean up empty imports
        content = re.sub(r'from fastapi import\s*$', '', content, flags=re.MULTILINE)
        content = re.sub(r'from fastapi import\s*,', 'from fastapi import', content)
        content = re.sub(r',\s*,', ',', content)
        content = re.sub(r',\s*\)', ')', content)
        
        # Ensure FynloException imports are present
        if 'FynloException' in content and 'from app.core.exceptions import' not in content:
            # Add import at the top of the file after other imports
            lines = content.split('\n')
            import_added = False
            for i, line in enumerate(lines):
                if line.startswith('from app.') and not import_added:
                    lines.insert(i, 'from app.core.exceptions import (')
                    lines.insert(i + 1, '    FynloException, ValidationException, AuthenticationException,')
                    lines.insert(i + 2, '    AuthorizationException, NotFoundException, ConflictException,')
                    lines.insert(i + 3, '    RateLimitException, ServiceUnavailableError')
                    lines.insert(i + 4, ')')
                    import_added = True
                    break
            content = '\n'.join(lines)
        
        return content, changes
    
    def fix_raise_statements(self, content: str, filename: str) -> Tuple[str, int]:
        """Fix raise HTTPException statements."""
        changes = 0
        
        # Find all raise HTTPException statements
        pattern = r'raise HTTPException\(\s*status_code\s*=\s*(status\.)?(HTTP_)?(\d{3}|\w+),?\s*detail\s*=\s*["\']([^"\']*)["\'].*?\)'
        
        def replace_exception(match):
            nonlocal changes
            changes += 1
            
            status_part = match.group(3)
            detail = match.group(4)
            
            # Extract status code
            if status_part.isdigit():
                status_code = int(status_part)
            else:
                # Map status constants to codes
                status_map = {
                    "BAD_REQUEST": 400,
                    "UNAUTHORIZED": 401,
                    "FORBIDDEN": 403,
                    "NOT_FOUND": 404,
                    "CONFLICT": 409,
                    "UNPROCESSABLE_ENTITY": 422,
                    "TOO_MANY_REQUESTS": 429,
                    "INTERNAL_SERVER_ERROR": 500,
                    "SERVICE_UNAVAILABLE": 503,
                    "503_SERVICE_UNAVAILABLE": 503,
                    "404_NOT_FOUND": 404,
                    "400_BAD_REQUEST": 400,
                    "500_INTERNAL_SERVER_ERROR": 500,
                }
                status_code = status_map.get(status_part, 500)
            
            exception_type = self.get_exception_type(status_code)
            
            # Use detail as message
            message = detail if detail else f"Error occurred (status: {status_code})"
            
            return f'raise {exception_type}(message="{message}")'
        
        content = re.sub(pattern, replace_exception, content, flags=re.DOTALL)
        
        # Handle multi-line raise statements
        multiline_pattern = r'raise HTTPException\(\s*status_code\s*=\s*(status\.)?(HTTP_)?(\d{3}|\w+),?\s*detail\s*=\s*["\']([^"\']*)["\'][^)]*\)'
        content = re.sub(multiline_pattern, replace_exception, content, flags=re.DOTALL | re.MULTILINE)
        
        return content, changes
    
    def fix_except_blocks(self, content: str) -> Tuple[str, int]:
        """Fix except HTTPException blocks."""
        changes = 0
        
        # Simple replacement
        pattern = r'except HTTPException:'
        replacement = 'except FynloException:'
        
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, replacement, content)
            changes += len(matches)
        
        # Also handle except HTTPException as e:
        pattern2 = r'except HTTPException as (\w+):'
        replacement2 = r'except FynloException as \1:'
        
        matches2 = re.findall(pattern2, content)
        if matches2:
            content = re.sub(pattern2, replacement2, content)
            changes += len(matches2)
        
        return content, changes
    
    def fix_empty_messages(self, content: str, filename: str) -> Tuple[str, int]:
        """Fix empty message="" occurrences."""
        changes = 0
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            if 'message=""' in line:
                # Get line number (1-based)
                line_num = str(i + 1)
                
                # Get appropriate message
                message = self.get_error_message(filename, line_num, line)
                
                # Replace empty message
                lines[i] = line.replace('message=""', f'message="{message}"')
                changes += 1
        
        return '\n'.join(lines), changes
    
    def fix_class_inheritance(self, content: str) -> Tuple[str, int]:
        """Fix classes that inherit from HTTPException."""
        changes = 0
        
        # Pattern to find class definitions inheriting from HTTPException
        pattern = r'class\s+(\w+)\s*\([^)]*HTTPException[^)]*\):'
        
        def replace_inheritance(match):
            nonlocal changes
            changes += 1
            class_name = match.group(1)
            return f'class {class_name}(FynloException):'
        
        content = re.sub(pattern, replace_inheritance, content)
        
        return content, changes
    
    def process_file(self, filepath: Path) -> bool:
        """Process a single file."""
        try:
            # Read file
            with open(filepath, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            content = original_content
            total_changes = 0
            filename = filepath.name
            
            # Apply fixes in order
            content, changes = self.fix_imports(content)
            total_changes += changes
            
            content, changes = self.fix_raise_statements(content, filename)
            total_changes += changes
            
            content, changes = self.fix_except_blocks(content)
            total_changes += changes
            
            content, changes = self.fix_empty_messages(content, filename)
            total_changes += changes
            
            content, changes = self.fix_class_inheritance(content)
            total_changes += changes
            
            # Write back if changes were made
            if total_changes > 0:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                self.files_processed += 1
                self.total_replacements += total_changes
                self.changes_by_file[str(filepath)] = total_changes
                
                print(f"✓ Fixed {filepath.name}: {total_changes} changes")
                return True
            
            return False
            
        except Exception as e:
            self.errors.append(f"Error processing {filepath}: {str(e)}")
            return False
    
    def run(self):
        """Run the migration on all Python files."""
        print("Starting comprehensive HTTPException migration...")
        print("=" * 60)
        
        # Process all Python files
        for root, dirs, files in os.walk(BASE_DIR):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if not any(exclude in d for exclude in EXCLUDE_FILES)]
            
            for file in files:
                if file.endswith('.py'):
                    filepath = Path(root) / file
                    if self.should_process_file(filepath):
                        self.process_file(filepath)
        
        # Print summary
        print("\n" + "=" * 60)
        print("Migration Complete!")
        print(f"Files processed: {self.files_processed}")
        print(f"Total replacements: {self.total_replacements}")
        
        if self.changes_by_file:
            print("\nChanges by file:")
            for filepath, count in sorted(self.changes_by_file.items()):
                print(f"  {filepath}: {count} changes")
        
        if self.errors:
            print("\nErrors encountered:")
            for error in self.errors:
                print(f"  ❌ {error}")
        
        # Save report
        report = {
            "files_processed": self.files_processed,
            "total_replacements": self.total_replacements,
            "changes_by_file": dict(self.changes_by_file),
            "errors": self.errors
        }
        
        with open(BASE_DIR / "httpexception_migration_report.json", "w") as f:
            json.dump(report, f, indent=2)
        
        print("\nMigration report saved to httpexception_migration_report.json")

if __name__ == "__main__":
    migrator = HTTPExceptionMigrator()
    migrator.run()
