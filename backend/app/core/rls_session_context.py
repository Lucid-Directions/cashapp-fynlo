"""
RLS Session Context Management
Ensures proper tenant isolation in connection pooling environments
"""

import contextvars
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import Request

from app.models import User
from app.core.tenant_security import TenantSecurity
from app.core.database import get_db

# Context variable to store current tenant context
current_tenant_context: contextvars.ContextVar[
    Optional[Dict[str, Any]]
] = contextvars.ContextVar("current_tenant_context", default=None)


class RLSSessionContext:
    """
    Manages Row Level Security (RLS) session variables for proper tenant isolation
    in connection pooling environments
    """

    @staticmethod
    async def set_tenant_context(
        db: Session, user: User, request: Optional[Request] = None
    ) -> None:
        """
        Set RLS session variables for the current database session

        Args:
            db: Database session
            user: Current user
            request: Optional request object for additional context
        """
        # Platform owners get special context
        if TenantSecurity.is_platform_owner(user):
            # Set platform owner context
            await RLSSessionContext._set_session_variables(
                db,
                user_id=str(user.id),
                user_email=user.email,
                user_role=user.role,
                restaurant_id=None,  # NULL means access to all
                is_platform_owner=True,
            )
        else:
            # Regular users are restricted to their restaurant
            if not user.restaurant_id:
                # Users without restaurant assignment get no access
                await RLSSessionContext._set_session_variables(
                    db,
                    user_id=str(user.id),
                    user_email=user.email,
                    user_role=user.role,
                    restaurant_id="00000000-0000-0000-0000-000000000000",  # Invalid UUID
                    is_platform_owner=False,
                )
            else:
                # Set regular user context
                await RLSSessionContext._set_session_variables(
                    db,
                    user_id=str(user.id),
                    user_email=user.email,
                    user_role=user.role,
                    restaurant_id=str(user.restaurant_id),
                    is_platform_owner=False,
                )

        # Store context in context variable for reference
        context = {
            "user_id": str(user.id),
            "user_email": user.email,
            "user_role": user.role,
            "restaurant_id": str(user.restaurant_id) if user.restaurant_id else None,
            "is_platform_owner": TenantSecurity.is_platform_owner(user),
        }
        current_tenant_context.set(context)

    @staticmethod
    async def _set_session_variables(
        db: Session,
        user_id: str,
        user_email: str,
        user_role: str,
        restaurant_id: Optional[str],
        is_platform_owner: bool,
    ) -> None:
        """
        Set PostgreSQL session variables for RLS

        These variables are used by RLS policies to determine access
        """
        try:
            # Set session variables using PostgreSQL SET LOCAL
            # These are only valid for the current transaction
            db.execute(
                text("SET LOCAL app.current_user_id = :user_id"), {"user_id": user_id}
            )
            db.execute(
                text("SET LOCAL app.current_user_email = :email"), {"email": user_email}
            )
            db.execute(
                text("SET LOCAL app.current_user_role = :role"), {"role": user_role}
            )

            if restaurant_id:
                db.execute(
                    text("SET LOCAL app.current_restaurant_id = :restaurant_id"),
                    {"restaurant_id": restaurant_id},
                )
            else:
                # For platform owners, set to NULL
                db.execute(text("SET LOCAL app.current_restaurant_id TO DEFAULT"))

            db.execute(
                text("SET LOCAL app.is_platform_owner = :is_owner"),
                {"is_owner": str(is_platform_owner).lower()},
            )

            # Commit to ensure variables are set
            db.commit()

        except Exception as e:
            db.rollback()
            raise Exception(f"Failed to set RLS session variables: {str(e)}")

    @staticmethod
    async def clear_tenant_context(db: Session) -> None:
        """
        Clear RLS session variables (important for connection pooling)
        """
        try:
            # Reset all session variables
            db.execute(text("RESET app.current_user_id"))
            db.execute(text("RESET app.current_user_email"))
            db.execute(text("RESET app.current_user_role"))
            db.execute(text("RESET app.current_restaurant_id"))
            db.execute(text("RESET app.is_platform_owner"))

            db.commit()

            # Clear context variable
            current_tenant_context.set(None)

        except Exception as e:
            db.rollback()
            # Log but don't raise - clearing context should not break requests
            import logging

            logging.error(f"Failed to clear RLS session variables: {str(e)}")

    @staticmethod
    def get_current_context() -> Optional[Dict[str, Any]]:
        """
        Get the current tenant context from context variables
        """
        return current_tenant_context.get()

    @staticmethod
    async def ensure_tenant_isolation(
        db: Session, user: User, operation: str = "query"
    ) -> None:
        """
        Ensure tenant isolation is properly set before database operations

        This should be called before any database query that needs tenant isolation
        """
        context = current_tenant_context.get()

        # If no context or context doesn't match user, set it
        if not context or context.get("user_id") != str(user.id):
            await RLSSessionContext.set_tenant_context(db, user)

    @staticmethod
    def create_rls_dependency():
        """
        Create a FastAPI dependency for automatic RLS context management
        """
        from fastapi import Depends

        async def rls_context_dependency(
            request: Request, db: Session = Depends(get_db), user: Optional[User] = None
        ):
            """
            FastAPI dependency that automatically sets RLS context
            """
            # Import here to avoid circular imports
            from app.core.auth import get_current_user

            try:
                # Get user if not provided
                if user is None:
                    user = await get_current_user(request, db)

                # Set tenant context for this request
                await RLSSessionContext.set_tenant_context(db, user, request)

                yield db

            finally:
                # Always clear context after request
                await RLSSessionContext.clear_tenant_context(db)

        return rls_context_dependency


# Function to get RLS-enabled DB session
def get_rls_db():
    """Get a database session with RLS context"""
    return RLSSessionContext.create_rls_dependency()
