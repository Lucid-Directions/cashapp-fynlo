# Platform Connections - Multi-Tenant Architecture

## Overview

The Fynlo POS system is designed as a multi-tenant platform where:
- **Platform Owners** manage multiple restaurants
- **Restaurant Owners** manage their specific business
- **Restaurant Staff** operate the POS system
- All data flows up to platform-level analytics

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Platform Owner Portal                     │
│  (Web Dashboard - platform.fynlopos.com)                    │
├─────────────────────────────────────────────────────────────┤
│  • Multi-restaurant overview                                │
│  • Platform settings (service charge, payments)             │
│  • Revenue analytics & commission tracking                  │
│  • System monitoring & alerts                               │
└────────────────────┬───────────────────────────────────────┘
                     │ WebSocket + REST API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend API                            │
│                  (FastAPI + PostgreSQL)                     │
├─────────────────────────────────────────────────────────────┤
│  • Multi-tenant data isolation                             │
│  • Real-time event broadcasting                            │
│  • Platform-wide aggregation                               │
│  • Permission management                                    │
└────────┬───────────────────────┬───────────────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────────┐
│ Restaurant iOS  │    │ Restaurant Manager  │
│   POS Apps      │    │   Web Portal        │
├─────────────────┤    ├─────────────────────┤
│ • Order taking  │    │ • Menu management   │
│ • Payments      │    │ • Staff schedules   │
│ • Inventory     │    │ • Reports           │
└─────────────────┘    └─────────────────────┘
```

## Platform-Controlled vs Restaurant-Controlled

### Platform-Controlled Settings (Cannot be modified by restaurants)
```typescript
interface PlatformSettings {
  // Payment Processing
  service_charge_rate: number;        // Fixed at 12.5%
  payment_processing_fees: {
    qr_code: number;                 // 1.2%
    card: number;                    // 2.9%
    apple_pay: number;               // 2.9%
  };
  
  // Commission Structure
  platform_commission: number;        // 1% of transactions
  subscription_tiers: {
    alpha: { price: 0, features: string[] };
    beta: { price: 49, features: string[] };
    omega: { price: 119, features: string[] };
  };
  
  // Compliance
  tax_reporting_requirements: object;
  data_retention_policies: object;
  
  // Feature Flags
  available_features: {
    inventory_management: boolean;
    loyalty_program: boolean;
    table_management: boolean;
    kitchen_display: boolean;
  };
}
```

### Restaurant-Controlled Settings
```typescript
interface RestaurantSettings {
  // Business Information
  business_details: {
    name: string;
    address: object;
    tax_number: string;
    contact_info: object;
  };
  
  // Operations
  operating_hours: WeeklySchedule;
  tax_configuration: {
    vat_rate: number;
    tax_exempt_categories: string[];
  };
  
  // Customization
  receipt_settings: object;
  floor_plan: object;
  menu_configuration: object;
}
```

## Real-Time Data Synchronization

### WebSocket Events Flow

#### From Mobile App → Platform
```typescript
// Order Events
{
  type: 'order.created',
  restaurant_id: UUID,
  data: {
    order_id: UUID,
    total_amount: number,
    payment_method: string,
    timestamp: ISO8601
  }
}

// Inventory Events
{
  type: 'inventory.low_stock',
  restaurant_id: UUID,
  data: {
    item_id: UUID,
    current_stock: number,
    reorder_level: number
  }
}

// Staff Events
{
  type: 'staff.clock_in',
  restaurant_id: UUID,
  data: {
    user_id: UUID,
    timestamp: ISO8601,
    location: object
  }
}
```

#### From Platform → Mobile Apps
```typescript
// Settings Updates
{
  type: 'settings.updated',
  scope: 'platform' | 'restaurant',
  data: {
    changes: object,
    effective_date: ISO8601
  }
}

// System Alerts
{
  type: 'system.alert',
  severity: 'info' | 'warning' | 'critical',
  data: {
    message: string,
    action_required: boolean
  }
}
```

## Data Aggregation for Platform Dashboard

### Real-Time Metrics
```sql
-- Live orders across all restaurants
CREATE VIEW platform_live_orders AS
SELECT 
  r.name as restaurant_name,
  r.id as restaurant_id,
  COUNT(o.id) as active_orders,
  SUM(o.total_amount) as pending_revenue,
  AVG(EXTRACT(EPOCH FROM (NOW() - o.created_at))/60) as avg_wait_time_minutes
FROM orders o
JOIN restaurants r ON o.restaurant_id = r.id
WHERE o.status IN ('pending', 'preparing', 'ready')
GROUP BY r.id, r.name;

-- Platform revenue tracking
CREATE VIEW platform_revenue_stream AS
SELECT 
  DATE_TRUNC('hour', o.created_at) as hour,
  COUNT(DISTINCT o.restaurant_id) as active_restaurants,
  COUNT(o.id) as total_orders,
  SUM(o.total_amount) as gross_revenue,
  SUM(o.total_amount * 0.01) as platform_commission,
  SUM(o.service_charge_amount) as service_charges,
  SUM(CASE 
    WHEN o.payment_method = 'qr_code' THEN o.total_amount * 0.012
    WHEN o.payment_method IN ('card', 'apple_pay') THEN o.total_amount * 0.029
    ELSE 0
  END) as payment_processing_fees
FROM orders o
WHERE o.status = 'completed'
  AND o.created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Platform Analytics Queries

#### Restaurant Performance Ranking
```sql
WITH restaurant_metrics AS (
  SELECT 
    r.id,
    r.name,
    r.subscription_plan,
    COUNT(DISTINCT o.id) as order_count,
    SUM(o.total_amount) as total_revenue,
    AVG(o.total_amount) as avg_order_value,
    COUNT(DISTINCT o.customer_id) as unique_customers,
    COUNT(DISTINCT DATE(o.created_at)) as active_days
  FROM restaurants r
  LEFT JOIN orders o ON r.id = o.restaurant_id
    AND o.created_at > NOW() - INTERVAL '30 days'
    AND o.status = 'completed'
  GROUP BY r.id, r.name, r.subscription_plan
)
SELECT 
  *,
  RANK() OVER (ORDER BY total_revenue DESC) as revenue_rank,
  RANK() OVER (ORDER BY order_count DESC) as volume_rank,
  RANK() OVER (ORDER BY avg_order_value DESC) as aov_rank
FROM restaurant_metrics
ORDER BY total_revenue DESC;
```

#### System Health Monitoring
```sql
-- API response times by restaurant
SELECT 
  al.restaurant_id,
  r.name,
  AVG(al.response_time_ms) as avg_response_time,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY al.response_time_ms) as p95_response_time,
  COUNT(*) as request_count,
  SUM(CASE WHEN al.status_code >= 500 THEN 1 ELSE 0 END) as error_count
FROM api_logs al
JOIN restaurants r ON al.restaurant_id = r.id
WHERE al.created_at > NOW() - INTERVAL '1 hour'
GROUP BY al.restaurant_id, r.name
HAVING COUNT(*) > 10
ORDER BY avg_response_time DESC;
```

## Permission Matrix

### Platform Owner Permissions
```python
PLATFORM_OWNER_PERMISSIONS = [
    # Global Access
    "platform.view_all_restaurants",
    "platform.manage_settings",
    "platform.view_financials",
    "platform.manage_subscriptions",
    
    # Restaurant Override
    "restaurant.*.view",  # View any restaurant
    "restaurant.*.export_data",
    "restaurant.*.view_financials",
    
    # System Management
    "system.view_logs",
    "system.manage_features",
    "system.emergency_shutdown",
    
    # Cannot Do
    # ❌ "restaurant.*.edit_menu"  # Cannot edit restaurant menus
    # ❌ "restaurant.*.process_refund"  # Cannot process refunds
]
```

### Restaurant Owner Permissions
```python
RESTAURANT_OWNER_PERMISSIONS = [
    # Own Restaurant Only
    "restaurant.{self}.view",
    "restaurant.{self}.edit_settings",
    "restaurant.{self}.manage_staff",
    "restaurant.{self}.view_reports",
    "restaurant.{self}.export_data",
    
    # Operations
    "pos.process_orders",
    "pos.process_payments",
    "pos.issue_refunds",
    
    # Cannot Do
    # ❌ "platform.view_settings"  # Cannot view platform settings
    # ❌ "restaurant.{self}.edit_service_charge"  # Cannot modify service charge
]
```

## Integration Points

### 1. Menu & Inventory Sync
```typescript
// When restaurant updates menu
onMenuUpdate(changes) {
  // Update local menu
  updateLocalMenu(changes);
  
  // Notify platform for analytics
  platformAPI.notifyMenuChange({
    restaurant_id: currentRestaurant.id,
    changes: changes,
    timestamp: new Date()
  });
  
  // Broadcast to other devices
  websocket.broadcast('menu.updated', changes);
}
```

### 2. Order Processing Flow
```typescript
// Order creation flow with platform integration
async function createOrder(orderData) {
  // 1. Create order locally
  const order = await localDB.createOrder(orderData);
  
  // 2. Send to backend
  const confirmedOrder = await api.createOrder(order);
  
  // 3. Notify platform dashboard (async)
  platformEvents.emit('order.created', {
    restaurant_id: currentRestaurant.id,
    order_id: confirmedOrder.id,
    amount: confirmedOrder.total_amount,
    items_count: confirmedOrder.items.length
  });
  
  // 4. Update inventory (async)
  inventoryService.deductItems(confirmedOrder.items);
  
  // 5. Update customer metrics (async)
  if (confirmedOrder.customer_id) {
    customerService.updateMetrics(confirmedOrder.customer_id, confirmedOrder);
  }
  
  return confirmedOrder;
}
```

### 3. Financial Reconciliation
```python
# Daily reconciliation job
@celery_task
def reconcile_platform_financials(date: date):
    """Calculate platform earnings for the day"""
    
    restaurants = Restaurant.query.filter_by(is_active=True).all()
    
    for restaurant in restaurants:
        # Calculate gross revenue
        daily_revenue = calculate_daily_revenue(restaurant.id, date)
        
        # Calculate platform fees
        platform_commission = daily_revenue * 0.01  # 1%
        subscription_fee = get_daily_subscription_fee(restaurant.subscription_plan)
        
        # Create reconciliation record
        reconciliation = PlatformReconciliation(
            restaurant_id=restaurant.id,
            date=date,
            gross_revenue=daily_revenue,
            platform_commission=platform_commission,
            subscription_fee=subscription_fee,
            service_charges_collected=calculate_service_charges(restaurant.id, date),
            payment_processing_fees=calculate_processing_fees(restaurant.id, date)
        )
        
        db.session.add(reconciliation)
    
    db.session.commit()
    
    # Send summary to platform owners
    send_daily_financial_summary(date)
```

## Security & Data Isolation

### Multi-Tenant Data Access
```python
# Base query filter for multi-tenant isolation
class RestaurantScopedMixin:
    @classmethod
    def query_for_restaurant(cls, restaurant_id: UUID):
        return cls.query.filter_by(restaurant_id=restaurant_id)
    
    @classmethod
    def query_for_user(cls, user: User):
        if user.role == 'platform_owner':
            return cls.query  # Access all restaurants
        return cls.query_for_restaurant(user.restaurant_id)

# Usage in endpoints
@router.get("/orders")
async def get_orders(current_user: User = Depends(get_current_user)):
    orders = Order.query_for_user(current_user).all()
    return orders
```

### Audit Trail for Platform Actions
```python
@event.listens_for(PlatformSettings, 'before_update')
def audit_platform_settings_change(mapper, connection, target):
    """Log all platform setting changes"""
    changes = {}
    for attr in inspect(target).attrs:
        if attr.history.has_changes():
            changes[attr.key] = {
                'old': attr.history.deleted[0] if attr.history.deleted else None,
                'new': attr.history.added[0] if attr.history.added else None
            }
    
    if changes:
        audit_log = AuditLog(
            user_id=current_user.id,
            action='platform_settings_update',
            resource_type='platform_settings',
            resource_id=target.id,
            changes=changes,
            ip_address=request.remote_addr
        )
        connection.execute(audit_log.__table__.insert().values(**audit_log.to_dict()))
```

## Platform Dashboard Components

### 1. Real-Time Operations Monitor
- Active orders across all restaurants
- Kitchen bottlenecks identification
- Payment processing status
- System alerts and notifications

### 2. Financial Dashboard
- Revenue streams visualization
- Commission tracking
- Payment method distribution
- Subscription revenue

### 3. Restaurant Performance
- Comparative analytics
- Growth trends
- Operational efficiency scores
- Customer satisfaction metrics

### 4. System Administration
- Feature flag management
- Restaurant onboarding
- Support ticket integration
- Compliance reporting

## Next Steps for Platform Integration

1. **Phase 1**: Implement WebSocket infrastructure for real-time updates
2. **Phase 2**: Build platform dashboard with key metrics
3. **Phase 3**: Add advanced analytics and reporting
4. **Phase 4**: Implement automated reconciliation and billing
5. **Phase 5**: Add predictive analytics and AI insights