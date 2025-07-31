"""
Service layer for advanced inventory operations, including recipe deductions.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Tuple
from uuid import UUID
from app.core.exceptions import InventoryException
import logging # For logging stock_overdrawn events

from app.models import Order as OrderModel, Recipe as RecipeModel, InventoryItem as InventoryItemModel, InventoryLedgerEntry as InventoryLedgerModel
from app.crud import inventory as crud_inventory
from app.core.websocket import WebSocketManager
# from app.services.audit_logger import AuditLoggerService # Assuming an audit logger service

logger = logging.getLogger(__name__)
# audit_logger = AuditLoggerService() # Initialize if you have a dedicated audit logger

async def apply_recipe_deductions_for_order(
    db: Session,
    order_id: UUID,
    websocket_manager: Optional[WebSocketManager] = None  # Optional: for real-time updates
) -> List[Tuple[InventoryItemModel, InventoryLedgerModel]]:
    """
    Applies recipe deductions for all items in a confirmed order.
    Logs stock_overdrawn events if an item's quantity drops to zero due to deduction.
    Emits WebSocket events for inventory updates.

    Args:
        db: The database session.
        order_id: The ID of the confirmed order.
        websocket_manager: Optional WebSocket connection manager for broadcasting updates.

    Returns:
        A list of tuples, each containing the updated InventoryItemModel and the created InventoryLedgerModel.
        Returns an empty list if the order is not found or has no processable items.

    Raises:
        FynloException for critical errors (e.g., if an item in order has no product entry).
    """
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        logger.warning(f"Order ID {order_id} not found for recipe deduction.")
        return []

    if order.status != "confirmed" and order.status != "completed": # Or whatever status indicates it's ready for deduction
        logger.info(f"Order ID {order_id} is not in a state for inventory deduction (status: {order.status}). Skipping.")
        return []

    updated_inventory_and_ledger_entries: List[Tuple[InventoryItemModel, InventoryLedgerModel]] = []

    # Order.items is expected to be a JSONB field like:
    # [{"product_id": "uuid", "quantity": 2, "price_at_sale": 10.99}, ...]
    # We need to ensure 'product_id' and 'quantity' are present.

    if not order.items or not isinstance(order.items, list):
        logger.warning(f"Order ID {order_id} has no items or items are malformed. Skipping deduction.")
        return []

    # Aggregate deductions per SKU to make fewer DB calls if an ingredient is in multiple recipes
    aggregated_deductions: Dict[str, int] = {} # sku: total_quantity_to_deduct

    for order_item_data in order.items:
        if not isinstance(order_item_data, dict) or "product_id" not in order_item_data or "quantity" not in order_item_data:
            logger.error(f"Malformed order item in order {order_id}: {order_item_data}. Skipping this item.")
            continue

        product_id_str = order_item_data.get("product_id")
        quantity_ordered = order_item_data.get("quantity")

        if not product_id_str or not isinstance(quantity_ordered, (int, float)) or quantity_ordered <= 0:
            logger.warning(f"Invalid product_id or quantity for item in order {order_id}. Skipping item.")
            continue

        try:
            product_id = UUID(product_id_str)
        except ValueError:
            logger.error(f"Invalid UUID format for product_id '{product_id_str}' in order {order_id}. Skipping item.")
            continue

        # Fetch the recipe for this product
        recipe_ingredients = db.query(RecipeModel).filter(RecipeModel.item_id == product_id).all()

        if not recipe_ingredients:
            # Product might not have a recipe, which is fine. Log for info if needed.
            # logger.info(f"Product ID {product_id} in order {order_id} has no recipe. No deductions for this item.")
            continue

        for recipe_ingredient in recipe_ingredients:
            total_deduction_for_ingredient = recipe_ingredient.qty_g * int(quantity_ordered)

            current_total = aggregated_deductions.get(recipe_ingredient.ingredient_sku, 0)
            aggregated_deductions[recipe_ingredient.ingredient_sku] = current_total + total_deduction_for_ingredient

    # Apply aggregated deductions
    skus_updated = []
    for sku, total_qty_to_deduct in aggregated_deductions.items():
        if total_qty_to_deduct == 0: # Should not happen if qty_g > 0 and quantity_ordered > 0
            continue

        inventory_item = db.query(InventoryItemModel).filter(InventoryItemModel.sku == sku).first()
        if not inventory_item:
            logger.error(f"Inventory item with SKU {sku} not found for recipe deduction in order {order_id}. Deduction skipped for this SKU.")
            continue

        original_qty = inventory_item.qty_g

        # Calculate actual change, ensuring quantity doesn't go below 0
        if inventory_item.qty_g - total_qty_to_deduct < 0:
            actual_deducted_amount = inventory_item.qty_g # Deduct only what's available
            inventory_item.qty_g = 0
            # Log stock_overdrawn event
            logger.warning(f"Stock overdrawn for SKU {sku} (Order ID: {order_id}). Original: {original_qty}, Requested: {total_qty_to_deduct}, Deducted: {actual_deducted_amount}, New Qty: 0.")
            # audit_logger.log_event(
            #     event_type="stock_overdrawn",
            #     details={
            #         "sku": sku,
            #         "order_id": str(order_id),
            #         "requested_deduction": total_qty_to_deduct,
            #         "actual_deduction": actual_deducted_amount,
            #         "original_quantity": original_qty
            #     },
            #     # Assuming user_id is available from order or a system user context
            #     user_id=str(order.created_by) if order.created_by else "system"
            # )
        else:
            actual_deducted_amount = total_qty_to_deduct
            inventory_item.qty_g -= total_qty_to_deduct

        inventory_item.last_updated = func.now()

        # Create ledger entry for the actual change
        # Note: delta_g is negative for deductions
        ledger_entry = InventoryLedgerModel(
            sku=sku,
            delta_g=-actual_deducted_amount,
            source="order_fulfillment",
            source_id=str(order_id)
        )
        db.add(ledger_entry)
        updated_inventory_and_ledger_entries.append((inventory_item, ledger_entry))
        skus_updated.append(sku)

    if updated_inventory_and_ledger_entries:
        try:
            db.commit()
            for item, ledger in updated_inventory_and_ledger_entries:
                db.refresh(item)
                db.refresh(ledger)

            # Emit WebSocket event for updated SKUs
            if websocket_manager and skus_updated:
                # Fetch the latest state of updated items for the payload
                updated_items_payload = []
                for sku_val in skus_updated:
                    item = crud_inventory.get_inventory_item(db, sku_val) # Re-fetch to get committed state
                    if item:
                         updated_items_payload.append({
                            "sku": item.sku,
                            "name": item.name,
                            "qty_g": item.qty_g,
                            "par_level_g": item.par_level_g,
                            "unit": item.unit,
                            "last_updated": item.last_updated.isoformat()
                        })
                if updated_items_payload:
                    # Consider rate limiting or batching if many items are updated frequently
                    await websocket_manager.broadcast_json({
                        "event": "inventory.updated",
                        "data": updated_items_payload
                    })
                    logger.info(f"Broadcasted inventory.updated event for {len(updated_items_payload)} items from order {order_id}.")

        except Exception as e:
            db.rollback()
            logger.error(f"Error committing recipe deductions for order {order_id}: {e}")
            # Potentially re-raise or handle more gracefully
            raise

    return updated_inventory_and_ledger_entries


# Example of how this service might be called (e.g., from an order processing endpoint or task)
# async def process_confirmed_order(order_id: UUID, db: Session, ws_manager: WebSocketManager):
#     try:
#         # ... other order confirmation logic ...
#         await apply_recipe_deductions_for_order(db, order_id, ws_manager)
#         # ...
#     except Exception as e:
#         logger.error(f"Failed to process confirmed order {order_id} for inventory: {e}")
#         # Handle error, perhaps mark order for retry or manual review
#         pass
