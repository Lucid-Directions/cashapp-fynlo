# app/core/feature_gate.py
from sqlalchemy.orm import Session
from app.core.database import Restaurant

FEATURE_KEYS = {
    # Basic POS Features (Alpha - all plans)
    "pos_basic": "Basic POS functionality",
    "order_management": "Order management",
    "basic_payments": "Cash and card payments",
    "daily_reports": "Daily sales reports",
    # Advanced Features (Beta and above)
    "inventory_management": "Inventory tracking",
    "staff_management": "Staff accounts and permissions",
    "advanced_reports": "Advanced analytics and reports",
    "table_management": "Table and section management",
    "customer_database": "Customer management",
    # Premium Features (Omega only)
    "multi_location": "Multiple restaurant locations",
    "api_access": "API access for integrations",
    "custom_branding": "Custom branding options",
    "priority_support": "Priority customer support",
    "advanced_analytics": "Advanced business intelligence",
    "unlimited_staff": "Unlimited staff accounts",
}


def get_plan_features(plan: str) -> list[str]:
    """Get list of features available for a subscription plan"""
    plan_features = {
        "alpha": ["pos_basic", "order_management", "basic_payments", "daily_reports"],
        "beta": [
            "pos_basic",
            "order_management",
            "basic_payments",
            "daily_reports",
            "inventory_management",
            "staff_management",
            "advanced_reports",
            "table_management",
            "customer_database",
        ],
        "omega": list(FEATURE_KEYS.keys()),  # All features
    }
    return plan_features.get(plan, plan_features["alpha"])


def check_feature_access(restaurant_id: str, feature_key: str, db: Session) -> bool:
    """Check if a restaurant has access to a specific feature"""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        return False

    # Get plan with fallback to alpha
    subscription_plan = getattr(restaurant, "subscription_plan", "alpha") or "alpha"
    features = get_plan_features(subscription_plan)
    return feature_key in features


# Simple utility function for use within routes
async def check_user_has_feature(
    feature_key: str, current_user, db: Session  # User object from route
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
                raise AuthenticationException(message="Authentication failed", error_code="ACCESS_DENIED")
            # ... rest of endpoint logic
    """
    if not hasattr(current_user, "restaurant_id") or not current_user.restaurant_id:
        return False

    return check_feature_access(str(current_user.restaurant_id), feature_key, db)


# For backward compatibility with auth.py which imports get_plan_features
__all__ = [
    "FEATURE_KEYS",
    "get_plan_features",
    "check_feature_access",
    "check_user_has_feature",
]
