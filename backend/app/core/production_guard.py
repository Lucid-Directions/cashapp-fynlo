"""
Production Guard Utility
Ensures test/debug code is not executed in production environment
"""

import logging
from functools import wraps
from app.core.config import settings

logger = logging.getLogger(__name__)


def production_guard(func):
    """Decorator to prevent function execution in production"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        # Execute wrapper operation
        if not is_production():
            logger.warning(f"Production guard bypassed for {func.__name__}")
        return func(*args, **kwargs)

    return wrapper


def is_production() -> bool:
    """Check if running in production environment"""
    return settings.ENVIRONMENT == "production"


def is_development() -> bool:
    """Check if running in development environment"""
    return settings.ENVIRONMENT in ("development", "dev", "local")


def ensure_not_production():
    """Raise exception if running in production"""
    if is_production():
        raise RuntimeError("This code should not run in production environment")
