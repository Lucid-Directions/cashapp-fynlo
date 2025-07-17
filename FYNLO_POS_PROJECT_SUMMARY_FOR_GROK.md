# Fynlo POS Project Summary for External AI (Grok)

## 1. **Project Overview**

**Fynlo POS** is a hardware-free, multi-tenant restaurant point of sale platform designed to disrupt traditional POS systems by eliminating expensive hardware and reducing payment processing fees.

**Goals:**
- Enable restaurants to operate with just mobile devices (no terminals)
- Reduce payment fees from 2.9% to 1.2% via QR code payments  
- Support multiple restaurants under platform owners
- Real-time synchronization between mobile app and web dashboards

**Current Status:** 
- **75% Production Ready** (January 2025)
- **Phase 9 Security Fixes Complete** - All critical vulnerabilities patched
- **Production Infrastructure Deployed** - DigitalOcean fully configured
- **Key Blocker:** Backend timeout and WebSocket stability issues

**Key Challenges:**
- Backend API timeouts (401 retry requests failing)
- WebSocket connection drops and authentication edge cases
- Menu loading performance issues (10+ second response times)
- Bidirectional sync architecture needed between mobile app and future web dashboards
- Backend needs stabilization as the central sync hub for all clients

## 2. **Tech Stack & Dependencies**

### Languages & Frameworks
```
Backend:
- Python 3.11+ with FastAPI 0.108.0
- SQLAlchemy 2.0.23 ORM  
- Pydantic 2.5.2 for validation
- Uvicorn 0.25.0 ASGI server

Frontend:
- React Native 0.72.17
- TypeScript 5.2.2
- React 18.2.0
- Zustand 4.4.7 state management
```

### Key Libraries
```python
# Backend (requirements.txt excerpt)
fastapi==0.108.0
sqlalchemy==2.0.25  # Updated version
psycopg2-binary==2.9.9
redis>=6.0.0,<7.0.0  # Updated for compatibility
stripe==8.0.0  # Updated version
supabase==2.3.0
websockets==12.0  # ✓ Already in requirements.txt for WebSocket support
resend==0.7.0
boto3==1.34.34  # DigitalOcean Spaces - Updated version
python-jose[cryptography]==3.3.0  # JWT
passlib[bcrypt]==1.7.4
celery==5.3.6  # Updated version
httpx==0.24.1  # Compatible with supabase 2.3.0
```

```json
// Frontend (package.json excerpt)
"dependencies": {
  "react-native": "0.72.17",
  "@react-navigation/native": "^6.1.9",
  "@react-navigation/stack": "^6.3.20",
  "zustand": "^4.4.7",
  "axios": "^1.6.2",
  "react-native-vector-icons": "^10.0.3",
  "@react-native-async-storage/async-storage": "1.18.2",
  "react-native-safe-area-context": "4.6.3"
}
```

### Environment Variables Structure
```bash
# Backend .env
DATABASE_URL=postgresql://user:pass@host:5432/fynlo_prod
REDIS_URL=redis://default:pass@host:6379
SECRET_KEY=your-secret-key-for-jwt
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
DO_SPACES_KEY=DO00...
DO_SPACES_SECRET=secret...
DO_SPACES_BUCKET=fynlo-assets
DO_SPACES_REGION=lon1
ENVIRONMENT=production
PLATFORM_SECRET=hmac-secret-for-platform-ops

# Frontend .env
API_BASE_URL=https://api.fynlo.co.uk
WEBSOCKET_URL=wss://api.fynlo.co.uk
FIREBASE_API_KEY=AIza...  # Legacy auth
FIREBASE_PROJECT_ID=fynlo-pos
USE_REAL_API=true
```

### External Services
- **DigitalOcean App Platform**: Backend hosting with GitHub auto-deploy
- **DigitalOcean Managed PostgreSQL**: Primary database (8GB RAM, 4 vCPUs)
- **DigitalOcean Valkey**: Redis-compatible cache (1GB RAM)
- **DigitalOcean Spaces**: Object storage with CDN for assets
- **Supabase**: Authentication backend (JWT tokens)
- **Stripe/SumUp**: Payment processing integrations
- **Resend**: Transactional email service
- **DigitalOcean Load Balancer**: SSL termination and traffic distribution

## 3. **File Structure & Key Files**

```
Fynlo/
├── cashapp-fynlo/                         # Main repository
│   ├── backend/
│   │   ├── app/
│   │   │   ├── main.py                   # FastAPI app entry
│   │   │   ├── api/
│   │   │   │   ├── v1/
│   │   │   │   │   ├── api.py            # Route aggregator
│   │   │   │   │   ├── auth.py           # JWT authentication
│   │   │   │   │   ├── products.py       # Menu management
│   │   │   │   │   ├── orders.py         # Order processing
│   │   │   │   │   └── websocket.py      # Real-time updates (needs stabilization)
│   │   │   │   └── mobile/               # Mobile-optimized endpoints
│   │   │   ├── core/
│   │   │   │   ├── database.py           # DB connection pooling
│   │   │   │   ├── redis_client.py       # Cache configuration
│   │   │   │   └── security.py           # Auth helpers
│   │   │   ├── models/                   # SQLAlchemy models
│   │   │   │   ├── restaurant.py         # Multi-tenant base
│   │   │   │   ├── product.py            # Menu items
│   │   │   │   └── order.py              # Orders & payments
│   │   │   └── services/                 # Business logic
│   │   │       ├── payment_service.py    # Payment routing
│   │   │       └── analytics_service.py  # Real-time metrics
│   │   └── scripts/
│   │       └── seed_database.py          # Production-like test data
│   │
│   ├── CashApp-iOS/CashAppPOS/           # React Native app
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   │   └── main/
│   │   │   │       └── POSScreen.tsx     # Main POS interface
│   │   │   ├── services/
│   │   │   │   ├── DataService.ts        # API client wrapper (handles timeouts)
│   │   │   │   └── DatabaseService.ts    # Backend API calls
│   │   │   ├── navigation/
│   │   │   │   ├── AppNavigator.tsx      # Root navigation
│   │   │   │   └── MainNavigator.tsx     # Tab navigation
│   │   │   ├── store/                    # Zustand stores
│   │   │   │   ├── useAppStore.ts        # Global app state
│   │   │   │   └── useCartStore.ts       # Cart management
│   │   │   └── contexts/
│   │   │       └── AuthContext.tsx       # Auth provider
│   │   ├── ios/
│   │   │   └── main.jsbundle             # Pre-built JS bundle
│   │   └── CONTEXT.md                    # Critical project context
│   │
│   ├── ARCHIVED DOCS/                    # Historical documentation
│   └── SCREEN_ANALYSIS_DOCS/             # Detailed screen analysis
│
└── [Future: Web Dashboards]              # Planned web interfaces
    ├── platform-owner/                   # Admin portal (to be built)
    └── restaurant-owner/                 # Business portal (to be built)
```

### Critical Files with Code Samples

**1. Backend API Router** (`backend/app/api/v1/api.py`)
```python
from fastapi import APIRouter
from app.api.v1 import auth, restaurants, products, orders, payments, websocket

api_router = APIRouter()

# Public endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Protected business endpoints
api_router.include_router(restaurants.router, prefix="/restaurants", tags=["restaurants"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])

# Real-time WebSocket
api_router.include_router(websocket.router, prefix="/websocket", tags=["websocket"])

# Platform admin (HMAC secured)
api_router.include_router(platform.router, prefix="/platform", tags=["platform"])
```

**2. Menu Endpoint** (`backend/app/api/v1/products.py`)
```python
@router.get("/menu", response_model=List[MenuItemResponse])
async def get_menu_items(
    restaurant_id: str = Query(...),
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user)
):
    """Get menu items with caching"""
    cache_key = f"menu:{restaurant_id}:{category or 'all'}"
    
    # Check cache first
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Query with eager loading to prevent N+1
    query = select(Product).options(
        selectinload(Product.category),
        selectinload(Product.modifiers)
    ).filter(
        Product.restaurant_id == restaurant_id,
        Product.is_active == True
    )
    
    if category:
        query = query.filter(Product.category_id == category)
    
    result = await db.execute(query)
    products = result.scalars().all()
    
    # Cache for 5 minutes
    await redis.setex(cache_key, 300, json.dumps([p.to_dict() for p in products]))
    
    return products
```

**3. POS Screen Component** (`src/screens/main/POSScreen.tsx`)
```typescript
const POSScreen: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { restaurantId } = useAuthContext();
  
  useEffect(() => {
    loadMenuItems();
  }, [restaurantId]);
  
  const loadMenuItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 15-second timeout indicates performance issue
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const items = await DataService.getMenuItems(restaurantId, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setMenuItems(items);
    } catch (error) {
      console.error('Menu loading failed:', error);
      setError('Failed to load menu. Using offline data.');
      // Falls back to hardcoded data - production blocker
      setMenuItems(chuchoMenu.menuItems);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <LoadingScreen message="Loading menu..." />;
  }
  
  // Rest of component...
};
```

**4. WebSocket Manager** (`backend/app/api/v1/websocket.py`) - **NEEDS STABILIZATION**
```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, restaurant_id: str):
        await websocket.accept()
        if restaurant_id not in self.active_connections:
            self.active_connections[restaurant_id] = []
        self.active_connections[restaurant_id].append(websocket)
    
    async def broadcast(self, message: dict, restaurant_id: str):
        """Send message to all connections in a restaurant"""
        if restaurant_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[restaurant_id]:
                try:
                    await connection.send_json(message)
                except WebSocketDisconnect:
                    dead_connections.append(connection)
                except Exception as e:  # Need better error handling
                    logger.error(f"WebSocket broadcast failed: {e}")
                    dead_connections.append(connection)
            
            # Clean up dead connections
            for conn in dead_connections:
                self.active_connections[restaurant_id].remove(conn)

manager = ConnectionManager()

@router.websocket("/ws/{restaurant_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    restaurant_id: str,
    token: str = Query(...)
):
    # Verify JWT token
    try:
        user = await get_current_user_ws(token)
        if user.restaurant_id != restaurant_id:
            await websocket.close(code=4003)
            return
    except:
        await websocket.close(code=4001)
        return
    
    await manager.connect(websocket, restaurant_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message["type"] == "order_status_update":
                await handle_order_update(message, restaurant_id)
            elif message["type"] == "kitchen_notification":
                await manager.broadcast(message, restaurant_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, restaurant_id)
```

**5. Auth Context** (`src/contexts/AuthContext.tsx`)
```typescript
interface AuthContextType {
  user: User | null;
  restaurantId: string | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const AuthProvider: React.FC = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { access_token, user } = response.data;
      
      // Store token
      await AsyncStorage.setItem('auth_token', access_token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      
      setToken(access_token);
      setUser(user);
      
      // Configure axios defaults
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Connect WebSocket
      WebSocketService.connect(user.restaurant_id, access_token);
    } catch (error) {
      throw new Error('Login failed');
    }
  };
  
  // Token refresh logic
  useEffect(() => {
    const interval = setInterval(refreshToken, 20 * 60 * 1000); // 20 minutes
    return () => clearInterval(interval);
  }, []);
```

## 4. **Architecture & Data Flows**

```mermaid
graph TB
    subgraph "Mobile App Layer"
        A[React Native POS] --> B[Zustand Stores]
        B --> C[DataService]
        C --> D[Axios + Auth Interceptor]
    end
    
    subgraph "API Gateway"
        D --> E[FastAPI]
        E --> F[Auth Middleware]
        F --> G[Route Handlers]
    end
    
    subgraph "Business Logic"
        G --> H[Service Layer]
        H --> I[Repository Pattern]
        I --> J[(PostgreSQL)]
        H --> K[(Valkey Cache)]
        H --> L[WebSocket Manager]
    end
    
    subgraph "External Services"
        H --> M[Stripe/SumUp]
        H --> N[Supabase Auth]
        H --> O[DO Spaces]
        H --> P[Resend Email]
    end
    
    subgraph "Future Web Dashboards"
        L -.->|WebSocket (bidirectional)| Q[Platform Portal]
        L -.->|WebSocket (bidirectional)| R[Restaurant Portal]
        J -.->|SQL Queries| Q
        J -.->|SQL Queries| R
        Q -.->|Updates| J
        R -.->|Updates| J
    end
    
    style A fill:#f9f,stroke:#333,stroke-width:4px
    style E fill:#9f9,stroke:#333,stroke-width:4px
    style J fill:#99f,stroke:#333,stroke-width:4px
```

### Authentication Flow
1. **Initial Login**: Mobile app sends credentials to `/api/v1/auth/login`
2. **Supabase Validation**: Backend validates against Supabase auth service
3. **JWT Generation**: Returns JWT token with 24-hour expiry and refresh token
4. **Token Storage**: App stores in AsyncStorage with secure encryption
5. **Request Authorization**: All API calls include `Authorization: Bearer {token}`
6. **Token Refresh**: Auto-refresh 20 minutes before expiry
7. **WebSocket Auth**: Token passed as query param for WS connection

### Real-time Data Flow (Current & Planned)
1. **Order Creation**: 
   - App → POST /api/v1/orders → DB transaction
   - Trigger → WebSocket broadcast to restaurant channel
   - Kitchen displays receive instant notification
   - **Future**: Web dashboards receive real-time updates
   
2. **Status Updates**:
   - Kitchen → PUT /api/v1/orders/{id}/status
   - WebSocket → Broadcast to all POS terminals
   - UI updates optimistically with reconciliation
   - **Need**: Bidirectional sync for web dashboard updates

3. **Inventory Sync** (Critical for Production):
   - Real-time stock deduction on sales
   - Low stock alerts via WebSocket
   - Automatic reorder suggestions
   - **Backend as sync hub**: All clients (mobile, web) sync through backend

4. **Backend Stabilization Needs**:
   - Fix 401 retry timeout issues
   - Implement WebSocket reconnection with exponential backoff
   - Add heartbeat mechanism for connection health
   - Ensure backend can handle multiple client types simultaneously

### Subscription Gating
```python
# Middleware for feature gating
async def check_subscription_tier(request: Request, user: User):
    platform = await get_platform(user.platform_id)
    
    if request.url.path.startswith("/api/v1/analytics/advanced"):
        if platform.subscription_tier < "beta":
            raise HTTPException(403, "Beta subscription required")
    
    if request.url.path.startswith("/api/v1/ai"):
        if platform.subscription_tier < "gamma":
            raise HTTPException(403, "Gamma subscription required")
```

## 5. **Features & Modules**

### POS Module
**Summary:** Core point-of-sale with dynamic menu, cart management, split payments, and table management.

**Key Implementation:**
```typescript
// Cart management with Zustand persistence
const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      tableNumber: null,
      
      addItem: (item: CartItem) => set((state) => ({
        items: [...state.items, {
          ...item,
          id: uuidv4(),
          timestamp: Date.now()
        }]
      })),
      
      calculateTotals: () => {
        const state = get();
        const subtotal = state.items.reduce((sum, item) => 
          sum + (item.price * item.quantity), 0
        );
        const serviceCharge = subtotal * 0.125; // 12.5% platform fee
        const vat = (subtotal + serviceCharge) * 0.20; // 20% UK VAT
        
        return {
          subtotal,
          serviceCharge,
          vat,
          total: subtotal + serviceCharge + vat
        };
      }
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);
```

**Integration Points:**
- Real-time order sync to kitchen display
- Inventory deduction on completion
- Payment processor routing based on method
- Analytics event tracking

### Menu Management
**Current Issue:** Frontend shows hardcoded Mexican restaurant menu instead of dynamic loading.

**Backend Structure:**
```python
class Product(Base):
    __tablename__ = "products"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    restaurant_id = Column(String, ForeignKey("restaurants.id"))
    category_id = Column(String, ForeignKey("categories.id"))
    
    name = Column(String, nullable=False)
    description = Column(Text)
    price = Column(DECIMAL(10, 2), nullable=False)
    
    # Flexible modifier system
    modifiers = Column(JSONB, default=dict)
    # Example: {"sizes": [{"name": "Large", "price": 2.00}]}
    
    # Availability rules
    availability = Column(JSONB, default=dict)
    # Example: {"days": [1,2,3,4,5], "hours": {"start": "11:00", "end": "15:00"}}
    
    # Inventory tracking
    track_inventory = Column(Boolean, default=False)
    current_stock = Column(Integer, default=0)
    
    # Relations
    category = relationship("Category", back_populates="products")
    restaurant = relationship("Restaurant", back_populates="products")
```

### Reports & Analytics
**Features Implemented:**
- Daily/weekly/monthly sales reports
- Product performance metrics
- Employee productivity tracking
- Real-time dashboard via WebSocket
- Export to CSV/PDF formats

**Analytics Service:**
```python
class AnalyticsService:
    async def get_realtime_metrics(self, restaurant_id: str):
        """Get live metrics for dashboard"""
        async with get_db() as db:
            # Today's sales
            today_sales = await db.execute(
                select(func.sum(Order.total))
                .filter(
                    Order.restaurant_id == restaurant_id,
                    Order.created_at >= date.today()
                )
            )
            
            # Active orders
            active_orders = await db.execute(
                select(func.count(Order.id))
                .filter(
                    Order.restaurant_id == restaurant_id,
                    Order.status.in_(['pending', 'preparing'])
                )
            )
            
            # Hourly breakdown
            hourly_sales = await self._get_hourly_breakdown(restaurant_id)
            
            return {
                "today_revenue": float(today_sales.scalar() or 0),
                "active_orders": active_orders.scalar(),
                "hourly_breakdown": hourly_sales,
                "timestamp": datetime.utcnow().isoformat()
            }
```

### Employee & Inventory Management
**Employee Features:**
- Role-based permissions (owner, manager, staff)
- Clock in/out with geolocation
- Schedule management
- Performance tracking

**Inventory System:**
```python
async def process_order_inventory(order_id: str):
    """Atomic inventory updates on order completion"""
    async with db.begin():  # Transaction ensures consistency
        order = await get_order(order_id)
        
        for item in order.items:
            product = await get_product(item.product_id)
            
            if product.track_inventory:
                # Deduct stock
                product.current_stock -= item.quantity
                
                # Create movement record
                movement = StockMovement(
                    product_id=product.id,
                    type="sale",
                    quantity=-item.quantity,
                    reference_id=order_id,
                    notes=f"Sale: Order #{order.number}"
                )
                db.add(movement)
                
                # Check reorder point
                if product.current_stock <= product.reorder_point:
                    await trigger_low_stock_alert(product)
        
        await db.commit()
```

### Platform APIs
**Secure Platform Management:**
```python
# HMAC signature verification for platform operations
@router.post("/platform/admin/action")
async def platform_admin_action(
    request: Request,
    signature: str = Header(...),
    timestamp: str = Header(...),
    payload: dict = Body(...)
):
    # Verify request freshness (5 minute window)
    if abs(time.time() - float(timestamp)) > 300:
        raise HTTPException(400, "Request expired")
    
    # Verify HMAC signature
    expected_sig = hmac.new(
        settings.PLATFORM_SECRET.encode(),
        f"{timestamp}:{json.dumps(payload, sort_keys=True)}".encode(),
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(signature, expected_sig):
        raise HTTPException(403, "Invalid signature")
    
    # Process platform action
    return await process_platform_action(payload)
```

## 6. **Deployment & Workflow**

### Git Workflow
```bash
# Branch Strategy
main                          # Production (protected)
├── develop                   # Integration branch
├── feature/frontend-*        # Frontend features
├── feature/ryan-*           # Backend features  
├── bugfix/*                 # Bug fixes
└── hotfix/*                 # Emergency production fixes

# Commit Convention
feat(scope): add new feature
fix(scope): resolve issue
docs(scope): update documentation
perf(scope): performance improvement
refactor(scope): code restructuring

# PR Process
1. Create feature branch from develop
2. Make atomic commits
3. Push and create PR with template
4. Automated tests run
5. Code review required
6. Merge to develop
7. Deploy to staging
8. After QA, merge to main
```

### DigitalOcean Configuration
```yaml
# app.yaml - App Platform spec
name: fynlo-api
region: lon
services:
  - name: api
    github:
      repo: Lucid-Directions/cashapp-fynlo
      branch: main
      deploy_on_push: true
    source_dir: backend
    environment_slug: python
    instance_size: professional-xs
    instance_count: 2
    
    health_check:
      http_path: /api/v1/health
      timeout_seconds: 10
      
    envs:
      - key: DATABASE_URL
        scope: RUN_TIME
        value: ${db.DATABASE_URL}
      - key: REDIS_URL
        scope: RUN_TIME
        value: ${redis.REDIS_URL}
        
    run_command: gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker

databases:
  - name: db
    engine: PG
    version: "15"
    size: db-s-2vcpu-4gb
    num_nodes: 1

  - name: redis
    engine: REDIS
    version: "7"
    size: db-s-1vcpu-1gb
```

### Testing Strategy
```bash
# Backend Testing
cd backend
pytest tests/ -v --cov=app --cov-report=html
# Current coverage: 78%

# Frontend Testing  
cd CashApp-iOS/CashAppPOS
npm test -- --coverage
# Current coverage: 65%

# E2E Testing Flow
1. Start backend: ./scripts/run_local.sh
2. Start iOS simulator: npm run ios
3. Run E2E tests: npm run test:e2e
4. Test critical paths:
   - Login → Restaurant selection
   - Browse menu → Add to cart
   - Checkout → Payment → Order confirmation
   - Kitchen receives order → Status updates
```

### Monitoring & Observability
- **Logs**: DigitalOcean App Platform centralized logging
- **Metrics**: Custom CloudWatch-style metrics via DO Monitoring
- **Alerts**: Slack integration for critical errors
- **APM**: Planning to add Sentry for error tracking
- **Health Checks**: `/api/v1/health` endpoint monitoring

## 7. **Known Issues & Insights**

### Critical Issues

1. **Backend API Timeout Issues** 🚨
   - **Symptoms**: 401 retry requests failing with timeout
   - **Root Cause**: Connection pool exhaustion, no proper retry mechanism
   - **Fix**: Implement connection pooling optimization, add circuit breaker pattern

2. **WebSocket Stability Problems** 🚨
   - **Issue**: Connection drops, authentication edge cases during token refresh
   - **Current State**: No reconnection logic, no heartbeat mechanism
   - **Fix**: Implement exponential backoff reconnection, add heartbeat with auth check
   ```python
   # Need to add heartbeat mechanism
   async def heartbeat(websocket: WebSocket):
       while True:
           await asyncio.sleep(30)
           await websocket.send_json({"type": "ping"})
   ```

3. **API Performance** (10+ second responses)
   - **Cause**: N+1 queries on menu endpoint, no caching layer
   - **Fix**: Implement eager loading, add Redis caching
   ```python
   # Add this to menu query
   .options(selectinload(Product.category), selectinload(Product.modifiers))
   ```

4. **Backend as Sync Hub** (Architecture Gap)
   - **Issue**: Backend not designed for bidirectional sync with multiple client types
   - **Need**: Event sourcing pattern for reliable state synchronization
   - **Fix**: Implement event-driven architecture with Redis pub/sub

5. **Menu Loading Performance**
   - **Issue**: Large menu queries timing out
   - **Fix**: Implement pagination, optimize database indexes

### Performance Insights
- Menu endpoint needs pagination for 100+ items
- Image loading causing UI jank - implement lazy loading
- WebSocket reconnection logic needs exponential backoff
- Database connection pool exhaustion under load

### Security Considerations
- Recent fixes addressed major vulnerabilities
- Still need rate limiting on public endpoints
- Add request signing for mobile app API calls
- Implement device fingerprinting for POS terminals

### Backend Stabilization & Real-time Sync Architecture

1. **Backend as Central Sync Hub**
   ```python
   # All state changes flow through backend
   class SyncHub:
       def __init__(self):
           self.redis = get_redis()
           self.websocket_manager = ConnectionManager()
           
       async def process_change(self, change_type: str, data: dict):
           # 1. Persist to database
           await self.persist_change(data)
           
           # 2. Publish to Redis for other services
           await self.redis.publish(f"sync:{change_type}", json.dumps(data))
           
           # 3. Broadcast to connected WebSocket clients
           await self.websocket_manager.broadcast({
               "type": change_type,
               "data": data,
               "timestamp": datetime.utcnow().isoformat()
           }, data.get("restaurant_id"))
   ```

2. **Event Sourcing for Reliability**
   ```python
   # Track all state changes for replay and recovery
   class Event(Base):
       __tablename__ = "events"
       
       id = Column(String, primary_key=True)
       aggregate_id = Column(String, index=True)
       event_type = Column(String)
       event_data = Column(JSONB)
       client_type = Column(String)  # 'mobile', 'web_platform', 'web_restaurant'
       created_at = Column(DateTime, default=datetime.utcnow)
       
   # Ensure event ordering and delivery
   async def publish_event(event: Event):
       await db.add(event)
       await redis.publish(f"events:{event.aggregate_id}", event.json())
   ```

3. **Redis Pub/Sub for Bidirectional Sync**
   ```python
   # Backend subscribes to client updates
   async def subscribe_to_clients():
       pubsub = redis.pubsub()
       await pubsub.subscribe("client:updates:*")
       
       async for message in pubsub.listen():
           if message["type"] == "message":
               await process_client_update(message["data"])
   
   # Clients (mobile/web) publish their changes
   await redis.publish("client:updates:mobile", update_data)
   await redis.publish("client:updates:web", update_data)
   ```

3. **Optimistic UI Updates**
   ```typescript
   // Update UI immediately, reconcile on response
   const createOrder = async (order: Order) => {
     // Optimistic update
     setOrders([...orders, { ...order, status: 'pending' }]);
     
     try {
       const result = await api.post('/orders', order);
       // Reconcile with server response
       updateOrder(result.data);
     } catch (error) {
       // Rollback on failure
       removeOrder(order.id);
       showError('Order failed');
     }
   };
   ```

4. **Conflict Resolution Strategy**
   ```python
   # Last-write-wins with version vectors
   class VersionedEntity(Base):
       version = Column(Integer, default=1)
       
       def update(self, data):
           self.version += 1
           # Apply updates
   ```

5. **WebSocket Connection Management**
   ```typescript
   class WebSocketManager {
     private reconnectAttempts = 0;
     private maxReconnectDelay = 30000;
     
     connect() {
       this.ws = new WebSocket(url);
       
       this.ws.onclose = () => {
         const delay = Math.min(
           1000 * Math.pow(2, this.reconnectAttempts),
           this.maxReconnectDelay
         );
         
         setTimeout(() => this.connect(), delay);
         this.reconnectAttempts++;
       };
       
       this.ws.onopen = () => {
         this.reconnectAttempts = 0;
         this.reconcileState();
       };
     }
   }
   ```

## 8. **Questions for Clarification**

1. **Real-time Sync Scope**: Which data needs real-time sync between app and dashboards? Just orders/sales, or also inventory changes, employee actions, menu updates? What's the acceptable latency?

2. **Offline Capability**: Should the POS app work fully offline with eventual sync? What operations must work offline vs online-only? How to handle conflicts?

3. **Multi-Restaurant Architecture**: How should staff working at multiple restaurants switch context? Fast switching needed? Single login for all restaurants?

4. **Dashboard Integration**: Are the Lovable.ai dashboards using REST API polling or do they support WebSockets? What's their current architecture? Need bidirectional sync?

5. **Scale Requirements**: Expected concurrent users per restaurant? Total restaurants? Peak order volume? This affects whether Redis Pub/Sub suffices or need Kafka/RabbitMQ.

6. **Conflict Resolution**: Multiple POS terminals updating same inventory - how to resolve? FIFO, manual review, or automatic reconciliation? What about split orders?

7. **Data Freshness**: What's the real-time window? Last 24h in memory? 7 days? How much historical data needs instant access vs. can be loaded on demand?

---

**Summary**: Fynlo POS is a well-architected system at 75% production readiness. The immediate blockers are backend stability issues - API timeouts (401 retry failures) and WebSocket connection drops. The backend needs to be stabilized as the central sync hub for all clients (mobile app and future web dashboards). Key priorities:

1. **Fix backend timeout issues** - Connection pool optimization, proper retry mechanisms
2. **Stabilize WebSocket connections** - Add heartbeat, implement reconnection logic with exponential backoff
3. **Optimize performance** - Redis caching, query optimization, pagination for large datasets
4. **Prepare for bidirectional sync** - Event sourcing pattern with Redis pub/sub for reliable state synchronization

The backend must reliably handle multiple client types simultaneously before web dashboards can be added. The suggested architecture positions the backend as the single source of truth for all real-time synchronization.