#!/usr/bin/env python3
"""
Automated Migration Script: HTTPException to FynloException
Migrates HTTPException instances to appropriate FynloException subclasses
"""

import os
import ast
import shutil
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import argparse
import json
from pathlib import Path

# Migration mapping based on status codes and patterns
STATUS_CODE_MAPPING = {
    400: "ValidationException",  # Default for 400
    401: "AuthenticationException",
    403: "AuthorizationException",
    404: "ResourceNotFoundException",
    409: "ConflictException",
    422: "ValidationException",
    500: "FynloException",
    503: "ServiceUnavailableError"
}

# Pattern-based exception mapping
PATTERN_MAPPING = {
    # Auth patterns
    "invalid credentials": "AuthenticationException",
    "unauthorized": "AuthenticationException",
    "authentication": "AuthenticationException",
    "invalid token": "AuthenticationException",
    "token expired": "AuthenticationException",
    
    # Authorization patterns
    "permission": "AuthorizationException",
    "forbidden": "AuthorizationException",
    "access denied": "AuthorizationException",
    "not allowed": "AuthorizationException",
    
    # Resource patterns
    "not found": "ResourceNotFoundException",
    "does not exist": "ResourceNotFoundException",
    "no such": "ResourceNotFoundException",
    
    # Validation patterns
    "invalid": "ValidationException",
    "validation": "ValidationException",
    "required": "ValidationException",
    "must be": "ValidationException",
    
    # Conflict patterns
    "already exists": "ConflictException",
    "duplicate": "ConflictException",
    "conflict": "ConflictException",
    
    # Payment patterns
    "payment": "PaymentException",
    "transaction": "PaymentException",
    "charge": "PaymentException",
    
    # Inventory patterns
    "stock": "InventoryException",
    "inventory": "InventoryException",
    "out of stock": "InventoryException",
    "insufficient": "InventoryException",
    
    # Service patterns
    "service unavailable": "ServiceUnavailableError",
    "temporarily unavailable": "ServiceUnavailableError",
    "try again later": "ServiceUnavailableError"
}

# Required imports for each file
REQUIRED_IMPORTS = """from app.core.exceptions import (
    FynloException,
    AuthenticationException,
    AuthorizationException,
    ValidationException,
    ResourceNotFoundException,
    ConflictException,
    BusinessLogicException,
    PaymentException,
    InventoryException,
    ServiceUnavailableError
)"""


class HTTPExceptionMigrator:
    def __init__(self, backup_dir: str = "backup", dry_run: bool = False):
        self.backup_dir = backup_dir
        self.dry_run = dry_run
        self.migration_report = {
            "total_files": 0,
            "total_exceptions": 0,
            "migrated": [],
            "errors": [],
            "skipped": []
        }
        
    def determine_exception_type(self, status_code: int, detail: str) -> Tuple[str, Dict[str, str]]:
        """Determine the appropriate FynloException type based on status code and message"""
        detail_lower = detail.lower() if detail else ""
        
        # Check pattern mapping first
        for pattern, exception_type in PATTERN_MAPPING.items():
            if pattern in detail_lower:
                return exception_type, self._get_exception_params(exception_type, status_code, detail)
        
        # Fall back to status code mapping
        exception_type = STATUS_CODE_MAPPING.get(status_code, "FynloException")
        return exception_type, self._get_exception_params(exception_type, status_code, detail)
    
    def _get_exception_params(self, exception_type: str, status_code: int, detail: str) -> Dict[str, str]:
        """Get appropriate parameters for each exception type"""
        params = {}
        
        if exception_type == "ResourceNotFoundException":
            # Try to extract resource type from message
            if "user" in detail.lower():
                params["resource"] = '"User"'
            elif "order" in detail.lower():
                params["resource"] = '"Order"'
            elif "product" in detail.lower():
                params["resource"] = '"Product"'
            elif "restaurant" in detail.lower():
                params["resource"] = '"Restaurant"'
            else:
                params["resource"] = '"Resource"'
            
            # Add message if it's not the default
            # Add message if it's not the default
            resource_name = params['resource'].strip('"').lower()
            if detail and detail.lower() != f"{resource_name} not found":
                params["message"] = f'"{detail}"'
                
        elif exception_type == "ValidationException":
            params["message"] = f'"{detail}"'
            # Try to extract field name
            if "amount" in detail.lower():
                params["field"] = '"amount"'
            elif "email" in detail.lower():
                params["field"] = '"email"'
            elif "password" in detail.lower():
                params["field"] = '"password"'
                
        elif exception_type in ["AuthenticationException", "AuthorizationException"]:
            params["message"] = f'"{detail}"'
            
        elif exception_type == "PaymentException":
            params["message"] = f'"{detail}"'
            
        elif exception_type == "InventoryException":
            params["message"] = f'"{detail}"'
            
        elif exception_type == "ConflictException":
            params["message"] = f'"{detail}"'
            
        elif exception_type == "ServiceUnavailableError":
            params["message"] = f'"{detail}"'
            
        elif exception_type == "FynloException":
            params["message"] = f'"{detail}"'
            params["status_code"] = str(status_code)
            
        return params
    
    def migrate_file(self, filepath: str) -> Tuple[bool, str, int]:
        """Migrate a single file"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            lines = content.split('\n')
            modified = False
            exception_count = 0
            
            # Track if we need to add imports
            needs_imports = False
            has_fynlo_import = "from app.core.exceptions import" in content
            
            # Process line by line to handle multi-line HTTPException
            i = 0
            while i < len(lines):
                line = lines[i]
                
                if "raise HTTPException(" in line:
                    # Found HTTPException, extract full statement
                    statement_lines = [line]
                    j = i + 1
                    
                    # Handle multi-line statements
                    while j < len(lines) and not statement_lines[-1].rstrip().endswith(')'):
                        statement_lines.append(lines[j])
                        j += 1
                    
                    full_statement = '\n'.join(statement_lines)
                    
                    # Parse the HTTPException
                    migrated_statement = self._migrate_statement(full_statement)
                    
                    if migrated_statement and migrated_statement != full_statement:
                        # Replace the lines
                        migrated_lines = migrated_statement.split('\n')
                        lines[i:j] = migrated_lines
                        modified = True
                        needs_imports = True
                        exception_count += 1
                        i += len(migrated_lines) - 1
                    
                i += 1
            
            if modified:
                # Reconstruct content
                content = '\n'.join(lines)
                
                # Add imports if needed
                if needs_imports and not has_fynlo_import:
                    # Find where to insert imports (after other imports)
                    import_lines = []
                    other_lines = []
                    in_imports = False
                    
                    for line in content.split('\n'):
                        if line.startswith('import ') or line.startswith('from '):
                            import_lines.append(line)
                            in_imports = True
                        elif in_imports and line.strip() == '':
                            import_lines.append(line)
                        else:
                            if in_imports:
                                # Add our imports before the first non-import line
                                import_lines.append('')
                                import_lines.append(REQUIRED_IMPORTS)
                                in_imports = False
                            other_lines.append(line)
                    
                    content = '\n'.join(import_lines + other_lines)
                
                # Remove redundant HTTPException import if all are migrated
                if "raise HTTPException(" not in content:
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        if "from fastapi import" in line and "HTTPException" in line:
                            # Remove HTTPException from imports
                            imports = line.split('import')[1].strip()
                            import_list = [imp.strip() for imp in imports.split(',')]
                            import_list = [imp for imp in import_list if imp != 'HTTPException']
                            if import_list:
                                lines[i] = f"from fastapi import {', '.join(import_list)}"
                            else:
                                lines[i] = ''
                    content = '\n'.join(lines)
                
                # Save the file
                if not self.dry_run:
                    # Create backup
                    backup_path = os.path.join(self.backup_dir, os.path.basename(filepath) + '.bak')
                    os.makedirs(self.backup_dir, exist_ok=True)
                    shutil.copy2(filepath, backup_path)
                    
                    # Write migrated content
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                
                return True, f"Migrated {exception_count} exceptions", exception_count
            
            return False, "No HTTPException found", 0
            
        except Exception as e:
            return False, f"Error: {str(e)}", 0
    
    def _migrate_statement(self, statement: str) -> Optional[str]:
        """Migrate a single HTTPException statement"""
        try:
            # Extract status_code and detail using simple parsing
            status_code = None
            detail = None
            
            # Extract status_code
            if "status_code=" in statement:
                status_part = statement.split("status_code=")[1]
                status_code = int(status_part.split(',')[0].split(')')[0].strip())
            
            # Extract detail
            if "detail=" in statement:
                detail_part = statement.split("detail=")[1]
                # Handle various quote styles
                if detail_part.strip().startswith('"'):
                    detail = detail_part.split('"')[1]
                elif detail_part.strip().startswith("'"):
                    detail = detail_part.split("'")[1]
                elif detail_part.strip().startswith('f"') or detail_part.strip().startswith("f'"):
                    # F-string - preserve as is
                    end_char = '"' if detail_part.strip().startswith('f"') else "'"
                    detail = detail_part.strip()
            
            if status_code is None:
                return None
            
            # Determine exception type
            exception_type, params = self.determine_exception_type(
                status_code, 
                detail if detail and not detail.startswith('f') else ""
            )
            
            # Build new exception
            if detail and (detail.startswith('f"') or detail.startswith("f'")):
                # Preserve f-strings
                params["message"] = detail
            
            # Format parameters
            param_str = ", ".join([f"{k}={v}" for k, v in params.items()])
            
            # Preserve indentation
            indent = len(statement) - len(statement.lstrip())
            new_statement = " " * indent + f"raise {exception_type}({param_str})"
            
            return new_statement
            
        except Exception as e:
            print(f"Error migrating statement: {e}")
            return None
    
    def run_migration(self, target_files: List[str]):
        """Run migration on specified files"""
        print(f"\n{'DRY RUN - ' if self.dry_run else ''}Starting HTTPException to FynloException migration...")
        print(f"Target files: {len(target_files)}")
        
        self.migration_report["total_files"] = len(target_files)
        
        for filepath in target_files:
            print(f"\nProcessing: {filepath}")
            
            if not os.path.exists(filepath):
                print(f"  ⚠️  File not found, skipping")
                self.migration_report["skipped"].append({
                    "file": filepath,
                    "reason": "File not found"
                })
                continue
            
            success, message, count = self.migrate_file(filepath)
            
            if success and count > 0:
                print(f"  ✅ {message}")
                self.migration_report["migrated"].append({
                    "file": filepath,
                    "exceptions_migrated": count,
                    "message": message
                })
                self.migration_report["total_exceptions"] += count
            elif not success:
                print(f"  ❌ {message}")
                self.migration_report["errors"].append({
                    "file": filepath,
                    "error": message
                })
            else:
                print(f"  ⏭️  {message}")
                self.migration_report["skipped"].append({
                    "file": filepath,
                    "reason": message
                })
        
        # Save report
        report_path = f"migration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, 'w') as f:
            json.dump(self.migration_report, f, indent=2)
        
        print(f"\n{'='*60}")
        print(f"Migration {'(DRY RUN) ' if self.dry_run else ''}Complete!")
        print(f"Total files processed: {self.migration_report['total_files']}")
        print(f"Total exceptions migrated: {self.migration_report['total_exceptions']}")
        print(f"Files successfully migrated: {len(self.migration_report['migrated'])}")
        print(f"Files with errors: {len(self.migration_report['errors'])}")
        print(f"Files skipped: {len(self.migration_report['skipped'])}")
        print(f"\nDetailed report saved to: {report_path}")


def main():
    parser = argparse.ArgumentParser(description="Migrate HTTPException to FynloException")
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Run in dry-run mode (no files will be modified)"
    )
    parser.add_argument(
        "--file", 
        type=str, 
        help="Migrate a specific file"
    )
    parser.add_argument(
        "--all", 
        action="store_true", 
        help="Migrate all files with HTTPException"
    )
    
    args = parser.parse_args()
    
    # List of files from the issue
    all_files = [
        "app/api/v1/endpoints/auth.py",
        "app/api/v1/endpoints/platform_settings_public.py",
        "app/api/v1/endpoints/secure_payment_provider_management.py",
        "app/api/v1/endpoints/fees.py",
        "app/api/v1/endpoints/payments.py",
        "app/api/v1/endpoints/payment_configurations.py",
        "app/api/v1/endpoints/config.py",
        "app/api/v1/endpoints/restaurants.py",
        "app/api/v1/endpoints/monitoring.py",
        "app/api/v1/endpoints/orders.py",
        "app/api/v1/endpoints/secure_payments.py",
        "app/api/v1/endpoints/tips.py",
        "app/api/v1/endpoints/dashboard.py",
        "app/api/v1/endpoints/platform_admin.py",
        "app/api/v1/endpoints/admin.py",
        "app/api/v1/endpoints/platform_settings.py",
        "app/api/v1/endpoints/recipes.py",
        "app/api/v1/endpoints/customers.py",
        "app/api/v1/endpoints/products_secure.py",
        "app/api/v1/endpoints/inventory.py"
    ]
    
    migrator = HTTPExceptionMigrator(dry_run=args.dry_run)
    
    if args.file:
        target_files = [args.file]
    elif args.all:
        target_files = all_files
    else:
        print("Please specify --file <filepath> or --all to migrate all files")
        return
    
    migrator.run_migration(target_files)


if __name__ == "__main__":
    main()
