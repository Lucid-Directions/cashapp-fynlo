"""Create mobile ID mappings table

Revision ID: 004_create_mobile_id_mappings
Revises: 001_add_username
Create Date: 2025-06-20 17:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '004_create_mobile_id_mappings'
down_revision = '001_add_username'
branch_labels = None
depends_on = None

def upgrade():
    """Create mobile ID mappings table for collision-resistant UUID to integer conversion"""
    
    # Drop existing table if it exists (for this update)
    op.execute("DROP TABLE IF EXISTS mobile_id_mappings")
    
    # Create mobile_id_mappings table with composite primary key
    op.create_table('mobile_id_mappings',
        sa.Column('uuid_id', sa.String(255), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('mobile_id', sa.Integer, unique=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('uuid_id', 'entity_type')
    )
    
    # Create indexes for performance
    op.create_index('idx_mobile_id_mappings_mobile_id', 'mobile_id_mappings', ['mobile_id'])
    op.create_index('idx_mobile_id_mappings_entity_type', 'mobile_id_mappings', ['entity_type'])
    op.create_index('idx_mobile_id_mappings_composite', 'mobile_id_mappings', ['entity_type', 'mobile_id'])

def downgrade():
    """Drop mobile ID mappings table"""
    
    # Drop indexes
    op.drop_index('idx_mobile_id_mappings_composite')
    op.drop_index('idx_mobile_id_mappings_entity_type')
    op.drop_index('idx_mobile_id_mappings_mobile_id')
    
    # Drop table
    op.drop_table('mobile_id_mappings')