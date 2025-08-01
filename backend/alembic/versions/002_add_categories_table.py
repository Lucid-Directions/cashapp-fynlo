"""
Add categories table and update products schema

Revision ID: 002_add_categories_table
Revises: 001_add_username_to_users
Create Date: 2025-06-20 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = '002_add_categories_table'
down_revision = '001_add_username'
branch_labels = None
depends_on = None

def upgrade():
    """Add categories table and fix products schema"""
    
    # Create categories table
    op.create_table('categories',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('restaurant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('color', sa.String(7), default='#00A651'),
        sa.Column('icon', sa.String(50)),
        sa.Column('sort_order', sa.Integer, default=0),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now())
    )
    
    # Add foreign key constraint for categories.restaurant_id
    op.create_foreign_key(
        'fk_categories_restaurant_id',
        'categories', 'restaurants',
        ['restaurant_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # Create index for performance
    op.create_index('idx_categories_restaurant_id', 'categories', ['restaurant_id'])
    op.create_index('idx_categories_sort_order', 'categories', ['restaurant_id', 'sort_order'])
    
    # Update products table to match the database model
    # First, add new columns that are missing
    op.add_column('products', sa.Column('category_id', UUID(as_uuid=True), nullable=True))
    op.add_column('products', sa.Column('cost', sa.Float, default=0.0))
    op.add_column('products', sa.Column('barcode', sa.String(100)))
    op.add_column('products', sa.Column('sku', sa.String(100)))
    op.add_column('products', sa.Column('prep_time', sa.Integer, default=0))
    op.add_column('products', sa.Column('dietary_info', JSONB, default=sa.text("'[]'::jsonb")))
    op.add_column('products', sa.Column('modifiers', JSONB, default=sa.text("'[]'::jsonb")))
    op.add_column('products', sa.Column('stock_tracking', sa.Boolean, default=False))
    op.add_column('products', sa.Column('stock_quantity', sa.Integer, default=0))
    
    # Rename columns to match model
    op.alter_column('products', 'is_available', new_column_name='is_active')
    op.alter_column('products', 'preparation_time', new_column_name='prep_time_old')  # Temporary rename
    op.alter_column('products', 'allergens', new_column_name='dietary_info_old')  # Temporary rename
    
    # Drop old columns that don't match the model
    op.drop_column('products', 'nutritional_info')
    op.drop_column('products', 'variants')
    op.drop_column('products', 'prep_time_old')
    op.drop_column('products', 'dietary_info_old')
    
    # Create default categories for existing restaurants
    # This ensures data integrity for existing products
    op.execute("""
        INSERT INTO categories (restaurant_id, name, description, color, sort_order, is_active)
        SELECT DISTINCT 
            r.id as restaurant_id,
            'Uncategorized' as name,
            'Default category for existing products' as description,
            '#6B7280' as color,
            0 as sort_order,
            true as is_active
        FROM restaurants r
        WHERE r.id IN (SELECT DISTINCT restaurant_id FROM products WHERE category IS NOT NULL)
    """)
    
    # Update products to reference the new categories table
    # Map existing string categories to the new category IDs
    op.execute("""
        UPDATE products 
        SET category_id = (
            SELECT c.id 
            FROM categories c 
            WHERE c.restaurant_id = products.restaurant_id 
            AND c.name = 'Uncategorized'
            LIMIT 1
        )
        WHERE category IS NOT NULL
    """)
    
    # Now make category_id NOT NULL since all products should have a category
    op.alter_column('products', 'category_id', nullable=False)
    
    # Add foreign key constraint for products.category_id
    op.create_foreign_key(
        'fk_products_category_id',
        'products', 'categories',
        ['category_id'], ['id'],
        ondelete='RESTRICT'  # Don't allow deleting categories with products
    )
    
    # Add foreign key constraint for products.restaurant_id  
    op.create_foreign_key(
        'fk_products_restaurant_id',
        'products', 'restaurants',
        ['restaurant_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # Create performance indexes
    op.create_index('idx_products_restaurant_id', 'products', ['restaurant_id'])
    op.create_index('idx_products_category_id', 'products', ['category_id'])
    op.create_index('idx_products_active', 'products', ['restaurant_id', 'is_active'])
    
    # Drop the old string category column
    op.drop_column('products', 'category')


def downgrade():
    """Reverse the changes"""
    
    # Add back the old category string column
    op.add_column('products', sa.Column('category', sa.String(100)))
    
    # Copy category names back from categories table
    op.execute("""
        UPDATE products 
        SET category = (
            SELECT c.name 
            FROM categories c 
            WHERE c.id = products.category_id
        )
    """)
    
    # Drop indexes
    op.drop_index('idx_products_active')
    op.drop_index('idx_products_category_id')
    op.drop_index('idx_products_restaurant_id')
    op.drop_index('idx_categories_sort_order')
    op.drop_index('idx_categories_restaurant_id')
    
    # Drop foreign key constraints
    op.drop_constraint('fk_products_restaurant_id', 'products', type_='foreignkey')
    op.drop_constraint('fk_products_category_id', 'products', type_='foreignkey')
    op.drop_constraint('fk_categories_restaurant_id', 'categories', type_='foreignkey')
    
    # Remove new columns from products
    op.drop_column('products', 'stock_quantity')
    op.drop_column('products', 'stock_tracking')
    op.drop_column('products', 'modifiers')
    op.drop_column('products', 'dietary_info')
    op.drop_column('products', 'prep_time')
    op.drop_column('products', 'sku')
    op.drop_column('products', 'barcode')
    op.drop_column('products', 'cost')
    op.drop_column('products', 'category_id')
    
    # Restore old column names
    op.alter_column('products', 'is_active', new_column_name='is_available')
    
    # Add back old columns
    op.add_column('products', sa.Column('preparation_time', sa.Integer))
    op.add_column('products', sa.Column('allergens', JSONB, default=sa.text("'[]'::jsonb")))
    op.add_column('products', sa.Column('nutritional_info', JSONB, default=sa.text("'{}'::jsonb")))
    op.add_column('products', sa.Column('variants', JSONB, default=sa.text("'[]'::jsonb")))
    
    # Drop categories table
    op.drop_table('categories')