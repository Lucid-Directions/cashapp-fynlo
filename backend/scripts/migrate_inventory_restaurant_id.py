#!/usr/bin/env python3
"""
Data migration script to populate restaurant_id in inventory tables.

This script handles the migration of existing inventory data to support
multi-tenant isolation by adding restaurant_id to all inventory records.
"""
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base


def migrate_inventory_restaurant_ids():
    """Populate restaurant_id for existing inventory data."""

    # Create database connection
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        print(
            f"Starting inventory restaurant_id migration at {datetime.now()}"
        )

        # Step 1: Get the first restaurant (or a default restaurant for orphaned data)
        result = db.execute(
            text(
                """
            SELECT id, name FROM restaurants
            WHERE is_active = true
            ORDER BY created_at
            LIMIT 1
        """
            )
        )

        restaurant = result.fetchone()
        if not restaurant:
            print(
                "ERROR: No active restaurant found. Please create a restaurant first."
            )
            return False

        default_restaurant_id = restaurant[0]
        restaurant_name = restaurant[1]
        print(
            f"Using restaurant '{restaurant_name}' (ID: {default_restaurant_id}) as default"
        )

        # Step 2: Update inventory_items table
        print("\nUpdating inventory_items table...")
        result = db.execute(
            text(
                """
            UPDATE inventory
            SET restaurant_id = :restaurant_id
            WHERE restaurant_id IS NULL
        """
            ),
            {"restaurant_id": default_restaurant_id},
        )
        print(f"Updated {result.rowcount} inventory items")

        # Step 3: Update recipes table
        print("\nUpdating recipes table...")
        result = db.execute(
            text(
                """
            UPDATE recipe
            SET restaurant_id = :restaurant_id
            WHERE restaurant_id IS NULL
        """
            ),
            {"restaurant_id": default_restaurant_id},
        )
        print(f"Updated {result.rowcount} recipe entries")

        # Step 4: Update inventory_ledger_entries table
        print("\nUpdating inventory_ledger_entries table...")
        result = db.execute(
            text(
                """
            UPDATE inventory_ledger
            SET restaurant_id = :restaurant_id
            WHERE restaurant_id IS NULL
        """
            ),
            {"restaurant_id": default_restaurant_id},
        )
        print(f"Updated {result.rowcount} ledger entries")

        # Step 5: For multi-restaurant scenarios, match inventory by product relationships
        print("\nChecking for multi-restaurant scenarios...")

        # Update inventory items based on products they're used in
        result = db.execute(
            text(
                """
            UPDATE inventory i
            SET restaurant_id = p.restaurant_id
            FROM recipe r
            JOIN products p ON r.item_id = p.id
            WHERE i.sku = r.ingredient_sku
            AND i.restaurant_id != p.restaurant_id
            AND p.restaurant_id IS NOT NULL
        """
            )
        )
        if result.rowcount > 0:
            print(
                f"Realigned {result.rowcount} inventory items to match product restaurants"
            )

        # Commit all changes
        db.commit()
        print("\n✅ Migration completed successfully!")

        # Verify no NULL restaurant_ids remain
        for table in ["inventory", "recipe", "inventory_ledger"]:
            result = db.execute(
                text(
                    f"SELECT COUNT(*) FROM {table} WHERE restaurant_id IS NULL"
                )
            )
            null_count = result.scalar()
            if null_count > 0:
                print(
                    f"⚠️  WARNING: {null_count} records in {table} still have NULL restaurant_id"
                )

        return True

    except Exception as e:
        db.rollback()
        print(f"\n❌ Migration failed: {str(e)}")
        return False
    finally:
        db.close()


def add_constraints():
    """Add NOT NULL constraints after data migration."""
    engine = create_engine(settings.DATABASE_URL)

    try:
        with engine.connect() as conn:
            print("\nAdding NOT NULL constraints...")

            # Make restaurant_id NOT NULL
            for table in ["inventory", "recipe", "inventory_ledger"]:
                conn.execute(
                    text(
                        f"""
                    ALTER TABLE {table}
                    ALTER COLUMN restaurant_id SET NOT NULL
                """
                    )
                )
                print(f"✅ Added NOT NULL constraint to {table}.restaurant_id")

            # Add foreign key constraints
            print("\nAdding foreign key constraints...")

            conn.execute(
                text(
                    """
                ALTER TABLE inventory
                ADD CONSTRAINT fk_inventory_restaurant
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
            """
                )
            )
            print("✅ Added foreign key constraint to inventory")

            conn.execute(
                text(
                    """
                ALTER TABLE recipe
                ADD CONSTRAINT fk_recipe_restaurant
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
            """
                )
            )
            print("✅ Added foreign key constraint to recipe")

            conn.execute(
                text(
                    """
                ALTER TABLE inventory_ledger
                ADD CONSTRAINT fk_inventory_ledger_restaurant
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
            """
                )
            )
            print("✅ Added foreign key constraint to inventory_ledger")

            conn.commit()
            print("\n✅ All constraints added successfully!")

    except Exception as e:
        print(f"\n❌ Failed to add constraints: {str(e)}")
        return False

    return True


if __name__ == "__main__":
    print("=" * 60)
    print("INVENTORY MULTI-TENANT MIGRATION SCRIPT")
    print("=" * 60)

    # Run migration
    if migrate_inventory_restaurant_ids():
        # Add constraints after successful migration
        add_constraints()
    else:
        print("\n⚠️  Migration failed. Please fix issues and retry.")
        sys.exit(1)
