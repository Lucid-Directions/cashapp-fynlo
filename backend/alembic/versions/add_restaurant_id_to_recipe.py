"""
Add restaurant_id to Recipe table for multi-tenant isolation

Revision ID: add_restaurant_id_to_recipe
Revises: e83749019fca
Create Date: 2025-01-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_restaurant_id_to_recipe'
down_revision = 'e83749019fca'
branch_labels = None
depends_on = None


def upgrade():
    # Add restaurant_id column to recipe table
    op.add_column('recipe', sa.Column('restaurant_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Create foreign key constraint
    op.create_foreign_key(
        'fk_recipe_restaurant_id', 
        'recipe', 
        'restaurants', 
        ['restaurant_id'], 
        ['id'], 
        ondelete='CASCADE'
    )
    
    # Drop old unique constraint
    op.drop_constraint('uq_recipe_item_ingredient', 'recipe', type_='unique')
    
    # Create new unique constraint including restaurant_id
    op.create_unique_constraint(
        'uq_recipe_restaurant_item_ingredient', 
        'recipe', 
        ['restaurant_id', 'item_id', 'ingredient_sku']
    )
    
    # Add index on restaurant_id for performance
    op.create_index('ix_recipe_restaurant_id', 'recipe', ['restaurant_id'])
    
    # Add check constraint to ensure recipe ingredients belong to same restaurant
    # This requires a function to validate the constraint
    op.execute("""
        CREATE OR REPLACE FUNCTION check_recipe_ingredient_restaurant()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM inventory i
                WHERE i.sku = NEW.ingredient_sku
                AND i.restaurant_id = NEW.restaurant_id
            ) THEN
                RAISE EXCEPTION 'Ingredient SKU % does not exist for restaurant %', 
                    NEW.ingredient_sku, NEW.restaurant_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    op.execute("""
        CREATE TRIGGER recipe_ingredient_restaurant_check
        BEFORE INSERT OR UPDATE ON recipe
        FOR EACH ROW
        EXECUTE FUNCTION check_recipe_ingredient_restaurant();
    """)
    
    # Populate restaurant_id from related product's restaurant_id
    op.execute("""
        UPDATE recipe r
        SET restaurant_id = p.restaurant_id
        FROM products p
        WHERE r.item_id = p.id
    """)
    
    # Make restaurant_id NOT NULL after population
    op.alter_column('recipe', 'restaurant_id', nullable=False)


def downgrade():
    # Drop trigger and function
    op.execute("DROP TRIGGER IF EXISTS recipe_ingredient_restaurant_check ON recipe")
    op.execute("DROP FUNCTION IF EXISTS check_recipe_ingredient_restaurant()")
    
    # Drop index
    op.drop_index('ix_recipe_restaurant_id', table_name='recipe')
    
    # Drop new unique constraint
    op.drop_constraint('uq_recipe_restaurant_item_ingredient', 'recipe', type_='unique')
    
    # Recreate old unique constraint
    op.create_unique_constraint(
        'uq_recipe_item_ingredient', 
        'recipe', 
        ['item_id', 'ingredient_sku']
    )
    
    # Drop foreign key constraint
    op.drop_constraint('fk_recipe_restaurant_id', 'recipe', type_='foreignkey')
    
    # Drop restaurant_id column
    op.drop_column('recipe', 'restaurant_id')