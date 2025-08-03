"""add_user_restaurants_multi_tenant_support

Revision ID: 9977a196aa67
Revises: d92292f7ec1d
Create Date: 2025-07-29 23:14:29.832820

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9977a196aa67'
down_revision = 'd92292f7ec1d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure UUID extension is enabled
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    
    # Create user_restaurants table for many-to-many relationship
    op.create_table(
        'user_restaurants',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('restaurant_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='owner'),
        sa.Column('is_primary', sa.Boolean(), server_default='false'),
        sa.Column('permissions', sa.JSON(), server_default='{}'),
        sa.Column('assigned_by', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
        sa.UniqueConstraint('user_id', 'restaurant_id', name='unique_user_restaurant'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], ondelete='SET NULL')
    )
    
    # Create indexes for performance
    op.create_index('idx_user_restaurants_user_id', 'user_restaurants', ['user_id'])
    op.create_index('idx_user_restaurants_restaurant_id', 'user_restaurants', ['restaurant_id'])
    op.create_index('idx_user_restaurants_role', 'user_restaurants', ['role'])
    
    # Add current_restaurant_id to users table
    op.add_column('users', sa.Column('current_restaurant_id', sa.UUID(as_uuid=True), nullable=True))
    op.add_column('users', sa.Column('last_restaurant_switch', sa.DateTime(timezone=True), nullable=True))
    
    # Add restaurant_id to inventory table (currently missing)
    op.add_column('inventory', sa.Column('restaurant_id', sa.UUID(as_uuid=True), nullable=True))
    
    # Create foreign key for current_restaurant_id
    op.create_foreign_key(
        'fk_users_current_restaurant',
        'users',
        'restaurants',
        ['current_restaurant_id'],
        ['id'],
        ondelete='SET NULL'
    )
    
    # Create foreign key for inventory restaurant_id
    op.create_foreign_key(
        'fk_inventory_restaurant',
        'inventory',
        'restaurants',
        ['restaurant_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    # Migrate existing user-restaurant relationships
    op.execute("""
        INSERT INTO user_restaurants (user_id, restaurant_id, role, is_primary, created_at)
        SELECT id, restaurant_id, role, true, created_at
        FROM users
        WHERE restaurant_id IS NOT NULL
        ON CONFLICT (user_id, restaurant_id) DO NOTHING;
    """)
    
    # Set current_restaurant_id for existing users
    op.execute("""
        UPDATE users
        SET current_restaurant_id = restaurant_id
        WHERE restaurant_id IS NOT NULL;
    """)


def downgrade() -> None:
    # Remove foreign keys
    op.drop_constraint('fk_inventory_restaurant', 'inventory', type_='foreignkey')
    op.drop_constraint('fk_users_current_restaurant', 'users', type_='foreignkey')
    
    # Remove columns
    op.drop_column('inventory', 'restaurant_id')
    op.drop_column('users', 'last_restaurant_switch')
    op.drop_column('users', 'current_restaurant_id')
    
    # Drop indexes
    op.drop_index('idx_user_restaurants_role', 'user_restaurants')
    op.drop_index('idx_user_restaurants_restaurant_id', 'user_restaurants')
    op.drop_index('idx_user_restaurants_user_id', 'user_restaurants')
    
    # Drop table
    op.drop_table('user_restaurants')
