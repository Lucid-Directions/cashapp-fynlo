"""
Platform API module for web dashboard administration.

This module provides endpoints for platform owners to manage:
- Multiple restaurants
- Platform-wide analytics
- Subscription management
- User administration
- Financial reporting

Note: These endpoints are NOT used by the mobile app.
Mobile apps use the standard v1 API endpoints.
"""TODO: Add docstring."""

from fastapi import APIRouter

# Create platform router
platform_router = APIRouter(
    prefix="/platform",
    tags=["platform"],
    responses={404: {"description": "Not found"}},
)

# Import all platform endpoints
from .analytics import router as analytics_router
from .restaurants import router as restaurants_router
from .subscriptions import router as subscriptions_router
from .users import router as users_router
from .financial import router as financial_router

# Include all routers
platform_router.include_router(analytics_router)
platform_router.include_router(restaurants_router)
platform_router.include_router(subscriptions_router)
platform_router.include_router(users_router)
platform_router.include_router(financial_router)