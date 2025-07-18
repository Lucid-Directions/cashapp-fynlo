# Backend Requirements - Complete API & Database Specification

## Database Schema Requirements

### Core Tables Status

#### ✅ Existing Tables (Already in database.py)
```sql
-- Platform
platforms:
  - id (UUID)
  - name (VARCHAR)
  - created_at (TIMESTAMP)

-- Restaurant  
restaurants:
  - id (UUID)
  - platform_id (UUID)
  - name (VARCHAR)
  - address (JSONB)
  - phone (VARCHAR)
  - email (VARCHAR)
  - tax_number (VARCHAR)
  - configuration (JSONB)
  - subscription_plan (VARCHAR)
  - is_active (BOOLEAN)
  - created_at (TIMESTAMP)

-- User
users:
  - id (UUID)
  - restaurant_id (UUID)
  - email (VARCHAR, unique)
  - password_hash (VARCHAR)
  - first_name (VARCHAR)
  - last_name (VARCHAR)
  - phone (VARCHAR)
  - role (ENUM)
  - is_active (BOOLEAN)
  - created_at (TIMESTAMP)

-- Customer
customers:
  - id (UUID)
  - restaurant_id (UUID)
  - first_name (VARCHAR)
  - last_name (VARCHAR)
  - email (VARCHAR)
  - phone (VARCHAR)
  - date_of_birth (DATE)
  - created_at (TIMESTAMP)

-- Category
categories:
  - id (UUID)
  - restaurant_id (UUID)
  - name (VARCHAR)
  - description (TEXT)
  - sort_order (INT)
  - is_active (BOOLEAN)

-- Product (Menu Items)
products:
  - id (UUID)
  - restaurant_id (UUID)
  - category_id (UUID)
  - name (VARCHAR)
  - description (TEXT)
  - price (DECIMAL)
  - cost (DECIMAL)
  - image_url (VARCHAR)
  - barcode (VARCHAR)
  - sku (VARCHAR)
  - is_active (BOOLEAN)
  ❌ MISSING: emoji (VARCHAR)

-- Order
orders:
  - id (UUID)
  - restaurant_id (UUID)
  - order_number (VARCHAR)
  - customer_id (UUID, nullable)
  - status (ENUM)
  - payment_status (ENUM)
  - payment_method (VARCHAR)
  - subtotal (DECIMAL)
  - tax_amount (DECIMAL)
  - service_charge_amount (DECIMAL)
  - tip_amount (DECIMAL)
  - total_amount (DECIMAL)
  - notes (TEXT)
  - created_at (TIMESTAMP)

-- InventoryItem
inventory_items:
  - id (UUID)
  - restaurant_id (UUID)
  - name (VARCHAR)
  - current_quantity (DECIMAL)
  - unit (VARCHAR)
  - reorder_level (DECIMAL)
  - unit_cost (DECIMAL)
```

#### ❌ Missing Tables (Need Creation)

```sql
-- Order Items (CRITICAL)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  modifiers JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee Profiles
CREATE TABLE employee_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  employee_id VARCHAR(50),
  hourly_rate DECIMAL(10,2),
  hire_date DATE,
  emergency_contact JSONB,
  address JSONB,
  tax_info JSONB, -- Encrypted
  bank_info JSONB, -- Encrypted
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Metrics
CREATE TABLE customer_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  total_spent DECIMAL(10,2) DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  last_order_date TIMESTAMP,
  average_order_value DECIMAL(10,2) DEFAULT 0,
  favorite_product_id UUID REFERENCES products(id),
  visit_frequency_days DECIMAL(5,2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loyalty Accounts
CREATE TABLE loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  points_balance INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'bronze',
  tier_expiry_date DATE,
  last_earned_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock Movements
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id UUID REFERENCES inventory_items(id),
  movement_type VARCHAR(20) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  reference_type VARCHAR(50),
  reference_id UUID,
  reason TEXT,
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform Settings
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_id UUID REFERENCES platforms(id),
  service_charge_rate DECIMAL(5,2) DEFAULT 12.5,
  payment_settings JSONB,
  commission_settings JSONB,
  feature_flags JSONB,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity Logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  restaurant_id UUID,
  action VARCHAR(100),
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints Requirements

### 🔴 Critical Endpoints (Blocking production)

#### 1. Menu Management
```python
# REPLACE hardcoded endpoint in main.py with proper implementation

GET /api/v1/menu/items
Query params:
  - restaurant_id: UUID
  - category: string (optional)
  - available: boolean (optional)
Response:
[{
  id: string,
  name: string,
  price: number,
  category: string,
  description: string,
  emoji: string,
  available: boolean,
  icon: string
}]

GET /api/v1/menu/categories
Query params:
  - restaurant_id: UUID
Response:
[{
  id: string,
  name: string,
  color: string,
  icon: string,
  sort_order: number,
  active: boolean
}]

POST /api/v1/menu/items
Body: {
  name: string,
  category_id: UUID,
  price: number,
  description?: string,
  emoji?: string
}

PUT /api/v1/menu/items/{id}
Body: Partial<MenuItem>

DELETE /api/v1/menu/items/{id}
```

#### 2. Order Management
```python
GET /api/v1/orders
Query params:
  - restaurant_id: UUID
  - status: OrderStatus (optional)
  - date_from: date (optional)
  - date_to: date (optional)
  - limit: int (default 50)
Response: {
  orders: Order[],
  total: number,
  hasMore: boolean
}

POST /api/v1/orders
Body: {
  restaurant_id: UUID,
  customer_id?: UUID,
  customer_name?: string,
  customer_email?: string,
  items: [{
    product_id: UUID,
    quantity: number,
    unit_price: number,
    modifiers?: object[]
  }],
  payment_method: string,
  notes?: string
}

PATCH /api/v1/orders/{id}/status
Body: {
  status: OrderStatus,
  notes?: string
}

WebSocket /ws/orders/{restaurant_id}
Events:
  - order_created
  - order_updated
  - order_completed
```

#### 3. Employee Management
```python
GET /api/v1/employees
Query params:
  - restaurant_id: UUID
  - role: string (optional)
  - active: boolean (optional)
Response: {
  employees: [{
    id: UUID,
    first_name: string,
    last_name: string,
    email: string,
    phone: string,
    role: string,
    profile: {
      hourly_rate: number,
      hire_date: date
    },
    metrics: {
      total_sales: number,
      total_orders: number,
      performance_score: number
    }
  }]
}

POST /api/v1/employees
Body: {
  first_name: string,
  last_name: string,
  email: string,
  password: string,
  role: string,
  hourly_rate?: number
}

GET /api/v1/employees/{id}/schedule
Query params:
  - week: date
Response: Schedule[]
```

#### 4. Customer Management
```python
GET /api/v1/customers
Query params:
  - restaurant_id: UUID
  - search: string (optional)
  - segment: string (optional)
Response: {
  customers: [{
    id: UUID,
    name: string,
    email: string,
    phone: string,
    joined_date: date,
    metrics: {
      total_spent: number,
      order_count: number,
      last_visit: date,
      avg_order_value: number
    },
    loyalty: {
      points: number,
      tier: string,
      tier_progress: number
    }
  }]
}

POST /api/v1/customers
Body: {
  first_name: string,
  last_name: string,
  email: string,
  phone?: string
}

POST /api/v1/customers/{id}/loyalty/earn
Body: {
  order_id: UUID,
  amount: number
}
```

#### 5. Inventory Management
```python
GET /api/v1/inventory
Query params:
  - restaurant_id: UUID
  - status: string (optional)
  - category: string (optional)
Response: {
  items: InventoryItem[],
  summary: {
    total_items: number,
    total_value: number,
    low_stock_count: number,
    out_of_stock_count: number
  }
}

POST /api/v1/inventory/{id}/adjust
Body: {
  adjustment: number,
  reason: string,
  type: AdjustmentType
}

GET /api/v1/inventory/{id}/movements
Query params:
  - date_from: date
  - date_to: date
Response: StockMovement[]
```

### 🟡 Important Endpoints (Needed soon)

#### 6. Analytics & Reports
```python
GET /api/v1/analytics/dashboard/{restaurant_id}
Query params:
  - period: string (today|week|month|year)
Response: {
  revenue: RevenueMetrics,
  orders: OrderMetrics,
  products: ProductMetrics,
  customers: CustomerMetrics,
  staff: StaffMetrics
}

GET /api/v1/reports/sales
Query params:
  - restaurant_id: UUID
  - date_from: date
  - date_to: date
  - group_by: string (day|week|month)
Response: SalesReport

GET /api/v1/reports/inventory/valuation
Query params:
  - restaurant_id: UUID
  - date: date
Response: InventoryValuation
```

#### 7. Platform Management
```python
GET /api/v1/platform/restaurants
Response: Restaurant[]

GET /api/v1/platform/metrics
Response: {
  total_restaurants: number,
  active_restaurants: number,
  total_revenue: number,
  total_orders: number,
  platform_fees: number
}

GET /api/v1/platform/settings
Response: PlatformSettings

PUT /api/v1/platform/settings
Body: Partial<PlatformSettings>
```

## Data Models & Validation

### Enums
```python
class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class UserRole(str, Enum):
    PLATFORM_OWNER = "platform_owner"
    RESTAURANT_OWNER = "restaurant_owner"
    MANAGER = "manager"
    EMPLOYEE = "employee"

class MovementType(str, Enum):
    PURCHASE = "purchase"
    SALE = "sale"
    ADJUSTMENT = "adjustment"
    TRANSFER = "transfer"
    WASTAGE = "wastage"
```

### Request/Response Models
```python
# Pydantic models for validation

class MenuItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category_id: UUID
    price: Decimal = Field(..., gt=0, decimal_places=2)
    description: Optional[str] = None
    emoji: Optional[str] = Field(None, max_length=10)
    
class OrderCreate(BaseModel):
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_email: Optional[EmailStr] = None
    items: List[OrderItemCreate]
    payment_method: str
    notes: Optional[str] = None
    
    @validator('items')
    def validate_items_not_empty(cls, v):
        if not v:
            raise ValueError('Order must contain at least one item')
        return v

class StockAdjustment(BaseModel):
    adjustment: Decimal
    reason: str = Field(..., min_length=1)
    type: MovementType
    
    @validator('adjustment')
    def validate_adjustment_not_zero(cls, v):
        if v == 0:
            raise ValueError('Adjustment cannot be zero')
        return v
```

## Security Requirements

### Authentication & Authorization
```python
# All endpoints must include authentication
current_user: User = Depends(get_current_user)

# Role-based access control
def require_role(allowed_roles: List[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(403, "Insufficient permissions")
        return current_user
    return role_checker

# Usage
@router.get("/platform/settings")
async def get_platform_settings(
    current_user: User = Depends(require_role([UserRole.PLATFORM_OWNER]))
):
    pass
```

### Data Validation & Sanitization
```python
# Input sanitization
def sanitize_input(value: str) -> str:
    dangerous_chars = ['<', '>', '"', "'", '(', ')', ';', '&', '+']
    for char in dangerous_chars:
        value = value.replace(char, '')
    return value.strip()

# Multi-tenant validation
def validate_restaurant_access(
    restaurant_id: UUID,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.PLATFORM_OWNER:
        if str(current_user.restaurant_id) != str(restaurant_id):
            raise HTTPException(403, "Access denied to this restaurant")
```

## Performance Requirements

### Database Indexes
```sql
-- Critical indexes for performance
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_products_restaurant_category ON products(restaurant_id, category_id);
CREATE INDEX idx_customers_restaurant_email ON customers(restaurant_id, email);
CREATE INDEX idx_inventory_restaurant_reorder ON inventory_items(restaurant_id, current_quantity, reorder_level);
```

### Caching Strategy
```python
# Redis caching for frequently accessed data
CACHE_TTL = {
    "menu_items": 300,      # 5 minutes
    "categories": 600,      # 10 minutes
    "dashboard": 60,        # 1 minute
    "customer_metrics": 300 # 5 minutes
}

async def get_cached_or_fetch(
    cache_key: str,
    fetch_func: Callable,
    ttl: int
):
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    data = await fetch_func()
    await redis.set(cache_key, json.dumps(data), expire=ttl)
    return data
```

## Integration Requirements

### WebSocket Events
```python
# Real-time event broadcasting
async def broadcast_order_update(order: Order, event_type: str):
    await websocket_manager.broadcast(
        f"restaurant:{order.restaurant_id}",
        {
            "type": event_type,
            "data": {
                "order_id": str(order.id),
                "order_number": order.order_number,
                "status": order.status,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    )
```

### Background Tasks
```python
# Celery tasks for async operations
@celery_app.task
def update_customer_metrics(customer_id: str):
    """Recalculate customer metrics after order"""
    pass

@celery_app.task
def check_inventory_levels(restaurant_id: str):
    """Check for low stock and create alerts"""
    pass

@celery_app.task
def generate_daily_reports(restaurant_id: str):
    """Generate and cache daily reports"""
    pass
```

## Monitoring & Logging

### API Logging
```python
# Log all API requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    logger.info(
        f"{request.method} {request.url.path} "
        f"status={response.status_code} "
        f"duration={duration:.3f}s "
        f"user={getattr(request.state, 'user_id', 'anonymous')}"
    )
    return response
```

### Error Tracking
```python
# Sentry integration for production
if settings.ENVIRONMENT == "production":
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )
```

## Migration Path

### Phase 1: Core Functionality (Week 1)
1. Add missing database tables
2. Implement menu endpoints properly
3. Connect orders to database
4. Basic employee/customer endpoints

### Phase 2: Integration (Week 2)
1. WebSocket real-time updates
2. Inventory management
3. Loyalty system
4. Basic analytics

### Phase 3: Platform Features (Week 3)
1. Multi-restaurant dashboard
2. Platform settings management
3. Advanced reporting
4. Performance optimization

### Phase 4: Polish (Week 4)
1. Error handling improvements
2. Performance testing
3. Security audit
4. Documentation