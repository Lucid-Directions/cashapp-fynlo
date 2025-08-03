"""
RLS (Row Level Security) Middleware for Fynlo POS
Automatically sets session variables for database RLS policies
"""

from fastapi import Request, Depends
from starlette.middleware.base import BaseHTTPMiddleware
import logging
from typing import Optional

from app.core.database import RLSContext
from app.core.auth import get_current_user
from app.core.database import User

logger = logging.getLogger(__name__)


class RLSMiddleware(BaseHTTPMiddleware):
    """
    Middleware to automatically set RLS context based on authenticated user.
    This ensures that all database queries in a request have proper tenant isolation.
    """

    async def dispatch(self, request: Request, call_next):
        # Skip RLS for public endpoints
        if self._is_public_endpoint(request.url.path):
            return await call_next(request)

        # Try to extract user from request
        # Note: This is a simplified version. In production, you might want to
        # extract the token and validate it here, or use a different approach
        # based on your authentication flow.

        try:
            # For authenticated endpoints, the user will be set by the auth dependency
            # We'll let the dependency injection handle it, but we can set up
            # a request state for later use
            request.state.rls_context = None

            response = await call_next(request)

            # Clear RLS context after request
            RLSContext.clear()

            return response

        except Exception as e:
            # Always clear RLS context on error
            RLSContext.clear()
            logger.error(f"Error in RLS middleware: {e}")
            raise

    def _is_public_endpoint(self, path: str) -> bool:
        """Check if endpoint is public and doesn't need RLS"""
        public_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/verify",
            "/api/v1/public",
            "/health",
            "/metrics",
        ]

        return any(path.startswith(p) for p in public_paths)


async def set_rls_context(
    request: Request, current_user: User = Depends(get_current_user)
):
    """
    Dependency to set RLS context for the current request.
    Use this in your route handlers to ensure RLS is properly configured.

    Example:
        @router.get("/orders")
        async def get_orders(
            db: Session = Depends(get_db),
            _rls: None = Depends(set_rls_context),
            current_user: User = Depends(get_current_user)
        ):
            # RLS context is automatically set based on current_user
            # All queries will be filtered by user's restaurant_id
    """
    if current_user:
        # Set RLS context based on user
        RLSContext.set(
            user_id=str(current_user.id),
            restaurant_id=(
                str(current_user.restaurant_id) if current_user.restaurant_id else None
            ),
            role=current_user.role,
        )

        # Store in request state for logging/debugging
        request.state.rls_user_id = str(current_user.id)
        request.state.rls_restaurant_id = (
            str(current_user.restaurant_id) if current_user.restaurant_id else None
        )
        request.state.rls_role = current_user.role

        logger.debug(
            f"RLS context set - User: {current_user.id}, "
            f"Restaurant: {current_user.restaurant_id}, Role: {current_user.role}"
        )


def get_rls_context() -> dict:
    """
    Get current RLS context.
    Useful for debugging or logging.
    """
    return RLSContext.get()


# Helper function for manual RLS context management
def with_rls_context(
    user_id: Optional[str] = None,
    restaurant_id: Optional[str] = None,
    role: Optional[str] = None,
):
    """
    Decorator to set RLS context for a specific function.
    Useful for background tasks or scripts.

    Example:
        @with_rls_context(restaurant_id="123")
        async def process_orders():
            # All database queries will be filtered by restaurant_id
    """

    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Set RLS context
            RLSContext.set(user_id=user_id, restaurant_id=restaurant_id, role=role)

            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                # Always clear context
                RLSContext.clear()

        return wrapper

    return decorator
