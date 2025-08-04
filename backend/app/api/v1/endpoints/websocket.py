"""
WebSocket API endpoints for Fynlo POS
Real-time communication endpoints
"""

import asyncio
import json
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Set, Tuple

from fastapi import (
    APIRouter,
    Depends,
    Path,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import Restaurant, User, get_db
from app.core.exceptions import ErrorCodes, FynloException
from app.core.responses import APIResponseHelper
from app.core.supabase import supabase_admin
from app.core.validation import sanitize_string
from app.core.websocket import (
    ConnectionType,
    EventType,
    WebSocketMessage,
    websocket_manager,
)
from app.core.websocket_rate_limiter import WebSocketRateLimiter
from app.core.security_monitor import security_monitor
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize rate limiter
rate_limiter: Optional[WebSocketRateLimiter] = None


async def get_rate_limiter() -> WebSocketRateLimiter:
    """Get or create rate limiter instance"""
    global rate_limiter
    if rate_limiter is None:
        redis_client = await get_redis()
        rate_limiter = WebSocketRateLimiter(redis_client=redis_client)
    return rate_limiter


# Legacy rate limiting configuration (kept for backward compatibility)
connection_tracker: Dict[str, Dict[str, Any]] = defaultdict(
    lambda: {"count": 0, "last_reset": datetime.now()}
)
user_connections: Dict[str, Set[str]] = defaultdict(set)
CONNECTION_WINDOW = timedelta(minutes=1)
MAX_CONNECTIONS_PER_IP = 500  # per minute
MAX_CONNECTIONS_PER_USER = 5

# Background task for cleanup
cleanup_task: Optional[asyncio.Task[None]] = None


async def cleanup_connection_tracking() -> None:
    """Periodic cleanup of connection tracking data"""
    while True:
        try:
            current_time = datetime.now()
            # Clean up old rate limit entries
            for identifier in list(connection_tracker.keys()):
                if (
                    current_time - connection_tracker[identifier]["last_reset"]
                    > CONNECTION_WINDOW * 2
                ):
                    del connection_tracker[identifier]

            # Clean up empty user connection sets
            for user_id in list(user_connections.keys()):
                if not user_connections[user_id]:
                    del user_connections[user_id]

            await asyncio.sleep(300)  # Clean up every 5 minutes
        except Exception as e:
            logger.error(f"Connection tracking cleanup error: {str(e)}")
            await asyncio.sleep(300)


async def get_or_create_cleanup_task() -> Optional[asyncio.Task[None]]:
    """Lazy initialization of cleanup task"""
    global cleanup_task
    if cleanup_task is None:
        try:
            cleanup_task = asyncio.create_task(cleanup_connection_tracking())
        except RuntimeError:
            # Event loop not running yet
            pass
    return cleanup_task


# CORS configuration
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8081",
    "https://fynlo.com",
    "https://www.fynlo.com",
    "https://api.fynlo.com",
    "https://fynlo.co.uk",
    "https://www.fynlo.co.uk",
    "https://api.fynlo.co.uk",
    "fynlo://",  # Mobile app scheme
]


def validate_uuid(value: str) -> bool:
    """Validate UUID format or special values"""
    if value == "onboarding":
        return True
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def validate_origin(origin: Optional[str]) -> bool:
    """Validate WebSocket origin"""
    if not origin:
        return True  # Allow mobile apps without origin

    # Exact match for production origins
    if origin in ALLOWED_ORIGINS:
        return True

    # For development, check more carefully
    if settings.ENVIRONMENT in ["development", "testing"]:
        # Parse the origin to ensure it's not a subdomain attack
        if origin.startswith("http://localhost:") or origin.startswith(
            "http://127.0.0.1:"
        ):
            return True

    return False


async def check_rate_limit(identifier: str) -> bool:
    """Check WebSocket connection rate limit"""
    current_time = datetime.now()

    if current_time - connection_tracker[identifier]["last_reset"] > CONNECTION_WINDOW:
        connection_tracker[identifier] = {"count": 0, "last_reset": current_time}

    if connection_tracker[identifier]["count"] >= MAX_CONNECTIONS_PER_IP:
        logger.warning(f"Rate limit exceeded for {identifier}")
        return False

    connection_tracker[identifier]["count"] += 1
    return True


async def check_connection_limit(user_id: str) -> bool:
    """Check if user has reached connection limit"""
    if len(user_connections[user_id]) >= MAX_CONNECTIONS_PER_USER:
        logger.warning(f"Connection limit exceeded for user {user_id}")
        return False
    return True


def sanitize_message_data(data: Any, depth: int = 0, max_depth: int = 10) -> Any:
    """Sanitize all string values in message data while preserving key types"""
    if depth > max_depth:
        logger.warning("Max recursion depth reached in sanitize_message_data")
        return data
    if isinstance(data, dict):
        # Preserve key types, only sanitize string values
        return {
            k: sanitize_message_data(v, depth + 1, max_depth) for k, v in data.items()
        }
    elif isinstance(data, list):
        return [sanitize_message_data(item, depth + 1, max_depth) for item in data]
    elif isinstance(data, str):
        return sanitize_string(data, max_length=1000)
    else:
        return data


async def perform_security_checks(
    websocket: WebSocket, user_id: Optional[str] = None
) -> bool:
    """Perform standard security checks for WebSocket connections"""
    # Check origin validation
    origin = websocket.headers.get("origin")
    if not validate_origin(origin):
        logger.warning(
            f"Invalid origin: {sanitize_string(str(origin), max_length=100)}"
        )
        await websocket.close(code=4001, reason="Unauthorized")
        return False

    # Get client IP
    client_host = websocket.client.host if websocket.client else "unknown"

    # Use new rate limiter
    limiter = await get_rate_limiter()

    # Check connection rate limit
    allowed, error_msg = await limiter.check_connection_limit(client_host, user_id)
    if not allowed:
        # Log rate limit violation
        await security_monitor.log_rate_limit_violation(
            ip_address=client_host,
            user_id=user_id,
            limit_type="websocket_connection",
            details={"error": error_msg},
        )
        await websocket.close(code=4008, reason=error_msg)
        return False

    return True


async def verify_websocket_access(
    restaurant_id: str,
    user_id: Optional[str] = None,
    token: Optional[str] = None,
    connection_type: str = "pos",
    db: Session = None,
) -> Tuple[bool, Optional[User]]:
    """Verify WebSocket access permissions with Supabase token validation
    Returns (has_access, user_object)
    """
    try:
        # Validate database session
        if not db:
            logger.error("Database session not provided to verify_websocket_access")
            return False, None
        # Validate restaurant_id format
        if not validate_uuid(restaurant_id):
            logger.error(
                "Invalid restaurant_id format: %s",
                sanitize_string(str(restaurant_id), max_length=50),
            )
            return False, None

        # Special case for onboarding users without restaurants
        if restaurant_id == "onboarding":
            # For onboarding, we only need valid user authentication
            if not user_id or not token:
                return False, None
            # Skip restaurant verification for onboarding
        else:
            # Verify restaurant exists for normal connections
            restaurant = (
                db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
            )
            if not restaurant or not restaurant.is_active:
                logger.warning(
                    "Restaurant not found or inactive: %s",
                    sanitize_string(str(restaurant_id), max_length=50),
                )
                return False, None

        # Verify user authentication if user_id provided
        if user_id:
            # Token is REQUIRED for authenticated connections
            if not token:
                return False, None

            # Validate the token with Supabase
            try:
                # Verify token with Supabase Admin API
                if not supabase_admin:
                    logger.error("Supabase admin client not initialized")
                    return False, None

                user_response = supabase_admin.auth.get_user(token)
                supabase_user = user_response.user

                if not supabase_user:
                    logger.error("Invalid Supabase token - no user found")
                    return False, None

                # Find user in our database by supabase_id
                user = (
                    db.query(User).filter(User.supabase_id == supabase_user.id).first()
                )
                if not user:
                    # Check by email for backward compatibility
                    user = (
                        db.query(User).filter(User.email == supabase_user.email).first()
                    )
                    if user and not user.supabase_id:
                        # Update the supabase_id if missing with proper error handling
                        try:
                            user.supabase_id = supabase_user.id
                            db.commit()
                            logger.info(
                                f"Updated user {user.id} with Supabase ID during WebSocket auth"
                            )
                        except Exception as e:
                            logger.error(f"Failed to update user supabase_id: {str(e)}")
                            db.rollback()
                            # Continue with authentication even if update fails

                if not user:
                    logger.error("User not found in database for supabase_id")
                    return False, None

                # Verify the user is active
                if not user.is_active:
                    logger.warning(
                        "User is not active: %s",
                        sanitize_string(str(user.id), max_length=50),
                    )
                    return False, None

                # Verify user_id matches (critical security check)
                if str(user.id) != str(user_id):
                    logger.error("User ID mismatch - potential security violation")
                    return False, None

            except Exception as e:
                logger.error(f"Supabase token validation error: {str(e)}")
                return False, None

            # Check if user has access to this restaurant
            if restaurant_id == "onboarding":
                # For onboarding connections, allow any authenticated user
                logger.info(f"Onboarding connection for user: {user.id}")
            elif user.role == "restaurant_owner":
                # Handle restaurant owners
                if not user.restaurant_id:
                    # Restaurant owner without a restaurant - they're in onboarding
                    if restaurant_id != "onboarding":
                        logger.warning(
                            "Restaurant owner without restaurant trying to access "
                            "non-onboarding endpoint"
                        )
                        return False, None
                    logger.info(
                        "Restaurant owner in onboarding phase (no restaurant yet)"
                    )
                elif (
                    str(user.restaurant_id) != restaurant_id
                    and restaurant_id != "onboarding"
                ):
                    logger.warning(
                        "Restaurant owner access denied - restaurant mismatch"
                    )
                    return False, None
            elif user.role == "platform_owner":
                # Platform owners have access to all restaurants
                pass
            elif user.role in ["manager", "employee"]:
                if not user.restaurant_id:
                    logger.warning("Staff member without restaurant assignment")
                    return False, None
                if str(user.restaurant_id) != restaurant_id:
                    logger.warning("Staff access denied - restaurant mismatch")
                    return False, None

        # CRITICAL SECURITY FIX: Always require authentication
        # If no user_id provided, deny access
        if not user_id:
            logger.warning("WebSocket connection attempted without user_id")
            # Log security event for monitoring
            await security_monitor.log_suspicious_activity(
                event_type="websocket_auth_bypass_attempt",
                details={
                    "restaurant_id": restaurant_id,
                    "connection_type": connection_type,
                    "error": "Missing user_id",
                },
            )
            return False, None

        return True, user

    except Exception as e:
        logger.error(f"WebSocket access verification error: {str(e)}")
        return False, None


@router.websocket("/ws/{restaurant_id}")
async def websocket_endpoint_general(
    websocket: WebSocket,
    restaurant_id: str = Path(..., description="Restaurant ID"),
    user_id: Optional[str] = Query(None, description="User ID"),
    connection_type: str = Query("pos", description="Connection type"),
    db: Session = Depends(get_db),
):
    """
    General WebSocket endpoint for restaurant updates
    Supports POS terminals, management dashboards, and customer displays
    """
    connection_id = None
    verified_user = None

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

        # Rate limiting
        client_host = websocket.client.host if websocket.client else "unknown"
        rate_limit_identifier = f"ws:{user_id or client_host}"
        if not await check_rate_limit(rate_limit_identifier):
            await websocket.close(code=4008, reason="Too many requests")
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
        elif verified_user and not await check_connection_limit(str(verified_user.id)):
            await websocket.close(code=4009, reason="Connection limit exceeded")
            return

        # Determine connection type
        conn_type = ConnectionType.POS
        if connection_type == "kitchen":
            conn_type = ConnectionType.KITCHEN
        elif connection_type == "management":
            conn_type = ConnectionType.MANAGEMENT
        elif connection_type == "customer":
            conn_type = ConnectionType.CUSTOMER

        # Get user roles from verified user
        roles = []
        if verified_user:
            roles = [verified_user.role]

        # Connect to WebSocket manager
        connection_id = await websocket_manager.connect(
            websocket=websocket,
            restaurant_id=restaurant_id,
            user_id=str(verified_user.id) if verified_user else user_id,
            connection_type=conn_type,
            roles=roles,
        )

        # Register connection with rate limiter
        limiter = await get_rate_limiter()
        final_user_id = str(verified_user.id) if verified_user else user_id
        await limiter.register_connection(connection_id, final_user_id, client_host)

        # Track user connection (use original user_id if provided)
        if user_id:
            user_connections[user_id].add(connection_id)
        elif verified_user:
            user_connections[str(verified_user.id)].add(connection_id)

        # Handle incoming messages
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()

                # Check message rate limit
                message_size = len(data.encode("utf-8"))
                allowed, error_msg = await limiter.check_message_rate(
                    connection_id, message_size
                )
                if not allowed:
                    # Log rate limit violation
                    await security_monitor.log_rate_limit_violation(
                        ip_address=client_host,
                        user_id=final_user_id,
                        limit_type="websocket_messages",
                        details={"error": error_msg, "message_size": message_size},
                    )
                    await websocket.send_text(
                        json.dumps({"type": "error", "message": error_msg})
                    )
                    continue

                message_data = json.loads(data)

                # Sanitize message data
                message_data = sanitize_message_data(message_data)

                # Handle different message types
                message_type = message_data.get("type")

                if message_type == "pong":
                    # Handle pong response
                    continue
                elif message_type == "subscribe":
                    # Handle event subscription
                    await handle_subscription(connection_id, message_data)
                elif message_type == "unsubscribe":
                    # Handle event unsubscription
                    await handle_unsubscription(connection_id, message_data)
                elif message_type == "ping":
                    # Send pong response
                    await websocket.send_text(
                        json.dumps(
                            {"type": "pong", "timestamp": datetime.now().isoformat()}
                        )
                    )
                else:
                    # Log unknown message type
                    logger.warning(
                        "Unknown message type received: %s",
                        sanitize_string(str(message_type), max_length=50),
                    )
                    await websocket.send_text(
                        json.dumps({"type": "error", "message": "Unknown message type"})
                    )

            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {str(e)}")
                await websocket.send_text(
                    json.dumps({"type": "error", "message": "Invalid message format"})
                )
            except Exception as e:
                logger.error(f"WebSocket message processing error: {str(e)}")
                await websocket.send_text(
                    json.dumps(
                        {"type": "error", "message": "Message processing failed"}
                    )
                )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WebSocket connection error: %s", str(e))
        try:
            await websocket.close(code=4000, reason="Connection error")
        except BaseException:
            pass
    finally:
        # Clean up user connection tracking first (synchronous operation)
        if connection_id:
            if user_id:
                user_connections[user_id].discard(connection_id)
            if verified_user:
                user_connections[str(verified_user.id)].discard(connection_id)

            # Unregister from rate limiter
            try:
                limiter = await get_rate_limiter()
                # Use verified_user.id if available, otherwise user_id
                final_user_id = str(verified_user.id) if verified_user else user_id
                await limiter.unregister_connection(connection_id, final_user_id)
            except Exception as e:
                logger.error(f"Error unregistering connection from rate limiter: {e}")

        # Then disconnect from websocket manager (async operation that might fail)
        if connection_id:
            try:
                await websocket_manager.disconnect(connection_id)
            except Exception as cleanup_error:
                logger.error("Error during websocket cleanup: %s", str(cleanup_error))


@router.websocket("/ws/kitchen/{restaurant_id}")
async def websocket_kitchen_endpoint(
    websocket: WebSocket,
    restaurant_id: str = Path(..., description="Restaurant ID"),
    user_id: Optional[str] = Query(None, description="User ID"),
    db: Session = Depends(get_db),
):
    """
    Kitchen-specific WebSocket endpoint
    Receives order updates, preparation status, and kitchen notifications
    """
    connection_id = None
    verified_user = None

    # Ensure cleanup task is running
    await get_or_create_cleanup_task()

    try:
        # Perform security checks first
        if not await perform_security_checks(websocket, user_id):
            return

        # Get token from query parameters
        token = websocket.query_params.get("token")

        # Verify access with token validation
        has_access, verified_user = await verify_websocket_access(
            restaurant_id, user_id, token, "kitchen", db
        )
        if not has_access:
            await websocket.close(code=4003, reason="Access denied")
            return

        # Check connection limits for authenticated users
        if user_id and not await check_connection_limit(user_id):
            await websocket.close(code=4009, reason="Connection limit exceeded")
            return
        elif verified_user and not await check_connection_limit(str(verified_user.id)):
            await websocket.close(code=4009, reason="Connection limit exceeded")
            return

        # Get user roles from verified_user (no redundant query)
        roles = []
        if verified_user:
            roles = [verified_user.role]

        # Connect with kitchen-specific type
        connection_id = await websocket_manager.connect(
            websocket=websocket,
            restaurant_id=restaurant_id,
            user_id=str(verified_user.id) if verified_user else user_id,
            connection_type=ConnectionType.KITCHEN,
            roles=roles,
        )

        # Track user connection
        if user_id:
            user_connections[user_id].add(connection_id)
        elif verified_user:
            user_connections[str(verified_user.id)].add(connection_id)

        # Send kitchen-specific welcome message
        welcome_message = WebSocketMessage(
            event_type=EventType.SYSTEM_NOTIFICATION,
            data={
                "type": "kitchen_connected",
                "message": "Kitchen display connected successfully",
                "features": [
                    "order_notifications",
                    "status_updates",
                    "preparation_times",
                ],
            },
            restaurant_id=restaurant_id,
            user_id=user_id,
        )

        await websocket_manager.send_to_connection(connection_id, welcome_message)

        # Handle kitchen-specific messages
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)

                message_type = message_data.get("type")

                if message_type == "order_status_update":
                    await handle_kitchen_status_update(
                        connection_id, restaurant_id, message_data, db
                    )
                elif message_type == "preparation_time_update":
                    await handle_preparation_time_update(
                        connection_id, restaurant_id, message_data, db
                    )
                elif message_type == "ping":
                    await websocket.send_text(
                        json.dumps(
                            {"type": "pong", "timestamp": datetime.now().isoformat()}
                        )
                    )

            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "message": "Invalid JSON format in kitchen message",
                        }
                    )
                )
            except Exception as e:
                logger.error(f"Kitchen message processing error: {str(e)}")
                await websocket.send_text(
                    json.dumps(
                        {"type": "error", "message": "Message processing failed"}
                    )
                )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Kitchen connection error: {str(e)}")
        try:
            await websocket.close(code=4000, reason="Connection error")
        except BaseException:
            pass
    finally:
        # Clean up user connection tracking first (synchronous operation)
        if connection_id:
            if user_id:
                user_connections[user_id].discard(connection_id)
            if verified_user:
                user_connections[str(verified_user.id)].discard(connection_id)

            # Unregister from rate limiter
            try:
                limiter = await get_rate_limiter()
                # Use verified_user.id if available, otherwise user_id
                final_user_id = str(verified_user.id) if verified_user else user_id
                await limiter.unregister_connection(connection_id, final_user_id)
            except Exception as e:
                logger.error(f"Error unregistering connection from rate limiter: {e}")

        # Then disconnect from websocket manager (async operation that might fail)
        if connection_id:
            try:
                await websocket_manager.disconnect(connection_id)
            except Exception as cleanup_error:
                logger.error("Error during websocket cleanup: %s", str(cleanup_error))


@router.websocket("/ws/pos/{restaurant_id}")
async def websocket_pos_endpoint(
    websocket: WebSocket,
    restaurant_id: str = Path(..., description="Restaurant ID"),
    user_id: Optional[str] = Query(None, description="User ID"),
    db: Session = Depends(get_db),
):
    """
    POS-specific WebSocket endpoint
    Handles order updates, payment notifications, and inventory alerts
    """
    connection_id = None
    verified_user = None

    # Ensure cleanup task is running
    await get_or_create_cleanup_task()

    try:
        # Perform security checks first
        if not await perform_security_checks(websocket, user_id):
            return

        # Get token from query parameters
        token = websocket.query_params.get("token")

        # Verify access with token validation
        has_access, verified_user = await verify_websocket_access(
            restaurant_id, user_id, token, "pos", db
        )
        if not has_access:
            await websocket.close(code=4003, reason="Access denied")
            return

        # Check connection limits for authenticated users
        if user_id and not await check_connection_limit(user_id):
            await websocket.close(code=4009, reason="Connection limit exceeded")
            return
        elif verified_user and not await check_connection_limit(str(verified_user.id)):
            await websocket.close(code=4009, reason="Connection limit exceeded")
            return

        # Get user roles from verified_user (no redundant query)
        roles = []
        if verified_user:
            roles = [verified_user.role]

        # Connect with POS-specific type
        connection_id = await websocket_manager.connect(
            websocket=websocket,
            restaurant_id=restaurant_id,
            user_id=str(verified_user.id) if verified_user else user_id,
            connection_type=ConnectionType.POS,
            roles=roles,
        )

        # Track user connection
        if user_id:
            user_connections[user_id].add(connection_id)
        elif verified_user:
            user_connections[str(verified_user.id)].add(connection_id)

        # Send POS-specific welcome message
        welcome_message = WebSocketMessage(
            event_type=EventType.SYSTEM_NOTIFICATION,
            data={
                "type": "pos_connected",
                "message": "POS terminal connected successfully",
                "features": [
                    "order_updates",
                    "payment_notifications",
                    "inventory_alerts",
                ],
            },
            restaurant_id=restaurant_id,
            user_id=user_id,
        )

        await websocket_manager.send_to_connection(connection_id, welcome_message)

        # Handle POS messages
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)

                message_type = message_data.get("type")

                if message_type == "order_created":
                    await handle_pos_order_created(
                        connection_id, restaurant_id, message_data, db
                    )
                elif message_type == "payment_processed":
                    await handle_pos_payment_processed(
                        connection_id, restaurant_id, message_data, db
                    )
                elif message_type == "ping":
                    await websocket.send_text(
                        json.dumps(
                            {"type": "pong", "timestamp": datetime.now().isoformat()}
                        )
                    )

            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "message": "Invalid JSON format in POS message",
                        }
                    )
                )
            except Exception as e:
                logger.error(f"POS message processing error: {str(e)}")
                await websocket.send_text(
                    json.dumps(
                        {"type": "error", "message": "Message processing failed"}
                    )
                )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"POS connection error: {str(e)}")
        try:
            await websocket.close(code=4000, reason="Connection error")
        except BaseException:
            pass
    finally:
        # Clean up user connection tracking first (synchronous operation)
        if connection_id:
            if user_id:
                user_connections[user_id].discard(connection_id)
            if verified_user:
                user_connections[str(verified_user.id)].discard(connection_id)

            # Unregister from rate limiter
            try:
                limiter = await get_rate_limiter()
                # Use verified_user.id if available, otherwise user_id
                final_user_id = str(verified_user.id) if verified_user else user_id
                await limiter.unregister_connection(connection_id, final_user_id)
            except Exception as e:
                logger.error(f"Error unregistering connection from rate limiter: {e}")

        # Then disconnect from websocket manager (async operation that might fail)
        if connection_id:
            try:
                await websocket_manager.disconnect(connection_id)
            except Exception as cleanup_error:
                logger.error("Error during websocket cleanup: %s", str(cleanup_error))


@router.websocket("/ws/management/{restaurant_id}")
async def websocket_management_endpoint(
    websocket: WebSocket,
    restaurant_id: str = Path(..., description="Restaurant ID"),
    user_id: Optional[str] = Query(None, description="User ID"),
    db: Session = Depends(get_db),
):
    """
    Management dashboard WebSocket endpoint
    Provides real-time analytics, alerts, and system status
    """
    connection_id = None
    verified_user = None

    # Ensure cleanup task is running
    await get_or_create_cleanup_task()

    try:
        # Perform security checks first
        if not await perform_security_checks(websocket, user_id):
            return

        # Get token from query parameters
        token = websocket.query_params.get("token")

        # Verify management access with token validation
        has_access, verified_user = await verify_websocket_access(
            restaurant_id, user_id, token, "management", db
        )
        if not has_access:
            await websocket.close(code=4003, reason="Access denied")
            return

        # Verify user has management permissions (using verified_user, no redundant query)
        if not verified_user:
            # Management endpoint requires authentication
            await websocket.close(code=4003, reason="Authentication required")
            return

        if verified_user.role not in ["restaurant_owner", "platform_owner", "manager"]:
            await websocket.close(code=4003, reason="Management access required")
            return

        # Check connection limits for authenticated users
        if user_id and not await check_connection_limit(user_id):
            await websocket.close(code=4009, reason="Connection limit exceeded")
            return
        elif verified_user and not await check_connection_limit(str(verified_user.id)):
            await websocket.close(code=4009, reason="Connection limit exceeded")
            return

        # Connect with management-specific type
        connection_id = await websocket_manager.connect(
            websocket=websocket,
            restaurant_id=restaurant_id,
            user_id=str(verified_user.id) if verified_user else user_id,
            connection_type=ConnectionType.MANAGEMENT,
            roles=[verified_user.role] if verified_user else [],
        )

        # Track user connection
        if user_id:
            user_connections[user_id].add(connection_id)
        elif verified_user:
            user_connections[str(verified_user.id)].add(connection_id)

        # Send management dashboard data
        welcome_message = WebSocketMessage(
            event_type=EventType.SYSTEM_NOTIFICATION,
            data={
                "type": "management_connected",
                "message": "Management dashboard connected",
                "features": [
                    "real_time_analytics",
                    "system_alerts",
                    "performance_metrics",
                ],
            },
            restaurant_id=restaurant_id,
            user_id=user_id,
        )

        await websocket_manager.send_to_connection(connection_id, welcome_message)

        # Handle management messages
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)

                message_type = message_data.get("type")

                if message_type == "request_analytics":
                    await handle_analytics_request(
                        connection_id, restaurant_id, message_data, db
                    )
                elif message_type == "ping":
                    await websocket.send_text(
                        json.dumps(
                            {"type": "pong", "timestamp": datetime.now().isoformat()}
                        )
                    )

            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "message": "Invalid JSON format in management message",
                        }
                    )
                )
            except Exception as e:
                logger.error(f"Management message processing error: {str(e)}")
                await websocket.send_text(
                    json.dumps(
                        {"type": "error", "message": "Message processing failed"}
                    )
                )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Management connection error: {str(e)}")
        try:
            await websocket.close(code=4000, reason="Connection error")
        except BaseException:
            pass
    finally:
        # Clean up user connection tracking first (synchronous operation)
        if connection_id:
            if user_id:
                user_connections[user_id].discard(connection_id)
            if verified_user:
                user_connections[str(verified_user.id)].discard(connection_id)

            # Unregister from rate limiter
            try:
                limiter = await get_rate_limiter()
                # Use verified_user.id if available, otherwise user_id
                final_user_id = str(verified_user.id) if verified_user else user_id
                await limiter.unregister_connection(connection_id, final_user_id)
            except Exception as e:
                logger.error(f"Error unregistering connection from rate limiter: {e}")

        # Then disconnect from websocket manager (async operation that might fail)
        if connection_id:
            try:
                await websocket_manager.disconnect(connection_id)
            except Exception as cleanup_error:
                logger.error("Error during websocket cleanup: %s", str(cleanup_error))


# Message handlers


async def handle_subscription(connection_id: str, message_data: dict) -> None:
    """Handle event subscription requests"""
    try:
        # Store subscription preferences for this connection
        # This would be implemented based on specific requirements
        # events = message_data.get("events", [])
        # response = {
        #     "type": "subscription_confirmed",
        #     "events": events,
        #     "message": f"Subscribed to {len(events)} event types",
        # }

        # Send confirmation (implementation would depend on WebSocket manager)
        pass

    except Exception as e:
        logger.error(f"Subscription error: {str(e)}")


async def handle_unsubscription(connection_id: str, message_data: dict) -> None:
    """Handle event unsubscription requests"""
    try:
        # events = message_data.get("events", [])
        # Remove subscription preferences for this connection
        # Implementation would depend on specific requirements
        pass

    except Exception as e:
        logger.error(f"Unsubscription error: {str(e)}")


async def handle_kitchen_status_update(
    connection_id: str, restaurant_id: str, message_data: dict, db: Session
) -> None:
    """Handle kitchen status updates"""
    try:
        order_id = message_data.get("order_id")
        new_status = message_data.get("status")

        if not order_id or not new_status:
            return

        # Validate order_id is UUID
        if not validate_uuid(str(order_id)):
            logger.warning("Invalid order_id format in kitchen status update")
            return

        # Validate status value
        valid_statuses = [
            "pending",
            "confirmed",
            "preparing",
            "ready",
            "completed",
            "cancelled",
        ]
        if new_status not in valid_statuses:
            logger.warning("Invalid status value in kitchen status update")
            return

        # Broadcast status update to all relevant connections
        update_message = WebSocketMessage(
            event_type=EventType.ORDER_STATUS_CHANGED,
            data={
                "order_id": order_id,
                "new_status": new_status,
                "updated_by": "kitchen",
                "updated_at": datetime.now().isoformat(),
            },
            restaurant_id=restaurant_id,
            connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT],
        )

        await websocket_manager.broadcast_to_restaurant(
            restaurant_id,
            update_message,
            connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT],
        )

    except Exception as e:
        logger.error(f"Kitchen status update error: {str(e)}")


async def handle_preparation_time_update(
    connection_id: str, restaurant_id: str, message_data: dict, db: Session
) -> None:
    """Handle preparation time updates"""
    try:
        order_id = message_data.get("order_id")
        estimated_time = message_data.get("estimated_time")

        if not order_id or not estimated_time:
            return

        # Validate order_id is UUID
        if not validate_uuid(str(order_id)):
            logger.warning("Invalid order_id format in preparation time update")
            return

        # Validate estimated_time is reasonable (1-300 minutes)
        try:
            time_int = int(estimated_time)
            if time_int < 1 or time_int > 300:
                logger.warning(f"Invalid estimated time value: {time_int}")
                return
        except (ValueError, TypeError):
            logger.warning("Invalid estimated time format")
            return

        # Broadcast preparation time update
        time_message = WebSocketMessage(
            event_type=EventType.KITCHEN_UPDATE,
            data={
                "order_id": order_id,
                "update_type": "preparation_time",
                "estimated_time": estimated_time,
                "updated_at": datetime.now().isoformat(),
            },
            restaurant_id=restaurant_id,
            connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT],
        )

        await websocket_manager.broadcast_to_restaurant(
            restaurant_id,
            time_message,
            connection_types=[ConnectionType.POS, ConnectionType.MANAGEMENT],
        )

    except Exception as e:
        logger.error(f"Preparation time update error: {str(e)}")


async def handle_pos_order_created(
    connection_id: str, restaurant_id: str, message_data: dict, db: Session
) -> None:
    """Handle new order from POS"""
    try:
        order_data = message_data.get("order", {})

        # Broadcast new order to kitchen and management
        order_message = WebSocketMessage(
            event_type=EventType.ORDER_CREATED,
            data=order_data,
            restaurant_id=restaurant_id,
            connection_types=[ConnectionType.KITCHEN, ConnectionType.MANAGEMENT],
        )

        await websocket_manager.broadcast_to_restaurant(
            restaurant_id,
            order_message,
            connection_types=[ConnectionType.KITCHEN, ConnectionType.MANAGEMENT],
        )

    except Exception as e:
        logger.error(f"POS order created error: {str(e)}")


async def handle_pos_payment_processed(
    connection_id: str, restaurant_id: str, message_data: dict, db: Session
) -> None:
    """Handle payment processing from POS"""
    try:
        payment_data = message_data.get("payment", {})

        # Broadcast payment completion
        payment_message = WebSocketMessage(
            event_type=EventType.PAYMENT_COMPLETED,
            data=payment_data,
            restaurant_id=restaurant_id,
            connection_types=[ConnectionType.MANAGEMENT],
        )

        await websocket_manager.broadcast_to_restaurant(
            restaurant_id, payment_message, connection_types=[ConnectionType.MANAGEMENT]
        )

    except Exception as e:
        logger.error(f"POS payment processed error: {str(e)}")


async def handle_analytics_request(
    connection_id: str, restaurant_id: str, message_data: dict, db: Session
) -> None:
    """Handle real-time analytics requests"""
    try:
        # This would fetch real-time analytics data
        # For now, send a placeholder response
        # analytics_type = message_data.get("analytics_type", "dashboard")
        # analytics_data = {
        #     "type": "analytics_data",
        #     "analytics_type": analytics_type,
        #     "data": {
        #         "timestamp": datetime.now().isoformat(),
        #         "message": "Analytics data would be provided here",
        #     },
        # }

        # Send analytics data to requesting connection
        # Implementation would depend on specific analytics requirements
        pass

    except Exception as e:
        logger.error(f"Analytics request error: {str(e)}")


# REST endpoints for WebSocket management


@router.get("/stats")
async def get_websocket_stats(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get WebSocket connection statistics"""
    try:
        # Only allow managers and owners to view stats
        if current_user.role not in ["restaurant_owner", "platform_owner", "manager"]:
            raise FynloException(
                message="Access denied - management permissions required",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403,
            )

        stats = websocket_manager.get_connection_stats()

        return APIResponseHelper.success(
            data=stats, message="WebSocket statistics retrieved successfully"
        )

    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve WebSocket statistics: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500,
        )


@router.post("/broadcast/{restaurant_id}")
async def broadcast_message(
    restaurant_id: str = Path(..., description="Restaurant ID"),
    message: dict = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Broadcast message to all connections in a restaurant"""
    try:
        # Verify permissions
        if current_user.role not in ["restaurant_owner", "platform_owner", "manager"]:
            raise FynloException(
                message="Access denied - management permissions required",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403,
            )

        # Verify restaurant access
        restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
        if not restaurant:
            raise FynloException(
                message="Restaurant not found",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404,
            )

        # Create broadcast message
        broadcast_msg = WebSocketMessage(
            event_type=EventType.SYSTEM_NOTIFICATION,
            data={
                "type": "admin_broadcast",
                "message": message.get("message", "System notification"),
                "priority": message.get("priority", "normal"),
                "sent_by": current_user.username,
            },
            restaurant_id=restaurant_id,
            user_id=str(current_user.id),
        )

        await websocket_manager.broadcast_to_restaurant(restaurant_id, broadcast_msg)

        return APIResponseHelper.success(
            message="Message broadcasted successfully",
            meta={"restaurant_id": restaurant_id},
        )

    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to broadcast message: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500,
        )
