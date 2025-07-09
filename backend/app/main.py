"""
Fynlo POS Backend API
Clean FastAPI implementation for hardware-free restaurant management
"""

from fastapi import FastAPI, Depends, HTTPException, status
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
import uvicorn
import logging
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.api import api_router
from app.api.mobile.endpoints import router as mobile_router
from app.core.redis_client import init_redis, close_redis
from app.core.websocket import websocket_manager
from app.core.exceptions import register_exception_handlers
from app.middleware.rate_limit_middleware import init_fastapi_limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.responses import APIResponseHelper
from app.core.mobile_middleware import (
    MobileCompatibilityMiddleware,
    MobileDataOptimizationMiddleware
)
from app.middleware.version_middleware import APIVersionMiddleware
from app.middleware.security_headers_middleware import SecurityHeadersMiddleware # Added import
from datetime import datetime

# Configure logging
# Logging level will be set by Uvicorn based on settings.LOG_LEVEL
# logging.basicConfig(level=settings.LOG_LEVEL.upper()) # Not needed if uvicorn handles it
logger = logging.getLogger(__name__)

# Apply logging filters for production
# This should be done after basic logging config but before the app starts handling requests.
# Note: Uvicorn sets up its own handlers. This filter will apply to log records
# processed by the application's loggers. For Uvicorn's access logs,
# different configuration might be needed if they also contain sensitive data.
from app.core.logging_filters import setup_logging_filters
if settings.ENVIRONMENT == "production" or not settings.ERROR_DETAIL_ENABLED:
    # We call this early, but it depends on `settings` being initialized.
    # Logging needs to be configured before this call if it relies on basicConfig.
    # If Uvicorn manages basicConfig, this should be fine.
    setup_logging_filters()


security = HTTPBearer()

# TEMPORARY: Remove lifespan function for deployment
# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     """Initialize application on startup - DISABLED FOR DEPLOYMENT"""
#     logger.info(f"🚀 Fynlo POS Backend starting in {settings.ENVIRONMENT} mode...")
#     yield
#     logger.info("✅ Cleanup complete")

app = FastAPI(
    title=settings.APP_NAME,
    description="Hardware-Free Restaurant Management Platform",
    version="1.0.0",
    # lifespan=lifespan,  # DISABLED FOR DEPLOYMENT
    debug=settings.DEBUG  # Set FastAPI debug mode from settings
)

# CORS middleware for React Native frontend and Supabase
if settings.ENVIRONMENT == "production":
    allowed_origins = settings.PRODUCTION_ALLOWED_ORIGINS
else:
    # Use CORS_ORIGINS from settings for development, fallback to permissive
    allowed_origins = settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"]

# Add Supabase domains to allowed origins
supabase_origins = [
    "https://*.supabase.co",
    "https://*.supabase.io"
]

# Add specific Supabase URL if configured
if settings.SUPABASE_URL:
    supabase_origins.append(settings.SUPABASE_URL)

# Combine all allowed origins
if isinstance(allowed_origins, list):
    allowed_origins = allowed_origins + supabase_origins
else:
    allowed_origins = [allowed_origins] + supabase_origins

# Ensure unique origins
allowed_origins = list(set(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"], # Can be restricted further if needed e.g. ["GET", "POST", "PUT", "DELETE"]
    allow_headers=["*"], # Can be restricted further e.g. ["Content-Type", "Authorization"]
)

# TEMPORARY: Disable complex middleware for deployment
# Add API version middleware for backward compatibility (FIRST in middleware stack)
# app.add_middleware(APIVersionMiddleware)

# Add Security Headers Middleware (after CORS and Versioning, before others)
# app.add_middleware(SecurityHeadersMiddleware)

# Add mobile compatibility middleware
# app.add_middleware(MobileCompatibilityMiddleware, enable_cors=True, enable_port_redirect=True)
# app.add_middleware(MobileDataOptimizationMiddleware)

# Add SlowAPI middleware (for rate limiting) - TEMPORARILY DISABLED
# app.add_middleware(SlowAPIMiddleware)

# Register standardized exception handlers
# register_exception_handlers(app) # General handlers

# Add specific handler for rate limit exceeded
# app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Include mobile-optimized routes (both prefixed and Odoo-style)
app.include_router(mobile_router, prefix="/api/mobile", tags=["mobile"])
app.include_router(mobile_router, prefix="", tags=["mobile-compatibility"])  # For Odoo-style endpoints

# WebSocket routes are handled through the websocket router in api.py

@app.get("/")
async def root():
    """Health check endpoint with standardized response"""
    return APIResponseHelper.success(
        data={
            "service": "Fynlo POS Backend API",
            "version": "1.0.0",
            "status": "healthy",
            "api_version": "v1",
            "backward_compatible": True
        },
        message="Fynlo POS API is running"
    )

@app.get("/health")
async def health_check():
    """Simplified health check for DigitalOcean deployment"""
    
    # Basic health check without external dependencies
    health_data = {
        "status": "healthy",
        "service": "fynlo-pos-backend",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now().isoformat()
    }
    
    # Optional: Check database connection if available
    try:
        from app.core.database import get_db
        db = next(get_db())
        db.execute("SELECT 1")
        health_data["database"] = "connected"
        db.close()
    except Exception as e:
        health_data["database"] = f"unavailable: {str(e)[:50]}"
    
    # Optional: Check Redis connection if available
    try:
        from app.core.redis_client import get_redis
        redis = await get_redis()
        if redis and await redis.ping():
            health_data["redis"] = "connected"
        else:
            health_data["redis"] = "unavailable"
    except Exception as e:
        health_data["redis"] = f"unavailable: {str(e)[:50]}"
    
    return APIResponseHelper.success(
        data=health_data,
        message="Fynlo POS Backend health check"
    )

@app.get("/api/version")
async def api_version_info():
    """API version information endpoint"""
    return APIResponseHelper.success(
        data={
            "current_version": "v1",
            "supported_versions": ["v1"],
            "backward_compatible": True,
            "version_middleware_enabled": True,
            "websocket_path_normalization": True,
            "documentation": {
                "versioned_endpoints": "/api/v1/{resource}",
                "unversioned_fallback": "/api/{resource} → /api/v1/{resource}",
                "websocket_paths": {
                    "/ws/{id}": "/api/v1/websocket/ws/{id}",
                    "/websocket/{id}": "/api/v1/websocket/ws/{id}"
                }
            }
        },
        message="API version information"
    )

# TEMPORARY: Add essential endpoints for iOS app
@app.post("/api/v1/auth/login")
async def login(request: dict):
    """Authentication endpoint with mock data"""
    email = request.get("email", "").lower()
    password = request.get("password", "")
    
    # SIMPLIFIED: One working restaurant owner credential
    mock_credentials = {
        "restaurant@fynlopos.com": "restaurant123"
    }
    
    if email in mock_credentials and mock_credentials[email] == password:
        # Return successful authentication
        return APIResponseHelper.success(
            data={
                "access_token": "mock_token_12345",
                "token_type": "bearer",
                "user": {
                    "id": "user_123",
                    "email": email,
                    "role": "platform_owner" if "platform" in email else "restaurant_owner",
                    "firstName": "Test",
                    "lastName": "User"
                }
            },
            message="Authentication successful"
        )
    else:
        return APIResponseHelper.error(
            message="Invalid credentials",
            status_code=401
        )

@app.get("/api/v1/menu/items")
async def get_menu_items():
    """Get menu items - Returns Chucho restaurant menu"""
    # Import Chucho menu data
    from seed_chucho_menu import CHUCHO_MENU_ITEMS
    
    # Transform to match frontend format
    menu_items = []
    for idx, item in enumerate(CHUCHO_MENU_ITEMS):
        menu_items.append({
            "id": idx + 1,
            "name": item["name"],
            "price": item["price"],
            "category": item["category"],
            "description": item["description"],
            "icon": "restaurant",  # Default icon
            "available": item["available"]
        })
    
    return APIResponseHelper.success(
        data=menu_items,
        message="Menu items retrieved"
    )

@app.get("/api/v1/menu/categories")
async def get_menu_categories():
    """Get menu categories - Returns Chucho restaurant categories"""
    # Import Chucho categories
    from seed_chucho_menu import CHUCHO_CATEGORIES
    
    # Transform to match frontend format
    categories = []
    for cat in CHUCHO_CATEGORIES:
        categories.append({
            "id": cat["sort_order"],
            "name": cat["name"],
            "description": f"{cat['name']} items",
            "icon": cat["icon"],
            "color": cat["color"],
            "active": True
        })
    
    return APIResponseHelper.success(
        data=categories,
        message="Menu categories retrieved"
    )

@app.get("/api/v1/employees")
async def get_employees():
    """Get employees"""
    return APIResponseHelper.success(
        data=[
            {
                "id": 1,
                "name": "John Manager",
                "email": "john@restaurant.com",
                "role": "manager",
                "hourlyRate": 25.00,
                "totalSales": 15420.50,
                "performanceScore": 9.2,
                "isActive": True
            },
            {
                "id": 2,
                "name": "Sarah Cashier", 
                "email": "sarah@restaurant.com",
                "role": "cashier",
                "hourlyRate": 15.50,
                "totalSales": 8750.25,
                "performanceScore": 8.8,
                "isActive": True
            }
        ],
        message="Employees retrieved"
    )

@app.get("/api/v1/platform/settings/service-charge")
async def get_service_charge():
    """Get platform service charge settings"""
    return APIResponseHelper.success(
        data={
            "enabled": True,
            "rate": 0.125,  # 12.5%
            "description": "Platform service charge",
            "lastUpdated": "2025-01-08T16:30:00Z"
        },
        message="Service charge settings retrieved"
    )

@app.get("/api/v1/orders")
async def get_orders():
    """Get recent orders"""
    from datetime import datetime, timedelta
    import random
    
    # Generate mock orders
    orders = []
    statuses = ["completed", "in_progress", "pending"]
    
    for i in range(20):
        order_time = datetime.now() - timedelta(minutes=random.randint(0, 1440))
        orders.append({
            "id": f"ORD{1000 + i}",
            "orderNumber": 1000 + i,
            "customerName": f"Customer {i + 1}",
            "items": [
                {"name": "Nachos", "quantity": 1, "price": 5.00},
                {"name": "Tacos", "quantity": 2, "price": 3.50}
            ],
            "total": 12.00 + (i * 2.5),
            "status": random.choice(statuses),
            "createdAt": order_time.isoformat(),
            "completedAt": (order_time + timedelta(minutes=15)).isoformat() if random.choice(statuses) == "completed" else None
        })
    
    return APIResponseHelper.success(
        data=orders,
        message="Orders retrieved"
    )

@app.get("/api/v1/customers")
async def get_customers():
    """Get customers"""
    customers = [
        {
            "id": "CUST001",
            "name": "John Smith",
            "email": "john@example.com",
            "phone": "+44 7700 900001",
            "totalOrders": 25,
            "totalSpent": 312.50,
            "lastVisit": "2025-01-08"
        },
        {
            "id": "CUST002",
            "name": "Sarah Johnson",
            "email": "sarah@example.com",
            "phone": "+44 7700 900002",
            "totalOrders": 18,
            "totalSpent": 245.00,
            "lastVisit": "2025-01-07"
        }
    ]
    
    return APIResponseHelper.success(
        data=customers,
        message="Customers retrieved"
    )

@app.get("/api/v1/inventory")
async def get_inventory():
    """Get inventory items"""
    inventory = [
        {
            "id": "INV001",
            "name": "Tortilla Chips",
            "category": "Dry Goods",
            "currentStock": 50,
            "unit": "bags",
            "reorderLevel": 20,
            "lastRestocked": "2025-01-05"
        },
        {
            "id": "INV002",
            "name": "Black Beans",
            "category": "Canned Goods",
            "currentStock": 30,
            "unit": "cans",
            "reorderLevel": 15,
            "lastRestocked": "2025-01-03"
        }
    ]
    
    return APIResponseHelper.success(
        data=inventory,
        message="Inventory retrieved"
    )

@app.get("/api/v1/analytics/dashboard/mobile")
async def get_analytics_dashboard():
    """Get analytics dashboard for mobile"""
    return APIResponseHelper.success(
        data={
            "revenue": {
                "today": 2847.50,
                "yesterday": 3156.80,
                "thisWeek": 18432.75,
                "lastWeek": 19875.20,
                "thisMonth": 67890.50,
                "lastMonth": 71234.80
            },
            "orders": {
                "today": 42,
                "yesterday": 48,
                "thisWeek": 287,
                "lastWeek": 312,
                "averageOrderValue": 67.80
            },
            "topItems": [
                {"name": "Nachos", "quantity": 156, "revenue": 780.00},
                {"name": "Carnitas Tacos", "quantity": 134, "revenue": 469.00},
                {"name": "Quesadillas", "quantity": 98, "revenue": 539.00}
            ],
            "hourlyBreakdown": [],
            "paymentMethods": {
                "card": {"count": 178, "percentage": 62},
                "cash": {"count": 65, "percentage": 23},
                "applePay": {"count": 44, "percentage": 15}
            },
            "staffPerformance": [
                {"name": "John Manager", "orders": 89, "revenue": 5234.50},
                {"name": "Sarah Cashier", "orders": 76, "revenue": 4567.80}
            ]
        },
        message="Analytics dashboard data retrieved"
    )

@app.get("/api/v1/schedule/week")
async def get_week_schedule():
    """Get weekly schedule"""
    from datetime import datetime, timedelta
    
    # Generate a mock weekly schedule
    today = datetime.now()
    week_start = today - timedelta(days=today.weekday())
    
    schedule_data = []
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    for i, day in enumerate(days):
        date = week_start + timedelta(days=i)
        schedule_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "day": day,
            "shifts": [
                {
                    "employeeId": 1,
                    "employeeName": "John Manager",
                    "startTime": "09:00",
                    "endTime": "17:00",
                    "role": "manager"
                },
                {
                    "employeeId": 2,
                    "employeeName": "Sarah Cashier",
                    "startTime": "10:00",
                    "endTime": "18:00",
                    "role": "cashier"
                }
            ]
        })
    
    return APIResponseHelper.success(
        data=schedule_data,
        message="Weekly schedule retrieved"
    )

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))  # Use DigitalOcean's PORT env var
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )