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

# CORS middleware for React Native frontend
if settings.ENVIRONMENT == "production":
    allowed_origins = settings.PRODUCTION_ALLOWED_ORIGINS
else:
    # Use CORS_ORIGINS from settings for development, fallback to permissive
    allowed_origins = settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"]

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


# TEMPORARY: Disable complex routes for deployment
# Include API routes
# app.include_router(api_router, prefix="/api/v1")

# Include mobile-optimized routes (both prefixed and Odoo-style)
# app.include_router(mobile_router, prefix="/api/mobile", tags=["mobile"])
# app.include_router(mobile_router, prefix="", tags=["mobile-compatibility"])  # For Odoo-style endpoints

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
        from app.core.database import get_db_session
        db = next(get_db_session())
        db.execute("SELECT 1")
        health_data["database"] = "connected"
        db.close()
    except Exception as e:
        health_data["database"] = f"unavailable: {str(e)[:50]}"
    
    # Optional: Check Redis connection if available
    try:
        from app.core.redis_client import get_redis
        redis = get_redis()
        if redis and redis.ping():
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
    """Get menu items"""
    return APIResponseHelper.success(
        data=[
            # Tacos
            {"id": 1, "name": "Carne Asada Tacos", "price": 3.50, "category": "Tacos", "description": "Grilled beef with onions and cilantro", "image": "🌮"},
            {"id": 2, "name": "Al Pastor Tacos", "price": 3.25, "category": "Tacos", "description": "Marinated pork with pineapple", "image": "🌮"},
            {"id": 3, "name": "Carnitas Tacos", "price": 3.50, "category": "Tacos", "description": "Slow-cooked pork shoulder", "image": "🌮"},
            {"id": 4, "name": "Pollo Tacos", "price": 3.00, "category": "Tacos", "description": "Grilled chicken with salsa verde", "image": "🌮"},
            {"id": 5, "name": "Fish Tacos", "price": 4.00, "category": "Tacos", "description": "Grilled fish with cabbage slaw", "image": "🌮"},
            
            # Special Tacos
            {"id": 6, "name": "Lobster Tacos", "price": 8.50, "category": "Special Tacos", "description": "Fresh lobster with avocado", "image": "🦞"},
            {"id": 7, "name": "Steak Fajita Tacos", "price": 4.50, "category": "Special Tacos", "description": "Sizzling steak with peppers", "image": "🥩"},
            {"id": 8, "name": "Shrimp Tacos", "price": 4.25, "category": "Special Tacos", "description": "Grilled shrimp with chipotle sauce", "image": "🍤"},
            
            # Burritos
            {"id": 9, "name": "Carne Asada Burrito", "price": 12.99, "category": "Burritos", "description": "Large flour tortilla with rice and beans", "image": "🌯"},
            {"id": 10, "name": "Chicken Burrito", "price": 11.99, "category": "Burritos", "description": "Grilled chicken with fresh salsa", "image": "🌯"},
            {"id": 11, "name": "Bean & Rice Burrito", "price": 9.99, "category": "Burritos", "description": "Vegetarian with black beans", "image": "🌯"},
            {"id": 12, "name": "California Burrito", "price": 13.99, "category": "Burritos", "description": "Carne asada with french fries", "image": "🌯"},
            
            # Quesadillas
            {"id": 13, "name": "Cheese Quesadilla", "price": 8.99, "category": "Quesadillas", "description": "Melted cheese in flour tortilla", "image": "🧀"},
            {"id": 14, "name": "Chicken Quesadilla", "price": 10.99, "category": "Quesadillas", "description": "Grilled chicken and cheese", "image": "🧀"},
            {"id": 15, "name": "Steak Quesadilla", "price": 12.99, "category": "Quesadillas", "description": "Carne asada and cheese", "image": "🧀"},
            
            # Appetizers
            {"id": 16, "name": "Nachos Supreme", "price": 11.99, "category": "Appetizers", "description": "Loaded with cheese, beans, and salsa", "image": "🧀"},
            {"id": 17, "name": "Guacamole & Chips", "price": 7.99, "category": "Appetizers", "description": "Fresh made guacamole", "image": "🥑"},
            {"id": 18, "name": "Queso Dip", "price": 6.99, "category": "Appetizers", "description": "Melted cheese dip with chips", "image": "🧀"},
            {"id": 19, "name": "Jalapeño Poppers", "price": 8.99, "category": "Appetizers", "description": "Stuffed with cream cheese", "image": "🌶️"},
            
            # Sides
            {"id": 20, "name": "Mexican Rice", "price": 3.99, "category": "Sides", "description": "Seasoned rice with tomatoes", "image": "🍚"},
            {"id": 21, "name": "Refried Beans", "price": 3.99, "category": "Sides", "description": "Traditional Mexican beans", "image": "🫘"},
            {"id": 22, "name": "Black Beans", "price": 3.99, "category": "Sides", "description": "Whole black beans", "image": "🫘"},
            {"id": 23, "name": "Elote (Street Corn)", "price": 4.99, "category": "Sides", "description": "Grilled corn with mayo and chili", "image": "🌽"},
            
            # Drinks
            {"id": 24, "name": "Horchata", "price": 3.50, "category": "Drinks", "description": "Sweet rice cinnamon drink", "image": "🥛"},
            {"id": 25, "name": "Jamaica Water", "price": 2.99, "category": "Drinks", "description": "Hibiscus flower water", "image": "🌺"},
            {"id": 26, "name": "Coca-Cola", "price": 2.50, "category": "Drinks", "description": "Classic soda", "image": "🥤"},
            {"id": 27, "name": "Sprite", "price": 2.50, "category": "Drinks", "description": "Lemon-lime soda", "image": "🥤"},
            {"id": 28, "name": "Orange Juice", "price": 3.25, "category": "Drinks", "description": "Fresh squeezed", "image": "🍊"},
            
            # Desserts
            {"id": 29, "name": "Churros", "price": 5.99, "category": "Desserts", "description": "Fried dough with cinnamon sugar", "image": "🍩"},
            {"id": 30, "name": "Flan", "price": 4.99, "category": "Desserts", "description": "Caramel custard", "image": "🍮"},
            {"id": 31, "name": "Tres Leches Cake", "price": 5.99, "category": "Desserts", "description": "Three milk cake", "image": "🍰"},
            
            # Breakfast
            {"id": 32, "name": "Breakfast Burrito", "price": 9.99, "category": "Breakfast", "description": "Eggs, cheese, and potatoes", "image": "🌯"},
            {"id": 33, "name": "Huevos Rancheros", "price": 11.99, "category": "Breakfast", "description": "Eggs with salsa on tortillas", "image": "🍳"},
            {"id": 34, "name": "Chilaquiles", "price": 10.99, "category": "Breakfast", "description": "Fried tortillas with salsa", "image": "🍳"},
            
            # Soups
            {"id": 35, "name": "Pozole", "price": 12.99, "category": "Soups", "description": "Traditional hominy soup", "image": "🍲"},
            {"id": 36, "name": "Tortilla Soup", "price": 8.99, "category": "Soups", "description": "Tomato-based soup with tortilla strips", "image": "🍲"}
        ],
        message="Menu items retrieved"
    )

@app.get("/api/v1/menu/categories")
async def get_menu_categories():
    """Get menu categories"""
    return APIResponseHelper.success(
        data=[
            {"id": 1, "name": "Tacos", "description": "Traditional Mexican tacos", "icon": "🌮"},
            {"id": 2, "name": "Special Tacos", "description": "Premium taco selections", "icon": "⭐"},
            {"id": 3, "name": "Burritos", "description": "Large flour tortilla wraps", "icon": "🌯"},
            {"id": 4, "name": "Quesadillas", "description": "Grilled cheese-filled tortillas", "icon": "🧀"},
            {"id": 5, "name": "Appetizers", "description": "Starters and snacks", "icon": "🥑"},
            {"id": 6, "name": "Sides", "description": "Side dishes and extras", "icon": "🍚"},
            {"id": 7, "name": "Drinks", "description": "Beverages and refreshments", "icon": "🥤"},
            {"id": 8, "name": "Desserts", "description": "Sweet treats", "icon": "🍰"},
            {"id": 9, "name": "Breakfast", "description": "Morning specialties", "icon": "🍳"},
            {"id": 10, "name": "Soups", "description": "Traditional Mexican soups", "icon": "🍲"}
        ],
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