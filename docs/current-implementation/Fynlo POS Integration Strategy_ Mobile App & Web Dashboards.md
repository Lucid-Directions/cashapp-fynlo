# Fynlo POS Integration Strategy: Mobile App & Web Dashboards
## Updated Comprehensive Plan (January 2025)

## Executive Summary

This document outlines the complete strategy for integrating your Fynlo POS iOS application with the web dashboard platform, while simultaneously addressing critical performance and stability issues in the existing system. The approach combines immediate issue resolution with long-term architectural improvements to create a unified, scalable platform.

## Current State Assessment

### Platform Dashboard Repository Analysis
Your platform dashboard has evolved significantly with:
- **Advanced Loyalty Program Features**: QR campaign management with sophisticated tracking
- **Comprehensive API Configuration**: Well-structured endpoint mapping aligned with your FastAPI backend
- **Enhanced Database Schema**: Supabase integration with proper RLS policies
- **Modern Tech Stack**: React + TypeScript + Supabase with edge functions

### Main POS Repository Critical Issues
Analysis reveals several blocking issues:
- **WebSocket Instability**: Connection drops, missing heartbeat, poor reconnection logic
- **API Performance**: 10+ second response times, N+1 queries, missing caching
- **Token Management**: Race conditions causing 401 errors and authentication failures
- **Database Bottlenecks**: Missing indexes, no connection pooling, inefficient queries

## Unified Development Strategy

### Recommended Monorepo Structure

```
cashapp-fynlo/
├── backend/                           # Your existing FastAPI backend
│   ├── app/
│   │   ├── api/v1/                   # API endpoints
│   │   ├── core/                     # Core services (WebSocket, auth, etc.)
│   │   ├── models/                   # Database models
│   │   └── services/                 # Business logic
│   ├── requirements.txt
│   └── alembic/                      # Database migrations
│
├── mobile/                           # Renamed from CashApp-iOS
│   ├── CashAppPOS/                   # React Native app
│   │   ├── src/
│   │   │   ├── services/             # API and WebSocket services
│   │   │   ├── screens/              # UI screens
│   │   │   ├── store/                # Zustand state management
│   │   │   └── utils/                # Utilities (tokenManager, etc.)
│   │   ├── ios/                      # iOS specific files
│   │   └── package.json
│   └── docs/                         # Mobile app documentation
│
├── web-platform/                     # Cloned from platform-launchpad
│   ├── src/
│   │   ├── components/
│   │   │   ├── platform/             # Platform owner dashboard
│   │   │   └── restaurant/           # Restaurant manager dashboard
│   │   ├── config/
│   │   │   └── api.config.ts         # API endpoint configuration
│   │   ├── integrations/
│   │   │   └── supabase/             # Supabase client and types
│   │   └── services/
│   ├── supabase/
│   │   ├── functions/                # Edge functions (loyalty, etc.)
│   │   └── migrations/               # Database schema
│   └── package.json
│
├── shared/                           # NEW: Shared code and types
│   ├── types/                        # TypeScript type definitions
│   │   ├── api.ts                    # API request/response types
│   │   ├── auth.ts                   # Authentication types
│   │   ├── restaurant.ts             # Restaurant data models
│   │   ├── orders.ts                 # Order management types
│   │   ├── loyalty.ts                # Loyalty program types
│   │   └── websocket.ts              # WebSocket message types
│   ├── utils/                        # Shared utilities
│   │   ├── api-client.ts             # Unified API client
│   │   ├── auth-helpers.ts           # Authentication utilities
│   │   ├── validation.ts             # Data validation schemas
│   │   └── constants.ts              # Shared constants
│   ├── config/                       # Shared configuration
│   │   ├── endpoints.ts              # API endpoint definitions
│   │   └── environments.ts           # Environment configurations
│   └── package.json                  # Shared dependencies
│
├── docs/                             # Project documentation
│   ├── api/                          # API documentation
│   ├── integration/                  # Integration guides
│   ├── deployment/                   # Deployment procedures
│   └── troubleshooting/              # Issue resolution guides
│
├── scripts/                          # Development and deployment scripts
│   ├── setup-monorepo.sh            # Initial setup script
│   ├── sync-types.sh                # Type synchronization
│   └── deploy.sh                     # Deployment automation
│
├── .github/                          # GitHub workflows
│   └── workflows/
│       ├── backend-ci.yml            # Backend testing and deployment
│       ├── mobile-ci.yml             # Mobile app testing
│       └── web-ci.yml                # Web platform testing
│
├── docker-compose.yml                # Local development environment
├── package.json                     # Root package.json for workspace
└── README.md                         # Project overview and setup
```

### Benefits of This Structure

1. **Unified Context for Claude Code**: Complete visibility across all systems when making changes
2. **Shared Type Safety**: Common TypeScript definitions prevent API contract mismatches
3. **Consistent Development**: Single repository, unified tooling, shared best practices
4. **Simplified Deployment**: Coordinated releases across all components
5. **Better Collaboration**: All team members work in the same codebase

## Critical Issue Resolution Plan

### Phase 1: Immediate Stability Fixes (Week 1)

#### 1.1 WebSocket Stability Enhancement

**Problem**: Connection drops, authentication failures, missing heartbeat mechanism

**Solution**: Implement robust WebSocket management with proper lifecycle handling

```typescript
// Enhanced WebSocket service with heartbeat and proper reconnection
class EnhancedWebSocketService {
  private heartbeatInterval: number = 30000; // 30 seconds
  private reconnectBackoff: number[] = [1000, 2000, 4000, 8000, 16000, 30000];
  private maxReconnectAttempts: number = 10;
  
  async connect(): Promise<void> {
    // Secure connection without token in URL
    const wsUrl = `${this.getWebSocketURL()}/ws/pos/${this.restaurantId}`;
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      this.authenticate();
      this.startHeartbeat();
      this.resetReconnectAttempts();
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'pong') {
        this.handlePong();
      } else {
        this.handleBusinessMessage(message);
      }
    };
    
    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.scheduleReconnect();
    };
  }
  
  private async authenticate(): Promise<void> {
    const token = await tokenManager.getTokenWithRefresh();
    this.send({
      type: 'authenticate',
      token,
      user_id: this.userId,
      restaurant_id: this.restaurantId
    });
  }
  
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, this.heartbeatInterval);
  }
}
```

#### 1.2 Token Management Race Condition Fix

**Problem**: Multiple simultaneous token refresh attempts causing 401 errors

**Solution**: Implement proper mutex with request queuing

```typescript
class ImprovedTokenManager {
  private refreshMutex: Promise<string | null> | null = null;
  private requestQueue: Array<{
    resolve: (token: string | null) => void;
    reject: (error: Error) => void;
  }> = [];
  
  async getTokenWithRefresh(): Promise<string | null> {
    // If refresh is in progress, queue the request
    if (this.refreshMutex) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push({ resolve, reject });
      });
    }
    
    const session = await supabase.auth.getSession();
    if (!session.data.session) return null;
    
    // Check if token needs refresh (60 second buffer)
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.data.session.expires_at;
    
    if (expiresAt && now >= (expiresAt - 60)) {
      return this.performRefresh();
    }
    
    return session.data.session.access_token;
  }
  
  private async performRefresh(): Promise<string | null> {
    this.refreshMutex = this.doRefresh();
    
    try {
      const token = await this.refreshMutex;
      this.processQueue(null, token);
      return token;
    } catch (error) {
      this.processQueue(error as Error, null);
      throw error;
    } finally {
      this.refreshMutex = null;
    }
  }
}
```

#### 1.3 API Performance Optimization

**Problem**: 10+ second response times, N+1 queries, missing caching

**Solution**: Implement proper database optimization and caching

```python
# Optimized menu endpoint with caching and eager loading
@router.get("/menu", response_model=List[MenuItemResponse])
async def get_menu_items_optimized(
    restaurant_id: str = Query(...),
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    # Multi-level caching strategy
    cache_key = f"menu:v2:{restaurant_id}:{category or 'all'}:{page}:{limit}"
    
    # L1 Cache: Redis
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # L2 Cache: Database with optimized query
    query = select(Product).options(
        selectinload(Product.category),
        selectinload(Product.modifiers),
        selectinload(Product.variants),
        selectinload(Product.images)
    ).filter(
        Product.restaurant_id == restaurant_id,
        Product.is_active == True
    )
    
    if category:
        query = query.filter(Product.category_id == category)
    
    # Pagination
    query = query.offset((page - 1) * limit).limit(limit)
    
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
            detail="Database query timeout"
        )
    
    # Transform and cache
    response_data = [product.to_dict() for product in products]
    await redis.setex(cache_key, 300, json.dumps(response_data, default=str))
    
    return response_data
```

### Phase 2: Integration Architecture (Week 2)

#### 2.1 Shared Type System Implementation

Create comprehensive shared types that both mobile and web platforms use:

```typescript
// shared/types/api.ts
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

// shared/types/restaurant.ts
export interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  settings: RestaurantSettings;
  subscription_tier: 'alpha' | 'beta' | 'gamma';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RestaurantSettings {
  currency: string;
  timezone: string;
  tax_rate: number;
  service_charge: number;
  payment_methods: PaymentMethod[];
  operating_hours: OperatingHours;
}

// shared/types/orders.ts
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
  total_amount: number;
  payment_status: PaymentStatus;
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

// shared/types/websocket.ts
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
  
  // Business events
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_STATUS_CHANGED = 'order.status_changed',
  PAYMENT_PROCESSED = 'payment.processed',
  INVENTORY_UPDATED = 'inventory.updated',
  LOYALTY_POINTS_EARNED = 'loyalty.points_earned',
  QR_CAMPAIGN_CLAIMED = 'qr_campaign.claimed'
}
```

#### 2.2 Unified API Client

Create a shared API client that both platforms can use:

```typescript
// shared/utils/api-client.ts
export class UnifiedAPIClient {
  private baseURL: string;
  private tokenManager: TokenManager;
  
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
      timeout: options.timeout || 15000,
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
    
    // Implement retry logic with exponential backoff
    return this.executeWithRetry(config, options.retries || 3);
  }
  
  private async executeWithRetry<T>(
    config: AxiosRequestConfig,
    maxRetries: number
  ): Promise<APIResponse<T>> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios(config);
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
    
    throw lastError;
  }
}
```

#### 2.3 Real-time Synchronization Architecture

Implement bidirectional sync between mobile app and web dashboards:

```typescript
// shared/services/sync-service.ts
export class SyncService {
  private apiClient: UnifiedAPIClient;
  private webSocketService: WebSocketService;
  private eventBus: EventBus;
  
  constructor(
    apiClient: UnifiedAPIClient,
    webSocketService: WebSocketService
  ) {
    this.apiClient = apiClient;
    this.webSocketService = webSocketService;
    this.eventBus = new EventBus();
    
    this.setupWebSocketHandlers();
  }
  
  private setupWebSocketHandlers(): void {
    this.webSocketService.on('order.created', (data: Order) => {
      this.eventBus.emit('sync:order:created', data);
      this.updateLocalCache('orders', data.id, data);
    });
    
    this.webSocketService.on('order.updated', (data: Order) => {
      this.eventBus.emit('sync:order:updated', data);
      this.updateLocalCache('orders', data.id, data);
    });
    
    this.webSocketService.on('loyalty.points_earned', (data: any) => {
      this.eventBus.emit('sync:loyalty:points_earned', data);
      this.updateLocalCache('loyalty_transactions', data.id, data);
    });
  }
  
  // Optimistic updates with conflict resolution
  async updateOrder(
    orderId: string, 
    updates: Partial<Order>
  ): Promise<Order> {
    // Optimistic update
    const currentOrder = await this.getFromCache('orders', orderId);
    const optimisticOrder = { ...currentOrder, ...updates };
    this.updateLocalCache('orders', orderId, optimisticOrder);
    this.eventBus.emit('sync:order:optimistic_update', optimisticOrder);
    
    try {
      // Send to server
      const response = await this.apiClient.request<Order>(
        `/orders/${orderId}`,
        { method: 'PUT', data: updates }
      );
      
      // Update with server response
      this.updateLocalCache('orders', orderId, response.data!);
      this.eventBus.emit('sync:order:confirmed', response.data!);
      
      return response.data!;
    } catch (error) {
      // Rollback optimistic update
      this.updateLocalCache('orders', orderId, currentOrder);
      this.eventBus.emit('sync:order:rollback', currentOrder);
      throw error;
    }
  }
}
```

### Phase 3: Advanced Integration Features (Week 3)

#### 3.1 Loyalty Program Integration

Integrate the advanced QR campaign system with the mobile POS:

```typescript
// Mobile app integration for QR campaigns
export class LoyaltyService {
  private apiClient: UnifiedAPIClient;
  private syncService: SyncService;
  
  async processQRCampaignClaim(
    campaignId: string,
    customerData: CustomerData
  ): Promise<LoyaltyTransaction> {
    // Call the Supabase edge function
    const response = await this.apiClient.request<LoyaltyTransaction>(
      '/loyalty/qr-campaigns/claim',
      {
        method: 'POST',
        data: { campaignId, customerData }
      }
    );
    
    // Update local state and notify UI
    this.syncService.emit('loyalty:campaign_claimed', response.data);
    
    return response.data!;
  }
  
  async getActiveCampaigns(
    restaurantId: string
  ): Promise<QRCampaign[]> {
    const response = await this.apiClient.request<QRCampaign[]>(
      `/restaurants/${restaurantId}/loyalty/campaigns/active`
    );
    
    return response.data!;
  }
}
```

#### 3.2 Cross-Platform State Management

Implement unified state management that works across platforms:

```typescript
// shared/store/unified-store.ts
export interface UnifiedState {
  auth: AuthState;
  restaurant: RestaurantState;
  orders: OrdersState;
  menu: MenuState;
  loyalty: LoyaltyState;
  sync: SyncState;
}

export class UnifiedStore {
  private state: UnifiedState;
  private listeners: Map<string, Function[]> = new Map();
  private syncService: SyncService;
  
  constructor(syncService: SyncService) {
    this.syncService = syncService;
    this.setupSyncListeners();
  }
  
  private setupSyncListeners(): void {
    this.syncService.on('sync:order:created', (order: Order) => {
      this.updateState('orders', (state) => ({
        ...state,
        items: [...state.items, order]
      }));
    });
    
    this.syncService.on('sync:order:updated', (order: Order) => {
      this.updateState('orders', (state) => ({
        ...state,
        items: state.items.map(item => 
          item.id === order.id ? order : item
        )
      }));
    });
  }
  
  subscribe<K extends keyof UnifiedState>(
    key: K,
    listener: (state: UnifiedState[K]) => void
  ): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    
    this.listeners.get(key)!.push(listener);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }
}
```

## Database Integration Strategy

### Unified Schema Approach

Since your platform dashboard already uses Supabase with a well-designed schema, the strategy is to:

1. **Migrate FastAPI backend to use Supabase PostgreSQL** as the primary database
2. **Implement Row Level Security (RLS)** for multi-tenant data isolation
3. **Use Supabase Edge Functions** for complex business logic
4. **Maintain FastAPI** for performance-critical operations

```sql
-- Enhanced RLS policies for multi-tenant architecture
CREATE POLICY "Restaurant data isolation" ON orders
FOR ALL USING (
  restaurant_id IN (
    SELECT r.id FROM restaurants r
    LEFT JOIN staff_members sm ON sm.restaurant_id = r.id
    WHERE r.owner_id = auth.uid() 
    OR (sm.user_id = auth.uid() AND sm.is_active = true)
  )
);

CREATE POLICY "Platform owner access" ON orders
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.supabase_id = auth.uid() 
    AND u.role = 'platform_owner'
  )
);
```

### Data Synchronization Strategy

```typescript
// Implement event sourcing for reliable sync
export interface SyncEvent {
  id: string;
  type: string;
  aggregate_id: string;
  data: any;
  version: number;
  timestamp: string;
  source: 'mobile' | 'web_platform' | 'web_restaurant';
}

export class EventSourcingService {
  async publishEvent(event: Omit<SyncEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: SyncEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    };
    
    // Store in database
    await this.apiClient.request('/events', {
      method: 'POST',
      data: fullEvent
    });
    
    // Publish via WebSocket
    this.webSocketService.send({
      type: 'event_published',
      data: fullEvent
    });
  }
  
  async replayEvents(
    aggregateId: string,
    fromVersion: number = 0
  ): Promise<SyncEvent[]> {
    const response = await this.apiClient.request<SyncEvent[]>(
      `/events/${aggregateId}?from_version=${fromVersion}`
    );
    
    return response.data!;
  }
}
```

## Deployment and DevOps Strategy

### Monorepo CI/CD Pipeline

```yaml
# .github/workflows/monorepo-ci.yml
name: Monorepo CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.changes.outputs.backend }}
      mobile: ${{ steps.changes.outputs.mobile }}
      web: ${{ steps.changes.outputs.web }}
      shared: ${{ steps.changes.outputs.shared }}
    steps:
      - uses: actions/checkout@v3
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

  test-backend:
    needs: detect-changes
    if: ${{ needs.detect-changes.outputs.backend == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-cov
      - name: Run tests
        run: |
          cd backend
          pytest tests/ --cov=app --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  test-mobile:
    needs: detect-changes
    if: ${{ needs.detect-changes.outputs.mobile == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd mobile/CashAppPOS
          npm ci
      - name: Run tests
        run: |
          cd mobile/CashAppPOS
          npm test -- --coverage --watchAll=false

  deploy-backend:
    needs: [detect-changes, test-backend]
    if: ${{ github.ref == 'refs/heads/main' && needs.detect-changes.outputs.backend == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to DigitalOcean
        run: |
          # Deploy backend to DigitalOcean App Platform
          doctl apps create-deployment ${{ secrets.DO_APP_ID }}
```

### Environment Configuration

```typescript
// shared/config/environments.ts
export interface Environment {
  name: string;
  api: {
    baseURL: string;
    timeout: number;
    retries: number;
  };
  websocket: {
    url: string;
    heartbeatInterval: number;
    reconnectAttempts: number;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  features: {
    enableLoyalty: boolean;
    enablePayments: boolean;
    enableAnalytics: boolean;
  };
}

export const environments: Record<string, Environment> = {
  development: {
    name: 'development',
    api: {
      baseURL: 'http://localhost:8000',
      timeout: 30000,
      retries: 3
    },
    websocket: {
      url: 'ws://localhost:8000',
      heartbeatInterval: 30000,
      reconnectAttempts: 5
    },
    supabase: {
      url: process.env.VITE_SUPABASE_URL!,
      anonKey: process.env.VITE_SUPABASE_ANON_KEY!
    },
    features: {
      enableLoyalty: true,
      enablePayments: false,
      enableAnalytics: true
    }
  },
  production: {
    name: 'production',
    api: {
      baseURL: 'https://api.fynlo.co.uk',
      timeout: 15000,
      retries: 3
    },
    websocket: {
      url: 'wss://api.fynlo.co.uk',
      heartbeatInterval: 30000,
      reconnectAttempts: 10
    },
    supabase: {
      url: process.env.VITE_SUPABASE_URL!,
      anonKey: process.env.VITE_SUPABASE_ANON_KEY!
    },
    features: {
      enableLoyalty: true,
      enablePayments: true,
      enableAnalytics: true
    }
  }
};
```

## Implementation Timeline

### Week 1: Critical Issue Resolution
- **Day 1-2**: Implement WebSocket heartbeat and reconnection logic
- **Day 3-4**: Fix token management race conditions
- **Day 5-7**: Optimize database queries and implement caching

### Week 2: Monorepo Setup and Integration
- **Day 1-2**: Set up monorepo structure and shared types
- **Day 3-4**: Implement unified API client and sync service
- **Day 5-7**: Integrate loyalty program features

### Week 3: Testing and Deployment
- **Day 1-3**: Comprehensive testing across all platforms
- **Day 4-5**: Performance optimization and monitoring setup
- **Day 6-7**: Production deployment and monitoring

### Week 4: Documentation and Training
- **Day 1-3**: Complete documentation and API guides
- **Day 4-5**: Team training and knowledge transfer
- **Day 6-7**: Post-deployment monitoring and issue resolution

## Success Metrics

### Technical Metrics
- **API Response Time**: < 500ms for 95% of requests
- **WebSocket Uptime**: > 99.5% connection stability
- **Authentication Success Rate**: > 99.9%
- **Database Query Performance**: < 100ms for menu queries

### Business Metrics
- **User Experience**: < 3 second screen load times
- **System Reliability**: < 0.1% error rate
- **Development Velocity**: 50% faster feature development
- **Operational Efficiency**: 30% reduction in support tickets

## Risk Mitigation

### Technical Risks
1. **Data Migration Issues**: Implement staged migration with rollback capabilities
2. **Performance Degradation**: Comprehensive load testing before deployment
3. **Integration Complexity**: Phased rollout with feature flags
4. **Security Vulnerabilities**: Security audit and penetration testing

### Business Risks
1. **Service Disruption**: Blue-green deployment with zero downtime
2. **User Adoption**: Gradual rollout with user training
3. **Cost Overruns**: Detailed resource planning and monitoring
4. **Timeline Delays**: Buffer time and scope management

This comprehensive strategy addresses both immediate technical issues and long-term integration goals, providing a clear path to a unified, scalable Fynlo POS platform.

