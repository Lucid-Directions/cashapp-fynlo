"""Add missing current_restaurant_id columns to users table

Revision ID: 012_add_missing_user_columns
Revises: 011_add_rls_session_variables
Create Date: 2025-08-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '012_add_missing_user_columns'
down_revision = '011_add_rls_session_variables'
branch_labels = None
depends_on = None


def upgrade():
    """Add current_restaurant_id and last_restaurant_switch columns"""
    
    # Check if columns already exist before adding them
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    
    # Get existing columns
    existing_columns = [col['name'] for col in inspector.get_columns('users')]
    
    # Track what we actually add for proper downgrade
    added_columns = []
    
    # Add current_restaurant_id if it doesn't exist
    if 'current_restaurant_id' not in existing_columns:
        op.add_column('users', 
            sa.Column('current_restaurant_id', 
                     postgresql.UUID(as_uuid=True), 
                     sa.ForeignKey('restaurants.id', ondelete='SET NULL'),
                     nullable=True))
        added_columns.append('current_restaurant_id')
    
    # Add last_restaurant_switch if it doesn't exist  
    if 'last_restaurant_switch' not in existing_columns:
        op.add_column('users',
            sa.Column('last_restaurant_switch',
                     sa.DateTime(timezone=True),
                     nullable=True))
        added_columns.append('last_restaurant_switch')
    
    # Store what was added for downgrade (in practice, migrations run forward)
    # Note: In production, downgrades are rarely used and this migration
    # should only add columns that don't exist


def downgrade():
    """Downgrade is a no-op to prevent data loss"""
    # IMPORTANT: This migration is designed to fix missing columns that should
    # have existed but were never created in production. Since we cannot track
    # whether the columns pre-existed or were added by this migration, we
    # cannot safely remove them in a downgrade without risking data loss.
    #
    # The upgrade() function only adds columns if they don't exist, so:
    # - If columns pre-existed: upgrade() does nothing, downgrade() should do nothing
    # - If columns were added: they're needed for the app to function
    #
    # Therefore, this downgrade is intentionally a no-op to prevent accidental
    # removal of critical columns.
    pass