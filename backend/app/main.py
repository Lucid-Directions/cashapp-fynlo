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

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize application on startup"""
    logger.info(f"🚀 Fynlo POS Backend starting in {settings.ENVIRONMENT} mode...")
    logger.info(f"Debug mode: {settings.DEBUG}")
    
    # Initialize database
    await init_db()
    logger.info("✅ Database initialized")
    
    # Initialize Redis
    await init_redis() # This now connects the redis_client
    logger.info("✅ Redis connected")

    # Initialize FastAPI Limiter (depends on Redis being connected)
    await init_fastapi_limiter()
    logger.info("✅ Rate limiter initialized")
    
    # WebSocket manager is ready (no initialization needed)
    logger.info("✅ WebSocket manager ready")
    
    # Log version middleware configuration
    logger.info("✅ API version middleware enabled (backward compatibility)")
    
    yield
    
    # Cleanup on shutdown
    logger.info("🔄 Shutting down Fynlo POS Backend...")
    await close_redis() # Ensure Redis client is closed
    logger.info("✅ Redis client closed.")
    logger.info("✅ Cleanup complete")

app = FastAPI(
    title=settings.APP_NAME,
    description="Hardware-Free Restaurant Management Platform",
    version="1.0.0",
    lifespan=lifespan,
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

# Add API version middleware for backward compatibility (FIRST in middleware stack)
# This must be added before other middleware to ensure path rewriting happens first
app.add_middleware(APIVersionMiddleware)

# Add Security Headers Middleware (after CORS and Versioning, before others)
# Ensure this import is added at the top of the file:
# from app.middleware.security_headers_middleware import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)

# Add mobile compatibility middleware
app.add_middleware(MobileCompatibilityMiddleware, enable_cors=True, enable_port_redirect=True)
app.add_middleware(MobileDataOptimizationMiddleware)

# Add SlowAPI middleware (for rate limiting) - TEMPORARILY DISABLED
# This middleware itself doesn't enforce limits but makes the limiter available.
# Limits are enforced by decorators or dependencies.
# app.add_middleware(SlowAPIMiddleware)

# Register standardized exception handlers
register_exception_handlers(app) # General handlers

# Add specific handler for rate limit exceeded
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


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
    """Detailed health check with standardized response"""
    
    # Check database connection
    database_status = "disconnected"
    try:
        from app.core.database import get_db_session
        db = next(get_db_session())
        # Simple query to test connection
        db.execute("SELECT 1")
        database_status = "connected"
        db.close()
    except Exception:
        database_status = "disconnected"
    
    # Check Redis connection  
    redis_status = "disconnected"
    try:
        from app.core.redis_client import get_redis
        redis = get_redis()
        if redis and redis.ping():
            redis_status = "connected"
    except Exception:
        redis_status = "disconnected"
    
    # Overall health status
    overall_status = "healthy" if database_status == "connected" else "degraded"
    
    return APIResponseHelper.success(
        data={
            "status": overall_status,
            "database": database_status,
            "redis": redis_status,
            "websocket": "ready",
            "api_version": "v1",
            "version_middleware": "enabled",
            "backward_compatibility": "enabled",
            "timestamp": datetime.utcnow().isoformat()
        },
        message="Health check completed" if overall_status == "healthy" else "Service degraded - database not available"
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

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0", # Make sure this is configurable if needed for production
        port=8000, # Make sure this is configurable if needed for production
        reload=settings.ENVIRONMENT == "development", # Disable reload in production
        log_level=settings.LOG_LEVEL.lower() # Use log_level from settings
    )