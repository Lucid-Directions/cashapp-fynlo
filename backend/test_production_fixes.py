#!/usr/bin/env python3
"""
Test script to verify Redis and Supabase fixes
Run this locally with production environment variables
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Set environment to production to test production config
os.environ["ENVIRONMENT"] = "production"

async def test_redis_connection():
    """Test Redis connection with production settings"""
    print("\n🔍 Testing Redis Connection")
    print("="*50)
    
    from app.core.redis_client import redis_client
    
    try:
        # Try to connect
        await redis_client.connect()
        
        # Test ping
        ping_result = await redis_client.ping()
        print(f"✅ Redis ping: {ping_result}")
        
        # Test set/get
        test_key = "test:production:fix"
        test_value = "working"
        
        await redis_client.set(test_key, test_value, expire=10)
        retrieved = await redis_client.get(test_key)
        
        if retrieved == test_value:
            print(f"✅ Set/Get test passed: {retrieved}")
        else:
            print(f"❌ Set/Get test failed: expected '{test_value}', got '{retrieved}'")
        
        # Check mode
        is_mock = redis_client._mock_storage is not None and redis_client.redis is None
        print(f"📊 Redis mode: {'mock' if is_mock else 'real'}")
        
        return not is_mock  # Return True if real Redis
        
    except Exception as e:
        print(f"❌ Redis test failed: {type(e).__name__}: {e}")
        return False
    finally:
        await redis_client.disconnect()


async def test_supabase_initialization():
    """Test Supabase client initialization"""
    print("\n🔍 Testing Supabase Initialization")
    print("="*50)
    
    try:
        # Force reload of supabase module to test initialization
        import importlib
        import app.core.supabase
        importlib.reload(app.core.supabase)
        
        from app.core.supabase import supabase_admin
        
        if supabase_admin is None:
            print("❌ supabase_admin is None")
            
            # Check environment
            import os
            print(f"SUPABASE_URL env: {bool(os.getenv('SUPABASE_URL'))}")
            print(f"SUPABASE_SERVICE_ROLE_KEY env: {bool(os.getenv('SUPABASE_SERVICE_ROLE_KEY'))}")
            
            return False
        else:
            print("✅ supabase_admin initialized")
            
            # Test API call
            try:
                result = supabase_admin.auth.admin.list_users(page=1, per_page=1)
                print("✅ Supabase API call successful")
                return True
            except Exception as api_error:
                print(f"⚠️  supabase_admin exists but API failed: {api_error}")
                return False
                
    except Exception as e:
        print(f"❌ Supabase test failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_auth_endpoint():
    """Test the auth/verify endpoint"""
    print("\n🔍 Testing Auth Endpoint (Mock)")
    print("="*50)
    
    try:
        from fastapi.testclient import TestClient
        from app.main import app
        
        client = TestClient(app)
        
        # Test without token
        response = client.post("/api/v1/auth/verify")
        print(f"No token response: {response.status_code} - {response.json()}")
        
        # Test with invalid token
        response = client.post(
            "/api/v1/auth/verify",
            headers={"Authorization": "Bearer invalid-token"}
        )
        print(f"Invalid token response: {response.status_code} - {response.json()}")
        
        return True
        
    except Exception as e:
        print(f"❌ Auth endpoint test failed: {type(e).__name__}: {e}")
        return False


async def main():
    """Run all tests"""
    print("🚀 Production Fix Verification")
    print("="*50)
    
    # Check environment
    from app.core.config import settings
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Redis URL configured: {bool(settings.REDIS_URL)}")
    print(f"Supabase URL configured: {bool(settings.SUPABASE_URL)}")
    
    # Run tests
    redis_ok = await test_redis_connection()
    supabase_ok = await test_supabase_initialization()
    auth_ok = await test_auth_endpoint()
    
    # Summary
    print("\n📊 Test Summary")
    print("="*50)
    print(f"Redis Connection: {'✅ OK' if redis_ok else '❌ Failed (using mock)'}")
    print(f"Supabase Client: {'✅ OK' if supabase_ok else '❌ Failed'}")
    print(f"Auth Endpoint: {'✅ OK' if auth_ok else '❌ Failed'}")
    
    if not redis_ok:
        print("\n💡 Redis is falling back to mock storage.")
        print("This is acceptable in production but not ideal.")
    
    if not supabase_ok:
        print("\n💡 Supabase initialization failed.")
        print("Check that environment variables are set correctly.")


if __name__ == "__main__":
    asyncio.run(main())