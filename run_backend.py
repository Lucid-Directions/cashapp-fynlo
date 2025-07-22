#!/usr/bin/env python3
"""
Root-level startup script for DigitalOcean deployment
This ensures the backend module can be found regardless of working directory
"""
import sys
import os

# Add both the root and backend directories to Python path
root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, 'backend')

sys.path.insert(0, root_dir)  # Add root so 'backend' module can be found
sys.path.insert(0, backend_dir)  # Add backend so 'app' module can be found

# Now we can import from both paths
if __name__ == "__main__":
    import uvicorn
    
    # Try both module paths to be flexible
    try:
        # First try the path that DigitalOcean expects
        uvicorn.run(
            "backend.app.main:app",
            host=os.getenv("API_HOST", "0.0.0.0"),
            port=int(os.getenv("PORT", os.getenv("API_PORT", "8080"))),
            workers=int(os.getenv("WEB_CONCURRENCY", "1")),
            log_level=os.getenv("LOG_LEVEL", "info"),
            loop="uvloop"
        )
    except ImportError:
        # Fall back to direct app import
        uvicorn.run(
            "app.main:app",
            host=os.getenv("API_HOST", "0.0.0.0"),
            port=int(os.getenv("PORT", os.getenv("API_PORT", "8080"))),
            workers=int(os.getenv("WEB_CONCURRENCY", "1")),
            log_level=os.getenv("LOG_LEVEL", "info"),
            loop="uvloop"
        )