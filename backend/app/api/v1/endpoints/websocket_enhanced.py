"""
Enhanced WebSocket API endpoints for Fynlo POS
Implements heartbeat, reconnection, and improved connection management
"""TODO: Add docstring."""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Optional, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.websockets import WebSocketState
from sqlalchemy.orm import Session

from app.core.auth import verify_websocket_token
from app.core.database import get_db, User
from app.schemas.websocket import WebSocketMessage, WebSocketEventType
from app.services.sync_service import sync_service
from app.core.rate_limiter import RateLimiter, ConnectionLimiter

logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectionInfo:
    def __init__(self, websocket: WebSocket, user_id: str, restaurant_id: str, client_type: str = "mobile_pos"):
        self.id = f"{user_id}:{datetime.utcnow().timestamp()}"
        self.websocket = websocket
        self.user_id = user_id
        self.restaurant_id = restaurant_id
        self.client_type = client_type
        self.connected_at = datetime.utcnow()
        self.last_ping = datetime.utcnow()
        self.authenticated = False
        self.missed_pongs = 0

class EnhancedWebSocketManager:
    def __init__(self):
        # restaurant_id -> set of connections
        self.active_connections: Dict[str, Set[ConnectionInfo]] = {}
        # connection_id -> ConnectionInfo
        self.connection_map: Dict[str, ConnectionInfo] = {}
        # Configuration
        self.max_connections_per_restaurant = 100
        self.max_connections_per_user = 5
        self.heartbeat_interval = 15  # seconds
        self.pong_timeout = 5  # seconds
        self.max_missed_pongs = 3
        
        # Rate limiting
        self.message_rate_limiter = RateLimiter(
            max_messages=100,  # 100 messages per minute
            window_seconds=60,
            burst_size=20
        )
        self.connection_limiter = ConnectionLimiter(
            max_per_ip=20,
            max_per_user=5,
            ip_window_seconds=60
        )
        
        # Synchronization
        self._disconnect_lock = asyncio.Lock()
        
    async def connect(
        self, 
        websocket: WebSocket, 
        restaurant_id: str
    ) -> str:
        """Accept WebSocket connection and return connection ID"""
        await websocket.accept()
        
        # Generate connection ID
        connection_id = f"{restaurant_id}:{datetime.utcnow().timestamp()}"
        
        logger.info(f"WebSocket connection accepted: {connection_id}")
        return connection_id
        
    async def authenticate(
        self,
        connection_id: str,
        websocket: WebSocket,
        auth_data: dict,
        db: Session,
        connection_type: str = "pos"
    ) -> Optional[ConnectionInfo]:
        """Authenticate WebSocket connection"""
        try:
            # Extract auth data
            token = auth_data.get('token')
            user_id = auth_data.get('user_id')
            restaurant_id = auth_data.get('restaurant_id')
            
            if not all([token, user_id, restaurant_id]):
                await self.send_error(
                    websocket,
                    WebSocketEventType.AUTH_ERROR,
                    "Missing authentication data"
                )
                return None
            
            # Verify token and user
            user = await verify_websocket_token(token, user_id, db)
            if not user:
                await self.send_error(
                    websocket,
                    WebSocketEventType.AUTH_ERROR,
                    "Invalid authentication token"
                )
                return None
            
            # Verify user has access to restaurant
            if user.role != 'platform_owner':
                if not user.restaurant_id or str(user.restaurant_id) != restaurant_id:
                    await self.send_error(
                        websocket,
                        WebSocketEventType.AUTH_ERROR,
                        "Access denied to this restaurant"
                    )
                    return None
            
            # Check connection limits
            if not self._check_connection_limits(restaurant_id, user_id):
                await self.send_error(
                    websocket,
                    WebSocketEventType.AUTH_ERROR,
                    "Connection limit exceeded"
                )
                return None
            
            # Create connection info
            client_type = "platform_dashboard" if connection_type == "platform" else "mobile_pos"
            conn_info = ConnectionInfo(websocket, user_id, restaurant_id, client_type)
            conn_info.authenticated = True
            
            # Store connection
            if restaurant_id not in self.active_connections:
                self.active_connections[restaurant_id] = set()
            
            self.active_connections[restaurant_id].add(conn_info)
            self.connection_map[connection_id] = conn_info
            
            # Send authentication success
            await self.send_message(
                websocket,
                WebSocketEventType.AUTHENTICATED,
                {
                    "user_id": user_id,
                    "restaurant_id": restaurant_id,
                    "connection_id": connection_id
                },
                restaurant_id
            )
            
            logger.info(f"WebSocket authenticated: {connection_id} for user {user_id}")
            return conn_info
            
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            await self.send_error(
                websocket,
                WebSocketEventType.AUTH_ERROR,
                "Authentication failed"
            )
            return None
    
    def _check_connection_limits(self, restaurant_id: str, user_id: str) -> bool:
        """Check if connection limits are exceeded"""
        # Check restaurant limit
        restaurant_connections = self.active_connections.get(restaurant_id, set())
        if len(restaurant_connections) >= self.max_connections_per_restaurant:
            logger.warning(f"Restaurant {restaurant_id} connection limit exceeded")
            return False
        
        # Check user limit
        user_connections = sum(
            1 for conn in restaurant_connections 
            if conn.user_id == user_id
        )
        if user_connections >= self.max_connections_per_user:
            logger.warning(f"User {user_id} connection limit exceeded")
            return False
        
        return True
    
    async def disconnect(self, connection_id: str):
        """Remove connection and cleanup"""
        # Use lock to prevent race conditions
        async with self._disconnect_lock:
            conn_info = self.connection_map.get(connection_id)
            if not conn_info:
                return
            
            # Remove from rate limiter tracking
            self.connection_limiter.remove_connection(conn_info.user_id, connection_id)
            
            # Remove from restaurant connections
            if conn_info.restaurant_id in self.active_connections:
                self.active_connections[conn_info.restaurant_id].discard(conn_info)
                
                # Clean up empty restaurant
                if not self.active_connections[conn_info.restaurant_id]:
                    del self.active_connections[conn_info.restaurant_id]
            
            # Remove from connection map - do this last to prevent issues
            if connection_id in self.connection_map:
                del self.connection_map[connection_id]
            
            logger.info(f"WebSocket disconnected: {connection_id}")
    
    async def handle_ping(self, connection_id: str, websocket: WebSocket):
        """Handle ping message and send pong"""
        conn_info = self.connection_map.get(connection_id)
        if conn_info:
            conn_info.last_ping = datetime.utcnow()
            conn_info.missed_pongs = 0  # Reset missed pongs on successful ping
            
            # Send pong response
            await self.send_message(
                websocket,
                WebSocketEventType.PONG,
                {"timestamp": datetime.utcnow().isoformat()},
                conn_info.restaurant_id
            )
    
    async def handle_pong(self, connection_id: str):
        """Handle pong response from client"""
        conn_info = self.connection_map.get(connection_id)
        if conn_info:
            conn_info.missed_pongs = 0
            logger.debug(f"Received pong from {connection_id}")
    
    async def send_heartbeat(self, connection_id: str) -> bool:
        """Send heartbeat ping to client"""
        conn_info = self.connection_map.get(connection_id)
        if not conn_info:
            return False
        
        try:
            await self.send_message(
                conn_info.websocket,
                WebSocketEventType.PING,
                {"timestamp": datetime.utcnow().isoformat()},
                conn_info.restaurant_id
            )
            return True
        except Exception as e:
            logger.error(f"Failed to send heartbeat to {connection_id}: {e}")
            return False
    
    async def broadcast_to_restaurant(
        self,
        restaurant_id: str,
        event: WebSocketEventType,
        data: dict,
        exclude_connection: Optional[str] = None
    ):
        """Broadcast message to all connections in a restaurant"""
        connections = self.active_connections.get(restaurant_id, set())
        dead_connections = set()
        
        for conn in connections:
            if exclude_connection and self._get_connection_id(conn) == exclude_connection:
                continue
                
            try:
                await self.send_message(
                    conn.websocket, 
                    event, 
                    data, 
                    restaurant_id
                )
            except WebSocketDisconnect:
                dead_connections.add(conn)
            except Exception as e:
                logger.error(f"Broadcast error: {e}")
                dead_connections.add(conn)
        
        # Clean up dead connections
        for conn in dead_connections:
            await self.disconnect(self._get_connection_id(conn))
    
    async def send_message(
        self,
        websocket: WebSocket,
        event: WebSocketEventType,
        data: dict,
        restaurant_id: str
    ):
        """Send message to specific WebSocket"""
        message = WebSocketMessage(
            id=f"{datetime.utcnow().timestamp()}",
            type=event,
            data=data,
            restaurant_id=restaurant_id,
            timestamp=datetime.utcnow().isoformat()
        )
        
        await websocket.send_json(message.dict())
    
    async def send_error(
        self,
        websocket: WebSocket,
        event: WebSocketEventType,
        error: str
    ):
        """Send error message"""
        await self.send_message(
            websocket,
            event,
            {"error": error},
            ""  # Empty restaurant_id for errors
        )
    
    def _get_connection_id(self, conn_info: ConnectionInfo) -> str:
        """Get connection ID for a connection"""
        for conn_id, conn in self.connection_map.items():
            if conn == conn_info:
                return conn_id
        return ""
    
    def get_restaurant_connections(self, restaurant_id: str) -> list[ConnectionInfo]:
        """Get all active connections for a restaurant"""
        return list(self.active_connections.get(restaurant_id, set()))
    
    def get_platform_connections(self) -> list[ConnectionInfo]:
        """Get all active platform dashboard connections"""
        platform_connections = []
        for conn_info in self.connection_map.values():
            if hasattr(conn_info, 'client_type') and conn_info.client_type == 'platform_dashboard':
                platform_connections.append(conn_info)
        return platform_connections
    
    async def send_to_connection(self, connection_id: str, data: dict):
        """Send message to specific connection by ID"""
        conn_info = self.connection_map.get(connection_id)
        if conn_info:
            await self.send_message(
                conn_info.websocket,
                data.get('type', WebSocketEventType.DATA_UPDATED),
                data.get('data', {}),
                conn_info.restaurant_id
            )
    
    async def monitor_connection_health(self):
        """Monitor connection health and handle heartbeats"""
        cleanup_counter = 0
        
        while True:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                cleanup_counter += 1
                
                # Check all connections
                for conn_id, conn_info in list(self.connection_map.items()):
                    if not conn_info.authenticated:
                        continue
                    
                    # Check if we've received anything from client recently
                    time_since_last_ping = (datetime.utcnow() - conn_info.last_ping).total_seconds()
                    
                    # If client hasn't sent ping in 2x heartbeat interval, send server ping
                    if time_since_last_ping > (self.heartbeat_interval * 2):
                        # Send server-initiated ping
                        success = await self.send_heartbeat(conn_id)
                        
                        if not success:
                            conn_info.missed_pongs += 1
                            
                            if conn_info.missed_pongs >= self.max_missed_pongs:
                                logger.warning(f"Connection {conn_id} missed {self.max_missed_pongs} pongs, disconnecting")
                                await self.disconnect(conn_id)
                    else:
                        # Client is actively pinging, reset missed pongs
                        conn_info.missed_pongs = 0
                
                # Cleanup rate limiter buckets every 20 cycles (5 minutes)
                if cleanup_counter % 20 == 0:
                    self.message_rate_limiter.cleanup_old_buckets()
                    logger.debug("Cleaned up rate limiter buckets")
                
            except Exception as e:
                logger.error(f"Health monitor error: {e}")

# Global manager instance
manager = EnhancedWebSocketManager()

# Initialize sync service on startup
async def init_websocket_services():
    """Initialize WebSocket-related services"""
    await sync_service.initialize(manager)
    logger.info("WebSocket services initialized")

@router.websocket("/ws/{connection_type}/{restaurant_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    connection_type: str,  # 'pos' or 'platform'
    restaurant_id: str,
    db: Session = Depends(get_db)
):
    """
    Enhanced WebSocket endpoint with heartbeat and reconnection support
    
    Security: Tokens must be sent in the authentication message body, NOT in URL
    """
    connection_id = None
    auth_timeout_task = None
    
    try:
        # Accept connection
        connection_id = await manager.connect(websocket, restaurant_id)
        
        # Set authentication timeout
        auth_timeout_task = asyncio.create_task(asyncio.sleep(10))
        auth_message_task = asyncio.create_task(websocket.receive_text())
        
        # Wait for authentication or timeout
        done, pending = await asyncio.wait(
            [auth_timeout_task, auth_message_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
        
        # Check which task completed
        if auth_timeout_task in done:
            await manager.send_error(
                websocket,
                WebSocketEventType.AUTH_ERROR,
                "Authentication timeout"
            )
            await websocket.close(code=4002, reason="Authentication timeout")
            return
        
        # Parse authentication message
        auth_data = json.loads(auth_message_task.result())
        
        # Verify message type
        if auth_data.get("type") != WebSocketEventType.AUTHENTICATE:
            await manager.send_error(
                websocket,
                WebSocketEventType.AUTH_ERROR,
                "First message must be authentication"
            )
            await websocket.close(code=4001, reason="Authentication required")
            return
        
        # Authenticate
        conn_info = await manager.authenticate(
            connection_id,
            websocket,
            auth_data.get("data", {}),
            db,
            connection_type
        )
        
        if not conn_info:
            await websocket.close(code=4003, reason="Authentication failed")
            return
        
        # Handle messages
        while True:
            try:
                # Wait for message with timeout
                message_text = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=60.0  # 1 minute timeout
                )
                
                # Check message size (max 1MB)
                if len(message_text) > 1024 * 1024:
                    await manager.send_error(
                        websocket,
                        WebSocketEventType.ERROR,
                        "Message too large (max 1MB)"
                    )
                    continue
                
                message = json.loads(message_text)
                message_type = message.get("type")
                
                # Check rate limit (except for pings/pongs)
                if message_type not in [WebSocketEventType.PING, WebSocketEventType.PONG]:
                    if not manager.message_rate_limiter.check_rate_limit(connection_id):
                        wait_time = manager.message_rate_limiter.get_wait_time(connection_id)
                        await manager.send_error(
                            websocket,
                            WebSocketEventType.ERROR,
                            f"Rate limit exceeded. Please wait {wait_time:.1f} seconds"
                        )
                        continue
                
                # Handle different message types
                if message_type == WebSocketEventType.PING:
                    await manager.handle_ping(connection_id, websocket)
                elif message_type == WebSocketEventType.PONG:
                    await manager.handle_pong(connection_id)
                else:
                    # Process business messages
                    await process_message(connection_id, message, db)
                    
            except asyncio.TimeoutError:
                # No message received in timeout period, send ping
                if not await manager.send_heartbeat(connection_id):
                    break
                    
            except json.JSONDecodeError:
                await manager.send_error(
                    websocket,
                    WebSocketEventType.ERROR,
                    "Invalid JSON format"
                )
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Message processing error: {e}")
                await manager.send_error(
                    websocket,
                    WebSocketEventType.ERROR,
                    f"Message processing error: {str(e)}"
                )
                
    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close(code=4000, reason="Internal error")
    finally:
        if connection_id:
            await manager.disconnect(connection_id)

async def process_message(connection_id: str, message: dict, db: Session):
    """Process business logic messages"""
    conn_info = manager.connection_map.get(connection_id)
    if not conn_info:
        return
    
    message_type = message.get("type")
    data = message.get("data", {})
    
    # Handle different message types
    if message_type == "order.status_update":
        # Update order status and broadcast
        order_id = data.get("order_id")
        new_status = data.get("status")
        
        # TODO: Update order in database
        
        # Broadcast to restaurant
        await manager.broadcast_to_restaurant(
            conn_info.restaurant_id,
            WebSocketEventType.ORDER_STATUS_CHANGED,
            {
                "order_id": order_id,
                "status": new_status,
                "updated_by": conn_info.user_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        )

# Background task starter
async def start_health_monitor():
    """Start the connection health monitor"""
    asyncio.create_task(manager.monitor_connection_health())