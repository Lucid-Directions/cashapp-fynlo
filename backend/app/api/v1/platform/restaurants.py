"""
Platform restaurant management endpoints.
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db, Restaurant, User
from app.core.auth import get_current_platform_owner
from app.core.responses import APIResponseHelper
from app.schemas.restaurant import RestaurantResponse
from app.core.security_utils import sanitize_sql_like_pattern

router = APIRouter(prefix="/restaurants", tags=["platform-restaurants"])


@router.get("/")
async def list_all_restaurants(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    subscription_plan: Optional[str] = None,
    subscription_status: Optional[str] = None,
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """List all restaurants on the platform with filtering."""
    try:
        query = db.query(Restaurant)
        
        # Apply filters
        if search:
            sanitized_search = sanitize_sql_like_pattern(search)
            query = query.filter(
                or_(
                    Restaurant.name.ilike(f"%{sanitized_search}%"),
                    Restaurant.email.ilike(f"%{sanitized_search}%"),
                    Restaurant.phone.ilike(f"%{sanitized_search}%")
                )
            )
        
        if subscription_plan:
            query = query.filter(Restaurant.subscription_plan == subscription_plan)
        
        if subscription_status:
            query = query.filter(Restaurant.subscription_status == subscription_status)
        
        # Get total count
        total = query.count()
        
        # Get paginated results
        restaurants = query.offset(skip).limit(limit).all()
        
        # Format response
        data = []
        for restaurant in restaurants:
            # Get user count
            user_count = db.query(User).filter(
                User.restaurant_id == restaurant.id
            ).count()
            
            data.append({
                "id": str(restaurant.id),
                "name": restaurant.name,
                "email": restaurant.email,
                "phone": restaurant.phone,
                "subscription_plan": restaurant.subscription_plan,
                "subscription_status": restaurant.subscription_status,
                "user_count": user_count,
                "created_at": restaurant.created_at.isoformat(),
                "is_active": restaurant.is_active
            })
        
        return APIResponseHelper.success(
            data={
                "restaurants": data,
                "total": total,
                "skip": skip,
                "limit": limit
            }
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to fetch restaurants: {str(e)}",
            status_code=500
        )


@router.get("/{restaurant_id}")
async def get_restaurant_details(
    restaurant_id: str,
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific restaurant."""
    try:
        restaurant = db.query(Restaurant).filter(
            Restaurant.id == restaurant_id
        ).first()
        
        if not restaurant:
            return APIResponseHelper.error(
                message="Restaurant not found",
                status_code=404
            )
        
        # Get additional metrics
        user_count = db.query(User).filter(
            User.restaurant_id == restaurant.id
        ).count()
        
        # Get revenue last 30 days
        from app.core.database import Order
        from sqlalchemy import func
        revenue_30d = db.query(
            func.sum(Order.total_amount)
        ).filter(
            Order.restaurant_id == restaurant.id,
            Order.created_at >= datetime.now() - timedelta(days=30)
        ).scalar() or 0
        
        data = {
            "id": str(restaurant.id),
            "name": restaurant.name,
            "email": restaurant.email,
            "phone": restaurant.phone,
            "address": restaurant.address,
            "subscription_plan": restaurant.subscription_plan,
            "subscription_status": restaurant.subscription_status,
            "subscription_start_date": restaurant.subscription_start_date.isoformat() if restaurant.subscription_start_date else None,
            "subscription_end_date": restaurant.subscription_end_date.isoformat() if restaurant.subscription_end_date else None,
            "config": restaurant.config or {},
            "settings": restaurant.settings or {},
            "metrics": {
                "user_count": user_count,
                "revenue_30d": float(revenue_30d),
                "transaction_fees_30d": float(revenue_30d) * 0.01
            },
            "created_at": restaurant.created_at.isoformat(),
            "updated_at": restaurant.updated_at.isoformat(),
            "is_active": restaurant.is_active
        }
        
        return APIResponseHelper.success(data=data)
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to fetch restaurant details: {str(e)}",
            status_code=500
        )


@router.put("/{restaurant_id}/subscription")
async def update_restaurant_subscription(
    restaurant_id: str,
    plan: str = Query(..., regex="^(alpha|beta|omega)$"),
    status: str = Query(..., regex="^(trial|active|cancelled|expired)$"),
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Update a restaurant's subscription plan or status."""
    try:
        restaurant = db.query(Restaurant).filter(
            Restaurant.id == restaurant_id
        ).first()
        
        if not restaurant:
            return APIResponseHelper.error(
                message="Restaurant not found",
                status_code=404
            )
        
        # Update subscription
        restaurant.subscription_plan = plan
        restaurant.subscription_status = status
        
        if status == "active" and not restaurant.subscription_start_date:
            restaurant.subscription_start_date = datetime.now()
        
        db.commit()
        
        # Log the change
        from app.models.platform_audit import create_audit_log
        create_audit_log(
            db=db,
            user_id=current_user.id,
            action="update_subscription",
            resource_type="restaurant",
            resource_id=restaurant_id,
            details={
                "plan": plan,
                "status": status
            }
        )
        
        return APIResponseHelper.success(
            message="Subscription updated successfully",
            data={
                "restaurant_id": restaurant_id,
                "subscription_plan": plan,
                "subscription_status": status
            }
        )
        
    except Exception as e:
        db.rollback()
        return APIResponseHelper.error(
            message=f"Failed to update subscription: {str(e)}",
            status_code=500
        )


@router.put("/{restaurant_id}/status")
async def toggle_restaurant_status(
    restaurant_id: str,
    is_active: bool,
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Enable or disable a restaurant."""
    try:
        restaurant = db.query(Restaurant).filter(
            Restaurant.id == restaurant_id
        ).first()
        
        if not restaurant:
            return APIResponseHelper.error(
                message="Restaurant not found",
                status_code=404
            )
        
        restaurant.is_active = is_active
        db.commit()
        
        # Log the change
        from app.models.platform_audit import create_audit_log
        create_audit_log(
            db=db,
            user_id=current_user.id,
            action="toggle_status",
            resource_type="restaurant",
            resource_id=restaurant_id,
            details={
                "is_active": is_active
            }
        )
        
        return APIResponseHelper.success(
            message=f"Restaurant {'enabled' if is_active else 'disabled'} successfully",
            data={
                "restaurant_id": restaurant_id,
                "is_active": is_active
            }
        )
        
    except Exception as e:
        db.rollback()
        return APIResponseHelper.error(
            message=f"Failed to update restaurant status: {str(e)}",
            status_code=500
        )