"""
WebSocket Message-Based Authentication Implementation

PROBLEM: React Native strips query parameters from WebSocket URLs, but our backend
ONLY accepts authentication via query params. This causes 403 Forbidden errors.

SOLUTION: Modify the backend to support authentication via the first message
after connection, while maintaining backward compatibility with query param auth.
"""

# Modified websocket endpoint to support message-based auth:

async def websocket_pos_endpoint_fixed(
    websocket: WebSocket,
    restaurant_id: str = Path(..., description="Restaurant ID"),
    user_id: Optional[str] = Query(None, description="User ID (deprecated)"),
    db: Session = Depends(get_db),
):
    """
    POS-specific WebSocket endpoint with message-based authentication support
    """
    connection_id = None
    verified_user = None
    authenticated = False
    
    try:
        # Accept the WebSocket connection first (required for message exchange)
        await websocket.accept()
        
        # Try to get token from query params (backward compatibility)
        token = websocket.query_params.get("token")
        
        if token and user_id:
            # Legacy path: authenticate via query params
            has_access, verified_user = await verify_websocket_access(
                restaurant_id, user_id, token, "pos", db
            )
            if has_access:
                authenticated = True
        
        if not authenticated:
            # New path: wait for authentication message
            # Set a timeout for authentication
            try:
                auth_timeout = 10  # seconds
                auth_message_text = await asyncio.wait_for(
                    websocket.receive_text(), 
                    timeout=auth_timeout
                )
                
                auth_message = json.loads(auth_message_text)
                
                # Check if this is an authentication message
                if auth_message.get("type") == "authenticate":
                    auth_data = auth_message.get("data", {})
                    token = auth_data.get("token")
                    user_id = auth_data.get("user_id")
                    
                    if token and user_id:
                        has_access, verified_user = await verify_websocket_access(
                            restaurant_id, user_id, token, "pos", db
                        )
                        
                        if has_access:
                            authenticated = True
                            # Send authentication success
                            await websocket.send_text(json.dumps({
                                "type": "authenticated",
                                "data": {
                                    "message": "Authentication successful",
                                    "user_id": str(verified_user.id) if verified_user else user_id
                                }
                            }))
                        else:
                            # Send authentication error
                            await websocket.send_text(json.dumps({
                                "type": "auth_error",
                                "data": {"message": "Invalid credentials"}
                            }))
                            await websocket.close(code=4003, reason="Authentication failed")
                            return
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "auth_error",
                            "data": {"message": "Missing token or user_id"}
                        }))
                        await websocket.close(code=4003, reason="Missing credentials")
                        return
                else:
                    # Not an auth message, close connection
                    await websocket.close(code=4002, reason="Expected authentication")
                    return
                    
            except asyncio.TimeoutError:
                await websocket.close(code=4002, reason="Authentication timeout")
                return
            except json.JSONDecodeError:
                await websocket.close(code=4002, reason="Invalid message format")
                return
        
        if not authenticated:
            await websocket.close(code=4003, reason="Not authenticated")
            return
        
        # Now proceed with normal WebSocket operations...
        # (rest of the original code continues here)