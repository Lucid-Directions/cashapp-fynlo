# 🔧 Fynlo POS Backend Implementation Plan
**Complete Backend Architecture for Hardware-Free Restaurant Management Platform**

---

## 📋 **Executive Summary**

This document outlines the complete backend implementation required to support the Fynlo POS frontend - a revolutionary hardware-free restaurant management platform that exceeds traditional POS functionality. The backend must support innovative QR payment processing, comprehensive business intelligence, multi-tenant platform architecture, and real-time restaurant operations.

**Key Principles:**
- **Frontend-First**: Backend adapts to completed frontend implementation
- **Hardware-Free Primary**: QR payments and mobile-first approach
- **Hardware-Ready Secondary**: Support for future hardware integration
- **Performance-Optimized**: Enterprise-grade scalability and speed
- **Multi-Tenant**: Platform owner managing multiple restaurants

---

## 🏗️ **Core Architecture**

### **Technology Stack**
- **API Framework**: Node.js with Express.js (or Python with FastAPI)
- **Database**: PostgreSQL with Redis caching
- **Real-time**: WebSocket server for live updates
- **Payment Processing**: Stripe API + Open Banking QR payments
- **Authentication**: JWT with refresh tokens
- **Queue System**: Bull Queue for background processing
- **Monitoring**: Prometheus + Grafana for analytics
- **Deployment**: Docker containers with Kubernetes

### **Database Architecture**

```sql
-- Core Tables Matching Frontend Data Models

-- Multi-tenant platform structure
CREATE TABLE platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255) UNIQUE NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'basic',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restaurants (multi-tenant support)
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID REFERENCES platforms(id),
    name VARCHAR(255) NOT NULL,
    address JSONB NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'UTC',
    business_hours JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    tax_configuration JSONB DEFAULT '{
        "vatEnabled": true,
        "vatRate": 20,
        "serviceTaxEnabled": true,
        "serviceTaxRate": 12.5
    }',
    payment_methods JSONB DEFAULT '{
        "qrCode": {"enabled": true, "feePercentage": 1.2},
        "cash": {"enabled": true, "requiresAuth": false},
        "card": {"enabled": true, "feePercentage": 2.9},
        "applePay": {"enabled": true, "feePercentage": 2.9},
        "giftCard": {"enabled": true, "requiresAuth": true}
    }',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users with role-based access
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('platform_owner', 'restaurant_owner', 'manager', 'employee')),
    restaurant_id UUID REFERENCES restaurants(id),
    platform_id UUID REFERENCES platforms(id),
    permissions JSONB DEFAULT '{}',
    pin_code VARCHAR(6), -- For employee time clock
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers with loyalty tracking
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id),
    email VARCHAR(255),
    phone VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    loyalty_points INTEGER DEFAULT 0,
    loyalty_tier VARCHAR(50) DEFAULT 'regular',
    total_spent DECIMAL(12,2) DEFAULT 0,
    visit_count INTEGER DEFAULT 0,
    last_visit TIMESTAMP,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products/Menu Items
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) DEFAULT 0,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    image_url TEXT,
    barcode VARCHAR(50),
    is_available BOOLEAN DEFAULT true,
    dietary_info JSONB DEFAULT '{}', -- vegetarian, vegan, gluten-free, etc.
    modifiers JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    preparation_time INTEGER DEFAULT 0, -- minutes
    kitchen_station VARCHAR(50), -- grill, cold, fryer, etc.
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id),
    order_number VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    employee_id UUID REFERENCES users(id),
    table_number VARCHAR(20),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
    order_type VARCHAR(50) DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    service_charge DECIMAL(10,2) DEFAULT 0,
    tip_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    notes TEXT,
    estimated_completion TIMESTAMP,
    completed_at TIMESTAMP,
    kitchen_notes TEXT,
    special_requests TEXT,
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
    total_price DECIMAL(10,2) NOT NULL,
    modifiers JSONB DEFAULT '[]',
    notes TEXT,
    kitchen_status VARCHAR(50) DEFAULT 'pending',
    preparation_time INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QR Payments (Primary Payment Method)
CREATE TABLE qr_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    qr_code_data TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
    expires_at TIMESTAMP NOT NULL,
    paid_at TIMESTAMP,
    customer_bank_reference VARCHAR(255),
    fee_amount DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Traditional Payments (Fallback)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    qr_payment_id UUID REFERENCES qr_payments(id), -- Link to QR payment if fallback
    amount DECIMAL(10,2) NOT NULL,
    method VARCHAR(50) NOT NULL CHECK (method IN ('cash', 'card', 'applePay', 'googlePay', 'giftCard')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    transaction_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    last_4_digits VARCHAR(4),
    card_brand VARCHAR(50),
    fee_amount DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(10,2) NOT NULL,
    is_refundable BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Management
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) UNIQUE,
    current_stock DECIMAL(10,3) NOT NULL,
    minimum_stock DECIMAL(10,3) NOT NULL,
    maximum_stock DECIMAL(10,3),
    unit VARCHAR(50) NOT NULL,
    cost_per_unit DECIMAL(10,2) NOT NULL,
    supplier_name VARCHAR(255),
    supplier_contact JSONB DEFAULT '{}',
    last_restocked TIMESTAMP,
    reorder_point DECIMAL(10,3),
    auto_reorder BOOLEAN DEFAULT false,
    turnover_rate VARCHAR(50) DEFAULT 'medium',
    waste_tracking JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee Time Tracking
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES users(id),
    restaurant_id UUID REFERENCES restaurants(id),
    clock_in TIMESTAMP NOT NULL,
    clock_out TIMESTAMP,
    break_start TIMESTAMP,
    break_end TIMESTAMP,
    break_minutes INTEGER DEFAULT 0,
    total_hours DECIMAL(5,2),
    hourly_rate DECIMAL(8,2),
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    gross_pay DECIMAL(10,2),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'break', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Business Analytics (Pre-computed for performance)
CREATE TABLE analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id),
    date DATE NOT NULL,
    total_sales DECIMAL(12,2) NOT NULL,
    total_orders INTEGER NOT NULL,
    total_customers INTEGER NOT NULL,
    avg_order_value DECIMAL(10,2) NOT NULL,
    payment_method_breakdown JSONB NOT NULL,
    hourly_breakdown JSONB NOT NULL,
    top_products JSONB NOT NULL,
    employee_performance JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, date)
);

-- Settings Management
CREATE TABLE restaurant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id) UNIQUE,
    pos_settings JSONB DEFAULT '{}',
    kitchen_settings JSONB DEFAULT '{}',
    receipt_settings JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{}',
    hardware_settings JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hardware Integration (Future-Ready)
CREATE TABLE hardware_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id),
    device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('printer', 'cash_drawer', 'scanner', 'card_reader', 'display')),
    device_name VARCHAR(255) NOT NULL,
    connection_type VARCHAR(50) CHECK (connection_type IN ('bluetooth', 'wifi', 'usb', 'ethernet')),
    device_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error')),
    configuration JSONB DEFAULT '{}',
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WebSocket Connections Tracking
CREATE TABLE websocket_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    restaurant_id UUID REFERENCES restaurants(id),
    connection_id VARCHAR(255) UNIQUE NOT NULL,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

---

## 🔌 **API Endpoints Implementation**

### **Phase 1: Authentication & Core APIs**

#### **Authentication Service**
```javascript
// POST /api/auth/login
{
  "email": "user@restaurant.com",
  "password": "password123"
}
// Response
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@restaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "manager",
      "restaurantId": "uuid",
      "permissions": ["pos", "reports", "inventory"]
    },
    "tokens": {
      "access": "jwt_access_token",
      "refresh": "jwt_refresh_token"
    },
    "restaurant": {
      "id": "uuid",
      "name": "Restaurant Name",
      "settings": {...}
    }
  }
}

// POST /api/auth/refresh
// GET /api/auth/logout
// POST /api/auth/forgot-password
// POST /api/auth/reset-password
```

#### **User Management**
```javascript
// GET /api/users
// GET /api/users/:id
// POST /api/users (create employee)
// PUT /api/users/:id
// DELETE /api/users/:id (deactivate)
// POST /api/users/:id/clock-in
// POST /api/users/:id/clock-out
// GET /api/users/:id/timesheet
```

#### **Restaurant Management**
```javascript
// GET /api/restaurants (platform owner only)
// GET /api/restaurants/:id
// POST /api/restaurants (platform owner only)
// PUT /api/restaurants/:id
// GET /api/restaurants/:id/settings
// PUT /api/restaurants/:id/settings
```

### **Phase 2: Core POS Functionality**

#### **Product Management**
```javascript
// GET /api/products
// GET /api/products/:id
// POST /api/products
// PUT /api/products/:id
// DELETE /api/products/:id
// PATCH /api/products/:id/availability
// GET /api/categories
// POST /api/categories
// PUT /api/categories/:id
```

#### **Order Management**
```javascript
// GET /api/orders
{
  "query": {
    "status": "pending",
    "date": "2025-06-17",
    "customerId": "uuid",
    "limit": 50,
    "offset": 0
  }
}

// POST /api/orders
{
  "customerId": "uuid", // optional
  "tableNumber": "5",
  "orderType": "dine_in",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": 12.50,
      "modifiers": [
        {"type": "size", "value": "large", "price": 2.00}
      ],
      "notes": "Extra hot"
    }
  ],
  "notes": "Customer allergic to nuts"
}

// PATCH /api/orders/:id/status
{
  "status": "preparing",
  "estimatedCompletion": "2025-06-17T12:30:00Z"
}

// POST /api/orders/:id/items
// DELETE /api/orders/:id/items/:itemId
// GET /api/orders/:id/receipt
```

### **Phase 3: QR Payment System (Primary)**

#### **QR Payment Processing**
```javascript
// POST /api/payments/qr/generate
{
  "orderId": "uuid",
  "amount": 54.50,
  "currency": "GBP"
}
// Response
{
  "success": true,
  "data": {
    "qrPaymentId": "uuid",
    "qrCodeData": "FYNLO-PAY:base64_encoded_payment_data",
    "amount": 54.50,
    "feeAmount": 0.65, // 1.2% fee
    "netAmount": 53.85,
    "expiresAt": "2025-06-17T12:35:00Z",
    "instructions": [
      "Open your banking app",
      "Scan this QR code",
      "Confirm the payment"
    ]
  }
}

// GET /api/payments/qr/:id/status
{
  "success": true,
  "data": {
    "status": "completed",
    "paidAt": "2025-06-17T12:32:15Z",
    "bankReference": "TXN123456789",
    "amount": 54.50
  }
}

// POST /api/payments/qr/:id/cancel
// POST /api/payments/qr/:id/extend (extend expiry)
```

#### **Traditional Payment Processing (Fallback)**
```javascript
// POST /api/payments/stripe/process
{
  "orderId": "uuid",
  "amount": 54.50,
  "paymentMethodId": "pm_stripe_card_id",
  "confirmPayment": true
}

// POST /api/payments/applepay/process
{
  "orderId": "uuid",
  "amount": 54.50,
  "paymentData": "apple_pay_token"
}

// POST /api/payments/cash/process
{
  "orderId": "uuid",
  "amount": 54.50,
  "cashReceived": 60.00,
  "change": 5.50
}

// POST /api/payments/:id/refund
// GET /api/payments/methods
```

### **Phase 4: Analytics & Reporting**

#### **Real-time Analytics**
```javascript
// GET /api/analytics/dashboard
{
  "success": true,
  "data": {
    "today": {
      "sales": 1247.50,
      "orders": 23,
      "customers": 18,
      "avgOrderValue": 54.24,
      "growth": {
        "sales": 12.5,
        "orders": 8.2,
        "customers": 15.3
      }
    },
    "realTime": {
      "ordersInProgress": 5,
      "kitchenQueue": 3,
      "currentHourSales": 156.75
    }
  }
}

// GET /api/analytics/sales
{
  "query": {
    "period": "week", // today, week, month, quarter, year
    "startDate": "2025-06-10",
    "endDate": "2025-06-17",
    "groupBy": "day" // hour, day, week, month
  }
}

// GET /api/analytics/products
// GET /api/analytics/employees
// GET /api/analytics/customers
// GET /api/analytics/financial
```

#### **Report Generation**
```javascript
// POST /api/reports/generate
{
  "type": "sales", // sales, financial, inventory, employees
  "format": "pdf", // pdf, csv, excel
  "period": "month",
  "filters": {...},
  "email": "manager@restaurant.com" // optional
}

// GET /api/reports/:id/download
// GET /api/reports/templates
```

### **Phase 5: Kitchen & Operations**

#### **Kitchen Display System**
```javascript
// GET /api/kitchen/orders
{
  "success": true,
  "data": {
    "activeOrders": [
      {
        "orderId": "uuid",
        "orderNumber": "1001",
        "items": [...],
        "estimatedTime": 15,
        "priority": "high",
        "station": "grill"
      }
    ],
    "completedToday": 45,
    "averageTime": 12.5
  }
}

// PATCH /api/kitchen/orders/:id/items/:itemId/status
{
  "status": "completed",
  "actualTime": 8
}

// GET /api/kitchen/stations
// POST /api/kitchen/stations/:id/status
```

#### **Inventory Management**
```javascript
// GET /api/inventory
// PUT /api/inventory/:productId
{
  "currentStock": 25,
  "lastRestocked": "2025-06-17T09:00:00Z",
  "supplier": "Coffee Supplier Co"
}

// POST /api/inventory/reorder
// GET /api/inventory/alerts
// POST /api/inventory/waste
```

---

## 🔄 **Real-time WebSocket Implementation**

### **WebSocket Events**

```javascript
// Connection setup
const io = require('socket.io')(server, {
  cors: {
    origin: ["http://localhost:8081", "capacitor://localhost"],
    methods: ["GET", "POST"]
  }
});

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    socket.userId = user.id;
    socket.restaurantId = user.restaurantId;
    socket.role = user.role;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Event handlers
io.on('connection', (socket) => {
  // Join restaurant room
  socket.join(`restaurant:${socket.restaurantId}`);
  
  // Join role-specific rooms
  socket.join(`${socket.restaurantId}:${socket.role}`);
  
  // Order events
  socket.on('order_created', (orderData) => {
    io.to(`restaurant:${socket.restaurantId}`).emit('new_order', orderData);
    io.to(`${socket.restaurantId}:kitchen`).emit('kitchen_order', orderData);
  });
  
  socket.on('order_status_update', (data) => {
    io.to(`restaurant:${socket.restaurantId}`).emit('order_updated', data);
  });
  
  // Payment events
  socket.on('qr_payment_generated', (paymentData) => {
    socket.emit('qr_payment_ready', paymentData);
  });
  
  socket.on('payment_completed', (data) => {
    io.to(`restaurant:${socket.restaurantId}`).emit('payment_received', data);
  });
  
  // Kitchen events
  socket.on('item_ready', (data) => {
    io.to(`restaurant:${socket.restaurantId}`).emit('order_item_ready', data);
  });
  
  // Inventory alerts
  socket.on('low_stock_alert', (data) => {
    io.to(`${socket.restaurantId}:manager`).emit('inventory_alert', data);
  });
  
  // System notifications
  socket.on('system_notification', (data) => {
    io.to(`restaurant:${socket.restaurantId}`).emit('notification', data);
  });
  
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
  });
});
```

---

## 💳 **Payment Integration Implementation**

### **QR Payment Service (Primary Method)**

```javascript
class QRPaymentService {
  async generateQRPayment(orderId, amount, currency = 'GBP') {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');
    
    // Generate unique payment reference
    const paymentRef = `FYNLO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create QR payment record
    const qrPayment = await QRPayment.create({
      orderId,
      amount,
      currency,
      status: 'pending',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      qrCodeData: this.generateQRData(paymentRef, amount, order.restaurant.bankingDetails)
    });
    
    // Start expiry timer
    this.scheduleExpiry(qrPayment.id);
    
    return {
      qrPaymentId: qrPayment.id,
      qrCodeData: qrPayment.qrCodeData,
      amount: amount,
      feeAmount: amount * 0.012, // 1.2% fee
      netAmount: amount * 0.988,
      expiresAt: qrPayment.expiresAt
    };
  }
  
  generateQRData(paymentRef, amount, bankingDetails) {
    const paymentData = {
      type: 'FYNLO_PAY',
      reference: paymentRef,
      amount: amount,
      currency: 'GBP',
      merchant: bankingDetails.merchantId,
      timestamp: Date.now()
    };
    
    return `FYNLO-PAY:${Buffer.from(JSON.stringify(paymentData)).toString('base64')}`;
  }
  
  async checkPaymentStatus(qrPaymentId) {
    const qrPayment = await QRPayment.findById(qrPaymentId);
    
    // Check with banking API for payment confirmation
    const bankingStatus = await this.checkBankingAPI(qrPayment.qrCodeData);
    
    if (bankingStatus.status === 'completed') {
      await this.confirmPayment(qrPaymentId, bankingStatus);
    }
    
    return qrPayment;
  }
  
  async confirmPayment(qrPaymentId, bankingData) {
    const qrPayment = await QRPayment.findByIdAndUpdate(qrPaymentId, {
      status: 'completed',
      paidAt: new Date(),
      customerBankReference: bankingData.reference
    });
    
    // Update order status
    await Order.findByIdAndUpdate(qrPayment.orderId, {
      status: 'paid'
    });
    
    // Emit real-time event
    io.to(`restaurant:${qrPayment.restaurantId}`).emit('payment_completed', {
      orderId: qrPayment.orderId,
      amount: qrPayment.amount,
      method: 'qr_payment'
    });
    
    // Trigger kitchen notification
    this.notifyKitchen(qrPayment.orderId);
  }
}
```

### **Stripe Integration (Fallback Method)**

```javascript
class StripePaymentService {
  async processCardPayment(orderId, amount, paymentMethodId) {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'gbp',
        payment_method: paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        metadata: {
          orderId: orderId,
          restaurantId: order.restaurantId
        }
      });
      
      // Save payment record
      const payment = await Payment.create({
        orderId,
        amount,
        method: 'card',
        status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
        stripePaymentIntentId: paymentIntent.id,
        transactionId: paymentIntent.id,
        feeAmount: amount * 0.029 + 0.30, // 2.9% + 30p
        netAmount: amount - (amount * 0.029 + 0.30)
      });
      
      if (paymentIntent.status === 'succeeded') {
        await this.completeOrder(orderId);
      }
      
      return payment;
      
    } catch (error) {
      throw new Error(`Payment failed: ${error.message}`);
    }
  }
  
  async processApplePayPayment(orderId, amount, paymentData) {
    // Similar implementation for Apple Pay
    // Use Stripe's Apple Pay integration
  }
}
```

---

## 📊 **Analytics Engine Implementation**

### **Real-time Analytics Service**

```javascript
class AnalyticsService {
  async generateDashboardData(restaurantId, period = 'today') {
    const dateRange = this.getDateRange(period);
    
    // Parallel queries for performance
    const [salesData, ordersData, customersData, realtimeData] = await Promise.all([
      this.getSalesAnalytics(restaurantId, dateRange),
      this.getOrdersAnalytics(restaurantId, dateRange),
      this.getCustomersAnalytics(restaurantId, dateRange),
      this.getRealtimeData(restaurantId)
    ]);
    
    return {
      period: period,
      sales: salesData,
      orders: ordersData,
      customers: customersData,
      realtime: realtimeData,
      growth: this.calculateGrowth(salesData, period),
      charts: this.generateChartData(salesData, ordersData, period)
    };
  }
  
  async getSalesAnalytics(restaurantId, dateRange) {
    const sales = await this.db.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(total_amount) as total_sales,
        COUNT(*) as order_count,
        AVG(total_amount) as avg_order_value,
        EXTRACT(HOUR FROM created_at) as hour
      FROM orders 
      WHERE restaurant_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND status = 'completed'
      GROUP BY DATE(created_at), EXTRACT(HOUR FROM created_at)
      ORDER BY date, hour
    `, [restaurantId, dateRange.start, dateRange.end]);
    
    return this.processAnalyticsData(sales);
  }
  
  async generateHourlyBreakdown(restaurantId, date) {
    const hourlyData = await this.db.query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        SUM(total_amount) as sales,
        COUNT(*) as orders,
        COUNT(DISTINCT customer_id) as customers
      FROM orders 
      WHERE restaurant_id = $1 
        AND DATE(created_at) = $2
        AND status = 'completed'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [restaurantId, date]);
    
    // Fill missing hours with zeros
    const completeHourlyData = Array.from({length: 24}, (_, hour) => {
      const found = hourlyData.find(d => d.hour === hour);
      return found || {hour, sales: 0, orders: 0, customers: 0};
    });
    
    return completeHourlyData;
  }
  
  async getTopProducts(restaurantId, period, limit = 10) {
    const dateRange = this.getDateRange(period);
    
    return await this.db.query(`
      SELECT 
        p.name,
        p.id,
        SUM(oi.quantity) as total_sold,
        SUM(oi.total_price) as total_revenue,
        AVG(oi.unit_price) as avg_price,
        COUNT(DISTINCT o.id) as order_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.restaurant_id = $1
        AND o.created_at >= $2
        AND o.created_at <= $3
        AND o.status = 'completed'
      GROUP BY p.id, p.name
      ORDER BY total_revenue DESC
      LIMIT $4
    `, [restaurantId, dateRange.start, dateRange.end, limit]);
  }
  
  async getEmployeePerformance(restaurantId, period) {
    const dateRange = this.getDateRange(period);
    
    return await this.db.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        COUNT(DISTINCT o.id) as orders_served,
        SUM(o.total_amount) as total_sales,
        AVG(o.total_amount) as avg_order_value,
        SUM(te.total_hours) as hours_worked,
        SUM(o.total_amount) / NULLIF(SUM(te.total_hours), 0) as sales_per_hour
      FROM users u
      LEFT JOIN orders o ON u.id = o.employee_id
      LEFT JOIN time_entries te ON u.id = te.employee_id
      WHERE u.restaurant_id = $1
        AND u.role = 'employee'
        AND o.created_at >= $2
        AND o.created_at <= $3
        AND o.status = 'completed'
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY total_sales DESC
    `, [restaurantId, dateRange.start, dateRange.end]);
  }
}
```

---

## 🔧 **Implementation Tasks**

### **Phase 1: Foundation & Authentication**
- [ ] Set up Node.js/Express server with TypeScript
- [ ] Configure PostgreSQL database with connection pooling
- [ ] Set up Redis for caching and sessions
- [ ] Implement JWT authentication system
- [ ] Create user management API endpoints
- [ ] Set up role-based access control middleware
- [ ] Implement password hashing and security
- [ ] Create database migration system
- [ ] Set up logging and monitoring
- [ ] Configure CORS for mobile app

### **Phase 2: Core POS Functionality**
- [ ] Implement restaurant management APIs
- [ ] Create product and category management
- [ ] Build order management system
- [ ] Implement real-time order status updates
- [ ] Create customer management APIs
- [ ] Set up inventory tracking system
- [ ] Implement basic reporting endpoints
- [ ] Create audit logging system
- [ ] Set up data validation and sanitization
- [ ] Implement error handling and responses

### **Phase 3: QR Payment System (Priority)**
- [ ] Design QR payment data structure
- [ ] Implement QR code generation service
- [ ] Create payment status tracking system
- [ ] Set up payment expiry handling
- [ ] Implement banking API integration (Open Banking)
- [ ] Create payment confirmation webhooks
- [ ] Set up real-time payment notifications
- [ ] Implement payment analytics
- [ ] Create refund processing system
- [ ] Add payment method fee calculations

### **Phase 4: Traditional Payment Integration**
- [ ] Set up Stripe API integration
- [ ] Implement card payment processing
- [ ] Add Apple Pay integration
- [ ] Create cash payment handling
- [ ] Implement gift card system
- [ ] Set up payment method validation
- [ ] Create split payment functionality
- [ ] Add tip processing logic
- [ ] Implement payment reconciliation
- [ ] Set up fraud detection basics

### **Phase 5: Advanced Analytics**
- [ ] Create analytics data aggregation system
- [ ] Implement real-time dashboard APIs
- [ ] Build sales reporting engine
- [ ] Create employee performance analytics
- [ ] Implement customer analytics system
- [ ] Set up inventory analytics
- [ ] Create financial reporting system
- [ ] Implement trend analysis
- [ ] Add predictive analytics basics
- [ ] Create export functionality

### **Phase 6: Kitchen & Operations**
- [ ] Implement kitchen display system APIs
- [ ] Create order routing to kitchen stations
- [ ] Set up preparation time tracking
- [ ] Implement kitchen performance metrics
- [ ] Create table management system
- [ ] Set up staff scheduling system
- [ ] Implement time clock functionality
- [ ] Create break and overtime tracking
- [ ] Set up shift management
- [ ] Implement payroll calculation basics

### **Phase 7: Real-time Features**
- [ ] Set up WebSocket server infrastructure
- [ ] Implement real-time order updates
- [ ] Create live kitchen display updates
- [ ] Set up payment notification system
- [ ] Implement inventory alerts
- [ ] Create system status monitoring
- [ ] Set up notification management
- [ ] Implement connection management
- [ ] Add WebSocket authentication
- [ ] Create event broadcasting system

### **Phase 8: Hardware Integration (Future-Ready)**
- [ ] Design hardware abstraction layer
- [ ] Create printer integration APIs
- [ ] Implement cash drawer control
- [ ] Set up barcode scanner integration
- [ ] Create card reader abstraction
- [ ] Implement receipt printer management
- [ ] Set up kitchen display hardware
- [ ] Create hardware status monitoring
- [ ] Implement device configuration management
- [ ] Add hardware diagnostics

### **Phase 9: Advanced Features**
- [ ] Implement multi-location management
- [ ] Create platform owner dashboard
- [ ] Set up subscription management
- [ ] Implement advanced security features
- [ ] Create data backup and restore
- [ ] Set up automated reporting
- [ ] Implement customer loyalty system
- [ ] Create marketing integration
- [ ] Set up third-party integrations
- [ ] Implement advanced analytics

### **Phase 10: Production & Optimization**
- [ ] Set up production database optimization
- [ ] Implement comprehensive caching strategy
- [ ] Create performance monitoring
- [ ] Set up automated testing suite
- [ ] Implement security auditing
- [ ] Create backup and disaster recovery
- [ ] Set up monitoring and alerting
- [ ] Implement load balancing
- [ ] Create deployment automation
- [ ] Set up production logging

---

## 🚀 **Performance Requirements**

### **Response Time Targets**
- Authentication: < 200ms
- Order creation: < 500ms
- Payment processing: < 1.5s
- QR generation: < 300ms
- Reports generation: < 2s
- Real-time updates: < 50ms
- Database queries: < 100ms

### **Scalability Targets**
- Concurrent users per restaurant: 50+
- Orders per hour: 500+
- WebSocket connections: 1000+
- Database transactions: 10,000+ per hour
- API requests: 100,000+ per day

### **Reliability Targets**
- Uptime: 99.9%
- Payment success rate: 99.5%
- Data consistency: 100%
- Backup frequency: Every 4 hours
- Recovery time: < 15 minutes

---

## 🔐 **Security Implementation**

### **Authentication Security**
- [ ] JWT with short expiry and refresh tokens
- [ ] Password hashing with bcrypt (12 rounds)
- [ ] Rate limiting on auth endpoints
- [ ] Account lockout after failed attempts
- [ ] Two-factor authentication option
- [ ] Session management and revocation
- [ ] IP-based access control
- [ ] Audit logging for all auth events

### **API Security**
- [ ] Input validation and sanitization
- [ ] SQL injection prevention
- [ ] XSS protection headers
- [ ] CORS configuration
- [ ] Request size limiting
- [ ] API rate limiting per user/IP
- [ ] Request/response encryption
- [ ] API key management for integrations

### **Payment Security**
- [ ] PCI DSS compliance for card data
- [ ] Payment data encryption at rest
- [ ] Secure payment data transmission
- [ ] Webhook signature verification
- [ ] Payment audit logging
- [ ] Fraud detection rules
- [ ] Secure QR code generation
- [ ] Payment data retention policies

### **Data Security**
- [ ] Database encryption at rest
- [ ] Sensitive data field encryption
- [ ] Personal data anonymization
- [ ] GDPR compliance features
- [ ] Data retention policies
- [ ] Secure data export/import
- [ ] Database access controls
- [ ] Regular security audits

---

## 📊 **Monitoring & Analytics**

### **System Monitoring**
- [ ] Application performance monitoring (APM)
- [ ] Database performance monitoring
- [ ] WebSocket connection monitoring
- [ ] Payment system monitoring
- [ ] Error rate tracking
- [ ] Response time monitoring
- [ ] Resource utilization tracking
- [ ] Security event monitoring

### **Business Analytics**
- [ ] Real-time sales dashboards
- [ ] Revenue tracking and forecasting
- [ ] Customer behavior analytics
- [ ] Employee performance metrics
- [ ] Inventory optimization analytics
- [ ] Payment method analytics
- [ ] Operational efficiency metrics
- [ ] Comparative restaurant analytics

---

## 🔄 **Integration Points**

### **Frontend Integration**
- [ ] Replace mock data with API calls
- [ ] Implement WebSocket connections
- [ ] Add error handling for API failures
- [ ] Implement offline data caching
- [ ] Add loading states for API calls
- [ ] Implement data synchronization
- [ ] Add retry logic for failed requests
- [ ] Create API response validation

### **Third-party Integrations**
- [ ] Stripe payment processing
- [ ] Open Banking API integration
- [ ] Apple Pay integration
- [ ] Accounting software APIs
- [ ] Email service integration
- [ ] SMS notification service
- [ ] Analytics platforms
- [ ] Backup storage services

---

This comprehensive backend implementation plan provides the foundation for a production-ready, scalable restaurant management platform that matches and exceeds the innovative frontend capabilities. The system is designed to be hardware-free first while maintaining compatibility for future hardware integration.