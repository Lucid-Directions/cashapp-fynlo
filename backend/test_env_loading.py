#!/usr/bin/env python3
"""
Test script to diagnose environment variable loading issues
"""

import os
import sys
from dotenv import load_dotenv

print("=== Environment Variable Diagnostic Tool ===\n")

# Check current environment
print(f"1. Current APP_ENV: {os.getenv('APP_ENV', 'Not set')}")
print(f"2. Current working directory: {os.getcwd()}")

# Check for .env files
env_files = ['.env', '.env.development', '.env.production', '.env.local']
print("\n3. Checking for .env files:")
for env_file in env_files:
    exists = os.path.exists(env_file)
    print(f"   - {env_file}: {'EXISTS' if exists else 'NOT FOUND'}")

# Check Supabase-related environment variables
print("\n4. Supabase environment variables (before loading .env):")
supabase_vars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'supabase_secret_key'
]
for var in supabase_vars:
    value = os.getenv(var)
    if value:
        print(f"   - {var}: SET (first 20 chars: {value[:20]}...)")
    else:
        print(f"   - {var}: NOT SET")

# Try loading .env files
print("\n5. Attempting to load .env files:")
for env_file in env_files:
    if os.path.exists(env_file):
        print(f"   Loading {env_file}...")
        load_dotenv(dotenv_path=env_file, override=True)
        # Check again after loading
        print(f"   After loading {env_file}:")
        for var in supabase_vars:
            value = os.getenv(var)
            if value:
                print(f"      - {var}: NOW SET")

# Try importing settings
print("\n6. Testing settings import:")
try:
    sys.path.insert(0, '.')
    from app.core.config import settings
    print("   ✅ Settings imported successfully")
    print(f"   - SUPABASE_URL: {'SET' if settings.SUPABASE_URL else 'NOT SET'}")
    print(f"   - SUPABASE_SERVICE_ROLE_KEY: {'SET' if settings.SUPABASE_SERVICE_ROLE_KEY else 'NOT SET'}")
    print(f"   - ENVIRONMENT: {settings.ENVIRONMENT}")
except Exception as e:
    print(f"   ❌ Failed to import settings: {e}")

# Test Supabase client initialization
print("\n7. Testing Supabase client initialization:")
try:
    from app.core.supabase import get_supabase_client
    client = get_supabase_client()
    print("   ✅ Supabase client initialized successfully")
except Exception as e:
    print(f"   ❌ Failed to initialize Supabase client: {e}")

print("\n=== End of Diagnostic ===")