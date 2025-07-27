"""
WebSocket API endpoints for Fynlo POS
Real-time communication endpoints
"""

from typing import Optional, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, Path, HTTPException
from sqlalchemy.orm import Session
import json
from datetime import datetime
import logging

from app.core.database import get_db, User, Restaurant

logger = logging.getLogger(__name__)
from app.core.websocket import (
    websocket_manager, 
    ConnectionType, 
    EventType,
    WebSocketMessage
)
from app.core.exceptions import FynloException, ErrorCodes
from app.core.responses import APIResponseHelper
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.supabase import supabase_admin

router = APIRouter()

async def verify_websocket_access(
    restaurant_id: str,
    user_id: Optional[str] = None,
    token: Optional[str] = None,
    connection_type: str = "pos",
    db: Session = None
) -> bool:
    """Verify WebSocket access permissions with Supabase token validation"""
    try:
        # Special case for onboarding users without restaurants
        if restaurant_id == "onboarding":
            # For onboarding, we only need valid user authentication
            if not user_id or not token:
                return False
            # Skip restaurant verification for onboarding
        else:
            # Verify restaurant exists for normal connections
            restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
            if not restaurant or not restaurant.is_active:
                return False
        
        # Verify user authentication if user_id provided
        if user_id:
            # Token is REQUIRED for authenticated connections
            if not token:
                return False
            
            # Validate the token with Supabase
            try:
                # Verify token with Supabase Admin API
                if not supabase_admin:
                    logger.error("Supabase admin client not initialized")
                    return False
                
                user_response = supabase_admin.auth.get_user(token)
                supabase_user = user_response.user
                
                if not supabase_user:
                    logger.error("Invalid Supabase token - no user found")
                    return False
                
                # Find user in our database by supabase_id
                user = db.query(User).filter(User.supabase_id == supabase_user.id).first()
                if not user:
                    # Check by email for backward compatibility
                    user = db.query(User).filter(User.email == supabase_user.email).first()
                    if user and not user.supabase_id:
                        # Update the supabase_id if missing with proper error handling
                        try:
                            user.supabase_id = supabase_user.id
                            db.commit()
                            logger.info(f"Updated user {user.id} with Supabase ID during WebSocket auth")
                        except Exception as e:
                            logger.error(f"Failed to update user supabase_id: {str(e)}")
                            db.rollback()
                            # Continue with authentication even if update fails
                
                if not user:
                    logger.error(f"User not found in database for supabase_id: {supabase_user.id}")
                    return False
                
                # Verify the user is active
                if not user.is_active:
                    logger.warning(f"User is not active: {user.id}")
                    return False
                
                # Verify user_id matches (critical security check)
                if str(user.id) != str(user_id):
                    logger.error(f"User ID mismatch - potential security violation: {user.id} != {user_id}")
                    return False
                    
            except Exception as e:
                logger.error(f"Supabase token validation error: {str(e)}")
                return False
            
            # Check if user has access to this restaurant
            if restaurant_id == "onboarding":
                # For onboarding connections, allow any authenticated user
                logger.info(f"Onboarding connection for user: {user.id}")
                pass
            elif user.role == "restaurant_owner" and str(user.restaurant_id) != restaurant_id:
                logger.warning(f"Restaurant owner access denied: {user.restaurant_id} != {restaurant_id}")
                return False
            elif user.role == "platform_owner":
                # Platform owners have access to all restaurants
                pass
            elif user.role in ["manager", "employee"] and str(user.restaurant_id) != restaurant_id:
                logger.warning(f"Staff access denied: {user.restaurant_id} != {restaurant_id}")
                return False
        
        return True
        
    except Exception as e:
        logger.error(f"WebSocket access verification error: {str(e)}")
        return False

@router.websocket("/ws/{restaurant_id}")
async def websocket_endpoint_general(
    websocket: WebSocket,
    restaurant_id: str = Path(..., description="Restaurant ID"),
    user_id: Optional[str] = Query(None, description="User ID"),
    connection_type: str = Query("pos", description="Connection type"),
    db: Session = Depends(get_db)
):
    """
    General WebSocket endpoint for restaurant updates
    Supports POS terminals, management dashboards, and customer displays
    """
    connection_id = None
    
    try:
        # Get token from query parameters
        token = websocket.query_params.get("token")
        
        # Verify access with token validation
        has_access = await verify_websocket_access(restaurant_id, user_id, token, connection_type, db)
        if not has_access:
            await websocket.close(code=4003, reason="Access denied")
            return
        
        # Determine connection type
        conn_type = ConnectionType.POS
        if connection_type == "kitchen":
            conn_type = ConnectionType.KITCHEN
        elif connection_type == "management":
            conn_type = ConnectionType.MANAGEMENT
        elif connection_type == "customer":
            conn_type = ConnectionType.CUSTOMER
        
        # Get user roles if user_id provided
        roles = []
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                roles = [user.role]
        
        # Connect to WebSocket manager
        connection_id = await websocket_manager.connect(
            websocket=websocket,
            restaurant_id=restaurant_id,
            user_id=user_id,
            connection_type=conn_type,
            roles=roles
        )
        
        # Handle incoming messages
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Handle different message types
                message_type = message_data.get("type")
                
                if message_type == "pong":
                    # Handle pong response
                    continue
                elif message_type == "subscribe":
                    # Handle event subscription
                    await handle_subscription(connection_id, message_data)
                elif message_type == "unsubscribe":
                    # Handle event unsubscription
                    await handle_unsubscription(connection_id, message_data)
                elif message_type == "ping":
                    # Send pong response
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }))
                else:
                    # Echo unknown message types for debugging
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": f"Unknown message type: {message_type}",
                        "original_message": message_data
                    }))
                    
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
        except:
            pass
    finally:
        if connection_id:
            await websocket_manager.disconnect(connection_id)

@router.websocket("/ws/kitchen/{restaurant_id}")
async def websocket_kitchen_endpoint(
    websocket: WebSocket,
    restaurant_id: str = Path(..., description="Restaurant ID"),
    user_id: Optional[str] = Query(None, description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Kitchen-specific WebSocket endpoint
    Receives order updates, preparation status, and kitchen notifications
    """
    connection_id = None
    
    try:
        # Get token from query parameters
        token = websocket.query_params.get("token")
        
        # Verify access with token validation
        has_access = await verify_websocket_access(restaurant_id, user_id, token, "kitchen", db)
        if not has_access:
            await websocket.close(code=4003, reason="Access denied")
            return
        
        # Get user roles
        roles = []
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                roles = [user.role]
        
        # Connect with kitchen-specific type
        connection_id = await websocket_manager.connect(
            websocket=websocket,
            restaurant_id=restaurant_id,
            user_id=user_id,
            connection_type=ConnectionType.KITCHEN,
            roles=roles
        )
        
        # Send kitchen-specific welcome message
        welcome_message = WebSocketMessage(
            event_type=EventType.SYSTEM_NOTIFICATION,
            data={
                "type": "kitchen_connected",
                "message": "Kitchen display connected successfully",
                "features": ["order_notifications", "status_updates", "preparation_times"]
            },
            restaurant_id=restaurant_id,
            user_id=user_id
        )
        
        await websocket_manager.send_to_connection(connection_id, welcome_message)
        
        # Handle kitchen-specific messages
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                message_type = message_data.get("type")
                
                if message_type == "order_status_update":
                    await handle_kitchen_status_update(connection_id, restaurant_id, message_data, db)
                elif message_type == "preparation_time_update":
                    await handle_preparation_time_update(connection_id, restaurant_id, message_data, db)
                elif message_type == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }))
                    
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format in kitchen message"
                }))
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Kitchen message processing error: {str(e)}"
                }))
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.close(code=4000, reason=f"Kitchen connection error: {str(e)}")
        except:
            pass
    finally:
        if connection_id:
            await websocket_manager.disconnect(connection_id)

@router.websocket("/ws/pos/{restaurant_id}")
async def websocket_pos_endpoint(
    websocket: WebSocket,
    restaurant_id: str = Path(..., description="Restaurant ID"),
    user_id: Optional[str] = Query(None, description="User ID"),
    db: Session = Depends(get_db)
):
    """
    POS-specific WebSocket endpoint
    Handles order updates, payment notifications, and inventory alerts
    """
    connection_id = None
    
    try:
        # Get token from query parameters
        token = websocket.query_params.get("token")
        
        # Verify access with token validation
        has_access = await verify_websocket_access(restaurant_id, user_id, token, "pos", db)
        if not has_access:
            await websocket.close(code=4003, reason="Access denied")
            return
        
        # Get user roles
        roles = []
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                roles = [user.role]
        
        # Connect with POS-specific type
        connection_id = await websocket_manager.connect(
            websocket=websocket,
            restaurant_id=restaurant_id,
            user_id=user_id,
            connection_type=ConnectionType.POS,
            roles=roles
        )
        
        # Send POS-specific welcome message
        welcome_message = WebSocketMessage(
            event_type=EventType.SYSTEM_NOTIFICATION,
            data={
                "type": "pos_connected",
                "message": "POS terminal connected successfully",
                "features": ["order_updates", "payment_notifications", "inventory_alerts"]
            },
            restaurant_id=restaurant_id,
            user_id=user_id
        )
        
        await websocket_manager.send_to_connection(connection_id, welcome_message)
        
        # Handle POS messages
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                message_type = message_data.get("type")
                
                if message_type == "order_created":
                    await handle_pos_order_created(connection_id, restaurant_id, message_data, db)
                elif message_type == "payment_processed":
                    await handle_pos_payment_processed(connection_id, restaurant_id, message_data, db)
                elif message_type == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }))
                    
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format in POS message"
                }))
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"POS message processing error: {str(e)}"
                }))
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.close(code=4000, reason=f"POS connection error: {str(e)}")
        except:
            pass
    finally:
        if connection_id:
            await websocket_manager.disconnect(connection_id)

@router.websocket("/ws/management/{restaurant_id}")
async def websocket_management_endpoint(
    websocket: WebSocket,
    restaurant_id: str = Path(..., description="Restaurant ID"),
    user_id: Optional[str] = Query(None, description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Management dashboard WebSocket endpoint
    Provides real-time analytics, alerts, and system status
    """
    connection_id = None
    
    try:
        # Get token from query parameters
        token = websocket.query_params.get("token")
        
        # Verify management access with token validation
        has_access = await verify_websocket_access(restaurant_id, user_id, token, "management", db)
        if not has_access:
            await websocket.close(code=4003, reason="Access denied")
            return
        
        # Verify user has management permissions
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if not user or user.role not in ["restaurant_owner", "platform_owner", "manager"]:
                await websocket.close(code=4003, reason="Management access required")
                return
        
        # Connect with management-specific type
        connection_id = await websocket_manager.connect(
            websocket=websocket,
            restaurant_id=restaurant_id,
            user_id=user_id,
            connection_type=ConnectionType.MANAGEMENT,
            roles=[user.role] if user_id else []
        )
        
        # Send management dashboard data
        welcome_message = WebSocketMessage(
            event_type=EventType.SYSTEM_NOTIFICATION,
            data={
                "type": "management_connected",
                "message": "Management dashboard connected",
                "features": ["real_time_analytics", "system_alerts", "performance_metrics"]
            },
            restaurant_id=restaurant_id,
            user_id=user_id
        )
        
        await websocket_manager.send_to_connection(connection_id, welcome_message)
        
        # Handle management messages
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                message_type = message_data.get("type")
                
                if message_type == "request_analytics":
                    await handle_analytics_request(connection_id, restaurant_id, message_data, db)
                elif message_type == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }))
                    
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format in management message"
                }))
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Management message processing error: {str(e)}"
                }))
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.close(code=4000, reason=f"Management connection error: {str(e)}")
        except:
            pass
    finally:
        if connection_id:
            await websocket_manager.disconnect(connection_id)

# Message handlers
async def handle_subscription(connection_id: str, message_data: dict):
    """Handle event subscription requests"""
    try:
        events = message_data.get("events", [])
        # Store subscription preferences for this connection
        # This would be implemented based on specific requirements
        response = {
            "type": "subscription_confirmed",
            "events": events,
            "message": f"Subscribed to {len(events)} event types"
        }
        
        # Send confirmation (implementation would depend on WebSocket manager)
        pass
        
    except Exception as e:
        logger.error(f"Subscription error: {str(e)}")

async def handle_unsubscription(connection_id: str, message_data: dict):
    """Handle event unsubscription requests"""
    try:
        events = message_data.get("events", [])
        # Remove subscription preferences for this connection
        # Implementation would depend on specific requirements
        pass
        
    except Exception as e:
        logger.error(f"Unsubscription error: {str(e)}")

async def handle_kitchen_status_update(connection_id: str, restaurant_id: str, message_data: dict, db: Session):
    """Handle kitchen status updates"""
    try:
        order_id = message_data.get("order_id")
        new_status = message_data.get("status")
        
        if not order_id or not new_status:
            return
        
        # Broadcast status update to all relevant connections
        update_message = WebSocketMessage(
            event_type=EventType.ORDER_STATUS_CHANGED,
            data={
                "order_id": order_id,
                "new_status": new_status,
                "updated_by": "kitchen",
                "updated_at": datetime.now().isoformat()
            },
            restaurant_id=restaurant_id,
            connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT]
        )
        
        await websocket_manager.broadcast_to_restaurant(
            restaurant_id,
            update_message,
            connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT]
        )
        
    except Exception as e:
        logger.error(f"Kitchen status update error: {str(e)}")

async def handle_preparation_time_update(connection_id: str, restaurant_id: str, message_data: dict, db: Session):
    """Handle preparation time updates"""
    try:
        order_id = message_data.get("order_id")
        estimated_time = message_data.get("estimated_time")
        
        if not order_id or not estimated_time:
            return
        
        # Broadcast preparation time update
        time_message = WebSocketMessage(
            event_type=EventType.KITCHEN_UPDATE,
            data={
                "order_id": order_id,
                "update_type": "preparation_time",
                "estimated_time": estimated_time,
                "updated_at": datetime.now().isoformat()
            },
            restaurant_id=restaurant_id,
            connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT]
        )
        
        await websocket_manager.broadcast_to_restaurant(
            restaurant_id,
            time_message,
            connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT]
        )
        
    except Exception as e:
        logger.error(f"Preparation time update error: {str(e)}")

async def handle_pos_order_created(connection_id: str, restaurant_id: str, message_data: dict, db: Session):
    """Handle new order from POS"""
    try:
        order_data = message_data.get("order", {})
        
        # Broadcast new order to kitchen and management
        order_message = WebSocketMessage(
            event_type=EventType.ORDER_CREATED,
            data=order_data,
            restaurant_id=restaurant_id,
            connection_types=[ConnectionType.KITCHEN, ConnectionType.MANAGEMENT]
        )
        
        await websocket_manager.broadcast_to_restaurant(
            restaurant_id,
            order_message,
            connection_types=[ConnectionType.KITCHEN, ConnectionType.MANAGEMENT]
        )
        
    except Exception as e:
        logger.error(f"POS order created error: {str(e)}")

async def handle_pos_payment_processed(connection_id: str, restaurant_id: str, message_data: dict, db: Session):
    """Handle payment processing from POS"""
    try:
        payment_data = message_data.get("payment", {})
        
        # Broadcast payment completion
        payment_message = WebSocketMessage(
            event_type=EventType.PAYMENT_COMPLETED,
            data=payment_data,
            restaurant_id=restaurant_id,
            connection_types=[ConnectionType.MANAGEMENT]
        )
        
        await websocket_manager.broadcast_to_restaurant(
            restaurant_id,
            payment_message,
            connection_types=[ConnectionType.MANAGEMENT]
        )
        
    except Exception as e:
        logger.error(f"POS payment processed error: {str(e)}")

async def handle_analytics_request(connection_id: str, restaurant_id: str, message_data: dict, db: Session):
    """Handle real-time analytics requests"""
    try:
        analytics_type = message_data.get("analytics_type", "dashboard")
        
        # This would fetch real-time analytics data
        # For now, send a placeholder response
        analytics_data = {
            "type": "analytics_data",
            "analytics_type": analytics_type,
            "data": {
                "timestamp": datetime.now().isoformat(),
                "message": "Analytics data would be provided here"
            }
        }
        
        # Send analytics data to requesting connection
        # Implementation would depend on specific analytics requirements
        
    except Exception as e:
        logger.error(f"Analytics request error: {str(e)}")

# REST endpoints for WebSocket management
@router.get("/stats")
async def get_websocket_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get WebSocket connection statistics"""
    try:
        # Only allow managers and owners to view stats
        if current_user.role not in ["restaurant_owner", "platform_owner", "manager"]:
            raise FynloException(
                message="Access denied - management permissions required",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        stats = websocket_manager.get_connection_stats()
        
        return APIResponseHelper.success(
            data=stats,
            message="WebSocket statistics retrieved successfully"
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve WebSocket statistics: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.post("/broadcast/{restaurant_id}")
async def broadcast_message(
    restaurant_id: str = Path(..., description="Restaurant ID"),
    message: dict = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Broadcast message to all connections in a restaurant"""
    try:
        # Verify permissions
        if current_user.role not in ["restaurant_owner", "platform_owner", "manager"]:
            raise FynloException(
                message="Access denied - management permissions required",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        # Verify restaurant access
        restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
        if not restaurant:
            raise FynloException(
                message="Restaurant not found",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        # Create broadcast message
        broadcast_msg = WebSocketMessage(
            event_type=EventType.SYSTEM_NOTIFICATION,
            data={
                "type": "admin_broadcast",
                "message": message.get("message", "System notification"),
                "priority": message.get("priority", "normal"),
                "sent_by": current_user.username
            },
            restaurant_id=restaurant_id,
            user_id=str(current_user.id)
        )
        
        await websocket_manager.broadcast_to_restaurant(restaurant_id, broadcast_msg)
        
        return APIResponseHelper.success(
            message="Message broadcasted successfully",
            meta={"restaurant_id": restaurant_id}
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to broadcast message: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )