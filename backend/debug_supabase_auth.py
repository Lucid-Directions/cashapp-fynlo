#!/usr/bin/env python3
"""
Debug Supabase authentication locally
"""

import os
from dotenv import load_dotenv

# Load environment
load_dotenv(dotenv_path=".env")

# Import after loading env
from app.core.supabase import get_admin_client
from supabase import create_client

print("=== Supabase Auth Debug ===")

# Check environment variables
print("\n1. Environment Variables:")
print(f"SUPABASE_URL: {'SET' if os.getenv('SUPABASE_URL') else 'NOT SET'}")
print(f"SUPABASE_SERVICE_ROLE_KEY: {'SET' if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else 'NOT SET'}")

# Try to initialize client
print("\n2. Initializing Supabase client...")
try:
    client = get_admin_client()
    if client:
        print("✅ Client initialized successfully")
    else:
        print("❌ Client initialization returned None")
        exit(1)
except Exception as e:
    print(f"❌ Client initialization failed: {e}")
    exit(1)

# Test with a fake token
print("\n3. Testing token verification with fake token...")
fake_token = "fake-token-12345"

try:
    user_response = client.auth.get_user(fake_token)
    print(f"Unexpected success: {user_response}")
except Exception as e:
    print(f"Expected error type: {type(e).__name__}")
    print(f"Error message: {str(e)}")
    print(f"Error details: {repr(e)}")
    
    # Check if it's a specific error we can catch
    if hasattr(e, 'response'):
        print(f"Response status: {getattr(e.response, 'status_code', 'N/A')}")
        print(f"Response body: {getattr(e.response, 'text', 'N/A')}")