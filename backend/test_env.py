#!/usr/bin/env python3
"""Test environment loading"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("Testing environment variables...")
print(f"SUPABASE_URL: {os.getenv('SUPABASE_URL')}")
print(f"PLATFORM_OWNER_EMAIL: {os.getenv('PLATFORM_OWNER_EMAIL')}")
print(f"CORS_ORIGINS: {os.getenv('CORS_ORIGINS')}")
print(f"DATABASE_URL: {os.getenv('DATABASE_URL')[:50]}...")

# Test parsing CORS_ORIGINS
cors_origins_str = os.getenv('CORS_ORIGINS', '')
print(f"\nRaw CORS_ORIGINS: {cors_origins_str}")

if cors_origins_str:
    # Remove quotes if present
    cors_origins_str = cors_origins_str.strip('"').strip("'")
    cors_list = [origin.strip() for origin in cors_origins_str.split(',')]
    print(f"Parsed CORS_ORIGINS list: {cors_list}")
    print(f"Number of origins: {len(cors_list)}")