"""
Dashboard API endpoints for Fynlo POS - Portal dashboard aggregation
"""
from typing import Optional, List
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, case
from collections import defaultdict
import json
from app.core.database import get_db, Restaurant, Order, Product, User, Customer, InventoryItem
from app.core.auth import get_current_user
from app.core.redis_client import get_redis, RedisClient
from app.core.responses import APIResponseHelper
from app.services.activity_logger import ActivityLogger
from app.middleware.rate_limit_middleware import limiter, PORTAL_DASHBOARD_RATE
from app.core.exceptions import AuthenticationException, AuthorizationException
router = APIRouter()

@router.get('/analytics/dashboard/{restaurant_id}')
@limiter.limit(PORTAL_DASHBOARD_RATE)
async def get_dashboard_metrics(request: Request, restaurant_id: str, period: str=Query('today', regex='^(today|week|month|year)$'), db: Session=Depends(get_db), current_user: User=Depends(get_current_user), redis: RedisClient=Depends(get_redis)):
    """Get aggregated dashboard metrics for a restaurant"""
    if str(current_user.restaurant_id) != restaurant_id and current_user.role != 'platform_owner':
        raise AuthenticationException(message='Not authorized to view this dashboard', error_code='UNAUTHORIZED')
    cache_key = f'dashboard:{restaurant_id}:{period}'
    cached_data = await redis.get(cache_key)
    if cached_data:
        try:
            if isinstance(cached_data, str):
                cached_data = json.loads(cached_data)
            return APIResponseHelper.success(data=cached_data)
        except json.JSONDecodeError:
            await redis.delete(cache_key)
    ActivityLogger.log_dashboard_view(db=db, user_id=str(current_user.id), restaurant_id=restaurant_id, dashboard_type='restaurant', period=period)
    end_date = datetime.utcnow()
    if period == 'today':
        start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'week':
        start_date = end_date - timedelta(days=7)
    elif period == 'month':
        start_date = end_date - timedelta(days=30)
    else:
        start_date = end_date - timedelta(days=365)
    orders = db.query(Order).filter(Order.restaurant_id == restaurant_id, Order.created_at >= start_date, Order.created_at <= end_date, Order.status.in_(['completed', 'paid'])).all()
    total_revenue = sum((order.total_amount for order in orders))
    total_orders = len(orders)
    avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
    top_products_query = []
    active_staff = db.query(func.count(User.id)).filter(User.restaurant_id == restaurant_id, User.is_active == True, User.role.in_(['employee', 'manager', 'cashier', 'server'])).scalar()
    unique_customers = db.query(func.count(func.distinct(Order.customer_id))).filter(Order.restaurant_id == restaurant_id, Order.created_at >= start_date, Order.created_at <= end_date).scalar()
    low_stock_items = db.query(func.count(InventoryItem.id)).filter(InventoryItem.restaurant_id == restaurant_id, InventoryItem.current_quantity <= InventoryItem.reorder_level).scalar()
    hourly_sales = {}
    if period == 'today':
        for order in orders:
            hour = order.created_at.hour
            if hour not in hourly_sales:
                hourly_sales[hour] = {'count': 0, 'revenue': 0}
            hourly_sales[hour]['count'] += 1
            hourly_sales[hour]['revenue'] += float(order.total_amount)
    dashboard_data = {'period': period, 'start_date': start_date.isoformat(), 'end_date': end_date.isoformat(), 'revenue': {'total': float(total_revenue), 'orders': total_orders, 'average_order': float(avg_order_value), 'currency': 'GBP'}, 'orders': {'total': total_orders, 'completed': sum((1 for o in orders if o.status == 'completed')), 'pending': db.query(func.count(Order.id)).filter(Order.restaurant_id == restaurant_id, Order.status == 'pending').scalar()}, 'products': {'top_selling': [{'name': prod[0], 'quantity': int(prod[1]), 'revenue': float(prod[2])} for prod in top_products_query]}, 'customers': {'unique': unique_customers, 'new': unique_customers}, 'staff': {'active': active_staff, 'on_duty': 0}, 'inventory': {'low_stock_alerts': low_stock_items}}
    if hourly_sales:
        dashboard_data['hourly_distribution'] = [{'hour': hour, 'orders': data['count'], 'revenue': data['revenue']} for (hour, data) in sorted(hourly_sales.items())]
    await redis.set(cache_key, dashboard_data, expire=300)
    return APIResponseHelper.success(data=dashboard_data, message='Dashboard metrics retrieved successfully')

@router.get('/analytics/platform-dashboard')
async def get_platform_dashboard(period: str=Query('today', regex='^(today|week|month|year)$'), db: Session=Depends(get_db), current_user: User=Depends(get_current_user), redis: RedisClient=Depends(get_redis)):
    """Get aggregated metrics for all restaurants (platform owner only)"""
    if current_user.role != 'platform_owner':
        raise AuthorizationException(message="Platform owner access required")
    cache_key = f'platform_dashboard:{period}'
    cached_data = await redis.get(cache_key)
    if cached_data:
        try:
            if isinstance(cached_data, str):
                cached_data = json.loads(cached_data)
            return APIResponseHelper.success(data=cached_data)
        except json.JSONDecodeError:
            await redis.delete(cache_key)
    end_date = datetime.utcnow()
    if period == 'today':
        start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'week':
        start_date = end_date - timedelta(days=7)
    elif period == 'month':
        start_date = end_date - timedelta(days=30)
    else:
        start_date = end_date - timedelta(days=365)
    restaurants = db.query(Restaurant).filter(Restaurant.is_active == True).all()
    total_revenue = 0
    total_orders = 0
    total_transactions = 0
    restaurant_metrics = []
    for restaurant in restaurants:
        restaurant_orders = db.query(Order).filter(Order.restaurant_id == restaurant.id, Order.created_at >= start_date, Order.created_at <= end_date, Order.status.in_(['completed', 'paid'])).all()
        restaurant_revenue = sum((order.total_amount for order in restaurant_orders))
        restaurant_order_count = len(restaurant_orders)
        total_revenue += restaurant_revenue
        total_orders += restaurant_order_count
        platform_fee = restaurant_revenue * 0.01
        restaurant_metrics.append({'id': str(restaurant.id), 'name': restaurant.name, 'revenue': float(restaurant_revenue), 'orders': restaurant_order_count, 'platform_fee': float(platform_fee), 'subscription_plan': getattr(restaurant, 'subscription_plan', 'alpha'), 'status': 'active' if restaurant.is_active else 'inactive'})
    subscription_counts = db.query(Restaurant.subscription_plan, func.count(Restaurant.id).label('count')).filter(Restaurant.is_active == True).group_by(Restaurant.subscription_plan).all()
    subscription_distribution = {plan: count for (plan, count) in subscription_counts}
    subscription_revenue = {'alpha': 0, 'beta': 49, 'omega': 119}
    monthly_subscription_revenue = sum((subscription_revenue.get(plan, 0) * count for (plan, count) in subscription_distribution.items()))
    transaction_fee_revenue = total_revenue * 0.01
    platform_data = {'period': period, 'start_date': start_date.isoformat(), 'end_date': end_date.isoformat(), 'overview': {'total_restaurants': len(restaurants), 'active_restaurants': len([r for r in restaurants if r.is_active]), 'total_revenue': float(total_revenue), 'total_orders': total_orders, 'platform_revenue': {'transaction_fees': float(transaction_fee_revenue), 'subscription_fees': float(monthly_subscription_revenue), 'total': float(transaction_fee_revenue + monthly_subscription_revenue)}}, 'subscriptions': {'distribution': subscription_distribution, 'monthly_revenue': float(monthly_subscription_revenue)}, 'top_restaurants': sorted(restaurant_metrics, key=lambda x: x['revenue'], reverse=True)[:10], 'growth_metrics': {'new_restaurants': db.query(func.count(Restaurant.id)).filter(Restaurant.created_at >= start_date, Restaurant.created_at <= end_date).scalar(), 'churned_restaurants': 0}}
    await redis.set(cache_key, platform_data, expire=600)
    return APIResponseHelper.success(data=platform_data, message='Platform dashboard metrics retrieved successfully')

@router.get('/analytics/restaurant-comparison')
async def get_restaurant_comparison(period: str=Query('month', regex='^(week|month|year)$'), metric: str=Query('revenue', regex='^(revenue|orders|customers)$'), limit: int=Query(10, ge=1, le=50), db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """Compare restaurants by various metrics (platform owner only)"""
    if current_user.role != 'platform_owner':
        raise AuthorizationException(message="Platform owner access required")
    end_date = datetime.utcnow()
    if period == 'week':
        start_date = end_date - timedelta(days=7)
    elif period == 'month':
        start_date = end_date - timedelta(days=30)
    else:
        start_date = end_date - timedelta(days=365)
    if metric == 'revenue':
        results = db.query(Restaurant.id, Restaurant.name, func.sum(Order.total_amount).label('value')).join(Order, Restaurant.id == Order.restaurant_id).filter(Order.created_at >= start_date, Order.created_at <= end_date, Order.status.in_(['completed', 'paid'])).group_by(Restaurant.id, Restaurant.name).order_by(func.sum(Order.total_amount).desc()).limit(limit).all()
    elif metric == 'orders':
        results = db.query(Restaurant.id, Restaurant.name, func.count(Order.id).label('value')).join(Order, Restaurant.id == Order.restaurant_id).filter(Order.created_at >= start_date, Order.created_at <= end_date, Order.status.in_(['completed', 'paid'])).group_by(Restaurant.id, Restaurant.name).order_by(func.count(Order.id).desc()).limit(limit).all()
    else:
        results = db.query(Restaurant.id, Restaurant.name, func.count(func.distinct(Order.customer_id)).label('value')).join(Order, Restaurant.id == Order.restaurant_id).filter(Order.created_at >= start_date, Order.created_at <= end_date, Order.customer_id.isnot(None)).group_by(Restaurant.id, Restaurant.name).order_by(func.count(func.distinct(Order.customer_id)).desc()).limit(limit).all()
    comparison_data = {'period': period, 'metric': metric, 'data': [{'restaurant_id': str(r[0]), 'restaurant_name': r[1], 'value': float(r[2]) if metric == 'revenue' else int(r[2])} for r in results]}
    return APIResponseHelper.success(data=comparison_data, message=f'Restaurant comparison by {metric} retrieved successfully')