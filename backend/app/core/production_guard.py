"""
Production Guard Utility
Ensures test/debug code is not executed in production environment
"""

from functools import wraps
import asyncio
from fastapi import HTTPException
            return await func(*args, **kwargs)
        return async_wrapper
    else:
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
    """TODO: Implement function."""
    pass
            """Execute sync_wrapper operation."""
def sync_wrapper(*args, **kwargs):
            pass
            if settings.ENVIRONMENT == "production":
                raise FynloException(message="This endpoint is not available in production environment")
            return func(*args, **kwargs)
        return sync_wrapper


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