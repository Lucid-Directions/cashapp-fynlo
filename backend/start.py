#!/usr/bin/env python3
"""
Simple startup script for DigitalOcean deployment
This helps resolve module import issues when the app is run from different directories
"""
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import and run the app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", os.getenv("API_PORT", "8080"))),
        workers=int(os.getenv("WEB_CONCURRENCY", "1")),
        log_level=os.getenv("LOG_LEVEL", "info"),
        loop="uvloop"
    )