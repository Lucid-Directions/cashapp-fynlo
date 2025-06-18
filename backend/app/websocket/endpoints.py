"""
WebSocket endpoints for real-time communication in Fynlo POS
"""

from fastapi import WebSocket, WebSocketDisconnect, Depends, Query
from typing import Optional
import json
import logging

from app.websocket.manager import websocket_manager
from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db

logger = logging.getLogger(__name__)

async def websocket_endpoint(
    websocket: WebSocket,
    restaurant_id: str,
    connection_type: str = Query("pos"),  # pos, kitchen, management
    user_id: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for real-time communication
    
    Connection types:
    - pos: POS terminals for order and payment updates
    - kitchen: Kitchen displays for order preparation
    - management: Management dashboards for analytics
    """
    
    try:
        # Connect to WebSocket manager
        await websocket_manager.connect(
            websocket=websocket,
            restaurant_id=restaurant_id,
            connection_type=connection_type,
            user_id=user_id
        )
        
        logger.info(f"WebSocket connected: {connection_type} for restaurant {restaurant_id}")
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                await handle_websocket_message(
                    websocket=websocket,
                    restaurant_id=restaurant_id,
                    connection_type=connection_type,
                    message=message
                )
                
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected: {connection_type} for restaurant {restaurant_id}")
                break
            except json.JSONDecodeError:
                logger.error("Invalid JSON received from WebSocket client")
                await websocket_manager.send_personal_message(websocket, {
                    "type": "error",
                    "message": "Invalid JSON format"
                })
            except Exception as e:
                logger.error(f"WebSocket message handling error: {e}")
                await websocket_manager.send_personal_message(websocket, {
                    "type": "error",
                    "message": "Message handling failed"
                })
                
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        # Clean up connection
        websocket_manager.disconnect(websocket)

async def handle_websocket_message(
    websocket: WebSocket,
    restaurant_id: str,
    connection_type: str,
    message: dict
):
    """Handle incoming WebSocket messages"""
    
    message_type = message.get("type")
    
    if message_type == "ping":
        # Respond to ping for connection health check
        await websocket_manager.send_personal_message(websocket, {
            "type": "pong",
            "timestamp": message.get("timestamp")
        })
    
    elif message_type == "order_status_update":
        # Broadcast order status change
        await websocket_manager.broadcast_order_update(restaurant_id, {
            "order_id": message.get("order_id"),
            "status": message.get("status"),
            "action": "status_updated",
            "updated_by": message.get("user_id")
        })
    
    elif message_type == "kitchen_ready":
        # Kitchen indicating order is ready
        await websocket_manager.broadcast_to_restaurant(restaurant_id, {
            "type": "order_ready",
            "order_id": message.get("order_id"),
            "order_number": message.get("order_number"),
            "table_number": message.get("table_number")
        }, "pos")
    
    elif message_type == "payment_update":
        # Payment status update
        await websocket_manager.broadcast_payment_update(restaurant_id, {
            "payment_id": message.get("payment_id"),
            "order_id": message.get("order_id"),
            "status": message.get("status"),
            "amount": message.get("amount")
        })
    
    elif message_type == "subscribe":
        # Client subscribing to specific events
        await websocket_manager.send_personal_message(websocket, {
            "type": "subscription_confirmed",
            "events": message.get("events", []),
            "restaurant_id": restaurant_id
        })
    
    elif message_type == "get_connection_count":
        # Return current connection statistics
        count = websocket_manager.get_connection_count(restaurant_id, connection_type)
        total_count = websocket_manager.get_connection_count(restaurant_id)
        
        await websocket_manager.send_personal_message(websocket, {
            "type": "connection_count",
            "restaurant_id": restaurant_id,
            "connection_type": connection_type,
            "count": count,
            "total_connections": total_count
        })
    
    else:
        # Unknown message type
        await websocket_manager.send_personal_message(websocket, {
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        })

# Kitchen display specific endpoint
async def kitchen_websocket_endpoint(
    websocket: WebSocket,
    restaurant_id: str,
    kitchen_id: Optional[str] = Query(None)
):
    """Dedicated WebSocket endpoint for kitchen displays"""
    
    await websocket_endpoint(
        websocket=websocket,
        restaurant_id=restaurant_id,
        connection_type="kitchen",
        user_id=kitchen_id
    )

# POS terminal specific endpoint  
async def pos_websocket_endpoint(
    websocket: WebSocket,
    restaurant_id: str,
    terminal_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None)
):
    """Dedicated WebSocket endpoint for POS terminals"""
    
    await websocket_endpoint(
        websocket=websocket,
        restaurant_id=restaurant_id,
        connection_type="pos",
        user_id=user_id or terminal_id
    )

# Management dashboard specific endpoint
async def management_websocket_endpoint(
    websocket: WebSocket,
    restaurant_id: str,
    user_id: Optional[str] = Query(None)
):
    """Dedicated WebSocket endpoint for management dashboards"""
    
    await websocket_endpoint(
        websocket=websocket,
        restaurant_id=restaurant_id,
        connection_type="management",
        user_id=user_id
    )