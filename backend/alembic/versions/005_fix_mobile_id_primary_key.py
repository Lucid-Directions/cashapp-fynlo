"""
Fix mobile ID mappings primary key

Revision ID: 005_fix_mobile_id_primary_key
Revises: 004_create_mobile_id_mappings
Create Date: 2025-06-20 17:25:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '005_fix_mobile_id_primary_key'
down_revision = '004_create_mobile_id_mappings'
branch_labels = None
depends_on = None

def upgrade():
    """Fix primary key to allow same UUID for different entity types"""
    
    # Drop existing table and recreate with proper structure
    op.execute("DROP TABLE IF EXISTS mobile_id_mappings CASCADE")
    
    # Create table with proper composite primary key
    op.create_table('mobile_id_mappings',
        sa.Column('uuid_id', sa.String(255), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('mobile_id', sa.Integer, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('uuid_id', 'entity_type'),
        sa.UniqueConstraint('mobile_id', name='uq_mobile_id_unique')
    )
    
    # Create indexes for performance
    op.create_index('idx_mobile_id_mappings_mobile_id', 'mobile_id_mappings', ['mobile_id'])
    op.create_index('idx_mobile_id_mappings_entity_type', 'mobile_id_mappings', ['entity_type'])
    op.create_index('idx_mobile_id_mappings_composite', 'mobile_id_mappings', ['entity_type', 'mobile_id'])

def downgrade():
    """Revert to single column primary key"""
    
    # Drop indexes
    op.drop_index('idx_mobile_id_mappings_composite')
    op.drop_index('idx_mobile_id_mappings_entity_type')
    op.drop_index('idx_mobile_id_mappings_mobile_id')
    
    # Drop table
    op.drop_table('mobile_id_mappings')