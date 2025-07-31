"""
Safe Restaurant Deletion Endpoint
Validates that a restaurant can be safely deleted without breaking critical dependencies
"""

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime, timedelta
from typing import Optional, List, Dict

from app.core.database import get_db, Restaurant, User, Order, Payment, InventoryItem, UserRestaurant
from app.core.auth import get_current_user
from app.core.tenant_security import TenantSecurity
from app.core.response_helper import APIResponseHelper
from app.core.security_monitor import security_monitor, SecurityEventType
from app.core.validators import validate_uuid_format

router = APIRouter()


class DeletionCheckResult:
    """Result of deletion safety check"""
    def __init__(self):
        self.can_delete = True
        self.warnings = []
        self.blockers = []
        self.stats = {}


@router.delete("/{restaurant_id}")
async def delete_restaurant(
    restaurant_id: str,
    force: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Safely delete a restaurant with dependency checks
    
    Args:
        restaurant_id: Restaurant to delete
        force: Force deletion even with warnings (requires platform owner)
        current_user: Current authenticated user
        db: Database session
    
    Returns:
        Success response or error with dependency information
    """
    # Validate restaurant_id format
    try:
        validate_uuid_format(restaurant_id)
    except ValueError:
        raise ValidationException(message="Invalid restaurant ID format")
    
    # Only platform owners can delete restaurants
    if not TenantSecurity.is_platform_owner(current_user):
        raise FynloException(message="Only platform owners can delete restaurants")
    
    # Get restaurant
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise NotFoundException(message="Restaurant not found")
    
    # Perform deletion safety checks
    check_result = await check_deletion_safety(restaurant_id, db)
    
    # Log the deletion attempt
    await security_monitor.log_event(
        user=current_user,
        event_type=SecurityEventType.ADMIN_ACTION,
        details={
            "action": "restaurant_deletion_attempt",
            "restaurant_id": restaurant_id,
            "restaurant_name": restaurant.name,
            "can_delete": check_result.can_delete,
            "blockers": check_result.blockers,
            "warnings": check_result.warnings,
            "force": force
        }
    )
    
    # If there are blockers, deletion is not allowed
    if check_result.blockers:
        return APIResponseHelper.error(
            message="Restaurant deletion blocked due to critical dependencies",
            status_code=status.HTTP_409_CONFLICT,
            data={
                "blockers": check_result.blockers,
                "warnings": check_result.warnings,
                "stats": check_result.stats
            }
        )
    
    # If there are warnings but no blockers
    if check_result.warnings and not force:
        return APIResponseHelper.error(
            message="Restaurant has dependencies. Use force=true to delete anyway (platform owner only)",
            status_code=status.HTTP_409_CONFLICT,
            data={
                "warnings": check_result.warnings,
                "stats": check_result.stats,
                "can_force_delete": TenantSecurity.is_platform_owner(current_user)
            }
        )
    
    # Proceed with deletion
    try:
        # Soft delete - mark as inactive first
        restaurant.is_active = False
        restaurant.deleted_at = datetime.utcnow()
        restaurant.deleted_by = current_user.id
        db.commit()
        
        # Log successful deletion
        await security_monitor.log_event(
            user=current_user,
            event_type=SecurityEventType.ADMIN_ACTION,
            details={
                "action": "restaurant_deleted",
                "restaurant_id": restaurant_id,
                "restaurant_name": restaurant.name,
                "deletion_type": "soft_delete",
                "forced": force
            }
        )
        
        return APIResponseHelper.success(
            message=f"Restaurant '{restaurant.name}' has been deactivated",
            data={
                "restaurant_id": restaurant_id,
                "deletion_type": "soft_delete",
                "warnings_overridden": check_result.warnings if force else [],
                "stats": check_result.stats
            }
        )
        
    except Exception as e:
        db.rollback()
        await security_monitor.log_event(
            user=current_user,
            event_type=SecurityEventType.ERROR,
            details={
                "action": "restaurant_deletion_failed",
                "restaurant_id": restaurant_id,
                "error": str(e)
            }
        )
        raise FynloException(message="Failed to delete restaurant")


async def check_deletion_safety(restaurant_id: str, db: Session) -> DeletionCheckResult:
    """
    Check if a restaurant can be safely deleted
    
    Returns DeletionCheckResult with:
    - blockers: Critical issues that prevent deletion
    - warnings: Non-critical issues that should be reviewed
    - stats: Statistics about the restaurant's data
    """
    result = DeletionCheckResult()
    
    # Check for active orders in the last 24 hours
    recent_cutoff = datetime.utcnow() - timedelta(hours=24)
    active_orders = db.query(Order).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= recent_cutoff,
            Order.status.in_(["pending", "preparing", "ready"])
        )
    ).count()
    
    if active_orders > 0:
        result.blockers.append(f"Restaurant has {active_orders} active orders in the last 24 hours")
        result.can_delete = False
    
    result.stats["active_orders"] = active_orders
    
    # Check for pending payments
    pending_payments = db.query(Payment).filter(
        and_(
            Payment.restaurant_id == restaurant_id,
            Payment.status == "pending"
        )
    ).count()
    
    if pending_payments > 0:
        result.blockers.append(f"Restaurant has {pending_payments} pending payments")
        result.can_delete = False
    
    result.stats["pending_payments"] = pending_payments
    
    # Check for active employees
    active_employees = db.query(User).filter(
        and_(
            User.restaurant_id == restaurant_id,
            User.is_active == True,
            User.role.in_(["manager", "employee"])
        )
    ).count()
    
    if active_employees > 0:
        result.warnings.append(f"Restaurant has {active_employees} active employees who will lose access")
    
    result.stats["active_employees"] = active_employees
    
    # Check for inventory with value
    inventory_value = db.query(func.sum(InventoryItem.quantity * InventoryItem.unit_cost)).filter(
        and_(
            InventoryItem.restaurant_id == restaurant_id,
            InventoryItem.quantity > 0
        )
    ).scalar() or 0
    
    if inventory_value > 100:  # Threshold for significant inventory
        result.warnings.append(f"Restaurant has inventory worth £{inventory_value:.2f}")
    
    result.stats["inventory_value"] = float(inventory_value)
    
    # Check for recent revenue
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= week_ago,
            Order.status == "completed"
        )
    ).scalar() or 0
    
    if recent_revenue > 0:
        result.warnings.append(f"Restaurant had £{recent_revenue:.2f} in revenue in the last 7 days")
    
    result.stats["recent_revenue"] = float(recent_revenue)
    
    # Check for total historical data
    total_orders = db.query(Order).filter(Order.restaurant_id == restaurant_id).count()
    total_customers = db.query(func.count(func.distinct(Order.customer_id))).filter(
        Order.restaurant_id == restaurant_id
    ).scalar() or 0
    
    if total_orders > 1000:
        result.warnings.append(f"Restaurant has {total_orders} historical orders")
    
    result.stats["total_orders"] = total_orders
    result.stats["total_customers"] = total_customers
    
    # Check if this is the user's only restaurant
    # Get all users associated with this restaurant
    restaurant_users = db.query(User).filter(
        User.restaurant_id == restaurant_id
    ).all()
    
    for user in restaurant_users:
        # Check if user has access to other restaurants
        other_restaurants = db.query(UserRestaurant).filter(
            and_(
                UserRestaurant.user_id == user.id,
                UserRestaurant.restaurant_id != restaurant_id
            )
        ).count()
        
        if other_restaurants == 0 and user.role == "restaurant_owner":
            result.warnings.append(f"User {user.email} will have no restaurants after deletion")
    
    return result


@router.post("/{restaurant_id}/archive")
async def archive_restaurant(
    restaurant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Archive a restaurant (soft delete with data retention)
    This is safer than deletion as it preserves all data
    """
    # Validate restaurant_id format
    try:
        validate_uuid_format(restaurant_id)
    except ValueError:
        raise ValidationException(message="Invalid restaurant ID format")
    
    # Check permissions
    if not TenantSecurity.is_platform_owner(current_user):
        # Restaurant owners can archive their own restaurants
        await TenantSecurity.validate_restaurant_access(
            current_user,
            restaurant_id,
            "archive",
            db=db
        )
        
        # Additional check: restaurant owners can only archive if they own it
        if current_user.role != "restaurant_owner":
            raise FynloException(message="Only restaurant owners or platform owners can archive restaurants")
    
    # Get restaurant
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise NotFoundException(message="Restaurant not found")
    
    if not restaurant.is_active:
        return APIResponseHelper.error(
            message="Restaurant is already archived",
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Archive the restaurant
        restaurant.is_active = False
        restaurant.archived_at = datetime.utcnow()
        restaurant.archived_by = current_user.id
        restaurant.archive_reason = "User requested archive"
        
        # Deactivate all employees
        db.query(User).filter(
            and_(
                User.restaurant_id == restaurant_id,
                User.role.in_(["manager", "employee"])
            )
        ).update({"is_active": False})
        
        db.commit()
        
        # Log the archive action
        await security_monitor.log_event(
            user=current_user,
            event_type=SecurityEventType.ADMIN_ACTION,
            details={
                "action": "restaurant_archived",
                "restaurant_id": restaurant_id,
                "restaurant_name": restaurant.name
            }
        )
        
        return APIResponseHelper.success(
            message=f"Restaurant '{restaurant.name}' has been archived",
            data={
                "restaurant_id": restaurant_id,
                "archived_at": restaurant.archived_at.isoformat(),
                "archive_type": "soft_archive"
            }
        )
        
    except Exception as e:
        db.rollback()
        raise FynloException(message="Failed to archive restaurant")