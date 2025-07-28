#!/usr/bin/env python3
"""Migrate existing unencrypted data to encrypted format.

This script should be run after deploying the encryption code
but before enabling the encrypted models in production.
"""

import os
import sys
import time
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.encryption import encryption_manager, _is_encrypted
from app.core.database import (
    User, Customer, Restaurant, Platform,
    Payment, QRPayment, Order
)


def migrate_table_to_encrypted(session, model_class, field_mappings, table_name):
    """Migrate a single table to encrypted format."""
    print(f"\nMigrating {table_name}...")
    
    # Update migration status
    session.execute(
        text("""
            UPDATE encryption_migration_status
            SET status = 'in_progress', started_at = NOW()
            WHERE table_name = :table_name
        """),
        {"table_name": table_name}
    )
    session.commit()
    
    try:
        # Get all records
        records = session.query(model_class).all()
        total = len(records)
        encrypted_count = 0
        
        for i, record in enumerate(records):
            modified = False
            
            for field_name, field_type in field_mappings.items():
                if hasattr(record, field_name):
                    current_value = getattr(record, field_name)
                    
                    # Skip if already encrypted or None
                    if current_value is None:
                        continue
                        
                    if isinstance(current_value, str) and _is_encrypted(current_value):
                        continue
                    
                    # Encrypt the value
                    try:
                        encrypted_value = encryption_manager.encrypt(current_value)
                        setattr(record, field_name, encrypted_value)
                        modified = True
                    except Exception as e:
                        print(f"  Error encrypting {field_name} for record {record.id}: {e}")
                        continue
            
            if modified:
                encrypted_count += 1
            
            # Progress indicator
            if (i + 1) % 100 == 0:
                print(f"  Processed {i + 1}/{total} records...")
        
        # Commit the batch
        session.commit()
        
        # Update migration status
        session.execute(
            text("""
                UPDATE encryption_migration_status
                SET status = 'completed',
                    completed_at = NOW(),
                    encrypted_records = :count
                WHERE table_name = :table_name
            """),
            {"table_name": table_name, "count": encrypted_count}
        )
        session.commit()
        
        print(f"  ✓ Migrated {encrypted_count}/{total} records")
        
    except Exception as e:
        # Log error and rollback
        session.rollback()
        session.execute(
            text("""
                UPDATE encryption_migration_status
                SET status = 'failed',
                    error_message = :error
                WHERE table_name = :table_name
            """),
            {"table_name": table_name, "error": str(e)}
        )
        session.commit()
        print(f"  ✗ Error: {e}")
        raise


def verify_encryption(session):
    """Verify that sensitive fields are encrypted."""
    print("\nVerifying encryption...")
    
    verification_queries = [
        ("users", "email", "SELECT COUNT(*) FROM users WHERE NOT is_encrypted(email) AND email IS NOT NULL"),
        ("customers", "email", "SELECT COUNT(*) FROM customers WHERE NOT is_encrypted(email) AND email IS NOT NULL"),
        ("customers", "phone", "SELECT COUNT(*) FROM customers WHERE NOT is_encrypted(phone) AND phone IS NOT NULL"),
        ("restaurants", "email", "SELECT COUNT(*) FROM restaurants WHERE NOT is_encrypted(email) AND email IS NOT NULL"),
        ("payments", "external_id", "SELECT COUNT(*) FROM payments WHERE NOT is_encrypted(external_id) AND external_id IS NOT NULL"),
    ]
    
    all_encrypted = True
    for table, field, query in verification_queries:
        result = session.execute(text(query)).scalar()
        if result > 0:
            print(f"  ✗ {table}.{field}: {result} unencrypted records found")
            all_encrypted = False
        else:
            print(f"  ✓ {table}.{field}: All records encrypted")
    
    return all_encrypted


def main():
    """Main migration function."""
    print("=== Fynlo POS Encryption Migration ===")
    
    # Check for encryption key
    if not os.environ.get("ENCRYPTION_MASTER_KEY"):
        print("ERROR: ENCRYPTION_MASTER_KEY environment variable not set!")
        print("Please set the encryption key before running this migration.")
        sys.exit(1)
    
    # Create database session
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Define tables and fields to encrypt
        migrations = [
            (User, {
                "email": "string",
                "first_name": "string",
                "last_name": "string",
                "pin_code": "string"
            }, "users"),
            (Customer, {
                "email": "string",
                "phone": "string",
                "first_name": "string",
                "last_name": "string"
            }, "customers"),
            (Restaurant, {
                "phone": "string",
                "email": "string",
                "address": "json"
            }, "restaurants"),
            (Platform, {
                "owner_email": "string"
            }, "platforms"),
            (Payment, {
                "external_id": "string",
                "payment_metadata": "json"
            }, "payments"),
            (QRPayment, {
                "qr_code_data": "string"
            }, "qr_payments"),
            (Order, {
                "special_instructions": "string"
            }, "orders")
        ]
        
        # Check migration status
        print("\nChecking migration status...")
        status_query = text("""
            SELECT table_name, status, encrypted_records, total_records
            FROM encryption_migration_status
            ORDER BY table_name
        """)
        
        for row in session.execute(status_query):
            status_icon = "✓" if row.status == "completed" else "⏳"
            print(f"  {status_icon} {row.table_name}: {row.status} "
                  f"({row.encrypted_records}/{row.total_records} encrypted)")
        
        # Ask for confirmation
        print("\nThis will encrypt all sensitive data in the database.")
        print("Make sure you have a backup before proceeding!")
        response = input("\nContinue with encryption migration? (yes/no): ")
        
        if response.lower() != "yes":
            print("Migration cancelled.")
            return
        
        # Run migrations
        start_time = time.time()
        
        for model_class, field_mappings, table_name in migrations:
            # Skip if already completed
            status = session.execute(
                text("""
                    SELECT status FROM encryption_migration_status
                    WHERE table_name = :table_name
                """),
                {"table_name": table_name}
            ).scalar()
            
            if status == "completed":
                print(f"\nSkipping {table_name} (already completed)")
                continue
                
            migrate_table_to_encrypted(session, model_class, field_mappings, table_name)
        
        # Verify encryption
        if verify_encryption(session):
            print("\n✓ All sensitive fields successfully encrypted!")
        else:
            print("\n⚠ Some fields may not be encrypted. Please check the logs.")
        
        elapsed = time.time() - start_time
        print(f"\nMigration completed in {elapsed:.2f} seconds")
        
        # Final status report
        print("\nFinal migration status:")
        for row in session.execute(status_query):
            status_icon = "✓" if row.status == "completed" else "✗"
            print(f"  {status_icon} {row.table_name}: {row.status}")
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()