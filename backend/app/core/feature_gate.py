# app/core/feature_gate.py
from typing import Callable
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db, Restaurant
from app.core.cache import get_cached_data, cache_data

FEATURE_KEYS = {
    # Basic POS Features (Alpha - all plans)
    'pos_basic': 'Basic POS functionality',
    'order_management': 'Order management',
    'basic_payments': 'Cash and card payments',
    'daily_reports': 'Daily sales reports',
    
    # Advanced Features (Beta and above)
    'inventory_management': 'Inventory tracking',
    'staff_management': 'Staff accounts and permissions',
    'advanced_reports': 'Advanced analytics and reports',
    'table_management': 'Table and section management',
    'customer_database': 'Customer management',
    
    # Premium Features (Omega only)
    'multi_location': 'Multiple restaurant locations',
    'api_access': 'API access for integrations',
    'custom_branding': 'Custom branding options',
    'priority_support': 'Priority customer support',
    'advanced_analytics': 'Advanced business intelligence',
    'unlimited_staff': 'Unlimited staff accounts',
}

def check_feature_access(restaurant_id: str, feature_key: str, db: Session) -> bool:
    """Check if a restaurant has access to a specific feature"""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        return False
    
    # Get plan features from cache or database
    cache_key = f"plan:features:{getattr(restaurant, 'subscription_plan', 'alpha')}"
    features = get_cached_data(cache_key)
    
    if not features:
        # Define features per plan
        plan_features = {
            'alpha': ['pos_basic', 'order_management', 'basic_payments', 'daily_reports'],
            'beta': ['pos_basic', 'order_management', 'basic_payments', 'daily_reports',
                    'inventory_management', 'staff_management', 'advanced_reports',
                    'table_management', 'customer_database'],
            'omega': list(FEATURE_KEYS.keys())  # All features
        }
        
        # Get plan with fallback to alpha
        subscription_plan = getattr(restaurant, 'subscription_plan', 'alpha') or 'alpha'
        features = plan_features.get(subscription_plan, plan_features['alpha'])
        cache_data(cache_key, features, ttl=3600)
    
    return feature_key in features

def require_feature(feature_key: str) -> Callable:
    """
    Create a FastAPI dependency that checks if the current user has access to a feature.
    
    Usage:
        @router.get("/inventory", dependencies=[Depends(require_feature("inventory_management"))])
        async def get_inventory(...):
            ...
    """
    async def feature_dependency(
        current_user = None,  # This will be injected by including get_current_user in the route
        db: Session = Depends(get_db)
    ):
        # Import here to avoid circular imports
        from app.api.v1.endpoints.auth import get_current_user
        
        # If current_user is not injected, this means the route doesn't have get_current_user
        # In that case, we can't check features
        if current_user is None:
            raise HTTPException(
                status_code=500,
                detail="Feature check requires authenticated user. Add get_current_user to your route dependencies."
            )
        
        if not hasattr(current_user, 'restaurant_id') or not current_user.restaurant_id:
            raise HTTPException(
                status_code=403,
                detail="No restaurant associated with user"
            )
        
        if not check_feature_access(str(current_user.restaurant_id), feature_key, db):
            raise HTTPException(
                status_code=403,
                detail=f"This feature '{feature_key}' requires a higher subscription plan"
            )
        
        return True
    
    return feature_dependency