"""
Production Guard Utility
Ensures test/debug code is not executed in production environment
"""

from functools import wraps
from fastapi import HTTPException, status
from app.core.config import settings


def production_guard(func):
    """
    Decorator that prevents function execution in production environment
    Use this to wrap any test/debug endpoints or functionality
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if settings.ENVIRONMENT == "production":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This endpoint is not available in production environment"
            )
        return await func(*args, **kwargs)
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