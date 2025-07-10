# app/core/feature_gate.py
from typing import Callable
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db, Restaurant

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
    
    # Get plan with fallback to alpha
    subscription_plan = getattr(restaurant, 'subscription_plan', 'alpha') or 'alpha'
    
    # Define features per plan
    plan_features = {
        'alpha': ['pos_basic', 'order_management', 'basic_payments', 'daily_reports'],
        'beta': ['pos_basic', 'order_management', 'basic_payments', 'daily_reports',
                'inventory_management', 'staff_management', 'advanced_reports',
                'table_management', 'customer_database'],
        'omega': list(FEATURE_KEYS.keys())  # All features
    }
    
    features = plan_features.get(subscription_plan, plan_features['alpha'])
    return feature_key in features

def create_feature_checker(feature_key: str):
    """
    Create a dependency function that checks if the current user has access to a feature.
    
    Usage:
        @router.get("/inventory")
        async def get_inventory(
            current_user: User = Depends(get_current_user),
            _: bool = Depends(create_feature_checker("inventory_management")),
            db: Session = Depends(get_db)
        ):
            ...
    
    Or with dependencies parameter:
        @router.get("/inventory", dependencies=[Depends(get_current_user), Depends(create_feature_checker("inventory_management"))])
        async def get_inventory(db: Session = Depends(get_db)):
            ...
    """
    async def check_feature_access_dependency(
        db: Session = Depends(get_db)
    ):
        # Import here to avoid circular imports
        from app.api.v1.endpoints.auth import get_current_user
        from fastapi import Depends as FastAPIDepends
        
        # This is a factory that returns the actual dependency
        async def feature_check(
            current_user = FastAPIDepends(get_current_user),
            db: Session = db
        ):
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
        
        # Execute the dependency with proper injection
        from inspect import iscoroutinefunction
        if iscoroutinefunction(get_current_user):
            # If get_current_user is async, we need to handle it properly
            # This is a limitation - we'll need to restructure
            raise HTTPException(
                status_code=500,
                detail="Feature gate implementation error - please use the explicit pattern shown in docstring"
            )
        
        return True
    
    return check_feature_access_dependency

# Simpler approach - just provide a utility function
async def check_user_has_feature(
    feature_key: str,
    current_user,  # Will be injected by route
    db: Session
) -> bool:
    """
    Check if the current user has access to a feature.
    Use this in your route handlers after getting current_user.
    
    Example:
        @router.get("/inventory")
        async def get_inventory(
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db)
        ):
            if not await check_user_has_feature("inventory_management", current_user, db):
                raise HTTPException(status_code=403, detail="Feature not available in your plan")
            ...
    """
    if not hasattr(current_user, 'restaurant_id') or not current_user.restaurant_id:
        return False
    
    return check_feature_access(str(current_user.restaurant_id), feature_key, db)