"""
Push Notification API endpoints for Fynlo POS
Device registration, notification sending, and preference management
"""


"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Body, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.database import get_db, User
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes
from app.core.push_notifications import (
    get_push_service,
    NotificationType,
    NotificationPriority,
    NotificationPayload,
    NotificationPreferences
)

router = APIRouter()

# Notification Models
class DeviceRegistrationRequest(BaseModel):
    """Device registration request"""
    device_token: str = Field(..., description="APNs device token (64-character hex string)")
    device_type: str = Field(default="ios", description="Device type")
    device_name: Optional[str] = Field(None, description="Device name for identification")

class NotificationSendRequest(BaseModel):
    """Manual notification send request"""
    title: str = Field(..., description="Notification title")
    body: str = Field(..., description="Notification body")
    notification_type: str = Field(..., description="Notification type")
    priority: str = Field(default="normal", description="Notification priority")
    target_users: Optional[List[str]] = Field(None, description="Target user IDs")
    target_restaurants: Optional[List[str]] = Field(None, description="Target restaurant IDs")
    sound: str = Field(default="default", description="Notification sound")
    custom_data: Optional[Dict[str, Any]] = Field(None, description="Custom data payload")

class TemplatedNotificationRequest(BaseModel):
    """Templated notification request"""
    notification_type: str = Field(..., description="Notification template type")
    template_data: Dict[str, Any] = Field(..., description="Data for template formatting")
    target_users: Optional[List[str]] = Field(None, description="Target user IDs")
    target_restaurants: Optional[List[str]] = Field(None, description="Target restaurant IDs")

class NotificationPreferencesRequest(BaseModel):
    """Notification preferences update request"""
    enabled_types: List[str] = Field(..., description="Enabled notification types")
    quiet_hours_start: Optional[str] = Field(None, description="Quiet hours start time (HH:MM)")
    quiet_hours_end: Optional[str] = Field(None, description="Quiet hours end time (HH:MM)")
    sound_enabled: bool = Field(default=True, description="Sound enabled")
    badge_enabled: bool = Field(default=True, description="Badge enabled")

@router.post("/register-device")
async def register_device_token(
    request: DeviceRegistrationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Register device token for push notifications
    """
    try:
        # Use current restaurant context
        restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
        if not restaurant_id:
            raise FynloException(
                message="User must be associated with a restaurant",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        restaurant_id = str(restaurant_id)
        
        push_service = get_push_service()
        success = await push_service.register_device_token(
            token=request.device_token,
            user_id=str(current_user.id),
            restaurant_id=restaurant_id,
            device_type=request.device_type
        )
        
        if not success:
            raise FynloException(
                message="Failed to register device token",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
        
        return APIResponseHelper.success(
            data={
                "device_token": request.device_token[:8] + "...",  # Masked for security
                "device_type": request.device_type,
                "registered_at": datetime.now().isoformat()
            },
            message="Device token registered successfully",
            meta={
                "user_id": str(current_user.id),
                "restaurant_id": restaurant_id
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to register device: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.delete("/unregister-device")
async def unregister_device_token(
    device_token: str = Query(..., description="Device token to unregister"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unregister device token
    """
    try:
        push_service = get_push_service()
        success = await push_service.unregister_device_token(device_token)
        
        if not success:
            raise FynloException(
                message="Device token not found or already inactive",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        return APIResponseHelper.success(
            message="Device token unregistered successfully",
            meta={
                "device_token": device_token[:8] + "...",
                "unregistered_by": current_user.username
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to unregister device: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.post("/send")
async def send_notification(
    request: NotificationSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send push notification manually
    Requires management permissions
    """
    try:
        # Only managers and owners can send manual notifications
        if current_user.role not in ["restaurant_owner", "platform_owner", "manager"]:
            raise FynloException(
                message="Access denied - management permissions required",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        # Validate target restaurants if specified
        if request.target_restaurants:
            from app.core.tenant_security import TenantSecurity
            for restaurant_id in request.target_restaurants:
                await TenantSecurity.validate_restaurant_access(
                    user=current_user,
                    restaurant_id=restaurant_id,
                    operation="access",
                    resource_type="notifications",
                    db=db
                )
        
        # Validate notification type and priority
        try:
            notification_type = NotificationType(request.notification_type)
            priority = NotificationPriority(request.priority)
        except ValueError as e:
            raise FynloException(
                message=f"Invalid notification type or priority: {str(e)}",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Create notification payload
        payload = NotificationPayload(
            title=request.title,
            body=request.body,
            notification_type=notification_type,
            priority=priority,
            sound=request.sound,
            custom_data=request.custom_data or {}
        )
        
        # Send notification
        push_service = get_push_service()
        result = await push_service.send_notification(
            payload=payload,
            target_users=request.target_users,
            target_restaurants=request.target_restaurants
        )
        
        return APIResponseHelper.success(
            data=result,
            message=f"Notification sent to {result['total_sent']} devices",
            meta={
                "sent_by": current_user.username,
                "notification_type": request.notification_type,
                "priority": request.priority
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to send notification: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.post("/send-templated")
async def send_templated_notification(
    request: TemplatedNotificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send notification using predefined template
    """
    try:
        # Validate target restaurants if specified
        if request.target_restaurants:
            from app.core.tenant_security import TenantSecurity
            for restaurant_id in request.target_restaurants:
                await TenantSecurity.validate_restaurant_access(
                    user=current_user,
                    restaurant_id=restaurant_id,
                    operation="access",
                    resource_type="notifications",
                    db=db
                )
        
        # Validate notification type
        try:
            notification_type = NotificationType(request.notification_type)
        except ValueError:
            raise FynloException(
                message=f"Invalid notification type: {request.notification_type}",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Send templated notification
        push_service = get_push_service()
        result = await push_service.send_templated_notification(
            notification_type=notification_type,
            template_data=request.template_data,
            target_users=request.target_users,
            target_restaurants=request.target_restaurants
        )
        
        return APIResponseHelper.success(
            data=result,
            message=f"Templated notification sent to {result['total_sent']} devices",
            meta={
                "sent_by": current_user.username,
                "template_type": request.notification_type
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to send templated notification: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.post("/preferences")
async def update_notification_preferences(
    request: NotificationPreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user notification preferences
    """
    try:
        # Validate enabled notification types
        enabled_types = []
        for type_str in request.enabled_types:
            try:
                enabled_types.append(NotificationType(type_str))
            except ValueError:
                raise FynloException(
                    message=f"Invalid notification type: {type_str}",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        # Create preferences object
        preferences = NotificationPreferences(
            user_id=str(current_user.id),
            enabled_types=enabled_types,
            quiet_hours_start=request.quiet_hours_start,
            quiet_hours_end=request.quiet_hours_end,
            sound_enabled=request.sound_enabled,
            badge_enabled=request.badge_enabled
        )
        
        # Update preferences
        push_service = get_push_service()
        success = push_service.update_user_preferences(
            user_id=str(current_user.id),
            preferences=preferences
        )
        
        if not success:
            raise FynloException(
                message="Failed to update notification preferences",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
        
        return APIResponseHelper.success(
            data={
                "enabled_types": [t.value for t in enabled_types],
                "quiet_hours_start": request.quiet_hours_start,
                "quiet_hours_end": request.quiet_hours_end,
                "sound_enabled": request.sound_enabled,
                "badge_enabled": request.badge_enabled,
                "updated_at": datetime.now().isoformat()
            },
            message="Notification preferences updated successfully",
            meta={"user_id": str(current_user.id)}
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to update preferences: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/preferences")
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user notification preferences
    """
    try:
        push_service = get_push_service()
        preferences = push_service.get_user_preferences(str(current_user.id))
        
        if not preferences:
            # Return default preferences
            return APIResponseHelper.success(
                data={
                    "enabled_types": [t.value for t in NotificationType],
                    "quiet_hours_start": None,
                    "quiet_hours_end": None,
                    "sound_enabled": True,
                    "badge_enabled": True,
                    "is_default": True
                },
                message="Default notification preferences (not customized)",
                meta={"user_id": str(current_user.id)}
            )
        
        return APIResponseHelper.success(
            data={
                "enabled_types": [t.value for t in preferences.enabled_types],
                "quiet_hours_start": preferences.quiet_hours_start,
                "quiet_hours_end": preferences.quiet_hours_end,
                "sound_enabled": preferences.sound_enabled,
                "badge_enabled": preferences.badge_enabled,
                "updated_at": preferences.updated_at.isoformat(),
                "is_default": False
            },
            message="Notification preferences retrieved successfully",
            meta={"user_id": str(current_user.id)}
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get preferences: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/history")
async def get_notification_history(
    limit: int = Query(50, le=200, description="Maximum notifications to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get notification history for current user
    """
    try:
        push_service = get_push_service()
        history = push_service.get_notification_history(
            user_id=str(current_user.id),
            limit=limit
        )
        
        # Convert to response format
        history_data = [
            {
                "device_token": result.device_token[:8] + "...",  # Masked
                "success": result.success,
                "message_id": result.message_id,
                "error_code": result.error_code,
                "error_message": result.error_message,
                "sent_at": result.sent_at.isoformat()
            }
            for result in history
        ]
        
        return APIResponseHelper.success(
            data=history_data,
            message=f"Retrieved {len(history_data)} notification records",
            meta={
                "user_id": str(current_user.id),
                "limit": limit,
                "total_records": len(history_data)
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get notification history: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/templates")
async def get_notification_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get available notification templates
    """
    try:
        push_service = get_push_service()
        templates = push_service.templates
        
        # Convert templates to response format
        templates_data = {}
        for notification_type, template in templates.items():
            templates_data[notification_type.value] = {
                "title_template": template.title_template,
                "body_template": template.body_template,
                "priority": template.priority.value,
                "sound": template.sound,
                "custom_data_template": template.custom_data_template
            }
        
        return APIResponseHelper.success(
            data=templates_data,
            message=f"Retrieved {len(templates_data)} notification templates",
            meta={"template_count": len(templates_data)}
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get templates: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/stats")
async def get_notification_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get push notification service statistics
    Requires management permissions
    """
    try:
        # Only managers and owners can view statistics
        if current_user.role not in ["restaurant_owner", "platform_owner", "manager"]:
            raise FynloException(
                message="Access denied - management permissions required",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        push_service = get_push_service()
        stats = push_service.get_service_statistics()
        
        return APIResponseHelper.success(
            data=stats,
            message="Push notification statistics retrieved successfully",
            meta={"requested_by": current_user.username}
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get statistics: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.post("/test")
async def send_test_notification(
    device_token: Optional[str] = Body(None, description="Specific device token to test"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send test notification for debugging
    Requires management permissions
    """
    try:
        # Only managers and owners can send test notifications
        if current_user.role not in ["restaurant_owner", "platform_owner", "manager"]:
            raise FynloException(
                message="Access denied - management permissions required",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        # Create test payload
        payload = NotificationPayload(
            title="Test Notification",
            body=f"Test notification sent by {current_user.username} at {datetime.now().strftime('%H:%M:%S')}",
            notification_type=NotificationType.SYSTEM_MAINTENANCE,
            priority=NotificationPriority.NORMAL,
            sound="default",
            custom_data={
                "test": True,
                "sent_by": current_user.username,
                "timestamp": datetime.now().isoformat()
            }
        )
        
        # Send notification
        push_service = get_push_service()
        
        if device_token:
            # Send to specific device
            result = await push_service.send_notification(
                payload=payload,
                target_tokens=[device_token]
            )
        else:
            # Send to current user's devices
            result = await push_service.send_notification(
                payload=payload,
                target_users=[str(current_user.id)]
            )
        
        return APIResponseHelper.success(
            data=result,
            message=f"Test notification sent to {result['total_sent']} devices",
            meta={
                "test_type": "specific_device" if device_token else "user_devices",
                "sent_by": current_user.username
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to send test notification: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )