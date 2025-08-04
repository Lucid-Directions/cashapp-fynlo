"""
Row Level Security Context Manager
Sets PostgreSQL session variables for RLS policies
"""

from contextlib import contextmanager
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import User
from app.core.tenant_security import TenantSecurity
import logging

logger = logging.getLogger(__name__)


class RLSContext:
    """Manages Row Level Security context for database sessions"""

    @staticmethod
    @contextmanager
    def set_tenant_context(db: Session, user: User):
        """
        Set RLS context for a database session

        Args:
            db: SQLAlchemy session
            user: Current user
        """
        try:
            # Set session variables for RLS
            if user:
                # Set user context with correct variable names
                db.execute(
                    text("SET LOCAL app.current_user_id = :user_id"),
                    {"user_id": str(user.id)},
                )
                db.execute(
                    text("SET LOCAL app.current_user_email = :email"),
                    {"email": user.email},
                )
                db.execute(
                    text("SET LOCAL app.current_user_role = :role"), {"role": user.role}
                )

                # Set restaurant context if user has one
                if user.restaurant_id:
                    db.execute(
                        text("SET LOCAL app.current_restaurant_id = :restaurant_id"),
                        {"restaurant_id": str(user.restaurant_id)},
                    )
                else:
                    # For platform owners without restaurant_id
                    db.execute(text("SET LOCAL app.current_restaurant_id TO DEFAULT"))

                # Set platform owner flag
                is_platform_owner = TenantSecurity.is_platform_owner(user)
                db.execute(
                    text("SET LOCAL app.is_platform_owner = :is_owner"),
                    {"is_owner": str(is_platform_owner).lower()},
                )

                logger.debug(
                    f"RLS context set for user {user.email} "
                    f"(role: {user.role}, restaurant: {user.restaurant_id})"
                )
            else:
                # No user context - set empty values with correct names
                db.execute(text("SET LOCAL app.current_user_id = ''"))
                db.execute(text("SET LOCAL app.current_user_email = ''"))
                db.execute(text("SET LOCAL app.current_user_role = ''"))
                db.execute(text("SET LOCAL app.current_restaurant_id = ''"))
                db.execute(text("SET LOCAL app.is_platform_owner = 'false'"))

            yield db

        except Exception as e:
            logger.error(f"Error setting RLS context: {str(e)}")
            raise
        finally:
            # Context automatically cleared when connection returns to pool
            pass

    @staticmethod
    def apply_to_query(query, user: User):
        """
        Apply tenant filtering to a query (alternative to RLS)
        Use this when RLS is not available or as additional security

        Args:
            query: SQLAlchemy query
            user: Current user

        Returns:
            Filtered query
        """
        if TenantSecurity.is_platform_owner(user):
            # Platform owners see everything
            return query

        # Filter by restaurant_id for other users
        if hasattr(query.column_descriptions[0]["type"], "restaurant_id"):
            model = query.column_descriptions[0]["type"]
            return query.filter(model.restaurant_id == user.restaurant_id)

        return query

    @staticmethod
    def get_db_with_context(db: Session, user: User):
        """
        Get a database session with RLS context already set

        Args:
            db: Base database session
            user: Current user

        Returns:
            Database session with RLS context
        """
        if user:
            db.execute(
                text("SET LOCAL app.current_user_id = :user_id"),
                {"user_id": str(user.id)},
            )
            db.execute(
                text("SET LOCAL app.current_user_email = :email"), {"email": user.email}
            )
            db.execute(
                text("SET LOCAL app.current_user_role = :role"), {"role": user.role}
            )

            if user.restaurant_id:
                db.execute(
                    text("SET LOCAL app.current_restaurant_id = :restaurant_id"),
                    {"restaurant_id": str(user.restaurant_id)},
                )
            else:
                db.execute(text("SET LOCAL app.current_restaurant_id TO DEFAULT"))

            # Set platform owner flag
            is_platform_owner = TenantSecurity.is_platform_owner(user)
            db.execute(
                text("SET LOCAL app.is_platform_owner = :is_owner"),
                {"is_owner": str(is_platform_owner).lower()},
            )

        return db
