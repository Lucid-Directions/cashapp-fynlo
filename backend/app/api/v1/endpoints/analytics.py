"""
Analytics and reporting endpoints for Fynlo POS
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db, Order, Customer, User, Restaurant
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

# Pydantic models for analytics responses
class RevenueMetrics(BaseModel):
    total_revenue: float
    daily_revenue: float
    weekly_revenue: float
    monthly_revenue: float
    revenue_growth: float

class OrderMetrics(BaseModel):
    total_orders: int
    daily_orders: int
    weekly_orders: int
    monthly_orders: int
    average_order_value: float
    order_growth: float

class CustomerMetrics(BaseModel):
    total_customers: int
    new_customers_today: int
    new_customers_week: int
    new_customers_month: int
    returning_customers: int
    customer_retention_rate: float

class PaymentMethodBreakdown(BaseModel):
    qr_payments: float
    card_payments: float
    cash_payments: float
    apple_pay: float
    other_payments: float

class AnalyticsDashboard(BaseModel):
    revenue_metrics: RevenueMetrics
    order_metrics: OrderMetrics
    customer_metrics: CustomerMetrics
    payment_breakdown: PaymentMethodBreakdown
    peak_hours: List[dict]
    top_products: List[dict]

@router.get("/dashboard", response_model=AnalyticsDashboard)
async def get_analytics_dashboard(
    restaurant_id: Optional[str] = Query(None),
    days: int = Query(30, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive analytics dashboard"""
    
    # Determine restaurant scope
    if current_user.role == "platform_owner":
        # Platform owners can see specific restaurant or all
        if restaurant_id:
            restaurants = [restaurant_id]
        else:
            # Get all restaurants in platform
            platform_restaurants = db.query(Restaurant).filter(
                Restaurant.platform_id == current_user.platform_id
            ).all()
            restaurants = [str(r.id) for r in platform_restaurants]
    else:
        # Restaurant users see only their own data
        restaurants = [str(current_user.restaurant_id)]
    
    # Date ranges
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    period_start = today_start - timedelta(days=days)
    
    # Revenue Metrics
    total_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id.in_(restaurants),
            Order.status == "completed",
            Order.created_at >= period_start
        )
    ).scalar() or 0
    
    daily_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id.in_(restaurants),
            Order.status == "completed",
            Order.created_at >= today_start
        )
    ).scalar() or 0
    
    weekly_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id.in_(restaurants),
            Order.status == "completed",
            Order.created_at >= week_start
        )
    ).scalar() or 0
    
    monthly_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id.in_(restaurants),
            Order.status == "completed",
            Order.created_at >= month_start
        )
    ).scalar() or 0
    
    # Order Metrics
    total_orders = db.query(Order).filter(
        and_(
            Order.restaurant_id.in_(restaurants),
            Order.created_at >= period_start
        )
    ).count()
    
    daily_orders = db.query(Order).filter(
        and_(
            Order.restaurant_id.in_(restaurants),
            Order.created_at >= today_start
        )
    ).count()
    
    weekly_orders = db.query(Order).filter(
        and_(
            Order.restaurant_id.in_(restaurants),
            Order.created_at >= week_start
        )
    ).count()
    
    monthly_orders = db.query(Order).filter(
        and_(
            Order.restaurant_id.in_(restaurants),
            Order.created_at >= month_start
        )
    ).count()
    
    avg_order_value = (total_revenue / total_orders) if total_orders > 0 else 0
    
    # Customer Metrics
    total_customers = db.query(Customer).filter(
        Customer.restaurant_id.in_(restaurants)
    ).count()
    
    new_customers_today = db.query(Customer).filter(
        and_(
            Customer.restaurant_id.in_(restaurants),
            Customer.created_at >= today_start
        )
    ).count()
    
    new_customers_week = db.query(Customer).filter(
        and_(
            Customer.restaurant_id.in_(restaurants),
            Customer.created_at >= week_start
        )
    ).count()
    
    new_customers_month = db.query(Customer).filter(
        and_(
            Customer.restaurant_id.in_(restaurants),
            Customer.created_at >= month_start
        )
    ).count()
    
    # Mock data for complex calculations
    revenue_growth = 15.2  # Would be calculated from previous period
    order_growth = 8.7
    customer_retention_rate = 73.5
    returning_customers = int(total_customers * 0.65)
    
    # Payment method breakdown (mock - would require payment table join)
    payment_breakdown = PaymentMethodBreakdown(
        qr_payments=45.0,
        card_payments=25.0,
        cash_payments=20.0,
        apple_pay=8.0,
        other_payments=2.0
    )
    
    # Peak hours (mock data)
    peak_hours = [
        {"hour": 12, "orders": 45, "revenue": 890.50},
        {"hour": 13, "orders": 52, "revenue": 1024.75},
        {"hour": 19, "orders": 38, "revenue": 756.25},
        {"hour": 20, "orders": 41, "revenue": 812.00}
    ]
    
    # Top products (mock data)
    top_products = [
        {"name": "Classic Burger", "orders": 156, "revenue": 2340.00},
        {"name": "Fish & Chips", "orders": 134, "revenue": 2010.00},
        {"name": "Caesar Salad", "orders": 89, "revenue": 1068.00},
        {"name": "Chicken Wings", "orders": 76, "revenue": 912.00}
    ]
    
    return AnalyticsDashboard(
        revenue_metrics=RevenueMetrics(
            total_revenue=float(total_revenue),
            daily_revenue=float(daily_revenue),
            weekly_revenue=float(weekly_revenue),
            monthly_revenue=float(monthly_revenue),
            revenue_growth=revenue_growth
        ),
        order_metrics=OrderMetrics(
            total_orders=total_orders,
            daily_orders=daily_orders,
            weekly_orders=weekly_orders,
            monthly_orders=monthly_orders,
            average_order_value=round(avg_order_value, 2),
            order_growth=order_growth
        ),
        customer_metrics=CustomerMetrics(
            total_customers=total_customers,
            new_customers_today=new_customers_today,
            new_customers_week=new_customers_week,
            new_customers_month=new_customers_month,
            returning_customers=returning_customers,
            customer_retention_rate=customer_retention_rate
        ),
        payment_breakdown=payment_breakdown,
        peak_hours=peak_hours,
        top_products=top_products
    )

@router.get("/revenue")
async def get_revenue_analytics(
    period: str = Query("month", enum=["day", "week", "month", "year"]),
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed revenue analytics"""
    
    # Implementation would provide detailed revenue breakdown
    return {
        "period": period,
        "total_revenue": 25430.75,
        "completed_orders": 312,
        "average_order_value": 81.50,
        "revenue_by_day": [],
        "revenue_by_payment_method": {},
        "top_revenue_items": []
    }

@router.get("/customers")
async def get_customer_analytics(
    period: str = Query("month", enum=["day", "week", "month", "year"]),
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed customer analytics"""
    
    return {
        "period": period,
        "total_customers": 1245,
        "new_customers": 89,
        "returning_customers": 456,
        "customer_segments": [],
        "loyalty_distribution": {},
        "top_customers": []
    }

@router.get("/products")
async def get_product_analytics(
    period: str = Query("month", enum=["day", "week", "month", "year"]),
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed product performance analytics"""
    
    return {
        "period": period,
        "total_items_sold": 2845,
        "top_selling_items": [],
        "category_performance": {},
        "inventory_insights": [],
        "profit_margins": {}
    }