"""Add customer_email to orders table

Revision ID: add_customer_email_to_orders_20250811
Revises: fix_missing_user_columns_20250807
Create Date: 2025-08-11 16:15:00

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_customer_email_to_orders_20250811'
down_revision = 'fix_missing_user_columns_20250807'
branch_labels = None
depends_on = None


def upgrade():
    # Add customer_email column to orders table if it doesn't exist
    # Using a try-except to handle the case where the column might already exist
    try:
        op.add_column('orders', 
            sa.Column('customer_email', 
                      sa.String(255), 
                      nullable=True))
    except Exception as e:
        # Column might already exist in production
        print(f'Note: customer_email column may already exist: {e}')
        pass


def downgrade():
    # Remove the customer_email column
    try:
        op.drop_column('orders', 'customer_email')
    except Exception as e:
        # Column might not exist
        print(f'Note: customer_email column may not exist: {e}')
        pass
