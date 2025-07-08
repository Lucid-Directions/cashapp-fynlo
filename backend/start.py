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
    
    print(f"🚀 Starting Fynlo POS Backend on {host}:{port}")
    print(f"Environment: {os.environ.get('ENVIRONMENT', 'production')}")
    print(f"Debug mode: {os.environ.get('DEBUG', 'false')}")
    
    # Use minimal app to avoid startup issues
    try:
        from app.main_minimal import app
        print("✅ Using minimal app (no external dependencies)")
    except ImportError:
        from app.main import app
        print("⚠️ Using full app (may require external dependencies)")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=True
    )