"""
Platform Management API endpoints for Fynlo POS
Multi-tenant platform owner features for managing multiple restaurants
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
from pydantic import BaseModel
from datetime import datetime, timedelta

from app.core.database import get_db, Platform, Restaurant, User, Order, Customer
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes
from app.api.v1.endpoints import platform_settings

router = APIRouter()

# Include platform settings router
router.include_router(platform_settings.router, prefix="/settings", tags=["platform-settings"])

# Platform Management Models
class PlatformCreateRequest(BaseModel):
    """Create new platform request"""
    name: str
    description: Optional[str] = None
    settings: Dict[str, Any] = {}

class PlatformResponse(BaseModel):
    """Platform information response"""
    id: str
    name: str
    description: Optional[str]
    owner_id: str
    total_restaurants: int
    active_restaurants: int
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: Optional[datetime]

class RestaurantSummary(BaseModel):
    """Restaurant summary for platform dashboard"""
    id: str
    name: str
    address: Dict[str, Any]
    is_active: bool
    total_revenue: float
    monthly_revenue: float
    total_orders: int
    monthly_orders: int
    last_order_at: Optional[datetime]
    created_at: datetime

class PlatformDashboardResponse(BaseModel):
    """Platform dashboard overview"""
    platform_info: PlatformResponse
    restaurants: List[RestaurantSummary]
    aggregated_metrics: Dict[str, Any]
    recent_activity: List[Dict[str, Any]]

class RestaurantSwitchRequest(BaseModel):
    """Restaurant switching request"""
    restaurant_id: str

class CommissionReport(BaseModel):
    """Commission tracking report"""
    restaurant_id: str
    restaurant_name: str
    period_start: datetime
    period_end: datetime
    gross_revenue: float
    commission_rate: float
    commission_amount: float
    net_revenue: float

# Platform Dashboard Endpoints
@router.get("/dashboard")
async def get_platform_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive platform dashboard for platform owners
    """
    try:
        # Verify platform owner permissions
        if current_user.role != "platform_owner":
            raise FynloException(
                message="Access denied - platform owners only",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        platform_id = str(current_user.platform_id)
        
        # Get platform information
        platform = db.query(Platform).filter(Platform.id == platform_id).first()
        if not platform:
            raise FynloException(
                message="Platform not found",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        # Get all restaurants in platform
        restaurants = db.query(Restaurant).filter(
            Restaurant.platform_id == platform_id
        ).all()
        
        restaurant_ids = [str(r.id) for r in restaurants]
        
        # Calculate period (last 30 days)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        # Get restaurant summaries with metrics
        restaurant_summaries = []
        total_platform_revenue = 0
        total_platform_orders = 0
        
        for restaurant in restaurants:
            # Calculate restaurant metrics
            restaurant_orders = db.query(Order).filter(
                and_(
                    Order.restaurant_id == restaurant.id,
                    Order.status == "completed"
                )
            ).all()
            
            monthly_orders = db.query(Order).filter(
                and_(
                    Order.restaurant_id == restaurant.id,
                    Order.created_at >= start_date,
                    Order.status == "completed"
                )
            ).all()
            
            total_revenue = sum(order.total_amount for order in restaurant_orders)
            monthly_revenue = sum(order.total_amount for order in monthly_orders)
            
            # Get last order
            last_order = db.query(Order).filter(
                Order.restaurant_id == restaurant.id
            ).order_by(desc(Order.created_at)).first()
            
            restaurant_summaries.append(RestaurantSummary(
                id=str(restaurant.id),
                name=restaurant.name,
                address=restaurant.address,
                is_active=restaurant.is_active,
                total_revenue=float(total_revenue),
                monthly_revenue=float(monthly_revenue),
                total_orders=len(restaurant_orders),
                monthly_orders=len(monthly_orders),
                last_order_at=last_order.created_at if last_order else None,
                created_at=restaurant.created_at
            ))
            
            total_platform_revenue += total_revenue
            total_platform_orders += len(restaurant_orders)
        
        # Calculate aggregated metrics
        active_restaurants = sum(1 for r in restaurants if r.is_active)
        average_revenue_per_restaurant = (
            total_platform_revenue / len(restaurants) if restaurants else 0
        )
        
        aggregated_metrics = {
            "total_revenue": round(total_platform_revenue, 2),
            "monthly_revenue": round(
                sum(r.monthly_revenue for r in restaurant_summaries), 2
            ),
            "total_restaurants": len(restaurants),
            "active_restaurants": active_restaurants,
            "total_orders": total_platform_orders,
            "monthly_orders": sum(r.monthly_orders for r in restaurant_summaries),
            "average_revenue_per_restaurant": round(average_revenue_per_restaurant, 2),
            "platform_growth_rate": 0.0,  # Would calculate based on historical data
        }
        
        # Get recent activity (last 10 orders across all restaurants)
        recent_orders = db.query(Order).filter(
            Order.restaurant_id.in_(restaurant_ids)
        ).order_by(desc(Order.created_at)).limit(10).all()
        
        recent_activity = []
        for order in recent_orders:
            restaurant = next((r for r in restaurants if str(r.id) == str(order.restaurant_id)), None)
            recent_activity.append({
                "id": str(order.id),
                "type": "order",
                "restaurant_name": restaurant.name if restaurant else "Unknown",
                "restaurant_id": str(order.restaurant_id),
                "order_number": order.order_number,
                "amount": float(order.total_amount),
                "status": order.status,
                "created_at": order.created_at.isoformat()
            })
        
        # Build platform response
        platform_response = PlatformResponse(
            id=str(platform.id),
            name=platform.name,
            description=platform.description,
            owner_id=str(platform.owner_id),
            total_restaurants=len(restaurants),
            active_restaurants=active_restaurants,
            settings=platform.settings or {},
            created_at=platform.created_at,
            updated_at=platform.updated_at
        )
        
        dashboard_data = PlatformDashboardResponse(
            platform_info=platform_response,
            restaurants=restaurant_summaries,
            aggregated_metrics=aggregated_metrics,
            recent_activity=recent_activity
        )
        
        return APIResponseHelper.success(
            data=dashboard_data.dict(),
            message="Platform dashboard retrieved successfully",
            meta={
                "restaurants_count": len(restaurants),
                "total_revenue": aggregated_metrics["total_revenue"],
                "period": "last_30_days"
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve platform dashboard: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.post("/restaurants/{restaurant_id}/switch")
async def switch_restaurant_context(
    restaurant_id: str = Path(..., description="Restaurant ID to switch to"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Switch restaurant context for platform owners
    """
    try:
        # Verify platform owner permissions
        if current_user.role != "platform_owner":
            raise FynloException(
                message="Access denied - platform owners only",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        # Verify restaurant exists and belongs to platform
        restaurant = db.query(Restaurant).filter(
            and_(
                Restaurant.id == restaurant_id,
                Restaurant.platform_id == current_user.platform_id
            )
        ).first()
        
        if not restaurant:
            raise FynloException(
                message="Restaurant not found or access denied",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        # Update user's current restaurant context (in session/JWT claims)
        # This would be handled by updating JWT claims or session data
        restaurant_context = {
            "restaurant_id": str(restaurant.id),
            "restaurant_name": restaurant.name,
            "switched_at": datetime.now().isoformat(),
            "previous_context": str(current_user.restaurant_id) if current_user.restaurant_id else None
        }
        
        return APIResponseHelper.success(
            data=restaurant_context,
            message=f"Switched to restaurant: {restaurant.name}",
            meta={
                "restaurant_id": str(restaurant.id),
                "platform_id": str(current_user.platform_id)
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to switch restaurant context: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/restaurants")
async def get_platform_restaurants(
    status: Optional[str] = Query(None, description="Filter by restaurant status"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all restaurants for platform owner
    """
    try:
        # Verify platform owner permissions
        if current_user.role != "platform_owner":
            raise FynloException(
                message="Access denied - platform owners only",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        platform_id = str(current_user.platform_id)
        
        # Build query
        query = db.query(Restaurant).filter(Restaurant.platform_id == platform_id)
        
        if status:
            if status == "active":
                query = query.filter(Restaurant.is_active == True)
            elif status == "inactive":
                query = query.filter(Restaurant.is_active == False)
        
        # Get total count for pagination
        total_count = query.count()
        
        # Apply pagination
        restaurants = query.order_by(Restaurant.name).offset(offset).limit(limit).all()
        
        # Build restaurant summaries
        restaurant_data = []
        for restaurant in restaurants:
            # Get basic metrics
            total_orders = db.query(Order).filter(
                Order.restaurant_id == restaurant.id
            ).count()
            
            total_revenue = db.query(func.sum(Order.total_amount)).filter(
                and_(
                    Order.restaurant_id == restaurant.id,
                    Order.status == "completed"
                )
            ).scalar() or 0
            
            restaurant_data.append({
                "id": str(restaurant.id),
                "name": restaurant.name,
                "address": restaurant.address,
                "phone": restaurant.phone,
                "email": restaurant.email,
                "is_active": restaurant.is_active,
                "total_orders": total_orders,
                "total_revenue": float(total_revenue),
                "timezone": restaurant.timezone,
                "created_at": restaurant.created_at.isoformat(),
                "updated_at": restaurant.updated_at.isoformat() if restaurant.updated_at else None
            })
        
        return APIResponseHelper.success(
            data=restaurant_data,
            message=f"Retrieved {len(restaurant_data)} restaurants",
            meta={
                "total_count": total_count,
                "limit": limit,
                "offset": offset,
                "platform_id": platform_id,
                "status_filter": status
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve platform restaurants: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/analytics/commission")
async def get_commission_report(
    period_days: int = Query(30, description="Report period in days"),
    restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get commission tracking report for platform
    """
    try:
        # Verify platform owner permissions
        if current_user.role != "platform_owner":
            raise FynloException(
                message="Access denied - platform owners only",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        platform_id = str(current_user.platform_id)
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period_days)
        
        # Get restaurants to report on
        restaurants_query = db.query(Restaurant).filter(Restaurant.platform_id == platform_id)
        if restaurant_id:
            restaurants_query = restaurants_query.filter(Restaurant.id == restaurant_id)
        
        restaurants = restaurants_query.all()
        
        commission_reports = []
        total_commission = 0
        
        for restaurant in restaurants:
            # Get completed orders for the period
            orders = db.query(Order).filter(
                and_(
                    Order.restaurant_id == restaurant.id,
                    Order.created_at >= start_date,
                    Order.created_at <= end_date,
                    Order.status == "completed"
                )
            ).all()
            
            gross_revenue = sum(order.total_amount for order in orders)
            
            # Commission rate (could be stored in restaurant settings)
            commission_rate = restaurant.settings.get("commission_rate", 0.05) if restaurant.settings else 0.05  # 5% default
            commission_amount = gross_revenue * commission_rate
            net_revenue = gross_revenue - commission_amount
            
            commission_reports.append(CommissionReport(
                restaurant_id=str(restaurant.id),
                restaurant_name=restaurant.name,
                period_start=start_date,
                period_end=end_date,
                gross_revenue=float(gross_revenue),
                commission_rate=float(commission_rate),
                commission_amount=float(commission_amount),
                net_revenue=float(net_revenue)
            ))
            
            total_commission += commission_amount
        
        # Calculate summary
        total_gross_revenue = sum(r.gross_revenue for r in commission_reports)
        average_commission_rate = (
            sum(r.commission_rate for r in commission_reports) / len(commission_reports)
            if commission_reports else 0
        )
        
        summary = {
            "period_days": period_days,
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "total_restaurants": len(commission_reports),
            "total_gross_revenue": round(total_gross_revenue, 2),
            "total_commission": round(total_commission, 2),
            "average_commission_rate": round(average_commission_rate, 4),
            "platform_earnings": round(total_commission, 2)
        }
        
        return APIResponseHelper.success(
            data={
                "summary": summary,
                "restaurant_reports": [report.dict() for report in commission_reports]
            },
            message=f"Commission report generated for {len(commission_reports)} restaurants",
            meta={
                "period_days": period_days,
                "platform_id": platform_id,
                "total_commission": total_commission
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to generate commission report: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/analytics/performance")
async def get_platform_performance_analytics(
    period_days: int = Query(30, description="Analysis period in days"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get platform-wide performance analytics
    """
    try:
        # Verify platform owner permissions
        if current_user.role != "platform_owner":
            raise FynloException(
                message="Access denied - platform owners only",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        platform_id = str(current_user.platform_id)
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period_days)
        
        # Get all restaurants
        restaurants = db.query(Restaurant).filter(Restaurant.platform_id == platform_id).all()
        restaurant_ids = [str(r.id) for r in restaurants]
        
        # Performance metrics
        total_orders = db.query(Order).filter(
            and_(
                Order.restaurant_id.in_(restaurant_ids),
                Order.created_at >= start_date
            )
        ).count()
        
        completed_orders = db.query(Order).filter(
            and_(
                Order.restaurant_id.in_(restaurant_ids),
                Order.created_at >= start_date,
                Order.status == "completed"
            )
        ).count()
        
        total_revenue = db.query(func.sum(Order.total_amount)).filter(
            and_(
                Order.restaurant_id.in_(restaurant_ids),
                Order.created_at >= start_date,
                Order.status == "completed"
            )
        ).scalar() or 0
        
        # Customer metrics
        total_customers = db.query(Customer).filter(
            Customer.restaurant_id.in_(restaurant_ids)
        ).count()
        
        # Calculate performance metrics
        order_completion_rate = (completed_orders / total_orders * 100) if total_orders > 0 else 0
        average_order_value = (total_revenue / completed_orders) if completed_orders > 0 else 0
        daily_average_revenue = total_revenue / period_days
        
        # Top performing restaurants
        top_restaurants = []
        for restaurant in restaurants:
            restaurant_revenue = db.query(func.sum(Order.total_amount)).filter(
                and_(
                    Order.restaurant_id == restaurant.id,
                    Order.created_at >= start_date,
                    Order.status == "completed"
                )
            ).scalar() or 0
            
            restaurant_orders = db.query(Order).filter(
                and_(
                    Order.restaurant_id == restaurant.id,
                    Order.created_at >= start_date
                )
            ).count()
            
            top_restaurants.append({
                "restaurant_id": str(restaurant.id),
                "restaurant_name": restaurant.name,
                "revenue": float(restaurant_revenue),
                "orders": restaurant_orders,
                "avg_order_value": float(restaurant_revenue / restaurant_orders) if restaurant_orders > 0 else 0
            })
        
        # Sort by revenue
        top_restaurants.sort(key=lambda x: x["revenue"], reverse=True)
        
        performance_data = {
            "period_summary": {
                "period_days": period_days,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "key_metrics": {
                "total_revenue": round(float(total_revenue), 2),
                "total_orders": total_orders,
                "completed_orders": completed_orders,
                "order_completion_rate": round(order_completion_rate, 2),
                "average_order_value": round(float(average_order_value), 2),
                "daily_average_revenue": round(float(daily_average_revenue), 2),
                "total_customers": total_customers,
                "active_restaurants": len([r for r in restaurants if r.is_active])
            },
            "top_performing_restaurants": top_restaurants[:5],
            "growth_indicators": {
                "revenue_growth": 0.0,  # Would calculate vs previous period
                "order_growth": 0.0,
                "customer_growth": 0.0,
                "restaurant_growth": 0.0
            }
        }
        
        return APIResponseHelper.success(
            data=performance_data,
            message="Platform performance analytics retrieved",
            meta={
                "platform_id": platform_id,
                "restaurants_analyzed": len(restaurants),
                "period_days": period_days
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve platform analytics: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )