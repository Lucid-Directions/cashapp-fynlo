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

# Create FastAPI app with minimal configuration
app = FastAPI(
    title="Fynlo POS Backend",
    description="Hardware-Free Restaurant Management Platform",
    version="1.0.0",
    debug=False
)

# CORS middleware for React Native frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permissive for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Fynlo POS Backend API",
        "version": "1.0.0",
        "status": "healthy",
        "message": "Fynlo POS API is running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for DigitalOcean"""
    return {
        "status": "healthy",
        "service": "fynlo-pos-backend",
        "version": "1.0.0",
        "timestamp": "2025-01-08"
    }

@app.get("/api/v1/health")
async def api_health():
    """API health check"""
    return {
        "api_version": "v1",
        "status": "operational",
        "endpoints": "available"
    }

# Basic auth endpoint for testing
@app.post("/api/v1/auth/login")
async def login():
    """Basic login endpoint"""
    return {
        "message": "Authentication endpoint available",
        "status": "ready"
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)