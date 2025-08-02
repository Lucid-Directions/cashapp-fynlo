#!/usr/bin/env python3
"""Test environment loading"""

import os
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)


# Load environment variables
load_dotenv()

logger.info("Testing environment variables...")
logger.info(f"SUPABASE_URL: {os.getenv('SUPABASE_URL')}")
logger.info(f"PLATFORM_OWNER_EMAIL: {os.getenv('PLATFORM_OWNER_EMAIL')}")
logger.info(f"CORS_ORIGINS: {os.getenv('CORS_ORIGINS')}")
logger.info(f"DATABASE_URL: {os.getenv('DATABASE_URL')[:50]}...")

# Test parsing CORS_ORIGINS
cors_origins_str = os.getenv('CORS_ORIGINS', '')
logger.info(f"\nRaw CORS_ORIGINS: {cors_origins_str}")

if cors_origins_str:
    # Remove quotes if present
    cors_origins_str = cors_origins_str.strip('"').strip("'")
    cors_list = [origin.strip() for origin in cors_origins_str.split(',')]
    logger.info(f"Parsed CORS_ORIGINS list: {cors_list}")
    logger.info(f"Number of origins: {len(cors_list)}")