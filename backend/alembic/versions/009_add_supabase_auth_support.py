"""
Add Supabase auth support

Revision ID: 009_add_supabase_auth_support
Revises: e8f9d5c7b2a1
Create Date: 2025-01-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009_add_supabase_auth_support'
down_revision = '008_add_table_order_linkage'
branch_labels = None
depends_on = None


def upgrade():
    # Add Supabase ID column to users table
    op.add_column('users', sa.Column('supabase_id', postgresql.UUID, unique=True, nullable=True))
    
    # Add auth provider column to track authentication method
    op.add_column('users', sa.Column('auth_provider', sa.String(50), server_default='supabase'))
    
    # Make password nullable since Supabase handles auth
    op.alter_column('users', 'password_hash', nullable=True)
    
    # Create index for faster lookups by Supabase ID
    op.create_index('idx_users_supabase_id', 'users', ['supabase_id'])
    
    # Add subscription fields to restaurants table
    op.add_column('restaurants', sa.Column('subscription_plan', sa.String(50), server_default='alpha'))
    op.add_column('restaurants', sa.Column('subscription_status', sa.String(50), server_default='trial'))
    op.add_column('restaurants', sa.Column('subscription_started_at', sa.TIMESTAMP, nullable=True))
    op.add_column('restaurants', sa.Column('subscription_expires_at', sa.TIMESTAMP, nullable=True))


def downgrade():
    # Remove index
    op.drop_index('idx_users_supabase_id')
    
    # Remove columns from users table
    op.drop_column('users', 'supabase_id')
    op.drop_column('users', 'auth_provider')
    
    # Make password required again
    op.alter_column('users', 'password_hash', nullable=False)
    
    # Remove subscription fields from restaurants table
    op.drop_column('restaurants', 'subscription_plan')
    op.drop_column('restaurants', 'subscription_status')
    op.drop_column('restaurants', 'subscription_started_at')
    op.drop_column('restaurants', 'subscription_expires_at')