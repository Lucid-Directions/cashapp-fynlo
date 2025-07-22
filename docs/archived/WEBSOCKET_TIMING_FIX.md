# WebSocket Connection Timing Fix

## Problem
WebSocket was attempting to connect immediately after user authentication, before the auth token was fully stored, causing connection failures with the error "WebSocket connection failed: Error Domain=NSPOSIXErrorDomain Code=61 'Connection refused'".

## Root Cause
1. `HomeHubScreen` was using `useWebSocket({ autoConnect: true })`
2. After authentication, the app immediately navigates to HomeHubScreen
3. The WebSocket would try to connect before the auth token was fully available
4. The `useWebSocket` hook defaulted to auto-connecting when no option was specified

## Solution
1. Changed `HomeHubScreen` to use `useWebSocket({ autoConnect: false })`
2. Updated `useWebSocket` hook to only auto-connect when explicitly set to `true`
3. Updated all specialized hooks to not auto-connect by default:
   - `useOrderUpdates`
   - `useInventoryUpdates`
   - `useMenuUpdates`
   - `useSystemNotifications`

## Files Modified
- `/CashApp-iOS/CashAppPOS/src/screens/main/HomeHubScreen.tsx` - Disabled auto-connect
- `/CashApp-iOS/CashAppPOS/src/hooks/useWebSocket.ts` - Changed default behavior and updated all hooks

## Result
WebSocket will no longer attempt to connect immediately after authentication. Components that need real-time updates should explicitly connect when needed, giving the authentication process time to complete and store tokens properly.

## How to Connect WebSocket When Needed
```typescript
// Option 1: Explicit auto-connect
const { connected } = useWebSocket({ autoConnect: true });

// Option 2: Manual connection
const { connect, connected } = useWebSocket();
// Then call connect() when ready
```