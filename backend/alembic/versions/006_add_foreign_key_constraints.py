"""Add missing foreign key constraints

Revision ID: 006_add_foreign_key_constraints
Revises: 005_fix_mobile_id_primary_key
Create Date: 2025-06-21 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006_add_foreign_key_constraints'
down_revision = '005_fix_mobile_id_primary_key'
branch_labels = None
depends_on = None

def upgrade():
    """Add all missing foreign key constraints for data integrity"""
    
    # Add foreign key constraints for categories table
    op.create_foreign_key(
        'fk_categories_restaurant_id',
        'categories', 'restaurants',
        ['restaurant_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # Add foreign key constraints for users table
    op.create_foreign_key(
        'fk_users_restaurant_id',
        'users', 'restaurants',
        ['restaurant_id'], ['id'],
        ondelete='SET NULL'
    )
    
    op.create_foreign_key(
        'fk_users_platform_id',
        'users', 'platforms',
        ['platform_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Add foreign key constraints for restaurants table
    op.create_foreign_key(
        'fk_restaurants_platform_id',
        'restaurants', 'platforms',
        ['platform_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Add foreign key constraints for customers table
    op.create_foreign_key(
        'fk_customers_restaurant_id',
        'customers', 'restaurants',
        ['restaurant_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # Add foreign key constraints for products table
    op.create_foreign_key(
        'fk_products_restaurant_id',
        'products', 'restaurants',
        ['restaurant_id'], ['id'],
        ondelete='CASCADE'
    )
    
    op.create_foreign_key(
        'fk_products_category_id',
        'products', 'categories',
        ['category_id'], ['id'],
        ondelete='RESTRICT'  # Don't allow deleting categories with products
    )
    
    # Add foreign key constraints for orders table
    op.create_foreign_key(
        'fk_orders_restaurant_id',
        'orders', 'restaurants',
        ['restaurant_id'], ['id'],
        ondelete='CASCADE'
    )
    
    op.create_foreign_key(
        'fk_orders_customer_id',
        'orders', 'customers',
        ['customer_id'], ['id'],
        ondelete='SET NULL'
    )
    
    op.create_foreign_key(
        'fk_orders_created_by',
        'orders', 'users',
        ['created_by'], ['id'],
        ondelete='SET NULL'
    )
    
    # Add foreign key constraints for payments table
    op.create_foreign_key(
        'fk_payments_order_id',
        'payments', 'orders',
        ['order_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # Add foreign key constraints for qr_payments table
    op.create_foreign_key(
        'fk_qr_payments_order_id',
        'qr_payments', 'orders',
        ['order_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # Create performance indexes on foreign key columns
    op.create_index('idx_categories_restaurant_id', 'categories', ['restaurant_id'])
    op.create_index('idx_users_restaurant_id', 'users', ['restaurant_id'])
    op.create_index('idx_users_platform_id', 'users', ['platform_id'])
    op.create_index('idx_restaurants_platform_id', 'restaurants', ['platform_id'])
    op.create_index('idx_customers_restaurant_id', 'customers', ['restaurant_id'])
    op.create_index('idx_products_restaurant_id', 'products', ['restaurant_id'])
    op.create_index('idx_products_category_id', 'products', ['category_id'])
    op.create_index('idx_orders_restaurant_id', 'orders', ['restaurant_id'])
    op.create_index('idx_orders_customer_id', 'orders', ['customer_id'])
    op.create_index('idx_orders_created_by', 'orders', ['created_by'])
    op.create_index('idx_payments_order_id', 'payments', ['order_id'])
    op.create_index('idx_qr_payments_order_id', 'qr_payments', ['order_id'])
    
    # Create composite indexes for common query patterns
    op.create_index('idx_products_restaurant_active', 'products', ['restaurant_id', 'is_active'])
    op.create_index('idx_orders_restaurant_status', 'orders', ['restaurant_id', 'status'])
    op.create_index('idx_categories_restaurant_sort', 'categories', ['restaurant_id', 'sort_order'])


def downgrade():
    """Remove all foreign key constraints and indexes"""
    
    # Drop composite indexes
    op.drop_index('idx_categories_restaurant_sort')
    op.drop_index('idx_orders_restaurant_status')
    op.drop_index('idx_products_restaurant_active')
    
    # Drop single column indexes
    op.drop_index('idx_qr_payments_order_id')
    op.drop_index('idx_payments_order_id')
    op.drop_index('idx_orders_created_by')
    op.drop_index('idx_orders_customer_id')
    op.drop_index('idx_orders_restaurant_id')
    op.drop_index('idx_products_category_id')
    op.drop_index('idx_products_restaurant_id')
    op.drop_index('idx_customers_restaurant_id')
    op.drop_index('idx_restaurants_platform_id')
    op.drop_index('idx_users_platform_id')
    op.drop_index('idx_users_restaurant_id')
    op.drop_index('idx_categories_restaurant_id')
    
    # Drop foreign key constraints
    op.drop_constraint('fk_qr_payments_order_id', 'qr_payments', type_='foreignkey')
    op.drop_constraint('fk_payments_order_id', 'payments', type_='foreignkey')
    op.drop_constraint('fk_orders_created_by', 'orders', type_='foreignkey')
    op.drop_constraint('fk_orders_customer_id', 'orders', type_='foreignkey')
    op.drop_constraint('fk_orders_restaurant_id', 'orders', type_='foreignkey')
    op.drop_constraint('fk_products_category_id', 'products', type_='foreignkey')
    op.drop_constraint('fk_products_restaurant_id', 'products', type_='foreignkey')
    op.drop_constraint('fk_customers_restaurant_id', 'customers', type_='foreignkey')
    op.drop_constraint('fk_restaurants_platform_id', 'restaurants', type_='foreignkey')
    op.drop_constraint('fk_users_platform_id', 'users', type_='foreignkey')
    op.drop_constraint('fk_users_restaurant_id', 'users', type_='foreignkey')
    op.drop_constraint('fk_categories_restaurant_id', 'categories', type_='foreignkey')