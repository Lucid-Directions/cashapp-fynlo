"""
API Endpoints for Inventory Management
"""

from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import base64  # Added for base64 decoding
from uuid import UUID

from app.core.database import get_db
from app.core.exceptions import (
    AuthorizationException,
    ResourceNotFoundException,
    ValidationException,
)
from app.core.database import (
    User,
)  # Assuming User model for authentication/authorization
from app.crud import inventory as crud_inventory
from app.schemas import inventory_schemas as schemas
from app.core.dependencies import get_current_user
from app.core.tenant_security import TenantSecurity
from app.core.response_helper import APIResponseHelper
from app.core.exceptions import (
    ValidationException,
    AuthenticationException,
    FynloException,
    ResourceNotFoundException,
    ConflictException,
)

router = APIRouter()

# --- Inventory Item Endpoints ---


@router.post("/items/", response_model=schemas.InventoryItem, status_code=201)
async def create_inventory_item_api(
    item: schemas.InventoryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(
            message="User must be assigned to a restaurant", field="restaurant_id"
        )
    # Check if SKU already exists for this restaurant
    db_item = crud_inventory.get_inventory_item(
        db, sku=item.sku, restaurant_id=restaurant_id
    )
    if db_item:
        raise ValidationException(
            message=f"Inventory item with SKU {item.sku} already exists.", field="sku"
        )
    return crud_inventory.create_inventory_item(
        db=db, item=item, restaurant_id=restaurant_id
    )


@router.get("/items/{sku}", response_model=schemas.InventoryItem)
async def read_inventory_item_api(
    sku: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(
            message="User must be assigned to a restaurant", field="restaurant_id"
        )

    db_item = crud_inventory.get_inventory_item(
        db, sku=sku, restaurant_id=restaurant_id
    )
    if db_item is None:
        raise ResourceNotFoundException(resource="Inventory item", resource_id=sku)
    # Verify tenant access
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(db_item.restaurant_id),
        operation="access",
        resource_type="inventory",
        resource_id=sku,
        db=db,
    )

    return db_item


@router.get("/items/", response_model=List[schemas.InventoryItem])
async def read_inventory_items_api(
    skip: int = 0,
    limit: int = Query(default=100, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(
            message="User must be assigned to a restaurant", field="restaurant_id"
        )
    items = crud_inventory.get_inventory_items(
        db, restaurant_id=restaurant_id, skip=skip, limit=limit
    )
    return items


@router.put("/items/{sku}", response_model=schemas.InventoryItem)
async def update_inventory_item_api(
    sku: str,
    item_update: schemas.InventoryItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(
            message="User must be assigned to a restaurant", field="restaurant_id"
        )
    # Check if item exists and user has access
    db_item = crud_inventory.get_inventory_item(
        db, sku=sku, restaurant_id=restaurant_id
    )
    if not db_item:
        raise ResourceNotFoundException(resource="Inventory item", resource_id=sku)
    # Verify tenant access
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(db_item.restaurant_id),
        operation="modify",
        resource_type="inventory",
        resource_id=sku,
        db=db,
    )

    updated_item = crud_inventory.update_inventory_item(
        db, sku=sku, item_update=item_update, restaurant_id=restaurant_id
    )
    return updated_item


@router.delete("/items/{sku}", response_model=schemas.InventoryItem)
async def delete_inventory_item_api(
    sku: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(
            message="User must be assigned to a restaurant", field="restaurant_id"
        )
    # Check if item exists and user has access
    db_item = crud_inventory.get_inventory_item(
        db, sku=sku, restaurant_id=restaurant_id
    )
    if not db_item:
        raise ResourceNotFoundException(resource="Inventory item", resource_id=sku)
    # Verify tenant access - require owner/manager role for deletion
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(db_item.restaurant_id),
        operation="delete",
        resource_type="inventory",
        resource_id=sku,
        db=db,
    )

    # Check if item is used in recipes
    from app.models import Recipe

    recipes_using_item = db.query(Recipe).filter(Recipe.ingredient_sku == sku).first()
    if recipes_using_item:
        raise ValidationException(
            message="Cannot delete item, it is used in existing recipes.", field="sku"
        )
    deleted_item = crud_inventory.delete_inventory_item(
        db, sku=sku, restaurant_id=restaurant_id
    )
    return deleted_item


@router.post("/items/{sku}/adjust-stock", response_model=schemas.StockAdjustmentResult)
async def adjust_stock_api(
    sku: str,
    adjustment: schemas.StockAdjustment = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(
            message="User must be assigned to a restaurant", field="restaurant_id"
        )

    if adjustment.sku != sku:
        raise ValidationException(
            message="SKU in path and body do not match.", field="sku"
        )
    # Check if item exists and user has access
    db_item = crud_inventory.get_inventory_item(
        db, sku=sku, restaurant_id=restaurant_id
    )
    if not db_item:
        raise ResourceNotFoundException(resource="Inventory item", resource_id=sku)
    # Verify tenant access
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(db_item.restaurant_id),
        operation="modify",
        resource_type="inventory",
        resource_id=sku,
        db=db,
    )

    updated_item, ledger_entry = crud_inventory.adjust_inventory_item_quantity(
        db,
        sku=adjustment.sku,
        change_qty_g=adjustment.change_qty_g,
        source=adjustment.reason or "manual_adjustment",
        restaurant_id=restaurant_id,
        source_id=str(current_user.id),
    )
    if not updated_item:
        raise ResourceNotFoundException(resource="Inventory item", resource_id=sku)
    return schemas.StockAdjustmentResult(
        sku=updated_item.sku,
        new_qty_g=updated_item.qty_g,
        message=f"Stock for {sku} adjusted by {ledger_entry.delta_g}. New quantity: {updated_item.qty_g}.",
    )


# --- Inventory Ledger Endpoints ---


@router.get("/ledger/", response_model=List[schemas.InventoryLedgerEntry])
async def read_all_ledger_entries_api(
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(
            message="User must be assigned to a restaurant", field="restaurant_id"
        )
    entries = crud_inventory.get_all_ledger_entries(
        db,
        restaurant_id=restaurant_id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
    )
    return entries


@router.get("/ledger/{sku}", response_model=List[schemas.InventoryLedgerEntry])
async def read_ledger_entries_for_sku_api(
    sku: str,
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(
            message="User must be assigned to a restaurant", field="restaurant_id"
        )
    # Check if SKU exists and user has access
    item = crud_inventory.get_inventory_item(db, sku, restaurant_id=restaurant_id)
    if not item:
        raise ResourceNotFoundException(resource="Inventory item", resource_id=sku)
    # Verify tenant access
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(item.restaurant_id),
        operation="access",
        resource_type="inventory_ledger",
        resource_id=sku,
        db=db,
    )

    entries = crud_inventory.get_ledger_entries_for_sku(
        db,
        sku=sku,
        restaurant_id=restaurant_id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
    )
    return entries


# --- Inventory Status/Reporting Endpoints ---


@router.get("/status/summary", response_model=List[schemas.InventoryStatusResponse])
async def get_inventory_status_summary_api(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(
            message="User must be assigned to a restaurant", field="restaurant_id"
        )
    summary = crud_inventory.get_inventory_status_summary(
        db, restaurant_id=restaurant_id
    )
    return summary


@router.get("/status/low-stock", response_model=List[schemas.LowStockItem])
async def get_low_stock_items_api(
    threshold_percentage: float = Query(
        default=0.1,
        ge=0.01,
        le=1.0,
        description="Threshold percentage for low stock (e.g., 0.1 for 10%)",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(
            message="User must be assigned to a restaurant", field="restaurant_id"
        )
    try:
        low_stock_items = crud_inventory.get_low_stock_items(
            db, restaurant_id=restaurant_id, threshold_percentage=threshold_percentage
        )
        return low_stock_items
    except ValueError as e:
        raise ValidationException(message=str(e))


# Placeholder for authentication dependency - replace with actual implementation
# async def get_current_active_user_with_permissions(required_permissions: List[str]):
#     # This is a placeholder. Implement actual user authentication and permission checking.
#     # For example, using OAuth2PasswordBearer and a User model.
#     # from app.api.v1.dependencies import get_current_active_user
#     # current_user = Depends(get_current_active_user)
#     # if not all(permission in current_user.permissions for permission in required_permissions):
#     #     raise AuthenticationException(message="Not enough permissions", error_code="ACCESS_DENIED")#     # return current_user
#     logger.info(f"Auth check for permissions: {required_permissions}") # Placeholder log
#     pass # Allow all for now for easier testing without setting up full auth

# --- Receipt Scanning Endpoint ---


class ScanReceiptRequest(
    schemas.BaseModel
):  # Use a base model from schemas if available, or pydantic.BaseModel
    image_base64: str


class ScannedItemResponse(schemas.BaseModel):  # Use a base model from schemas
    name: str
    quantity: float
    price: float
    sku_match: Optional[str] = None
    raw_text_name: Optional[str] = None  # To show what was parsed vs matched
    raw_text_quantity: Optional[str] = None
    raw_text_price: Optional[str] = None


@router.post("/scan", response_model=List[ScannedItemResponse], status_code=200)
async def scan_receipt_api(
    scan_request: ScanReceiptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accepts a base64 encoded image of a receipt, processes it (simulated for now),
    and returns a list of parsed items.
    """
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(
            message="User must be assigned to a restaurant", field="restaurant_id"
        )
    # Verify user has permission to scan inventory
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(restaurant_id),
        operation="create",
        resource_type="inventory_scan",
        resource_id=None,
        db=db,
    )

    # Integration with OCRService
    from app.services.ocr_service import OCRService

    ocr_service = OCRService()

    try:
        image_bytes = base64.b64decode(scan_request.image_base64)
        # Parse items from OCR service
        parsed_ocr_items = await ocr_service.parse_receipt_image(image_bytes)
    except Exception as e:
        # Handle base64 decoding errors or other issues
        raise ValidationException(
            message=f"Invalid image data or OCR processing error: {str(e)}"
        )
    # Convert OCR service output to ScannedItemResponse
    # This is where fuzzy matching against DB products would also happen.
    response_items: List[ScannedItemResponse] = []
    for ocr_item in parsed_ocr_items:
        # Simulate fuzzy matching or direct use if OCR provides SKU
        # sku_match_result = await fuzzy_match_item_name_to_sku(ocr_item.get("raw_text_name"), db)
        sku_match_result = (
            f"SKU_FOR_{ocr_item.get('raw_text_name', '').split(' ')[0]}"
            if ocr_item.get("raw_text_name")
            else None
        )

        response_items.append(
            ScannedItemResponse(
                name=ocr_item.get(
                    "raw_text_name", "Unknown Item"
                ),  # Prefer matched name if available later
                quantity=ocr_item.get("parsed_quantity", 0.0) or 0.0,
                price=ocr_item.get("parsed_price", 0.0) or 0.0,
                sku_match=sku_match_result,  # Placeholder
                raw_text_name=ocr_item.get("raw_text_name"),
                raw_text_quantity=ocr_item.get("raw_text_quantity"),
                raw_text_price=ocr_item.get("raw_text_price"),
            )
        )

    # Return empty list if no items were parsed
    if not response_items:
        raise FynloException(
            message="No items could be parsed from the receipt image. Please ensure the image is clear and contains readable text.",
            status_code=422,
        )
    return response_items
