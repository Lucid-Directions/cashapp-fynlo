#!/usr/bin/env python3
"""
Debug authentication issues with Supabase
"""

import os
import sys
sys.path.insert(0, '.')

# Test 1: Check environment variables
print("=== 1. Environment Variables Check ===")
print(f"SUPABASE_URL: {'✅ SET' if os.getenv('SUPABASE_URL') else '❌ NOT SET'}")
print(f"SUPABASE_SERVICE_ROLE_KEY: {'✅ SET' if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else '❌ NOT SET'}")
print(f"supabase_secret_key: {'✅ SET' if os.getenv('supabase_secret_key') else '❌ NOT SET'}")

# Test 2: Try to import and use settings
print("\n=== 2. Settings Import Test ===")
try:
    from app.core.config import settings
    print("✅ Settings imported successfully")
    print(f"SUPABASE_URL from settings: {'✅ SET' if settings.SUPABASE_URL else '❌ NOT SET'}")
    print(f"SUPABASE_SERVICE_ROLE_KEY from settings: {'✅ SET' if settings.SUPABASE_SERVICE_ROLE_KEY else '❌ NOT SET'}")
except Exception as e:
    print(f"❌ Failed to import settings: {e}")

# Test 3: Try to initialize Supabase client
print("\n=== 3. Supabase Client Initialization ===")
try:
    from app.core.supabase import get_admin_client, get_supabase_client
    
    # Try direct client creation
    try:
        client = get_supabase_client()
        print("✅ Direct Supabase client creation successful")
    except Exception as e:
        print(f"❌ Direct client creation failed: {e}")
    
    # Try admin client
    try:
        admin_client = get_admin_client()
        if admin_client:
            print("✅ Admin client initialized successfully")
        else:
            print("❌ Admin client is None")
    except Exception as e:
        print(f"❌ Admin client initialization failed: {e}")
        
except Exception as e:
    print(f"❌ Failed to import Supabase module: {e}")

# Test 4: Try to verify a fake token
print("\n=== 4. Token Verification Test ===")
try:
    from app.core.supabase import get_admin_client
    client = get_admin_client()
    
    if client:
        try:
            # This should fail with an invalid token error, not a service error
            user_response = client.auth.get_user("fake-token-12345")
            print(f"❌ Unexpected success: {user_response}")
        except Exception as e:
            error_str = str(e)
            if "invalid" in error_str.lower() or "unauthorized" in error_str.lower():
                print(f"✅ Expected token validation error: {error_str}")
            else:
                print(f"❌ Unexpected error type: {error_str}")
    else:
        print("❌ No client available for testing")
        
except Exception as e:
    print(f"❌ Token verification test failed: {e}")

print("\n=== Debug Complete ===")