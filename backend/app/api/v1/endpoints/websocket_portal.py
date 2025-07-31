"""
WebSocket endpoints for Fynlo Portal - Real-time updates for web dashboard
"""

from typing import 
from pydantic import 
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, Path
from sqlalchemy.orm import Session
import json
from datetime import datetime

from app.core.database import get_db, User, Restaurant
from app.core.websocket import (
    websocket_manager, 
    ConnectionType, 
    EventType,
    WebSocketMessage
)

router = APIRouter()

@router.websocket("/ws/portal/{restaurant_id}")
async def websocket_portal_endpoint(
    websocket: WebSocket,
    restaurant_id: str = Path(..., description="Restaurant ID"),
    user_id: str = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Portal-specific WebSocket endpoint for web dashboard real-time updates
    """
    connection_id = None
    
    try:
        # Verify user and restaurant access
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=4003, reason="User not found")
            return
        
        # Check restaurant access
        if user.role == "restaurant_owner" and str(user.restaurant_id) != restaurant_id:
            await websocket.close(code=4003, reason="Access denied to this restaurant")
            return
        
        # Connect with portal-specific type
        connection_id = await websocket_manager.connect(
            websocket=websocket,
            restaurant_id=restaurant_id,
            user_id=user_id,
            connection_type=ConnectionType.MANAGEMENT,  # Use management type for portal
            roles=[user.role]
        )
        
        # Send initial connection confirmation
        welcome_message = {
            "type": "connection_established",
            "data": {
                "connection_id": connection_id,
                "restaurant_id": restaurant_id,
                "user_role": user.role,
                "timestamp": datetime.utcnow().isoformat(),
                "features": [
                    "real_time_orders",
                    "inventory_updates",
                    "staff_activity",
                    "payment_notifications",
                    "system_alerts"
                ]
            }
        }
        
        await websocket.send_text(json.dumps(welcome_message))
        
        # Handle incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                message_type = message_data.get("type")
                
                if message_type == "ping":
                    # Respond to keep-alive pings
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    }))
                    
                elif message_type == "subscribe":
                    # Subscribe to specific event types
                    events = message_data.get("events", [])
                    await websocket.send_text(json.dumps({
                        "type": "subscription_confirmed",
                        "events": events,
                        "timestamp": datetime.utcnow().isoformat()
                    }))
                    
                elif message_type == "request_update":
                    # Handle real-time data requests
                    update_type = message_data.get("update_type")
                    await handle_portal_update_request(
                        websocket, connection_id, restaurant_id, update_type, db
                    )
                    
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Message processing error: {str(e)}"
                }))
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.close(code=4000, reason=f"Connection error: {str(e)}")
        except Exception as e:
            pass
    finally:
        if connection_id:
            await websocket_manager.disconnect(connection_id)


@router.websocket("/ws/platform")
async def websocket_platform_endpoint(
    websocket: WebSocket,
    user_id: str = Query(..., description="Platform owner user ID"),
    db: Session = Depends(get_db)
):
    """
    Platform owner WebSocket endpoint for monitoring all restaurants
    """
    connection_id = None
    
    try:
        # Verify platform owner
        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.role != "platform_owner":
            await websocket.close(code=4003, reason="Platform owner access required")
            return
        
        # Connect without specific restaurant (platform-wide)
        connection_id = await websocket_manager.connect(
            websocket=websocket,
            restaurant_id=None,  # No specific restaurant for platform owner
            user_id=user_id,
            connection_type=ConnectionType.MANAGEMENT,
            roles=["platform_owner"]
        )
        
        # Send platform overview
        welcome_message = {
            "type": "platform_connection_established",
            "data": {
                "connection_id": connection_id,
                "user_role": "platform_owner",
                "timestamp": datetime.utcnow().isoformat(),
                "features": [
                    "all_restaurants_overview",
                    "platform_analytics",
                    "system_health",
                    "revenue_tracking",
                    "restaurant_alerts"
                ]
            }
        }
        
        await websocket.send_text(json.dumps(welcome_message))
        
        # Get initial restaurant list
        restaurants = db.query(Restaurant).filter(Restaurant.is_active == True).all()
        restaurant_data = [
            {
                "id": str(r.id),
                "name": r.name,
                "status": "online" if websocket_manager.has_active_connections(str(r.id)) else "offline",
                "subscription_plan": getattr(r, 'subscription_plan', 'alpha')
            }
            for r in restaurants
        ]
        
        await websocket.send_text(json.dumps({
            "type": "restaurant_list",
            "data": restaurant_data,
            "timestamp": datetime.utcnow().isoformat()
        }))
        
        # Handle platform owner messages
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                message_type = message_data.get("type")
                
                if message_type == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    }))
                    
                elif message_type == "monitor_restaurant":
                    # Start monitoring specific restaurant
                    restaurant_id = message_data.get("restaurant_id")
                    await websocket.send_text(json.dumps({
                        "type": "monitoring_started",
                        "restaurant_id": restaurant_id,
                        "timestamp": datetime.utcnow().isoformat()
                    }))
                    
                elif message_type == "request_platform_stats":
                    # Send platform-wide statistics
                    await handle_platform_stats_request(websocket, db)
                    
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Platform message processing error: {str(e)}"
                }))
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.close(code=4000, reason=f"Platform connection error: {str(e)}")
        except Exception as e:
            pass
    finally:
        if connection_id:
            await websocket_manager.disconnect(connection_id)


async def handle_portal_update_request(
    websocket: WebSocket,
    connection_id: str,
    restaurant_id: str,
    update_type: str,
    db: Session
):
    """Handle real-time update requests from portal"""
    try:
        if update_type == "active_orders":
            # Send current active orders count
            # This would query real order data
            await websocket.send_text(json.dumps({
                "type": "update_response",
                "update_type": "active_orders",
                "data": {
                    "active_orders": 0,  # Would be real query
                    "pending_orders": 0,
                    "preparing_orders": 0
                },
                "timestamp": datetime.utcnow().isoformat()
            }))
            
        elif update_type == "online_staff":
            # Send online staff count
            await websocket.send_text(json.dumps({
                "type": "update_response",
                "update_type": "online_staff",
                "data": {
                    "online_count": 0,  # Would be real query
                    "total_staff": 0
                },
                "timestamp": datetime.utcnow().isoformat()
            }))
            
    except Exception as e:
        logger.error(f"Portal update request error: {str(e)}")


async def handle_platform_stats_request(websocket: WebSocket, db: Session):
    """Handle platform statistics request"""
    try:
        # Get all restaurants
        total_restaurants = db.query(Restaurant).count()
        active_restaurants = db.query(Restaurant).filter(Restaurant.is_active == True).count()
        
        # This would include more comprehensive stats in production
        stats = {
            "type": "platform_stats",
            "data": {
                "total_restaurants": total_restaurants,
                "active_restaurants": active_restaurants,
                "online_restaurants": websocket_manager.get_active_restaurant_count(),
                "total_connections": websocket_manager.get_total_connections(),
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        await websocket.send_text(json.dumps(stats))
        
    except Exception as e:
        logger.error(f"Platform stats request error: {str(e)}")