# 🚨 CRITICAL BACKEND FIX REQUIRED

## Issue: Production Crash - Undefined Method

**File**: `backend/app/api/v1/endpoints/websocket.py`
**Line**: 375-382
**Severity**: CRITICAL - Will crash production

### Problem
The code calls `security_monitor.log_suspicious_activity()` which doesn't exist. This will cause the application to crash when a WebSocket connection is attempted without a user_id.

### Current Code (BROKEN)
```python
# Line 375-382
await security_monitor.log_suspicious_activity(
    event_type="websocket_auth_bypass_attempt",
    details={
        "restaurant_id": restaurant_id,
        "connection_type": connection_type,
        "error": "Missing user_id",
    },
)
```

### Fixed Code
```python
# Replace with:
await security_monitor.log_event(
    event_type=SecurityEventType.ACCESS_DENIED,
    ip_address=websocket.client.host if websocket.client else "unknown",
    restaurant_id=restaurant_id,
    details={
        "connection_type": connection_type,
        "error": "Missing user_id - potential auth bypass attempt"
    },
    severity="CRITICAL"
)
```

## Additional Backend Changes Required

### 1. Support Authentication via First WebSocket Message

Since React Native's WebSocket implementation strips query parameters, the backend needs to accept authentication via the first WebSocket message.

**File**: `backend/app/api/v1/endpoints/websocket.py`
**After Line**: 453 (after websocket.accept())

Add:
```python
# Wait for authentication message (React Native compatibility)
try:
    auth_timeout = 5.0  # 5 seconds to authenticate
    auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=auth_timeout)
    
    if auth_message.get("type") == "authenticate":
        token = auth_message.get("token")
        user_id = auth_message.get("user_id")
        
        # Verify authentication
        has_access, verified_user = await verify_websocket_access(
            restaurant_id, user_id, token, connection_type, db
        )
        
        if has_access:
            # Send auth success
            await websocket.send_json({
                "type": "auth_success",
                "user_id": user_id,
                "restaurant_id": restaurant_id,
                "timestamp": datetime.utcnow().isoformat()
            })
        else:
            # Send auth error and close
            await websocket.send_json({
                "type": "auth_error",
                "error": "Authentication failed",
                "timestamp": datetime.utcnow().isoformat()
            })
            await websocket.close(code=4003, reason="Authentication failed")
            return
    else:
        # Not an auth message, close connection
        await websocket.close(code=4003, reason="Expected authentication message")
        return
        
except asyncio.TimeoutError:
    await websocket.close(code=4003, reason="Authentication timeout")
    return
except Exception as e:
    logger.error(f"Authentication error: {e}")
    await websocket.close(code=4003, reason="Authentication error")
    return
```

### 2. Extract user_id from Token if Not Provided

**File**: `backend/app/api/v1/endpoints/websocket.py`
**Line**: 371-383 in `verify_websocket_access` function

```python
# CRITICAL SECURITY FIX: Always require authentication
# But allow extraction from token if not provided as parameter
if not user_id:
    # If we have a verified user from token validation, use their ID
    if user and hasattr(user, 'id'):
        user_id = str(user.id)
        logger.info(f"WebSocket: Using user_id from token validation: {user_id}")
    else:
        logger.warning("WebSocket connection attempted without user_id or valid token")
        # FIXED: Use correct method name
        await security_monitor.log_event(
            event_type=SecurityEventType.ACCESS_DENIED,
            ip_address="unknown",  # Pass IP from caller if available
            restaurant_id=restaurant_id,
            details={
                "connection_type": connection_type,
                "error": "Missing user_id and no valid token",
            },
            severity="CRITICAL"
        )
        return False, None
```

### 3. Token Expiration Validation

Add token expiration check after line 285:

```python
# Verify token is not expired
try:
    import jwt
    from datetime import datetime
    
    # Decode without verification to get payload
    payload = jwt.decode(token, options={"verify_signature": False})
    
    # Check expiration
    if 'exp' in payload:
        expiry_time = datetime.fromtimestamp(payload['exp'])
        if datetime.utcnow() > expiry_time:
            logger.error(f"Expired token presented - expired at {expiry_time}")
            return False, None
            
except jwt.DecodeError:
    logger.error("Invalid JWT token format")
    return False, None
```

## Testing Steps

1. Test WebSocket connection without query parameters
2. Test authentication via first message
3. Test with expired token
4. Test with user_id = 0
5. Test connection without user_id but with valid token
6. Test the security monitor logging

## Impact

Without these fixes:
1. **Production will crash** when WebSocket connections are attempted without user_id
2. **React Native clients cannot connect** due to query parameter stripping
3. **Security vulnerabilities** with expired tokens and zero user IDs

## Priority

**IMMEDIATE** - The undefined method will crash production as soon as any WebSocket connection is attempted without proper parameters.