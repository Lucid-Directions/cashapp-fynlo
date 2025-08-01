"""
Platform audit logging model and functions.
Tracks all platform admin actions for compliance and security.
<<<<<<< HEAD
=======
"""
>>>>>>> parent of af057592 (fix: docstring syntax and formatting issues across backend)


"""
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import Column, String, TIMESTAMP, JSONB, Integer, ForeignKey, Text
from sqlalchemy.orm import Session, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class PlatformAuditLog(Base):
    """Audit log for platform administrator actions"""
    __tablename__ = "platform_audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Who performed the action
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    user_email = Column(String, nullable=False)  # Denormalized for history
    
    # What action was performed
    action = Column(String, nullable=False, index=True)
    resource_type = Column(String, nullable=False, index=True)
    resource_id = Column(String, nullable=True, index=True)
    
    # Additional details
    details = Column(JSONB, default={})
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Request tracking
    request_id = Column(String, nullable=True, index=True)
    http_method = Column(String, nullable=True)
    endpoint = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False, index=True)
    
    # Relationships
    user = relationship("User", backref="platform_audit_logs")


def create_audit_log(
    db: Session,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    request_id: Optional[str] = None,
    http_method: Optional[str] = None,
    endpoint: Optional[str] = None
) -> PlatformAuditLog:
    """
    Create an audit log entry.
    
    Args:
        db: Database session
        user_id: ID of the user performing the action
        action: Action being performed (e.g., 'update_subscription', 'delete_user')
        resource_type: Type of resource being acted upon (e.g., 'restaurant', 'user')
        resource_id: ID of the resource (optional)
        details: Additional details about the action
        ip_address: Client IP address
        user_agent: Client user agent string
        request_id: Unique request ID for tracking
        http_method: HTTP method used
        endpoint: API endpoint called
    
    Returns:
        Created audit log entry
    """
    from app.core.database import User
    
    # Get user email for denormalization
    user = db.query(User).filter(User.id == user_id).first()
    user_email = user.email if user else "unknown"
    
    audit_log = PlatformAuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
        http_method=http_method,
        endpoint=endpoint
    )
    
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    
    return audit_log


# Common audit log actions
AUDIT_ACTIONS = {
    # Restaurant management
    "create_restaurant": "Created new restaurant",
    "update_restaurant": "Updated restaurant details",
    "delete_restaurant": "Deleted restaurant",
    "toggle_restaurant_status": "Changed restaurant status",
    "update_subscription": "Updated restaurant subscription",
    
    # User management
    "create_user": "Created new user",
    "update_user": "Updated user details",
    "delete_user": "Deleted user",
    "toggle_user_status": "Changed user status",
    "reset_user_password": "Reset user password",
    
    # Financial actions
    "process_refund": "Processed refund",
    "adjust_billing": "Adjusted billing",
    "generate_invoice": "Generated invoice",
    
    # System actions
    "export_data": "Exported data",
    "import_data": "Imported data",
    "clear_cache": "Cleared cache",
    "run_report": "Generated report",
    
    # Subscription management
    "batch_update_subscriptions": "Batch updated subscriptions",
    "cancel_subscription": "Cancelled subscription",
    "reactivate_subscription": "Reactivated subscription",
}


async def get_audit_logs(
    db: Session,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0
) -> list[PlatformAuditLog]:
    """
    Query audit logs with filters.
    
    Args:
        db: Database session
        user_id: Filter by user ID
        action: Filter by action
        resource_type: Filter by resource type
        resource_id: Filter by resource ID
        start_date: Filter by start date
        end_date: Filter by end date
        limit: Maximum number of results
        offset: Offset for pagination
    
    Returns:
        List of audit log entries
    """
    query = db.query(PlatformAuditLog)
    
    if user_id:
        query = query.filter(PlatformAuditLog.user_id == user_id)
    
    if action:
        query = query.filter(PlatformAuditLog.action == action)
    
    if resource_type:
        query = query.filter(PlatformAuditLog.resource_type == resource_type)
    
    if resource_id:
        query = query.filter(PlatformAuditLog.resource_id == resource_id)
    
    if start_date:
        query = query.filter(PlatformAuditLog.created_at >= start_date)
    
    if end_date:
        query = query.filter(PlatformAuditLog.created_at <= end_date)
    
    return query.order_by(PlatformAuditLog.created_at.desc()).limit(limit).offset(offset).all()


def get_audit_summary(
    db: Session,
    days: int = 30
) -> Dict[str, Any]:
    """
    Get summary of audit logs for dashboard.
    
    Args:
        db: Database session
        days: Number of days to look back
    
    Returns:
        Summary statistics
    """
    from datetime import timedelta
    from sqlalchemy import func
    
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Actions by type
    actions_by_type = db.query(
        PlatformAuditLog.action,
        func.count(PlatformAuditLog.id).label('count')
    ).filter(
        PlatformAuditLog.created_at >= cutoff_date
    ).group_by(
        PlatformAuditLog.action
    ).all()
    
    # Actions by user
    actions_by_user = db.query(
        PlatformAuditLog.user_email,
        func.count(PlatformAuditLog.id).label('count')
    ).filter(
        PlatformAuditLog.created_at >= cutoff_date
    ).group_by(
        PlatformAuditLog.user_email
    ).order_by(
        func.count(PlatformAuditLog.id).desc()
    ).limit(10).all()
    
    # Actions by resource type
    actions_by_resource = db.query(
        PlatformAuditLog.resource_type,
        func.count(PlatformAuditLog.id).label('count')
    ).filter(
        PlatformAuditLog.created_at >= cutoff_date
    ).group_by(
        PlatformAuditLog.resource_type
    ).all()
    
    return {
        "period_days": days,
        "total_actions": db.query(PlatformAuditLog).filter(
            PlatformAuditLog.created_at >= cutoff_date
        ).count(),
        "actions_by_type": {action: count for action, count in actions_by_type},
        "top_users": [
            {"email": email, "action_count": count}
            for email, count in actions_by_user
        ],
        "actions_by_resource": {resource: count for resource, count in actions_by_resource}
    }