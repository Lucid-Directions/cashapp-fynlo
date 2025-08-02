"""
Centralized rate limiting configuration for Fynlo POS backend.
Provides endpoint-specific rate limits based on security and performance requirements.
"""

from app.core.config import settings

# Base rate limits
DEFAULT_RATE = "60/minute"
STRICT_RATE = "30/minute"
HIGH_RATE = "100/minute"
VERY_HIGH_RATE = "1000/minute"

# Authentication endpoints - strictest limits to prevent brute force
AUTH_RATES = {
    "login": "5/minute",
    "register": "3/minute",
    "password_reset": "3/minute",
    "verify_email": "10/minute",
    "refresh_token": "10/minute"
}

# Payment endpoints - balanced for security and usability
PAYMENT_RATES = {
    "create_payment": "15/minute",
    "process_payment": "15/minute",
    "payment_status": "30/minute",
    "payment_history": "30/minute",
    "refund": "5/minute"
}

# Platform-specific rates based on client type
PLATFORM_RATES = {
    "mobile_app": "100/minute",
    "portal_dashboard": "300/minute",
    "portal_export": "10/minute",
    "portal_analytics": "200/minute"
}

# API operation rates
API_RATES = {
    "sync": "200/minute",
    "websocket": "500/minute",
    "file_upload": "10/minute",
    "bulk_operation": "5/minute"
}

# Health and monitoring endpoints - high limits for infrastructure
MONITORING_RATES = {
    "health_basic": "1000/minute",
    "health_detailed": DEFAULT_RATE,
    "health_instances": DEFAULT_RATE,
    "health_ready": "1000/minute",
    "health_live": "1000/minute",
    "monitoring_replicas": DEFAULT_RATE,
    "monitoring_metrics": DEFAULT_RATE,
    "monitoring_refresh": "10/minute",
    "monitoring_deployments": DEFAULT_RATE,
    "monitoring_trigger": "2/hour"
}

# Critical operation rates - very restrictive
CRITICAL_RATES = {
    "deployment_trigger": "2/hour",
    "system_restart": "1/hour",
    "config_update": "10/hour",
    "user_delete": "5/hour"
}

# Get rate limit configuration
def get_rate_limit(endpoint_type: str, operation: str) -> str:
    """
    Get the appropriate rate limit for an endpoint.
    
    Args:
        endpoint_type: Category of endpoint (auth, payment, monitoring, etc.)
        operation: Specific operation within the category
        
    Returns:
        Rate limit string (e.g., "5/minute")
    """
    rate_configs = {
        "auth": AUTH_RATES,
        "payment": PAYMENT_RATES,
        "platform": PLATFORM_RATES,
        "api": API_RATES,
        "monitoring": MONITORING_RATES,
        "critical": CRITICAL_RATES
    }
    
    category = rate_configs.get(endpoint_type, {})
    return category.get(operation, DEFAULT_RATE)

# Environment-specific multipliers
def get_environment_multiplier() -> float:
    """
    Get rate limit multiplier based on environment.
    Development environments get higher limits for testing.
    """
    multipliers = {
        "development": 2.0,
        "staging": 1.5,
        "production": 1.0,
        "test": 10.0  # Very high for automated tests
    }
    return multipliers.get(settings.ENVIRONMENT, 1.0)

# Apply environment multiplier to rate
def adjust_rate_for_environment(rate: str) -> str:
    """
    Adjust rate limit based on environment.
    
    Args:
        rate: Base rate limit (e.g., "5/minute")
        
    Returns:
        Adjusted rate limit
    """
    if settings.ENVIRONMENT == "production":
        return rate
    
    # Parse rate
    parts = rate.split("/")
    if len(parts) != 2:
        return rate
    
    try:
        limit = int(parts[0])
        period = parts[1]
        
        # Apply multiplier
        multiplier = get_environment_multiplier()
        adjusted_limit = int(limit * multiplier)
        
        return f"{adjusted_limit}/{period}"
    except ValueError:
        return rate

# Rate limit groups for bulk configuration
RATE_LIMIT_GROUPS = {
    "public": {
        "rate": "100/minute",
        "endpoints": [
            "/api/v1/health",
            "/api/v1/health/basic",
            "/api/v1/public/*"
        ]
    },
    "authenticated": {
        "rate": DEFAULT_RATE,
        "endpoints": [
            "/api/v1/users/*",
            "/api/v1/restaurants/*",
            "/api/v1/menu/*"
        ]
    },
    "admin": {
        "rate": "200/minute",
        "endpoints": [
            "/api/v1/admin/*",
            "/api/v1/platform/*"
        ]
    },
    "critical": {
        "rate": "10/minute",
        "endpoints": [
            "/api/v1/system/*",
            "/api/v1/config/*"
        ]
    }
}

# IP-based rate limiting for additional protection
IP_RATE_LIMITS = {
    "global": "1000/minute",  # Overall IP limit
    "auth_attempts": "20/hour",  # Failed auth attempts per IP
    "api_burst": "100/second"  # Burst protection
}

# User role-based rate limit multipliers
ROLE_MULTIPLIERS = {
    "platform_owner": 2.0,
    "restaurant_owner": 1.5,
    "manager": 1.2,
    "employee": 1.0,
    "customer": 0.8
}

def get_role_adjusted_rate(base_rate: str, user_role: str) -> str:
    """
    Adjust rate limit based on user role.
    
    Args:
        base_rate: Base rate limit
        user_role: User's role
        
    Returns:
        Adjusted rate limit
    """
    multiplier = ROLE_MULTIPLIERS.get(user_role, 1.0)
    
    # Parse and adjust rate
    parts = base_rate.split("/")
    if len(parts) != 2:
        return base_rate
    
    try:
        limit = int(parts[0])
        period = parts[1]
        adjusted_limit = int(limit * multiplier)
        return f"{adjusted_limit}/{period}"
    except ValueError:
        return base_rate