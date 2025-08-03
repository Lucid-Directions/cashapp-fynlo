"""drop floor_plan_layout column

Revision ID: 009_drop_floor_plan_layout
Revises: 008_add_table_order_linkage
Create Date: 2025-08-01 00:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009_drop_floor_plan_layout'
down_revision = '008_add_table_order_linkage'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the floor_plan_layout column from restaurants table if it exists
    # First check if the column exists to avoid errors
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('restaurants')]
    
    if 'floor_plan_layout' in columns:
        op.drop_column('restaurants', 'floor_plan_layout')


def downgrade():
    # Add the column back in downgrade
    op.add_column('restaurants', sa.Column('floor_plan_layout', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
