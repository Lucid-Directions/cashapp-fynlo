# PR #271 - Authentication Token Refresh Race Condition Fixes

## Summary
This PR addresses critical authentication race conditions and WebSocket auth issues identified in the Fynlo POS mobile app. The fixes ensure reliable token refresh, prevent request timeouts, and improve auth error detection.

## Issues Fixed

### 1. **Token Validity Check Race Condition**
- **Problem**: Multiple services could simultaneously check token validity, triggering unnecessary refresh attempts
- **Solution**: Added 2-second validity cache to prevent concurrent checks
- **Files Modified**: `src/utils/tokenManager.ts`

### 2. **Request Queue Timeout**
- **Problem**: Requests queued during token refresh had no timeout, potentially waiting indefinitely
- **Solution**: Added 30-second timeout for queued requests with proper cleanup
- **Files Modified**: `src/services/auth/AuthInterceptor.ts`

### 3. **WebSocket Auth Error False Positives**
- **Problem**: Quick connection failures (<2s) were incorrectly classified as auth errors
- **Solution**: Improved auth error detection requiring specific error codes or auth keywords
- **Files Modified**: `src/services/websocket/WebSocketService.ts`

### 4. **Event Listener Setup Race Condition**
- **Problem**: Using `setTimeout(0)` could miss token events during initialization
- **Solution**: Changed to Promise.resolve() microtask and added duplicate prevention
- **Files Modified**: `src/store/useAuthStore.ts`

### 5. **Token Expiry Buffer Consistency**
- **Problem**: Different services used different expiry buffers (30s vs 60s)
- **Solution**: Unified to 60-second buffer across all services
- **Files Modified**: `src/utils/tokenManager.ts`

## Technical Details

### TokenManager Enhancements
```typescript
// Added validity cache to prevent concurrent checks
private tokenValidityCache: { isValid: boolean; checkedAt: number } | null = null;
private validityCacheDuration = 2000; // 2 seconds

// Unified expiry buffer
const expiryBuffer = 60 * 1000; // 60 seconds across system
```

### AuthInterceptor Queue Management
```typescript
interface QueuedRequest {
  config: RequestConfig;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;  // Added timeout tracking
  queuedAt: number;            // Added queue time tracking
}
```

### WebSocket Auth Error Detection
```typescript
// Auth-specific error code
const AUTH_ERROR_CODE = 4001;

// Improved detection logic
if (isAuthSpecificError || 
    (isPolicyViolation && hasAuthKeywords) || 
    (isAppSpecificError && hasAuthKeywords)) {
  // Handle auth error
}
```

### Event Listener Setup
```typescript
// Use microtask instead of setTimeout
Promise.resolve().then(() => {
  const store = useAuthStore.getState();
  if (!store.tokenRefreshListenerSetup) {
    store.setupTokenListeners();
  }
});
```

## Testing Recommendations

1. **Token Refresh Under Load**
   - Make multiple API calls simultaneously
   - Verify only one token refresh occurs
   - Check all requests complete successfully

2. **Request Timeout**
   - Simulate slow token refresh (>30s)
   - Verify queued requests timeout appropriately
   - Check error messages are descriptive

3. **WebSocket Reconnection**
   - Test with invalid token
   - Test with network interruptions
   - Verify correct auth error classification

4. **Event Listener Reliability**
   - Force app reload/refresh
   - Verify token events are not missed
   - Check no duplicate listeners are created

5. **Long Session Testing**
   - Keep app running for extended period
   - Verify token refreshes work after hours
   - Check WebSocket maintains connection

## Deployment Notes

1. This fix is critical for production stability
2. No database migrations required
3. Compatible with existing backend
4. Recommend staged rollout with monitoring

## Monitoring

After deployment, monitor:
- Token refresh frequency
- Request timeout rates
- WebSocket connection stability
- Authentication error rates

## Related Issues
- Fixes authentication issues reported in production
- Addresses WebSocket disconnection problems
- Resolves intermittent 401 errors