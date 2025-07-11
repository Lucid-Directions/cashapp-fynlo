"""
Activity logging service for Fynlo Portal - Audit trail for portal actions
"""

from typing import Optional, Dict, Any
from datetime import datetime
import json
from sqlalchemy.orm import Session

from app.core.database import get_db, User, Restaurant
from app.models.activity_log import PortalActivityLog

class ActivityLogger:
    """Service for logging portal activities"""
    
    # Activity types
    EXPORT_MENU = "export_menu"
    EXPORT_REPORT = "export_report"
    IMPORT_MENU = "import_menu"
    UPDATE_SETTINGS = "update_settings"
    VIEW_DASHBOARD = "view_dashboard"
    VIEW_ANALYTICS = "view_analytics"
    CREATE_USER = "create_user"
    UPDATE_USER = "update_user"
    DELETE_USER = "delete_user"
    CREATE_RESTAURANT = "create_restaurant"
    UPDATE_RESTAURANT = "update_restaurant"
    SUSPEND_RESTAURANT = "suspend_restaurant"
    CHANGE_SUBSCRIPTION = "change_subscription"
    PROCESS_PAYMENT = "process_payment"
    LOGIN = "login"
    LOGOUT = "logout"
    API_CALL = "api_call"
    
    @staticmethod
    def log_activity(
        db: Session,
        user_id: str,
        restaurant_id: Optional[str],
        action: str,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[PortalActivityLog]:
        """
        Log a portal activity
        
        Args:
            db: Database session
            user_id: User performing the action
            restaurant_id: Restaurant context (if applicable)
            action: Action type (use constants)
            details: Additional details about the action
            ip_address: IP address of the request
            user_agent: User agent string
        
        Returns:
            Created activity log entry
        """
        try:
            activity_log = PortalActivityLog(
                user_id=user_id,
                restaurant_id=restaurant_id,
                action=action,
                details=details or {},
                ip_address=ip_address,
                user_agent=user_agent,
                created_at=datetime.utcnow()
            )
            
            db.add(activity_log)
            db.commit()
            db.refresh(activity_log)
            
            return activity_log
            
        except Exception as e:
            db.rollback()
            print(f"Failed to log activity: {str(e)}")
            # Don't raise - logging should not break the main operation
            return None
    
    @staticmethod
    def log_export(
        db: Session,
        user_id: str,
        restaurant_id: str,
        export_type: str,
        format: str,
        record_count: int = 0
    ):
        """Log export activity"""
        ActivityLogger.log_activity(
            db=db,
            user_id=user_id,
            restaurant_id=restaurant_id,
            action=ActivityLogger.EXPORT_REPORT if export_type != "menu" else ActivityLogger.EXPORT_MENU,
            details={
                "export_type": export_type,
                "format": format,
                "record_count": record_count,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    @staticmethod
    def log_dashboard_view(
        db: Session,
        user_id: str,
        restaurant_id: Optional[str],
        dashboard_type: str,
        period: str
    ):
        """Log dashboard viewing activity"""
        ActivityLogger.log_activity(
            db=db,
            user_id=user_id,
            restaurant_id=restaurant_id,
            action=ActivityLogger.VIEW_DASHBOARD,
            details={
                "dashboard_type": dashboard_type,
                "period": period,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    @staticmethod
    def log_settings_change(
        db: Session,
        user_id: str,
        restaurant_id: str,
        setting_type: str,
        old_value: Any,
        new_value: Any
    ):
        """Log settings change activity"""
        ActivityLogger.log_activity(
            db=db,
            user_id=user_id,
            restaurant_id=restaurant_id,
            action=ActivityLogger.UPDATE_SETTINGS,
            details={
                "setting_type": setting_type,
                "old_value": old_value,
                "new_value": new_value,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    @staticmethod
    def log_user_management(
        db: Session,
        user_id: str,
        restaurant_id: str,
        action_type: str,
        target_user_id: str,
        changes: Optional[Dict[str, Any]] = None
    ):
        """Log user management activity"""
        action_map = {
            "create": ActivityLogger.CREATE_USER,
            "update": ActivityLogger.UPDATE_USER,
            "delete": ActivityLogger.DELETE_USER
        }
        
        ActivityLogger.log_activity(
            db=db,
            user_id=user_id,
            restaurant_id=restaurant_id,
            action=action_map.get(action_type, ActivityLogger.UPDATE_USER),
            details={
                "target_user_id": target_user_id,
                "changes": changes or {},
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    @staticmethod
    def log_restaurant_management(
        db: Session,
        user_id: str,
        restaurant_id: str,
        action_type: str,
        changes: Optional[Dict[str, Any]] = None
    ):
        """Log restaurant management activity"""
        action_map = {
            "create": ActivityLogger.CREATE_RESTAURANT,
            "update": ActivityLogger.UPDATE_RESTAURANT,
            "suspend": ActivityLogger.SUSPEND_RESTAURANT,
            "subscription": ActivityLogger.CHANGE_SUBSCRIPTION
        }
        
        ActivityLogger.log_activity(
            db=db,
            user_id=user_id,
            restaurant_id=restaurant_id,
            action=action_map.get(action_type, ActivityLogger.UPDATE_RESTAURANT),
            details={
                "changes": changes or {},
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    @staticmethod
    def get_activity_logs(
        db: Session,
        restaurant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> list:
        """
        Retrieve activity logs with filtering
        
        Args:
            db: Database session
            restaurant_id: Filter by restaurant
            user_id: Filter by user
            action: Filter by action type
            start_date: Filter by start date
            end_date: Filter by end date
            limit: Maximum records to return
            offset: Pagination offset
        
        Returns:
            List of activity logs
        """
        query = db.query(PortalActivityLog)
        
        if restaurant_id:
            query = query.filter(PortalActivityLog.restaurant_id == restaurant_id)
        
        if user_id:
            query = query.filter(PortalActivityLog.user_id == user_id)
        
        if action:
            query = query.filter(PortalActivityLog.action == action)
        
        if start_date:
            query = query.filter(PortalActivityLog.created_at >= start_date)
        
        if end_date:
            query = query.filter(PortalActivityLog.created_at <= end_date)
        
        return query.order_by(PortalActivityLog.created_at.desc()).limit(limit).offset(offset).all()