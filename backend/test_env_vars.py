#!/usr/bin/env python3
"""
Test environment variable loading
"""

import os
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)


logger.info("=== Environment Variable Loading Test ===")

# Force load .env
logger.info("\nLoading .env file...")
load_dotenv(dotenv_path=".env", override=True)

# Check key variables
key_vars = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "supabase_secret_key",
    "SUPABASE_ANON_KEY",
    "DATABASE_URL",
    "REDIS_URL"
]

for var in key_vars:
    value = os.getenv(var)
    if value:
        if "KEY" in var or "PASSWORD" in var:
            logger.info(f"{var}: ✅ SET (hidden)")
        else:
            logger.info(f"{var}: ✅ SET - {value[:30]}...")
    else:
        logger.info(f"{var}: ❌ NOT SET")

# Check if .env.production is being loaded
logger.info("\n\nChecking .env.production...")
load_dotenv(dotenv_path=".env.production", override=True)

for var in key_vars:
    value = os.getenv(var)
    if value:
        if "KEY" in var or "PASSWORD" in var:
            logger.info(f"{var}: ✅ SET (hidden)")
        else:
            logger.info(f"{var}: ✅ SET - {value[:30]}...")
    else:
        logger.info(f"{var}: ❌ NOT SET")