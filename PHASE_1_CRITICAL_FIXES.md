# 🔧 Phase 1: Critical Fixes with Clean Architecture

**Duration**: Days 3-5
**Priority**: Production Critical
**Goal**: Fix WebSocket, Token, and API issues using shared types

---

## 🎯 Overview

Phase 1 addresses the critical production issues that are causing user impact. All fixes use the shared types from Phase 0 to ensure consistency and prevent future issues.

---

## 📋 Day 3: WebSocket Stabilization

### Morning Tasks (4 hours)

#### 1. Enhanced WebSocket Service (Mobile)

**Location**: `CashApp-iOS/CashAppPOS/src/services/websocket/EnhancedWebSocketService.ts`

```typescript
import { WebSocketMessage, WebSocketEvent, WebSocketConfig } from '@fynlo/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import tokenManager from '../../utils/tokenManager';
import API_CONFIG from '../../config/api';

type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'AUTHENTICATING' | 'CONNECTED' | 'RECONNECTING';

export class EnhancedWebSocketService {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'DISCONNECTED';
  private config: WebSocketConfig;
  
  // Heartbeat mechanism
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private missedPongs: number = 0;
  private maxMissedPongs: number = 3;
  
  // Reconnection logic
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectBackoff: number[] = [1000, 2000, 4000, 8000, 16000, 30000];
  
  // Message queue for offline/reconnecting
  private messageQueue: WebSocketMessage[] = [];
  private listeners: Map<string, Set<Function>> = new Map();
  
  // Network monitoring
  private networkUnsubscribe: (() => void) | null = null;
  
  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      heartbeatInterval: 15000, // 15 seconds
      pongTimeout: 5000,        // 5 seconds
      maxReconnectAttempts: 10,
      authTimeout: 10000,       // 10 seconds
      ...config
    };
    
    this.setupNetworkMonitoring();
  }
  
  private setupNetworkMonitoring(): void {
    this.networkUnsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        if (this.state === 'DISCONNECTED') {
          console.log('📱 Network restored, reconnecting WebSocket...');
          this.connect();
        }
      } else if (this.state === 'CONNECTED') {
        console.log('📱 Network lost, WebSocket will reconnect when available');
        this.handleDisconnect(4001, 'Network unavailable');
      }
    });
  }
  
  async connect(): Promise<void> {
    if (this.state !== 'DISCONNECTED' && this.state !== 'RECONNECTING') {
      console.log(`⚠️ WebSocket already ${this.state}`);
      return;
    }
    
    try {
      this.setState('CONNECTING');
      
      // Get connection parameters
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (!userInfo) {
        throw new Error('No user authentication found');
      }
      
      const user = JSON.parse(userInfo);
      if (!user.restaurant_id) {
        throw new Error('No restaurant associated with user');
      }
      
      // Build WebSocket URL (no token in URL for security)
      const wsProtocol = API_CONFIG.BASE_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_CONFIG.BASE_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/v1/websocket/ws/pos/${user.restaurant_id}`;
      
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
      
      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.state === 'CONNECTING') {
          console.error('❌ WebSocket connection timeout');
          this.ws?.close();
          this.scheduleReconnect();
        }
      }, 10000);
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connected, authenticating...');
        this.authenticate();
      };
      
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      this.setState('DISCONNECTED');
      this.scheduleReconnect();
    }
  }
  
  private async authenticate(): Promise<void> {
    this.setState('AUTHENTICATING');
    
    try {
      const token = await tokenManager.getTokenWithRefresh();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const userInfo = await AsyncStorage.getItem('userInfo');
      const user = JSON.parse(userInfo!);
      
      const authMessage: WebSocketMessage = {
        id: this.generateMessageId(),
        type: WebSocketEvent.AUTHENTICATE,
        data: {
          user_id: user.id,
          restaurant_id: user.restaurant_id,
          client_type: 'mobile_pos',
          client_version: '1.0.0'
        },
        restaurant_id: user.restaurant_id,
        timestamp: new Date().toISOString()
      };
      
      // Send auth with token in header format
      this.ws?.send(JSON.stringify({
        ...authMessage,
        token // Token sent in message, not URL
      }));
      
      // Set authentication timeout
      const authTimeout = setTimeout(() => {
        if (this.state === 'AUTHENTICATING') {
          console.error('❌ WebSocket authentication timeout');
          this.handleDisconnect(4002, 'Authentication timeout');
        }
      }, this.config.authTimeout);
      
      // Store timeout to clear on success
      this.once(WebSocketEvent.AUTHENTICATED, () => {
        clearTimeout(authTimeout);
      });
      
    } catch (error) {
      console.error('❌ WebSocket authentication failed:', error);
      this.handleDisconnect(4003, 'Authentication failed');
    }
  }
  
  private setupEventHandlers(): void {
    if (!this.ws) return;
    
    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    };
    
    this.ws.onclose = (event) => {
      console.log(`🔌 WebSocket disconnected: ${event.code} - ${event.reason}`);
      this.handleDisconnect(event.code, event.reason);
    };
    
    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.emit(WebSocketEvent.ERROR, error);
    };
  }
  
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case WebSocketEvent.AUTHENTICATED:
        this.handleAuthenticated();
        break;
        
      case WebSocketEvent.PONG:
        this.handlePong();
        break;
        
      case WebSocketEvent.PING:
        // Server ping, respond with pong
        this.send({
          id: this.generateMessageId(),
          type: WebSocketEvent.PONG,
          data: { timestamp: Date.now() },
          restaurant_id: message.restaurant_id,
          timestamp: new Date().toISOString()
        });
        break;
        
      case WebSocketEvent.AUTH_ERROR:
        console.error('❌ WebSocket auth error:', message.data);
        this.handleAuthError(message);
        break;
        
      default:
        // Business event, emit to listeners
        this.emit(message.type, message.data);
        break;
    }
  }
  
  private handleAuthenticated(): void {
    console.log('✅ WebSocket authenticated successfully');
    this.setState('CONNECTED');
    this.reconnectAttempts = 0;
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Process queued messages
    this.processMessageQueue();
    
    // Emit connected event
    this.emit(WebSocketEvent.CONNECT, { timestamp: Date.now() });
  }
  
  private handleAuthError(message: WebSocketMessage): void {
    console.error('❌ Authentication error:', message.data);
    
    // Try to refresh token and reconnect
    tokenManager.forceRefresh().then(() => {
      this.scheduleReconnect();
    }).catch(() => {
      this.emit(WebSocketEvent.AUTH_ERROR, message.data);
      this.setState('DISCONNECTED');
    });
  }
  
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const pingMessage: WebSocketMessage = {
          id: this.generateMessageId(),
          type: WebSocketEvent.PING,
          data: { timestamp: Date.now() },
          restaurant_id: '', // Will be set by send()
          timestamp: new Date().toISOString()
        };
        
        this.send(pingMessage);
        
        // Set pong timeout
        this.pongTimer = setTimeout(() => {
          this.missedPongs++;
          console.warn(`⚠️ Missed pong ${this.missedPongs}/${this.maxMissedPongs}`);
          
          if (this.missedPongs >= this.maxMissedPongs) {
            console.error('❌ Too many missed pongs, reconnecting...');
            this.handleDisconnect(4004, 'Heartbeat timeout');
          }
        }, this.config.pongTimeout);
      }
    }, this.config.heartbeatInterval);
  }
  
  private handlePong(): void {
    this.missedPongs = 0;
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    this.missedPongs = 0;
  }
  
  private handleDisconnect(code: number, reason: string): void {
    this.stopHeartbeat();
    this.setState('DISCONNECTED');
    
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws = null;
    }
    
    this.emit(WebSocketEvent.DISCONNECT, { code, reason });
    
    // Schedule reconnect for non-normal closures
    if (code !== 1000) {
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('max_reconnect_attempts', {
        attempts: this.reconnectAttempts
      });
      return;
    }
    
    const backoffIndex = Math.min(
      this.reconnectAttempts,
      this.reconnectBackoff.length - 1
    );
    const delay = this.reconnectBackoff[backoffIndex];
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.setState('RECONNECTING');
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  send(message: Partial<WebSocketMessage>): void {
    // Fill in required fields
    const fullMessage: WebSocketMessage = {
      id: message.id || this.generateMessageId(),
      type: message.type!,
      data: message.data,
      restaurant_id: message.restaurant_id || '',
      timestamp: message.timestamp || new Date().toISOString()
    };
    
    if (this.state === 'CONNECTED' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      // Queue message for later
      this.messageQueue.push(fullMessage);
      console.log(`📦 Message queued (${this.messageQueue.length} in queue)`);
    }
  }
  
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;
    
    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }
  }
  
  disconnect(): void {
    console.log('👋 Disconnecting WebSocket...');
    
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
    }
    
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    
    this.setState('DISCONNECTED');
    this.removeAllListeners();
  }
  
  // Event emitter methods
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }
  
  once(event: string, listener: Function): void {
    const onceWrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }
  
  off(event: string, listener: Function): void {
    this.listeners.get(event)?.delete(listener);
  }
  
  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in WebSocket listener for ${event}:`, error);
      }
    });
  }
  
  private removeAllListeners(): void {
    this.listeners.clear();
  }
  
  // Utilities
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      console.log(`🔄 WebSocket state: ${this.state} → ${newState}`);
      this.state = newState;
    }
  }
  
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  getState(): ConnectionState {
    return this.state;
  }
  
  isConnected(): boolean {
    return this.state === 'CONNECTED';
  }
}

// Export singleton instance
export const webSocketService = new EnhancedWebSocketService();
export default webSocketService;
```

### Afternoon Tasks (4 hours)

#### 2. Backend WebSocket Enhancement

**Location**: `backend/app/api/v1/endpoints/websocket.py`

```python
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Optional, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import verify_websocket_token
from app.core.database import get_db
from app.models.user import User
from app.schemas.websocket import WebSocketMessage, WebSocketEvent

logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectionInfo:
    def __init__(self, websocket: WebSocket, user_id: str, restaurant_id: str):
        self.websocket = websocket
        self.user_id = user_id
        self.restaurant_id = restaurant_id
        self.connected_at = datetime.utcnow()
        self.last_ping = datetime.utcnow()
        self.authenticated = False

class WebSocketManager:
    def __init__(self):
        # restaurant_id -> set of connections
        self.active_connections: Dict[str, Set[ConnectionInfo]] = {}
        # connection_id -> ConnectionInfo
        self.connection_map: Dict[str, ConnectionInfo] = {}
        # Limits
        self.max_connections_per_restaurant = 100
        self.max_connections_per_user = 5
        
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
        db: Session
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
                    WebSocketEvent.AUTH_ERROR,
                    "Missing authentication data"
                )
                return None
            
            # Verify token and user
            user = await verify_websocket_token(token, user_id, db)
            if not user:
                await self.send_error(
                    websocket,
                    WebSocketEvent.AUTH_ERROR,
                    "Invalid authentication token"
                )
                return None
            
            # Verify user has access to restaurant
            if user.restaurant_id != restaurant_id and user.role != 'platform_owner':
                await self.send_error(
                    websocket,
                    WebSocketEvent.AUTH_ERROR,
                    "Access denied to this restaurant"
                )
                return None
            
            # Check connection limits
            if not self._check_connection_limits(restaurant_id, user_id):
                await self.send_error(
                    websocket,
                    WebSocketEvent.AUTH_ERROR,
                    "Connection limit exceeded"
                )
                return None
            
            # Create connection info
            conn_info = ConnectionInfo(websocket, user_id, restaurant_id)
            conn_info.authenticated = True
            
            # Store connection
            if restaurant_id not in self.active_connections:
                self.active_connections[restaurant_id] = set()
            
            self.active_connections[restaurant_id].add(conn_info)
            self.connection_map[connection_id] = conn_info
            
            # Send authentication success
            await self.send_message(
                websocket,
                WebSocketEvent.AUTHENTICATED,
                {
                    "user_id": user_id,
                    "restaurant_id": restaurant_id,
                    "connection_id": connection_id
                }
            )
            
            logger.info(f"WebSocket authenticated: {connection_id} for user {user_id}")
            return conn_info
            
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            await self.send_error(
                websocket,
                WebSocketEvent.AUTH_ERROR,
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
        conn_info = self.connection_map.get(connection_id)
        if not conn_info:
            return
        
        # Remove from restaurant connections
        if conn_info.restaurant_id in self.active_connections:
            self.active_connections[conn_info.restaurant_id].discard(conn_info)
            
            # Clean up empty restaurant
            if not self.active_connections[conn_info.restaurant_id]:
                del self.active_connections[conn_info.restaurant_id]
        
        # Remove from connection map
        del self.connection_map[connection_id]
        
        logger.info(f"WebSocket disconnected: {connection_id}")
    
    async def handle_ping(self, connection_id: str):
        """Handle ping message"""
        conn_info = self.connection_map.get(connection_id)
        if conn_info:
            conn_info.last_ping = datetime.utcnow()
            await self.send_message(
                conn_info.websocket,
                WebSocketEvent.PONG,
                {"timestamp": datetime.utcnow().isoformat()}
            )
    
    async def broadcast_to_restaurant(
        self,
        restaurant_id: str,
        event: WebSocketEvent,
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
                await self.send_message(conn.websocket, event, data)
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
        event: WebSocketEvent,
        data: dict
    ):
        """Send message to specific WebSocket"""
        message = WebSocketMessage(
            id=f"{datetime.utcnow().timestamp()}",
            type=event,
            data=data,
            timestamp=datetime.utcnow().isoformat()
        )
        
        await websocket.send_json(message.dict())
    
    async def send_error(
        self,
        websocket: WebSocket,
        event: WebSocketEvent,
        error: str
    ):
        """Send error message"""
        await self.send_message(
            websocket,
            event,
            {"error": error}
        )
    
    def _get_connection_id(self, conn_info: ConnectionInfo) -> str:
        """Get connection ID for a connection"""
        for conn_id, conn in self.connection_map.items():
            if conn == conn_info:
                return conn_id
        return ""
    
    async def cleanup_stale_connections(self):
        """Remove stale connections (called periodically)"""
        current_time = datetime.utcnow()
        stale_connections = []
        
        for conn_id, conn_info in self.connection_map.items():
            # Consider connection stale if no ping for 60 seconds
            time_since_ping = (current_time - conn_info.last_ping).total_seconds()
            if time_since_ping > 60:
                stale_connections.append(conn_id)
        
        for conn_id in stale_connections:
            logger.warning(f"Removing stale connection: {conn_id}")
            await self.disconnect(conn_id)

# Global manager instance
manager = WebSocketManager()

@router.websocket("/ws/pos/{restaurant_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    restaurant_id: str,
    db: Session = Depends(get_db)
):
    """Main WebSocket endpoint"""
    connection_id = None
    
    try:
        # Accept connection
        connection_id = await manager.connect(websocket, restaurant_id)
        
        # Wait for authentication
        auth_timeout = 10  # seconds
        try:
            auth_data = await asyncio.wait_for(
                websocket.receive_text(),
                timeout=auth_timeout
            )
            auth_message = json.loads(auth_data)
            
            # Verify message type
            if auth_message.get("type") != WebSocketEvent.AUTHENTICATE:
                await manager.send_error(
                    websocket,
                    WebSocketEvent.AUTH_ERROR,
                    "First message must be authentication"
                )
                await websocket.close(code=4001, reason="Authentication required")
                return
            
            # Authenticate
            conn_info = await manager.authenticate(
                connection_id,
                websocket,
                auth_message.get("data", {}),
                db
            )
            
            if not conn_info:
                await websocket.close(code=4003, reason="Authentication failed")
                return
            
            # Handle messages
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                if message.get("type") == WebSocketEvent.PING:
                    await manager.handle_ping(connection_id)
                else:
                    # Process business messages
                    await process_message(connection_id, message, db)
                    
        except asyncio.TimeoutError:
            await manager.send_error(
                websocket,
                WebSocketEvent.AUTH_ERROR,
                "Authentication timeout"
            )
            await websocket.close(code=4002, reason="Authentication timeout")
            
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
            WebSocketEvent.ORDER_STATUS_CHANGED,
            {
                "order_id": order_id,
                "status": new_status,
                "updated_by": conn_info.user_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        )

# Background task to clean up stale connections
async def cleanup_task():
    """Periodic cleanup of stale connections"""
    while True:
        await asyncio.sleep(30)  # Run every 30 seconds
        await manager.cleanup_stale_connections()
```

#### 3. Update Main.py to Enable WebSocket

**Location**: `backend/app/main.py`

```python
# Re-enable the lifespan context manager
from contextlib import asynccontextmanager
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup
    logger.info("Starting up...")
    
    # Initialize Redis
    try:
        redis_client = await get_redis()
        await redis_client.ping()
        logger.info("✅ Redis connected successfully")
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
    
    # Start WebSocket cleanup task
    cleanup_task = asyncio.create_task(cleanup_websocket_connections())
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    
    # Cancel cleanup task
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    
    # Close Redis
    if redis_client:
        await redis_client.close()

app = FastAPI(
    title="Fynlo POS API",
    version="1.0.0",
    lifespan=lifespan  # Add lifespan back
)

async def cleanup_websocket_connections():
    """Background task to clean up stale WebSocket connections"""
    from app.api.v1.endpoints.websocket import manager
    
    while True:
        try:
            await asyncio.sleep(30)  # Every 30 seconds
            await manager.cleanup_stale_connections()
        except Exception as e:
            logger.error(f"WebSocket cleanup error: {e}")
```

### Cleanup Tasks

#### Remove Old WebSocket Code
- [ ] Delete `src/services/WebSocketService.ts` (old implementation)
- [ ] Remove duplicate WebSocket types from mobile app
- [ ] Delete commented WebSocket code in backend
- [ ] Remove mock WebSocket handlers
- [ ] Clean up unused WebSocket event handlers

---

## 📋 Day 4: Token Management & API Performance

### Morning Tasks (4 hours)

#### 1. Enhanced Token Manager

**Location**: `CashApp-iOS/CashAppPOS/src/utils/enhancedTokenManager.ts`

```typescript
import { AuthTokens, User } from '@fynlo/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { AUTH_CONFIG } from '../config/auth.config';

interface TokenCache {
  token: string | null;
  expiresAt: number | null;
  lastRefresh: number;
}

interface QueuedRequest {
  resolve: (token: string | null) => void;
  reject: (error: Error) => void;
}

class EnhancedTokenManager {
  private static instance: EnhancedTokenManager;
  
  // Mutex for token refresh
  private refreshPromise: Promise<string | null> | null = null;
  private requestQueue: QueuedRequest[] = [];
  
  // Token cache
  private tokenCache: TokenCache = {
    token: null,
    expiresAt: null,
    lastRefresh: 0
  };
  
  // Configuration
  private readonly refreshBuffer = 60; // Refresh 60 seconds before expiry
  private readonly minRefreshInterval = 5000; // Don't refresh more than once per 5s
  
  // Event listeners
  private listeners: Map<string, Set<Function>> = new Map();
  
  private constructor() {
    this.loadCachedToken();
    this.setupTokenRefreshTimer();
  }
  
  static getInstance(): EnhancedTokenManager {
    if (!EnhancedTokenManager.instance) {
      EnhancedTokenManager.instance = new EnhancedTokenManager();
    }
    return EnhancedTokenManager.instance;
  }
  
  private async loadCachedToken(): Promise<void> {
    try {
      const [token, sessionData] = await Promise.all([
        AsyncStorage.getItem('auth_token'),
        AsyncStorage.getItem('supabase_session')
      ]);
      
      if (token && sessionData) {
        const session = JSON.parse(sessionData);
        this.tokenCache = {
          token,
          expiresAt: session.expires_at,
          lastRefresh: Date.now()
        };
      }
    } catch (error) {
      console.error('Failed to load cached token:', error);
    }
  }
  
  async getTokenWithRefresh(): Promise<string | null> {
    // Mock auth bypass
    if (AUTH_CONFIG.USE_MOCK_AUTH) {
      return await AsyncStorage.getItem('auth_token');
    }
    
    // Check if token is valid
    if (this.isTokenValid()) {
      return this.tokenCache.token;
    }
    
    // If refresh is in progress, queue this request
    if (this.refreshPromise) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push({ resolve, reject });
      });
    }
    
    // Check minimum refresh interval
    const now = Date.now();
    if (now - this.tokenCache.lastRefresh < this.minRefreshInterval) {
      console.log('⏳ Token refresh too recent, using cached token');
      return this.tokenCache.token;
    }
    
    // Perform refresh
    return this.performRefresh();
  }
  
  private isTokenValid(): boolean {
    if (!this.tokenCache.token || !this.tokenCache.expiresAt) {
      return false;
    }
    
    // Validate JWT structure
    try {
      const parts = this.tokenCache.token.split('.');
      if (parts.length !== 3) {
        console.error('Invalid JWT structure');
        return false;
      }
      
      // Decode and validate payload
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      
      // Check expiration with buffer
      const expiresAt = Math.min(
        payload.exp || Infinity,
        this.tokenCache.expiresAt
      );
      
      return now < (expiresAt - this.refreshBuffer);
      
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }
  
  private async performRefresh(): Promise<string | null> {
    // Set refresh promise to prevent concurrent refreshes
    this.refreshPromise = this.doRefresh();
    
    try {
      const token = await this.refreshPromise;
      
      // Process queued requests
      this.processQueue(null, token);
      
      return token;
      
    } catch (error) {
      // Process queue with error
      this.processQueue(error as Error, null);
      throw error;
      
    } finally {
      // Clear refresh promise
      this.refreshPromise = null;
    }
  }
  
  private async doRefresh(): Promise<string | null> {
    try {
      console.log('🔄 Refreshing authentication token...');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Token refresh failed:', error);
        this.emit('token:refresh:failed', error);
        throw error;
      }
      
      if (!data.session) {
        const noSessionError = new Error('No session after refresh');
        this.emit('token:refresh:failed', noSessionError);
        throw noSessionError;
      }
      
      // Update cache
      this.tokenCache = {
        token: data.session.access_token,
        expiresAt: data.session.expires_at,
        lastRefresh: Date.now()
      };
      
      // Persist to storage
      await Promise.all([
        AsyncStorage.setItem('auth_token', data.session.access_token),
        AsyncStorage.setItem('supabase_session', JSON.stringify(data.session))
      ]);
      
      console.log('✅ Token refreshed successfully');
      this.emit('token:refreshed', data.session.access_token);
      
      // Reset refresh timer
      this.setupTokenRefreshTimer();
      
      return data.session.access_token;
      
    } catch (error) {
      console.error('❌ Error in token refresh:', error);
      this.emit('token:refresh:failed', error);
      
      // Clear invalid token
      this.tokenCache = {
        token: null,
        expiresAt: null,
        lastRefresh: Date.now()
      };
      
      throw error;
    }
  }
  
  private processQueue(error: Error | null, token: string | null): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];
    
    queue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });
  }
  
  private setupTokenRefreshTimer(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    if (!this.tokenCache.expiresAt) return;
    
    // Calculate time until refresh needed
    const now = Math.floor(Date.now() / 1000);
    const refreshAt = this.tokenCache.expiresAt - this.refreshBuffer;
    const delaySeconds = Math.max(refreshAt - now, 0);
    
    if (delaySeconds > 0) {
      console.log(`⏰ Scheduling token refresh in ${delaySeconds}s`);
      
      this.refreshTimer = setTimeout(() => {
        this.getTokenWithRefresh().catch(error => {
          console.error('Scheduled token refresh failed:', error);
        });
      }, delaySeconds * 1000);
    }
  }
  
  async forceRefresh(): Promise<string | null> {
    console.log('🔄 Forcing token refresh...');
    
    // Clear cache to force refresh
    this.tokenCache.expiresAt = 0;
    
    return this.getTokenWithRefresh();
  }
  
  async clearTokens(): Promise<void> {
    // Clear cache
    this.tokenCache = {
      token: null,
      expiresAt: null,
      lastRefresh: 0
    };
    
    // Clear storage
    await AsyncStorage.multiRemove([
      'auth_token',
      'supabase_session',
      'userInfo'
    ]);
    
    // Clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    this.emit('token:cleared');
  }
  
  // Event emitter methods
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }
  
  off(event: string, listener: Function): void {
    this.listeners.get(event)?.delete(listener);
  }
  
  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in token manager listener for ${event}:`, error);
      }
    });
  }
  
  // Singleton cleanup
  destroy(): void {
    this.clearTokens();
    this.listeners.clear();
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }
}

// Export singleton instance
export const tokenManager = EnhancedTokenManager.getInstance();
export default tokenManager;
```

### Afternoon Tasks (4 hours)

#### 2. API Performance Optimization

**Database Indexes** (`backend/alembic/versions/add_performance_indexes.py`):

```python
"""Add performance indexes

Revision ID: performance_indexes
Revises: latest
Create Date: 2025-01-XX
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Products indexes
    op.create_index(
        'idx_products_restaurant_active',
        'products',
        ['restaurant_id', 'is_active'],
        postgresql_where=sa.text('is_active = true')
    )
    
    op.create_index(
        'idx_products_category_active',
        'products',
        ['category_id', 'is_active'],
        postgresql_where=sa.text('is_active = true')
    )
    
    # Orders indexes
    op.create_index(
        'idx_orders_restaurant_status_created',
        'orders',
        ['restaurant_id', 'status', 'created_at']
    )
    
    op.create_index(
        'idx_orders_restaurant_date',
        'orders',
        ['restaurant_id', sa.text('DATE(created_at)')]
    )
    
    # Order items indexes
    op.create_index(
        'idx_order_items_order_id',
        'order_items',
        ['order_id']
    )
    
    # Users indexes
    op.create_index(
        'idx_users_supabase_id',
        'users',
        ['supabase_id']
    )
    
    op.create_index(
        'idx_users_restaurant_role',
        'users',
        ['restaurant_id', 'role'],
        postgresql_where=sa.text('is_active = true')
    )

def downgrade():
    op.drop_index('idx_products_restaurant_active')
    op.drop_index('idx_products_category_active')
    op.drop_index('idx_orders_restaurant_status_created')
    op.drop_index('idx_orders_restaurant_date')
    op.drop_index('idx_order_items_order_id')
    op.drop_index('idx_users_supabase_id')
    op.drop_index('idx_users_restaurant_role')
```

**Optimized Menu Endpoint** (`backend/app/api/v1/endpoints/products.py`):

```python
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func
import json
import asyncio
from datetime import datetime

from app.core.database import get_db
from app.core.redis_client import get_redis
from app.core.cache import CacheService
from app.models.product import Product, Category
from app.schemas.product import MenuItemResponse, CategoryResponse

router = APIRouter()

# Initialize cache service
cache_service = CacheService()

@router.get("/menu", response_model=List[MenuItemResponse])
async def get_menu_items_optimized(
    restaurant_id: str = Query(..., description="Restaurant ID"),
    category: Optional[str] = Query(None, description="Category ID filter"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get menu items with optimized performance
    - Eager loading to prevent N+1 queries
    - Redis caching with smart invalidation
    - Pagination for large menus
    - Query timeout protection
    """
    # Build cache key
    cache_key = f"menu:v3:{restaurant_id}:{category or 'all'}:{page}:{limit}:{include_inactive}"
    
    # Try cache first
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return cached_data
    
    # Build optimized query with eager loading
    query = select(Product).options(
        selectinload(Product.category),
        selectinload(Product.modifiers),
        selectinload(Product.variants),
        selectinload(Product.images)
    ).filter(Product.restaurant_id == restaurant_id)
    
    # Apply filters
    if not include_inactive:
        query = query.filter(Product.is_active == True)
    
    if category:
        query = query.filter(Product.category_id == category)
    
    # Add consistent ordering
    query = query.order_by(
        Product.sort_order.asc(),
        Product.name.asc()
    )
    
    # Apply pagination
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    
    # Execute with timeout
    try:
        result = await asyncio.wait_for(
            db.execute(query),
            timeout=5.0
        )
        products = result.scalars().all()
        
    except asyncio.TimeoutError:
        logger.error(f"Menu query timeout for restaurant {restaurant_id}")
        raise HTTPException(
            status_code=504,
            detail="Database query timeout - please try again"
        )
    
    # Transform to response format
    response_data = [
        MenuItemResponse(
            id=product.id,
            name=product.name,
            description=product.description,
            price=float(product.price),
            category_id=product.category_id,
            category_name=product.category.name if product.category else None,
            is_active=product.is_active,
            sort_order=product.sort_order,
            image_url=product.image_url,
            modifiers=[
                {
                    "id": mod.id,
                    "name": mod.name,
                    "price": float(mod.price),
                    "required": mod.required,
                    "options": mod.options
                } for mod in product.modifiers
            ] if product.modifiers else [],
            variants=[
                {
                    "id": var.id,
                    "name": var.name,
                    "price": float(var.price),
                    "sku": var.sku
                } for var in product.variants
            ] if product.variants else [],
            allergens=product.allergens or [],
            nutritional_info=product.nutritional_info,
            preparation_time=product.preparation_time,
            created_at=product.created_at.isoformat(),
            updated_at=product.updated_at.isoformat()
        ) for product in products
    ]
    
    # Cache for 5 minutes
    await cache_service.set(
        cache_key,
        response_data,
        ttl=300
    )
    
    return response_data

@router.get("/menu/categories", response_model=List[CategoryResponse])
async def get_menu_categories(
    restaurant_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get menu categories with product counts"""
    cache_key = f"menu_categories:v2:{restaurant_id}"
    
    # Try cache
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return cached_data
    
    # Query with product counts
    query = select(
        Category.id,
        Category.name,
        Category.description,
        Category.sort_order,
        Category.icon,
        func.count(Product.id).label('product_count')
    ).select_from(
        Category
    ).outerjoin(
        Product,
        (Product.category_id == Category.id) & 
        (Product.is_active == True)
    ).filter(
        Category.restaurant_id == restaurant_id,
        Category.is_active == True
    ).group_by(
        Category.id,
        Category.name,
        Category.description,
        Category.sort_order,
        Category.icon
    ).order_by(Category.sort_order.asc())
    
    result = await db.execute(query)
    categories = result.all()
    
    response_data = [
        CategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            sort_order=cat.sort_order,
            icon=cat.icon,
            product_count=cat.product_count
        )
        for cat in categories
    ]
    
    # Cache for 10 minutes
    await cache_service.set(
        cache_key,
        response_data,
        ttl=600
    )
    
    return response_data

# Cache invalidation endpoints
@router.post("/menu/cache/invalidate")
async def invalidate_menu_cache(
    restaurant_id: str = Query(...),
    current_user = Depends(get_current_user)
):
    """Invalidate menu cache for a restaurant"""
    # Verify user has permission
    if (current_user.restaurant_id != restaurant_id and 
        current_user.role not in ['platform_owner', 'restaurant_owner']):
        raise HTTPException(403, "Permission denied")
    
    # Invalidate all menu caches for restaurant
    await cache_service.invalidate_pattern(f"menu:*:{restaurant_id}:*")
    await cache_service.invalidate_pattern(f"menu_categories:*:{restaurant_id}")
    
    return {"success": True, "message": "Menu cache invalidated"}
```

### Cleanup Tasks

#### Remove Performance Bottlenecks
- [ ] Remove N+1 queries in all endpoints
- [ ] Delete synchronous database calls
- [ ] Remove unnecessary joins
- [ ] Clean up inefficient loops
- [ ] Delete unused database queries

---

## 📋 Day 5: Integration Testing & Final Cleanup

### Full Day Tasks (8 hours)

#### 1. Integration Test Suite

**WebSocket Integration Test**:
```typescript
// tests/integration/websocket.test.ts
import { webSocketService } from '../../src/services/websocket/EnhancedWebSocketService';
import { tokenManager } from '../../src/utils/enhancedTokenManager';

describe('WebSocket Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should handle connection lifecycle', async () => {
    // Test connection
    await webSocketService.connect();
    expect(webSocketService.getState()).toBe('CONNECTED');
    
    // Test heartbeat
    jest.advanceTimersByTime(15000);
    expect(webSocketService.isConnected()).toBe(true);
    
    // Test reconnection
    webSocketService.disconnect();
    expect(webSocketService.getState()).toBe('DISCONNECTED');
  });
  
  test('should handle token refresh during connection', async () => {
    // Mock token expiry
    jest.spyOn(tokenManager, 'isTokenValid').mockReturnValue(false);
    
    // Should trigger refresh
    const token = await tokenManager.getTokenWithRefresh();
    expect(token).toBeTruthy();
  });
});
```

#### 2. Final Code Cleanup

**Cleanup Checklist**:
- [ ] Remove ALL `console.log` statements
- [ ] Delete ALL commented code
- [ ] Remove mock data services
- [ ] Delete duplicate implementations
- [ ] Fix ALL TypeScript errors
- [ ] Remove unused imports
- [ ] Delete dead code paths
- [ ] Clean up test files

**Files to Delete**:
- `src/services/MockDataService.ts`
- `src/services/WebSocketService.ts` (old)
- `src/utils/tokenManager.ts` (old)
- `src/types/*.ts` (duplicates of shared)
- Any file with `.old` or `.backup` extension

#### 3. Documentation Update

Create a migration guide for other developers:
```markdown
# Migration to Shared Types

## What Changed
- All types now come from `@fynlo/shared`
- WebSocket service completely rewritten
- Token management uses mutex pattern
- API endpoints optimized with caching

## Migration Steps
1. Update all imports to use `@fynlo/shared`
2. Replace WebSocketService with EnhancedWebSocketService
3. Use new tokenManager singleton
4. Update API calls to use new endpoints

## Breaking Changes
- WebSocket connection URL format changed
- Token refresh API different
- Some type names updated for consistency
```

---

## ✅ Phase 1 Completion Checklist

### WebSocket
- [ ] Heartbeat mechanism working
- [ ] Reconnection with backoff
- [ ] Mobile network handling
- [ ] Authentication flow secure
- [ ] State machine implemented
- [ ] Message queuing working

### Token Management
- [ ] Mutex synchronization
- [ ] Request queue processing
- [ ] Automatic refresh timer
- [ ] Token validation
- [ ] Event emissions
- [ ] Error handling

### API Performance
- [ ] Database indexes added
- [ ] Eager loading implemented
- [ ] Redis caching working
- [ ] Query timeouts set
- [ ] Pagination added
- [ ] Cache invalidation

### Code Quality
- [ ] No console.log statements
- [ ] No commented code
- [ ] No mock data
- [ ] All TypeScript errors fixed
- [ ] Imports cleaned up
- [ ] Dead code removed

---

## 🚀 Next Steps

With critical fixes complete:
1. Platform dashboard integration begins
2. Bidirectional sync implementation
3. Performance monitoring setup
4. Production deployment preparation

**Continue to**: [Phase 2: Platform Integration](./PHASE_2_PLATFORM_INTEGRATION.md)