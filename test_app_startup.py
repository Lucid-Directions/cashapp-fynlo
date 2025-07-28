#!/usr/bin/env python3
"""Test application startup to find deployment issues"""

import sys
import os
import asyncio

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Set minimal env vars to avoid warnings
os.environ.setdefault('DATABASE_URL', 'postgresql://test@localhost/test')
os.environ.setdefault('REDIS_URL', 'redis://localhost')
os.environ.setdefault('SECRET_KEY', 'test-secret-key')
os.environ.setdefault('SUPABASE_URL', 'https://test.supabase.co')
os.environ.setdefault('SUPABASE_SERVICE_ROLE_KEY', 'test-key')

try:
    print("Testing FastAPI app startup...")
    
    # Import the app
    from app.main import app
    print("✓ App imported successfully")
    
    # Check if all routes are registered
    routes = []
    for route in app.routes:
        if hasattr(route, 'path'):
            routes.append(f"{route.methods} {route.path}")
    
    print(f"\nFound {len(routes)} routes")
    
    # Check WebSocket routes
    ws_routes = [r for r in routes if 'websocket' in r.lower()]
    print(f"WebSocket routes: {len(ws_routes)}")
    for route in ws_routes:
        print(f"  - {route}")
    
    # Test startup event
    print("\nTesting startup events...")
    startup_events = app.router.on_startup
    print(f"Startup events registered: {len(startup_events)}")
    
    # Test shutdown event
    shutdown_events = app.router.on_shutdown
    print(f"Shutdown events registered: {len(shutdown_events)}")
    
    print("\n✓ App structure looks good!")
    
except Exception as e:
    print(f"\n✗ Startup failed: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)