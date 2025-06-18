# 🔧 Backend Integration Technical Guide

**Purpose**: Technical reference for backend developers to ensure seamless integration with the completed Fynlo POS frontend.

---

## 🏛️ Backend Architecture Requirements

### Database Schema (PostgreSQL)

```sql
-- Users & Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('platform_owner', 'restaurant_owner', 'manager', 'employee')),
    restaurant_id UUID REFERENCES restaurants(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restaurants
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    tax_configuration JSONB DEFAULT '{"vatEnabled": true, "vatRate": 20, "serviceTaxEnabled": true, "serviceTaxRate": 12.5}',
    payment_methods JSONB DEFAULT '{"cash": {"enabled": true}, "card": {"enabled": true}, "applePay": {"enabled": true}}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products/Menu Items
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    modifiers JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id),
    order_number VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    employee_id UUID REFERENCES users(id),
    table_number VARCHAR(20),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    service_charge DECIMAL(10,2) DEFAULT 0,
    tip_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    modifiers JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    amount DECIMAL(10,2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    transaction_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    qr_code_data TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) UNIQUE,
    current_stock DECIMAL(10,2) NOT NULL,
    minimum_stock DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    last_restocked TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee Time Tracking
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES users(id),
    clock_in TIMESTAMP NOT NULL,
    clock_out TIMESTAMP,
    break_minutes INTEGER DEFAULT 0,
    total_hours DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔌 API Implementation Guide

### Authentication Endpoints

```javascript
// POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
// Response
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "manager",
      "restaurantId": "uuid"
    },
    "tokens": {
      "access": "jwt_access_token",
      "refresh": "jwt_refresh_token"
    }
  }
}
```

### Order Management

```javascript
// POST /api/orders
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "modifiers": [],
      "notes": ""
    }
  ],
  "tableNumber": "5",
  "customerId": "uuid" // optional
}

// WebSocket Event for Kitchen
{
  "event": "new_order",
  "data": {
    "orderId": "uuid",
    "orderNumber": "1001",
    "items": [...],
    "priority": "normal",
    "timestamp": "2025-06-17T10:30:00Z"
  }
}
```

### Payment Processing

```javascript
// POST /api/payments/process
{
  "orderId": "uuid",
  "amount": 54.50,
  "method": "card",
  "paymentMethodId": "pm_stripe_id" // for Stripe
}

// QR Code Payment
// POST /api/payments/qr/generate
{
  "orderId": "uuid",
  "amount": 54.50
}
// Response
{
  "success": true,
  "data": {
    "qrCodeId": "uuid",
    "qrCodeData": "FYNLO-PAY:base64_encoded_data",
    "expiresAt": "2025-06-17T10:35:00Z"
  }
}
```

---

## 🔄 Real-time Integration

### WebSocket Events

```javascript
// Server Setup (Node.js example)
const io = require('socket.io')(server, {
  cors: {
    origin: ["http://localhost:8081", "capacitor://localhost"],
    methods: ["GET", "POST"]
  }
});

// Authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // Verify JWT token
  next();
});

// Event handlers
io.on('connection', (socket) => {
  // Join restaurant room
  socket.on('join_restaurant', (restaurantId) => {
    socket.join(`restaurant:${restaurantId}`);
  });

  // Order updates
  socket.on('order_status_update', (data) => {
    io.to(`restaurant:${data.restaurantId}`).emit('order_updated', data);
  });

  // Payment confirmations
  socket.on('payment_confirmed', (data) => {
    io.to(`restaurant:${data.restaurantId}`).emit('payment_received', data);
  });
});
```

---

## 🎯 Critical Integration Points

### 1. **Mock Data Replacement**

Current mock data locations to replace with API calls:

```typescript
// src/screens/main/ReportsScreen.tsx (lines 32-54)
const mockData = {
  today: {
    sales: 1247.50,
    orders: 23,
    // ... replace with API call
  }
};
// Replace with:
const { data } = await api.get('/reports/sales?period=today');
```

### 2. **State Management Integration**

```typescript
// src/store/useAppStore.ts
// Current mock implementation
addToCart: (product) => {
  // ... mock logic
}

// Backend integration
addToCart: async (product) => {
  const response = await api.post('/cart/add', { productId: product.id });
  set({ cart: response.data.cart });
}
```

### 3. **Error Handling**

All API errors should be handled consistently:

```typescript
// Frontend expects this error format
try {
  const response = await api.post('/orders', orderData);
} catch (error) {
  if (error.response?.data?.error) {
    Alert.alert(
      error.response.data.error.code,
      error.response.data.error.message
    );
  }
}
```

---

## 📦 Environment Configuration

### Frontend .env Setup
```bash
# API Configuration
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_WS_URL=ws://localhost:3000

# Stripe Configuration
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Feature Flags
REACT_APP_ENABLE_QR_PAYMENTS=true
REACT_APP_ENABLE_APPLE_PAY=true
```

### CORS Configuration
```javascript
// Backend CORS setup
app.use(cors({
  origin: [
    'http://localhost:8081',
    'capacitor://localhost',
    'http://localhost:19006', // Expo
  ],
  credentials: true
}));
```

---

## 🧪 Testing Integration

### API Contract Tests
```javascript
// Example contract test
describe('Order API', () => {
  it('should match frontend order structure', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send(mockOrderData);
    
    expect(response.body.data).toMatchObject({
      id: expect.any(String),
      orderNumber: expect.any(String),
      status: expect.stringMatching(/pending|preparing|ready|completed/),
      items: expect.arrayContaining([
        expect.objectContaining({
          productId: expect.any(String),
          quantity: expect.any(Number),
          unitPrice: expect.any(Number)
        })
      ])
    });
  });
});
```

---

## 📱 Mobile-Specific Considerations

1. **Offline Support**
   - Implement request queuing
   - Local data caching
   - Sync when online

2. **Performance**
   - Pagination for large datasets
   - Image optimization
   - Minimal payload sizes

3. **Security**
   - Certificate pinning
   - Secure token storage
   - API rate limiting

---

## 🚨 Common Integration Pitfalls

1. **Date/Time Formats**: Always use ISO 8601 format
2. **Decimal Precision**: Use exact decimal types for money
3. **ID Format**: Use UUIDs consistently
4. **Status Values**: Match exact frontend enums
5. **Empty States**: Return empty arrays, not null

---

**This guide is a living document. Update as integration progresses.**