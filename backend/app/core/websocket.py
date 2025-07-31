"""
WebSocket Manager for Fynlo POS
Real-time communication for orders, payments, kitchen updates, and notifications
"""

from typing import Dict, List, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect
import json
from datetime import datetime
import uuid
from enum import Enum

from app.core.exceptions import FynloException, ErrorCodes
from app.core.responses import APIResponseHelper

class EventType(str, Enum):
    """WebSocket event types"""
    ORDER_CREATED = "order_created"
    ORDER_STATUS_CHANGED = "order_status_changed"
    PAYMENT_COMPLETED = "payment_completed"
    PAYMENT_FAILED = "payment_failed"
    INVENTORY_LOW = "inventory_low"
    INVENTORY_OUT = "inventory_out"
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    KITCHEN_UPDATE = "kitchen_update"
    TABLE_STATUS_CHANGED = "table_status_changed"
    RESTAURANT_STATUS = "restaurant_status"
    SYSTEM_NOTIFICATION = "system_notification"

class ConnectionType(str, Enum):
    """WebSocket connection types"""
    POS = "pos"
    KITCHEN = "kitchen"
    MANAGEMENT = "management"
    CUSTOMER = "customer"
    PLATFORM = "platform"

class WebSocketMessage:
    """WebSocket message structure"""
    def __init__(
        self,
        event_type: EventType,
        data: Dict[str, Any],
        restaurant_id: str,
        user_id: Optional[str] = None,
        connection_types: List[ConnectionType] = None
    ):
        self.id = str(uuid.uuid4())
        self.event_type = event_type
        self.data = data
        self.restaurant_id = restaurant_id
        self.user_id = user_id
        self.connection_types = connection_types or [ConnectionType.POS]
        self.timestamp = datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Execute to_dict operation."""
        return {
            "id": self.id,
            "event_type": self.event_type.value,
            "data": self.data,
            "restaurant_id": self.restaurant_id,
            "user_id": self.user_id,
            "timestamp": self.timestamp
        }

class WebSocketConnection:
    """WebSocket connection info"""
    def __init__(
        self,
        websocket: WebSocket,
        connection_id: str,
        restaurant_id: str,
        user_id: Optional[str] = None,
        connection_type: ConnectionType = ConnectionType.POS,
        roles: List[str] = None
    ):
        self.websocket = websocket
        self.connection_id = connection_id
        self.restaurant_id = restaurant_id
        self.user_id = user_id
        self.connection_type = connection_type
        self.roles = roles or []
        self.connected_at = datetime.now()
        self.last_ping = datetime.now()
        self.is_active = True

class WebSocketManager:
    """WebSocket connection manager"""
    
    def __init__(self):
        # Store active connections: {connection_id: WebSocketConnection}
        self.active_connections: Dict[str, WebSocketConnection] = {}
        
        # Store connections by restaurant: {restaurant_id: List[connection_id]}
        self.restaurant_connections: Dict[str, List[str]] = {}
        
        # Store connections by user: {user_id: List[connection_id]}
        self.user_connections: Dict[str, List[str]] = {}
        
        # Store connections by type: {connection_type: List[connection_id]}
        self.type_connections: Dict[str, List[str]] = {}
        
        # Message queue for offline connections
        self.message_queue: Dict[str, List[WebSocketMessage]] = {}
        
        # Connection statistics
        self.stats = {
            "total_connections": 0,
            "active_connections": 0,
            "messages_sent": 0,
            "messages_failed": 0
        }
    
    async def connect(
        self,
        websocket: WebSocket,
        restaurant_id: str,
        user_id: Optional[str] = None,
        connection_type: ConnectionType = ConnectionType.POS,
        roles: List[str] = None
    ) -> str:
        """Accept new WebSocket connection"""
        try:
            await websocket.accept()
            
            connection_id = str(uuid.uuid4())
            connection = WebSocketConnection(
                websocket=websocket,
                connection_id=connection_id,
                restaurant_id=restaurant_id,
                user_id=user_id,
                connection_type=connection_type,
                roles=roles or []
            )
            
            # Store connection
            self.active_connections[connection_id] = connection
            
            # Index by restaurant
            if restaurant_id not in self.restaurant_connections:
                self.restaurant_connections[restaurant_id] = []
            self.restaurant_connections[restaurant_id].append(connection_id)
            
            # Index by user
            if user_id:
                if user_id not in self.user_connections:
                    self.user_connections[user_id] = []
                self.user_connections[user_id].append(connection_id)
            
            # Index by type
            type_key = connection_type.value
            if type_key not in self.type_connections:
                self.type_connections[type_key] = []
            self.type_connections[type_key].append(connection_id)
            
            # Update stats
            self.stats["total_connections"] += 1
            self.stats["active_connections"] = len(self.active_connections)
            
            # Send connection confirmation
            await self.send_to_connection(
                connection_id,
                WebSocketMessage(
                    event_type=EventType.SYSTEM_NOTIFICATION,
                    data={
                        "type": "connection_established",
                        "connection_id": connection_id,
                        "message": "WebSocket connection established successfully"
                    },
                    restaurant_id=restaurant_id,
                    user_id=user_id
                )
            )
            
            # Send queued messages if any
            await self._send_queued_messages(user_id, restaurant_id)
            
            return connection_id
            
        except Exception as e:
            raise FynloException(
                message=f"Failed to establish WebSocket connection: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
    
    async def disconnect(self, connection_id: str):
        """Disconnect WebSocket connection"""
        try:
            if connection_id not in self.active_connections:
                return
            
            connection = self.active_connections[connection_id]
            
            # Remove from restaurant index
            if connection.restaurant_id in self.restaurant_connections:
                if connection_id in self.restaurant_connections[connection.restaurant_id]:
                    self.restaurant_connections[connection.restaurant_id].remove(connection_id)
                    if not self.restaurant_connections[connection.restaurant_id]:
                        del self.restaurant_connections[connection.restaurant_id]
            
            # Remove from user index
            if connection.user_id and connection.user_id in self.user_connections:
                if connection_id in self.user_connections[connection.user_id]:
                    self.user_connections[connection.user_id].remove(connection_id)
                    if not self.user_connections[connection.user_id]:
                        del self.user_connections[connection.user_id]
            
            # Remove from type index
            type_key = connection.connection_type.value
            if type_key in self.type_connections:
                if connection_id in self.type_connections[type_key]:
                    self.type_connections[type_key].remove(connection_id)
                    if not self.type_connections[type_key]:
                        del self.type_connections[type_key]
            
            # Remove from active connections
            del self.active_connections[connection_id]
            
            # Update stats
            self.stats["active_connections"] = len(self.active_connections)
            
        except Exception as e:
            # Log error but don't raise to prevent cascade failures
            logger.error(f"Error disconnecting WebSocket {connection_id}: {str(e)}")
    
    async def send_to_connection(self, connection_id: str, message: WebSocketMessage):
        """Send message to specific connection"""
        try:
            if connection_id not in self.active_connections:
                return False
            
            connection = self.active_connections[connection_id]
            
            if not connection.is_active:
                return False
            
            message_data = message.to_dict()
            await connection.websocket.send_text(json.dumps(message_data))
            
            self.stats["messages_sent"] += 1
            return True
            
        except WebSocketDisconnect:
            await self.disconnect(connection_id)
            return False
        except Exception as e:
            self.stats["messages_failed"] += 1
            logger.error(f"Failed to send message to connection {connection_id}: {str(e)}")
            return False
    
    async def send_to_restaurant(self, restaurant_id: str, message: WebSocketMessage):
        """Send message to all connections in a restaurant"""
        if restaurant_id not in self.restaurant_connections:
            return
        
        connection_ids = self.restaurant_connections[restaurant_id].copy()
        
        for connection_id in connection_ids:
            await self.send_to_connection(connection_id, message)
    
    async def send_to_user(self, user_id: str, message: WebSocketMessage):
        """Send message to all user connections"""
        if user_id not in self.user_connections:
            # Queue message for when user connects
            self._queue_message(user_id, message)
            return
        
        connection_ids = self.user_connections[user_id].copy()
        
        for connection_id in connection_ids:
            await self.send_to_connection(connection_id, message)
    
    async def send_to_connection_type(self, connection_type: ConnectionType, message: WebSocketMessage):
        """Send message to all connections of specific type"""
        type_key = connection_type.value
        
        if type_key not in self.type_connections:
            return
        
        connection_ids = self.type_connections[type_key].copy()
        
        for connection_id in connection_ids:
            connection = self.active_connections.get(connection_id)
            if connection and connection.restaurant_id == message.restaurant_id:
                await self.send_to_connection(connection_id, message)
    
    async def broadcast_to_restaurant(
        self,
        restaurant_id: str,
        message: WebSocketMessage,
        connection_types: List[ConnectionType] = None,
        exclude_user_id: Optional[str] = None
    ):
        """Broadcast message to restaurant with filtering"""
        if restaurant_id not in self.restaurant_connections:
            return
        
        connection_ids = self.restaurant_connections[restaurant_id].copy()
        
        for connection_id in connection_ids:
            connection = self.active_connections.get(connection_id)
            if not connection:
                continue
            
            # Filter by connection type
            if connection_types and connection.connection_type not in connection_types:
                continue
            
            # Exclude specific user
            if exclude_user_id and connection.user_id == exclude_user_id:
                continue
            
            await self.send_to_connection(connection_id, message)
    
    def _queue_message(self, user_id: str, message: WebSocketMessage):
        """Queue message for offline user"""
        if user_id not in self.message_queue:
            self.message_queue[user_id] = []
        
        self.message_queue[user_id].append(message)
        
        # Limit queue size to prevent memory issues
        if len(self.message_queue[user_id]) > 100:
            self.message_queue[user_id] = self.message_queue[user_id][-100:]
    
    async def _send_queued_messages(self, user_id: Optional[str], restaurant_id: str):
        """Send queued messages to newly connected user"""
        if not user_id or user_id not in self.message_queue:
            return
        
        queued_messages = self.message_queue[user_id].copy()
        del self.message_queue[user_id]
        
        for message in queued_messages:
            # Only send messages for the current restaurant
            if message.restaurant_id == restaurant_id:
                await self.send_to_user(user_id, message)
    
    async def ping_connections(self):
        """Send ping to all connections to check health"""
        current_time = datetime.now()
        disconnected_connections = []
        
        for connection_id, connection in self.active_connections.items():
            try:
                # Send ping
                ping_message = {
                    "type": "ping",
                    "timestamp": current_time.isoformat()
                }
                await connection.websocket.send_text(json.dumps(ping_message))
                connection.last_ping = current_time
                
            except WebSocketDisconnect:
                disconnected_connections.append(connection_id)
            except Exception:
                disconnected_connections.append(connection_id)
        
        # Clean up disconnected connections
        for connection_id in disconnected_connections:
            await self.disconnect(connection_id)
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        return {
            **self.stats,
            "connections_by_restaurant": {
                restaurant_id: len(connections)
                for restaurant_id, connections in self.restaurant_connections.items()
            },
            "connections_by_type": {
                conn_type: len(connections)
                for conn_type, connections in self.type_connections.items()
            },
            "queued_messages": sum(len(messages) for messages in self.message_queue.values())
        }

# Global WebSocket manager instance
websocket_manager = WebSocketManager()

# Event helper functions
async def notify_order_created(order_id: str, restaurant_id: str, order_data: Dict[str, Any]):
    """Notify all connections about new order"""
    message = WebSocketMessage(
        event_type=EventType.ORDER_CREATED,
        data={
            "order_id": order_id,
            "order_number": order_data.get("order_number"),
            "total_amount": order_data.get("total_amount"),
            "items_count": len(order_data.get("items", [])),
            "table_number": order_data.get("table_number"),
            "customer_name": order_data.get("customer_name"),
            "order_type": order_data.get("order_type", "dine_in")
        },
        restaurant_id=restaurant_id,
        connection_types=[ConnectionType.POS, ConnectionType.KITCHEN, ConnectionType.MANAGEMENT]
    )
    
    await websocket_manager.broadcast_to_restaurant(
        restaurant_id,
        message,
        connection_types=[ConnectionType.POS, ConnectionType.KITCHEN, ConnectionType.MANAGEMENT]
    )

async def notify_order_status_changed(order_id: str, restaurant_id: str, old_status: str, new_status: str, order_data: Dict[str, Any]):
    """Notify about order status change"""
    message = WebSocketMessage(
        event_type=EventType.ORDER_STATUS_CHANGED,
        data={
            "order_id": order_id,
            "order_number": order_data.get("order_number"),
            "old_status": old_status,
            "new_status": new_status,
            "total_amount": order_data.get("total_amount"),
            "table_number": order_data.get("table_number"),
            "updated_at": datetime.now().isoformat()
        },
        restaurant_id=restaurant_id,
        connection_types=[ConnectionType.POS, ConnectionType.KITCHEN, ConnectionType.MANAGEMENT]
    )
    
    await websocket_manager.broadcast_to_restaurant(restaurant_id, message)

async def notify_payment_completed(payment_id: str, order_id: str, restaurant_id: str, payment_data: Dict[str, Any]):
    """Notify about successful payment"""
    message = WebSocketMessage(
        event_type=EventType.PAYMENT_COMPLETED,
        data={
            "payment_id": payment_id,
            "order_id": order_id,
            "order_number": payment_data.get("order_number"),
            "amount": payment_data.get("amount"),
            "payment_method": payment_data.get("payment_method"),
            "transaction_id": payment_data.get("transaction_id"),
            "completed_at": datetime.now().isoformat()
        },
        restaurant_id=restaurant_id,
        connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT]
    )
    
    await websocket_manager.broadcast_to_restaurant(
        restaurant_id,
        message,
        connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT]
    )

async def notify_inventory_low(product_id: str, restaurant_id: str, product_name: str, current_stock: int, min_stock: int):
    """Notify about low inventory"""
    message = WebSocketMessage(
        event_type=EventType.INVENTORY_LOW,
        data={
            "product_id": product_id,
            "product_name": product_name,
            "current_stock": current_stock,
            "minimum_stock": min_stock,
            "severity": "warning" if current_stock > 0 else "critical",
            "message": f"{product_name} is running low (only {current_stock} left)"
        },
        restaurant_id=restaurant_id,
        connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT]
    )
    
    await websocket_manager.broadcast_to_restaurant(
        restaurant_id,
        message,
        connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT]
    )

async def notify_kitchen_update(order_id: str, restaurant_id: str, update_type: str, update_data: Dict[str, Any]):
    """Notify kitchen about order updates"""
    message = WebSocketMessage(
        event_type=EventType.KITCHEN_UPDATE,
        data={
            "order_id": order_id,
            "order_number": update_data.get("order_number"),
            "update_type": update_type,  # "item_ready", "order_ready", "special_request"
            "item_id": update_data.get("item_id"),
            "item_name": update_data.get("item_name"),
            "special_instructions": update_data.get("special_instructions"),
            "estimated_time": update_data.get("estimated_time"),
            "updated_at": datetime.now().isoformat()
        },
        restaurant_id=restaurant_id,
        connection_types=[ConnectionType.KITCHEN, ConnectionType.POS]
    )
    
    await websocket_manager.broadcast_to_restaurant(
        restaurant_id,
        message,
        connection_types=[ConnectionType.KITCHEN, ConnectionType.POS]
    )

async def notify_user_activity(user_id: str, restaurant_id: str, activity_type: str, activity_data: Dict[str, Any]):
    """Notify about user login/logout"""
    event_type = EventType.USER_LOGIN if activity_type == "login" else EventType.USER_LOGOUT
    
    message = WebSocketMessage(
        event_type=event_type,
        data={
            "user_id": user_id,
            "username": activity_data.get("username"),
            "role": activity_data.get("role"),
            "activity_type": activity_type,
            "timestamp": datetime.now().isoformat()
        },
        restaurant_id=restaurant_id,
        user_id=user_id,
        connection_types=[ConnectionType.MANAGEMENT]
    )
    
    await websocket_manager.broadcast_to_restaurant(
        restaurant_id,
        message,
        connection_types=[ConnectionType.MANAGEMENT],
        exclude_user_id=user_id
    )

    async def broadcast_order_update(self, restaurant_id: str, order_data: Dict[str, Any]):
        """Broadcast order update to all relevant connections"""
        action = order_data.get("action", "updated")
        
        if action == "created":
            await notify_order_created(
                order_id=order_data["id"],
                restaurant_id=restaurant_id,
                order_data=order_data
            )
        else:
            message = WebSocketMessage(
                event_type=EventType.ORDER_STATUS_CHANGED,
                data={
                    "order_id": order_data["id"],
                    "order_number": order_data.get("order_number"),
                    "status": order_data.get("status"),
                    "action": action,
                    "total_amount": order_data.get("total_amount"),
                    "table_number": order_data.get("table_number"),
                    "items": order_data.get("items"),
                    "reason": order_data.get("reason"),
                    "updated_at": datetime.now().isoformat()
                },
                restaurant_id=restaurant_id,
                connection_types=[ConnectionType.POS, ConnectionType.KITCHEN, ConnectionType.MANAGEMENT]
            )
            
            await self.broadcast_to_restaurant(
                restaurant_id,
                message,
                connection_types=[ConnectionType.POS, ConnectionType.KITCHEN, ConnectionType.MANAGEMENT]
            )
    
    async def broadcast_kitchen_update(self, restaurant_id: str, kitchen_data: Dict[str, Any]):
        """Broadcast kitchen update to kitchen displays and POS"""
        message = WebSocketMessage(
            event_type=EventType.KITCHEN_UPDATE,
            data={
                "order_id": kitchen_data.get("order_id"),
                "order_number": kitchen_data.get("order_number"),
                "status": kitchen_data.get("status"),
                "action": kitchen_data.get("action", "new_order"),
                "items": kitchen_data.get("items"),
                "table_number": kitchen_data.get("table_number"),
                "special_instructions": kitchen_data.get("special_instructions"),
                "updated_at": datetime.now().isoformat()
            },
            restaurant_id=restaurant_id,
            connection_types=[ConnectionType.KITCHEN, ConnectionType.POS]
        )
        
        await self.broadcast_to_restaurant(
            restaurant_id,
            message,
            connection_types=[ConnectionType.KITCHEN, ConnectionType.POS]
        )

# Global WebSocket manager instance
websocket_manager = WebSocketManager()

# Utility functions  
def get_websocket_manager() -> WebSocketManager:
    """Get the global WebSocket manager instance"""
    return websocket_manager