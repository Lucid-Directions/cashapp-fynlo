"""Multi-tenant isolation middleware for Fynlo POS.

Ensures proper restaurant_id validation and prevents cross-tenant data access.
"""

from functools import wraps
from typing import Callable, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.models.user import User


class TenantIsolationMiddleware:
    """Middleware to enforce multi-tenant isolation across the application."""

    def __init__(self):
        """Initialize the TenantIsolationMiddleware."""
        self.platform_owner_unrestricted_paths = [
            "/api/v1/platform/",
            "/api/v1/analytics/platform",
            "/api/v1/restaurants/all",
        ]

    def validate_restaurant_access(
        self,
        user: User,
        restaurant_id: UUID,
        allow_platform_owner: bool = True,
    ) -> bool:
        """
        Validate if user has access to the specified restaurant.

        Args:
            user: Current authenticated user
            restaurant_id: Restaurant ID to validate access for
            allow_platform_owner: Whether platform owners have
                unrestricted access

        Returns:
            bool: True if access is allowed, False otherwise
        """
        # Platform owners have full access when explicitly allowed
        if user.role == "platform_owner" and allow_platform_owner:
            return True

        # Check if user belongs to the restaurant
        if user.restaurant_id != restaurant_id:
            return False

        return True

    def require_restaurant_context(
        self, allow_platform_owner: bool = True, verify_active: bool = True
    ):
        """Ensure restaurant context is validated for endpoints.

        Args:
            allow_platform_owner: Whether platform owners can access
                all restaurants
            verify_active: Whether to check if restaurant is active
        """

        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                # Extract dependencies from function arguments
                request: Optional[Request] = None
                db: Optional[Session] = None
                current_user: Optional[User] = None
                restaurant_id: Optional[UUID] = None

                # Find dependencies in args/kwargs
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                    elif isinstance(arg, Session):
                        db = arg
                    elif isinstance(arg, User):
                        current_user = arg

                # Check kwargs for restaurant_id
                restaurant_id = kwargs.get("restaurant_id")

                # Get current user if not provided
                if not current_user and "current_user" in kwargs:
                    current_user = kwargs["current_user"]

                if not current_user:
                    raise HTTPException(
                        status_code=401, detail="Authentication required"
                    )

                # For platform owners accessing platform-specific endpoints
                if current_user.role == "platform_owner" and not restaurant_id:
                    # Check if this is a platform-specific endpoint
                    if request and any(
                        request.url.path.startswith(path)
                        for path in self.platform_owner_unrestricted_paths
                    ):
                        return await func(*args, **kwargs)

                # Require restaurant_id for all other cases
                if not restaurant_id:
                    # Use user's restaurant_id if not specified
                    if current_user.restaurant_id:
                        kwargs["restaurant_id"] = current_user.restaurant_id
                        restaurant_id = current_user.restaurant_id
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail="Restaurant context required",
                        )

                # Validate access
                if not self.validate_restaurant_access(
                    current_user, restaurant_id, allow_platform_owner
                ):
                    raise HTTPException(
                        status_code=403,
                        detail="Access denied to this restaurant",
                    )

                # Verify restaurant is active if required
                if verify_active and db:
                    from app.models.restaurant import Restaurant

                    restaurant = (
                        db.query(Restaurant)
                        .filter(
                            Restaurant.id == restaurant_id,
                            Restaurant.is_active == True,  # noqa: E712
                        )
                        .first()
                    )

                    if not restaurant:
                        raise HTTPException(
                            status_code=404,
                            detail="Restaurant not found or inactive",
                        )

                return await func(*args, **kwargs)

            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                # For sync functions, we need to handle this differently
                # This is a simplified version - in production, consider using
                # FastAPI's dependency injection system instead
                raise NotImplementedError(
                    "Sync functions not supported by this decorator. "
                    "Use FastAPI dependencies instead."
                )

            # Return appropriate wrapper based on function type
            import asyncio

            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper

        return decorator

    def filter_by_restaurant(
        self, query, user: User, restaurant_id_field: str = "restaurant_id"
    ):
        """
        Apply restaurant filtering to a SQLAlchemy query.

        Args:
            query: SQLAlchemy query object
            user: Current user
            restaurant_id_field: Field name for restaurant_id in the model

        Returns:
            Filtered query
        """
        # Platform owners can see all data
        if user.role == "platform_owner":
            return query

        # Filter by user's restaurant
        if user.restaurant_id:
            return query.filter(
                getattr(
                    query.column_descriptions[0]["type"], restaurant_id_field
                )
                == user.restaurant_id
            )

        # No restaurant context - return empty result
        return query.filter(False)


# Global instance
tenant_isolation = TenantIsolationMiddleware()


def validate_restaurant_access(
    restaurant_id: UUID,
    current_user: User = Depends(get_current_user),
    allow_platform_owner: bool = True,
) -> UUID:
    """Validate restaurant access as a FastAPI dependency.

    Args:
        restaurant_id: Restaurant ID from request
        current_user: Authenticated user
        allow_platform_owner: Whether platform owners have access

    Returns:
        Validated restaurant_id

    Raises:
        HTTPException: If access is denied
    """
    if not tenant_isolation.validate_restaurant_access(
        current_user, restaurant_id, allow_platform_owner
    ):
        raise HTTPException(
            status_code=403, detail="Access denied to this restaurant"
        )

    return restaurant_id


def get_user_restaurant_id(
    current_user: User = Depends(get_current_user),
    restaurant_id: Optional[UUID] = None,
) -> UUID:
    """Get restaurant_id with proper validation.

    Platform owners must specify restaurant_id explicitly.
    Other users use their assigned restaurant_id.

    Args:
        current_user: Authenticated user
        restaurant_id: Optional restaurant_id from request

    Returns:
        Validated restaurant_id

    Raises:
        HTTPException: If restaurant_id cannot be determined
    """
    if current_user.role == "platform_owner":
        if not restaurant_id:
            raise HTTPException(
                status_code=400,
                detail="Platform owners must specify restaurant_id",
            )
        return restaurant_id

    # Non-platform owners use their assigned restaurant
    if not current_user.restaurant_id:
        raise HTTPException(
            status_code=400, detail="User not assigned to any restaurant"
        )

    # If restaurant_id is provided, validate it matches user's restaurant
    if restaurant_id and restaurant_id != current_user.restaurant_id:
        raise HTTPException(
            status_code=403, detail="Access denied to this restaurant"
        )

    return current_user.restaurant_id
