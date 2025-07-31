"""
Platform analytics endpoints for dashboard insights.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query 
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc

from app.core.database import get_db, Restaurant, Order, Payment, User
from app.core.auth import get_current_platform_owner
from app.core.cache import get_cached_data_async, cache_data
from app.core.responses import APIResponseHelper

router = APIRouter(prefix="/analytics", tags=["platform-analytics"])


@router.get("/overview")
async def get_platform_overview(
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Get platform-wide analytics overview."""
    try:
        # Check cache first
        cache_key = "platform:analytics:overview"
        cached_data = await get_cached_data_async(cache_key)
        if cached_data:
            return APIResponseHelper.success(data=cached_data)

        # Calculate metrics
        today = datetime.now().date()
        thirty_days_ago = today - timedelta(days=30)
        
        # Total restaurants
        total_restaurants = db.query(Restaurant).count()
        active_restaurants = db.query(Restaurant).filter(
            Restaurant.subscription_status == 'active'
        ).count()
        
        # Revenue metrics
        total_revenue = db.query(func.sum(Order.total_amount)).filter(
            Order.created_at >= thirty_days_ago
        ).scalar() or 0
        
        # Transaction fees (1% of all transactions)
        transaction_fees = float(total_revenue) * 0.01
        
        # Subscription revenue
        subscription_revenue = db.query(
            func.sum(
                func.case(
                    (Restaurant.subscription_plan == 'beta', 49),
                    (Restaurant.subscription_plan == 'omega', 119),
                    else_=0
                )
            )
        ).filter(
            Restaurant.subscription_status == 'active'
        ).scalar() or 0
        
        # User metrics
        total_users = db.query(User).count()
        active_users = db.query(User).filter(
            User.last_login >= thirty_days_ago
        ).count()
        
        # Order metrics
        total_orders = db.query(Order).filter(
            Order.created_at >= thirty_days_ago
        ).count()
        
        overview = {
            "restaurants": {
                "total": total_restaurants,
                "active": active_restaurants,
                "trial": db.query(Restaurant).filter(
                    Restaurant.subscription_status == 'trial'
                ).count()
            },
            "revenue": {
                "total_last_30_days": float(total_revenue),
                "transaction_fees": transaction_fees,
                "subscription_revenue": float(subscription_revenue),
                "total_platform_revenue": transaction_fees + float(subscription_revenue)
            },
            "users": {
                "total": total_users,
                "active_last_30_days": active_users
            },
            "orders": {
                "total_last_30_days": total_orders,
                "average_order_value": float(total_revenue) / total_orders if total_orders > 0 else 0
            }
        }
        
        # Cache for 15 minutes
        await cache_data(cache_key, overview, ttl=900)
        
        return APIResponseHelper.success(data=overview)
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to fetch platform overview: {str(e)}",
            status_code=500
        )


@router.get("/revenue-trends")
async def get_revenue_trends(
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Get platform revenue trends over time."""
    try:
        cache_key = f"platform:analytics:revenue_trends:{days}"
        cached_data = await get_cached_data_async(cache_key)
        if cached_data:
            return APIResponseHelper.success(data=cached_data)
        
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days)
        
        # Query daily revenue
        daily_revenue = db.query(
            func.date(Order.created_at).label('date'),
            func.sum(Order.total_amount).label('revenue'),
            func.count(Order.id).label('order_count')
        ).filter(
            Order.created_at >= start_date
        ).group_by(
            func.date(Order.created_at)
        ).all()
        
        trends = []
        for row in daily_revenue:
            trends.append({
                "date": row.date.isoformat(),
                "revenue": float(row.revenue or 0),
                "transaction_fees": float(row.revenue or 0) * 0.01,
                "order_count": row.order_count
            })
        
        # Cache for 1 hour
        await cache_data(cache_key, trends, ttl=3600)
        
        return APIResponseHelper.success(data=trends)
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to fetch revenue trends: {str(e)}",
            status_code=500
        )


@router.get("/top-restaurants")
async def get_top_restaurants(
    limit: int = Query(10, ge=1, le=50),
    metric: str = Query("revenue", regex="^(revenue|orders|users)$"),
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Get top performing restaurants by various metrics."""
    try:
        cache_key = f"platform:analytics:top_restaurants:{metric}:{limit}"
        cached_data = await get_cached_data_async(cache_key)
        if cached_data:
            return APIResponseHelper.success(data=cached_data)
        
        query = db.query(Restaurant)
        
        if metric == "revenue":
            # Join with orders and sum revenue
            results = db.query(
                Restaurant,
                func.sum(Order.total_amount).label('metric_value')
            ).join(
                Order, Order.restaurant_id == Restaurant.id
            ).filter(
                Order.created_at >= datetime.now() - timedelta(days=30)
            ).group_by(
                Restaurant.id
            ).order_by(
                desc('metric_value')
            ).limit(limit).all()
            
        elif metric == "orders":
            # Count orders
            results = db.query(
                Restaurant,
                func.count(Order.id).label('metric_value')
            ).join(
                Order, Order.restaurant_id == Restaurant.id
            ).filter(
                Order.created_at >= datetime.now() - timedelta(days=30)
            ).group_by(
                Restaurant.id
            ).order_by(
                desc('metric_value')
            ).limit(limit).all()
            
        else:  # users
            # Count active users
            results = db.query(
                Restaurant,
                func.count(User.id).label('metric_value')
            ).join(
                User, User.restaurant_id == Restaurant.id
            ).group_by(
                Restaurant.id
            ).order_by(
                desc('metric_value')
            ).limit(limit).all()
        
        top_restaurants = []
        for restaurant, value in results:
            top_restaurants.append({
                "id": str(restaurant.id),
                "name": restaurant.name,
                "subscription_plan": restaurant.subscription_plan,
                "metric": metric,
                "value": float(value) if metric == "revenue" else int(value)
            })
        
        # Cache for 1 hour
        await cache_data(cache_key, top_restaurants, ttl=3600)
        
        return APIResponseHelper.success(data=top_restaurants)
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to fetch top restaurants: {str(e)}",
            status_code=500
        )