"""
API Endpoints for Inventory Management
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from app.core.database import get_db
from app.models import User # Assuming User model for authentication/authorization
from app.crud import inventory as crud_inventory
from app.schemas import inventory_schemas as schemas
# from app.api.v1.dependencies import get_current_active_user_with_permissions # Example dependency

router = APIRouter()

# --- Inventory Item Endpoints ---

@router.post("/items/", response_model=schemas.InventoryItem, status_code=201)
async def create_inventory_item_api(
    item: schemas.InventoryItemCreate,
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_active_user_with_permissions(["inventory:create"])) # Example auth
):
    db_item = crud_inventory.get_inventory_item(db, sku=item.sku)
    if db_item:
        raise HTTPException(status_code=400, detail=f"Inventory item with SKU {item.sku} already exists.")
    return crud_inventory.create_inventory_item(db=db, item=item)

@router.get("/items/{sku}", response_model=schemas.InventoryItem)
async def read_inventory_item_api(
    sku: str,
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_active_user_with_permissions(["inventory:read"])) # Example auth
):
    db_item = crud_inventory.get_inventory_item(db, sku=sku)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return db_item

@router.get("/items/", response_model=List[schemas.InventoryItem])
async def read_inventory_items_api(
    skip: int = 0,
    limit: int = Query(default=100, le=200),
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_active_user_with_permissions(["inventory:read"])) # Example auth
):
    items = crud_inventory.get_inventory_items(db, skip=skip, limit=limit)
    return items

@router.put("/items/{sku}", response_model=schemas.InventoryItem)
async def update_inventory_item_api(
    sku: str,
    item_update: schemas.InventoryItemUpdate,
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_active_user_with_permissions(["inventory:update"])) # Example auth
):
    db_item = crud_inventory.update_inventory_item(db, sku=sku, item_update=item_update)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return db_item

@router.delete("/items/{sku}", response_model=schemas.InventoryItem)
async def delete_inventory_item_api(
    sku: str,
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_active_user_with_permissions(["inventory:delete"])) # Example auth
):
    # Consider business logic: should we prevent deletion if item is used in recipes?
    # For now, direct deletion is allowed by CRUD function.
    # If an item is part of a recipe, deleting it here could cause issues later.
    # A check could be added:
    # recipes_using_item = db.query(Recipe).filter(Recipe.ingredient_sku == sku).first()
    # if recipes_using_item:
    #     raise HTTPException(status_code=400, detail="Cannot delete item, it is used in existing recipes.")

    db_item = crud_inventory.delete_inventory_item(db, sku=sku)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return db_item # Returns the deleted item representation

@router.post("/items/{sku}/adjust-stock", response_model=schemas.StockAdjustmentResult)
async def adjust_stock_api(
    sku: str,
    adjustment: schemas.StockAdjustment = Body(...),
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_active_user_with_permissions(["inventory:adjust"])) # Example auth
):
    if adjustment.sku != sku:
        raise HTTPException(status_code=400, detail="SKU in path and body do not match.")

    updated_item, ledger_entry = crud_inventory.adjust_inventory_item_quantity(
        db,
        sku=adjustment.sku,
        change_qty_g=adjustment.change_qty_g,
        source=adjustment.reason or "manual_adjustment", # Use provided reason or default
        source_id=str(1) # Replace with actual current_user.id later
    )
    if not updated_item:
        raise HTTPException(status_code=404, detail=f"Inventory item with SKU {sku} not found.")

    return schemas.StockAdjustmentResult(
        sku=updated_item.sku,
        new_qty_g=updated_item.qty_g,
        message=f"Stock for {sku} adjusted by {ledger_entry.delta_g}. New quantity: {updated_item.qty_g}."
    )

# --- Inventory Ledger Endpoints ---

@router.get("/ledger/", response_model=List[schemas.InventoryLedgerEntry])
async def read_all_ledger_entries_api(
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_active_user_with_permissions(["inventory_ledger:read_all"])) # Example auth
):
    entries = crud_inventory.get_all_ledger_entries(db, skip=skip, limit=limit, start_date=start_date, end_date=end_date)
    return entries

@router.get("/ledger/{sku}", response_model=List[schemas.InventoryLedgerEntry])
async def read_ledger_entries_for_sku_api(
    sku: str,
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_active_user_with_permissions(["inventory_ledger:read_sku"])) # Example auth
):
    # Check if SKU exists
    item = crud_inventory.get_inventory_item(db, sku)
    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item with SKU {sku} not found.")

    entries = crud_inventory.get_ledger_entries_for_sku(db, sku=sku, skip=skip, limit=limit, start_date=start_date, end_date=end_date)
    return entries

# --- Inventory Status/Reporting Endpoints ---

@router.get("/status/summary", response_model=List[schemas.InventoryStatusResponse])
async def get_inventory_status_summary_api(
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_active_user_with_permissions(["inventory_status:read"])) # Example auth
):
    summary = crud_inventory.get_inventory_status_summary(db)
    return summary

@router.get("/status/low-stock", response_model=List[schemas.LowStockItem])
async def get_low_stock_items_api(
    threshold_percentage: float = Query(default=0.1, ge=0.01, le=1.0, description="Threshold percentage for low stock (e.g., 0.1 for 10%)"),
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_active_user_with_permissions(["inventory_status:read_low_stock"])) # Example auth
):
    try:
        low_stock_items = crud_inventory.get_low_stock_items(db, threshold_percentage=threshold_percentage)
        return low_stock_items
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Placeholder for authentication dependency - replace with actual implementation
# async def get_current_active_user_with_permissions(required_permissions: List[str]):
#     # This is a placeholder. Implement actual user authentication and permission checking.
#     # For example, using OAuth2PasswordBearer and a User model.
#     # from app.api.v1.dependencies import get_current_active_user
#     # current_user = Depends(get_current_active_user)
#     # if not all(permission in current_user.permissions for permission in required_permissions):
#     #     raise HTTPException(status_code=403, detail="Not enough permissions")
#     # return current_user
#     print(f"Auth check for permissions: {required_permissions}") # Placeholder log
#     pass # Allow all for now for easier testing without setting up full auth
