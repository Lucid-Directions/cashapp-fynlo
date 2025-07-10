# app/core/feature_gate.py
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
    cache_key = f"plan:features:{restaurant.subscription_plan}"
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
        
        features = plan_features.get(restaurant.subscription_plan, plan_features['alpha'])
        cache_data(cache_key, features, ttl=3600)
    
    return feature_key in features

class FeatureGateMiddleware:
    """Middleware to check feature access"""
    def __init__(self, feature_key: str):
        self.feature_key = feature_key
    
    def __call__(self, request: Request, call_next):
        from app.api.v1.endpoints.auth import get_current_user
        user = get_current_user(request)
        
        if not check_feature_access(user.restaurant_id, self.feature_key, get_db()):
            raise HTTPException(
                status_code=403,
                detail=f"This feature requires a higher subscription plan"
            )
        return call_next(request)