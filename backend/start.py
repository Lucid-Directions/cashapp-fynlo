#!/usr/bin/env python3
"""
Minimal startup script for DigitalOcean deployment
Uses minimal app without external dependencies
"""

import os
import uvicorn

if __name__ == "__main__":
    # DigitalOcean provides PORT environment variable
    port = int(os.environ.get("PORT", 8000))
    host = "0.0.0.0"
    
    logger.info(f"🚀 Starting Fynlo POS Backend on {host}:{port}")
    logger.info(f"Environment: {os.environ.get('ENVIRONMENT', 'production')}")
    logger.debug(f"Debug mode: {os.environ.get('DEBUG', 'false')}")
    
    # Force minimal app for deployment stability
    from app.main_minimal import app
import logging

logger = logging.getLogger(__name__)

    logger.info("✅ Using minimal app (no external dependencies)")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=True
    )
