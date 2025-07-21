#!/usr/bin/env python3
"""
Database Column Migration Tool for Fynlo POS

This script adds missing columns to the restaurants table to fix authentication issues.
It handles both production and development environments safely.

Usage:
    python scripts/migrate_database_columns.py [--check-only] [--force]

Options:
    --check-only    Only check for missing columns without making changes
    --force         Apply changes without confirmation prompt

SECURITY: This script requires DATABASE_URL environment variable to be set.
It will NOT drop or delete any existing data, only add missing columns.
"""

import os
import sys
import argparse
from datetime import datetime
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import OperationalError, ProgrammingError
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ANSI color codes for output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def print_header(message):
    """Print a formatted header message"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message.center(60)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}\n")


def print_success(message):
    """Print a success message"""
    print(f"{Colors.OKGREEN}✅ {message}{Colors.ENDC}")


def print_warning(message):
    """Print a warning message"""
    print(f"{Colors.WARNING}⚠️  {message}{Colors.ENDC}")


def print_error(message):
    """Print an error message"""
    print(f"{Colors.FAIL}❌ {message}{Colors.ENDC}")


def print_info(message):
    """Print an info message"""
    print(f"{Colors.OKCYAN}ℹ️  {message}{Colors.ENDC}")


def check_missing_columns(engine):
    """Check which columns are missing from the restaurants table"""
    missing_columns = []
    
    try:
        inspector = inspect(engine)
        
        # Get existing columns
        existing_columns = [col['name'] for col in inspector.get_columns('restaurants')]
        
        # Define expected columns with their SQL definitions
        expected_columns = {
            'floor_plan_layout': 'JSONB',
            'subscription_plan': 'VARCHAR(50)',
            'subscription_status': 'VARCHAR(50)',
            'subscription_started_at': 'TIMESTAMPTZ',
            'subscription_expires_at': 'TIMESTAMPTZ'
        }
        
        # Check which columns are missing
        for column_name, column_type in expected_columns.items():
            if column_name not in existing_columns:
                missing_columns.append((column_name, column_type))
        
        return missing_columns
        
    except Exception as e:
        print_error(f"Failed to inspect database: {str(e)}")
        return None


def generate_migration_sql(missing_columns):
    """Generate SQL statements for adding missing columns"""
    if not missing_columns:
        return None
    
    sql_statements = []
    
    # Generate ALTER TABLE statements
    for column_name, column_type in missing_columns:
        if column_name == 'subscription_plan':
            sql = f"ADD COLUMN IF NOT EXISTS {column_name} {column_type} DEFAULT 'alpha'"
        elif column_name == 'subscription_status':
            sql = f"ADD COLUMN IF NOT EXISTS {column_name} {column_type} DEFAULT 'trial'"
        else:
            sql = f"ADD COLUMN IF NOT EXISTS {column_name} {column_type}"
        
        sql_statements.append(sql)
    
    # Combine into single ALTER TABLE statement
    full_sql = "ALTER TABLE restaurants\n" + ",\n".join(sql_statements) + ";"
    
    return full_sql


def apply_migration(engine, migration_sql):
    """Apply the migration to the database"""
    try:
        with engine.connect() as conn:
            trans = conn.begin()
            try:
                # Apply the migration
                conn.execute(text(migration_sql))
                trans.commit()
                return True
            except Exception as e:
                trans.rollback()
                print_error(f"Migration failed: {str(e)}")
                return False
    except Exception as e:
        print_error(f"Database connection failed: {str(e)}")
        return False


def verify_migration(engine, expected_columns):
    """Verify that all expected columns now exist"""
    try:
        inspector = inspect(engine)
        existing_columns = [col['name'] for col in inspector.get_columns('restaurants')]
        
        all_present = True
        for column_name in expected_columns:
            if column_name not in existing_columns:
                print_error(f"Column {column_name} is still missing after migration")
                all_present = False
            else:
                print_success(f"Column {column_name} verified")
        
        return all_present
        
    except Exception as e:
        print_error(f"Failed to verify migration: {str(e)}")
        return False


def main():
    """Main migration function"""
    parser = argparse.ArgumentParser(description='Migrate Fynlo database columns')
    parser.add_argument('--check-only', action='store_true', 
                        help='Only check for missing columns without making changes')
    parser.add_argument('--force', action='store_true',
                        help='Apply changes without confirmation prompt')
    args = parser.parse_args()
    
    print_header("Fynlo Database Column Migration Tool")
    
    # Check for DATABASE_URL
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print_error("DATABASE_URL environment variable not found")
        print_info("Please set DATABASE_URL or create a .env file")
        sys.exit(1)
    
    # Parse database info for display (hide password)
    if "@" in DATABASE_URL:
        db_parts = DATABASE_URL.split("@")
        db_info = db_parts[1] if len(db_parts) > 1 else "Unknown"
    else:
        db_info = "Local database"
    
    print_info(f"Target database: {db_info}")
    
    # Create engine
    try:
        engine = create_engine(DATABASE_URL)
        print_success("Database connection established")
    except Exception as e:
        print_error(f"Failed to connect to database: {str(e)}")
        sys.exit(1)
    
    # Check for missing columns
    print_info("Checking for missing columns...")
    missing_columns = check_missing_columns(engine)
    
    if missing_columns is None:
        sys.exit(1)
    
    if not missing_columns:
        print_success("All required columns are already present!")
        print_info("No migration needed.")
        return
    
    # Report missing columns
    print_warning(f"Found {len(missing_columns)} missing column(s):")
    for column_name, column_type in missing_columns:
        print(f"  - {column_name} ({column_type})")
    
    if args.check_only:
        print_info("Check-only mode: No changes will be made")
        sys.exit(0)
    
    # Generate migration SQL
    migration_sql = generate_migration_sql(missing_columns)
    
    print_info("\nGenerated migration SQL:")
    print(f"{Colors.OKBLUE}{migration_sql}{Colors.ENDC}")
    
    # Confirm before applying (unless --force is used)
    if not args.force:
        print_warning("\nThis will modify the database schema.")
        response = input(f"{Colors.BOLD}Apply migration? (yes/no): {Colors.ENDC}").lower().strip()
        if response != 'yes':
            print_info("Migration cancelled")
            sys.exit(0)
    
    # Apply migration
    print_info("\nApplying migration...")
    if apply_migration(engine, migration_sql):
        print_success("Migration applied successfully!")
        
        # Verify migration
        print_info("\nVerifying migration...")
        expected_columns = [col[0] for col in missing_columns]
        if verify_migration(engine, expected_columns):
            print_success("All columns successfully added!")
            print_info("\n✨ Database migration completed successfully!")
            print_info("The authentication issues should now be resolved.")
            print_info("Please restart the backend application to pick up the changes.")
        else:
            print_error("Verification failed - some columns may not have been added")
            sys.exit(1)
    else:
        print_error("Migration failed - no changes were made")
        sys.exit(1)


if __name__ == "__main__":
    main()