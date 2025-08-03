"""
Platform Management Service for Fynlo POS
Handles multi-tenant operations and platform owner features
"""

from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
from datetime import datetime, timedelta

from app.core.database import Platform, Restaurant, Order, Customer
from app.core.exceptions import FynloException, ErrorCodes


class PlatformService:
    """Service for platform management operations"""

    def __init__(self, db: Session):
        self.db = db

    def get_platform_overview(self, platform_id: str) -> Dict[str, Any]:
        """
        Get comprehensive platform overview with metrics
        """
        try:
            # Get platform
            platform = (
                self.db.query(Platform).filter(Platform.id == platform_id).first()
            )
            if not platform:
                raise FynloException(
                    message="Platform not found",
                    error_code=ErrorCodes.NOT_FOUND,
                    status_code=404,
                )

            # Get restaurants
            restaurants = (
                self.db.query(Restaurant)
                .filter(Restaurant.platform_id == platform_id)
                .all()
            )

            restaurant_ids = [str(r.id) for r in restaurants]

            # Calculate metrics
            total_restaurants = len(restaurants)
            active_restaurants = sum(1 for r in restaurants if r.is_active)

            # Revenue metrics (last 30 days)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)

            total_revenue = (
                self.db.query(func.sum(Order.total_amount))
                .filter(
                    and_(
                        Order.restaurant_id.in_(restaurant_ids),
                        Order.created_at >= start_date,
                        Order.status == "completed",
                    )
                )
                .scalar()
                or 0
            )

            total_orders = (
                self.db.query(Order)
                .filter(
                    and_(
                        Order.restaurant_id.in_(restaurant_ids),
                        Order.created_at >= start_date,
                    )
                )
                .count()
            )

            # Customer metrics
            total_customers = (
                self.db.query(Customer)
                .filter(Customer.restaurant_id.in_(restaurant_ids))
                .count()
            )

            return {
                "platform_id": str(platform.id),
                "platform_name": platform.name,
                "total_restaurants": total_restaurants,
                "active_restaurants": active_restaurants,
                "total_revenue_30d": float(total_revenue),
                "total_orders_30d": total_orders,
                "total_customers": total_customers,
                "average_revenue_per_restaurant": (
                    float(total_revenue / total_restaurants)
                    if total_restaurants > 0
                    else 0
                ),
                "restaurants": [
                    {
                        "id": str(r.id),
                        "name": r.name,
                        "is_active": r.is_active,
                        "created_at": r.created_at.isoformat(),
                    }
                    for r in restaurants
                ],
            }

        except Exception as e:
            raise FynloException(
                message=f"Failed to get platform overview: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500,
            )

    def get_restaurant_performance_comparison(
        self, platform_id: str, period_days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Compare performance across all restaurants in platform
        """
        try:
            restaurants = (
                self.db.query(Restaurant)
                .filter(Restaurant.platform_id == platform_id)
                .all()
            )

            end_date = datetime.now()
            start_date = end_date - timedelta(days=period_days)

            performance_data = []

            for restaurant in restaurants:
                # Get restaurant metrics
                orders = (
                    self.db.query(Order)
                    .filter(
                        and_(
                            Order.restaurant_id == restaurant.id,
                            Order.created_at >= start_date,
                        )
                    )
                    .all()
                )

                completed_orders = [o for o in orders if o.status == "completed"]
                total_revenue = sum(o.total_amount for o in completed_orders)

                # Customer metrics
                customers = (
                    self.db.query(Customer)
                    .filter(Customer.restaurant_id == restaurant.id)
                    .count()
                )

                # Calculate performance indicators
                avg_order_value = (
                    total_revenue / len(completed_orders) if completed_orders else 0
                )
                order_completion_rate = (
                    len(completed_orders) / len(orders) * 100 if orders else 0
                )

                performance_data.append(
                    {
                        "restaurant_id": str(restaurant.id),
                        "restaurant_name": restaurant.name,
                        "is_active": restaurant.is_active,
                        "total_orders": len(orders),
                        "completed_orders": len(completed_orders),
                        "total_revenue": float(total_revenue),
                        "average_order_value": float(avg_order_value),
                        "order_completion_rate": round(order_completion_rate, 2),
                        "total_customers": customers,
                        "revenue_per_customer": (
                            float(total_revenue / customers) if customers > 0 else 0
                        ),
                        "orders_per_day": round(len(orders) / period_days, 2),
                        "revenue_per_day": round(float(total_revenue) / period_days, 2),
                    }
                )

            # Sort by revenue (highest first)
            performance_data.sort(key=lambda x: x["total_revenue"], reverse=True)

            return performance_data

        except Exception as e:
            raise FynloException(
                message=f"Failed to get restaurant performance comparison: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500,
            )

    def calculate_commission_breakdown(
        self, platform_id: str, period_days: int = 30
    ) -> Dict[str, Any]:
        """
        Calculate commission breakdown for platform
        """
        try:
            restaurants = (
                self.db.query(Restaurant)
                .filter(Restaurant.platform_id == platform_id)
                .all()
            )

            end_date = datetime.now()
            start_date = end_date - timedelta(days=period_days)

            commission_data = []
            total_platform_commission = 0
            total_gross_revenue = 0

            for restaurant in restaurants:
                # Get completed orders for period
                completed_orders = (
                    self.db.query(Order)
                    .filter(
                        and_(
                            Order.restaurant_id == restaurant.id,
                            Order.created_at >= start_date,
                            Order.status == "completed",
                        )
                    )
                    .all()
                )

                gross_revenue = sum(o.total_amount for o in completed_orders)

                # Get commission rate (default 5%)
                commission_rate = (
                    restaurant.settings.get("commission_rate", 0.05)
                    if restaurant.settings
                    else 0.05
                )
                commission_amount = gross_revenue * commission_rate
                net_revenue = gross_revenue - commission_amount

                commission_data.append(
                    {
                        "restaurant_id": str(restaurant.id),
                        "restaurant_name": restaurant.name,
                        "gross_revenue": float(gross_revenue),
                        "commission_rate": float(commission_rate),
                        "commission_amount": float(commission_amount),
                        "net_revenue": float(net_revenue),
                        "order_count": len(completed_orders),
                    }
                )

                total_platform_commission += commission_amount
                total_gross_revenue += gross_revenue

            return {
                "period_days": period_days,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_gross_revenue": float(total_gross_revenue),
                "total_platform_commission": float(total_platform_commission),
                "platform_commission_rate": (
                    float(total_platform_commission / total_gross_revenue * 100)
                    if total_gross_revenue > 0
                    else 0
                ),
                "restaurant_breakdown": commission_data,
            }

        except Exception as e:
            raise FynloException(
                message=f"Failed to calculate commission breakdown: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500,
            )

    def validate_restaurant_switch(self, platform_id: str, restaurant_id: str) -> bool:
        """
        Validate that restaurant belongs to platform
        """
        try:
            restaurant = (
                self.db.query(Restaurant)
                .filter(
                    and_(
                        Restaurant.id == restaurant_id,
                        Restaurant.platform_id == platform_id,
                    )
                )
                .first()
            )

            return restaurant is not None

        except Exception:
            return False

    def get_platform_activity_feed(
        self, platform_id: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get recent activity across all restaurants in platform
        """
        try:
            restaurants = (
                self.db.query(Restaurant)
                .filter(Restaurant.platform_id == platform_id)
                .all()
            )

            restaurant_ids = [str(r.id) for r in restaurants]
            restaurant_map = {str(r.id): r.name for r in restaurants}

            # Get recent orders
            recent_orders = (
                self.db.query(Order)
                .filter(Order.restaurant_id.in_(restaurant_ids))
                .order_by(desc(Order.created_at))
                .limit(limit)
                .all()
            )

            activity_feed = []

            for order in recent_orders:
                activity_feed.append(
                    {
                        "id": str(order.id),
                        "type": "order",
                        "title": f"New order #{order.order_number}",
                        "description": f"Order placed at {restaurant_map.get(str(order.restaurant_id), 'Unknown')}",
                        "restaurant_id": str(order.restaurant_id),
                        "restaurant_name": restaurant_map.get(
                            str(order.restaurant_id), "Unknown"
                        ),
                        "amount": float(order.total_amount),
                        "status": order.status,
                        "created_at": order.created_at.isoformat(),
                        "metadata": {
                            "order_number": order.order_number,
                            "items_count": len(order.items) if order.items else 0,
                            "table_number": order.table_number,
                        },
                    }
                )

            return activity_feed

        except Exception as e:
            raise FynloException(
                message=f"Failed to get platform activity feed: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500,
            )

    def get_restaurant_health_check(self, platform_id: str) -> Dict[str, Any]:
        """
        Health check for all restaurants in platform
        """
        try:
            restaurants = (
                self.db.query(Restaurant)
                .filter(Restaurant.platform_id == platform_id)
                .all()
            )

            health_data = []

            for restaurant in restaurants:
                # Get recent activity (last 24 hours)
                yesterday = datetime.now() - timedelta(days=1)

                recent_orders = (
                    self.db.query(Order)
                    .filter(
                        and_(
                            Order.restaurant_id == restaurant.id,
                            Order.created_at >= yesterday,
                        )
                    )
                    .count()
                )

                # Determine health status
                if not restaurant.is_active:
                    health_status = "inactive"
                elif recent_orders == 0:
                    health_status = "warning"  # No orders in 24h
                elif recent_orders < 5:
                    health_status = "fair"  # Low activity
                else:
                    health_status = "healthy"  # Good activity

                health_data.append(
                    {
                        "restaurant_id": str(restaurant.id),
                        "restaurant_name": restaurant.name,
                        "health_status": health_status,
                        "is_active": restaurant.is_active,
                        "recent_orders_24h": recent_orders,
                        "last_updated": (
                            restaurant.updated_at.isoformat()
                            if restaurant.updated_at
                            else restaurant.created_at.isoformat()
                        ),
                        "recommendations": self._get_health_recommendations(
                            health_status, recent_orders
                        ),
                    }
                )

            # Summary
            total_restaurants = len(restaurants)
            healthy_count = sum(
                1 for r in health_data if r["health_status"] == "healthy"
            )
            warning_count = sum(
                1 for r in health_data if r["health_status"] == "warning"
            )

            return {
                "platform_id": platform_id,
                "total_restaurants": total_restaurants,
                "healthy_restaurants": healthy_count,
                "warning_restaurants": warning_count,
                "overall_health_score": (
                    round((healthy_count / total_restaurants * 100), 1)
                    if total_restaurants > 0
                    else 0
                ),
                "restaurant_health": health_data,
                "checked_at": datetime.now().isoformat(),
            }

        except Exception as e:
            raise FynloException(
                message=f"Failed to perform restaurant health check: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500,
            )

    def _get_health_recommendations(
        self, health_status: str, recent_orders: int
    ) -> List[str]:
        """
        Get health recommendations based on status
        """
        recommendations = []

        if health_status == "inactive":
            recommendations.append("Restaurant is inactive - contact to reactivate")
        elif health_status == "warning":
            recommendations.append(
                "No orders in 24 hours - check restaurant operations"
            )
            recommendations.append("Consider promotional campaigns")
        elif health_status == "fair":
            recommendations.append("Low order volume - review menu pricing")
            recommendations.append("Check customer feedback")

        return recommendations


# Singleton service factory
def get_platform_service(db: Session) -> PlatformService:
    """Factory function to get platform service instance"""
    return PlatformService(db)
