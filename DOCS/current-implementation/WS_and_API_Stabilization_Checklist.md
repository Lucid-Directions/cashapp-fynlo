# WS & API Path Alignment Checklist (UPDATED)

## Current Status: Fixing Path Mismatches

This checklist has been updated to reflect what's ACTUALLY needed vs what's already implemented.

## ✅ Already Completed (Found in codebase)

### WebSocket Client Features (DONE)
- ✅ URL token authentication implemented (appends `?token=<jwt>&user_id=<uuid>`)
- ✅ URLSearchParams polyfill exists (`src/utils/urlSearchParamsPolyfill.ts`)
- ✅ Robust user ID validation (rejects empty/"0" values)
- ✅ 10-second authentication timeout with proper cleanup
- ✅ Dual authentication mode (URL params + message-based)
- ✅ Heartbeat mechanism (15-second interval, ping/pong)
- ✅ Exponential backoff with jitter (1s base, 30s max)
- ✅ Network monitoring with NetInfo
- ✅ Handles both `authenticated` and `auth_success` events

## 🔴 Actual Issues to Fix

### 1. WebSocket Path Mismatch
**Problem**: Client uses wrong path
- Client sends to: `/api/v1/websocket/ws/pos/{restaurant_id}`
- Backend expects: `/api/v1/websocket/ws/pos/{restaurant_id}` ✅ CORRECT
- **Status**: Backend path verified, client path is actually correct

### 2. Employee API Issues
**Problem**: Multiple issues with employee endpoints
- Client calls: `GET /api/v1/employees`
- Backend has TWO competing endpoints:
  - Direct mount: `GET /api/v1/employees` (in main.py)
  - Router mount: `GET /api/v1/employees/` (via router with trailing slash)
- This causes 404/405 errors due to trailing slash differences
- **Fix needed**: Update client to use `/api/v1/employees/` with trailing slash

### 3. Performance Issues Found
- N+1 queries in employee fetching
- Missing database indexes
- No caching for repeated auth checks
- In-memory WebSocket tracking doesn't scale

## 📋 Action Items

### Phase 1: Immediate Path Fixes
- [ ] Fix Employee API path in DataService.ts (add trailing slash)
- [ ] Verify WebSocket path is correct (appears to be fine)
- [ ] Test both endpoints with production backend

### Phase 2: Backend Optimization (Separate PR)
- [ ] Remove duplicate employee endpoint from main.py
- [ ] Add database indexes for performance
- [ ] Implement Redis caching for auth tokens
- [ ] Add eager loading to prevent N+1 queries

## 🚀 Current Branch: fix/websocket-api-paths

### Files to Modify:
1. `CashApp-iOS/CashAppPOS/src/services/DataService.ts`
   - Update employee endpoints to include trailing slash

2. `CashApp-iOS/CashAppPOS/src/services/websocket/EnhancedWebSocketService.ts`
   - Verify WebSocket path (appears correct already)

## 📝 PR Description Template

```
## What
- Fixed employee API path to match backend expectations (added trailing slash)
- Verified WebSocket paths are correctly aligned

## Why
- Employee API was calling `/api/v1/employees` but backend expects `/api/v1/employees/`
- This mismatch caused 404/405 errors

## Changes
- DataService.ts: Added trailing slash to employee endpoints
- No WebSocket changes needed (path was already correct)

## Testing
- ✅ Employee list loads without 404 errors
- ✅ WebSocket connects and authenticates successfully
- ✅ No regression in other API calls

## Follow-up
- Backend optimization PR to remove duplicate endpoints
- Add performance improvements (caching, indexes)
```

## 🔍 Verification Commands

```bash
# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  "wss://fynlopos-9eg2c.ondigitalocean.app/api/v1/websocket/ws/pos/TEST_RESTAURANT?user_id=TEST&token=TEST"

# Test Employee API
curl -H "Authorization: Bearer TOKEN" \
  "https://fynlopos-9eg2c.ondigitalocean.app/api/v1/employees/"
```

## ✅ Sign-off
- [ ] Path fixes completed
- [ ] Tests pass locally
- [ ] PR created with detailed description
- [ ] Arnaud review & merge
- [ ] Production deployment verified