"""
Platform subscription management endpoints.
<<<<<<< HEAD
=======
"""
>>>>>>> parent of af057592 (fix: docstring syntax and formatting issues across backend)


"""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.core.database import get_db, Restaurant
from app.core.auth import get_current_platform_owner, User
from app.core.responses import APIResponseHelper
from app.models.subscription import SubscriptionPlan

router = APIRouter(prefix="/subscriptions", tags=["platform-subscriptions"])


@router.get("/summary")
async def get_subscription_summary(
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Get subscription plan distribution and revenue summary."""
    try:
        # Get plan distribution
        plan_distribution = db.query(
            Restaurant.subscription_plan,
            Restaurant.subscription_status,
            func.count(Restaurant.id).label('count')
        ).group_by(
            Restaurant.subscription_plan,
            Restaurant.subscription_status
        ).all()
        
        # Calculate monthly recurring revenue (MRR)
        active_subscriptions = db.query(Restaurant).filter(
            Restaurant.subscription_status == 'active'
        ).all()
        
        mrr = 0
        plan_revenue = {
            'alpha': {'count': 0, 'revenue': 0},
            'beta': {'count': 0, 'revenue': 0},
            'omega': {'count': 0, 'revenue': 0}
        }
        
        for restaurant in active_subscriptions:
            if restaurant.subscription_plan == 'beta':
                mrr += 49
                plan_revenue['beta']['count'] += 1
                plan_revenue['beta']['revenue'] += 49
            elif restaurant.subscription_plan == 'omega':
                mrr += 119
                plan_revenue['omega']['count'] += 1
                plan_revenue['omega']['revenue'] += 119
            else:  # alpha
                plan_revenue['alpha']['count'] += 1
        
        # Format distribution data
        distribution = {}
        for plan, status, count in plan_distribution:
            if plan not in distribution:
                distribution[plan] = {}
            distribution[plan][status] = count
        
        summary = {
            "monthly_recurring_revenue": mrr,
            "plan_revenue": plan_revenue,
            "distribution": distribution,
            "total_restaurants": db.query(Restaurant).count(),
            "active_subscriptions": len(active_subscriptions),
            "trial_subscriptions": db.query(Restaurant).filter(
                Restaurant.subscription_status == 'trial'
            ).count()
        }
        
        return APIResponseHelper.success(data=summary)
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to fetch subscription summary: {str(e)}",
            status_code=500
        )


@router.get("/expiring")
async def get_expiring_subscriptions(
    days: int = Query(30, ge=1, le=90),
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Get subscriptions expiring within specified days."""
    try:
        expiry_date = datetime.now() + timedelta(days=days)
        
        expiring = db.query(Restaurant).filter(
            and_(
                Restaurant.subscription_status.in_(['active', 'trial']),
                Restaurant.subscription_end_date <= expiry_date
            )
        ).order_by(Restaurant.subscription_end_date).all()
        
        data = []
        for restaurant in expiring:
            days_until_expiry = (restaurant.subscription_end_date - datetime.now()).days
            
            data.append({
                "id": str(restaurant.id),
                "name": restaurant.name,
                "email": restaurant.email,
                "subscription_plan": restaurant.subscription_plan,
                "subscription_status": restaurant.subscription_status,
                "expiry_date": restaurant.subscription_end_date.isoformat(),
                "days_until_expiry": days_until_expiry
            })
        
        return APIResponseHelper.success(
            data={
                "expiring_subscriptions": data,
                "total": len(data)
            }
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to fetch expiring subscriptions: {str(e)}",
            status_code=500
        )


@router.get("/churn-analysis")
async def get_churn_analysis(
    months: int = Query(6, ge=1, le=12),
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Analyze subscription churn over time."""
    try:
        start_date = datetime.now() - timedelta(days=months * 30)
        
        # Get cancellations by month
        cancellations = db.query(
            func.date_trunc('month', Restaurant.updated_at).label('month'),
            Restaurant.subscription_plan,
            func.count(Restaurant.id).label('count')
        ).filter(
            and_(
                Restaurant.subscription_status == 'cancelled',
                Restaurant.updated_at >= start_date
            )
        ).group_by(
            'month',
            Restaurant.subscription_plan
        ).all()
        
        # Get new subscriptions by month
        new_subscriptions = db.query(
            func.date_trunc('month', Restaurant.subscription_start_date).label('month'),
            Restaurant.subscription_plan,
            func.count(Restaurant.id).label('count')
        ).filter(
            Restaurant.subscription_start_date >= start_date
        ).group_by(
            'month',
            Restaurant.subscription_plan
        ).all()
        
        # Format data
        churn_data = {}
        for month, plan, count in cancellations:
            month_str = month.strftime('%Y-%m')
            if month_str not in churn_data:
                churn_data[month_str] = {
                    'cancellations': {},
                    'new_subscriptions': {},
                    'net_change': {}
                }
            churn_data[month_str]['cancellations'][plan] = count
        
        for month, plan, count in new_subscriptions:
            month_str = month.strftime('%Y-%m')
            if month_str not in churn_data:
                churn_data[month_str] = {
                    'cancellations': {},
                    'new_subscriptions': {},
                    'net_change': {}
                }
            churn_data[month_str]['new_subscriptions'][plan] = count
        
        # Calculate net change
        for month_str, data in churn_data.items():
            for plan in ['alpha', 'beta', 'omega']:
                new = data['new_subscriptions'].get(plan, 0)
                cancelled = data['cancellations'].get(plan, 0)
                data['net_change'][plan] = new - cancelled
        
        return APIResponseHelper.success(data=churn_data)
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to analyze churn: {str(e)}",
            status_code=500
        )


@router.post("/batch-update")
async def batch_update_subscriptions(
    restaurant_ids: List[str],
    plan: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Batch update subscription plans or statuses."""
    try:
        if not plan and not status:
            return APIResponseHelper.error(
                message="Either plan or status must be provided",
                status_code=400
            )
        
        # Validate inputs
        if plan and plan not in ['alpha', 'beta', 'omega']:
            return APIResponseHelper.error(
                message="Invalid plan. Must be alpha, beta, or omega",
                status_code=400
            )
        
        if status and status not in ['trial', 'active', 'cancelled', 'expired']:
            return APIResponseHelper.error(
                message="Invalid status",
                status_code=400
            )
        
        # Update restaurants
        updated_count = 0
        for restaurant_id in restaurant_ids:
            restaurant = db.query(Restaurant).filter(
                Restaurant.id == restaurant_id
            ).first()
            
            if restaurant:
                if plan:
                    restaurant.subscription_plan = plan
                if status:
                    restaurant.subscription_status = status
                    if status == 'active' and not restaurant.subscription_start_date:
                        restaurant.subscription_start_date = datetime.now()
                
                updated_count += 1
        
        db.commit()
        
        # Log the batch update
        from app.models.platform_audit import create_audit_log
        create_audit_log(
            db=db,
            user_id=current_user.id,
            action="batch_update_subscriptions",
            resource_type="restaurant",
            resource_id=",".join(restaurant_ids),
            details={
                "plan": plan,
                "status": status,
                "count": updated_count
            }
        )
        
        return APIResponseHelper.success(
            message=f"Updated {updated_count} restaurants",
            data={
                "updated_count": updated_count,
                "plan": plan,
                "status": status
            }
        )
        
    except Exception as e:
        db.rollback()
        return APIResponseHelper.error(
            message=f"Failed to batch update subscriptions: {str(e)}",
            status_code=500
        )