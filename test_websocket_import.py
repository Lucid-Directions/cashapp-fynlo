#!/usr/bin/env python3
"""Test script to check for import issues in websocket module"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    print("Testing imports...")
    
    # Test basic imports
    import asyncio
    print("✓ asyncio imported")
    
    import json
    print("✓ json imported")
    
    import logging
    print("✓ logging imported")
    
    # Test FastAPI imports
    from fastapi import WebSocket
    print("✓ FastAPI WebSocket imported")
    
    # Test app imports
    from app.core.database import User, Restaurant
    print("✓ Database models imported")
    
    from app.core.websocket import websocket_manager
    print("✓ WebSocket manager imported")
    
    # Now test the full import
    print("\nTesting full websocket module import...")
    import app.api.v1.endpoints.websocket
    print("✓ WebSocket module imported successfully!")
    
    # Check for the cleanup task
    print("\nChecking cleanup task...")
    print(f"cleanup_task defined: {hasattr(app.api.v1.endpoints.websocket, 'cleanup_task')}")
    print(f"cleanup_task value: {app.api.v1.endpoints.websocket.cleanup_task}")
    
except Exception as e:
    print(f"✗ Import failed: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\nAll imports successful!")