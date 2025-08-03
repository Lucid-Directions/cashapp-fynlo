#!/usr/bin/env python3
"""
Test script to diagnose environment variable loading issues
"""

import os
import sys
from dotenv import load_dotenv

logger.info("=== Environment Variable Diagnostic Tool ===\n")

# Check current environment
logger.info(f"1. Current APP_ENV: {os.getenv('APP_ENV', 'Not set')}")
logger.info(f"2. Current working directory: {os.getcwd()}")

# Check for .env files
env_files = ['.env', '.env.development', '.env.production', '.env.local']
logger.info("\n3. Checking for .env files:")
for env_file in env_files:
    exists = os.path.exists(env_file)
    logger.info(f"   - {env_file}: {'EXISTS' if exists else 'NOT FOUND'}")

# Check Supabase-related environment variables
logger.info("\n4. Supabase environment variables (before loading .env):")
supabase_vars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'supabase_secret_key'
]
for var in supabase_vars:
    value = os.getenv(var)
    if value:
        logger.info(f"   - {var}: SET (first 20 chars: {value[:20]}...)")
    else:
        logger.info(f"   - {var}: NOT SET")

# Try loading .env files
logger.info("\n5. Attempting to load .env files:")
for env_file in env_files:
    if os.path.exists(env_file):
        logger.info(f"   Loading {env_file}...")
        load_dotenv(dotenv_path=env_file, override=True)
        # Check again after loading
        logger.info(f"   After loading {env_file}:")
        for var in supabase_vars:
            value = os.getenv(var)
            if value:
                logger.info(f"      - {var}: NOW SET")

# Try importing settings
logger.info("\n6. Testing settings import:")
try:
    sys.path.insert(0, '.')
    from app.core.config import settings
    logger.info("   ✅ Settings imported successfully")
    logger.info(f"   - SUPABASE_URL: {'SET' if settings.SUPABASE_URL else 'NOT SET'}")
    logger.info(f"   - SUPABASE_SERVICE_ROLE_KEY: {'SET' if settings.SUPABASE_SERVICE_ROLE_KEY else 'NOT SET'}")
    logger.info(f"   - ENVIRONMENT: {settings.ENVIRONMENT}")
except Exception as e:
    logger.error(f"   ❌ Failed to import settings: {e}")

# Test Supabase client initialization
logger.info("\n7. Testing Supabase client initialization:")
try:
    from app.core.supabase import get_supabase_client
import logging

logger = logging.getLogger(__name__)

    client = get_supabase_client()
    logger.info("   ✅ Supabase client initialized successfully")
except Exception as e:
    logger.error(f"   ❌ Failed to initialize Supabase client: {e}")

logger.info("\n=== End of Diagnostic ===")
