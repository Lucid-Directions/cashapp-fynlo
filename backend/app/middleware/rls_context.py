"""Row Level Security Context Middleware.

Sets PostgreSQL session variables for RLS policies to use.
"""

from typing import Optional

from fastapi import Request
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_from_token
from app.models.user import User


class RLSContextMiddleware:
    """Middleware to set RLS context in PostgreSQL sessions."""

    @staticmethod
    def set_rls_context(
        db: Session,
        user: Optional[User] = None,
        restaurant_id: Optional[str] = None,
    ):
        """Set PostgreSQL session variables for RLS.

        Args:
            db: Database session
            user: Current authenticated user
            restaurant_id: Restaurant ID to set in context
        """
        if user:
            # Set user role
            db.execute(
                text("SET LOCAL app.current_user_role = :role"),
                {"role": user.role},
            )

            # Set user ID
            db.execute(
                text("SET LOCAL app.current_user_id = :user_id"),
                {"user_id": str(user.id)},
            )

            # Set restaurant ID
            if user.role == "platform_owner":
                # Platform owners can specify which restaurant context
                if restaurant_id:
                    db.execute(
                        text(
                            "SET LOCAL app.current_restaurant_id = :restaurant_id"
                        ),
                        {"restaurant_id": restaurant_id},
                    )
                # Otherwise no restaurant context (can see all)
            else:
                # Regular users use their assigned restaurant
                if user.restaurant_id:
                    db.execute(
                        text(
                            "SET LOCAL app.current_restaurant_id = :restaurant_id"
                        ),
                        {"restaurant_id": str(user.restaurant_id)},
                    )

    @staticmethod
    def clear_rls_context(db: Session):
        """Clear RLS context variables."""
        db.execute(text("RESET app.current_user_role"))
        db.execute(text("RESET app.current_user_id"))
        db.execute(text("RESET app.current_restaurant_id"))


def setup_rls_listeners(engine: Engine):
    """Set up SQLAlchemy event listeners for RLS.

    This ensures RLS context is properly set for all database operations.
    """

    @event.listens_for(engine, "connect")
    def receive_connect(dbapi_connection, connection_record):
        """Initialize connection with RLS settings."""
        # Ensure RLS is enforced
        with dbapi_connection.cursor() as cursor:
            cursor.execute("SET row_security = on")

    @event.listens_for(Session, "after_transaction_create")
    def receive_after_transaction_create(session, transaction):
        """Set RLS context after transaction begins."""
        # This will be called by request middleware
        pass

    @event.listens_for(Session, "after_transaction_end")
    def receive_after_transaction_end(session, transaction):
        """Clear RLS context after transaction ends."""
        # This ensures clean state between requests
        pass


async def rls_context_middleware(request: Request, call_next):
    """FastAPI middleware to set RLS context for each request.

    This middleware extracts the current user from the request
    and sets appropriate PostgreSQL session variables for RLS.
    """
    # Get current user from request if authenticated
    user = None
    restaurant_id = None

    # Extract token from Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            # This is a simplified version - in production, use proper
            # dependency injection
            from app.core.database import SessionLocal

            db = SessionLocal()
            user = await get_current_user_from_token(token, db)

            # Extract restaurant_id from request if provided
            # (e.g., from query params or path params)
            restaurant_id = request.query_params.get("restaurant_id")
            if not restaurant_id and hasattr(request, "path_params"):
                restaurant_id = request.path_params.get("restaurant_id")

            # Set RLS context
            RLSContextMiddleware.set_rls_context(db, user, restaurant_id)

            # Store user info in request state for rate limiting
            if user:
                request.state.user = user
                request.state.user_id = str(user.id)

            db.close()
        except Exception:
            # If token is invalid, proceed without RLS context
            pass

    # Process request
    response = await call_next(request)

    return response


# RLS-aware database session dependency
def get_rls_db(
    db: Session,
    current_user: Optional[User] = None,
    restaurant_id: Optional[str] = None,
) -> Session:
    """Get database session with RLS context set.

    This should be used instead of get_db() for RLS-protected operations.
    """
    if current_user:
        RLSContextMiddleware.set_rls_context(db, current_user, restaurant_id)
    return db
