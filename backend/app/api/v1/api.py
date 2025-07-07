"""
API Router for Fynlo POS Backend
"""

from fastapi import APIRouter, Depends
from app.middleware.rate_limit_middleware import limiter, DEFAULT_RATE

from app.api.v1.endpoints import (
    auth, restaurants, products, orders, payments, customers,
    analytics, files, platform, platform_settings, payment_configurations,
    websocket, sync, notifications,
    pos, admin, inventory, recipes, employees # Added inventory, recipes, and employees
)

# Apply a default rate limit to all routes in this router - TEMPORARILY DISABLED.
# Specific routes can override this with their own @limiter.limit decorator.
# api_router = APIRouter(dependencies=[Depends(limiter.limit(DEFAULT_RATE))])
api_router = APIRouter()


# Include all endpoint routers
# Routes that have their own @limiter.limit decorator (e.g., auth, payments)
# will use their specific limit instead of this default one.
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(restaurants.router, prefix="/restaurants", tags=["restaurants"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(files.router, prefix="/files", tags=["file_upload"])
api_router.include_router(platform.router, prefix="/platform", tags=["platform"])
api_router.include_router(platform_settings.router, prefix="/platform/settings", tags=["platform_settings"])
api_router.include_router(payment_configurations.router, prefix="/platform", tags=["payment_configurations"])
api_router.include_router(websocket.router, prefix="/websocket", tags=["websocket"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(pos.router, prefix="/pos", tags=["pos"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

# Inventory and Recipe Management
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory_management"])
api_router.include_router(recipes.router, prefix="/recipes", tags=["recipe_management"])

# Employee Management
api_router.include_router(employees.router, prefix="/employees", tags=["employee_management"])