#!/usr/bin/env python3
"""
Test Authentication Flow for Fynlo POS
This script tests the complete authentication flow to identify issues
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_URL = "http://localhost:8000/api/v1"
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://eweggzpvuqczrrrwszyy.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Test credentials
TEST_EMAIL = "test@example.com"  # Replace with your test email
TEST_PASSWORD = "testpassword123"  # Replace with your test password


async def test_supabase_direct():
    """Test direct Supabase authentication"""
    logger.info("\n🔍 Testing Direct Supabase Authentication...")
    
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(url, headers=headers, json=data) as response:
                result = await response.json()
                
                if response.status == 200:
                    logger.info("✅ Supabase authentication successful!")
                    logger.info(f"   Access Token: {result.get('access_token', '')[:50]}...")
                    return result.get('access_token')
                else:
                    logger.error(f"❌ Supabase authentication failed: {response.status}")
                    logger.error(f"   Error: {result}")
                    return None
                    
        except Exception as e:
            logger.error(f"❌ Supabase connection error: {str(e)}")
            return None


async def test_backend_verify(access_token):
    """Test backend verification endpoint"""
    logger.info("\n🔍 Testing Backend Verification...")
    
    if not access_token:
        logger.info("⚠️  No access token available")
        return None
    
    url = f"{API_URL}/auth/verify"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(url, headers=headers) as response:
                result = await response.json()
                
                if response.status == 200:
                    logger.info("✅ Backend verification successful!")
                    logger.info(f"   User: {json.dumps(result.get('user', {}), indent=2)}")
                    return result
                else:
                    logger.error(f"❌ Backend verification failed: {response.status}")
                    logger.error(f"   Error: {result}")
                    return None
                    
        except Exception as e:
            logger.error(f"❌ Backend connection error: {str(e)}")
            return None


async def test_websocket_connection(access_token, user_id, restaurant_id):
    """Test WebSocket connection"""
    logger.info("\n🔍 Testing WebSocket Connection...")
    
    if not access_token or not user_id:
        logger.info("⚠️  Missing credentials for WebSocket test")
        return
    
    ws_url = f"ws://localhost:8000/api/v1/ws/{restaurant_id}?user_id={user_id}&token={access_token}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(ws_url) as ws:
                logger.info("✅ WebSocket connected successfully!")
                
                # Send ping
                await ws.send_json({"type": "ping"})
                
                # Wait for pong
                msg = await ws.receive()
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    if data.get("type") == "pong":
                        logger.info("✅ WebSocket ping/pong successful!")
                    else:
                        logger.info(f"⚠️  Unexpected response: {data}")
                
                await ws.close()
                
    except Exception as e:
        logger.error(f"❌ WebSocket connection error: {str(e)}")


async def test_full_flow():
    """Test the complete authentication flow"""
    logger.info("=" * 60)
    logger.info("🚀 Fynlo POS Authentication Flow Test")
    logger.info("=" * 60)
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"API URL: {API_URL}")
    logger.info(f"Supabase URL: {SUPABASE_URL}")
    logger.info(f"Test Email: {TEST_EMAIL}")
    
    # Step 1: Test Supabase authentication
    access_token = await test_supabase_direct()
    
    if not access_token:
        logger.error("\n❌ Authentication flow failed at Supabase login")
        logger.info("\nPossible issues:")
        logger.info("1. Invalid credentials")
        logger.info("2. User doesn't exist in Supabase")
        logger.info("3. Supabase service is down")
        logger.info("4. Network connectivity issues")
        return
    
    # Step 2: Test backend verification
    user_data = await test_backend_verify(access_token)
    
    if not user_data:
        logger.error("\n❌ Authentication flow failed at backend verification")
        logger.info("\nPossible issues:")
        logger.info("1. Backend is not running")
        logger.info("2. Supabase admin client not initialized")
        logger.info("3. User not created in backend database")
        logger.info("4. Backend configuration issues")
        return
    
    # Step 3: Test WebSocket connection
    user = user_data.get("user", {})
    user_id = user.get("id")
    restaurant_id = user.get("restaurant_id", "test-restaurant")
    
    if user_id and restaurant_id:
        await test_websocket_connection(access_token, user_id, restaurant_id)
    
    logger.info("\n✅ Authentication flow completed successfully!")
    logger.info("\nSummary:")
    logger.info(f"- User ID: {user_id}")
    logger.info(f"- Email: {user.get('email')}")
    logger.info(f"- Role: {user.get('role')}")
    logger.info(f"- Restaurant ID: {restaurant_id}")
    logger.info(f"- Subscription: {user.get('subscription_plan', 'N/A')}")


async def test_backend_health():
    """Test if backend is running"""
    logger.info("\n🔍 Testing Backend Health...")
    
    url = f"{API_URL}/health"
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url) as response:
                if response.status == 200:
                    logger.info("✅ Backend is healthy!")
                else:
                    logger.info(f"⚠️  Backend returned status: {response.status}")
                    
        except aiohttp.ClientConnectorError:
            logger.info("❌ Cannot connect to backend - is it running?")
            logger.info("   Run: cd backend && uvicorn app.main:app --reload")
            return False
        except Exception as e:
            logger.error(f"❌ Backend health check error: {str(e)}")
            return False
    
    return True


async def main():
    """Main test runner"""
    global TEST_EMAIL, TEST_PASSWORD
    
    # First check if backend is running
    if not await test_backend_health():
        logger.info("\n⚠️  Please start the backend first!")
        sys.exit(1)
    
    # Get test credentials from user
    logger.info("\n📝 Enter test credentials (or press Enter to use defaults)")
    email = input(f"Email [{TEST_EMAIL}]: ").strip() or TEST_EMAIL
    password = input(f"Password: ").strip() or TEST_PASSWORD
    
    # Update globals
    TEST_EMAIL = email
    TEST_PASSWORD = password
    
    # Run the full test flow
    await test_full_flow()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        logger.error(f"\n❌ Unexpected error: {str(e)}")
        import traceback
import logging

logger = logging.getLogger(__name__)

        traceback.print_exc()
