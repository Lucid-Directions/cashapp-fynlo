# WebSocket Token Refresh Implementation

## Overview
This implementation adds automatic token refresh to WebSocket connections without requiring disconnection and reconnection. This ensures continuous real-time communication even when authentication tokens expire.

## Problem Solved
- Users were experiencing WebSocket disconnections every hour when tokens expired
- Manual reconnection disrupted real-time order updates and kitchen displays
- Poor user experience during busy service times

## Solution Architecture

### Backend Changes

1. **New Event Types** (`app/schemas/websocket.py`):
   - `REAUTH`: Re-authentication message for token refresh
   - `TOKEN_EXPIRED`: Server notification that token is expiring soon

2. **Token Expiry Checking** (`app/core/auth.py`):
   ```python
   def check_token_expiry(token: str) -> Optional[int]:
       """Returns seconds until token expiry"""
   ```

3. **Re-authentication Handler** (`app/api/v1/endpoints/websocket_enhanced.py`):
   - Handles `REAUTH` messages without disconnecting
   - Updates connection's token in-place
   - Validates new token with same security checks

4. **Proactive Expiry Notification**:
   - Server checks token expiry during heartbeats
   - Notifies client 5 minutes before expiry
   - Allows graceful token refresh

### Frontend Changes

1. **Token Refresh Listener** (`src/services/websocket/EnhancedWebSocketService.ts`):
   ```typescript
   tokenManager.on('token:refreshed', async (newToken) => {
     if (connected) await this.reauthenticate(newToken);
   });
   ```

2. **Re-authentication Method**:
   - Sends `REAUTH` message with new token
   - No connection interruption
   - Maintains message queue during refresh

3. **Token Expiry Handler**:
   - Responds to `TOKEN_EXPIRED` events
   - Triggers proactive token refresh
   - Falls back to reconnection if refresh fails

## Security Considerations

1. **No Token in URL**: Tokens are only sent in message body, never in connection URL
2. **Validation**: Re-authentication performs same security checks as initial auth
3. **User Context**: Ensures user_id matches throughout connection lifecycle
4. **Rate Limiting**: Re-authentication attempts are rate-limited
5. **Audit Trail**: All authentication events are logged

## Message Flow

### Initial Connection
```
Client → Server: Connect to WebSocket
Client → Server: AUTHENTICATE message with token
Server → Client: AUTHENTICATED response
```

### Token Refresh (Automatic)
```
TokenManager → WebSocket: token:refreshed event
Client → Server: REAUTH message with new token  
Server → Client: AUTHENTICATED response
```

### Token Expiry Warning
```
Server → Client: TOKEN_EXPIRED (5 min warning)
Client → TokenManager: Force refresh
Client → Server: REAUTH with new token
Server → Client: AUTHENTICATED response
```

## Testing

Run the test script to verify implementation:
```bash
cd backend
python test_websocket_token_refresh.py
```

The test verifies:
1. Normal WebSocket operation with heartbeat
2. Token expiry warning delivery
3. Re-authentication without disconnection
4. Continued operation after token refresh
5. Proper rejection of expired tokens

## Configuration

- **Token Expiry Buffer**: 5 minutes (300 seconds)
- **Heartbeat Interval**: 15 seconds
- **Max Missed Pongs**: 3
- **Token Refresh**: 60 seconds before expiry

## Benefits

1. **Zero Downtime**: No disconnection during token refresh
2. **Seamless UX**: Users unaware of token management
3. **Reliable Updates**: Real-time features continue uninterrupted
4. **Security**: Maintains all authentication safeguards

## Rollback Plan

If issues occur:
1. Remove `REAUTH` handler from backend
2. Remove token refresh listener from frontend
3. System falls back to reconnection on token expiry