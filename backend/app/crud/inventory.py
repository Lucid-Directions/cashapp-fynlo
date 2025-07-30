"""
CRUD operations for Inventory, Recipes, and Inventory Ledger
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from sqlalchemy.dialects.postgresql import insert as pg_insert
from typing import List, Optional, Tuple
from uuid import UUID
from datetime import datetime

from app.models import InventoryItem, Recipe, InventoryLedgerEntry, Product
from app.schemas import inventory_schemas as schemas

# --- InventoryItem CRUD ---

def get_inventory_item(db: Session, sku: str, restaurant_id: UUID) -> Optional[InventoryItem]:
    return db.query(InventoryItem).filter(
        InventoryItem.sku == sku,
        InventoryItem.restaurant_id == restaurant_id
    ).first()

def get_inventory_items(db: Session, restaurant_id: UUID, skip: int = 0, limit: int = 100) -> List[InventoryItem]:
    return db.query(InventoryItem).filter(
        InventoryItem.restaurant_id == restaurant_id
    ).offset(skip).limit(limit).all()

def create_inventory_item(db: Session, item: schemas.InventoryItemCreate, restaurant_id: UUID) -> InventoryItem:
    db_item = InventoryItem(**item.dict(exclude={'restaurant_id'}), restaurant_id=restaurant_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def update_inventory_item(db: Session, sku: str, item_update: schemas.InventoryItemUpdate, restaurant_id: UUID) -> Optional[InventoryItem]:
    db_item = get_inventory_item(db, sku, restaurant_id)
    if db_item:
        update_data = item_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_item, key, value)
        db_item.last_updated = func.now()
        db.commit()
        db.refresh(db_item)
    return db_item

def delete_inventory_item(db: Session, sku: str, restaurant_id: UUID) -> Optional[InventoryItem]:
    db_item = get_inventory_item(db, sku, restaurant_id)
    if db_item:
        # Consider safety: prevent deletion if item is in recipes or has ledger entries?
        # For now, allowing deletion. Add checks if business logic requires.
        db.delete(db_item)
        db.commit()
    return db_item

def adjust_inventory_item_quantity(db: Session, sku: str, change_qty_g: int, source: str, restaurant_id: UUID, source_id: Optional[str] = None) -> Tuple[Optional[InventoryItem], Optional[InventoryLedgerEntry]]:
    """
    Adjusts the quantity of an inventory item and logs the change.
    Ensures quantity does not drop below zero.
    Returns the updated inventory item and the created ledger entry.
    """
    db_item = get_inventory_item(db, sku, restaurant_id)
    if not db_item:
        return None, None

    original_qty = db_item.qty_g

    # Calculate new quantity, ensuring it doesn't go below 0
    if db_item.qty_g + change_qty_g < 0:
        actual_change_qty_g = -db_item.qty_g # Deduct only what's available
        db_item.qty_g = 0
    else:
        actual_change_qty_g = change_qty_g
        db_item.qty_g += change_qty_g

    db_item.last_updated = func.now()

    # Create ledger entry for the actual change
    ledger_entry = InventoryLedgerEntry(
        sku=sku,
        restaurant_id=restaurant_id,
        delta_g=actual_change_qty_g, # Log the actual change that happened
        source=source,
        source_id=source_id
    )
    db.add(ledger_entry)

    db.commit()
    db.refresh(db_item)
    db.refresh(ledger_entry)

    return db_item, ledger_entry

# --- Recipe CRUD ---

def get_recipe_by_item_id(db: Session, item_id: UUID, restaurant_id: UUID) -> List[Recipe]:
    """Gets all recipe ingredient entries for a given product (item_id) and restaurant"""
    return db.query(Recipe).filter(
        Recipe.item_id == item_id,
        Recipe.restaurant_id == restaurant_id
    ).all()

def get_recipe_ingredient(db: Session, item_id: UUID, ingredient_sku: str, restaurant_id: UUID) -> Optional[Recipe]:
    return db.query(Recipe).filter(
        Recipe.item_id == item_id,
        Recipe.ingredient_sku == ingredient_sku,
        Recipe.restaurant_id == restaurant_id
    ).first()

def create_recipe_for_item(db: Session, item_id: UUID, ingredients: List[schemas.RecipeIngredientCreate], restaurant_id: UUID) -> List[Recipe]:
    """
    Creates or updates recipe ingredients for a given item_id.
    This will replace all existing ingredients for the item.
    """
    # First, delete existing recipe ingredients for this item and restaurant
    db.query(Recipe).filter(
        Recipe.item_id == item_id,
        Recipe.restaurant_id == restaurant_id
    ).delete()

    db_recipes = []
    for ingredient_data in ingredients:
        # Ensure ingredient exists in inventory for this restaurant
        inv_item = get_inventory_item(db, ingredient_data.ingredient_sku, restaurant_id)
        if not inv_item:
            # Or raise an exception, depending on desired behavior
            continue

        db_recipe_ingredient = Recipe(
            restaurant_id=restaurant_id,
            item_id=item_id,
            ingredient_sku=ingredient_data.ingredient_sku,
            qty_g=ingredient_data.qty_g
        )
        db.add(db_recipe_ingredient)
        db_recipes.append(db_recipe_ingredient)

    db.commit()
    for rec in db_recipes: # Refresh each object to get DB-generated IDs etc.
        db.refresh(rec)
    return db_recipes


def create_or_update_recipe_ingredients(db: Session, item_id: UUID, ingredients_data: List[schemas.RecipeIngredientCreate], restaurant_id: UUID) -> List[Recipe]:
    """
    Creates new recipe ingredients or updates existing ones for a product.
    Uses PostgreSQL's ON CONFLICT DO UPDATE (upsert).
    """
    if not ingredients_data:
        # If an empty list is provided, consider deleting all existing ingredients for the item
        # For now, let's assume an empty list means no changes or handle it at the API layer.
        # To delete:
        # db.query(Recipe).filter(Recipe.item_id == item_id).delete()
        # db.commit()
        return []

    # Fetch existing ingredients for this item and restaurant to compare and delete if necessary
    existing_db_ingredients = db.query(Recipe).filter(
        Recipe.item_id == item_id,
        Recipe.restaurant_id == restaurant_id
    ).all()
    existing_ingredient_skus = {ing.ingredient_sku for ing in existing_db_ingredients}

    input_ingredient_skus = {ing_data.ingredient_sku for ing_data in ingredients_data}

    # Ingredients to delete (present in DB but not in input)
    skus_to_delete = existing_ingredient_skus - input_ingredient_skus
    if skus_to_delete:
        db.query(Recipe).filter(
            Recipe.item_id == item_id,
            Recipe.restaurant_id == restaurant_id,
            Recipe.ingredient_sku.in_(skus_to_delete)
        ).delete(synchronize_session=False)

    # Prepare data for upsert
    insert_values = []
    for ingredient_data in ingredients_data:
        # Optional: Validate ingredient_sku exists in inventory
        # inv_item = get_inventory_item(db, ingredient_data.ingredient_sku)
        # if not inv_item:
        #     raise ValueError(f"Ingredient SKU {ingredient_data.ingredient_sku} not found in inventory.")

        insert_values.append({
            "restaurant_id": restaurant_id,
            "item_id": item_id,
            "ingredient_sku": ingredient_data.ingredient_sku,
            "qty_g": ingredient_data.qty_g,
        })

    if not insert_values: # Only deletions happened
        db.commit()
        return []

    # Upsert statement for PostgreSQL
    stmt = pg_insert(Recipe).values(insert_values)
    stmt = stmt.on_conflict_do_update(
        index_elements=['restaurant_id', 'item_id', 'ingredient_sku'],  # Use the unique constraint name if available and preferred
        set_={
            "qty_g": stmt.excluded.qty_g,
        }
    )
    db.execute(stmt)
    db.commit()

    # Re-fetch the ingredients to return them with current state
    return db.query(Recipe).filter(
        Recipe.item_id == item_id,
        Recipe.restaurant_id == restaurant_id
    ).all()


def delete_recipe_for_item(db: Session, item_id: UUID, restaurant_id: UUID) -> int:
    """Deletes all recipe ingredients for a given item_id and restaurant. Returns count of deleted ingredients."""
    deleted_count = db.query(Recipe).filter(
        Recipe.item_id == item_id,
        Recipe.restaurant_id == restaurant_id
    ).delete()
    db.commit()
    return deleted_count

def delete_specific_ingredient_from_recipe(db: Session, item_id: UUID, ingredient_sku: str, restaurant_id: UUID) -> Optional[Recipe]:
    """Deletes a specific ingredient from an item's recipe."""
    db_ingredient = get_recipe_ingredient(db, item_id, ingredient_sku, restaurant_id)
    if db_ingredient:
        db.delete(db_ingredient)
        db.commit()
        return db_ingredient # No longer in DB, but was the object before deletion
    return None

# --- InventoryLedgerEntry CRUD ---

def create_inventory_ledger_entry(db: Session, entry: schemas.InventoryLedgerEntryCreate, restaurant_id: UUID) -> InventoryLedgerEntry:
    db_entry = InventoryLedgerEntry(**entry.dict(), restaurant_id=restaurant_id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

def get_ledger_entries_for_sku(db: Session, sku: str, restaurant_id: UUID, skip: int = 0, limit: int = 100, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> List[InventoryLedgerEntry]:
    query = db.query(InventoryLedgerEntry).filter(
        InventoryLedgerEntry.sku == sku,
        InventoryLedgerEntry.restaurant_id == restaurant_id
    )
    if start_date:
        query = query.filter(InventoryLedgerEntry.ts >= start_date)
    if end_date:
        query = query.filter(InventoryLedgerEntry.ts <= end_date)
    return query.order_by(InventoryLedgerEntry.ts.desc()).offset(skip).limit(limit).all()

def get_all_ledger_entries(db: Session, restaurant_id: UUID, skip: int = 0, limit: int = 100, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> List[InventoryLedgerEntry]:
    query = db.query(InventoryLedgerEntry).filter(
        InventoryLedgerEntry.restaurant_id == restaurant_id
    )
    if start_date:
        query = query.filter(InventoryLedgerEntry.ts >= start_date)
    if end_date:
        query = query.filter(InventoryLedgerEntry.ts <= end_date)
    return query.order_by(InventoryLedgerEntry.ts.desc()).offset(skip).limit(limit).all()


# --- Helper / Service level CRUD-like functions ---

def get_inventory_status_summary(db: Session, restaurant_id: UUID) -> List[schemas.InventoryStatusResponse]:
    """
    Provides a summary of all inventory items including their stock status
    (e.g., "In Stock", "Low Stock", "Out of Stock").
    """
    # Case statement for status:
    # - qty_g <= 0: "Out of Stock"
    # - qty_g <= par_level_g * 0.1 (10%): "Low Stock" (Requires par_level_g to be set and > 0)
    # - Otherwise: "In Stock"
    # Handle par_level_g being NULL or 0 to avoid division by zero or incorrect "Low Stock"

    status_expression = case(
        (InventoryItem.qty_g <= 0, "Out of Stock"),
        (
            (InventoryItem.par_level_g.isnot(None)) & (InventoryItem.par_level_g > 0) & (InventoryItem.qty_g <= InventoryItem.par_level_g * 0.1),
            "Low Stock"
        ),
        else_="In Stock"
    ).label("status")

    results = db.query(
        InventoryItem.sku,
        InventoryItem.name,
        InventoryItem.qty_g,
        InventoryItem.par_level_g,
        InventoryItem.unit,
        status_expression
    ).filter(
        InventoryItem.restaurant_id == restaurant_id
    ).all()

    return [
        schemas.InventoryStatusResponse(
            sku=r.sku,
            name=r.name,
            current_qty_g=r.qty_g,
            par_level_g=r.par_level_g,
            status=r.status,
            unit=r.unit
        ) for r in results
    ]

def get_low_stock_items(db: Session, restaurant_id: UUID, threshold_percentage: float = 0.1) -> List[schemas.LowStockItem]:
    """
    Retrieves items that are at or below a certain percentage of their par level.
    Only considers items where par_level_g is defined and greater than 0.
    """
    if not (0 < threshold_percentage <= 1):
        raise ValueError("Threshold percentage must be between 0 (exclusive) and 1 (inclusive).")

    # Filter for items where par_level_g is set and positive, and current quantity is below threshold
    low_stock_condition = (
        (InventoryItem.par_level_g.isnot(None)) &
        (InventoryItem.par_level_g > 0) &
        (InventoryItem.qty_g <= (InventoryItem.par_level_g * threshold_percentage))
    )

    results = db.query(
        InventoryItem.sku,
        InventoryItem.name,
        InventoryItem.qty_g,
        InventoryItem.par_level_g,
        InventoryItem.unit
    ).filter(
        low_stock_condition,
        InventoryItem.restaurant_id == restaurant_id
    ).all()

    response_items = []
    for r in results:
        percentage_remaining = (r.qty_g / r.par_level_g) * 100 if r.par_level_g > 0 else 0
        response_items.append(schemas.LowStockItem(
            sku=r.sku,
            name=r.name,
            qty_g=r.qty_g,
            par_level_g=r.par_level_g,
            percentage_remaining=round(percentage_remaining, 2),
            unit=r.unit
        ))
    return response_items

def get_product_details_with_recipe(db: Session, item_id: UUID, restaurant_id: UUID) -> Optional[dict]:
    """
    Retrieves a product and its associated recipe ingredients, including ingredient names.
    """
    product = db.query(Product).filter(Product.id == item_id).first()
    if not product:
        return None

    recipe_ingredients = db.query(
        Recipe.ingredient_sku,
        Recipe.qty_g,
        InventoryItem.name.label("ingredient_name"),
        InventoryItem.unit.label("ingredient_unit")
    ).join(InventoryItem, Recipe.ingredient_sku == InventoryItem.sku)\
     .filter(
        Recipe.item_id == item_id,
        Recipe.restaurant_id == restaurant_id,
        InventoryItem.restaurant_id == restaurant_id
     ).all()

    return {
        "item_id": product.id,
        "item_name": product.name,
        "ingredients": [
            {
                "ingredient_sku": ri.ingredient_sku,
                "qty_g": ri.qty_g,
                "ingredient_name": ri.ingredient_name,
                "ingredient_unit": ri.ingredient_unit,
            } for ri in recipe_ingredients
        ]
    }

def get_all_products_with_recipes(db: Session, restaurant_id: UUID, skip: int = 0, limit: int = 100) -> List[dict]:
    """
    Retrieves all products that have recipes, along with their recipe details.
    This can be heavy; consider pagination or specific filtering for real-world use.
    """
    # This is a simplified version. A more optimized query might be needed for performance
    # on large datasets, possibly using subqueries or window functions if complexity grows.

    products_with_recipes_query = db.query(Product).filter(
        Product.restaurant_id == restaurant_id,
        Product.recipes.any(Recipe.restaurant_id == restaurant_id)
    ).offset(skip).limit(limit).all()

    result_list = []
    for product in products_with_recipes_query:
        recipe_data = get_product_details_with_recipe(db, product.id, restaurant_id) # Reuse existing function
        if recipe_data: # Should always be true due to the filter, but good practice
             result_list.append(recipe_data)

    return result_list
