"""Add performance indexes

Revision ID: performance_indexes_20250117
Revises: latest
Create Date: 2025-01-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'performance_indexes_20250117'
down_revision = 'c9882ae130a2'
branch_labels = None
depends_on = None


def upgrade():
    # Products indexes for faster menu queries
    op.create_index(
        'idx_products_restaurant_active',
        'products',
        ['restaurant_id', 'is_active'],
        postgresql_where=sa.text('is_active = true')
    )
    
    op.create_index(
        'idx_products_category_active',
        'products',
        ['category_id', 'is_active'],
        postgresql_where=sa.text('is_active = true')
    )
    
    # Orders indexes for performance
    op.create_index(
        'idx_orders_restaurant_status_created',
        'orders',
        ['restaurant_id', 'status', 'created_at']
    )
    
    op.create_index(
        'idx_orders_restaurant_date',
        'orders',
        ['restaurant_id', sa.text('DATE(created_at)')]
    )
    
    # Order items indexes for join performance
    op.create_index(
        'idx_order_items_order_id',
        'order_items',
        ['order_id']
    )
    
    # Users indexes for auth queries
    op.create_index(
        'idx_users_supabase_id',
        'users',
        ['supabase_id']
    )
    
    op.create_index(
        'idx_users_restaurant_role',
        'users',
        ['restaurant_id', 'role'],
        postgresql_where=sa.text('is_active = true')
    )
    
    # Categories index for menu queries
    op.create_index(
        'idx_categories_restaurant_active',
        'categories',
        ['restaurant_id', 'is_active'],
        postgresql_where=sa.text('is_active = true')
    )
    
    # Inventory indexes
    op.create_index(
        'idx_inventory_product_restaurant',
        'inventory',
        ['product_id', 'restaurant_id']
    )
    
    # Transactions index for analytics
    op.create_index(
        'idx_transactions_restaurant_date',
        'transactions',
        ['restaurant_id', 'created_at']
    )


def downgrade():
    op.drop_index('idx_products_restaurant_active')
    op.drop_index('idx_products_category_active')
    op.drop_index('idx_orders_restaurant_status_created')
    op.drop_index('idx_orders_restaurant_date')
    op.drop_index('idx_order_items_order_id')
    op.drop_index('idx_users_supabase_id')
    op.drop_index('idx_users_restaurant_role')
    op.drop_index('idx_categories_restaurant_active')
    op.drop_index('idx_inventory_product_restaurant')
    op.drop_index('idx_transactions_restaurant_date')