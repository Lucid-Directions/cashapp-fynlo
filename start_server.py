#!/usr/bin/env python3
"""
Simple startup script for DigitalOcean deployment
Sets up Python path and runs uvicorn with the correct module path
"""
import sys
import os
import subprocess

# Add the root directory to Python path so 'backend' module can be found
root_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, root_dir)

# Get environment variables
host = os.getenv("API_HOST", "0.0.0.0")
port = os.getenv("PORT", os.getenv("API_PORT", "8080"))
log_level = os.getenv("LOG_LEVEL", "info")

# Run uvicorn with the module path that DigitalOcean expects
cmd = [
    sys.executable, "-m", "uvicorn",
    "backend.app.main:app",
    "--host", host,
    "--port", port,
    "--log-level", log_level
]

# Execute the command
subprocess.run(cmd)