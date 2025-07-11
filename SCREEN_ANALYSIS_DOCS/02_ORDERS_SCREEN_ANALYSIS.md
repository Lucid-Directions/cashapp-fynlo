# Orders Screen - Comprehensive Analysis

## Screen Overview
**File**: `src/screens/orders/OrdersScreen.tsx`  
**Purpose**: Manage and view all restaurant orders  
**Status**: 🟡 Partially working with mock data  
**Production Ready**: 40%

## 1. Current State Analysis

### What's Implemented ✅
- Order list with status indicators
- Real-time order updates via WebSocket (structure exists)
- Order filtering by status (All, Active, Completed)
- Search functionality
- Order details modal
- Status update capabilities
- Pull-to-refresh
- Professional UI with proper theming

### What's Not Working ❌
- Using mock order data instead of real backend
- WebSocket connected but not receiving real orders
- No order creation from POS screen integration
- Status updates don't persist
- No kitchen display system integration

### Code References
```typescript
// OrdersScreen.tsx - Key sections
const { 
  orders,
  loadOrders,
  updateOrderStatus,
  activeOrdersCount
} = useOrderStore();

// WebSocket integration exists but needs real data
const { connected, subscribe } = useWebSocket();

useEffect(() => {
  const unsubscribe = subscribe('order_update', (data) => {
    // Handle real-time order updates
    refreshOrders();
  });
  return unsubscribe;
}, []);
```

## 2. Data Flow Diagram

```
OrdersScreen
    ↓
useOrderStore (Zustand)
    ↓
DataService.getOrders()
    ↓ (currently returns mock)
DatabaseService.getOrders()
    ↓
GET /api/v1/orders
    ↓
Backend (returns mock data)
    ↓
Display Orders List

Real-time Flow:
WebSocket Server
    ↓ (order_update event)
OrdersScreen subscription
    ↓
Refresh orders list
```

## 3. Every Function & Requirement

### User Actions
1. **View Orders**
   - See list of all orders
   - Filter by status (pending, preparing, ready, completed)
   - Search by order number or customer
   - Pull to refresh latest orders

2. **Order Management**
   - View order details
   - Update order status
   - Mark as ready for pickup
   - Complete order
   - Cancel order (with reason)

3. **Order Details**
   - Customer information
   - Items ordered with quantities
   - Special instructions
   - Total amount
   - Payment status
   - Time elapsed

### Data Operations
1. **Order Loading**
   ```typescript
   const loadOrders = async () => {
     const orders = await DataService.getOrders();
     setOrders(orders);
   };
   ```

2. **Status Updates**
   ```typescript
   const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
     await DataService.updateOrderStatus(orderId, status);
     // Emit WebSocket event for real-time updates
   };
   ```

3. **Real-time Sync**
   - Subscribe to order_created events
   - Subscribe to order_updated events
   - Subscribe to order_completed events

### State Management
```typescript
// Order Store Structure
interface OrderStore {
  orders: Order[];
  loadingOrders: boolean;
  error: string | null;
  activeOrdersCount: number;
  
  loadOrders: () => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  addOrder: (order: Order) => void;
  removeOrder: (id: string) => void;
}

// Order Status Enum
enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}
```

## 4. Platform Connections

### Data Sent to Platform
1. **Order Metrics**
   - New orders count
   - Average preparation time
   - Order completion rate
   - Cancellation rate
   - Peak order times

2. **Performance Data**
   - Kitchen efficiency
   - Average wait time
   - Status transition times
   - Staff performance

3. **Real-time Dashboard**
   - Active orders across all restaurants
   - Order flow visualization
   - Bottleneck identification

### Platform Controls
1. **Order Settings**
   - Auto-accept orders
   - Preparation time estimates
   - Order capacity limits
   - Rush hour definitions

2. **Notification Rules**
   - Alert on long wait times
   - Notify on cancellations
   - Peak time warnings

## 5. Backend Requirements

### Database Tables
```sql
-- Orders table (exists)
orders:
  - id (UUID)
  - restaurant_id (UUID)
  - order_number (VARCHAR) - Sequential per restaurant
  - customer_id (UUID, nullable)
  - customer_name (VARCHAR)
  - customer_email (VARCHAR)
  - customer_phone (VARCHAR)
  - status (ENUM)
  - payment_status (ENUM)
  - payment_method (VARCHAR)
  - subtotal (DECIMAL)
  - tax_amount (DECIMAL)
  - service_charge_amount (DECIMAL)
  - total_amount (DECIMAL)
  - notes (TEXT)
  - created_at (TIMESTAMP)
  - confirmed_at (TIMESTAMP)
  - ready_at (TIMESTAMP)
  - completed_at (TIMESTAMP)

-- Order Items table (needs creation)
order_items:
  - id (UUID)
  - order_id (UUID)
  - product_id (UUID)
  - quantity (INT)
  - unit_price (DECIMAL)
  - subtotal (DECIMAL)
  - modifiers (JSONB)
  - notes (TEXT)
```

### API Endpoints Required
```python
# Order Management
GET /api/v1/orders?restaurant_id={id}&status={status}&date={date}
Response: Order[]

GET /api/v1/orders/{order_id}
Response: OrderDetails

POST /api/v1/orders
Body: CreateOrderRequest

PATCH /api/v1/orders/{order_id}/status
Body: { status: OrderStatus, notes?: string }

DELETE /api/v1/orders/{order_id}
Body: { reason: string }

# Real-time endpoints
WS /api/v1/ws/orders
Events: order_created, order_updated, order_completed
```

### WebSocket Events
```typescript
// Order Created Event
{
  type: 'order_created',
  data: {
    order: Order,
    restaurant_id: string,
    timestamp: string
  }
}

// Order Updated Event
{
  type: 'order_updated',
  data: {
    order_id: string,
    changes: Partial<Order>,
    updated_by: string,
    timestamp: string
  }
}

// Order Status Changed Event
{
  type: 'order_status_changed',
  data: {
    order_id: string,
    previous_status: OrderStatus,
    new_status: OrderStatus,
    timestamp: string
  }
}
```

## 6. Current Issues

### Critical Issues
1. **No Real Order Data**
   - Mock data hardcoded in responses
   - Orders don't persist between sessions
   - Can't create orders from POS screen

2. **WebSocket Not Integrated**
   - Connection established but no real events
   - Backend doesn't emit order events
   - No bi-directional communication

3. **Status Updates Don't Persist**
   - Only updates local state
   - No API call to backend
   - Other devices don't see updates

### Missing Features
1. **Kitchen Display Integration**
   - No separate kitchen view
   - No item preparation tracking
   - No station assignment

2. **Order Lifecycle Tracking**
   - No timestamps for each status
   - No preparation time analytics
   - No SLA monitoring

3. **Print Integration**
   - No order receipt printing
   - No kitchen ticket printing
   - No order summary reports

## 7. Required Fixes

### Backend Implementation (Priority 1)
1. **Create Order Items Table**
   ```python
   # Alembic migration
   class OrderItem(Base):
       __tablename__ = "order_items"
       
       id = Column(UUID, primary_key=True)
       order_id = Column(UUID, ForeignKey("orders.id"))
       product_id = Column(UUID, ForeignKey("products.id"))
       quantity = Column(Integer, nullable=False)
       unit_price = Column(DECIMAL(10, 2), nullable=False)
       subtotal = Column(DECIMAL(10, 2), nullable=False)
       modifiers = Column(JSONB, default={})
       notes = Column(Text)
       
       # Relationships
       order = relationship("Order", back_populates="items")
       product = relationship("Product")
   ```

2. **Implement Order Endpoints**
   ```python
   @router.get("/orders")
   async def get_orders(
       restaurant_id: str = Query(...),
       status: Optional[OrderStatus] = None,
       date: Optional[date] = None,
       db: Session = Depends(get_db)
   ):
       query = db.query(Order).filter(Order.restaurant_id == restaurant_id)
       
       if status:
           query = query.filter(Order.status == status)
       if date:
           query = query.filter(func.date(Order.created_at) == date)
           
       orders = query.order_by(Order.created_at.desc()).all()
       return orders
   ```

3. **WebSocket Integration**
   ```python
   @router.websocket("/ws/orders")
   async def orders_websocket(websocket: WebSocket):
       await manager.connect(websocket)
       try:
           while True:
               # Handle incoming messages
               data = await websocket.receive_json()
               # Process and broadcast updates
       except WebSocketDisconnect:
           manager.disconnect(websocket)
   ```

### Frontend Updates (Priority 2)
1. **Connect Real Orders**
   ```typescript
   // In useOrderStore
   loadOrders: async () => {
     set({ loadingOrders: true });
     try {
       const orders = await DatabaseService.getOrders();
       set({ orders, error: null });
     } catch (error) {
       set({ error: error.message });
     } finally {
       set({ loadingOrders: false });
     }
   }
   ```

2. **Implement Status Updates**
   ```typescript
   updateOrderStatus: async (orderId, newStatus) => {
     try {
       await DatabaseService.updateOrderStatus(orderId, newStatus);
       // Update local state
       set(state => ({
         orders: state.orders.map(order =>
           order.id === orderId ? { ...order, status: newStatus } : order
         )
       }));
     } catch (error) {
       console.error('Failed to update order status:', error);
       throw error;
     }
   }
   ```

### Real-time Features (Priority 3)
1. **Order Creation Flow**
   ```typescript
   // In POS Screen after payment
   const createOrder = async () => {
     const order = await DatabaseService.createOrder({
       items: cart,
       customer: { name: customerName, email: customerEmail },
       payment_method: selectedPaymentMethod,
       total: calculateCartTotal()
     });
     
     // Navigate to order confirmation
     navigation.navigate('OrderConfirmation', { orderId: order.id });
   };
   ```

2. **Real-time Updates**
   ```typescript
   // Enhanced WebSocket subscription
   useEffect(() => {
     const unsubscribe = subscribe('order_*', (event) => {
       switch (event.type) {
         case 'order_created':
           addOrder(event.data.order);
           break;
         case 'order_updated':
           updateOrder(event.data.order_id, event.data.changes);
           break;
         case 'order_status_changed':
           updateOrderStatus(event.data.order_id, event.data.new_status);
           break;
       }
     });
     return unsubscribe;
   }, []);
   ```

## 8. Testing Requirements

### Unit Tests
1. Order filtering by status
2. Search functionality
3. Status update validation
4. Time calculation (elapsed time)
5. Order sorting

### Integration Tests
1. Create order from POS → appears in Orders
2. Update status → WebSocket notification
3. Multiple devices see same updates
4. Order persistence across app restarts
5. Offline order queue

### User Acceptance Criteria
- [ ] Orders appear immediately after creation
- [ ] Status updates reflect across all devices
- [ ] Search finds orders by number or customer
- [ ] Filters work correctly
- [ ] Real-time updates without refresh
- [ ] Order history accessible
- [ ] Print receipts (if printer connected)

## 9. Platform Owner Portal Integration

### Order Analytics Dashboard
1. **Real-time Metrics**
   - Orders per minute/hour
   - Average order value by time
   - Status distribution pie chart
   - Restaurant comparison

2. **Performance Metrics**
   - Average preparation time
   - Peak hour analysis
   - Bottleneck identification
   - Staff efficiency scores

3. **Financial Tracking**
   - Revenue by order type
   - Payment method distribution
   - Service charge collection
   - Refund/cancellation impact

### Monitoring & Alerts
```typescript
// Platform monitoring events
interface PlatformOrderEvents {
  high_wait_time: {
    order_id: string;
    wait_time_minutes: number;
    restaurant_id: string;
  };
  
  unusual_cancellation_rate: {
    restaurant_id: string;
    rate: number;
    time_window: string;
  };
  
  system_performance: {
    avg_response_time: number;
    active_orders: number;
    error_rate: number;
  };
}
```

### Required Platform Queries
```sql
-- Real-time order distribution
SELECT 
  r.name as restaurant_name,
  o.status,
  COUNT(*) as order_count,
  AVG(o.total_amount) as avg_order_value
FROM orders o
JOIN restaurants r ON o.restaurant_id = r.id
WHERE o.created_at > NOW() - INTERVAL '1 hour'
GROUP BY r.name, o.status;

-- Performance by hour
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as orders,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_minutes
FROM orders
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

## Next Steps

1. **Today**: Implement order creation flow from POS
2. **Tomorrow**: Connect WebSocket for real-time updates
3. **This Week**: Add order lifecycle tracking
4. **Next Week**: Kitchen display system
5. **Platform**: Real-time analytics dashboard

## Related Documentation
- See `01_POS_SCREEN_ANALYSIS.md` for order creation flow
- See `12_PLATFORM_CONNECTIONS.md` for WebSocket architecture
- See `13_BACKEND_REQUIREMENTS.md` for full API specification