# 🔄 **Frontend-Backend API Alignment Guide**

**Date**: December 20, 2024  
**Priority**: URGENT - Ryan Backend Development  
**Purpose**: Ensure backend APIs match frontend expectations exactly

---

## 📋 **Executive Summary**

The frontend expects specific API routes and response formats. The backend has the correct `/api/v1/` structure but needs endpoint alignment. This document provides exact specifications for Ryan to follow.

## 🎯 **Key Principle: Backend Follows Frontend**

- **Frontend is the source of truth** for API contracts
- **Mock data must remain intact** for client demonstrations  
- **Backend must adapt** to frontend's established patterns
- **Response formats must match** TypeScript interfaces exactly

---

## 📊 **Critical API Endpoints Needed**

### **🔐 Authentication Endpoints**

#### **Frontend Expects:**
```typescript
POST /api/v1/auth/login
Body: { email: string, password: string }
Response: {
  success: true,
  data: {
    access_token: string,
    refresh_token: string,
    user: User,
    restaurant: Restaurant
  }
}

POST /api/v1/auth/logout
POST /api/v1/auth/refresh
```

#### **Backend Status:** ✅ **EXISTS** - Check response format alignment

---

### **🍽️ Products/Menu Endpoints**

#### **Frontend Expects:**
```typescript
GET /api/v1/products/mobile
Response: {
  success: true,
  data: Product[]
}

GET /api/v1/products/category/{categoryId}
GET /api/v1/categories
Response: {
  success: true,
  data: Category[]
}

// Product Interface:
interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  image?: string;
  barcode?: string;
  available_in_pos: boolean;
  active: boolean;
}
```

#### **Backend Status:** ❓ **VERIFY** - Check if `/products/mobile` exists

---

### **📱 POS Session Endpoints**

#### **Frontend Expects:**
```typescript
GET /api/v1/pos/sessions/current
POST /api/v1/pos/sessions
Body: { config_id: number }

// PosSession Interface:
interface PosSession {
  id: number;
  name: string;
  state: 'opening_control' | 'opened' | 'closing_control' | 'closed';
  start_at: string;
  stop_at?: string;
  config_id: number;
  config_name: string;
  user_id: number;
  user_name: string;
}
```

#### **Backend Status:** ❌ **MISSING** - Needs implementation

---

### **🛒 Order Processing Endpoints**

#### **Frontend Expects:**
```typescript
POST /api/v1/orders
PUT /api/v1/orders/{orderId}
GET /api/v1/orders/recent?limit={number}

// Order Interface:
interface Order {
  id?: number;
  name?: string;
  date_order: string;
  state: 'draft' | 'paid' | 'done' | 'invoiced' | 'cancel';
  amount_total: number;
  partner_id?: number;
  partner_name?: string;
  session_id: number;
  lines: OrderLine[];
}

interface OrderLine {
  id?: number;
  order_id?: number;
  product_id: number;
  product_name: string;
  qty: number;
  price_unit: number;
  price_subtotal: number;
}
```

#### **Backend Status:** ✅ **EXISTS** - Check data model alignment

---

### **💳 Payment Processing Endpoints**

#### **Frontend Expects:**
```typescript
POST /api/v1/payments
Body: {
  order_id: number,
  payment_method: string,
  amount: number
}
Response: { success: boolean }
```

#### **Backend Status:** ✅ **EXISTS** - Check response format

---

### **🏪 Restaurant Management Endpoints**

#### **Frontend Expects:**
```typescript
GET /api/v1/restaurant/floor-plan?section_id={id}
PUT /api/v1/restaurant/tables/{tableId}/status
PUT /api/v1/restaurant/tables/{tableId}/server
GET /api/v1/restaurant/sections
```

#### **Backend Status:** ❌ **MISSING** - Needs implementation

---

### **📊 Reports Endpoints**

#### **Frontend Expects:**
```typescript
GET /api/v1/reports/daily-sales?date={date}
GET /api/v1/reports/sales-summary?date_from={date}&date_to={date}
```

#### **Backend Status:** ❓ **VERIFY** - Check if exists

---

## 🚨 **URGENT: Missing Endpoints for Ryan**

### **Priority 1: Critical Missing APIs**
1. **POS Sessions Management**
   - `GET /api/v1/pos/sessions/current`
   - `POST /api/v1/pos/sessions`

2. **Products Mobile Optimization**
   - `GET /api/v1/products/mobile` (optimized for mobile)
   - `GET /api/v1/products/category/{categoryId}`

3. **Restaurant Floor Plan**
   - `GET /api/v1/restaurant/floor-plan`
   - `PUT /api/v1/restaurant/tables/{tableId}/status`
   - `PUT /api/v1/restaurant/tables/{tableId}/server`
   - `GET /api/v1/restaurant/sections`

### **Priority 2: Response Format Standardization**
All endpoints must return:
```typescript
{
  success: boolean,
  data?: any,
  message?: string,
  error?: string,
  timestamp?: string
}
```

---

## 📝 **Implementation Checklist for Ryan**

### **Phase 1: Immediate (Today)**
- [ ] Verify all existing endpoints return standardized response format
- [ ] Implement missing POS session endpoints
- [ ] Create `/products/mobile` endpoint with mobile-optimized data
- [ ] Add restaurant floor plan endpoints

### **Phase 2: Data Model Alignment**
- [ ] Ensure Order model matches frontend OrderLine structure
- [ ] Verify Product model includes all frontend fields
- [ ] Check Category model alignment
- [ ] Validate PosSession state values match frontend expectations

### **Phase 3: Testing Preparation**
- [ ] Add health checks for all endpoints
- [ ] Ensure CORS is properly configured
- [ ] Test all endpoints return expected response structure
- [ ] Validate authentication headers work correctly

---

## 🔧 **Response Format Examples**

### **Success Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Classic Burger",
    "price": 12.99
  },
  "message": "Product retrieved successfully",
  "timestamp": "2024-12-20T10:30:00Z"
}
```

### **Error Response:**
```json
{
  "success": false,
  "error": "Product not found",
  "message": "No product exists with ID 999",
  "timestamp": "2024-12-20T10:30:00Z"
}
```

### **List Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Product 1" },
    { "id": 2, "name": "Product 2" }
  ],
  "message": "Products retrieved successfully",
  "meta": {
    "total": 2,
    "limit": 20,
    "offset": 0
  },
  "timestamp": "2024-12-20T10:30:00Z"
}
```

---

## 📱 **Mobile-Specific Requirements**

### **Data Optimization:**
- Minimize response payload sizes
- Include only essential fields in mobile endpoints
- Use image URLs instead of base64 data
- Implement pagination for large datasets

### **Offline Support:**
- Timestamp all responses for sync purposes
- Include version/checksum fields
- Support batch operations where possible

---

## 🚀 **Testing Strategy**

### **Frontend Testing Mode:**
The frontend will implement a testing mode that:
- Tests real API connections without affecting demo data
- Logs all API responses for debugging
- Compares real vs mock data structures
- Provides API health dashboard for developers

### **Backend Testing:**
- All endpoints must work with curl/Postman
- Authentication flow must be testable independently
- WebSocket connections must handle mobile clients
- Performance must meet mobile app requirements

---

## 📞 **Communication Protocol**

### **For Ryan:**
1. **GitHub Issues:** Create issues for each missing endpoint
2. **Pull Requests:** Use descriptive titles with API changes
3. **Documentation:** Update API docs with any changes
4. **Testing:** Provide curl examples for all new endpoints

### **Status Updates:**
- Use GitHub project board to track progress
- Comment on this document with implementation status
- Tag frontend team when endpoints are ready for testing

---

## ⚠️ **Important Notes**

1. **Do NOT break existing endpoints** - only add/modify to match frontend
2. **Preserve demo data compatibility** - frontend must continue to work with mocks
3. **Follow established patterns** - use existing authentication and response formats
4. **Test thoroughly** - verify each endpoint works before marking complete
5. **Document changes** - update API documentation with any modifications

---

**This document is the definitive guide for backend API development. All implementations must follow these specifications exactly.**