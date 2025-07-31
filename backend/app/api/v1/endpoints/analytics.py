"""
Enhanced Analytics and reporting endpoints for Fynlo POS
Real-time dashboard metrics optimized for mobile consumption
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db, Order, Customer, User, Restaurant
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes
from app.core.analytics_engine import get_analytics_engine, AnalyticsTimeframe

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

@router.get("/dashboard/overview")
async def get_enhanced_dashboard_overview(
    timeframe: str = Query("day", description="Timeframe: hour, day, week, month, quarter, year"),
    start_date: Optional[str] = Query(None, description="Custom start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Custom end date (ISO format)"),
    restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID (platform owners)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get enhanced dashboard overview with real-time metrics
    Optimized for mobile consumption with comprehensive analytics
    """
    try:
        # Determine restaurant scope
        if current_user.role == "platform_owner":
            target_restaurant_id = restaurant_id or str(current_user.restaurant_id)
        else:
            target_restaurant_id = str(current_user.restaurant_id)
        
        if not target_restaurant_id:
            raise FynloException(
                message="Restaurant context required",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Parse dates if provided
        parsed_start_date = None
        parsed_end_date = None
        
        if start_date:
            try:
                parsed_start_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except ValueError:
                raise FynloException(
                    message="Invalid start_date format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        if end_date:
            try:
                parsed_end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            except ValueError:
                raise FynloException(
                    message="Invalid end_date format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        # Validate timeframe
        try:
            analytics_timeframe = AnalyticsTimeframe(timeframe)
        except ValueError:
            raise FynloException(
                message=f"Invalid timeframe: {timeframe}",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Get analytics engine and generate dashboard
        analytics_engine = get_analytics_engine(db)
        dashboard_data = analytics_engine.get_dashboard_overview(
            restaurant_id=target_restaurant_id,
            timeframe=analytics_timeframe,
            start_date=parsed_start_date,
            end_date=parsed_end_date
        )
        
        return APIResponseHelper.success(
            data=dashboard_data,
            message="Dashboard overview retrieved successfully",
            meta={
                "restaurant_id": target_restaurant_id,
                "timeframe": timeframe,
                "mobile_optimized": True
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get dashboard overview: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/dashboard/mobile")
async def get_mobile_reports_dashboard(
    restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID (platform owners)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get mobile-optimized reports dashboard data
    Matches exactly the data structure expected by ReportsScreenSimple.tsx
    """
    try:
        # Determine restaurant scope
        if current_user.role == "platform_owner":
            target_restaurant_id = restaurant_id or str(current_user.restaurant_id)
        else:
            target_restaurant_id = str(current_user.restaurant_id)

        # Get today's date range
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        week_start = today_start - timedelta(days=7)

        # Today's Summary
        today_orders = db.query(Order).filter(
            and_(
                Order.restaurant_id == target_restaurant_id,
                Order.status == "completed",
                Order.created_at >= today_start,
                Order.created_at < today_end
            )
        ).all()

        total_sales = sum(order.total_amount for order in today_orders)
        total_transactions = len(today_orders)
        avg_order = total_sales / total_transactions if total_transactions > 0 else 0

        # Weekly Labor - Feature not yet implemented
        weekly_labor = {
            "totalActualHours": 0,
            "totalLaborCost": 0.00,
            "efficiency": 0.0,
            "message": "Labor tracking feature coming soon"
        }

        # Top Items Today (from order items)
        item_sales = {}
        for order in today_orders:
            for item in order.items:
                if item.product_name in item_sales:
                    item_sales[item.product_name]["quantity"] += item.quantity
                    item_sales[item.product_name]["revenue"] += item.subtotal
                else:
                    item_sales[item.product_name] = {
                        "name": item.product_name,
                        "quantity": item.quantity,
                        "revenue": item.subtotal
                    }

        top_items = sorted(item_sales.values(), key=lambda x: x["revenue"], reverse=True)[:5]

        # Top Performers - Feature not yet implemented
        top_performers = []  # Will be populated when employee tracking is implemented

        # Sales Trend (last 7 days)
        sales_trend = []
        for i in range(7):
            day_start = today_start - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            day_orders = db.query(func.sum(Order.total_amount)).filter(
                and_(
                    Order.restaurant_id == target_restaurant_id,
                    Order.status == "completed",
                    Order.created_at >= day_start,
                    Order.created_at < day_end
                )
            ).scalar() or 0

            sales_trend.append({
                "period": day_start.strftime("%a"),
                "sales": float(day_orders)
            })

        # Structure response to match frontend expectations
        response_data = {
            "todaySummary": {
                "totalSales": float(total_sales),
                "transactions": total_transactions,
                "averageOrder": float(avg_order),
                "totalRevenue": float(total_sales),
                "totalOrders": total_transactions,
                "averageOrderValue": float(avg_order)
            },
            "weeklyLabor": weekly_labor,
            "topItemsToday": top_items,
            "topPerformersToday": top_performers,
            "salesTrend": list(reversed(sales_trend))  # Reverse to show oldest first
        }

        return APIResponseHelper.success(
            data=response_data,
            message="Mobile dashboard data retrieved successfully"
        )

    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get mobile dashboard data: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/dashboard", response_model=AnalyticsDashboard)
async def get_legacy_analytics_dashboard(
    restaurant_id: Optional[str] = Query(None),
    days: int = Query(30, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get legacy analytics dashboard (maintained for backward compatibility)"""
    
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
    
    # Calculate growth metrics - proper implementation needed
    revenue_growth = 0.0  # TODO: Calculate from previous period
    order_growth = 0.0  # TODO: Calculate from previous period
    customer_retention_rate = 0.0  # TODO: Implement customer tracking
    returning_customers = 0  # TODO: Implement customer tracking
    
    # Payment method breakdown - TODO: Implement with actual payment data
    payment_breakdown = PaymentMethodBreakdown(
        qr_payments=0.0,
        card_payments=0.0,
        cash_payments=0.0,
        apple_pay=0.0,
        other_payments=0.0
    )
    
    # Peak hours - TODO: Calculate from actual order data
    peak_hours = []  # Will be populated with real hourly analytics
    
    # Top products - TODO: Calculate from actual order items
    top_products = []  # Will be populated with real product analytics
    
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

@router.get("/sales")
async def get_enhanced_sales_analytics(
    timeframe: str = Query("day", description="Timeframe: hour, day, week, month, quarter, year"),
    start_date: Optional[str] = Query(None, description="Custom start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Custom end date (ISO format)"),
    restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID (platform owners)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get enhanced sales analytics with comprehensive reporting
    Optimized for mobile consumption with detailed sales insights
    """
    try:
        # Determine restaurant scope
        if current_user.role == "platform_owner":
            target_restaurant_id = restaurant_id or str(current_user.restaurant_id)
        else:
            target_restaurant_id = str(current_user.restaurant_id)
        
        if not target_restaurant_id:
            raise FynloException(
                message="Restaurant context required",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Parse dates if provided
        parsed_start_date = None
        parsed_end_date = None
        
        if start_date:
            try:
                parsed_start_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except ValueError:
                raise FynloException(
                    message="Invalid start_date format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        if end_date:
            try:
                parsed_end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            except ValueError:
                raise FynloException(
                    message="Invalid end_date format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        # Validate timeframe
        try:
            analytics_timeframe = AnalyticsTimeframe(timeframe)
        except ValueError:
            raise FynloException(
                message=f"Invalid timeframe: {timeframe}",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Get analytics engine and generate sales data
        analytics_engine = get_analytics_engine(db)
        sales_data = analytics_engine.get_sales_analytics(
            restaurant_id=target_restaurant_id,
            timeframe=analytics_timeframe,
            start_date=parsed_start_date,
            end_date=parsed_end_date
        )
        
        return APIResponseHelper.success(
            data=sales_data,
            message="Sales analytics retrieved successfully",
            meta={
                "restaurant_id": target_restaurant_id,
                "timeframe": timeframe,
                "mobile_optimized": True
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get sales analytics: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/employees")
async def get_enhanced_employee_performance(
    timeframe: str = Query("day", description="Timeframe: hour, day, week, month, quarter, year"),
    start_date: Optional[str] = Query(None, description="Custom start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Custom end date (ISO format)"),
    restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID (platform owners)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get enhanced employee performance analytics
    Optimized for mobile consumption with staff productivity insights
    """
    try:
        # Determine restaurant scope
        if current_user.role == "platform_owner":
            target_restaurant_id = restaurant_id or str(current_user.restaurant_id)
        else:
            target_restaurant_id = str(current_user.restaurant_id)
        
        if not target_restaurant_id:
            raise FynloException(
                message="Restaurant context required",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Parse dates if provided
        parsed_start_date = None
        parsed_end_date = None
        
        if start_date:
            try:
                parsed_start_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except ValueError:
                raise FynloException(
                    message="Invalid start_date format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        if end_date:
            try:
                parsed_end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            except ValueError:
                raise FynloException(
                    message="Invalid end_date format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        # Validate timeframe
        try:
            analytics_timeframe = AnalyticsTimeframe(timeframe)
        except ValueError:
            raise FynloException(
                message=f"Invalid timeframe: {timeframe}",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Get analytics engine and generate employee performance data
        analytics_engine = get_analytics_engine(db)
        employee_data = analytics_engine.get_employee_performance(
            restaurant_id=target_restaurant_id,
            timeframe=analytics_timeframe,
            start_date=parsed_start_date,
            end_date=parsed_end_date
        )
        
        return APIResponseHelper.success(
            data=employee_data,
            message="Employee performance analytics retrieved successfully",
            meta={
                "restaurant_id": target_restaurant_id,
                "timeframe": timeframe,
                "mobile_optimized": True
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get employee performance analytics: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/customers")
async def get_enhanced_customer_analytics(
    timeframe: str = Query("day", description="Timeframe: hour, day, week, month, quarter, year"),
    start_date: Optional[str] = Query(None, description="Custom start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Custom end date (ISO format)"),
    restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID (platform owners)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get enhanced customer behavior analytics and insights
    Optimized for mobile consumption with customer lifecycle data
    """
    try:
        # Determine restaurant scope
        if current_user.role == "platform_owner":
            target_restaurant_id = restaurant_id or str(current_user.restaurant_id)
        else:
            target_restaurant_id = str(current_user.restaurant_id)
        
        if not target_restaurant_id:
            raise FynloException(
                message="Restaurant context required",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Parse dates if provided
        parsed_start_date = None
        parsed_end_date = None
        
        if start_date:
            try:
                parsed_start_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except ValueError:
                raise FynloException(
                    message="Invalid start_date format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        if end_date:
            try:
                parsed_end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            except ValueError:
                raise FynloException(
                    message="Invalid end_date format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        # Validate timeframe
        try:
            analytics_timeframe = AnalyticsTimeframe(timeframe)
        except ValueError:
            raise FynloException(
                message=f"Invalid timeframe: {timeframe}",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Get analytics engine and generate customer analytics
        analytics_engine = get_analytics_engine(db)
        customer_data = analytics_engine.get_customer_analytics(
            restaurant_id=target_restaurant_id,
            timeframe=analytics_timeframe,
            start_date=parsed_start_date,
            end_date=parsed_end_date
        )
        
        return APIResponseHelper.success(
            data=customer_data,
            message="Customer analytics retrieved successfully",
            meta={
                "restaurant_id": target_restaurant_id,
                "timeframe": timeframe,
                "mobile_optimized": True
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get customer analytics: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/inventory")
async def get_enhanced_inventory_analytics(
    timeframe: str = Query("day", description="Timeframe: hour, day, week, month, quarter, year"),
    start_date: Optional[str] = Query(None, description="Custom start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Custom end date (ISO format)"),
    restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID (platform owners)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get enhanced inventory analytics and stock insights
    Optimized for mobile consumption with product performance data
    """
    try:
        # Determine restaurant scope
        if current_user.role == "platform_owner":
            target_restaurant_id = restaurant_id or str(current_user.restaurant_id)
        else:
            target_restaurant_id = str(current_user.restaurant_id)
        
        if not target_restaurant_id:
            raise FynloException(
                message="Restaurant context required",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Parse dates if provided
        parsed_start_date = None
        parsed_end_date = None
        
        if start_date:
            try:
                parsed_start_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except ValueError:
                raise FynloException(
                    message="Invalid start_date format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        if end_date:
            try:
                parsed_end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            except ValueError:
                raise FynloException(
                    message="Invalid end_date format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        # Validate timeframe
        try:
            analytics_timeframe = AnalyticsTimeframe(timeframe)
        except ValueError:
            raise FynloException(
                message=f"Invalid timeframe: {timeframe}",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Get analytics engine and generate inventory analytics
        analytics_engine = get_analytics_engine(db)
        inventory_data = analytics_engine.get_inventory_analytics(
            restaurant_id=target_restaurant_id,
            timeframe=analytics_timeframe,
            start_date=parsed_start_date,
            end_date=parsed_end_date
        )
        
        return APIResponseHelper.success(
            data=inventory_data,
            message="Inventory analytics retrieved successfully",
            meta={
                "restaurant_id": target_restaurant_id,
                "timeframe": timeframe,
                "mobile_optimized": True
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get inventory analytics: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/real-time")
async def get_real_time_metrics(
    restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID (platform owners)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get real-time metrics for live dashboard updates
    Optimized for mobile consumption with current operational data
    """
    try:
        # Determine restaurant scope
        if current_user.role == "platform_owner":
            target_restaurant_id = restaurant_id or str(current_user.restaurant_id)
        else:
            target_restaurant_id = str(current_user.restaurant_id)
        
        if not target_restaurant_id:
            raise FynloException(
                message="Restaurant context required",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Get analytics engine and generate real-time metrics
        analytics_engine = get_analytics_engine(db)
        real_time_data = analytics_engine.get_real_time_metrics(
            restaurant_id=target_restaurant_id
        )
        
        return APIResponseHelper.success(
            data=real_time_data,
            message="Real-time metrics retrieved successfully",
            meta={
                "restaurant_id": target_restaurant_id,
                "mobile_optimized": True,
                "refresh_interval": 30  # Seconds
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get real-time metrics: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/financial")
async def get_financial_analytics(
    period: str = Query("today", description="Period: today, week, month, quarter, year"),
    restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID (platform owners)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive financial analytics including P&L, revenue breakdowns, and cost analysis
    Optimized for mobile financial reporting and decision making
    """
    try:
        # Determine restaurant scope
        if current_user.role == "platform_owner":
            target_restaurant_id = restaurant_id or str(current_user.restaurant_id)
        else:
            target_restaurant_id = str(current_user.restaurant_id)

        # Get analytics engine
        analytics_engine = get_analytics_engine()
        
        # Map period to timeframe
        timeframe_map = {
            "today": AnalyticsTimeframe.TODAY,
            "week": AnalyticsTimeframe.WEEK,
            "month": AnalyticsTimeframe.MONTH,
            "quarter": AnalyticsTimeframe.QUARTER,
            "year": AnalyticsTimeframe.YEAR
        }
        
        timeframe = timeframe_map.get(period, AnalyticsTimeframe.TODAY)
        
        # Get financial analytics from the engine
        financial_data = analytics_engine.get_financial_analytics(
            restaurant_id=target_restaurant_id,
            timeframe=timeframe,
            db=db
        )
        
        # Structure response for mobile consumption
        response_data = {
            "period": period,
            "restaurant_id": target_restaurant_id,
            "summary": {
                "total_revenue": float(financial_data.get("total_revenue", 0)),
                "total_costs": float(financial_data.get("total_costs", 0)),
                "gross_profit": float(financial_data.get("gross_profit", 0)),
                "net_profit": float(financial_data.get("net_profit", 0)),
                "profit_margin": float(financial_data.get("profit_margin", 0))
            },
            "revenue": {
                "food_sales": float(financial_data.get("food_sales", 0)),
                "beverage_sales": float(financial_data.get("beverage_sales", 0)),
                "service_fees": float(financial_data.get("service_fees", 0)),
                "total_revenue": float(financial_data.get("total_revenue", 0))
            },
            "costs": {
                "cost_of_goods_sold": float(financial_data.get("cogs", 0)),
                "labor_costs": float(financial_data.get("labor_costs", 0)),
                "operating_expenses": float(financial_data.get("operating_expenses", 0)),
                "total_costs": float(financial_data.get("total_costs", 0))
            },
            "payment_breakdown": {
                "cash_payments": float(financial_data.get("cash_payments", 0)),
                "card_payments": float(financial_data.get("card_payments", 0)),
                "qr_payments": float(financial_data.get("qr_payments", 0)),
                "total_payments": float(financial_data.get("total_payments", 0))
            },
            "taxes": {
                "vat_collected": float(financial_data.get("vat_collected", 0)),
                "service_charge_collected": float(financial_data.get("service_charge_collected", 0)),
                "total_taxes": float(financial_data.get("total_taxes", 0))
            },
            "trends": financial_data.get("trends", []),
            "generated_at": datetime.now().isoformat(),
            "currency": "GBP"
        }

        return APIResponseHelper.success(
            data=response_data,
            message=f"Financial analytics retrieved successfully for {period}"
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get financial analytics: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )