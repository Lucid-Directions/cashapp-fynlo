"""
Real-time data synchronization service for Fynlo POS
Handles bidirectional sync between mobile app and portal
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
import json
import asyncio
from enum import Enum
import logging

from app.core.redis_client import get_redis, RedisClient
from app.core.websocket import websocket_manager, EventType, WebSocketMessage, ConnectionType
from app.core.database import get_db

logger = logging.getLogger(__name__)

class SyncEventType(Enum):
    """Types of sync events"""
    # Order events
    ORDER_CREATED = "order.created"
    ORDER_UPDATED = "order.updated"
    ORDER_STATUS_CHANGED = "order.status_changed"
    ORDER_CANCELLED = "order.cancelled"
    
    # Payment events
    PAYMENT_PROCESSED = "payment.processed"
    PAYMENT_REFUNDED = "payment.refunded"
    
    # Inventory events
    INVENTORY_UPDATED = "inventory.updated"
    INVENTORY_LOW_STOCK = "inventory.low_stock"
    INVENTORY_RESTOCK = "inventory.restock"
    
    # Staff events
    STAFF_CLOCKED_IN = "staff.clocked_in"
    STAFF_CLOCKED_OUT = "staff.clocked_out"
    STAFF_BREAK_START = "staff.break_start"
    STAFF_BREAK_END = "staff.break_end"
    
    # Menu events
    MENU_ITEM_ADDED = "menu.item_added"
    MENU_ITEM_UPDATED = "menu.item_updated"
    MENU_ITEM_REMOVED = "menu.item_removed"
    MENU_CATEGORY_CHANGED = "menu.category_changed"
    
    # Customer events
    CUSTOMER_CREATED = "customer.created"
    CUSTOMER_UPDATED = "customer.updated"
    CUSTOMER_ORDER_PLACED = "customer.order_placed"
    
    # Settings events
    SETTINGS_UPDATED = "settings.updated"
    BUSINESS_HOURS_CHANGED = "settings.business_hours"
    TAX_RATES_CHANGED = "settings.tax_rates"
    
    # System events
    SYSTEM_NOTIFICATION = "system.notification"
    SYSTEM_ALERT = "system.alert"
    CONNECTION_ESTABLISHED = "system.connection_established"
    CONNECTION_LOST = "system.connection_lost"

class SyncService:
    """Service for managing real-time data synchronization"""
    
    def __init__(self):
        self.redis_client: Optional[RedisClient] = None
        self._subscribers: Dict[str, List[asyncio.Task]] = {}
    
    async def initialize(self):
        """Initialize the sync service"""
        self.redis_client = await get_redis()
    
    async def emit_update(
        self, 
        event_type: SyncEventType, 
        restaurant_id: str,
        data: Dict[str, Any],
        user_id: Optional[str] = None,
        source: str = "backend"
    ):
        """
        Emit an update event to all connected clients
        
        Args:
            event_type: Type of sync event
            restaurant_id: Restaurant ID for scoping
            data: Event data payload
            user_id: Optional user ID who triggered the event
            source: Source of the event (backend, mobile, portal)
        """
        if not self.redis_client:
            await self.initialize()
        
        # Create event payload
        event_payload = {
            "event_type": event_type.value,
            "restaurant_id": restaurant_id,
            "user_id": user_id,
            "source": source,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Publish to Redis channel
        channel = f"restaurant:{restaurant_id}:sync"
        if self.redis_client:
            try:
                await self.redis_client.publish(channel, json.dumps(event_payload))
            except Exception as e:
                logger.error(f"Failed to publish to Redis channel {channel}: {str(e)}")
        
        # Also broadcast via WebSocket
        websocket_message = WebSocketMessage(
            event_type=self._map_to_websocket_event(event_type),
            data=event_payload,
            restaurant_id=restaurant_id,
            user_id=user_id
        )
        
        # Send to appropriate connection types based on event
        connection_types = self._get_target_connections(event_type)
        await websocket_manager.broadcast_to_restaurant(
            restaurant_id,
            websocket_message,
            connection_types=connection_types
        )
    
    async def subscribe_to_restaurant(
        self,
        restaurant_id: str,
        callback: callable,
        event_types: Optional[List[SyncEventType]] = None
    ) -> str:
        """
        Subscribe to sync events for a restaurant
        
        Args:
            restaurant_id: Restaurant to subscribe to
            callback: Async function to call when events occur
            event_types: Optional list of specific event types to subscribe to
        
        Returns:
            Subscription ID
        """
        if not self.redis_client:
            await self.initialize()
        
        channel = f"restaurant:{restaurant_id}:sync"
        
        async def message_handler(message):
            try:
                event_data = json.loads(message)
                event_type_str = event_data.get("event_type")
                
                # Filter by event types if specified
                if event_types:
                    event_type = SyncEventType(event_type_str)
                    if event_type not in event_types:
                        return
                
                # Call the callback
                await callback(event_data)
                
            except Exception as e:
                logger.error(f"Error handling sync message: {str(e)}")
        
        # Subscribe to Redis channel
        if not self.redis_client:
            logger.error("Redis client not available for subscription")
            return None
            
        try:
            subscription = await self.redis_client.subscribe(channel, message_handler)
            
            # Track subscription
            if restaurant_id not in self._subscribers:
                self._subscribers[restaurant_id] = []
            self._subscribers[restaurant_id].append(subscription)
            
            return f"sync_{restaurant_id}_{len(self._subscribers[restaurant_id])}"
        except Exception as e:
            logger.error(f"Failed to subscribe to Redis channel {channel}: {str(e)}")
            return None
    
    async def unsubscribe(self, subscription_id: str):
        """Unsubscribe from sync events"""
        # Implementation would track and cancel specific subscriptions
        pass
    
    # Helper methods for specific event types
    
    async def sync_order_created(self, restaurant_id: str, order_data: Dict[str, Any], user_id: str):
        """Sync new order creation"""
        await self.emit_update(
            event_type=SyncEventType.ORDER_CREATED,
            restaurant_id=restaurant_id,
            data=order_data,
            user_id=user_id,
            source="mobile"
        )
    
    async def sync_order_status(self, restaurant_id: str, order_id: str, new_status: str, user_id: str):
        """Sync order status change"""
        await self.emit_update(
            event_type=SyncEventType.ORDER_STATUS_CHANGED,
            restaurant_id=restaurant_id,
            data={
                "order_id": order_id,
                "new_status": new_status,
                "previous_status": None  # Would be fetched from current state
            },
            user_id=user_id
        )
    
    async def sync_payment_completed(self, restaurant_id: str, payment_data: Dict[str, Any], user_id: str):
        """Sync payment completion"""
        await self.emit_update(
            event_type=SyncEventType.PAYMENT_PROCESSED,
            restaurant_id=restaurant_id,
            data=payment_data,
            user_id=user_id
        )
    
    async def sync_inventory_update(self, restaurant_id: str, inventory_changes: Dict[str, Any], user_id: str):
        """Sync inventory changes"""
        await self.emit_update(
            event_type=SyncEventType.INVENTORY_UPDATED,
            restaurant_id=restaurant_id,
            data=inventory_changes,
            user_id=user_id
        )
    
    async def sync_menu_change(self, restaurant_id: str, menu_data: Dict[str, Any], change_type: str, user_id: str):
        """Sync menu changes"""
        event_map = {
            "add": SyncEventType.MENU_ITEM_ADDED,
            "update": SyncEventType.MENU_ITEM_UPDATED,
            "remove": SyncEventType.MENU_ITEM_REMOVED
        }
        
        await self.emit_update(
            event_type=event_map.get(change_type, SyncEventType.MENU_ITEM_UPDATED),
            restaurant_id=restaurant_id,
            data=menu_data,
            user_id=user_id,
            source="portal"
        )
    
    async def sync_staff_activity(self, restaurant_id: str, staff_id: str, activity: str, user_id: str):
        """Sync staff clock in/out activities"""
        event_map = {
            "clock_in": SyncEventType.STAFF_CLOCKED_IN,
            "clock_out": SyncEventType.STAFF_CLOCKED_OUT,
            "break_start": SyncEventType.STAFF_BREAK_START,
            "break_end": SyncEventType.STAFF_BREAK_END
        }
        
        await self.emit_update(
            event_type=event_map.get(activity, SyncEventType.STAFF_CLOCKED_IN),
            restaurant_id=restaurant_id,
            data={
                "staff_id": staff_id,
                "activity": activity,
                "timestamp": datetime.utcnow().isoformat()
            },
            user_id=user_id
        )
    
    async def sync_settings_change(self, restaurant_id: str, setting_type: str, changes: Dict[str, Any], user_id: str):
        """Sync settings changes"""
        event_map = {
            "business_hours": SyncEventType.BUSINESS_HOURS_CHANGED,
            "tax_rates": SyncEventType.TAX_RATES_CHANGED
        }
        
        await self.emit_update(
            event_type=event_map.get(setting_type, SyncEventType.SETTINGS_UPDATED),
            restaurant_id=restaurant_id,
            data={
                "setting_type": setting_type,
                "changes": changes
            },
            user_id=user_id,
            source="portal"
        )
    
    def _map_to_websocket_event(self, sync_event: SyncEventType) -> EventType:
        """Map sync event types to WebSocket event types"""
        mapping = {
            SyncEventType.ORDER_CREATED: EventType.ORDER_CREATED,
            SyncEventType.ORDER_STATUS_CHANGED: EventType.ORDER_STATUS_CHANGED,
            SyncEventType.PAYMENT_PROCESSED: EventType.PAYMENT_COMPLETED,
            SyncEventType.INVENTORY_UPDATED: EventType.INVENTORY_UPDATE,
            SyncEventType.STAFF_CLOCKED_IN: EventType.STAFF_UPDATE,
            SyncEventType.STAFF_CLOCKED_OUT: EventType.STAFF_UPDATE,
            SyncEventType.MENU_ITEM_UPDATED: EventType.MENU_UPDATE,
            SyncEventType.SYSTEM_NOTIFICATION: EventType.SYSTEM_NOTIFICATION
        }
        
        return mapping.get(sync_event, EventType.SYSTEM_NOTIFICATION)
    
    def _get_target_connections(self, event_type: SyncEventType) -> List[ConnectionType]:
        """Determine which connection types should receive the event"""
        # Orders and payments go to all
        if event_type in [
            SyncEventType.ORDER_CREATED,
            SyncEventType.ORDER_UPDATED,
            SyncEventType.ORDER_STATUS_CHANGED,
            SyncEventType.PAYMENT_PROCESSED
        ]:
            return [ConnectionType.POS, ConnectionType.KITCHEN, ConnectionType.MANAGEMENT]
        
        # Kitchen-specific events
        if event_type in [
            SyncEventType.ORDER_STATUS_CHANGED
        ]:
            return [ConnectionType.KITCHEN, ConnectionType.MANAGEMENT]
        
        # Management events
        if event_type in [
            SyncEventType.STAFF_CLOCKED_IN,
            SyncEventType.STAFF_CLOCKED_OUT,
            SyncEventType.INVENTORY_LOW_STOCK,
            SyncEventType.SETTINGS_UPDATED
        ]:
            return [ConnectionType.MANAGEMENT]
        
        # Default to all POS and management
        return [ConnectionType.POS, ConnectionType.MANAGEMENT]


# Global sync service instance
sync_service = SyncService()