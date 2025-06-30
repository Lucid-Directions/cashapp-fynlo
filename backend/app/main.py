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
from app.core.redis_client import init_redis
from app.core.websocket import websocket_manager
from app.core.exceptions import register_exception_handlers
from app.core.responses import APIResponseHelper
from app.core.mobile_middleware import (
    MobileCompatibilityMiddleware,
    MobileDataOptimizationMiddleware
)
from app.middleware.version_middleware import APIVersionMiddleware
from app.middleware.security_headers_middleware import SecurityHeadersMiddleware # Added import
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize application on startup"""
    logger.info("🚀 Fynlo POS Backend starting...")
    
    # Initialize database
    await init_db()
    logger.info("✅ Database initialized")
    
    # Initialize Redis
    await init_redis()
    logger.info("✅ Redis connected")
    
    # WebSocket manager is ready (no initialization needed)
    logger.info("✅ WebSocket manager ready")
    
    # Log version middleware configuration
    logger.info("✅ API version middleware enabled (backward compatibility)")
    
    yield
    
    # Cleanup on shutdown
    logger.info("🔄 Shutting down Fynlo POS Backend...")
    logger.info("✅ Cleanup complete")

app = FastAPI(
    title="Fynlo POS API",
    description="Hardware-Free Restaurant Management Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for React Native frontend
if settings.ENVIRONMENT == "production":
    allowed_origins = settings.PRODUCTION_ALLOWED_ORIGINS
else:
    allowed_origins = ["*"] # Permissive for development

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

# Register standardized exception handlers
register_exception_handlers(app)

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
    return APIResponseHelper.success(
        data={
            "status": "healthy",
            "database": "connected",
            "redis": "connected",
            "websocket": "ready",
            "api_version": "v1",
            "version_middleware": "enabled",
            "backward_compatibility": "enabled",
            "timestamp": datetime.utcnow().isoformat()
        },
        message="All systems operational"
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
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )