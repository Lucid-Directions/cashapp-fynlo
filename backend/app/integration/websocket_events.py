"""
WebSocket Event Integration for Fynlo POS
Connects backend services with WebSocket notifications
"""


"""
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncio

from app.core.websocket import (
    websocket_manager,
    notify_order_created,
    notify_order_status_changed,
    notify_payment_completed,
    notify_inventory_low,
    notify_kitchen_update,
    notify_user_activity
)

class WebSocketEventService:
    """Service to integrate backend events with WebSocket notifications"""
    
    @staticmethod
    async def on_order_created(order_data: Dict[str, Any]):
        """Handle new order creation event"""
        try:
            await notify_order_created(
                order_id=str(order_data["id"]),
                restaurant_id=str(order_data["restaurant_id"]),
                order_data=order_data
            )
        except Exception as e:
            print(f"Failed to send order created notification: {str(e)}")
    
    @staticmethod
    async def on_order_status_changed(order_id: str, restaurant_id: str, old_status: str, new_status: str, order_data: Dict[str, Any]):
        """Handle order status change event"""
        try:
            await notify_order_status_changed(
                order_id=order_id,
                restaurant_id=restaurant_id,
                old_status=old_status,
                new_status=new_status,
                order_data=order_data
            )
        except Exception as e:
            print(f"Failed to send order status change notification: {str(e)}")
    
    @staticmethod
    async def on_payment_completed(payment_data: Dict[str, Any]):
        """Handle payment completion event"""
        try:
            await notify_payment_completed(
                payment_id=str(payment_data["id"]),
                order_id=str(payment_data["order_id"]),
                restaurant_id=str(payment_data["restaurant_id"]),
                payment_data=payment_data
            )
        except Exception as e:
            print(f"Failed to send payment completed notification: {str(e)}")
    
    @staticmethod
    async def on_inventory_low(product_id: str, restaurant_id: str, product_name: str, current_stock: int, min_stock: int):
        """Handle low inventory event"""
        try:
            await notify_inventory_low(
                product_id=product_id,
                restaurant_id=restaurant_id,
                product_name=product_name,
                current_stock=current_stock,
                min_stock=min_stock
            )
        except Exception as e:
            print(f"Failed to send inventory low notification: {str(e)}")
    
    @staticmethod
    async def on_kitchen_update(order_id: str, restaurant_id: str, update_type: str, update_data: Dict[str, Any]):
        """Handle kitchen update event"""
        try:
            await notify_kitchen_update(
                order_id=order_id,
                restaurant_id=restaurant_id,
                update_type=update_type,
                update_data=update_data
            )
        except Exception as e:
            print(f"Failed to send kitchen update notification: {str(e)}")
    
    @staticmethod
    async def on_user_login(user_id: str, restaurant_id: str, user_data: Dict[str, Any]):
        """Handle user login event"""
        try:
            await notify_user_activity(
                user_id=user_id,
                restaurant_id=restaurant_id,
                activity_type="login",
                activity_data=user_data
            )
        except Exception as e:
            print(f"Failed to send user login notification: {str(e)}")
    
    @staticmethod
    async def on_user_logout(user_id: str, restaurant_id: str, user_data: Dict[str, Any]):
        """Handle user logout event"""
        try:
            await notify_user_activity(
                user_id=user_id,
                restaurant_id=restaurant_id,
                activity_type="logout",
                activity_data=user_data
            )
        except Exception as e:
            print(f"Failed to send user logout notification: {str(e)}")

# Global event service instance
websocket_events = WebSocketEventService()

# Helper functions for easy integration
async def emit_order_created(order_data: Dict[str, Any]):
    """Emit order created event"""
    await websocket_events.on_order_created(order_data)

async def emit_order_status_changed(order_id: str, restaurant_id: str, old_status: str, new_status: str, order_data: Dict[str, Any]):
    """Emit order status changed event"""
    await websocket_events.on_order_status_changed(order_id, restaurant_id, old_status, new_status, order_data)

async def emit_payment_completed(payment_data: Dict[str, Any]):
    """Emit payment completed event"""
    await websocket_events.on_payment_completed(payment_data)

async def emit_inventory_low(product_id: str, restaurant_id: str, product_name: str, current_stock: int, min_stock: int):
    """Emit inventory low event"""
    await websocket_events.on_inventory_low(product_id, restaurant_id, product_name, current_stock, min_stock)

async def emit_kitchen_update(order_id: str, restaurant_id: str, update_type: str, update_data: Dict[str, Any]):
    """Emit kitchen update event"""
    await websocket_events.on_kitchen_update(order_id, restaurant_id, update_type, update_data)

async def emit_user_login(user_id: str, restaurant_id: str, user_data: Dict[str, Any]):
    """Emit user login event"""
    await websocket_events.on_user_login(user_id, restaurant_id, user_data)

async def emit_user_logout(user_id: str, restaurant_id: str, user_data: Dict[str, Any]):
    """Emit user logout event"""
    await websocket_events.on_user_logout(user_id, restaurant_id, user_data)