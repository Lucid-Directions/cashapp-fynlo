# 🔄 **Frontend-Backend API Requirements - Ryan's Implementation Guide**

**Date**: December 20, 2024  
**Priority**: URGENT - Backend Development  
**GitHub Issue**: #57  
**Status**: Waiting for Implementation

---

## 🚨 **URGENT: Critical API Endpoints Missing**

The frontend is fully implemented with Mexican restaurant theme, menu management, and Xero integration. **Backend must implement missing endpoints to enable integration.**

### **🎯 Key Principle: Backend Follows Frontend**
- **Frontend `DatabaseService.ts` is the source of truth** for API contracts
- **Mock data must remain intact** for client demonstrations  
- **All response formats must match** TypeScript interfaces exactly

---

## 📊 **Critical Missing Endpoints - Implement Today**

### **🔐 1. POS Session Management**
```typescript
// MISSING - High Priority
GET /api/v1/pos/sessions/current
POST /api/v1/pos/sessions
Body: { config_id: number }

// Expected Response:
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Session 001",
    "state": "opened",
    "start_at": "2024-12-20T10:00:00Z",
    "config_id": 1,
    "config_name": "Main POS",
    "user_id": 1,
    "user_name": "Manager"
  }
}
```

### **🍽️ 2. Mobile-Optimized Products**
```typescript
// MISSING - High Priority  
GET /api/v1/products/mobile
GET /api/v1/products/category/{categoryId}

// Expected Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Classic Burger",
      "price": 12.99,
      "category": "Main",
      "image": "url_or_null",
      "barcode": "optional",
      "available_in_pos": true,
      "active": true
    }
  ]
}
```

### **🏪 3. Restaurant Floor Plan**
```typescript
// MISSING - Medium Priority
GET /api/v1/restaurant/floor-plan?section_id={id}
PUT /api/v1/restaurant/tables/{tableId}/status
PUT /api/v1/restaurant/tables/{tableId}/server
GET /api/v1/restaurant/sections

// Floor Plan Response Structure:
{
  "success": true,
  "data": {
    "tables": [
      {
        "id": "1",
        "name": "T1",
        "display_name": "Main Floor - Table T1",
        "capacity": 4,
        "status": "available",
        "section": {"id": "1", "name": "Main Floor", "color": "#3498db"}
      }
    ],
    "sections": [
      {"id": "1", "name": "Main Floor", "color": "#3498db"}
    ]
  }
}
```

### **📊 4. Reports Endpoints**
```typescript
// MISSING - Medium Priority
GET /api/v1/reports/daily-sales?date={date}
GET /api/v1/reports/sales-summary?date_from={date}&date_to={date}
```

---

## ✅ **Verify Existing Endpoints**

### **🔐 Authentication - CHECK RESPONSE FORMAT**
```typescript
POST /api/v1/auth/login
// Frontend expects:
{
  "success": true,
  "data": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token", 
    "user": {...},
    "restaurant": {...}
  }
}
```

### **🛒 Orders - CHECK DATA MODEL ALIGNMENT**
```typescript
POST /api/v1/orders
PUT /api/v1/orders/{orderId}
GET /api/v1/orders/recent?limit={number}

// Frontend Order Interface:
interface Order {
  id?: number;
  date_order: string;
  state: 'draft' | 'paid' | 'done' | 'invoiced' | 'cancel';
  amount_total: number;
  session_id: number;
  lines: OrderLine[];
}
```

### **💳 Payments - VERIFY RESPONSE FORMAT**
```typescript
POST /api/v1/payments
// Frontend expects: { success: boolean }
```

---

## 🏗️ **Standardized Response Format - CRITICAL**

**ALL endpoints must return this exact format:**

### **Success Response:**
```json
{
  "success": true,
  "data": {...},
  "message": "Optional success message",
  "timestamp": "2024-12-20T10:30:00Z"
}
```

### **Error Response:**
```json
{
  "success": false,
  "error": "Error description",
  "message": "User-friendly error message",
  "timestamp": "2024-12-20T10:30:00Z"
}
```

### **List Response with Pagination:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 100,
    "limit": 20,
    "offset": 0
  },
  "timestamp": "2024-12-20T10:30:00Z"
}
```

---

## 📱 **Frontend Implementation Details**

### **Current Frontend Status:**
- **File**: `CashApp-iOS/CashAppPOS/src/services/DatabaseService.ts`
- **Lines 134-586**: Complete API expectations
- **Status**: All UI completed, waiting for backend endpoints

### **API Usage Patterns:**
```typescript
// Authentication
const response = await this.apiRequest('/api/v1/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: username, password })
});

// Products
const response = await this.apiRequest('/api/v1/products/mobile');

// Orders  
const response = await this.apiRequest('/api/v1/orders', {
  method: 'POST',
  body: JSON.stringify(orderData)
});
```

---

## 🚀 **Implementation Priority**

### **Phase 1: Immediate (Today)**
1. ✅ **POS Sessions** - Critical for app initialization
2. ✅ **Products Mobile** - Essential for menu display
3. ✅ **Response Format** - Standardize all existing endpoints

### **Phase 2: This Week**
1. ✅ **Restaurant Floor Plan** - For table management
2. ✅ **Reports** - For analytics screens
3. ✅ **Data Model Alignment** - Ensure perfect matching

### **Phase 3: Testing**
1. ✅ **Health Endpoints** - Verify all work with curl
2. ✅ **Integration Testing** - Frontend team will test
3. ✅ **Documentation** - Update any changes made

---

## 🧪 **Testing Requirements**

### **Backend Self-Testing:**
```bash
# Health check
curl http://localhost:8000/health

# Authentication test
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Products test
curl http://localhost:8000/api/v1/products/mobile

# POS Sessions test
curl http://localhost:8000/api/v1/pos/sessions/current
```

### **Response Validation:**
- All responses must include `success` field
- Data must be in `data` field for successful responses
- Errors must be in `error` field for failed responses
- HTTP status codes must match response success state

---

## 📞 **Communication Protocol**

### **When Complete:**
1. **Comment on GitHub Issue #57** with status update
2. **Test all endpoints** with curl before marking complete
3. **Document any deviations** from specifications
4. **Tag frontend team** when ready for integration testing

### **If Questions:**
1. **Check DatabaseService.ts** for exact frontend expectations
2. **Reference this document** for specifications
3. **Comment on GitHub Issue #57** for clarification
4. **Follow existing backend patterns** for consistency

---

## ⚠️ **Critical Notes**

1. **DO NOT change frontend contracts** - Backend must adapt
2. **DO NOT break existing endpoints** - Only add/modify as specified
3. **TEST every endpoint** before marking complete
4. **FOLLOW exact response formats** - Frontend expects specific structure
5. **PRESERVE CORS settings** - Frontend needs cross-origin access

---

## 📚 **Reference Files**

### **Frontend API Expectations:**
- `CashApp-iOS/CashAppPOS/src/services/DatabaseService.ts` (lines 134-586)
- `CashApp-iOS/CashAppPOS/src/services/DataService.ts` (feature flags)

### **Backend Implementation:**
- `backend/app/api/v1/endpoints/` (endpoint files)
- `backend/app/core/responses.py` (response standardization)
- `backend/app/main.py` (main FastAPI app)

---

**This document contains all requirements for backend implementation. Follow exactly to ensure frontend-backend compatibility.**

**GitHub Issue**: #57 - Frontend-Backend API Alignment Required  
**Status**: Waiting for Implementation