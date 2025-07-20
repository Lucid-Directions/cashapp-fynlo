# Critical Authentication & WebSocket Fixes

## Issues Fixed

### 1. Database Schema Mismatch
**Problem**: The `restaurants` table was missing the `floor_plan_layout` column that the SQLAlchemy model expected, causing authentication to fail with a 500 error.

**Solution**: 
- Modified the auth verification query to explicitly select columns, excluding `floor_plan_layout`
- Created a migration runner script (`run_migrations.py`) to apply pending migrations
- This is a temporary workaround until migration `008_add_table_order_linkage.py` is applied

### 2. WebSocket Auto-Connection Before Authentication
**Problem**: The WebSocket service was attempting to connect automatically when the network became available, even when no user was authenticated, causing repeated connection failures.

**Solution**: 
- Updated `EnhancedWebSocketService.setupNetworkMonitoring()` to check for user authentication before attempting reconnection
- WebSocket will now only reconnect on network restoration if a user is authenticated

### 3. TypedDict Compatibility
**Problem**: Python < 3.12 compatibility issue with Pydantic 2.5.2 requiring `typing_extensions.TypedDict`

**Solution**: 
- Updated `fee_schemas.py` to import TypedDict from `typing_extensions`

## Action Required

### Run Database Migrations
```bash
cd backend
python run_migrations.py
```

This will:
1. Check database connection
2. Verify if `floor_plan_layout` column exists
3. Run pending migrations if needed
4. Confirm the column was added

### Verify Fixes
1. **Authentication**: Users should now be able to sign in without getting "Authentication service error"
2. **WebSocket**: No more repeated connection attempts before user signs in
3. **Backend**: Server should start without TypedDict errors

## Files Modified
- `/backend/app/api/v1/endpoints/auth.py` - Fixed Restaurant query to exclude missing column
- `/CashApp-iOS/CashAppPOS/src/services/websocket/EnhancedWebSocketService.ts` - Added auth check before reconnection
- `/backend/app/schemas/fee_schemas.py` - Fixed TypedDict import
- `/backend/run_migrations.py` - Created migration runner script

## Notes
- The auth endpoint fix is temporary and should be reverted after the database migration is applied
- The WebSocket fix prevents unnecessary connection attempts and improves app startup performance
- These fixes address the critical issues preventing users from signing in