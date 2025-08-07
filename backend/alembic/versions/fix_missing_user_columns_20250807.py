"""Add current_restaurant_id to users table

Revision ID: fix_missing_user_columns_20250807
Revises: YYY_create_financial_records_tables
Create Date: 2025-08-07 14:50:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'fix_missing_user_columns_20250807'
down_revision = 'YYY_create_financial_records_tables'
branch_labels = None
depends_on = None


def upgrade():
    # Add current_restaurant_id column to users table
    op.add_column('users', 
        sa.Column('current_restaurant_id', 
                  postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('restaurants.id'),
                  nullable=True))
    
    # Add last_restaurant_switch column
    op.add_column('users',
        sa.Column('last_restaurant_switch',
                  sa.DateTime(timezone=True),
                  nullable=True))


def downgrade():
    # Remove the columns
    op.drop_column('users', 'last_restaurant_switch')
    op.drop_column('users', 'current_restaurant_id')