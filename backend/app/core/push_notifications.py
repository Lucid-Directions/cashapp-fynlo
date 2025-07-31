"""
Push Notification Service for Fynlo POS
Apple Push Notification Service (APNs) integration for iOS alerts
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from enum import Enum
import json
import uuid
import asyncio
from dataclasses import dataclass
import logging

from app.core.exceptions import FynloException, ErrorCodes
from app.core.responses import APIResponseHelper

# Mock APNs implementation for development
# In production, this would use aioapns or similar library

logger = logging.getLogger(__name__)

class NotificationType(str, Enum):
    """Push notification types"""
    ORDER_CREATED = "order_created"
    ORDER_STATUS_CHANGED = "order_status_changed"
    PAYMENT_COMPLETED = "payment_completed"
    PAYMENT_FAILED = "payment_failed"
    KITCHEN_ALERT = "kitchen_alert"
    INVENTORY_LOW = "inventory_low"
    SHIFT_REMINDER = "shift_reminder"
    SYSTEM_MAINTENANCE = "system_maintenance"
    CUSTOMER_ORDER_READY = "customer_order_ready"
    DELIVERY_UPDATE = "delivery_update"

class NotificationPriority(str, Enum):
    """Notification priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class DeviceToken:
    """Device token for push notifications"""
    token: str
    user_id: str
    restaurant_id: str
    device_type: str = "ios"
    is_active: bool = True
    registered_at: datetime = None
    last_used: datetime = None
    
    def __post_init__(self):
        if self.registered_at is None:
            self.registered_at = datetime.now()
        if self.last_used is None:
            self.last_used = datetime.now()

@dataclass
class NotificationPayload:
    """Push notification payload structure"""
    title: str
    body: str
    notification_type: NotificationType
    priority: NotificationPriority = NotificationPriority.NORMAL
    badge_count: Optional[int] = None
    sound: str = "default"
    custom_data: Dict[str, Any] = None
    expiration: Optional[datetime] = None
    
    def __post_init__(self):
        if self.custom_data is None:
            self.custom_data = {}
        if self.expiration is None:
            self.expiration = datetime.now() + timedelta(hours=24)

@dataclass
class NotificationTemplate:
    """Notification template for different types"""
    notification_type: NotificationType
    title_template: str
    body_template: str
    sound: str = "default"
    priority: NotificationPriority = NotificationPriority.NORMAL
    custom_data_template: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.custom_data_template is None:
            self.custom_data_template = {}

@dataclass
class NotificationResult:
    """Result of sending a push notification"""
    device_token: str
    success: bool
    message_id: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    sent_at: datetime = None
    
    def __post_init__(self):
        if self.sent_at is None:
            self.sent_at = datetime.now()

class NotificationPreferences:
    """User notification preferences"""
    def __init__(
        self,
        user_id: str,
        enabled_types: List[NotificationType] = None,
        quiet_hours_start: Optional[str] = None,
        quiet_hours_end: Optional[str] = None,
        sound_enabled: bool = True,
        badge_enabled: bool = True
    ):
        self.user_id = user_id
        self.enabled_types = enabled_types or list(NotificationType)
        self.quiet_hours_start = quiet_hours_start  # "22:00"
        self.quiet_hours_end = quiet_hours_end      # "08:00"
        self.sound_enabled = sound_enabled
        self.badge_enabled = badge_enabled
        self.updated_at = datetime.now()

class PushNotificationService:
    """Push notification service for iOS devices"""
    
    def __init__(self):
        # In-memory storage for development
        # In production, these would be stored in database
        self.device_tokens: Dict[str, DeviceToken] = {}
        self.user_preferences: Dict[str, NotificationPreferences] = {}
        self.notification_history: List[NotificationResult] = []
        
        # APNs configuration (mock for development)
        self.apns_config = {
            "key_id": "mock_key_id",
            "team_id": "mock_team_id",
            "bundle_id": "com.fynlo.pos",
            "use_sandbox": True  # Set to False for production
        }
        
        # Notification templates
        self.templates = self._initialize_templates()
        
        # Statistics
        self.stats = {
            "total_sent": 0,
            "total_delivered": 0,
            "total_failed": 0,
            "tokens_registered": 0
        }
    
    def _initialize_templates(self) -> Dict[NotificationType, NotificationTemplate]:
        """Initialize notification templates"""
        return {
            NotificationType.ORDER_CREATED: NotificationTemplate(
                notification_type=NotificationType.ORDER_CREATED,
                title_template="New Order #{order_number}",
                body_template="Order for ${total_amount} received from {customer_name}",
                priority=NotificationPriority.HIGH,
                sound="order_alert.wav",
                custom_data_template={
                    "order_id": "{order_id}",
                    "restaurant_id": "{restaurant_id}",
                    "action": "view_order"
                }
            ),
            NotificationType.ORDER_STATUS_CHANGED: NotificationTemplate(
                notification_type=NotificationType.ORDER_STATUS_CHANGED,
                title_template="Order #{order_number} {status}",
                body_template="Order status updated to {status}",
                priority=NotificationPriority.NORMAL,
                custom_data_template={
                    "order_id": "{order_id}",
                    "new_status": "{status}",
                    "action": "view_order"
                }
            ),
            NotificationType.PAYMENT_COMPLETED: NotificationTemplate(
                notification_type=NotificationType.PAYMENT_COMPLETED,
                title_template="Payment Received",
                body_template="${amount} payment confirmed for order #{order_number}",
                priority=NotificationPriority.HIGH,
                sound="payment_success.wav",
                custom_data_template={
                    "payment_id": "{payment_id}",
                    "order_id": "{order_id}",
                    "amount": "{amount}",
                    "action": "view_payment"
                }
            ),
            NotificationType.PAYMENT_FAILED: NotificationTemplate(
                notification_type=NotificationType.PAYMENT_FAILED,
                title_template="Payment Failed",
                body_template="Payment of ${amount} failed for order #{order_number}",
                priority=NotificationPriority.CRITICAL,
                sound="error_alert.wav",
                custom_data_template={
                    "payment_id": "{payment_id}",
                    "order_id": "{order_id}",
                    "error_reason": "{error_reason}",
                    "action": "retry_payment"
                }
            ),
            NotificationType.KITCHEN_ALERT: NotificationTemplate(
                notification_type=NotificationType.KITCHEN_ALERT,
                title_template="Kitchen Alert",
                body_template="{alert_message}",
                priority=NotificationPriority.HIGH,
                sound="kitchen_alert.wav",
                custom_data_template={
                    "alert_type": "{alert_type}",
                    "order_id": "{order_id}",
                    "action": "view_kitchen"
                }
            ),
            NotificationType.INVENTORY_LOW: NotificationTemplate(
                notification_type=NotificationType.INVENTORY_LOW,
                title_template="Low Stock Alert",
                body_template="{product_name} is running low ({current_stock} remaining)",
                priority=NotificationPriority.NORMAL,
                custom_data_template={
                    "product_id": "{product_id}",
                    "current_stock": "{current_stock}",
                    "action": "view_inventory"
                }
            ),
            NotificationType.SHIFT_REMINDER: NotificationTemplate(
                notification_type=NotificationType.SHIFT_REMINDER,
                title_template="Shift Reminder",
                body_template="Your shift starts in {time_until} minutes",
                priority=NotificationPriority.NORMAL,
                custom_data_template={
                    "shift_id": "{shift_id}",
                    "shift_start": "{shift_start}",
                    "action": "view_schedule"
                }
            ),
            NotificationType.SYSTEM_MAINTENANCE: NotificationTemplate(
                notification_type=NotificationType.SYSTEM_MAINTENANCE,
                title_template="System Maintenance",
                body_template="{maintenance_message}",
                priority=NotificationPriority.NORMAL,
                custom_data_template={
                    "maintenance_type": "{maintenance_type}",
                    "estimated_duration": "{estimated_duration}",
                    "action": "view_status"
                }
            ),
            NotificationType.CUSTOMER_ORDER_READY: NotificationTemplate(
                notification_type=NotificationType.CUSTOMER_ORDER_READY,
                title_template="Order Ready for Pickup",
                body_template="Order #{order_number} is ready for pickup",
                priority=NotificationPriority.HIGH,
                sound="order_ready.wav",
                custom_data_template={
                    "order_id": "{order_id}",
                    "pickup_code": "{pickup_code}",
                    "action": "pickup_order"
                }
            ),
            NotificationType.DELIVERY_UPDATE: NotificationTemplate(
                notification_type=NotificationType.DELIVERY_UPDATE,
                title_template="Delivery Update",
                body_template="Your order is {delivery_status}",
                priority=NotificationPriority.NORMAL,
                custom_data_template={
                    "order_id": "{order_id}",
                    "delivery_status": "{delivery_status}",
                    "estimated_arrival": "{estimated_arrival}",
                    "action": "track_delivery"
                }
            )
        }
    
    async def register_device_token(
        self,
        token: str,
        user_id: str,
        restaurant_id: str,
        device_type: str = "ios"
    ) -> bool:
        """Register device token for push notifications"""
        try:
            # Validate token format (APNs tokens are 64 characters hex)
            if not self._validate_device_token(token):
                raise FynloException(
                    message="Invalid device token format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
            
            # Create or update device token
            device_token = DeviceToken(
                token=token,
                user_id=user_id,
                restaurant_id=restaurant_id,
                device_type=device_type,
                is_active=True,
                registered_at=datetime.now(),
                last_used=datetime.now()
            )
            
            self.device_tokens[token] = device_token
            self.stats["tokens_registered"] += 1
            
            logger.info(f"Device token registered: {token[:8]}... for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to register device token: {str(e)}")
            return False
    
    async def unregister_device_token(self, token: str) -> bool:
        """Unregister device token"""
        try:
            if token in self.device_tokens:
                self.device_tokens[token].is_active = False
                logger.info(f"Device token unregistered: {token[:8]}...")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Failed to unregister device token: {str(e)}")
            return False
    
    async def send_notification(
        self,
        payload: NotificationPayload,
        target_users: List[str] = None,
        target_restaurants: List[str] = None,
        target_tokens: List[str] = None
    ) -> Dict[str, Any]:
        """Send push notification to specified targets"""
        try:
            results = []
            
            # Collect target device tokens
            tokens_to_send = set()
            
            if target_tokens:
                tokens_to_send.update(target_tokens)
            
            if target_users:
                for user_id in target_users:
                    user_tokens = [
                        token for token, device in self.device_tokens.items()
                        if device.user_id == user_id and device.is_active
                    ]
                    tokens_to_send.update(user_tokens)
            
            if target_restaurants:
                for restaurant_id in target_restaurants:
                    restaurant_tokens = [
                        token for token, device in self.device_tokens.items()
                        if device.restaurant_id == restaurant_id and device.is_active
                    ]
                    tokens_to_send.update(restaurant_tokens)
            
            # Send notifications to each token
            for token in tokens_to_send:
                device = self.device_tokens.get(token)
                if not device:
                    continue
                
                # Check user preferences
                if not self._should_send_notification(device.user_id, payload):
                    continue
                
                # Send notification
                result = await self._send_to_device(token, payload)
                results.append(result)
                
                # Update statistics
                if result.success:
                    self.stats["total_delivered"] += 1
                else:
                    self.stats["total_failed"] += 1
                
                self.stats["total_sent"] += 1
                self.notification_history.append(result)
            
            return {
                "total_sent": len(results),
                "successful": len([r for r in results if r.success]),
                "failed": len([r for r in results if not r.success]),
                "results": [r.__dict__ for r in results]
            }
            
        except Exception as e:
            raise FynloException(
                message=f"Failed to send notification: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
    
    async def send_templated_notification(
        self,
        notification_type: NotificationType,
        template_data: Dict[str, Any],
        target_users: List[str] = None,
        target_restaurants: List[str] = None,
        target_tokens: List[str] = None
    ) -> Dict[str, Any]:
        """Send notification using predefined template"""
        try:
            template = self.templates.get(notification_type)
            if not template:
                raise FynloException(
                    message=f"Template not found for type: {notification_type}",
                    error_code=ErrorCodes.NOT_FOUND,
                    status_code=404
                )
            
            # Format template with provided data
            title = template.title_template.format(**template_data)
            body = template.body_template.format(**template_data)
            
            # Format custom data
            custom_data = {}
            for key, value_template in template.custom_data_template.items():
                try:
                    custom_data[key] = value_template.format(**template_data)
                except KeyError:
                    custom_data[key] = value_template  # Use as-is if no template data
            
            # Create payload
            payload = NotificationPayload(
                title=title,
                body=body,
                notification_type=notification_type,
                priority=template.priority,
                sound=template.sound,
                custom_data=custom_data
            )
            
            return await self.send_notification(
                payload=payload,
                target_users=target_users,
                target_restaurants=target_restaurants,
                target_tokens=target_tokens
            )
            
        except Exception as e:
            raise FynloException(
                message=f"Failed to send templated notification: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
    
    def update_user_preferences(
        """Execute update_user_preferences operation."""
        self,
        user_id: str,
        preferences: NotificationPreferences
    ) -> bool:
        """Update user notification preferences"""
        try:
            preferences.user_id = user_id
            preferences.updated_at = datetime.now()
            self.user_preferences[user_id] = preferences
            
            logger.info(f"Updated notification preferences for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update preferences: {str(e)}")
            return False
    
    def get_user_preferences(self, user_id: str) -> Optional[NotificationPreferences]:
        """Get user notification preferences"""
        return self.user_preferences.get(user_id)
    
    def get_notification_history(
        """Execute get_notification_history operation."""
        self,
        user_id: Optional[str] = None,
        limit: int = 100
    ) -> List[NotificationResult]:
        """Get notification history"""
        history = self.notification_history
        
        if user_id:
            # Filter by user's device tokens
            user_tokens = [
                token for token, device in self.device_tokens.items()
                if device.user_id == user_id
            ]
            history = [
                result for result in history
                if result.device_token in user_tokens
            ]
        
        return history[-limit:]
    
    def get_service_statistics(self) -> Dict[str, Any]:
        """Get push notification service statistics"""
        return {
            "stats": self.stats.copy(),
            "registered_tokens": len([t for t in self.device_tokens.values() if t.is_active]),
            "total_tokens": len(self.device_tokens),
            "templates_available": len(self.templates),
            "recent_failures": len([
                r for r in self.notification_history[-50:]
                if not r.success
            ])
        }
    
    async def _send_to_device(
        self,
        device_token: str,
        payload: NotificationPayload
    ) -> NotificationResult:
        """Send notification to specific device (mock implementation)"""
        try:
            # Mock APNs sending logic
            # In production, this would use aioapns or similar library
            
            # Simulate APNs request
            await asyncio.sleep(0.1)  # Simulate network delay
            
            # Mock success/failure (95% success rate)
            import random
            success = random.random() < 0.95
            
            if success:
                message_id = str(uuid.uuid4())
                return NotificationResult(
                    device_token=device_token,
                    success=True,
                    message_id=message_id,
                    sent_at=datetime.now()
                )
            else:
                return NotificationResult(
                    device_token=device_token,
                    success=False,
                    error_code="InvalidToken",
                    error_message="Device token is invalid or expired",
                    sent_at=datetime.now()
                )
                
        except Exception as e:
            return NotificationResult(
                device_token=device_token,
                success=False,
                error_code="SendError",
                error_message=str(e),
                sent_at=datetime.now()
            )
    
    def _validate_device_token(self, token: str) -> bool:
        """Validate APNs device token format"""
        # APNs tokens are 64-character hexadecimal strings
        if len(token) != 64:
            return False
        
        try:
            int(token, 16)  # Try to parse as hex
            return True
        except ValueError:
            return False
    
    def _should_send_notification(
        self,
        user_id: str,
        payload: NotificationPayload
    ) -> bool:
        """Check if notification should be sent based on user preferences"""
        preferences = self.user_preferences.get(user_id)
        if not preferences:
            return True  # Default to sending if no preferences set
        
        # Check if notification type is enabled
        if payload.notification_type not in preferences.enabled_types:
            return False
        
        # Check quiet hours
        if preferences.quiet_hours_start and preferences.quiet_hours_end:
            current_time = datetime.now().time()
            start_time = datetime.strptime(preferences.quiet_hours_start, "%H:%M").time()
            end_time = datetime.strptime(preferences.quiet_hours_end, "%H:%M").time()
            
            if start_time <= end_time:
                # Same day quiet hours
                if start_time <= current_time <= end_time:
                    return False
            else:
                # Overnight quiet hours
                if current_time >= start_time or current_time <= end_time:
                    return False
        
        return True

# Global service instance
push_notification_service = PushNotificationService()

# Helper functions for easy integration
async def send_order_notification(order_data: Dict[str, Any], target_users: List[str] = None):
    """Send order-related notification"""
    await push_notification_service.send_templated_notification(
        notification_type=NotificationType.ORDER_CREATED,
        template_data=order_data,
        target_users=target_users
    )

async def send_payment_notification(payment_data: Dict[str, Any], target_users: List[str] = None):
    """Send payment-related notification"""
    notification_type = (
        NotificationType.PAYMENT_COMPLETED 
        if payment_data.get("status") == "completed" 
        else NotificationType.PAYMENT_FAILED
    )
    
    await push_notification_service.send_templated_notification(
        notification_type=notification_type,
        template_data=payment_data,
        target_users=target_users
    )

async def send_kitchen_alert(alert_data: Dict[str, Any], restaurant_id: str):
    """Send kitchen alert notification"""
    await push_notification_service.send_templated_notification(
        notification_type=NotificationType.KITCHEN_ALERT,
        template_data=alert_data,
        target_restaurants=[restaurant_id]
    )

async def send_inventory_alert(inventory_data: Dict[str, Any], restaurant_id: str):
    """Send inventory alert notification"""
    await push_notification_service.send_templated_notification(
        notification_type=NotificationType.INVENTORY_LOW,
        template_data=inventory_data,
        target_restaurants=[restaurant_id]
    )

def get_push_service() -> PushNotificationService:
    """Get the global push notification service instance"""
    return push_notification_service