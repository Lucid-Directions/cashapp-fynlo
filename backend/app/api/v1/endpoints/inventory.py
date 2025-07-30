"""
API Endpoints for Inventory Management
"""
from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import base64
from uuid import UUID
from app.core.database import get_db
from app.core.database import User
from app.crud import inventory as crud_inventory
from app.schemas import inventory_schemas as schemas
from app.core.exceptions import ResourceNotFoundException, ValidationException
router = APIRouter()

@router.post('/items/', response_model=schemas.InventoryItem, status_code=201)
async def create_inventory_item_api(item: schemas.InventoryItemCreate, db: Session=Depends(get_db)):
    db_item = crud_inventory.get_inventory_item(db, sku=item.sku)
    if db_item:
        raise ValidationException(message='', code='BAD_REQUEST')
    return crud_inventory.create_inventory_item(db=db, item=item)

@router.get('/items/{sku}', response_model=schemas.InventoryItem)
async def read_inventory_item_api(sku: str, db: Session=Depends(get_db)):
    db_item = crud_inventory.get_inventory_item(db, sku=sku)
    if db_item is None:
        raise ResourceNotFoundException(message='Inventory item not found', code='NOT_FOUND', resource_type='item')
    return db_item

@router.get('/items/', response_model=List[schemas.InventoryItem])
async def read_inventory_items_api(skip: int=0, limit: int=Query(default=100, le=200), db: Session=Depends(get_db)):
    items = crud_inventory.get_inventory_items(db, skip=skip, limit=limit)
    return items

@router.put('/items/{sku}', response_model=schemas.InventoryItem)
async def update_inventory_item_api(sku: str, item_update: schemas.InventoryItemUpdate, db: Session=Depends(get_db)):
    db_item = crud_inventory.update_inventory_item(db, sku=sku, item_update=item_update)
    if db_item is None:
        raise ResourceNotFoundException(message='Inventory item not found', code='NOT_FOUND', resource_type='item')
    return db_item

@router.delete('/items/{sku}', response_model=schemas.InventoryItem)
async def delete_inventory_item_api(sku: str, db: Session=Depends(get_db)):
    db_item = crud_inventory.delete_inventory_item(db, sku=sku)
    if db_item is None:
        raise ResourceNotFoundException(message='Inventory item not found', code='NOT_FOUND', resource_type='item')
    return db_item

@router.post('/items/{sku}/adjust-stock', response_model=schemas.StockAdjustmentResult)
async def adjust_stock_api(sku: str, adjustment: schemas.StockAdjustment=Body(...), db: Session=Depends(get_db)):
    if adjustment.sku != sku:
        raise ValidationException(message='SKU in path and body do not match.', code='BAD_REQUEST')
    (updated_item, ledger_entry) = crud_inventory.adjust_inventory_item_quantity(db, sku=adjustment.sku, change_qty_g=adjustment.change_qty_g, source=adjustment.reason or 'manual_adjustment', source_id=str(1))
    if not updated_item:
        raise ResourceNotFoundException(message="Inventory item with SKU {sku} not found.", resource_type="Resource")
    return schemas.StockAdjustmentResult(sku=updated_item.sku, new_qty_g=updated_item.qty_g, message=f'Stock for {sku} adjusted by {ledger_entry.delta_g}. New quantity: {updated_item.qty_g}.')

@router.get('/ledger/', response_model=List[schemas.InventoryLedgerEntry])
async def read_all_ledger_entries_api(skip: int=0, limit: int=Query(default=100, le=500), start_date: Optional[datetime]=None, end_date: Optional[datetime]=None, db: Session=Depends(get_db)):
    entries = crud_inventory.get_all_ledger_entries(db, skip=skip, limit=limit, start_date=start_date, end_date=end_date)
    return entries

@router.get('/ledger/{sku}', response_model=List[schemas.InventoryLedgerEntry])
async def read_ledger_entries_for_sku_api(sku: str, skip: int=0, limit: int=Query(default=100, le=500), start_date: Optional[datetime]=None, end_date: Optional[datetime]=None, db: Session=Depends(get_db)):
    item = crud_inventory.get_inventory_item(db, sku)
    if not item:
        raise ResourceNotFoundException(message="Inventory item with SKU {sku} not found.", resource_type="Resource")
    entries = crud_inventory.get_ledger_entries_for_sku(db, sku=sku, skip=skip, limit=limit, start_date=start_date, end_date=end_date)
    return entries

@router.get('/status/summary', response_model=List[schemas.InventoryStatusResponse])
async def get_inventory_status_summary_api(db: Session=Depends(get_db)):
    summary = crud_inventory.get_inventory_status_summary(db)
    return summary

@router.get('/status/low-stock', response_model=List[schemas.LowStockItem])
async def get_low_stock_items_api(threshold_percentage: float=Query(default=0.1, ge=0.01, le=1.0, description='Threshold percentage for low stock (e.g., 0.1 for 10%)'), db: Session=Depends(get_db)):
    try:
        low_stock_items = crud_inventory.get_low_stock_items(db, threshold_percentage=threshold_percentage)
        return low_stock_items
    except ValueError as e:
        raise ValidationException(message='', code='BAD_REQUEST')

class ScanReceiptRequest(schemas.BaseModel):
    image_base64: str

class ScannedItemResponse(schemas.BaseModel):
    name: str
    quantity: float
    price: float
    sku_match: Optional[str] = None
    raw_text_name: Optional[str] = None
    raw_text_quantity: Optional[str] = None
    raw_text_price: Optional[str] = None

@router.post('/scan', response_model=List[ScannedItemResponse], status_code=200)
async def scan_receipt_api(scan_request: ScanReceiptRequest, db: Session=Depends(get_db)):
    """
    Accepts a base64 encoded image of a receipt, processes it (simulated for now),
    and returns a list of parsed items.
    """
    from app.services.ocr_service import OCRService
    ocr_service = OCRService()
    try:
        image_bytes = base64.b64decode(scan_request.image_base64)
        parsed_ocr_items = await ocr_service.parse_receipt_image(image_bytes)
    except Exception as e:
        raise ValidationException(message='', code='BAD_REQUEST')
    response_items: List[ScannedItemResponse] = []
    for ocr_item in parsed_ocr_items:
        sku_match_result = f"SKU_FOR_{ocr_item.get('raw_text_name', '').split(' ')[0]}" if ocr_item.get('raw_text_name') else None
        response_items.append(ScannedItemResponse(name=ocr_item.get('raw_text_name', 'Unknown Item'), quantity=ocr_item.get('parsed_quantity', 0.0) or 0.0, price=ocr_item.get('parsed_price', 0.0) or 0.0, sku_match=sku_match_result, raw_text_name=ocr_item.get('raw_text_name'), raw_text_quantity=ocr_item.get('raw_text_quantity'), raw_text_price=ocr_item.get('raw_text_price')))
    if not response_items:
        raise ValidationException(message="No items could be parsed from the receipt image. Please ensure the image is clear and contains readable text.")
    return response_items