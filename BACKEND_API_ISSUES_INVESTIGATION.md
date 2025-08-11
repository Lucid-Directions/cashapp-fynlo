# Backend API Issues Investigation Report - Comprehensive

## Executive Summary
This document provides a comprehensive investigation of backend API issues affecting the Fynlo POS production deployment on DigitalOcean. Critical issues include WebSocket connection failures, employee endpoint 403 errors, and intermittent API timeouts.

## Critical Issues Identified

### 1. WebSocket Connection Failures (CRITICAL)
**Status**: 🔴 Blocking real-time updates  
**Impact**: Orders not updating in real-time, POS screens not syncing

#### Symptoms:
- WebSocket connections fail with 403 Forbidden
- Connection URLs: `wss://fynlopos-9eg2c.ondigitalocean.app/ws/pos/{restaurant_id}`
- Authentication tokens are being sent but rejected

#### Root Cause Analysis:
```python
# Current WebSocket authentication flow:
1. Client sends token in query params (stripped by React Native)
2. Fallback to headers (not always supported)
3. Backend expects token in specific format
4. Multi-tenant validation fails without proper restaurant context
```

#### Evidence from Logs:
```
2025-08-11 - WebSocket connection test results:
- Status 403: Forbidden
- Headers indicate authentication required
- Token validation failing at middleware level
```

### 2. Employee Endpoints 403 Errors
**Status**: 🔴 Blocking employee management  
**Impact**: Cannot add/edit employees, role management broken

#### Affected Endpoints:
- `GET /api/v1/employees/` → 403 Forbidden
- `POST /api/v1/employees/` → 403 Forbidden
- `PUT /api/v1/employees/{id}` → 403 Forbidden

#### Root Cause:
- Multi-tenant security checks failing
- Restaurant context not properly set in token
- RBAC middleware rejecting valid tokens

### 3. Authentication Token Issues
**Status**: 🟡 Partially working  
**Impact**: Intermittent logouts, session management issues

#### Problems:
- Supabase tokens not always validated correctly
- Backend creating duplicate user records
- Token refresh mechanism unreliable
- Restaurant ID not persisted in session

### 4. CORS Configuration Issues
**Status**: 🟡 Works but insecure  
**Impact**: Security vulnerability with wildcard CORS

#### Current Configuration:
```python
CORS_ORIGINS = ["*"]  # SECURITY RISK!
```

Should be:
```python
CORS_ORIGINS = [
    "https://fynlo.co.uk",
    "https://app.fynlo.co.uk",
    "capacitor://localhost",  # iOS
    "http://localhost:19006"  # Dev only
]
```

### 5. Database Connection Pool Exhaustion
**Status**: 🟡 Intermittent  
**Impact**: API timeouts during peak usage

#### Symptoms:
- Timeouts after ~30 seconds
- "too many connections" errors in logs
- Happens during busy restaurant hours

#### Current Settings:
```python
# Likely using defaults:
pool_size=5
max_overflow=10
```

#### Recommended:
```python
pool_size=20
max_overflow=40
pool_pre_ping=True
pool_recycle=3600
```

## API Testing Results

### Health Check Endpoints
```bash
/api/v1/health → ✅ 200 OK
/api/v1/docs → ✅ 200 OK (Swagger UI)
/ping → ✅ 200 OK
```

### Authentication Endpoints
```bash
/api/v1/auth/verify → ⚠️ 422 (expects POST with token)
/api/v1/auth/login → ❌ Not implemented (uses Supabase)
/api/v1/auth/refresh → ❌ Not implemented
```

### Restaurant Endpoints
```bash
/api/v1/restaurants → ✅ 200 OK (public)
/api/v1/restaurants/{id} → ⚠️ Requires auth
/api/v1/restaurants/{id}/menu → ⚠️ Requires auth
```

### Order Endpoints
```bash
/api/v1/orders → ❌ 403 Forbidden
/api/v1/orders/active → ❌ 403 Forbidden
/api/v1/orders/{id} → ❌ 403 Forbidden
```

## Environment Variables Audit

### Missing or Misconfigured:
```bash
# Current production .env issues:
WEBSOCKET_SECRET → Not set (causes 403)
REDIS_URL → Using wrong format
CORS_ORIGINS → Using wildcard
JWT_ALGORITHM → Not consistent with Supabase
SUPABASE_JWT_SECRET → May not match Supabase instance
```

### Required Configuration:
```bash
# Correct configuration:
ENVIRONMENT=production
SUPABASE_URL=https://eweggzpvuqczrrrwszyy.supabase.co
SUPABASE_ANON_KEY=[from Supabase dashboard]
SUPABASE_JWT_SECRET=[from Supabase dashboard]
DATABASE_URL=postgresql://...@db-postgresql-lon1-fynlo-do-user...
REDIS_URL=redis://default:password@redis-host:6379/0
CORS_ORIGINS=https://fynlo.co.uk,https://app.fynlo.co.uk
WEBSOCKET_SECRET=your-secret-here
```

## Critical Code Issues

### 1. WebSocket Manager (`app/websocket/manager.py`)
```python
# Issue: Token validation happens before restaurant context
async def connect(self, websocket: WebSocket, restaurant_id: int):
    # This rejects valid tokens without restaurant context
    user = await self.authenticate_websocket(websocket)  # FAILS HERE
    if not user:
        await websocket.close(code=4003)
```

**Fix Required**:
```python
async def connect(self, websocket: WebSocket, restaurant_id: int):
    # First accept connection
    await websocket.accept()
    
    # Then validate with restaurant context
    user = await self.authenticate_websocket(websocket, restaurant_id)
    if not user:
        await websocket.close(code=4003)
```

### 2. Multi-tenant Middleware (`app/middleware/multi_tenant.py`)
```python
# Issue: Assumes restaurant_id in all requests
restaurant_id = request.headers.get("X-Restaurant-Id")
if not restaurant_id:
    # This causes 403 for many endpoints
    raise HTTPException(status_code=403)
```

**Fix Required**:
```python
# Get restaurant_id from token claims or header
restaurant_id = (
    token_claims.get("restaurant_id") or
    request.headers.get("X-Restaurant-Id") or
    extract_from_path(request.url.path)
)
```

### 3. Employee Endpoints (`app/api/v1/endpoints/employees.py`)
```python
# Issue: Missing proper RBAC checks
@router.get("/employees/")
async def get_employees(
    current_user: User = Depends(get_current_user)  # This fails
):
```

**Fix Required**:
```python
@router.get("/employees/")
async def get_employees(
    current_user: User = Depends(get_current_active_user),
    restaurant_id: int = Depends(get_restaurant_context)
):
```

## Immediate Actions Required

### 1. Fix WebSocket Authentication (PRIORITY 1)
- [ ] Update WebSocket manager to handle React Native token limitations
- [ ] Implement proper authentication flow with restaurant context
- [ ] Add connection retry logic with exponential backoff

### 2. Fix Employee Endpoints (PRIORITY 1)
- [ ] Update RBAC middleware to handle restaurant context
- [ ] Fix permission checks for employee management
- [ ] Add proper error messages for debugging

### 3. Update CORS Configuration (PRIORITY 2)
- [ ] Remove wildcard CORS origin
- [ ] Add specific allowed origins
- [ ] Include iOS app origins

### 4. Fix Database Pool (PRIORITY 2)
- [ ] Increase connection pool size
- [ ] Add connection recycling
- [ ] Implement query optimization

### 5. Implement Token Refresh (PRIORITY 3)
- [ ] Add token refresh endpoint
- [ ] Implement automatic refresh in middleware
- [ ] Update mobile app to handle refresh

## Testing Scripts

### Test WebSocket Connection:
```python
import asyncio
import websockets
import json

async def test_websocket():
    uri = "wss://fynlopos-9eg2c.ondigitalocean.app/ws/pos/1"
    headers = {
        "Authorization": "Bearer YOUR_TOKEN"
    }
    
    async with websockets.connect(uri, extra_headers=headers) as ws:
        # Send auth message
        await ws.send(json.dumps({
            "type": "authenticate",
            "token": "YOUR_TOKEN"
        }))
        
        # Wait for response
        response = await ws.recv()
        print(f"Received: {response}")

asyncio.run(test_websocket())
```

### Test Employee Endpoint:
```bash
curl -X GET "https://fynlopos-9eg2c.ondigitalocean.app/api/v1/employees" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Restaurant-Id: 1" \
  -H "Accept: application/json"
```

## Monitoring Recommendations

### 1. Add Health Checks:
- WebSocket connection health
- Database connection pool status
- Redis connection status
- Token validation success rate

### 2. Add Metrics:
- API response times by endpoint
- WebSocket connection count
- Failed authentication attempts
- Database query performance

### 3. Add Alerts:
- WebSocket connections < threshold
- API response time > 2s
- Database connections > 80% capacity
- Authentication failures > 10/min

## Deployment Checklist

Before deploying fixes:
- [ ] Test WebSocket connections locally
- [ ] Verify employee endpoints with all roles
- [ ] Check CORS with mobile app
- [ ] Load test database connections
- [ ] Verify token refresh flow
- [ ] Update environment variables
- [ ] Create rollback plan
- [ ] Schedule maintenance window

## Conclusion

The backend API has several critical issues that need immediate attention:
1. **WebSocket authentication is completely broken** - blocking real-time features
2. **Employee management endpoints return 403** - blocking staff management
3. **CORS uses wildcard** - security vulnerability
4. **Database pool too small** - causes timeouts during peak hours

These issues require backend code changes and cannot be fully resolved from the mobile app side. The fixes proposed above should be implemented in priority order to restore full functionality.

## Next Steps

1. Create backend PR with WebSocket authentication fixes
2. Update multi-tenant middleware for proper context handling
3. Fix employee endpoints RBAC checks
4. Update production environment variables
5. Deploy fixes to DigitalOcean
6. Test with mobile app on physical device

---

*Generated: 2025-08-11*  
*Author: Fynlo POS Development Team*  
*Status: Investigation Complete - Awaiting Backend Fixes*