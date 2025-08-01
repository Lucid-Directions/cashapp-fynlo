"""
API Router for Fynlo POS Backend
<<<<<<< HEAD
=======
"""
>>>>>>> parent of af057592 (fix: docstring syntax and formatting issues across backend)


"""
from fastapi import APIRouter, Depends
from app.middleware.rate_limit_middleware import limiter, DEFAULT_RATE

from app.api.v1.endpoints import (
    auth, restaurants, products, orders, payments, customers,
    analytics, files, platform, platform_settings, platform_settings_public, payment_configurations,
    websocket, sync, notifications, menu, public_menu,
    pos, admin, inventory, recipes, employees, # Added inventory, recipes, and employees
    exports, dashboard, websocket_portal, storage_health,  # Portal-specific endpoints + storage health
    platform_settings_optimized,  # Optimized endpoints for mobile app
    platform_admin,  # Secure platform administration
    sumup,  # SumUp payment provider initialization
    restaurant_switch,  # Multi-restaurant management
    health, monitoring  # Instance health and monitoring endpoints
)
from app.api.v1 import subscriptions
from app.api.v1.platform import platform_router

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
api_router.include_router(platform_settings_public.router, prefix="/platform/public", tags=["platform_public"])
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

# Restaurant Switching (Multi-restaurant management)
api_router.include_router(restaurant_switch.router, prefix="/restaurant-switch", tags=["restaurant_management"])

# Menu Management (Frontend compatibility endpoints)
api_router.include_router(menu.router, prefix="/menu", tags=["menu"])
# Public menu endpoints (no auth required)
api_router.include_router(public_menu.router, prefix="/public/menu", tags=["public-menu"])

# Subscription Management
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["subscriptions"])

# New Platform API for web dashboard (not used by mobile app)
# This contains comprehensive platform management endpoints
api_router.include_router(platform_router)

# Portal-specific endpoints
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(websocket_portal.router, tags=["websocket_portal"])

# Storage management endpoints
api_router.include_router(storage_health.router, prefix="/storage", tags=["storage"])

# Optimized platform endpoints for mobile app performance
api_router.include_router(platform_settings_optimized.router, prefix="/platform/optimized", tags=["platform_optimized"])

# Secure platform administration endpoints
api_router.include_router(platform_admin.router, prefix="/platform/admin", tags=["platform_admin"])

# SumUp payment provider endpoints
api_router.include_router(sumup.router, prefix="/sumup", tags=["sumup"])

# Health and monitoring endpoints
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["monitoring"])