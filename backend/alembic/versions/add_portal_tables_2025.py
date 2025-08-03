"""Add portal-specific tables and fields

Revision ID: add_portal_tables_2025
Revises: c9882ae130a2
Create Date: 2025-01-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_portal_tables_2025'
down_revision = 'c9882ae130a2'
branch_labels = None
depends_on = None


def upgrade():
    # Add portal-specific columns to restaurants table
    op.add_column('restaurants', 
        sa.Column('portal_settings', postgresql.JSONB, nullable=True, server_default='{}')
    )
    op.add_column('restaurants', 
        sa.Column('dashboard_config', postgresql.JSONB, nullable=True, server_default='{}')
    )
    op.add_column('restaurants', 
        sa.Column('export_preferences', postgresql.JSONB, nullable=True, server_default='{}')
    )
    
    # Create portal activity log table
    op.create_table('portal_activity_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('restaurant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('restaurants.id'), nullable=True),
        sa.Column('action', sa.String(255), nullable=False),
        sa.Column('details', postgresql.JSONB, nullable=True, server_default='{}'),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()'))
    )
    
    # Create indexes for performance
    op.create_index('idx_activity_log_user_id', 'portal_activity_logs', ['user_id'])
    op.create_index('idx_activity_log_restaurant_id', 'portal_activity_logs', ['restaurant_id'])
    op.create_index('idx_activity_log_action', 'portal_activity_logs', ['action'])
    op.create_index('idx_activity_log_created_at', 'portal_activity_logs', ['created_at'])
    op.create_index('idx_activity_log_user_restaurant', 'portal_activity_logs', ['user_id', 'restaurant_id'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_activity_log_user_restaurant', 'portal_activity_logs')
    op.drop_index('idx_activity_log_created_at', 'portal_activity_logs')
    op.drop_index('idx_activity_log_action', 'portal_activity_logs')
    op.drop_index('idx_activity_log_restaurant_id', 'portal_activity_logs')
    op.drop_index('idx_activity_log_user_id', 'portal_activity_logs')
    
    # Drop portal activity log table
    op.drop_table('portal_activity_logs')
    
    # Remove portal-specific columns from restaurants table
    op.drop_column('restaurants', 'export_preferences')
    op.drop_column('restaurants', 'dashboard_config')
    op.drop_column('restaurants', 'portal_settings')
