"""Add field-level encryption for sensitive data.

Revision ID: add_field_encryption
Revises: add_row_level_security
Create Date: 2024-01-28 12:00:00.000000

"""

import os
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "add_field_encryption"
down_revision = "add_row_level_security"
branch_labels = None
depends_on = None


def upgrade():
    """Add encryption to sensitive fields."""
    # First, we need to ensure we have the encryption key
    if not os.environ.get("ENCRYPTION_MASTER_KEY"):
        print("WARNING: ENCRYPTION_MASTER_KEY not set. Skipping encryption migration.")
        print("Set the environment variable and run migration again.")
        return

    conn = op.get_bind()

    # Create backup tables for sensitive data (in case of rollback needs)
    backup_tables = [
        ("users", ["id", "email", "first_name", "last_name", "pin_code"]),
        ("customers", ["id", "email", "phone", "first_name", "last_name"]),
        ("restaurants", ["id", "phone", "email", "address"]),
        ("platforms", ["id", "owner_email"]),
        ("payments", ["id", "external_id", "payment_metadata"]),
        ("qr_payments", ["id", "qr_code_data"]),
        ("orders", ["id", "special_instructions"])
    ]

    # Create backup schema
    conn.execute(text("CREATE SCHEMA IF NOT EXISTS encryption_backup"))

    # Create backup tables
    for table_name, columns in backup_tables:
        columns_str = ", ".join(columns)
        conn.execute(
            text(f"""
                CREATE TABLE encryption_backup.{table_name}_backup AS
                SELECT {columns_str}
                FROM {table_name}
            """)
        )

    # Note: The actual encryption of existing data should be done 
    # via a separate script after deploying the application code
    # This migration only prepares the schema

    # Add comment to indicate encrypted fields
    encrypted_field_comments = [
        ("users", "email", "Encrypted email for user authentication"),
        ("users", "first_name", "Encrypted first name"),
        ("users", "last_name", "Encrypted last name"),
        ("users", "pin_code", "Encrypted PIN for employee time clock"),
        ("customers", "email", "Encrypted customer email"),
        ("customers", "phone", "Encrypted customer phone"),
        ("customers", "first_name", "Encrypted customer first name"),
        ("customers", "last_name", "Encrypted customer last name"),
        ("restaurants", "phone", "Encrypted restaurant phone"),
        ("restaurants", "email", "Encrypted restaurant email"),
        ("restaurants", "address", "Encrypted restaurant address"),
        ("platforms", "owner_email", "Encrypted platform owner email"),
        ("payments", "external_id", "Encrypted external payment provider ID"),
        ("payments", "payment_metadata", "Encrypted payment metadata"),
        ("qr_payments", "qr_code_data", "Encrypted QR code payment data"),
        ("orders", "special_instructions", "Encrypted special instructions")
    ]

    for table, column, comment in encrypted_field_comments:
        conn.execute(
            text(f"""
                COMMENT ON COLUMN {table}.{column} IS :comment
            """),
            {"comment": comment}
        )

    # Create encryption status tracking table
    op.create_table(
        'encryption_migration_status',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('table_name', sa.String(255), nullable=False),
        sa.Column('total_records', sa.Integer(), nullable=False),
        sa.Column('encrypted_records', sa.Integer(), default=0),
        sa.Column('status', sa.String(50), default='pending'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('table_name')
    )

    # Insert status records for each table
    for table_name, _ in backup_tables:
        conn.execute(
            text(f"""
                INSERT INTO encryption_migration_status (table_name, total_records, status)
                SELECT :table_name, COUNT(*), 'pending'
                FROM {table_name}
            """),
            {"table_name": table_name}
        )

    # Create function to check if data is encrypted
    conn.execute(
        text("""
            CREATE OR REPLACE FUNCTION is_encrypted(value TEXT)
            RETURNS BOOLEAN AS $$
            BEGIN
                -- Check if value looks like encrypted data (base64 with specific pattern)
                RETURN value IS NOT NULL 
                    AND LENGTH(value) > 50
                    AND value ~ '^[A-Za-z0-9+/]+=*$';
            END;
            $$ LANGUAGE plpgsql;
        """)
    )

    # Add indexes for searchable encrypted fields (deterministic encryption)
    # These will be functional indexes on the hash portion
    op.create_index(
        'idx_users_email_encrypted',
        'users',
        [text("SUBSTRING(email FROM '^[^|]+')")]
    )
    op.create_index(
        'idx_customers_email_encrypted',
        'customers',
        [text("SUBSTRING(email FROM '^[^|]+')")]
    )
    op.create_index(
        'idx_customers_phone_encrypted',
        'customers',
        [text("SUBSTRING(phone FROM '^[^|]+')")]
    )
    op.create_index(
        'idx_platforms_owner_email_encrypted',
        'platforms',
        [text("SUBSTRING(owner_email FROM '^[^|]+')")]
    )


def downgrade():
    """Remove encryption from sensitive fields."""
    conn = op.get_bind()

    # Drop encrypted field indexes
    op.drop_index('idx_users_email_encrypted', 'users')
    op.drop_index('idx_customers_email_encrypted', 'customers')
    op.drop_index('idx_customers_phone_encrypted', 'customers')
    op.drop_index('idx_platforms_owner_email_encrypted', 'platforms')

    # Drop encryption status table
    op.drop_table('encryption_migration_status')

    # Drop encryption check function
    conn.execute(text("DROP FUNCTION IF EXISTS is_encrypted(TEXT)"))

    # Remove encrypted field comments
    encrypted_fields = [
        ("users", ["email", "first_name", "last_name", "pin_code"]),
        ("customers", ["email", "phone", "first_name", "last_name"]),
        ("restaurants", ["phone", "email", "address"]),
        ("platforms", ["owner_email"]),
        ("payments", ["external_id", "payment_metadata"]),
        ("qr_payments", ["qr_code_data"]),
        ("orders", ["special_instructions"])
    ]

    for table, columns in encrypted_fields:
        for column in columns:
            conn.execute(
                text(f"COMMENT ON COLUMN {table}.{column} IS NULL")
            )

    # Note: Backup tables in encryption_backup schema are preserved
    # They should be manually dropped after verifying the rollback
    print("WARNING: Backup tables in 'encryption_backup' schema preserved.")
    print("Drop them manually after verifying rollback: DROP SCHEMA encryption_backup CASCADE;")