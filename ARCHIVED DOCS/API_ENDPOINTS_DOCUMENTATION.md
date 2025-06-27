# 🚀 **Fynlo POS Backend API Documentation**

**Updated**: June 20, 2025  
**Version**: 1.0  
**Base URL**: `http://localhost:8000/api/v1`

---

## 📋 **API Overview**

The Fynlo POS Backend provides a comprehensive REST API for point-of-sale operations, restaurant management, and mobile app integration. All endpoints return standardized JSON responses optimized for frontend consumption.

### **Standard Response Format**

All endpoints return responses in this standardized format:

```json
{
  "success": boolean,
  "data": any,
  "message": string,
  "error": string | null,
  "meta": object | null,
  "timestamp": string
}
```

---

## 🔐 **Authentication Endpoints**

### **POST /auth/login**
User authentication and session management.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "string",
    "refresh_token": "string",
    "user": { "id": "string", "email": "string", "role": "string" },
    "restaurant": { "id": "string", "name": "string" }
  },
  "message": "Login successful"
}
```

### **POST /auth/logout**
End user session.

### **POST /auth/refresh**
Refresh authentication token.

---

## 📱 **POS Session Management**

### **GET /pos/sessions/current**
Get the current active POS session for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "POS Session 1",
    "state": "opened",
    "start_at": "2025-06-20T10:00:00Z",
    "stop_at": null,
    "config_id": 1,
    "config_name": "POS Config 1",
    "user_id": 123,
    "user_name": "John Doe"
  }
}
```

### **POST /pos/sessions**
Create a new POS session.

**Request Body:**
```json
{
  "config_id": 1,
  "name": "Optional session name"
}
```

### **PUT /pos/sessions/{session_id}/state**
Update POS session state.

**Request Body:**
```json
{
  "state": "opened" // 'opening_control' | 'opened' | 'closing_control' | 'closed'
}
```

### **GET /pos/sessions**
Get POS sessions for the current user.

**Query Parameters:**
- `limit` (optional): Number of sessions to return (default: 10)

---

## 🍽️ **Products & Menu Management**

### **GET /products/mobile**
Mobile-optimized products list for POS applications.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123456789,
      "name": "Classic Burger",
      "price": 12.99,
      "category": "Burgers",
      "image": "https://example.com/burger.jpg",
      "barcode": "1234567890",
      "available_in_pos": true,
      "active": true
    }
  ]
}
```

### **GET /products/category/{category_id}**
Get products filtered by category ID.

**Path Parameters:**
- `category_id`: Integer category ID

### **GET /categories**
Get all product categories.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Burgers",
      "description": "Delicious burgers",
      "color": "#00A651",
      "icon": "burger-icon",
      "sort_order": 1,
      "is_active": true,
      "created_at": "2025-06-20T10:00:00Z"
    }
  ]
}
```

### **GET /products**
Get all products with full details.

**Query Parameters:**
- `restaurant_id` (optional): Filter by restaurant
- `category_id` (optional): Filter by category
- `active_only` (optional): Show only active products (default: true)

### **GET /products/menu**
Get complete menu with categories and products.

---

## 🏪 **Restaurant Management**

### **GET /restaurant/floor-plan**
Get restaurant floor plan with tables and sections.

**Query Parameters:**
- `section_id` (optional): Filter by section ID

**Response:**
```json
{
  "success": true,
  "data": {
    "sections": [
      {
        "id": 1,
        "name": "Main Dining",
        "restaurant_id": "uuid",
        "color": "#00A651",
        "is_active": true
      }
    ],
    "tables": [
      {
        "id": 1,
        "name": "Table 1",
        "section_id": 1,
        "section_name": "Main Dining",
        "seats": 4,
        "status": "available",
        "server_id": null,
        "server_name": null,
        "x_position": 100,
        "y_position": 100
      }
    ]
  }
}
```

### **GET /restaurant/sections**
Get all restaurant sections.

### **PUT /restaurant/tables/{table_id}/status**
Update table status.

**Request Body:**
```json
{
  "status": "occupied" // 'available' | 'occupied' | 'reserved' | 'cleaning'
}
```

### **PUT /restaurant/tables/{table_id}/server**
Assign server to table.

**Request Body:**
```json
{
  "server_id": 123,
  "server_name": "John Doe"
}
```

---

## 🛒 **Order Management**

### **POST /orders**
Create a new order.

**Request Body:**
```json
{
  "session_id": 1,
  "partner_id": 123,
  "partner_name": "Customer Name",
  "lines": [
    {
      "product_id": 456,
      "product_name": "Classic Burger",
      "qty": 2,
      "price_unit": 12.99,
      "price_subtotal": 25.98
    }
  ]
}
```

### **PUT /orders/{order_id}**
Update an existing order.

### **GET /orders/recent**
Get recent orders.

**Query Parameters:**
- `limit`: Number of orders to return

---

## 💳 **Payment Processing**

### **POST /payments**
Process a payment.

**Request Body:**
```json
{
  "order_id": 123,
  "payment_method": "card",
  "amount": 25.98
}
```

---

## 📊 **Reports & Analytics**

### **GET /reports/daily-sales**
Get daily sales report.

**Query Parameters:**
- `date`: Date in YYYY-MM-DD format

### **GET /reports/sales-summary**
Get sales summary for date range.

**Query Parameters:**
- `date_from`: Start date
- `date_to`: End date

---

## 🔄 **Real-time Features**

### **WebSocket Endpoints**
- `/websocket/pos` - POS real-time updates
- `/websocket/kitchen` - Kitchen display updates
- `/websocket/management` - Management dashboard updates

---

## 📱 **Mobile-Specific Features**

### **Response Optimization**
- **Integer IDs**: UUIDs converted to integers for mobile compatibility
- **Field Mapping**: Backend fields mapped to frontend expectations
- **Caching**: Redis caching for improved performance
- **Pagination**: Support for paginated responses with metadata

### **Offline Support**
- **Sync Endpoints**: `/sync/*` for offline synchronization
- **Timestamps**: All responses include timestamps for sync purposes
- **Batch Operations**: Support for batch uploads

---

## 🚨 **Error Handling**

### **Error Response Format**
```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description",
  "timestamp": "2025-06-20T10:00:00Z"
}
```

### **Common HTTP Status Codes**
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

---

## 🧪 **Testing**

### **Health Check**
```bash
GET /health
```

### **API Testing Script**
Run the included test script to verify all endpoints:
```bash
python test_api_alignment.py
```

---

## 🔧 **Configuration**

### **Environment Variables**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET_KEY` - JWT signing key
- `DEBUG` - Debug mode flag

### **CORS Configuration**
All endpoints support CORS for frontend integration.

---

## 📞 **Support**

For API support and questions:
- Check the alignment guide: `FRONTEND_BACKEND_API_ALIGNMENT_GUIDE.md`
- Review frontend service: `CashApp-iOS/CashAppPOS/src/services/DatabaseService.ts`
- Create GitHub issues for bugs or feature requests

---

**This documentation reflects the current state of the API after frontend-backend alignment implementation (June 20, 2025).**