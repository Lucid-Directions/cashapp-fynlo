"""Add table_id foreign key to orders and layout storage

Revision ID: 008_add_table_order_linkage
Revises: 007_create_recipe_inventory_tables
Create Date: 2025-01-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '008_add_table_order_linkage'
down_revision: Union[str, None] = '007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add table_id foreign key to orders table
    op.add_column('orders', sa.Column('table_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_orders_table_id', 'orders', 'tables', ['table_id'], ['id'])
    op.create_index('idx_orders_table_id', 'orders', ['table_id'])
    
    # Add layout storage to restaurants table
    op.add_column('restaurants', sa.Column('floor_plan_layout', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    
    # Add more position/rotation fields to tables for enhanced layout
    op.add_column('tables', sa.Column('width', sa.Integer(), nullable=True, default=60))
    op.add_column('tables', sa.Column('height', sa.Integer(), nullable=True, default=60))
    op.add_column('tables', sa.Column('rotation', sa.Integer(), nullable=True, default=0))
    op.add_column('tables', sa.Column('shape', sa.String(20), nullable=True, default='round'))
    
    # Set default values
    op.execute("ALTER TABLE tables ALTER COLUMN width SET DEFAULT 60")
    op.execute("ALTER TABLE tables ALTER COLUMN height SET DEFAULT 60")
    op.execute("ALTER TABLE tables ALTER COLUMN rotation SET DEFAULT 0")
    op.execute("ALTER TABLE tables ALTER COLUMN shape SET DEFAULT 'round'")
    
    # Add indexes for performance
    op.create_index('idx_tables_position', 'tables', ['x_position', 'y_position'])
    op.create_index('idx_tables_status', 'tables', ['status'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_tables_status', table_name='tables')
    op.drop_index('idx_tables_position', table_name='tables')
    op.drop_index('idx_orders_table_id', table_name='orders')
    
    # Drop foreign key
    op.drop_constraint('fk_orders_table_id', 'orders', type_='foreignkey')
    
    # Drop columns
    op.drop_column('orders', 'table_id')
    op.drop_column('restaurants', 'floor_plan_layout')
    op.drop_column('tables', 'width')
    op.drop_column('tables', 'height')
    op.drop_column('tables', 'rotation')
    op.drop_column('tables', 'shape')
