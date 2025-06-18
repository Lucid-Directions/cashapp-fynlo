"""
WebSocket manager for real-time updates in Fynlo POS
"""

import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        # Store connections by restaurant and connection type
        self.connections: Dict[str, Dict[str, Set[WebSocket]]] = {}
        # Store connection metadata
        self.connection_metadata: Dict[WebSocket, dict] = {}
    
    async def initialize(self):
        """Initialize WebSocket manager"""
        logger.info("WebSocket manager initialized")
    
    async def cleanup(self):
        """Cleanup on shutdown"""
        for restaurant_id in self.connections:
            for connection_type in self.connections[restaurant_id]:
                for websocket in self.connections[restaurant_id][connection_type].copy():
                    try:
                        await websocket.close()
                    except:
                        pass
        self.connections.clear()
        self.connection_metadata.clear()
    
    async def connect(self, websocket: WebSocket, restaurant_id: str, connection_type: str = "pos", user_id: str = None):
        """Connect a new WebSocket"""
        await websocket.accept()
        
        # Initialize restaurant connections if not exists
        if restaurant_id not in self.connections:
            self.connections[restaurant_id] = {}
        
        if connection_type not in self.connections[restaurant_id]:
            self.connections[restaurant_id][connection_type] = set()
        
        # Add connection
        self.connections[restaurant_id][connection_type].add(websocket)
        
        # Store metadata
        self.connection_metadata[websocket] = {
            "restaurant_id": restaurant_id,
            "connection_type": connection_type,
            "user_id": user_id,
            "connected_at": datetime.utcnow()
        }
        
        logger.info(f"WebSocket connected: {connection_type} for restaurant {restaurant_id}")
        
        # Send connection confirmation
        await self.send_personal_message(websocket, {
            "type": "connection_established",
            "message": f"Connected to {connection_type} for restaurant {restaurant_id}",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def disconnect(self, websocket: WebSocket):
        """Disconnect a WebSocket"""
        if websocket in self.connection_metadata:
            metadata = self.connection_metadata[websocket]
            restaurant_id = metadata["restaurant_id"]
            connection_type = metadata["connection_type"]
            
            # Remove from connections
            if (restaurant_id in self.connections and 
                connection_type in self.connections[restaurant_id]):
                self.connections[restaurant_id][connection_type].discard(websocket)
                
                # Clean up empty sets
                if not self.connections[restaurant_id][connection_type]:
                    del self.connections[restaurant_id][connection_type]
                
                if not self.connections[restaurant_id]:
                    del self.connections[restaurant_id]
            
            # Remove metadata
            del self.connection_metadata[websocket]
            
            logger.info(f"WebSocket disconnected: {connection_type} for restaurant {restaurant_id}")
    
    async def send_personal_message(self, websocket: WebSocket, message: dict):
        """Send message to specific WebSocket"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send message to WebSocket: {e}")
            self.disconnect(websocket)
    
    async def broadcast_to_restaurant(self, restaurant_id: str, message: dict, connection_type: str = None):
        """Broadcast message to all connections for a restaurant"""
        if restaurant_id not in self.connections:
            return
        
        message["timestamp"] = datetime.utcnow().isoformat()
        
        # If connection_type specified, send only to that type
        if connection_type:
            if connection_type in self.connections[restaurant_id]:
                await self._send_to_connections(
                    self.connections[restaurant_id][connection_type], 
                    message
                )
        else:
            # Send to all connection types
            for conn_type in self.connections[restaurant_id]:
                await self._send_to_connections(
                    self.connections[restaurant_id][conn_type], 
                    message
                )
    
    async def broadcast_order_update(self, restaurant_id: str, order_data: dict):
        """Broadcast order update to POS and kitchen displays"""
        message = {
            "type": "order_update",
            "order": order_data
        }
        
        # Send to POS systems
        await self.broadcast_to_restaurant(restaurant_id, message, "pos")
        
        # Send to kitchen displays
        await self.broadcast_to_restaurant(restaurant_id, message, "kitchen")
    
    async def broadcast_payment_update(self, restaurant_id: str, payment_data: dict):
        """Broadcast payment update"""
        message = {
            "type": "payment_update",
            "payment": payment_data
        }
        
        await self.broadcast_to_restaurant(restaurant_id, message, "pos")
    
    async def broadcast_menu_update(self, restaurant_id: str, menu_data: dict):
        """Broadcast menu update"""
        message = {
            "type": "menu_update",
            "menu": menu_data
        }
        
        await self.broadcast_to_restaurant(restaurant_id, message)
    
    async def broadcast_kitchen_update(self, restaurant_id: str, kitchen_data: dict):
        """Broadcast kitchen display update"""
        message = {
            "type": "kitchen_update",
            "data": kitchen_data
        }
        
        await self.broadcast_to_restaurant(restaurant_id, message, "kitchen")
    
    async def _send_to_connections(self, connections: Set[WebSocket], message: dict):
        """Send message to a set of connections"""
        if not connections:
            return
        
        # Send to all connections, remove failed ones
        failed_connections = []
        
        for websocket in connections.copy():
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send message: {e}")
                failed_connections.append(websocket)
        
        # Clean up failed connections
        for failed_ws in failed_connections:
            self.disconnect(failed_ws)
    
    def get_connection_count(self, restaurant_id: str, connection_type: str = None) -> int:
        """Get number of active connections"""
        if restaurant_id not in self.connections:
            return 0
        
        if connection_type:
            return len(self.connections[restaurant_id].get(connection_type, set()))
        else:
            return sum(
                len(connections) 
                for connections in self.connections[restaurant_id].values()
            )
    
    def get_all_connections_info(self) -> dict:
        """Get information about all connections"""
        info = {}
        for restaurant_id in self.connections:
            info[restaurant_id] = {}
            for connection_type in self.connections[restaurant_id]:
                info[restaurant_id][connection_type] = len(
                    self.connections[restaurant_id][connection_type]
                )
        return info

# Global WebSocket manager instance
websocket_manager = WebSocketManager()