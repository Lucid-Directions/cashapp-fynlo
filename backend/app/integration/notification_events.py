"""
Notification Event Integration for Fynlo POS
Connects backend services with push notification sending
<<<<<<< HEAD
=======
"""
>>>>>>> parent of af057592 (fix: docstring syntax and formatting issues across backend)


"""
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncio

from app.core.push_notifications import (
    get_push_service,
    send_order_notification,
    send_payment_notification,
    send_kitchen_alert,
    send_inventory_alert,
    NotificationType
)

class NotificationEventService:
    """Service to integrate backend events with push notifications"""
    
    @staticmethod
    async def on_order_created(order_data: Dict[str, Any]):
        """Handle new order creation event"""
        try:
            # Prepare notification data
            notification_data = {
                "order_id": str(order_data["id"]),
                "order_number": order_data.get("order_number", "N/A"),
                "total_amount": order_data.get("total_amount", 0),
                "customer_name": order_data.get("customer_name", "Guest"),
                "restaurant_id": str(order_data["restaurant_id"])
            }
            
            # Send to kitchen staff and managers
            push_service = get_push_service()
            await push_service.send_templated_notification(
                notification_type=NotificationType.ORDER_CREATED,
                template_data=notification_data,
                target_restaurants=[str(order_data["restaurant_id"])]
            )
            
        except Exception as e:
            print(f"Failed to send order created notification: {str(e)}")
    
    @staticmethod
    async def on_order_status_changed(order_id: str, restaurant_id: str, old_status: str, new_status: str, order_data: Dict[str, Any]):
        """Handle order status change event"""
        try:
            # Prepare notification data
            notification_data = {
                "order_id": order_id,
                "order_number": order_data.get("order_number", "N/A"),
                "status": new_status,
                "restaurant_id": restaurant_id
            }
            
            # Send to relevant staff based on status change
            push_service = get_push_service()
            
            # Different notifications for different status changes
            if new_status == "ready":
                # Notify customer if they have the app
                customer_data = notification_data.copy()
                customer_data["pickup_code"] = order_data.get("pickup_code", "")
                
                await push_service.send_templated_notification(
                    notification_type=NotificationType.CUSTOMER_ORDER_READY,
                    template_data=customer_data,
                    target_users=[order_data.get("customer_id")] if order_data.get("customer_id") else None
                )
            
            # Always notify restaurant staff
            await push_service.send_templated_notification(
                notification_type=NotificationType.ORDER_STATUS_CHANGED,
                template_data=notification_data,
                target_restaurants=[restaurant_id]
            )
            
        except Exception as e:
            print(f"Failed to send order status change notification: {str(e)}")
    
    @staticmethod
    async def on_payment_completed(payment_data: Dict[str, Any]):
        """Handle payment completion event"""
        try:
            # Prepare notification data
            notification_data = {
                "payment_id": str(payment_data["id"]),
                "order_id": str(payment_data["order_id"]),
                "order_number": payment_data.get("order_number", "N/A"),
                "amount": payment_data.get("amount", 0),
                "restaurant_id": str(payment_data["restaurant_id"])
            }
            
            # Send to managers and cashiers
            push_service = get_push_service()
            await push_service.send_templated_notification(
                notification_type=NotificationType.PAYMENT_COMPLETED,
                template_data=notification_data,
                target_restaurants=[str(payment_data["restaurant_id"])]
            )
            
        except Exception as e:
            print(f"Failed to send payment completed notification: {str(e)}")
    
    @staticmethod
    async def on_payment_failed(payment_data: Dict[str, Any]):
        """Handle payment failure event"""
        try:
            # Prepare notification data
            notification_data = {
                "payment_id": str(payment_data["id"]),
                "order_id": str(payment_data["order_id"]),
                "order_number": payment_data.get("order_number", "N/A"),
                "amount": payment_data.get("amount", 0),
                "error_reason": payment_data.get("error_message", "Payment processing failed"),
                "restaurant_id": str(payment_data["restaurant_id"])
            }
            
            # Send critical alert to managers
            push_service = get_push_service()
            await push_service.send_templated_notification(
                notification_type=NotificationType.PAYMENT_FAILED,
                template_data=notification_data,
                target_restaurants=[str(payment_data["restaurant_id"])]
            )
            
        except Exception as e:
            print(f"Failed to send payment failed notification: {str(e)}")
    
    @staticmethod
    async def on_inventory_low(product_id: str, restaurant_id: str, product_name: str, current_stock: int, min_stock: int):
        """Handle low inventory event"""
        try:
            # Prepare notification data
            notification_data = {
                "product_id": product_id,
                "product_name": product_name,
                "current_stock": current_stock,
                "min_stock": min_stock,
                "restaurant_id": restaurant_id
            }
            
            # Send to managers and inventory staff
            push_service = get_push_service()
            await push_service.send_templated_notification(
                notification_type=NotificationType.INVENTORY_LOW,
                template_data=notification_data,
                target_restaurants=[restaurant_id]
            )
            
        except Exception as e:
            print(f"Failed to send inventory low notification: {str(e)}")
    
    @staticmethod
    async def on_kitchen_alert(order_id: str, restaurant_id: str, alert_type: str, alert_message: str):
        """Handle kitchen alert event"""
        try:
            # Prepare notification data
            notification_data = {
                "order_id": order_id,
                "alert_type": alert_type,
                "alert_message": alert_message,
                "restaurant_id": restaurant_id
            }
            
            # Send to kitchen staff and managers
            push_service = get_push_service()
            await push_service.send_templated_notification(
                notification_type=NotificationType.KITCHEN_ALERT,
                template_data=notification_data,
                target_restaurants=[restaurant_id]
            )
            
        except Exception as e:
            print(f"Failed to send kitchen alert notification: {str(e)}")
    
    @staticmethod
    async def on_shift_reminder(user_id: str, restaurant_id: str, shift_data: Dict[str, Any]):
        """Handle shift reminder event"""
        try:
            # Calculate time until shift
            shift_start = datetime.fromisoformat(shift_data["start_time"].replace("Z", "+00:00"))
            time_until = int((shift_start - datetime.now()).total_seconds() / 60)
            
            # Prepare notification data
            notification_data = {
                "shift_id": str(shift_data["id"]),
                "shift_start": shift_data["start_time"],
                "time_until": time_until,
                "restaurant_id": restaurant_id
            }
            
            # Send to specific user
            push_service = get_push_service()
            await push_service.send_templated_notification(
                notification_type=NotificationType.SHIFT_REMINDER,
                template_data=notification_data,
                target_users=[user_id]
            )
            
        except Exception as e:
            print(f"Failed to send shift reminder notification: {str(e)}")
    
    @staticmethod
    async def on_system_maintenance(restaurant_ids: List[str], maintenance_data: Dict[str, Any]):
        """Handle system maintenance event"""
        try:
            # Prepare notification data
            notification_data = {
                "maintenance_type": maintenance_data.get("type", "System Update"),
                "maintenance_message": maintenance_data.get("message", "System maintenance in progress"),
                "estimated_duration": maintenance_data.get("duration", "30 minutes")
            }
            
            # Send to all affected restaurants
            push_service = get_push_service()
            await push_service.send_templated_notification(
                notification_type=NotificationType.SYSTEM_MAINTENANCE,
                template_data=notification_data,
                target_restaurants=restaurant_ids
            )
            
        except Exception as e:
            print(f"Failed to send system maintenance notification: {str(e)}")
    
    @staticmethod
    async def on_delivery_update(order_id: str, customer_id: str, delivery_status: str, estimated_arrival: Optional[str] = None):
        """Handle delivery status update event"""
        try:
            # Prepare notification data
            notification_data = {
                "order_id": order_id,
                "delivery_status": delivery_status,
                "estimated_arrival": estimated_arrival or "Unknown"
            }
            
            # Send to customer
            push_service = get_push_service()
            await push_service.send_templated_notification(
                notification_type=NotificationType.DELIVERY_UPDATE,
                template_data=notification_data,
                target_users=[customer_id]
            )
            
        except Exception as e:
            print(f"Failed to send delivery update notification: {str(e)}")
    
    @staticmethod
    async def schedule_shift_reminders(restaurant_id: str, shifts: List[Dict[str, Any]]):
        """Schedule shift reminder notifications"""
        try:
            for shift in shifts:
                # Calculate reminder time (30 minutes before shift)
                shift_start = datetime.fromisoformat(shift["start_time"].replace("Z", "+00:00"))
                reminder_time = shift_start - timedelta(minutes=30)
                
                if reminder_time > datetime.now():
                    # Schedule the reminder
                    delay = (reminder_time - datetime.now()).total_seconds()
                    
                    # In a real implementation, this would use a task queue like Celery
                    # For now, we'll use asyncio.create_task for demonstration
                    asyncio.create_task(
                        NotificationEventService._delayed_shift_reminder(
                            delay, shift["user_id"], restaurant_id, shift
                        )
                    )
            
        except Exception as e:
            print(f"Failed to schedule shift reminders: {str(e)}")
    
    @staticmethod
    async def _delayed_shift_reminder(delay: float, user_id: str, restaurant_id: str, shift_data: Dict[str, Any]):
        """Send delayed shift reminder"""
        try:
            await asyncio.sleep(delay)
            await NotificationEventService.on_shift_reminder(user_id, restaurant_id, shift_data)
        except Exception as e:
            print(f"Failed to send delayed shift reminder: {str(e)}")

# Global event service instance
notification_events = NotificationEventService()

# Helper functions for easy integration
async def emit_order_created_notification(order_data: Dict[str, Any]):
    """Emit order created notification"""
    await notification_events.on_order_created(order_data)

async def emit_order_status_notification(order_id: str, restaurant_id: str, old_status: str, new_status: str, order_data: Dict[str, Any]):
    """Emit order status change notification"""
    await notification_events.on_order_status_changed(order_id, restaurant_id, old_status, new_status, order_data)

async def emit_payment_notification(payment_data: Dict[str, Any], success: bool = True):
    """Emit payment notification"""
    if success:
        await notification_events.on_payment_completed(payment_data)
    else:
        await notification_events.on_payment_failed(payment_data)

async def emit_inventory_notification(product_id: str, restaurant_id: str, product_name: str, current_stock: int, min_stock: int):
    """Emit inventory low notification"""
    await notification_events.on_inventory_low(product_id, restaurant_id, product_name, current_stock, min_stock)

async def emit_kitchen_alert_notification(order_id: str, restaurant_id: str, alert_type: str, alert_message: str):
    """Emit kitchen alert notification"""
    await notification_events.on_kitchen_alert(order_id, restaurant_id, alert_type, alert_message)

async def emit_system_maintenance_notification(restaurant_ids: List[str], maintenance_data: Dict[str, Any]):
    """Emit system maintenance notification"""
    await notification_events.on_system_maintenance(restaurant_ids, maintenance_data)

async def schedule_shift_reminder_notifications(restaurant_id: str, shifts: List[Dict[str, Any]]):
    """Schedule shift reminder notifications"""
    await notification_events.schedule_shift_reminders(restaurant_id, shifts)