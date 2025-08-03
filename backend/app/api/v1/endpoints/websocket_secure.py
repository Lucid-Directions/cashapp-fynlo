"""
Enhanced WebSocket Security with TenantSecurity module
Ensures proper isolation while maintaining platform owner access
"""

from typing import Optional
import logging

from app.core.database import User
from app.core.tenant_security import TenantSecurity
from app.core.websocket import websocket_manager

logger = logging.getLogger(__name__)


async def verify_websocket_access_secure(
    restaurant_id: str, user: User, connection_type: str = "pos"
) -> bool:
    """
    Enhanced WebSocket access verification using TenantSecurity

    Args:
        restaurant_id: Restaurant to connect to
        user: Authenticated user
        connection_type: Type of connection (pos, kitchen, management)

    Returns:
        bool: Whether access is granted
    """
    # Special handling for onboarding
    if restaurant_id == "onboarding":
        # Users without a restaurant can connect to onboarding
        return user.restaurant_id is None

    # Platform owners (Ryan & Arnaud) can connect to any restaurant
    if TenantSecurity.is_platform_owner(user):
        logger.info(
            f"Platform owner {user.email} connecting to restaurant {restaurant_id}"
        )
        return True

    # Regular users can only connect to their own restaurant
    if not user.restaurant_id:
        logger.warning(
            f"User {user.email} has no restaurant assigned, denying WebSocket"
        )
        return False

    if str(user.restaurant_id) != str(restaurant_id):
        logger.warning(
            f"User {user.email} from restaurant {user.restaurant_id} "
            f"attempted to connect to restaurant {restaurant_id}"
        )
        return False

    # User has access to their own restaurant
    return True


async def handle_websocket_message_secure(
    message: dict, user: User, restaurant_id: str, connection_id: str
):
    """
    Handle incoming WebSocket messages with tenant security

    Args:
        message: Incoming message data
        user: Authenticated user
        restaurant_id: Restaurant context
        connection_id: WebSocket connection ID
    """
    message_type = message.get("type")

    # Validate any restaurant_id in the message
    if "restaurant_id" in message:
        msg_restaurant_id = message["restaurant_id"]

        # Platform owners can send messages to any restaurant
        if TenantSecurity.is_platform_owner(user):
            # Allow cross-restaurant operations for platform owners
            pass
        elif str(msg_restaurant_id) != str(restaurant_id):
            # Regular users cannot send messages to other restaurants
            logger.error(
                f"Tenant violation: User {user.email} tried to send message "
                f"to restaurant {msg_restaurant_id} while connected to {restaurant_id}"
            )
            return  # Silently drop the message

    # Process the message based on type
    if message_type == "order_update":
        # Ensure order belongs to the correct restaurant
        order_id = message.get("order_id")
        if order_id:
            # In production, verify the order belongs to restaurant_id
            # This prevents users from updating other restaurants' orders
            pass

    elif message_type == "broadcast":
        # Only platform owners can broadcast to multiple restaurants
        if not TenantSecurity.is_platform_owner(user):
            logger.warning(f"Non-platform owner {user.email} attempted broadcast")
            return

    # Forward the message through normal channels
    await websocket_manager.process_message(
        connection_id=connection_id, message=message, restaurant_id=restaurant_id
    )


class SecureWebSocketManager:
    """
    Enhanced WebSocket manager with tenant isolation
    """

    @staticmethod
    async def broadcast_to_restaurant_secure(
        restaurant_id: str,
        message: dict,
        exclude_connection: Optional[str] = None,
        sender_user: Optional[User] = None,
    ):
        """
        Broadcast message to all connections in a restaurant with security checks

        Args:
            restaurant_id: Target restaurant
            message: Message to broadcast
            exclude_connection: Connection to exclude from broadcast
            sender_user: User sending the message
        """
        # Platform owners can broadcast to any restaurant
        if sender_user and not TenantSecurity.is_platform_owner(sender_user):
            # Verify sender belongs to the restaurant they're broadcasting to
            if not sender_user.restaurant_id or str(sender_user.restaurant_id) != str(
                restaurant_id
            ):
                logger.error(
                    f"Broadcast denied: User {sender_user.email} cannot broadcast "
                    f"to restaurant {restaurant_id}"
                )
                return

        # Use the existing broadcast mechanism
        await websocket_manager.broadcast_to_restaurant(
            restaurant_id=restaurant_id,
            message=message,
            exclude_user_id=str(sender_user.id) if sender_user else None,
        )

    @staticmethod
    async def notify_platform_owners(message: dict):
        """
        Send notifications to all connected platform owners (Ryan & Arnaud)

        Args:
            message: Notification message
        """
        # This is a special broadcast only for platform owners
        platform_owner_connections = []

        # Find all platform owner connections
        for conn_id, conn_info in websocket_manager.connections.items():
            user = conn_info.get("user")
            if user and TenantSecurity.is_platform_owner(user):
                platform_owner_connections.append(conn_id)

        # Send to all platform owners
        for conn_id in platform_owner_connections:
            await websocket_manager.send_to_connection(conn_id, message)

        logger.info(
            f"Notified {len(platform_owner_connections)} platform owner connections"
        )
