# Fynlo POS Implementation Guide
## Step-by-Step Setup and Issue Resolution

## Overview

This guide provides detailed, actionable steps to implement the monorepo structure, resolve current issues, and integrate your iOS app with web dashboards. Follow these steps in order for optimal results.

## Prerequisites

Before starting, ensure you have:
- Node.js 18+ installed
- Python 3.11+ installed
- Git configured
- Access to your GitHub repositories
- DigitalOcean and Supabase credentials
- Cursor IDE with Claude Code access

## Phase 1: Immediate Issue Resolution (Days 1-3)

### Step 1: Fix WebSocket Connection Issues

#### 1.1 Update WebSocket Service (Mobile App)

Replace the existing WebSocket service with this enhanced version:

```typescript
// mobile/CashAppPOS/src/services/websocket/EnhancedWebSocketService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';
import tokenManager from '../../utils/tokenManager';

interface WebSocketConfig {
  heartbeatInterval: number;
  maxReconnectAttempts: number;
  reconnectBackoff: number[];
  authTimeout: number;
}

export class EnhancedWebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;
  private isAuthenticated: boolean = false;
  private messageQueue: any[] = [];
  private listeners: Map<string, Function[]> = new Map();
  
  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      maxReconnectAttempts: 10,
      reconnectBackoff: [1000, 2000, 4000, 8000, 16000, 30000],
      authTimeout: 10000, // 10 seconds
      ...config
    };
  }
  
  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    
    this.isConnecting = true;
    
    try {
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (!userInfo) {
        throw new Error('No user authentication found');
      }
      
      const user = JSON.parse(userInfo);
      const restaurantId = user.restaurant_id;
      const userId = user.id;
      
      if (!restaurantId) {
        throw new Error('No restaurant associated with user');
      }
      
      // Build secure WebSocket URL (no token in URL)
      const wsProtocol = API_CONFIG.BASE_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_CONFIG.BASE_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/v1/websocket/ws/pos/${restaurantId}`;
      
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers(userId, restaurantId);
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.error('❌ WebSocket connection timeout');
          this.ws.close();
          this.scheduleReconnect();
        }
      }, 10000);
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connected, authenticating...');
        this.authenticate(userId, restaurantId);
      };
      
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }
  
  private setupEventHandlers(userId: string, restaurantId: string): void {
    if (!this.ws) return;
    
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    };
    
    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket disconnected:', event.code, event.reason);
      this.cleanup();
      
      if (event.code !== 1000) { // Not a normal closure
        this.scheduleReconnect();
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.emit('error', error);
    };
  }
  
  private async authenticate(userId: string, restaurantId: string): Promise<void> {
    try {
      const token = await tokenManager.getTokenWithRefresh();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const authMessage = {
        type: 'authenticate',
        token,
        user_id: userId,
        restaurant_id: restaurantId,
        client_type: 'mobile_pos',
        timestamp: Date.now()
      };
      
      this.send(authMessage);
      
      // Set authentication timeout
      const authTimeout = setTimeout(() => {
        if (!this.isAuthenticated) {
          console.error('❌ WebSocket authentication timeout');
          this.disconnect();
          this.scheduleReconnect();
        }
      }, this.config.authTimeout);
      
      // Clear timeout when authenticated
      this.once('authenticated', () => {
        clearTimeout(authTimeout);
      });
      
    } catch (error) {
      console.error('❌ WebSocket authentication failed:', error);
      this.disconnect();
      this.scheduleReconnect();
    }
  }
  
  private handleMessage(message: any): void {
    switch (message.type) {
      case 'authenticated':
        this.handleAuthenticated();
        break;
      case 'pong':
        this.handlePong();
        break;
      case 'ping':
        this.send({ type: 'pong', timestamp: Date.now() });
        break;
      case 'auth_error':
        this.handleAuthError(message);
        break;
      default:
        this.emit(message.type, message.data);
        break;
    }
  }
  
  private handleAuthenticated(): void {
    console.log('✅ WebSocket authenticated successfully');
    this.isAuthenticated = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    this.startHeartbeat();
    this.processMessageQueue();
    this.emit('connected');
  }
  
  private handleAuthError(message: any): void {
    console.error('❌ WebSocket authentication error:', message.error);
    this.isAuthenticated = false;
    
    // Try to refresh token and reconnect
    tokenManager.forceRefresh().then(() => {
      this.scheduleReconnect();
    }).catch(() => {
      this.emit('auth_failed', message.error);
    });
  }
  
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }
  
  private handlePong(): void {
    // Heartbeat received, connection is healthy
    console.log('💓 WebSocket heartbeat received');
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('max_reconnect_attempts');
      return;
    }
    
    const backoffIndex = Math.min(
      this.reconnectAttempts,
      this.config.reconnectBackoff.length - 1
    );
    const delay = this.config.reconnectBackoff[backoffIndex];
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is ready
      this.messageQueue.push(message);
    }
  }
  
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }
  
  disconnect(): void {
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }
  
  private cleanup(): void {
    this.isAuthenticated = false;
    this.isConnecting = false;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  // Event emitter methods
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }
  
  once(event: string, listener: Function): void {
    const onceWrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }
  
  off(event: string, listener: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  private emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const webSocketService = new EnhancedWebSocketService();
export default webSocketService;
```

#### 1.2 Update Backend WebSocket Handler

Update the backend WebSocket endpoint to handle the new authentication flow:

```python
# backend/app/api/v1/endpoints/websocket.py
@router.websocket("/ws/pos/{restaurant_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    restaurant_id: str,
    db: Session = Depends(get_db)
):
    connection_id = None
    try:
        await websocket.accept()
        
        # Wait for authentication message
        auth_timeout = 10  # 10 seconds
        try:
            auth_data = await asyncio.wait_for(
                websocket.receive_text(),
                timeout=auth_timeout
            )
            auth_message = json.loads(auth_data)
            
            if auth_message.get("type") != "authenticate":
                await websocket.close(code=4001, reason="Authentication required")
                return
            
            # Verify authentication
            token = auth_message.get("token")
            user_id = auth_message.get("user_id")
            
            if not await verify_websocket_access(restaurant_id, user_id, token, db=db):
                await websocket.close(code=4003, reason="Access denied")
                return
            
            # Establish connection
            connection_id = await websocket_manager.connect(
                websocket=websocket,
                restaurant_id=restaurant_id,
                user_id=user_id,
                connection_type=ConnectionType.POS
            )
            
            # Send authentication confirmation
            await websocket.send_text(json.dumps({
                "type": "authenticated",
                "connection_id": connection_id,
                "timestamp": datetime.now().isoformat()
            }))
            
            # Handle messages
            while True:
                try:
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    
                    if message.get("type") == "ping":
                        await websocket.send_text(json.dumps({
                            "type": "pong",
                            "timestamp": datetime.now().isoformat()
                        }))
                    else:
                        await handle_websocket_message(
                            connection_id, 
                            restaurant_id, 
                            message
                        )
                        
                except WebSocketDisconnect:
                    break
                except json.JSONDecodeError:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Invalid JSON format"
                    }))
                except Exception as e:
                    logger.error(f"WebSocket message handling error: {e}")
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Message processing failed"
                    }))
                    
        except asyncio.TimeoutError:
            await websocket.close(code=4002, reason="Authentication timeout")
            return
            
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close(code=4000, reason="Internal error")
    finally:
        if connection_id:
            await websocket_manager.disconnect(connection_id)
```

### Step 2: Fix Token Management Race Conditions

#### 2.1 Enhanced Token Manager

Replace the existing token manager with this improved version:

```typescript
// mobile/CashAppPOS/src/utils/enhancedTokenManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { AUTH_CONFIG } from '../config/auth.config';

interface TokenRefreshResult {
  token: string | null;
  expiresAt: number | null;
}

class EnhancedTokenManager {
  private static instance: EnhancedTokenManager;
  private refreshPromise: Promise<TokenRefreshResult> | null = null;
  private requestQueue: Array<{
    resolve: (token: string | null) => void;
    reject: (error: Error) => void;
  }> = [];
  private tokenCache: {
    token: string | null;
    expiresAt: number | null;
    lastRefresh: number;
  } = {
    token: null,
    expiresAt: null,
    lastRefresh: 0
  };
  private listeners: Map<string, Function[]> = new Map();
  private refreshBuffer: number = 60; // Refresh 60 seconds before expiry
  private minRefreshInterval: number = 5000; // Don't refresh more than once per 5 seconds
  
  private constructor() {
    this.loadCachedToken();
  }
  
  static getInstance(): EnhancedTokenManager {
    if (!EnhancedTokenManager.instance) {
      EnhancedTokenManager.instance = new EnhancedTokenManager();
    }
    return EnhancedTokenManager.instance;
  }
  
  private async loadCachedToken(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const sessionData = await AsyncStorage.getItem('supabase_session');
      
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
    // For mock auth, return stored token
    if (AUTH_CONFIG.USE_MOCK_AUTH) {
      return await AsyncStorage.getItem('auth_token');
    }
    
    // Check if we have a valid cached token
    if (this.isTokenValid()) {
      return this.tokenCache.token;
    }
    
    // Check if refresh is already in progress
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
    
    const now = Math.floor(Date.now() / 1000);
    return now < (this.tokenCache.expiresAt - this.refreshBuffer);
  }
  
  private async performRefresh(): Promise<string | null> {
    this.refreshPromise = this.doRefresh();
    
    try {
      const result = await this.refreshPromise;
      this.processQueue(null, result.token);
      return result.token;
    } catch (error) {
      this.processQueue(error as Error, null);
      throw error;
    } finally {
      this.refreshPromise = null;
    }
  }
  
  private async doRefresh(): Promise<TokenRefreshResult> {
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
      
      // Update storage
      await AsyncStorage.setItem('auth_token', data.session.access_token);
      await AsyncStorage.setItem('supabase_session', JSON.stringify(data.session));
      
      console.log('✅ Token refreshed successfully');
      this.emit('token:refreshed', data.session.access_token);
      
      return {
        token: data.session.access_token,
        expiresAt: data.session.expires_at
      };
      
    } catch (error) {
      console.error('❌ Error in token refresh:', error);
      this.emit('token:refresh:failed', error);
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
  
  async forceRefresh(): Promise<string | null> {
    console.log('🔄 Forcing token refresh...');
    this.tokenCache.expiresAt = 0; // Force refresh
    return this.getTokenWithRefresh();
  }
  
  async clearTokens(): Promise<void> {
    this.tokenCache = {
      token: null,
      expiresAt: null,
      lastRefresh: 0
    };
    
    await AsyncStorage.multiRemove([
      'auth_token',
      'supabase_session',
      'userInfo'
    ]);
    
    this.emit('token:cleared');
  }
  
  // Event emitter methods
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }
  
  off(event: string, listener: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  private emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in token manager event listener for ${event}:`, error);
        }
      });
    }
  }
}

export const enhancedTokenManager = EnhancedTokenManager.getInstance();
export default enhancedTokenManager;
```

### Step 3: Optimize Database Performance

#### 3.1 Add Database Indexes

Create a migration file to add critical indexes:

```sql
-- backend/alembic/versions/add_performance_indexes.sql
-- Add critical indexes for performance

-- Products table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_restaurant_active 
ON products(restaurant_id, is_active) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_active 
ON products(category_id, is_active) 
WHERE is_active = true;

-- Orders table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_restaurant_status_created 
ON orders(restaurant_id, status, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_restaurant_date 
ON orders(restaurant_id, DATE(created_at));

-- Order items table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id 
ON order_items(order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_id 
ON order_items(product_id);

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_supabase_id 
ON users(supabase_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_restaurant_role 
ON users(restaurant_id, role) 
WHERE is_active = true;

-- Restaurants table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_restaurants_owner_active 
ON restaurants(owner_id, is_active) 
WHERE is_active = true;

-- Staff members table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_restaurant_active 
ON staff_members(restaurant_id, is_active) 
WHERE is_active = true;

-- Inventory items table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_restaurant_active 
ON inventory_items(restaurant_id, is_active) 
WHERE is_active = true;

-- Loyalty transactions table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loyalty_customer_date 
ON loyalty_transactions(customer_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loyalty_restaurant_date 
ON loyalty_transactions(restaurant_id, created_at);
```

#### 3.2 Optimize Menu Endpoint

Replace the existing menu endpoint with this optimized version:

```python
# backend/app/api/v1/endpoints/products.py
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func
import json
import asyncio
from redis import Redis

from app.core.database import get_db
from app.core.redis_client import get_redis
from app.core.auth import get_current_user
from app.models.product import Product, Category
from app.schemas.product import MenuItemResponse

router = APIRouter()

@router.get("/menu", response_model=List[MenuItemResponse])
async def get_menu_items_optimized(
    restaurant_id: str = Query(...),
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_user = Depends(get_current_user)
):
    """
    Optimized menu endpoint with caching and pagination
    """
    try:
        # Build cache key
        cache_key = f"menu:v3:{restaurant_id}:{category or 'all'}:{page}:{limit}:{include_inactive}"
        
        # Try cache first
        cached_data = await redis.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        
        # Build optimized query with eager loading
        query = select(Product).options(
            selectinload(Product.category),
            selectinload(Product.modifiers),
            selectinload(Product.variants),
            selectinload(Product.images)
        ).filter(Product.restaurant_id == restaurant_id)
        
        # Filter by active status
        if not include_inactive:
            query = query.filter(Product.is_active == True)
        
        # Filter by category
        if category:
            query = query.filter(Product.category_id == category)
        
        # Add ordering for consistent pagination
        query = query.order_by(Product.sort_order.asc(), Product.name.asc())
        
        # Add pagination
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
            raise HTTPException(
                status_code=504,
                detail="Database query timeout - please try again"
            )
        
        # Transform to response format
        response_data = []
        for product in products:
            product_dict = {
                "id": product.id,
                "name": product.name,
                "description": product.description,
                "price": float(product.price),
                "category_id": product.category_id,
                "category_name": product.category.name if product.category else None,
                "is_active": product.is_active,
                "sort_order": product.sort_order,
                "modifiers": [
                    {
                        "id": mod.id,
                        "name": mod.name,
                        "price": float(mod.price),
                        "required": mod.required
                    } for mod in product.modifiers
                ] if product.modifiers else [],
                "variants": [
                    {
                        "id": var.id,
                        "name": var.name,
                        "price": float(var.price)
                    } for var in product.variants
                ] if product.variants else [],
                "images": [
                    {
                        "id": img.id,
                        "url": img.url,
                        "alt_text": img.alt_text
                    } for img in product.images
                ] if product.images else []
            }
            response_data.append(product_dict)
        
        # Cache for 5 minutes
        await redis.setex(
            cache_key,
            300,
            json.dumps(response_data, default=str)
        )
        
        return response_data
        
    except Exception as e:
        logger.error(f"Error in get_menu_items_optimized: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve menu items"
        )

@router.get("/menu/categories", response_model=List[dict])
async def get_menu_categories(
    restaurant_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_user = Depends(get_current_user)
):
    """
    Get menu categories with product counts
    """
    cache_key = f"menu_categories:v2:{restaurant_id}"
    
    # Try cache first
    cached_data = await redis.get(cache_key)
    if cached_data:
        return json.loads(cached_data)
    
    # Query categories with product counts
    query = select(
        Category.id,
        Category.name,
        Category.description,
        Category.sort_order,
        func.count(Product.id).label('product_count')
    ).select_from(
        Category
    ).outerjoin(
        Product,
        (Product.category_id == Category.id) & (Product.is_active == True)
    ).filter(
        Category.restaurant_id == restaurant_id,
        Category.is_active == True
    ).group_by(
        Category.id,
        Category.name,
        Category.description,
        Category.sort_order
    ).order_by(Category.sort_order.asc())
    
    result = await db.execute(query)
    categories = result.all()
    
    response_data = [
        {
            "id": cat.id,
            "name": cat.name,
            "description": cat.description,
            "sort_order": cat.sort_order,
            "product_count": cat.product_count
        }
        for cat in categories
    ]
    
    # Cache for 10 minutes
    await redis.setex(
        cache_key,
        600,
        json.dumps(response_data)
    )
    
    return response_data
```

#### 3.3 Configure Database Connection Pooling

Update the database configuration:

```python
# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Optimized engine configuration
engine = create_async_engine(
    settings.DATABASE_URL,
    # Connection pool settings
    pool_size=20,              # Number of connections to maintain
    max_overflow=30,           # Additional connections when pool is full
    pool_pre_ping=True,        # Validate connections before use
    pool_recycle=3600,         # Recycle connections every hour
    # Performance settings
    echo=False,                # Disable SQL logging in production
    future=True,               # Use SQLAlchemy 2.0 style
    # Connection timeout settings
    connect_args={
        "command_timeout": 30,  # 30 second query timeout
        "server_settings": {
            "application_name": "fynlo_pos_api",
            "jit": "off"        # Disable JIT for consistent performance
        }
    }
)

# Async session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

## Phase 2: Monorepo Setup (Days 4-7)

### Step 4: Create Monorepo Structure

#### 4.1 Setup Script

Create a setup script to automate the monorepo creation:

```bash
#!/bin/bash
# scripts/setup-monorepo.sh

set -e

echo "🚀 Setting up Fynlo POS Monorepo..."

# Create new directory structure
mkdir -p shared/{types,utils,config}
mkdir -p docs/{api,integration,deployment,troubleshooting}
mkdir -p scripts

# Move existing directories
echo "📁 Reorganizing directories..."
if [ -d "CashApp-iOS" ]; then
    mv CashApp-iOS mobile
fi

# Clone platform dashboard if not exists
if [ ! -d "web-platform" ]; then
    echo "📥 Cloning platform dashboard..."
    git clone https://github.com/Lucid-Directions/fynlo-platform-launchpad.git web-platform
    rm -rf web-platform/.git
fi

# Create shared package.json
echo "📦 Creating shared package.json..."
cat > shared/package.json << 'EOF'
{
  "name": "@fynlo/shared",
  "version": "1.0.0",
  "description": "Shared types and utilities for Fynlo POS",
  "main": "index.ts",
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "@types/node": "^20.0.0"
  }
}
EOF

# Create root package.json for workspace
echo "📦 Creating root package.json..."
cat > package.json << 'EOF'
{
  "name": "fynlo-pos-monorepo",
  "version": "1.0.0",
  "description": "Fynlo POS - Unified Mobile and Web Platform",
  "private": true,
  "workspaces": [
    "shared",
    "mobile/CashAppPOS",
    "web-platform"
  ],
  "scripts": {
    "install:all": "npm install && npm run install:mobile && npm run install:web",
    "install:mobile": "cd mobile/CashAppPOS && npm install",
    "install:web": "cd web-platform && npm install",
    "install:shared": "cd shared && npm install",
    "build:shared": "cd shared && npm run build",
    "type-check": "npm run type-check:shared && npm run type-check:mobile && npm run type-check:web",
    "type-check:shared": "cd shared && npm run type-check",
    "type-check:mobile": "cd mobile/CashAppPOS && npx tsc --noEmit",
    "type-check:web": "cd web-platform && npx tsc --noEmit",
    "test": "npm run test:mobile && npm run test:web",
    "test:mobile": "cd mobile/CashAppPOS && npm test",
    "test:web": "cd web-platform && npm test",
    "lint": "npm run lint:mobile && npm run lint:web",
    "lint:mobile": "cd mobile/CashAppPOS && npm run lint",
    "lint:web": "cd web-platform && npm run lint"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "typescript": "^5.2.2"
  }
}
EOF

# Create TypeScript config for shared
echo "⚙️ Creating TypeScript configuration..."
cat > shared/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./",
    "resolveJsonModule": true
  },
  "include": [
    "**/*.ts",
    "**/*.tsx"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
EOF

# Create shared types
echo "📝 Creating shared types..."
mkdir -p shared/types

# Create basic API types
cat > shared/types/api.ts << 'EOF'
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  data?: any;
}
EOF

# Create auth types
cat > shared/types/auth.ts << 'EOF'
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  restaurant_id?: string;
  platform_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UserRole = 
  | 'platform_owner' 
  | 'restaurant_owner' 
  | 'manager' 
  | 'employee';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
EOF

# Create restaurant types
cat > shared/types/restaurant.ts << 'EOF'
export interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  settings: RestaurantSettings;
  subscription_tier: SubscriptionTier;
  is_active: boolean;
  owner_id: string;
  platform_id: string;
  created_at: string;
  updated_at: string;
}

export type SubscriptionTier = 'alpha' | 'beta' | 'gamma';

export interface RestaurantSettings {
  currency: string;
  timezone: string;
  tax_rate: number;
  service_charge: number;
  payment_methods: PaymentMethod[];
  operating_hours: OperatingHours;
  receipt_settings: ReceiptSettings;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'cash' | 'card' | 'qr' | 'online';
  is_active: boolean;
  settings: Record<string, any>;
}

export interface OperatingHours {
  [key: string]: {
    open: string;
    close: string;
    is_closed: boolean;
  };
}

export interface ReceiptSettings {
  header_text: string;
  footer_text: string;
  show_logo: boolean;
  logo_url?: string;
}
EOF

# Create order types
cat > shared/types/orders.ts << 'EOF'
export interface Order {
  id: string;
  order_number: string;
  restaurant_id: string;
  customer_id?: string;
  table_number?: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax_amount: number;
  service_charge: number;
  discount_amount: number;
  total_amount: number;
  payment_status: PaymentStatus;
  payment_method?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'served' 
  | 'completed' 
  | 'cancelled';

export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'refunded';

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  modifiers: OrderItemModifier[];
  special_instructions?: string;
}

export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
}

export interface CreateOrderRequest {
  restaurant_id: string;
  customer_id?: string;
  table_number?: string;
  items: Omit<OrderItem, 'id'>[];
  notes?: string;
}
EOF

# Create WebSocket types
cat > shared/types/websocket.ts << 'EOF'
export interface WebSocketMessage<T = any> {
  id: string;
  type: WebSocketEventType;
  data: T;
  restaurant_id: string;
  user_id?: string;
  timestamp: string;
}

export enum WebSocketEventType {
  // Connection events
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  AUTHENTICATED = 'authenticated',
  AUTH_ERROR = 'auth_error',
  
  // System events
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',
  
  // Business events
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_STATUS_CHANGED = 'order.status_changed',
  PAYMENT_PROCESSED = 'payment.processed',
  INVENTORY_UPDATED = 'inventory.updated',
  MENU_UPDATED = 'menu.updated',
  STAFF_UPDATE = 'staff.update',
  LOYALTY_POINTS_EARNED = 'loyalty.points_earned',
  QR_CAMPAIGN_CLAIMED = 'qr_campaign.claimed'
}

export interface WebSocketConfig {
  url: string;
  heartbeatInterval: number;
  maxReconnectAttempts: number;
  reconnectBackoff: number[];
  authTimeout: number;
}
EOF

# Create index file for shared types
cat > shared/types/index.ts << 'EOF'
export * from './api';
export * from './auth';
export * from './restaurant';
export * from './orders';
export * from './websocket';
EOF

# Create shared utilities
echo "🔧 Creating shared utilities..."
mkdir -p shared/utils

# Create API client utility
cat > shared/utils/api-client.ts << 'EOF'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { APIResponse, RequestOptions } from '../types/api';

export interface TokenManager {
  getTokenWithRefresh(): Promise<string | null>;
  forceRefresh(): Promise<string | null>;
}

export class UnifiedAPIClient {
  private baseURL: string;
  private tokenManager: TokenManager;
  private defaultTimeout: number = 15000;
  
  constructor(baseURL: string, tokenManager: TokenManager) {
    this.baseURL = baseURL;
    this.tokenManager = tokenManager;
  }
  
  async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<APIResponse<T>> {
    const config: AxiosRequestConfig = {
      url: `${this.baseURL}${endpoint}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || this.defaultTimeout,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    // Add authentication
    const token = await this.tokenManager.getTokenWithRefresh();
    if (token) {
      config.headers!.Authorization = `Bearer ${token}`;
    }
    
    // Implement retry logic
    return this.executeWithRetry(config, options.retries || 3);
  }
  
  private async executeWithRetry<T>(
    config: AxiosRequestConfig,
    maxRetries: number
  ): Promise<APIResponse<T>> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response: AxiosResponse = await axios(config);
        return {
          success: true,
          data: response.data,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) break;
        
        // Handle 401 errors with token refresh
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          await this.tokenManager.forceRefresh();
          const newToken = await this.tokenManager.getTokenWithRefresh();
          if (newToken) {
            config.headers!.Authorization = `Bearer ${newToken}`;
          }
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return {
      success: false,
      error: lastError.message,
      timestamp: new Date().toISOString()
    };
  }
  
  // Convenience methods
  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }
  
  async post<T>(endpoint: string, data?: any, options?: Omit<RequestOptions, 'method' | 'data'>): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', data });
  }
  
  async put<T>(endpoint: string, data?: any, options?: Omit<RequestOptions, 'method' | 'data'>): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', data });
  }
  
  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}
EOF

# Create shared constants
cat > shared/config/constants.ts << 'EOF'
export const API_ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: '/auth/login',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_ME: '/auth/me',
  
  // Restaurant Management
  RESTAURANTS: '/restaurants',
  RESTAURANT_DETAILS: '/restaurants/:id',
  RESTAURANT_SETTINGS: '/restaurants/:id/settings',
  
  // Menu Management
  MENU_ITEMS: '/restaurants/:id/menu',
  MENU_CATEGORIES: '/restaurants/:id/menu/categories',
  
  // Order Management
  ORDERS: '/restaurants/:id/orders',
  ORDER_DETAILS: '/restaurants/:id/orders/:orderId',
  ORDER_STATUS: '/restaurants/:id/orders/:orderId/status',
  
  // Staff Management
  STAFF: '/restaurants/:id/staff',
  
  // Analytics
  ANALYTICS_SALES: '/restaurants/:id/analytics/sales',
  ANALYTICS_PRODUCTS: '/restaurants/:id/analytics/products',
  
  // Platform (Owner only)
  PLATFORM_OVERVIEW: '/platform/overview',
  PLATFORM_RESTAURANTS: '/platform/restaurants',
  PLATFORM_SETTINGS: '/platform/settings'
};

export const WEBSOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTHENTICATE: 'authenticate',
  
  // Orders
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  
  // Payments
  PAYMENT_PROCESSED: 'payment.processed',
  
  // Inventory
  INVENTORY_UPDATED: 'inventory.updated',
  
  // Loyalty
  LOYALTY_POINTS_EARNED: 'loyalty.points_earned',
  QR_CAMPAIGN_CLAIMED: 'qr_campaign.claimed'
};

export const ORDER_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded'
} as const;

export const USER_ROLES = {
  PLATFORM_OWNER: 'platform_owner',
  RESTAURANT_OWNER: 'restaurant_owner',
  MANAGER: 'manager',
  EMPLOYEE: 'employee'
} as const;

export const SUBSCRIPTION_TIERS = {
  ALPHA: 'alpha',
  BETA: 'beta',
  GAMMA: 'gamma'
} as const;
EOF

# Create shared index
cat > shared/index.ts << 'EOF'
export * from './types';
export * from './utils/api-client';
export * from './config/constants';
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Monorepo setup complete!"
echo ""
echo "Next steps:"
echo "1. Update mobile app to use shared types: npm run type-check:mobile"
echo "2. Update web platform to use shared types: npm run type-check:web"
echo "3. Run tests: npm test"
echo "4. Start development: npm run dev"
```

Make the script executable and run it:

```bash
chmod +x scripts/setup-monorepo.sh
./scripts/setup-monorepo.sh
```

### Step 5: Update Mobile App to Use Shared Types

#### 5.1 Update Mobile App Package.json

Add the shared package as a dependency:

```json
// mobile/CashAppPOS/package.json
{
  "dependencies": {
    "@fynlo/shared": "file:../../shared",
    // ... other dependencies
  }
}
```

#### 5.2 Update Mobile Services

Update the DataService to use shared types:

```typescript
// mobile/CashAppPOS/src/services/DataService.ts
import { UnifiedAPIClient, APIResponse } from '@fynlo/shared';
import { Order, CreateOrderRequest, Restaurant, User } from '@fynlo/shared';
import enhancedTokenManager from '../utils/enhancedTokenManager';
import API_CONFIG from '../config/api';

class DataService {
  private apiClient: UnifiedAPIClient;
  
  constructor() {
    this.apiClient = new UnifiedAPIClient(
      API_CONFIG.FULL_API_URL,
      enhancedTokenManager
    );
  }
  
  // Menu methods
  async getMenuItems(
    restaurantId: string,
    category?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<any[]> {
    const params = new URLSearchParams({
      restaurant_id: restaurantId,
      page: page.toString(),
      limit: limit.toString()
    });
    
    if (category) {
      params.append('category', category);
    }
    
    const response = await this.apiClient.get<any[]>(`/menu?${params}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch menu items');
    }
    
    return response.data || [];
  }
  
  // Order methods
  async createOrder(orderData: CreateOrderRequest): Promise<Order> {
    const response = await this.apiClient.post<Order>('/orders', orderData);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to create order');
    }
    
    return response.data!;
  }
  
  async getOrders(
    restaurantId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<Order[]> {
    const params = new URLSearchParams({
      restaurant_id: restaurantId,
      page: page.toString(),
      limit: limit.toString()
    });
    
    const response = await this.apiClient.get<Order[]>(`/orders?${params}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch orders');
    }
    
    return response.data || [];
  }
  
  async updateOrderStatus(
    orderId: string,
    status: string,
    restaurantId: string
  ): Promise<Order> {
    const response = await this.apiClient.put<Order>(
      `/orders/${orderId}/status`,
      { status, restaurant_id: restaurantId }
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to update order status');
    }
    
    return response.data!;
  }
  
  // Restaurant methods
  async getRestaurantDetails(restaurantId: string): Promise<Restaurant> {
    const response = await this.apiClient.get<Restaurant>(`/restaurants/${restaurantId}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch restaurant details');
    }
    
    return response.data!;
  }
  
  // User methods
  async getCurrentUser(): Promise<User> {
    const response = await this.apiClient.get<User>('/auth/me');
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch user details');
    }
    
    return response.data!;
  }
}

export default DataService;
```

### Step 6: Update Web Platform to Use Shared Types

#### 6.1 Update Web Platform Package.json

```json
// web-platform/package.json
{
  "dependencies": {
    "@fynlo/shared": "file:../shared",
    // ... other dependencies
  }
}
```

#### 6.2 Create Web API Service

```typescript
// web-platform/src/services/api/ApiService.ts
import { UnifiedAPIClient } from '@fynlo/shared';
import { Order, Restaurant, User } from '@fynlo/shared';
import { supabase } from '../../integrations/supabase/client';

// Token manager for web platform
class WebTokenManager {
  async getTokenWithRefresh(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return null;
    
    // Check if token needs refresh
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && now >= (session.expires_at - 60)) {
      const { data } = await supabase.auth.refreshSession();
      return data.session?.access_token || null;
    }
    
    return session.access_token;
  }
  
  async forceRefresh(): Promise<string | null> {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token || null;
  }
}

class ApiService {
  private apiClient: UnifiedAPIClient;
  
  constructor() {
    const baseURL = import.meta.env.VITE_API_URL || 'https://api.fynlo.co.uk';
    this.apiClient = new UnifiedAPIClient(baseURL, new WebTokenManager());
  }
  
  // Restaurant methods
  async getRestaurants(): Promise<Restaurant[]> {
    const response = await this.apiClient.get<Restaurant[]>('/platform/restaurants');
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch restaurants');
    }
    
    return response.data || [];
  }
  
  async getRestaurantDetails(restaurantId: string): Promise<Restaurant> {
    const response = await this.apiClient.get<Restaurant>(`/restaurants/${restaurantId}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch restaurant details');
    }
    
    return response.data!;
  }
  
  // Order methods
  async getRestaurantOrders(
    restaurantId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<Order[]> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });
    
    const response = await this.apiClient.get<Order[]>(
      `/restaurants/${restaurantId}/orders?${params}`
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch orders');
    }
    
    return response.data || [];
  }
  
  // Analytics methods
  async getRestaurantAnalytics(
    restaurantId: string,
    period: string = '7d'
  ): Promise<any> {
    const response = await this.apiClient.get(
      `/restaurants/${restaurantId}/analytics/sales?period=${period}`
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch analytics');
    }
    
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
```

## Phase 3: Testing and Deployment (Days 8-10)

### Step 7: Comprehensive Testing

#### 7.1 Create Test Scripts

```bash
#!/bin/bash
# scripts/test-all.sh

echo "🧪 Running comprehensive tests..."

# Test shared types
echo "📝 Testing shared types..."
cd shared && npm run type-check
if [ $? -ne 0 ]; then
    echo "❌ Shared types test failed"
    exit 1
fi

# Test mobile app
echo "📱 Testing mobile app..."
cd ../mobile/CashAppPOS && npm run type-check
if [ $? -ne 0 ]; then
    echo "❌ Mobile app type check failed"
    exit 1
fi

# Test web platform
echo "🌐 Testing web platform..."
cd ../../web-platform && npm run type-check
if [ $? -ne 0 ]; then
    echo "❌ Web platform type check failed"
    exit 1
fi

# Run unit tests
echo "🔬 Running unit tests..."
cd ../mobile/CashAppPOS && npm test -- --watchAll=false
cd ../../web-platform && npm test -- --watchAll=false

echo "✅ All tests passed!"
```

#### 7.2 Performance Testing

Create a performance test script:

```typescript
// scripts/performance-test.ts
import axios from 'axios';

interface PerformanceResult {
  endpoint: string;
  averageTime: number;
  minTime: number;
  maxTime: number;
  successRate: number;
}

class PerformanceTester {
  private baseURL: string;
  private authToken: string;
  
  constructor(baseURL: string, authToken: string) {
    this.baseURL = baseURL;
    this.authToken = authToken;
  }
  
  async testEndpoint(
    endpoint: string,
    iterations: number = 10
  ): Promise<PerformanceResult> {
    const times: number[] = [];
    let successCount = 0;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        await axios.get(`${this.baseURL}${endpoint}`, {
          headers: { Authorization: `Bearer ${this.authToken}` },
          timeout: 30000
        });
        
        const endTime = Date.now();
        times.push(endTime - startTime);
        successCount++;
      } catch (error) {
        console.error(`Request ${i + 1} failed:`, error.message);
      }
    }
    
    return {
      endpoint,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      successRate: (successCount / iterations) * 100
    };
  }
  
  async runPerformanceTests(): Promise<PerformanceResult[]> {
    const endpoints = [
      '/health',
      '/auth/me',
      '/menu?restaurant_id=test-restaurant&limit=50',
      '/orders?restaurant_id=test-restaurant&limit=20',
      '/restaurants/test-restaurant'
    ];
    
    const results: PerformanceResult[] = [];
    
    for (const endpoint of endpoints) {
      console.log(`Testing ${endpoint}...`);
      const result = await this.testEndpoint(endpoint, 10);
      results.push(result);
      
      console.log(`✅ ${endpoint}: ${result.averageTime.toFixed(2)}ms avg, ${result.successRate}% success`);
    }
    
    return results;
  }
}

// Usage
async function runTests() {
  const tester = new PerformanceTester(
    'https://api.fynlo.co.uk/api/v1',
    process.env.TEST_AUTH_TOKEN || ''
  );
  
  const results = await tester.runPerformanceTests();
  
  console.log('\n📊 Performance Test Results:');
  results.forEach(result => {
    console.log(`${result.endpoint}:`);
    console.log(`  Average: ${result.averageTime.toFixed(2)}ms`);
    console.log(`  Range: ${result.minTime}ms - ${result.maxTime}ms`);
    console.log(`  Success Rate: ${result.successRate}%`);
    console.log('');
  });
}

if (require.main === module) {
  runTests().catch(console.error);
}
```

### Step 8: Deployment Configuration

#### 8.1 Update CI/CD Pipeline

```yaml
# .github/workflows/monorepo-ci.yml
name: Fynlo POS Monorepo CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  PYTHON_VERSION: '3.11'

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.changes.outputs.backend }}
      mobile: ${{ steps.changes.outputs.mobile }}
      web: ${{ steps.changes.outputs.web }}
      shared: ${{ steps.changes.outputs.shared }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: changes
        with:
          filters: |
            backend:
              - 'backend/**'
              - 'shared/**'
            mobile:
              - 'mobile/**'
              - 'shared/**'
            web:
              - 'web-platform/**'
              - 'shared/**'
            shared:
              - 'shared/**'

  test-shared:
    needs: detect-changes
    if: ${{ needs.detect-changes.outputs.shared == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - name: Install dependencies
        run: |
          cd shared
          npm ci
      - name: Type check
        run: |
          cd shared
          npm run type-check
      - name: Build
        run: |
          cd shared
          npm run build

  test-backend:
    needs: detect-changes
    if: ${{ needs.detect-changes.outputs.backend == 'true' }}
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: fynlo_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-asyncio
      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/fynlo_test
          REDIS_URL: redis://localhost:6379
          SECRET_KEY: test-secret-key
        run: |
          cd backend
          pytest tests/ --cov=app --cov-report=xml --cov-report=html
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./backend/coverage.xml

  test-mobile:
    needs: [detect-changes, test-shared]
    if: ${{ needs.detect-changes.outputs.mobile == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - name: Install root dependencies
        run: npm ci
      - name: Install mobile dependencies
        run: |
          cd mobile/CashAppPOS
          npm ci
      - name: Type check
        run: |
          cd mobile/CashAppPOS
          npx tsc --noEmit
      - name: Run tests
        run: |
          cd mobile/CashAppPOS
          npm test -- --coverage --watchAll=false

  test-web:
    needs: [detect-changes, test-shared]
    if: ${{ needs.detect-changes.outputs.web == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - name: Install root dependencies
        run: npm ci
      - name: Install web dependencies
        run: |
          cd web-platform
          npm ci
      - name: Type check
        run: |
          cd web-platform
          npx tsc --noEmit
      - name: Build
        run: |
          cd web-platform
          npm run build
      - name: Run tests
        run: |
          cd web-platform
          npm test -- --coverage --watchAll=false

  deploy-backend:
    needs: [test-backend]
    if: ${{ github.ref == 'refs/heads/main' && needs.detect-changes.outputs.backend == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to DigitalOcean
        env:
          DIGITALOCEAN_ACCESS_TOKEN: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
          DO_APP_ID: ${{ secrets.DO_APP_ID }}
        run: |
          # Install doctl
          curl -sL https://github.com/digitalocean/doctl/releases/download/v1.94.0/doctl-1.94.0-linux-amd64.tar.gz | tar -xzv
          sudo mv doctl /usr/local/bin
          
          # Authenticate
          doctl auth init -t $DIGITALOCEAN_ACCESS_TOKEN
          
          # Deploy
          doctl apps create-deployment $DO_APP_ID --wait

  deploy-web:
    needs: [test-web]
    if: ${{ github.ref == 'refs/heads/main' && needs.detect-changes.outputs.web == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - name: Install dependencies and build
        run: |
          npm ci
          cd web-platform
          npm run build
      - name: Deploy to Vercel
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          npx vercel --token $VERCEL_TOKEN --prod --yes
```

This implementation guide provides detailed, step-by-step instructions to resolve your current issues and set up the integrated monorepo structure. Each step includes specific code examples and can be executed independently, allowing you to implement the changes gradually while maintaining system stability.

