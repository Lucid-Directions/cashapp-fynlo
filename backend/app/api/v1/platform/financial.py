"""
Platform financial reporting endpoints.
"""TODO: Add docstring."""

from datetime import datetime, timedelta, date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case

from app.core.database import get_db, Restaurant, Order, Payment, User
from app.core.auth import get_current_platform_owner
from app.core.responses import APIResponseHelper
from app.core.cache import get_cached_data_async, cache_data

router = APIRouter(prefix="/financial", tags=["platform-financial"])


@router.get("/revenue-report")
async def get_revenue_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    group_by: str = Query("day", regex="^(day|week|month)$"),
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Generate comprehensive revenue report for the platform."""
    try:
        # Default to last 30 days if no dates provided
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        cache_key = f"platform:financial:revenue:{start_date}:{end_date}:{group_by}"
        cached_data = await get_cached_data_async(cache_key)
        if cached_data:
            return APIResponseHelper.success(data=cached_data)
        
        # Determine grouping
        if group_by == "day":
            date_trunc = func.date(Order.created_at)
        elif group_by == "week":
            date_trunc = func.date_trunc('week', Order.created_at)
        else:  # month
            date_trunc = func.date_trunc('month', Order.created_at)
        
        # Query transaction revenue
        transaction_data = db.query(
            date_trunc.label('period'),
            func.sum(Order.total_amount).label('gross_revenue'),
            func.count(Order.id).label('order_count'),
            func.count(func.distinct(Order.restaurant_id)).label('active_restaurants')
        ).filter(
            and_(
                Order.created_at >= start_date,
                Order.created_at <= end_date + timedelta(days=1),
                Order.status == 'completed'
            )
        ).group_by('period').all()
        
        # Calculate subscription revenue
        active_subscriptions = db.query(
            Restaurant.subscription_plan,
            func.count(Restaurant.id).label('count')
        ).filter(
            Restaurant.subscription_status == 'active'
        ).group_by(
            Restaurant.subscription_plan
        ).all()
        
        monthly_subscription_revenue = 0
        for plan, count in active_subscriptions:
            if plan == 'beta':
                monthly_subscription_revenue += count * 49
            elif plan == 'omega':
                monthly_subscription_revenue += count * 119
        
        # Format report data
        report_data = []
        total_gross_revenue = 0
        total_transaction_fees = 0
        total_orders = 0
        
        for row in transaction_data:
            gross_revenue = float(row.gross_revenue or 0)
            transaction_fees = gross_revenue * 0.01  # 1% fee
            
            total_gross_revenue += gross_revenue
            total_transaction_fees += transaction_fees
            total_orders += row.order_count
            
            report_data.append({
                "period": row.period.isoformat() if hasattr(row.period, 'isoformat') else str(row.period),
                "gross_revenue": gross_revenue,
                "transaction_fees": transaction_fees,
                "order_count": row.order_count,
                "active_restaurants": row.active_restaurants
            })
        
        # Calculate daily average subscription revenue
        days_in_period = (end_date - start_date).days + 1
        daily_subscription_revenue = monthly_subscription_revenue / 30
        period_subscription_revenue = daily_subscription_revenue * days_in_period
        
        summary = {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "days": days_in_period
            },
            "revenue": {
                "gross_transaction_volume": total_gross_revenue,
                "transaction_fees": total_transaction_fees,
                "subscription_revenue": period_subscription_revenue,
                "total_platform_revenue": total_transaction_fees + period_subscription_revenue
            },
            "metrics": {
                "total_orders": total_orders,
                "average_order_value": total_gross_revenue / total_orders if total_orders > 0 else 0,
                "average_daily_revenue": (total_transaction_fees + period_subscription_revenue) / days_in_period
            },
            "detailed_data": report_data
        }
        
        # Cache for 1 hour
        await cache_data(cache_key, summary, ttl=3600)
        
        return APIResponseHelper.success(data=summary)
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to generate revenue report: {str(e)}",
            status_code=500
        )


@router.get("/payment-methods")
async def get_payment_method_breakdown(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Get breakdown of payment methods used across the platform."""
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        # Query payment method usage
        payment_data = db.query(
            Payment.payment_method,
            func.count(Payment.id).label('count'),
            func.sum(Payment.amount).label('total_amount')
        ).filter(
            and_(
                Payment.created_at >= start_date,
                Payment.status == 'completed'
            )
        ).group_by(
            Payment.payment_method
        ).all()
        
        # Calculate totals
        total_payments = sum(row.count for row in payment_data)
        total_amount = sum(float(row.total_amount or 0) for row in payment_data)
        
        # Format breakdown
        breakdown = []
        for row in payment_data:
            amount = float(row.total_amount or 0)
            breakdown.append({
                "payment_method": row.payment_method,
                "transaction_count": row.count,
                "total_amount": amount,
                "percentage_count": round(row.count / total_payments * 100, 2) if total_payments > 0 else 0,
                "percentage_amount": round(amount / total_amount * 100, 2) if total_amount > 0 else 0,
                "average_transaction": amount / row.count if row.count > 0 else 0
            })
        
        # Sort by total amount descending
        breakdown.sort(key=lambda x: x['total_amount'], reverse=True)
        
        return APIResponseHelper.success(
            data={
                "period_days": days,
                "total_transactions": total_payments,
                "total_amount": total_amount,
                "breakdown": breakdown
            }
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to get payment method breakdown: {str(e)}",
            status_code=500
        )


@router.get("/projections")
async def get_revenue_projections(
    months: int = Query(3, ge=1, le=12),
    current_user: User = Depends(get_current_platform_owner),
    db: Session = Depends(get_db)
):
    """Generate revenue projections based on current trends."""
    try:
        # Get historical data for trend analysis
        historical_months = 6
        start_date = datetime.now() - timedelta(days=historical_months * 30)
        
        # Get monthly transaction revenue trend
        monthly_revenue = db.query(
            func.date_trunc('month', Order.created_at).label('month'),
            func.sum(Order.total_amount).label('revenue')
        ).filter(
            and_(
                Order.created_at >= start_date,
                Order.status == 'completed'
            )
        ).group_by('month').all()
        
        # Calculate growth rate
        if len(monthly_revenue) >= 2:
            revenues = [float(row.revenue or 0) for row in monthly_revenue]
            # Simple linear regression for growth rate
            avg_growth_rate = sum(
                (revenues[i] - revenues[i-1]) / revenues[i-1] 
                for i in range(1, len(revenues)) 
                if revenues[i-1] > 0
            ) / (len(revenues) - 1)
        else:
            avg_growth_rate = 0.05  # Default 5% growth
        
        # Current metrics
        current_transaction_revenue = float(monthly_revenue[-1].revenue) if monthly_revenue else 0
        current_mrr = db.query(
            func.sum(
                case(
                    (Restaurant.subscription_plan == 'beta', 49),
                    (Restaurant.subscription_plan == 'omega', 119),
                    else_=0
                )
            )
        ).filter(
            Restaurant.subscription_status == 'active'
        ).scalar() or 0
        
        # Generate projections
        projections = []
        projected_transaction_revenue = current_transaction_revenue
        projected_mrr = float(current_mrr)
        
        for i in range(1, months + 1):
            # Apply growth rate
            projected_transaction_revenue *= (1 + avg_growth_rate)
            projected_mrr *= (1 + avg_growth_rate * 0.5)  # Subscription growth typically slower
            
            month_date = datetime.now() + timedelta(days=i * 30)
            transaction_fees = projected_transaction_revenue * 0.01
            
            projections.append({
                "month": month_date.strftime('%Y-%m'),
                "projected_transaction_volume": projected_transaction_revenue,
                "projected_transaction_fees": transaction_fees,
                "projected_subscription_revenue": projected_mrr,
                "projected_total_revenue": transaction_fees + projected_mrr,
                "growth_rate": avg_growth_rate
            })
        
        return APIResponseHelper.success(
            data={
                "current_metrics": {
                    "monthly_transaction_volume": current_transaction_revenue,
                    "monthly_recurring_revenue": current_mrr,
                    "estimated_growth_rate": avg_growth_rate
                },
                "projections": projections
            }
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to generate projections: {str(e)}",
            status_code=500
        )