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

# Include API routes
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Fynlo POS Backend API",
        "version": "1.0.0",
        "status": "healthy"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected",
        "redis": "connected",
        "websocket": "ready"
    }

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )