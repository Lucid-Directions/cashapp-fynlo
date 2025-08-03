#!/usr/bin/env python3
"""
Test CORS parsing directly
"""

import os
import sys

# Force production environment
os.environ["APP_ENV"] = "production"

logger.info("=== Direct CORS Parsing Test ===")
logger.info(f"APP_ENV: {os.getenv('APP_ENV')}")

# Test loading .env.production
from dotenv import load_dotenv
env_file = f".env.{os.getenv('APP_ENV', 'development')}"
logger.info(f"Loading env file: {env_file}")
load_dotenv(dotenv_path=env_file, override=True)

# Check what CORS_ORIGINS is set to
cors_value = os.getenv('CORS_ORIGINS')
logger.info(f"CORS_ORIGINS from env: {repr(cors_value)}")
logger.info(f"Type: {type(cors_value)}")

# Try the parsing function directly
try:
    from app.core.config import Settings
    
    # Test the validator directly
    test_values = [
        None,
        "",
        "https://example.com",
        "https://example.com,https://api.example.com",
        '["https://example.com"]',
        '["https://example.com","https://api.example.com"]',
        cors_value  # The actual value from env
    ]
    
    for val in test_values:
        try:
            result = Settings.parse_cors_origins(val)
            logger.info(f"✅ parse_cors_origins({repr(val)}) = {result}")
        except Exception as e:
            logger.error(f"❌ parse_cors_origins({repr(val)}) failed: {e}")
            
except Exception as e:
    logger.error(f"❌ Failed to import Settings: {e}")
    import traceback
import logging

logger = logging.getLogger(__name__)

    traceback.print_exc()
