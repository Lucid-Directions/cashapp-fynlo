"""Add floor plan and POS session tables

Revision ID: 003_add_floor_plan_and_pos_tables
Revises: 002_add_categories_table
Create Date: 2025-06-20 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003_add_floor_plan_and_pos_tables'
down_revision: Union[str, None] = '002_add_categories_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sections table
    op.create_table('sections',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('restaurant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('color', sa.String(length=7), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create tables table
    op.create_table('tables',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('restaurant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('section_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('seats', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('server_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('x_position', sa.Integer(), nullable=True),
        sa.Column('y_position', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['section_id'], ['sections.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create pos_sessions table
    op.create_table('pos_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('restaurant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('state', sa.String(length=50), nullable=True),
        sa.Column('config_id', sa.Integer(), nullable=False),
        sa.Column('config_name', sa.String(length=255), nullable=False),
        sa.Column('start_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('stop_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('session_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Add indexes for performance
    op.create_index('idx_sections_restaurant_id', 'sections', ['restaurant_id'])
    op.create_index('idx_tables_restaurant_id', 'tables', ['restaurant_id'])
    op.create_index('idx_tables_section_id', 'tables', ['section_id'])
    op.create_index('idx_pos_sessions_restaurant_id', 'pos_sessions', ['restaurant_id'])
    op.create_index('idx_pos_sessions_user_id', 'pos_sessions', ['user_id'])
    op.create_index('idx_pos_sessions_state', 'pos_sessions', ['state'])
    
    # Set default values
    op.execute("ALTER TABLE sections ALTER COLUMN color SET DEFAULT '#00A651'")
    op.execute("ALTER TABLE sections ALTER COLUMN sort_order SET DEFAULT 0")
    op.execute("ALTER TABLE sections ALTER COLUMN is_active SET DEFAULT true")
    
    op.execute("ALTER TABLE tables ALTER COLUMN seats SET DEFAULT 4")
    op.execute("ALTER TABLE tables ALTER COLUMN status SET DEFAULT 'available'")
    op.execute("ALTER TABLE tables ALTER COLUMN x_position SET DEFAULT 0")
    op.execute("ALTER TABLE tables ALTER COLUMN y_position SET DEFAULT 0")
    op.execute("ALTER TABLE tables ALTER COLUMN is_active SET DEFAULT true")
    
    op.execute("ALTER TABLE pos_sessions ALTER COLUMN state SET DEFAULT 'opening_control'")
    op.execute("ALTER TABLE pos_sessions ALTER COLUMN session_data SET DEFAULT '{}'")
    op.execute("ALTER TABLE pos_sessions ALTER COLUMN is_active SET DEFAULT true")


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_pos_sessions_state', table_name='pos_sessions')
    op.drop_index('idx_pos_sessions_user_id', table_name='pos_sessions')
    op.drop_index('idx_pos_sessions_restaurant_id', table_name='pos_sessions')
    op.drop_index('idx_tables_section_id', table_name='tables')
    op.drop_index('idx_tables_restaurant_id', table_name='tables')
    op.drop_index('idx_sections_restaurant_id', table_name='sections')
    
    # Drop tables
    op.drop_table('pos_sessions')
    op.drop_table('tables')
    op.drop_table('sections') 