"""
WebSocket Rate Limiting Integration
This module shows how to integrate rate limiting into the existing websocket.py


# Add these imports to websocket.py
from fastapi import Path, Query, WebSocket, Depends
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.websocket_rate_limiter import websocket_rate_limiter
from app.core.redis_client import get_redis

# Add these constants after existing rate limit configuration (around line 50)
MAX_MESSAGES_PER_CONNECTION = 60  # per minute  
MAX_MESSAGE_SIZE = 10 * 1024  # 10KB

# Modify the websocket_endpoint_general function (around line 349)
# Add rate limiting before accepting the connection:

async def websocket_endpoint_general_with_rate_limit(
    websocket: WebSocket,
    restaurant_id: str = Path(..., description="Restaurant ID"),
    user_id: Optional[str] = Query(None, description="User ID"),
    connection_type: str = Query("pos", description="Connection type"),
    db: Session = Depends(get_db),
    redis = Depends(get_redis),  # Add Redis dependency
):
    """
    Enhanced WebSocket endpoint with message rate limiting
    """
    connection_id = None
    verified_user = None
    client_host = websocket.client.host if websocket.client else "unknown"
    
    # Initialize rate limiter with Redis
    if redis and not websocket_rate_limiter.redis:
        websocket_rate_limiter.redis = redis

    # Ensure cleanup task is running
    await get_or_create_cleanup_task()

    try:
        # Check origin validation
        origin = websocket.headers.get("origin")
        if not validate_origin(origin):
            logger.warning(
                f"Invalid origin: {sanitize_string(str(origin), max_length=100)}"
            )
            await websocket.close(code=4001, reason="Unauthorized")
            return

        # NEW: Enhanced rate limiting check
        allowed, error_msg = await websocket_rate_limiter.check_connection_limit(
            ip_address=client_host,
            user_id=user_id
        )
        
        if not allowed:
            logger.warning(
                f"WebSocket connection rejected - Rate limit. "
                f"IP: {client_host}, User: {user_id}, Reason: {error_msg}"
            )
            await websocket.close(code=4029, reason=error_msg or "Rate limit exceeded")
            return

        # Get token from query parameters
        token = websocket.query_params.get("token")

        # Verify access with token validation
        has_access, verified_user = await verify_websocket_access(
            restaurant_id, user_id, token, connection_type, db
        )
        if not has_access:
            await websocket.close(code=4003, reason="Access denied")
            return

        # Check connection limits for authenticated users
        if user_id and not await check_connection_limit(user_id):
            await websocket.close(code=4009, reason="Connection limit exceeded")
            return

        # Accept connection
        await websocket.accept()
        
        # Generate connection ID
        connection_id = str(uuid.uuid4())
        
        # NEW: Register connection with rate limiter
        await websocket_rate_limiter.register_connection(
            connection_id, 
            str(verified_user.id) if verified_user else None,
            client_host
        )

        # Register connection with manager
        await websocket_manager.add_connection(
            connection_id=connection_id,
            websocket=websocket,
            restaurant_id=restaurant_id,
            user_id=str(verified_user.id) if verified_user else None,
            user=verified_user,
            connection_type=ConnectionType(connection_type) if connection_type else ConnectionType.POS,
        )

        # Send connection success message
        await websocket.send_json({
            "event": "connected",
            "connection_id": connection_id,
            "restaurant_id": restaurant_id,
            "timestamp": datetime.now().isoformat(),
            # NEW: Include rate limit info
            "rate_limit_info": await websocket_rate_limiter.get_rate_limit_info(connection_id)
        })

        # Message handling loop
        while True:
            try:
                # Receive message
                message_text = await websocket.receive_text()
                message_size = len(message_text.encode('utf-8'))
                
                # NEW: Check message rate limit
                allowed, error_msg = await websocket_rate_limiter.check_message_rate(
                    connection_id=connection_id,
                    message_size=message_size
                )
                
                if not allowed:
                    # Send rate limit error
                    await websocket.send_json({
                        "event": "error",
                        "error": "rate_limit_exceeded",
                        "message": error_msg,
                        "rate_limit_info": await websocket_rate_limiter.get_rate_limit_info(connection_id)
                    })
                    
                    # Log for security monitoring
                    logger.warning(
                        f"WebSocket message rejected - Rate limit. "
                        f"Connection: {connection_id}, Size: {message_size}, Reason: {error_msg}"
                    )
                    continue

                # Parse and validate message size
                try:
                    message_data = json.loads(message_text)
                except json.JSONDecodeError:
                    await websocket.send_json({
                        "event": "error",
                        "error": "invalid_format",
                        "message": "Invalid JSON format"
                    })
                    continue

                # Handle different message types
                message_type = message_data.get("type", "")
                
                # ... rest of message handling logic ...

            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}")
                await websocket.send_json({
                    "event": "error",
                    "error": "internal_error",
                    "message": "An error occurred processing your message"
                })

    except Exception as e:
        logger.error(f"WebSocket connection error: {str(e)}")
    finally:
        # Clean up
        if connection_id:
            await websocket_manager.remove_connection(connection_id)
            # NEW: Unregister from rate limiter
            await websocket_rate_limiter.unregister_connection(
                connection_id,
                str(verified_user.id) if verified_user else None
            )
            
        logger.info(f"WebSocket disconnected: {connection_id}")

# Add a periodic cleanup task for rate limiter
async def rate_limit_cleanup_task():
    """Periodic cleanup of rate limiter data"""
    while True:
        try:
            await asyncio.sleep(300)  # Every 5 minutes
            await websocket_rate_limiter.cleanup_expired_data()
            logger.debug("Rate limiter cleanup completed")
        except Exception as e:
            logger.error(f"Rate limiter cleanup error: {e}")

# Start the cleanup task on app startup
# Add this to your FastAPI app startup event:
# @app.on_event("startup")
# async def startup_event():
#     asyncio.create_task(rate_limit_cleanup_task())