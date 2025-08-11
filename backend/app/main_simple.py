"""
Simplified Fynlo POS Backend for DigitalOcean deployment
Minimal version to ensure successful startup and health checks
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to import settings, but don't fail if configuration is missing
try:
    from app.core.config import settings

    settings_available = True
except Exception as e:
    logger.warning(f"Could not load settings (this is expected in minimal mode): {e}")
    settings = None
    settings_available = False

# Create FastAPI app with minimal configuration
app = FastAPI(
    title="Fynlo POS Backend",
    description="Hardware-Free Restaurant Management Platform",
    version="1.0.0",
    debug=False,
)

# SECURE CORS middleware configuration
if settings_available and hasattr(settings, "get_cors_origins"):
    origins = settings.get_cors_origins
else:
    # Use hardcoded secure origins when settings aren't available
    origins = [
        "https://app.fynlo.co.uk",
        "https://fynlo.co.uk",
        "https://fynlopos-9eg2c.ondigitalocean.app",
        "https://eweggzpvuqczrrrwszyy.supabase.co",
    ]
    # Add development origins if explicitly in development
    if os.getenv("ENVIRONMENT", "production").lower() == "development":
        origins.extend(
            [
                "http://localhost:3000",
                "http://localhost:8080",
                "http://localhost:8081",
            ]
        )
    logger.info(f"Using hardcoded secure CORS origins (settings not available)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS
    if (settings_available and hasattr(settings, "CORS_ALLOW_CREDENTIALS"))
    else False,  # Security: Default to False
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

environment = (
    settings.ENVIRONMENT
    if (settings_available and hasattr(settings, "ENVIRONMENT"))
    else os.getenv("ENVIRONMENT", "unknown")
)
logger.info(
    f"CORS configured for {environment} environment with {len(origins)} allowed origins"
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
