#!/usr/bin/env python3
"""
Test script for DigitalOcean Valkey connection
Run this to diagnose connection issues
"""

import asyncio
import os
import ssl
import redis.asyncio as aioredis
from urllib.parse import urlparse

async def test_valkey_connection():
    redis_url = os.getenv('REDIS_URL')
    if not redis_url:
        print("❌ REDIS_URL environment variable not set")
        return
    
    # Parse URL to show connection details (mask password)
    parsed = urlparse(redis_url)
    print(f"🔍 Testing connection to: {parsed.scheme}://{parsed.username}:****@{parsed.hostname}:{parsed.port}")
    
    # Test 1: Basic connection
    print("\n📝 Test 1: Basic connection")
    try:
        client = aioredis.from_url(redis_url, decode_responses=True, socket_connect_timeout=15)
        await client.ping()
        print("✅ Basic connection successful")
        await client.close()
    except Exception as e:
        print(f"❌ Basic connection failed: {type(e).__name__}: {e}")
    
    # Test 2: With SSL context (DigitalOcean recommended)
    print("\n📝 Test 2: With SSL context")
    try:
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        client = aioredis.from_url(
            redis_url, 
            decode_responses=True,
            ssl=ssl_context,
            socket_connect_timeout=15,
            socket_timeout=15
        )
        await client.ping()
        print("✅ SSL context connection successful")
        
        # Test some operations
        await client.set("test_key", "test_value", ex=60)
        value = await client.get("test_key")
        print(f"✅ Set/Get test successful: {value}")
        
        await client.close()
    except Exception as e:
        print(f"❌ SSL context connection failed: {type(e).__name__}: {e}")
    
    # Test 3: Try with public hostname if private fails
    if "private-" in redis_url:
        print("\n📝 Test 3: Trying public hostname")
        public_url = redis_url.replace("private-", "")
        try:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            client = aioredis.from_url(
                public_url, 
                decode_responses=True,
                ssl=ssl_context,
                socket_connect_timeout=15
            )
            await client.ping()
            print("✅ Public hostname connection successful")
            print(f"💡 Consider using public URL: {public_url.split('@')[1]}")
            await client.close()
        except Exception as e:
            print(f"❌ Public hostname also failed: {type(e).__name__}: {e}")
    
    # Test 4: Check if database number matters
    if not redis_url.endswith('/0'):
        print("\n📝 Test 4: Testing with explicit database 0")
        db_url = redis_url + '/0'
        try:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            client = aioredis.from_url(
                db_url, 
                decode_responses=True,
                ssl=ssl_context,
                socket_connect_timeout=15
            )
            await client.ping()
            print("✅ Database 0 connection successful")
            print(f"💡 Consider adding /0 to your Redis URL")
            await client.close()
        except Exception as e:
            print(f"❌ Database 0 connection failed: {type(e).__name__}: {e}")

if __name__ == "__main__":
    print("🚀 DigitalOcean Valkey Connection Test")
    print("=====================================")
    asyncio.run(test_valkey_connection())