"""
WebSocket Authentication Fix for Backend
Resolves 403 Forbidden errors on WebSocket connections

This fix addresses:
1. React Native query parameter stripping
2. Token validation with restaurant context
3. Multiple authentication methods
4. Proper error handling
"""

from typing import Optional, Dict, Any
from fastapi import WebSocket
from app.core.auth import decode_token
from app.models.user import User
import asyncio
import base64
import logging

logger = logging.getLogger(__name__)


class FixedWebSocketManager:
    """Fixed WebSocket manager with proper authentication handling"""
    
    def __init__(self):
        self.active_connections: Dict[int, Dict[str, WebSocket]] = {}
        
    async def authenticate_websocket(
        self, 
        websocket: WebSocket,
        restaurant_id: int
    ) -> Optional[User]:
        """
        Authenticate WebSocket connection with multiple token sources
        Handles React Native limitations with query parameters
        """
        token = None
        
        # Try 1: Get token from Authorization header
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            logger.info("Token found in Authorization header")
        
        # Try 2: Get token from Sec-WebSocket-Protocol header (React Native workaround)
        if not token:
            protocols = websocket.headers.get("sec-websocket-protocol", "")
            if protocols:
                # Format: "token,base64_encoded_token" or "token, base64_encoded_token"
                # Split on comma and strip whitespace
                parts = [p.strip() for p in protocols.split(",")]
                if len(parts) == 2 and parts[0] == "token":
                    try:
                        # Handle URL-safe base64 (replace -_ with +/ and add padding)
                        encoded_token = parts[1]
                        # Convert URL-safe base64 back to standard base64
                        encoded_token = encoded_token.replace('-', '+').replace('_', '/')
                        # Add padding if needed
                        padding = 4 - (len(encoded_token) % 4)
                        if padding != 4:
                            encoded_token += '=' * padding
                        
                        token = base64.b64decode(encoded_token).decode('utf-8')
                        logger.info("Token found in Sec-WebSocket-Protocol header")
                    except Exception as e:
                        logger.error(f"Failed to decode token from protocol: {e}")
        
        # Try 3: Wait for authentication message after connection
        if not token:
            logger.info("No token in headers, waiting for auth message")
            try:
                # Accept connection first
                await websocket.accept()
                
                # Wait for auth message (with timeout)
                auth_message = await asyncio.wait_for(
                    websocket.receive_json(), 
                    timeout=5.0
                )
                
                if auth_message.get("type") == "authenticate":
                    token = auth_message.get("token")
                    logger.info("Token received in authentication message")
                else:
                    logger.error(
                        f"First message was not authentication: {auth_message}"
                    )
                    return None
                    
            except asyncio.TimeoutError:
                logger.error("Timeout waiting for authentication message")
                return None
            except Exception as e:
                logger.error(f"Error receiving auth message: {e}")
                return None
        
        # Validate token
        if not token:
            logger.error("No token found from any source")
            return None
            
        try:
            # Decode and validate token
            payload = decode_token(token)
            user_id = payload.get("sub")
            
            if not user_id:
                logger.error("No user ID in token")
                return None
            
            # Get user from database with restaurant context
            from app.db.session import SessionLocal
            from sqlalchemy.orm import Session
            
            db: Session = SessionLocal()
            try:
                user = db.query(User).filter(
                    User.id == user_id
                ).first()
                
                if not user:
                    logger.error(f"User {user_id} not found")
                    return None
                
                # Validate user has access to restaurant
                if not self.validate_restaurant_access(user, restaurant_id, db):
                    logger.error(
                        f"User {user_id} has no access to restaurant {restaurant_id}"
                    )
                    return None
                
                logger.info(
                    f"WebSocket authenticated for user {user_id}, "
                    f"restaurant {restaurant_id}"
                )
                return user
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            return None
    
    def validate_restaurant_access(
        self, 
        user: User, 
        restaurant_id: int,
        db: Any
    ) -> bool:
        """Validate user has access to the restaurant"""
        # Platform owners have access to all restaurants
        if user.role == "platform_owner":
            return True
        
        # Check if user belongs to restaurant
        from app.models.restaurant import Restaurant
        
        restaurant = db.query(Restaurant).filter(
            Restaurant.id == restaurant_id
        ).first()
        
        if not restaurant:
            return False
        
        # Check if user is owner
        if restaurant.owner_id == user.id:
            return True
        
        # Check if user is employee
        from app.models.employee import Employee
        
        employee = db.query(Employee).filter(
            Employee.user_id == user.id,
            Employee.restaurant_id == restaurant_id,
            Employee.is_active.is_(True)
        ).first()
        
        return employee is not None
    
    async def connect(
        self, 
        websocket: WebSocket, 
        restaurant_id: int,
        connection_type: str = "pos"
    ):
        """
        Connect and authenticate WebSocket with proper error handling
        """
        try:
            # Authenticate before fully accepting (unless already accepted in auth flow)
            user = await self.authenticate_websocket(websocket, restaurant_id)
            
            if not user:
                logger.error(
                    f"WebSocket authentication failed for restaurant {restaurant_id}"
                )
                await websocket.close(code=4003, reason="Authentication failed")
                return
            
            # Accept connection if not already accepted
            if websocket.client_state.value == 0:  # CONNECTING state
                await websocket.accept()
            
            # Store connection
            if restaurant_id not in self.active_connections:
                self.active_connections[restaurant_id] = {}
            
            connection_key = f"{user.id}_{connection_type}"
            self.active_connections[restaurant_id][connection_key] = websocket
            
            # Send connection success message
            await websocket.send_json({
                "type": "connection_established",
                "user_id": user.id,
                "restaurant_id": restaurant_id,
                "role": user.role
            })
            
            logger.info(
                f"WebSocket connected: user={user.id}, "
                f"restaurant={restaurant_id}, type={connection_type}"
            )
            
            # Handle messages
            try:
                while True:
                    message = await websocket.receive_json()
                    
                    # Handle heartbeat
                    if message.get("type") == "heartbeat":
                        await websocket.send_json({
                            "type": "heartbeat",
                            "timestamp": message.get("timestamp")
                        })
                    else:
                        # Process other messages
                        await self.handle_message(
                            message, 
                            websocket, 
                            user, 
                            restaurant_id
                        )
                        
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
            finally:
                # Remove connection
                if (restaurant_id in self.active_connections and 
                    connection_key in self.active_connections[restaurant_id]):
                    del self.active_connections[restaurant_id][connection_key]
                    
        except Exception as e:
            logger.error(f"WebSocket connection error: {e}")
            await websocket.close(code=4000, reason=str(e))
    
    async def handle_message(
        self,
        message: Dict[str, Any],
        websocket: WebSocket,
        user: User,
        restaurant_id: int
    ):
        """Handle incoming WebSocket messages"""
        message_type = message.get("type")
        
        if message_type == "order_update":
            # Broadcast to all connections for this restaurant
            await self.broadcast_to_restaurant(
                restaurant_id,
                {
                    "type": "order_update",
                    "data": message.get("data"),
                    "user_id": user.id,
                    "timestamp": message.get("timestamp")
                }
            )
        elif message_type == "ping":
            # Simple ping/pong
            await websocket.send_json({"type": "pong"})
        # Add more message handlers as needed
    
    async def broadcast_to_restaurant(
        self,
        restaurant_id: int,
        message: Dict[str, Any]
    ):
        """Broadcast message to all connections for a restaurant"""
        if restaurant_id not in self.active_connections:
            return
        
        disconnected = []
        
        for key, ws in self.active_connections[restaurant_id].items():
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to {key}: {e}")
                disconnected.append(key)
        
        # Clean up disconnected clients
        for key in disconnected:
            del self.active_connections[restaurant_id][key]


# Usage in endpoint:
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from .fix_websocket_auth import FixedWebSocketManager

router = APIRouter()
websocket_manager = FixedWebSocketManager()

@router.websocket("/ws/pos/{restaurant_id}")
async def websocket_endpoint(websocket: WebSocket, restaurant_id: int):
    await websocket_manager.connect(websocket, restaurant_id, "pos")
"""