"""
Restaurant Switching API for Multi-Restaurant Owners
Only restaurant owners with multiple restaurants can use this endpoint


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.models import User, Restaurant, UserRestaurant
from app.core.dependencies import get_current_user
from app.core.response_helper import APIResponseHelper
from app.core.tenant_security import TenantSecurity
from app.core.security_monitor import security_monitor, SecurityEventType
from app.core.validators import validate_uuid_format

router = APIRouter()


@router.get("/my-restaurants")
async def get_my_restaurants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all restaurants accessible by the current user
    Only restaurant owners see multiple restaurants
    """
    # Platform owners don't need this endpoint
    if TenantSecurity.is_platform_owner(current_user):
        return APIResponseHelper.error(
            message="Platform owners should use the platform dashboard",
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    # Only restaurant owners can have multiple restaurants
    if current_user.role != "restaurant_owner":
        # Employees/managers only see their assigned restaurant
        if current_user.restaurant_id:
            restaurant = db.query(Restaurant).filter(
                Restaurant.id == current_user.restaurant_id
            ).first()
            
            if restaurant:
                return APIResponseHelper.success(
                    data={
                        "restaurants": [{
                            "id": str(restaurant.id),
                            "name": restaurant.name,
                            "is_current": True,
                            "is_primary": True,
                            "subscription_plan": restaurant.subscription_plan,
                            "subscription_status": restaurant.subscription_status
                        }],
                        "can_switch": False,
                        "total": 1
                    }
                )
        
        return APIResponseHelper.success(
            data={
                "restaurants": [],
                "can_switch": False,
                "total": 0
            }
        )
    
    # Get all restaurants for this owner
    user_restaurants = db.query(UserRestaurant).filter(
        UserRestaurant.user_id == current_user.id
    ).all()
    
    restaurants = []
    current_restaurant_id = str(current_user.current_restaurant_id) if current_user.current_restaurant_id else None
    
    # Add restaurants from user_restaurants table
    for ur in user_restaurants:
        restaurant = db.query(Restaurant).filter(
            Restaurant.id == ur.restaurant_id
        ).first()
        
        if restaurant:
            restaurants.append({
                "id": str(restaurant.id),
                "name": restaurant.name,
                "is_current": str(restaurant.id) == current_restaurant_id,
                "is_primary": ur.is_primary,
                "role": ur.role,
                "subscription_plan": restaurant.subscription_plan,
                "subscription_status": restaurant.subscription_status,
                "address": restaurant.address,
                "phone": restaurant.phone
            })
    
    # Also check legacy restaurant_id field
    if current_user.restaurant_id:
        # Check if this restaurant is already in the list
        legacy_id = str(current_user.restaurant_id)
        if not any(r["id"] == legacy_id for r in restaurants):
            restaurant = db.query(Restaurant).filter(
                Restaurant.id == current_user.restaurant_id
            ).first()
            
            if restaurant:
                restaurants.append({
                    "id": str(restaurant.id),
                    "name": restaurant.name,
                    "is_current": str(restaurant.id) == current_restaurant_id,
                    "is_primary": True,  # Legacy assignment is primary
                    "role": "owner",
                    "subscription_plan": restaurant.subscription_plan,
                    "subscription_status": restaurant.subscription_status,
                    "address": restaurant.address,
                    "phone": restaurant.phone
                })
    
    # Only show switching option if user has multiple restaurants
    can_switch = len(restaurants) > 1
    
    return APIResponseHelper.success(
        data={
            "restaurants": restaurants,
            "can_switch": can_switch,
            "total": len(restaurants),
            "current_restaurant_id": current_restaurant_id
        }
    )


@router.post("/switch/{restaurant_id}")
async def switch_restaurant(
    restaurant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Switch to a different restaurant
    Only restaurant owners with multiple restaurants can switch
    """
    # Validate restaurant_id format
    try:
        validate_uuid_format(restaurant_id)
    except ValueError:
        return APIResponseHelper.error(
            message="Invalid restaurant ID format",
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    # Only restaurant owners can switch
    if current_user.role != "restaurant_owner":
        return APIResponseHelper.error(
            message="Only restaurant owners can switch between restaurants",
            status_code=status.HTTP_403_FORBIDDEN
        )
    
    # Verify user has access to the target restaurant
    has_access = False
    
    # Check user_restaurants table
    user_restaurant = db.query(UserRestaurant).filter(
        UserRestaurant.user_id == current_user.id,
        UserRestaurant.restaurant_id == restaurant_id
    ).first()
    
    if user_restaurant:
        has_access = True
    
    # Check legacy restaurant_id
    elif current_user.restaurant_id and str(current_user.restaurant_id) == restaurant_id:
        has_access = True
    
    if not has_access:
        # Log unauthorized switch attempt
        await security_monitor.log_access_attempt(
            user=current_user,
            resource_type="restaurant_switch",
            resource_id=restaurant_id,
            action="switch",
            granted=False,
            ip_address="api",
            reason="User does not have access to target restaurant"
        )
        
        return APIResponseHelper.error(
            message="You don't have access to this restaurant",
            status_code=status.HTTP_403_FORBIDDEN
        )
    
    # Get restaurant details
    restaurant = db.query(Restaurant).filter(
        Restaurant.id == restaurant_id
    ).first()
    
    if not restaurant:
        return APIResponseHelper.error(
            message="Restaurant not found",
            status_code=status.HTTP_404_NOT_FOUND
        )
    
    # Update current restaurant with proper locking
    old_restaurant_id = current_user.current_restaurant_id
    
    try:
        # Use with_for_update() for row-level locking to prevent race conditions
        locked_user = db.query(User).filter(
            User.id == current_user.id
        ).with_for_update().first()
        
        if not locked_user:
            return APIResponseHelper.error(
                message="User not found",
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        locked_user.current_restaurant_id = restaurant_id
        locked_user.last_restaurant_switch = datetime.utcnow()
        
        db.commit()
        
        # Log successful switch
        await security_monitor.log_event(
            user=current_user,
            event_type="restaurant_switch",
            details={
                "from_restaurant_id": str(old_restaurant_id) if old_restaurant_id else None,
                "to_restaurant_id": restaurant_id,
                "restaurant_name": restaurant.name
            }
        )
        
        return APIResponseHelper.success(
            data={
                "message": f"Successfully switched to {restaurant.name}",
                "restaurant": {
                    "id": str(restaurant.id),
                    "name": restaurant.name,
                    "subscription_plan": restaurant.subscription_plan,
                    "subscription_status": restaurant.subscription_status
                }
            }
        )
        
    except Exception as e:
        db.rollback()
        await security_monitor.log_event(
            user=current_user,
            event_type=SecurityEventType.ERROR,
            details={
                "error": "Failed to switch restaurant",
                "restaurant_id": restaurant_id,
                "exception": str(e)
            }
        )
        return APIResponseHelper.error(
            message="Failed to switch restaurant",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@router.post("/assign-restaurant")
async def assign_restaurant_to_user(
    user_id: str,
    restaurant_id: str,
    role: str = "employee",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Assign a restaurant to a user (multi-restaurant support)
    Only restaurant owners can assign their restaurants to other users
    """
    # Validate role
    valid_roles = ["owner", "manager", "employee"]
    if role not in valid_roles:
        return APIResponseHelper.error(
            message=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    # Only restaurant owners and platform owners can assign restaurants
    if current_user.role not in ["restaurant_owner", "platform_owner"]:
        return APIResponseHelper.error(
            message="Only restaurant owners can assign restaurants to users",
            status_code=status.HTTP_403_FORBIDDEN
        )
    
    # Verify current user has access to this restaurant
    if not TenantSecurity.is_platform_owner(current_user):
        has_access = False
        
        # Check if user owns this restaurant
        owner_restaurant = db.query(UserRestaurant).filter(
            UserRestaurant.user_id == current_user.id,
            UserRestaurant.restaurant_id == restaurant_id,
            UserRestaurant.role == "owner"
        ).first()
        
        if owner_restaurant or (current_user.restaurant_id and str(current_user.restaurant_id) == restaurant_id):
            has_access = True
        
        if not has_access:
            return APIResponseHelper.error(
                message="You can only assign users to restaurants you own",
                status_code=status.HTTP_403_FORBIDDEN
            )
    
    # Check if assignment already exists
    existing = db.query(UserRestaurant).filter(
        UserRestaurant.user_id == user_id,
        UserRestaurant.restaurant_id == restaurant_id
    ).first()
    
    if existing:
        return APIResponseHelper.error(
            message="User is already assigned to this restaurant",
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    # Create new assignment
    new_assignment = UserRestaurant(
        user_id=user_id,
        restaurant_id=restaurant_id,
        role=role,
        assigned_by=current_user.id,
        is_primary=False  # New assignments are not primary by default
    )
    
    try:
        db.add(new_assignment)
        db.commit()
        
        # Log assignment
        await security_monitor.log_event(
            user=current_user,
            event_type="restaurant_assignment",
            details={
                "assigned_user_id": user_id,
                "restaurant_id": restaurant_id,
                "role": role
            }
        )
        
        return APIResponseHelper.success(
            data={
                "message": "User successfully assigned to restaurant",
                "assignment": {
                    "user_id": user_id,
                    "restaurant_id": restaurant_id,
                    "role": role
                }
            }
        )
        
    except Exception as e:
        db.rollback()
        return APIResponseHelper.error(
            message="Failed to assign user to restaurant",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )