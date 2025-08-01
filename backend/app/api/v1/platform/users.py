"""
Platform user management endpoints.
"""


"""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.core.database import get_db, User, Restaurant
from app.core.auth import get_current_platform_owner
from app.core.responses import APIResponseHelper
from app.core.security_utils import sanitize_sql_like_pattern

router = APIRouter(prefix="/users", tags=["platform-users"])


@router.get("/")
async def list_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    restaurant_id: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """List all users across the platform with filtering."""
    try:
        query = db.query(User).join(Restaurant)
        
        # Apply filters
        if search:
            sanitized_search = sanitize_sql_like_pattern(search)
            query = query.filter(
                or_(
                    User.email.ilike(f"%{sanitized_search}%"),
                    User.first_name.ilike(f"%{sanitized_search}%"),
                    User.last_name.ilike(f"%{sanitized_search}%")
                )
            )
        
        if restaurant_id:
            query = query.filter(User.restaurant_id == restaurant_id)
        
        if role:
            query = query.filter(User.role == role)
        
        if is_active is not None:
            query = query.filter(User.is_active == is_active)
        
        # Get total count
        total = query.count()
        
        # Get paginated results
        users = query.offset(skip).limit(limit).all()
        
        # Format response
        data = []
        for user in users:
            restaurant = db.query(Restaurant).filter(
                Restaurant.id == user.restaurant_id
            ).first()
            
            data.append({
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "restaurant": {
                    "id": str(restaurant.id),
                    "name": restaurant.name
                } if restaurant else None,
                "is_active": user.is_active,
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "created_at": user.created_at.isoformat()
            })
        
        return APIResponseHelper.success(
            data={
                "users": data,
                "total": total,
                "skip": skip,
                "limit": limit
            }
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to fetch users: {str(e)}",
            status_code=500
        )


@router.get("/activity-summary")
async def get_user_activity_summary(
    days: int = Query(30, ge=1, le=90),
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Get user activity summary across the platform."""
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Total users
        total_users = db.query(User).count()
        
        # Active users (logged in within period)
        active_users = db.query(User).filter(
            User.last_login >= cutoff_date
        ).count()
        
        # New users
        new_users = db.query(User).filter(
            User.created_at >= cutoff_date
        ).count()
        
        # Users by role
        users_by_role = db.query(
            User.role,
            func.count(User.id).label('count')
        ).group_by(User.role).all()
        
        # Users by restaurant subscription plan
        users_by_plan = db.query(
            Restaurant.subscription_plan,
            func.count(User.id).label('count')
        ).join(
            User, User.restaurant_id == Restaurant.id
        ).group_by(
            Restaurant.subscription_plan
        ).all()
        
        # Daily active users trend
        daily_active = db.query(
            func.date(User.last_login).label('date'),
            func.count(func.distinct(User.id)).label('count')
        ).filter(
            User.last_login >= cutoff_date
        ).group_by(
            func.date(User.last_login)
        ).all()
        
        summary = {
            "total_users": total_users,
            "active_users": active_users,
            "new_users": new_users,
            "activity_rate": round(active_users / total_users * 100, 2) if total_users > 0 else 0,
            "users_by_role": {role: count for role, count in users_by_role},
            "users_by_plan": {plan: count for plan, count in users_by_plan},
            "daily_active_trend": [
                {"date": date.isoformat(), "count": count}
                for date, count in daily_active
            ]
        }
        
        return APIResponseHelper.success(data=summary)
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to fetch activity summary: {str(e)}",
            status_code=500
        )


@router.put("/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    is_active: bool,
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Enable or disable a user account."""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            return APIResponseHelper.error(
                message="User not found",
                status_code=404
            )
        
        # Don't allow disabling platform owners
        if user.role == 'platform_owner' and not is_active:
            return APIResponseHelper.error(
                message="Cannot disable platform owner accounts",
                status_code=403
            )
        
        user.is_active = is_active
        db.commit()
        
        # Log the change
        from app.models.platform_audit import create_audit_log
        create_audit_log(
            db=db,
            user_id=current_user.id,
            action="toggle_user_status",
            resource_type="user",
            resource_id=user_id,
            details={
                "is_active": is_active
            }
        )
        
        return APIResponseHelper.success(
            message=f"User {'enabled' if is_active else 'disabled'} successfully",
            data={
                "user_id": user_id,
                "is_active": is_active
            }
        )
        
    except Exception as e:
        db.rollback()
        return APIResponseHelper.error(
            message=f"Failed to update user status: {str(e)}",
            status_code=500
        )


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Permanently delete a user account."""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            return APIResponseHelper.error(
                message="User not found",
                status_code=404
            )
        
        # Don't allow deleting platform owners
        if user.role == 'platform_owner':
            return APIResponseHelper.error(
                message="Cannot delete platform owner accounts",
                status_code=403
            )
        
        # Don't allow self-deletion
        if user.id == current_user.id:
            return APIResponseHelper.error(
                message="Cannot delete your own account",
                status_code=403
            )
        
        # Store info for audit log
        user_email = user.email
        restaurant_id = user.restaurant_id
        
        # Delete user
        db.delete(user)
        db.commit()
        
        # Log the deletion
        from app.models.platform_audit import create_audit_log
        create_audit_log(
            db=db,
            user_id=current_user.id,
            action="delete_user",
            resource_type="user",
            resource_id=user_id,
            details={
                "deleted_email": user_email,
                "restaurant_id": str(restaurant_id)
            }
        )
        
        return APIResponseHelper.success(
            message="User deleted successfully"
        )
        
    except Exception as e:
        db.rollback()
        return APIResponseHelper.error(
            message=f"Failed to delete user: {str(e)}",
            status_code=500
        )