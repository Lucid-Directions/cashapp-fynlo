#!/usr/bin/env python3
"""
Simplified startup script for DigitalOcean deployment
Ensures the app starts on the correct port with proper configuration
"""

import os
import uvicorn
from app.main import app

if __name__ == "__main__":
    # DigitalOcean provides PORT environment variable
    port = int(os.environ.get("PORT", 8000))
    host = "0.0.0.0"
    
    print(f"🚀 Starting Fynlo POS Backend on {host}:{port}")
    print(f"Environment: {os.environ.get('ENVIRONMENT', 'development')}")
    print(f"Debug mode: {os.environ.get('DEBUG', 'true')}")
    
    uvicorn.run(
        app,  # Use the app instance directly
        host=host,
        port=port,
        log_level="info",
        access_log=True
    )