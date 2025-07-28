"""Add restaurant_id to inventory system tables.

Revision ID: add_restaurant_id_inventory
Revises:
Create Date: 2024-01-28 10:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_restaurant_id_inventory"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Add restaurant_id to inventory tables for multi-tenant isolation."""
    # Add restaurant_id to inventory table
    op.add_column(
        "inventory",
        sa.Column(
            "restaurant_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,  # Temporarily nullable for migration
            comment="Restaurant ownership for multi-tenant isolation",
        ),
    )

    # Add restaurant_id to recipe table
    op.add_column(
        "recipe",
        sa.Column(
            "restaurant_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,  # Temporarily nullable for migration
            comment="Restaurant ownership for multi-tenant isolation",
        ),
    )

    # Add restaurant_id to inventory_ledger table
    op.add_column(
        "inventory_ledger",
        sa.Column(
            "restaurant_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,  # Temporarily nullable for migration
            comment="Restaurant ownership for multi-tenant isolation",
        ),
    )

    # Create indexes for performance
    op.create_index(
        "ix_inventory_restaurant_id", "inventory", ["restaurant_id"]
    )
    op.create_index("ix_recipe_restaurant_id", "recipe", ["restaurant_id"])
    op.create_index(
        "ix_inventory_ledger_restaurant_id",
        "inventory_ledger",
        ["restaurant_id"],
    )

    # Add foreign key constraints (after data migration)
    # Note: These will be added in a separate migration after data is populated

    # Add check constraint to ensure restaurant_id is set
    # This will be enabled after data migration


def downgrade():
    """Remove restaurant_id from inventory tables."""
    # Drop indexes
    op.drop_index("ix_inventory_restaurant_id", "inventory")
    op.drop_index("ix_recipe_restaurant_id", "recipe")
    op.drop_index("ix_inventory_ledger_restaurant_id", "inventory_ledger")

    # Drop columns
    op.drop_column("inventory", "restaurant_id")
    op.drop_column("recipe", "restaurant_id")
    op.drop_column("inventory_ledger", "restaurant_id")
