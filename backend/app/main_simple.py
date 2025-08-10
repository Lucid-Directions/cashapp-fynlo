"""
Simplified Fynlo POS Backend for DigitalOcean deployment
Minimal version to ensure successful startup and health checks
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import os

# Import settings for CORS configuration
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app with minimal configuration
app = FastAPI(
    title="Fynlo POS Backend",
    description="Hardware-Free Restaurant Management Platform",
    version="1.0.0",
    debug=False,
)

# SECURE CORS middleware configuration
origins = settings.get_cors_origins if hasattr(settings, "get_cors_origins") else []

# Fallback for minimal deployment if settings not loaded properly
if not origins:
    origins = [
        "https://app.fynlo.co.uk",
        "https://fynlo.co.uk",
        "https://fynlopos-9eg2c.ondigitalocean.app",
        "https://eweggzpvuqczrrrwszyy.supabase.co",
    ]
    logger.warning(
        "Using hardcoded CORS origins as fallback - settings may not be loaded properly"
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS
    if hasattr(settings, "CORS_ALLOW_CREDENTIALS")
    else True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

logger.info(
    f"CORS configured for {settings.ENVIRONMENT if hasattr(settings, 'ENVIRONMENT') else 'unknown'} environment with {len(origins)} allowed origins"
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Fynlo POS Backend API",
        "version": "1.0.0",
        "status": "healthy",
        "message": "Fynlo POS API is running",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for DigitalOcean"""
    return {
        "status": "healthy",
        "service": "fynlo-pos-backend",
        "version": "1.0.0",
        "timestamp": "2025-01-08",
    }


@app.get("/api/v1/health")
async def api_health():
    """API health check"""
    return {"api_version": "v1", "status": "operational", "endpoints": "available"}


# Basic auth endpoint for testing
@app.post("/api/v1/auth/login")
async def login():
    """Basic login endpoint"""
    return {"message": "Authentication endpoint available", "status": "ready"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
