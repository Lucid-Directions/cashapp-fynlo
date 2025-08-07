import uuid
from typing import Optional, Dict, Any
import logging

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.models.audit_log import AuditLog, AuditEventType, AuditEventStatus

# Standard logger for issues within the audit logger itself
logger = logging.getLogger(__name__)


class AuditLoggerService:
    def __init__(self, db: Session):
        self.db = db

    async def create_audit_log(
        self,
        event_type: AuditEventType,
        event_status: AuditEventStatus,
        action_performed: str,
        user_id: Optional[uuid.UUID] = None,
        username_or_email: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        risk_score: Optional[int] = None,
        commit: bool = True,  # Option to control commit, useful if called within a larger transaction
    ) -> Optional[AuditLog]:
        """
        Creates and saves an audit log entry.

        Args:
            event_type: The type of the audit event.
            event_status: The status of the audit event.
            action_performed: Detailed description of the action.
            user_id: ID of the user performing the action.
            username_or_email: Username or email, especially for unauthenticated/failed attempts.
            ip_address: IP address of the requestor.
            user_agent: User agent of the requestor.
            resource_type: Type of resource affected.
            resource_id: ID of the resource affected.
            details: Additional JSON details for the event.
            risk_score: Calculated risk score for the event.
            commit: If True, commits the session after adding the log. Set to False
                    if part of a larger transaction that will be committed later.

        Returns:
            The created AuditLog instance if successful, None otherwise.
        """
        try:
            audit_log_entry = AuditLog(
                event_type=event_type,
                event_status=event_status,
                action_performed=action_performed,
                user_id=user_id,
                username_or_email=username_or_email,
                ip_address=ip_address,  # SQLAlchemy handles INET conversion
                user_agent=user_agent,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
                risk_score=risk_score,
            )
            self.db.add(audit_log_entry)

            if commit:
                self.db.commit()
                self.db.refresh(audit_log_entry)
            else:
                # If not committing immediately, flush to get default values like ID, timestamp
                # but allow the caller to handle the commit.
                self.db.flush()
                # Note: refresh might not work as expected without commit in some scenarios,
                # but for defaults like UUID and server_default timestamp, flush is often enough.
                # If refresh is critical, the caller must handle it post-commit.

            logger.debug(
                f"Audit log created: {event_type.value} for user {user_id or username_or_email}"
            )
            return audit_log_entry
        except SQLAlchemyError as e:
            logger.error(f"Failed to save audit log: {e}", exc_info=True)
            try:
                self.db.rollback()  # Rollback on error if we were supposed to commit
            except Exception as rb_exc:
                logger.error(
                    f"Failed to rollback audit log session: {rb_exc}", exc_info=True
                )
            return None
        except Exception as e:
            # Catch any other unexpected errors
            logger.error(
                f"Unexpected error during audit log creation: {e}", exc_info=True
            )
            # We don't rollback here as the state of db session is unknown for non-SQLAlchemy errors
            return None


# --- Helper function to get the service with a DB session ---
# This is a common pattern in FastAPI for dependency injection.
# However, since this service might be called from various places,
# direct instantiation with a passed DB session is also fine.

# Example of how it might be provided via FastAPI dependency system:
# from fastapi import Depends
# def get_audit_logger_service(db: Session = Depends(get_db)) -> AuditLoggerService:
# return AuditLoggerService(db=db)
# Then in an endpoint: audit_service: AuditLoggerService = Depends(get_audit_logger_service)
# await audit_service.create_audit_log(...)

# For now, we will instantiate it directly where needed, passing the db session.
# A global instance or a more sophisticated DI mechanism could be used later if needed.
# For example, in request context or middleware.
