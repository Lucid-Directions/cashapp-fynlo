# Dashboard Screen - Comprehensive Analysis

## Screen Overview
**File**: `src/screens/dashboard/DashboardScreen.tsx`  
**Purpose**: Real-time business metrics and operational overview  
**Status**: 🟡 Complete UI with live animations but mock data  
**Production Ready**: 30%

## 1. Current State Analysis

### What's Implemented ✅
- Real-time metric cards (UI only)
- Live order tracking widget
- Revenue graphs with animations
- Staff activity monitor
- Quick actions panel
- Weather integration (for foot traffic)
- Beautiful animated UI
- Period selection (Today/Week/Month)

### What's Not Working ❌
- All metrics are mock/random
- No real order tracking
- WebSocket not connected
- Staff status is fake
- Revenue calculations are random
- No backend data source
- Alerts are hardcoded

### Code References
```typescript
// Lines 65-85: Mock data generation
useEffect(() => {
  const interval = setInterval(() => {
    // Simulate real-time updates with random data
    setMetrics({
      revenue: Math.random() * 5000 + 2000,
      orders: Math.floor(Math.random() * 100) + 50,
      avgOrderValue: Math.random() * 30 + 15,
      customers: Math.floor(Math.random() * 200) + 100
    });
  }, 5000); // Updates every 5 seconds
  
  return () => clearInterval(interval);
}, []);
```

## 2. Data Flow Diagram

```
DashboardScreen
    ↓
Mock data generators
    ↓
Random updates every 5s
    ↓
UI animates changes
    ↓
No persistence

Expected Flow:
WebSocket connection
    ↓
Real-time order events
    ↓
Backend aggregations
    ↓
Dashboard updates live
    ↓
Platform sees all restaurants
```

## 3. Every Function & Requirement

### Dashboard Components
1. **Key Metrics Cards**
   - Today's Revenue
   - Active Orders
   - Average Order Value
   - Customer Count
   - Table Turnover
   - Staff Efficiency

2. **Live Order Tracker**
   - New orders notification
   - Order status progression
   - Kitchen times
   - Delivery tracking
   - Customer wait times

3. **Revenue Chart**
   - Hourly breakdown
   - Payment method split
   - Category performance
   - Comparison to average
   - Trend indicators

4. **Staff Monitor**
   - Who's clocked in
   - Current assignments
   - Break schedules
   - Performance scores
   - Alerts/notifications

5. **Quick Actions**
   - Start shift
   - View reports
   - Check inventory
   - Message staff
   - Adjust settings

### Real-time Operations
```typescript
// Expected WebSocket Events
interface DashboardEvents {
  'order.new': {
    order_id: string;
    amount: number;
    items: number;
    customer: string;
  };
  'order.updated': {
    order_id: string;
    status: OrderStatus;
    kitchen_time?: number;
  };
  'payment.completed': {
    amount: number;
    method: string;
    tip: number;
  };
  'staff.clock_in': {
    user_id: string;
    name: string;
    role: string;
  };
  'alert.triggered': {
    type: 'low_stock' | 'long_wait' | 'staff_break';
    message: string;
    severity: 'info' | 'warning' | 'critical';
  };
}

// Metric Calculations
interface LiveMetrics {
  revenue: {
    current: number;
    target: number;
    growth: number;
    by_hour: ChartPoint[];
  };
  operations: {
    orders_active: number;
    avg_prep_time: number;
    table_turnover: number;
    service_rating: number;
  };
  staff: {
    active: number;
    on_break: number;
    efficiency: number;
    alerts: Alert[];
  };
}
```

### State Management
```typescript
// Current State (Mock)
const [metrics, setMetrics] = useState<DashboardMetrics>({
  revenue: 0,
  orders: 0,
  avgOrderValue: 0,
  customers: 0
});
const [activeOrders, setActiveOrders] = useState<Order[]>([]);
const [staffStatus, setStaffStatus] = useState<StaffMember[]>([]);
const [alerts, setAlerts] = useState<Alert[]>([]);
const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');

// Should be WebSocket-driven
const [isConnected, setIsConnected] = useState(false);
const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
```

## 4. Platform Connections

### Data Flow to Platform
1. **Real-time Aggregations**
   - Restaurant health scores
   - System-wide metrics
   - Alert summaries
   - Performance rankings

2. **Operational Monitoring**
   - Service delays
   - Staff issues
   - System errors
   - Customer complaints

3. **Business Intelligence**
   - Peak time analysis
   - Resource utilization
   - Efficiency metrics
   - Growth indicators

### Platform Dashboard View
```typescript
// Platform Owner Dashboard
interface PlatformDashboard {
  restaurants: {
    id: string;
    name: string;
    status: 'online' | 'offline' | 'issues';
    metrics: {
      revenue_today: number;
      active_orders: number;
      health_score: number;
    };
    alerts: Alert[];
  }[];
  totals: {
    platform_revenue: number;
    total_orders: number;
    active_restaurants: number;
    critical_alerts: number;
  };
  trends: {
    revenue_growth: number;
    order_volume_change: number;
    new_customers: number;
  };
}
```

## 5. Backend Requirements

### Real-time Data Endpoints
```python
# WebSocket endpoint for dashboard
@app.websocket("/ws/dashboard/{restaurant_id}")
async def dashboard_websocket(
    websocket: WebSocket,
    restaurant_id: str,
    current_user: User = Depends(get_current_user_ws)
):
    await websocket.accept()
    
    # Subscribe to restaurant events
    await subscribe_to_events(restaurant_id, [
        "order.*",
        "payment.*",
        "staff.*",
        "inventory.low_stock",
        "system.alert"
    ])
    
    # Send initial state
    initial_data = await get_dashboard_state(restaurant_id)
    await websocket.send_json({
        "type": "initial_state",
        "data": initial_data
    })
    
    # Handle real-time updates
    try:
        while True:
            event = await get_next_event(restaurant_id)
            await websocket.send_json(event)
    except WebSocketDisconnect:
        await unsubscribe_from_events(restaurant_id)

# REST endpoint for dashboard metrics
GET /api/v1/dashboard/metrics
Query params:
  - restaurant_id: UUID
  - period: 'today' | 'week' | 'month'
Response: {
  metrics: {
    revenue: {
      total: number,
      growth: number,
      by_hour: ChartData[],
      by_category: ChartData[]
    },
    orders: {
      total: number,
      active: number,
      average_value: number,
      completion_time: number
    },
    customers: {
      total: number,
      new: number,
      returning: number,
      satisfaction: number
    },
    staff: {
      active: number,
      efficiency: number,
      labor_cost: number
    }
  },
  trends: TrendData[],
  alerts: Alert[]
}
```

### Database Queries for Real-time Metrics
```sql
-- Live order status
CREATE OR REPLACE VIEW live_orders AS
SELECT 
  o.id,
  o.order_number,
  o.status,
  o.total_amount,
  o.created_at,
  EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 as minutes_active,
  c.first_name || ' ' || c.last_name as customer_name,
  COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.status IN ('pending', 'preparing', 'ready')
  AND o.created_at > NOW() - INTERVAL '24 hours'
GROUP BY o.id, c.first_name, c.last_name;

-- Real-time revenue
CREATE OR REPLACE FUNCTION get_live_revenue(
  p_restaurant_id UUID,
  p_period VARCHAR
) RETURNS TABLE (
  total DECIMAL,
  order_count INTEGER,
  avg_order_value DECIMAL,
  growth_percentage DECIMAL
) AS $$
BEGIN
  -- Implementation for different periods
END;
$$ LANGUAGE plpgsql;

-- Staff activity tracking
CREATE TABLE staff_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  restaurant_id UUID REFERENCES restaurants(id),
  action VARCHAR(50), -- clock_in, clock_out, break_start, break_end
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  location POINT, -- For geo-verification
  device_id VARCHAR(100)
);
```

## 6. Current Issues

### Critical Issues
1. **No Real Data Connection**
   ```typescript
   // All metrics are randomly generated
   const fakeMetrics = {
     revenue: Math.random() * 5000,
     orders: Math.floor(Math.random() * 100)
   };
   ```

2. **Missing WebSocket Implementation**
   - No real-time order updates
   - No live staff tracking
   - No instant alerts
   - Manual refresh required

3. **Performance Problems**
   ```typescript
   // Current: Fake updates every 5 seconds
   // Problem: Creates janky animations
   // Need: Smooth real-time updates via WebSocket
   ```

### Architecture Issues
1. **No State Management**
   - Metrics reset on navigation
   - No data persistence
   - Lost on app background

2. **No Error Handling**
   - Connection failures not handled
   - No offline mode
   - No retry logic

3. **Security Concerns**
   - Role-based data filtering missing
   - All users see same dashboard
   - No data isolation

## 7. Required Fixes

### WebSocket Implementation (Priority 1)
```typescript
// hooks/useDashboardWebSocket.ts
export const useDashboardWebSocket = (restaurantId: string) => {
  const [metrics, setMetrics] = useState<DashboardMetrics>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/dashboard/${restaurantId}`);
    
    ws.onopen = () => {
      setIsConnected(true);
      console.log('Dashboard WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'initial_state':
          setMetrics(message.data.metrics);
          setActiveOrders(message.data.active_orders);
          break;
          
        case 'order.new':
          setActiveOrders(prev => [message.data, ...prev]);
          setMetrics(prev => ({
            ...prev,
            orders: prev.orders + 1,
            revenue: prev.revenue + message.data.amount
          }));
          break;
          
        case 'order.completed':
          setActiveOrders(prev => 
            prev.filter(o => o.id !== message.data.order_id)
          );
          break;
          
        case 'metrics.update':
          setMetrics(message.data);
          break;
      }
    };
    
    ws.onerror = (error) => {
      console.error('Dashboard WebSocket error:', error);
      setIsConnected(false);
    };
    
    return () => {
      ws.close();
    };
  }, [restaurantId]);
  
  return { metrics, activeOrders, isConnected };
};
```

### Backend Real-time Service (Priority 2)
```python
# services/dashboard_service.py
class DashboardService:
    def __init__(self):
        self.redis = get_redis()
        self.connections = {}
    
    async def get_live_metrics(self, restaurant_id: str) -> dict:
        """Get current dashboard metrics"""
        # Check cache first
        cached = await self.redis.get(f"dashboard:{restaurant_id}")
        if cached:
            return json.loads(cached)
        
        # Calculate fresh metrics
        db = SessionLocal()
        try:
            today = date.today()
            
            # Revenue metrics
            revenue_data = db.query(
                func.sum(Order.total_amount).label('total'),
                func.count(Order.id).label('count'),
                func.avg(Order.total_amount).label('average')
            ).filter(
                Order.restaurant_id == restaurant_id,
                Order.created_at >= today,
                Order.status == 'completed'
            ).first()
            
            # Active orders
            active_orders = db.query(Order).filter(
                Order.restaurant_id == restaurant_id,
                Order.status.in_(['pending', 'preparing', 'ready'])
            ).all()
            
            # Staff status
            active_staff = db.query(User).filter(
                User.restaurant_id == restaurant_id,
                User.is_clocked_in == True
            ).count()
            
            metrics = {
                "revenue": {
                    "total": float(revenue_data.total or 0),
                    "orders": revenue_data.count or 0,
                    "average": float(revenue_data.average or 0)
                },
                "operations": {
                    "active_orders": len(active_orders),
                    "active_staff": active_staff
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Cache for 30 seconds
            await self.redis.set(
                f"dashboard:{restaurant_id}",
                json.dumps(metrics),
                expire=30
            )
            
            return metrics
        finally:
            db.close()
    
    async def broadcast_event(self, restaurant_id: str, event: dict):
        """Broadcast event to all connected dashboards"""
        connections = self.connections.get(restaurant_id, [])
        for websocket in connections:
            try:
                await websocket.send_json(event)
            except:
                # Remove dead connections
                connections.remove(websocket)
```

### Event Broadcasting (Priority 3)
```python
# Event listeners for real-time updates
@event.listens_for(Order, 'after_insert')
def broadcast_new_order(mapper, connection, target):
    asyncio.create_task(
        dashboard_service.broadcast_event(
            target.restaurant_id,
            {
                "type": "order.new",
                "data": {
                    "order_id": str(target.id),
                    "amount": float(target.total_amount),
                    "items": len(target.items),
                    "customer": target.customer_name
                }
            }
        )
    )

@event.listens_for(Order, 'after_update')
def broadcast_order_update(mapper, connection, target):
    if target.status in ['completed', 'cancelled']:
        asyncio.create_task(
            dashboard_service.broadcast_event(
                target.restaurant_id,
                {
                    "type": f"order.{target.status}",
                    "data": {
                        "order_id": str(target.id),
                        "completion_time": calculate_completion_time(target)
                    }
                }
            )
        )
```

### Offline Support (Priority 4)
```typescript
// services/DashboardCache.ts
class DashboardCache {
  private cache: Map<string, DashboardMetrics> = new Map();
  
  async getMetrics(restaurantId: string): Promise<DashboardMetrics> {
    // Try to get from cache first
    const cached = this.cache.get(restaurantId);
    if (cached && this.isFresh(cached)) {
      return cached;
    }
    
    // Fetch from API
    try {
      const metrics = await DataService.getInstance().getDashboardMetrics(restaurantId);
      this.cache.set(restaurantId, {
        ...metrics,
        timestamp: new Date()
      });
      return metrics;
    } catch (error) {
      // Return cached data even if stale
      if (cached) {
        return { ...cached, isStale: true };
      }
      throw error;
    }
  }
  
  private isFresh(data: any): boolean {
    const age = Date.now() - data.timestamp.getTime();
    return age < 60000; // 1 minute
  }
}
```

## 8. Testing Requirements

### Unit Tests
1. Metric calculations
2. WebSocket message handling
3. Chart data formatting
4. Alert prioritization
5. Period calculations

### Integration Tests
1. Real-time data flow
2. Multiple dashboard connections
3. Event broadcasting
4. Cache behavior
5. Offline functionality

### Performance Tests
1. Handle 100+ concurrent dashboards
2. Sub-second updates
3. Smooth animations
4. Memory usage optimization
5. Battery efficiency

### User Acceptance Criteria
- [ ] Metrics update within 1 second
- [ ] Orders appear instantly
- [ ] Staff changes reflect immediately
- [ ] Charts animate smoothly
- [ ] Works offline with cached data
- [ ] Reconnects automatically
- [ ] No data discrepancies

## 9. Platform Owner Portal Integration

### Multi-Restaurant Dashboard
```typescript
// Platform owner sees all restaurants
interface PlatformDashboardView {
  summary: {
    total_revenue: number;
    active_restaurants: number;
    total_orders: number;
    system_health: 'good' | 'warning' | 'critical';
  };
  restaurants: RestaurantCard[];
  alerts: PlatformAlert[];
  trends: {
    hourly_revenue: ChartData[];
    restaurant_comparison: ComparisonData[];
  };
}

// WebSocket for platform-wide updates
ws.send({
  type: 'subscribe',
  restaurants: ['*'], // All restaurants
  events: [
    'restaurant.online',
    'restaurant.offline',
    'alert.critical',
    'milestone.reached'
  ]
});
```

### Platform Monitoring
```sql
-- Real-time platform metrics
CREATE OR REPLACE VIEW platform_live_metrics AS
SELECT 
  COUNT(DISTINCT r.id) FILTER (WHERE r.last_heartbeat > NOW() - INTERVAL '5 minutes') as online_restaurants,
  COUNT(DISTINCT o.restaurant_id) FILTER (WHERE o.created_at > NOW() - INTERVAL '1 hour') as active_restaurants,
  SUM(o.total_amount) FILTER (WHERE o.created_at > NOW() - INTERVAL '1 hour') as hourly_revenue,
  COUNT(o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '1 hour') as hourly_orders,
  AVG(EXTRACT(EPOCH FROM (o.completed_at - o.created_at))/60) as avg_completion_time
FROM restaurants r
LEFT JOIN orders o ON r.id = o.restaurant_id
  AND o.status = 'completed'
  AND o.created_at > NOW() - INTERVAL '24 hours';

-- Critical alerts aggregation
SELECT 
  r.name as restaurant,
  a.type,
  a.message,
  a.severity,
  a.created_at
FROM alerts a
JOIN restaurants r ON a.restaurant_id = r.id
WHERE a.severity = 'critical'
  AND a.acknowledged = false
  AND a.created_at > NOW() - INTERVAL '1 hour'
ORDER BY a.created_at DESC;
```

## Next Steps

1. **Immediate**: Implement WebSocket connection
2. **Today**: Create dashboard metrics endpoint
3. **Tomorrow**: Add real-time order tracking
4. **This Week**: Staff monitoring integration
5. **Next Week**: Platform dashboard aggregation
6. **Future**: Predictive analytics and AI insights

## Related Documentation
- See `01_POS_SCREEN_ANALYSIS.md` for order creation flow
- See `07_REPORTS_SCREEN_ANALYSIS.md` for historical data
- See `WebSocketService.ts` for connection management