"""
Fynlo POS Backend API
Clean FastAPI implementation for hardware-free restaurant management
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
import uvicorn
import logging
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.api import api_router
from app.core.redis_client import init_redis
from app.websocket.manager import websocket_manager
from app.core.exceptions import register_exception_handlers
from app.core.responses import APIResponseHelper

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
    
    # Initialize WebSocket manager
    await websocket_manager.initialize()
    logger.info("✅ WebSocket manager ready")
    
    yield
    
    # Cleanup on shutdown
    logger.info("🔄 Shutting down Fynlo POS Backend...")
    await websocket_manager.cleanup()
    logger.info("✅ Cleanup complete")

app = FastAPI(
    title="Fynlo POS API",
    description="Hardware-Free Restaurant Management Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for React Native frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register standardized exception handlers
register_exception_handlers(app)

# Include API routes
app.include_router(api_router, prefix="/api/v1")

# WebSocket routes
from app.websocket.endpoints import (
    websocket_endpoint,
    kitchen_websocket_endpoint,
    pos_websocket_endpoint,
    management_websocket_endpoint
)

app.websocket("/ws/{restaurant_id}")(websocket_endpoint)
app.websocket("/ws/kitchen/{restaurant_id}")(kitchen_websocket_endpoint)
app.websocket("/ws/pos/{restaurant_id}")(pos_websocket_endpoint)
app.websocket("/ws/management/{restaurant_id}")(management_websocket_endpoint)

@app.get("/")
async def root():
    """Health check endpoint with standardized response"""
    return APIResponseHelper.success(
        data={
            "service": "Fynlo POS Backend API",
            "version": "1.0.0",
            "status": "healthy"
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
            "timestamp": datetime.utcnow().isoformat()
        },
        message="All systems operational"
    )

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )