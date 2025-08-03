"""add_restaurant_id_to_inventory_items

Revision ID: 30fd53b66d34
Revises: d92292f7ec1d
Create Date: 2025-07-29 23:25:07.645278

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '30fd53b66d34'
down_revision = 'd92292f7ec1d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add restaurant_id column to inventory table
    op.add_column('inventory', sa.Column('restaurant_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_inventory_restaurant_id',
        'inventory', 'restaurants',
        ['restaurant_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # Create index for performance
    op.create_index('ix_inventory_restaurant_id', 'inventory', ['restaurant_id'])
    
    # For existing inventory items, we need to assign them to restaurants
    # This requires a data migration strategy:
    # Option 1: Assign all existing inventory to the first restaurant (simple but may not be correct)
    # Option 2: Create a mapping based on some business logic
    # For now, we'll use Option 1 and let administrators reassign as needed
    
    # Get the first restaurant ID to use as default
    connection = op.get_bind()
    result = connection.execute(text("SELECT id FROM restaurants LIMIT 1"))
    first_restaurant = result.fetchone()
    
    if first_restaurant:
        # Update all existing inventory items to belong to the first restaurant
        # Using parameterized query to prevent SQL injection
        connection.execute(
            text("UPDATE inventory SET restaurant_id = :restaurant_id WHERE restaurant_id IS NULL"),
            {"restaurant_id": first_restaurant[0]}
        )
    
    # Check if there are any inventory items before making column NOT NULL
    inventory_count = connection.execute(text("SELECT COUNT(*) FROM inventory")).scalar()
    
    if inventory_count > 0 and not first_restaurant:
        # If we have inventory but no restaurants, we need to handle this gracefully
        raise Exception(
            "Cannot complete migration: Inventory items exist but no restaurants found. "
            "Please create at least one restaurant before running this migration."
        )
    
    # Only make the column NOT NULL if we successfully updated all records or table is empty
    op.alter_column('inventory', 'restaurant_id',
                    existing_type=postgresql.UUID(as_uuid=True),
                    nullable=False)
    
    # Also add restaurant_id to inventory_ledger table
    op.add_column('inventory_ledger', sa.Column('restaurant_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add foreign key constraint for ledger
    op.create_foreign_key(
        'fk_inventory_ledger_restaurant_id',
        'inventory_ledger', 'restaurants',
        ['restaurant_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # Create index for performance
    op.create_index('ix_inventory_ledger_restaurant_id', 'inventory_ledger', ['restaurant_id'])
    
    # Update existing ledger entries based on their inventory item's restaurant
    connection.execute(text("""
        UPDATE inventory_ledger 
        SET restaurant_id = inventory.restaurant_id
        FROM inventory
        WHERE inventory_ledger.sku = inventory.sku
        AND inventory_ledger.restaurant_id IS NULL
    """))
    
    # Check if there are any inventory_ledger items before making column NOT NULL
    ledger_count = connection.execute(text("SELECT COUNT(*) FROM inventory_ledger")).scalar()
    
    if ledger_count > 0:
        # Verify all ledger entries have restaurant_id set
        null_count = connection.execute(
            text("SELECT COUNT(*) FROM inventory_ledger WHERE restaurant_id IS NULL")
        ).scalar()
        
        if null_count > 0:
            raise Exception(
                f"Cannot complete migration: {null_count} inventory_ledger entries "
                "still have NULL restaurant_id. This may indicate orphaned ledger entries."
            )
    
    # Make ledger restaurant_id NOT NULL
    op.alter_column('inventory_ledger', 'restaurant_id',
                    existing_type=postgresql.UUID(as_uuid=True),
                    nullable=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_inventory_ledger_restaurant_id', table_name='inventory_ledger')
    op.drop_index('ix_inventory_restaurant_id', table_name='inventory')
    
    # Drop foreign keys
    op.drop_constraint('fk_inventory_ledger_restaurant_id', 'inventory_ledger', type_='foreignkey')
    op.drop_constraint('fk_inventory_restaurant_id', 'inventory', type_='foreignkey')
    
    # Drop columns
    op.drop_column('inventory_ledger', 'restaurant_id')
    op.drop_column('inventory', 'restaurant_id')
