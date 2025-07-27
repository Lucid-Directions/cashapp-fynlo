#!/usr/bin/env python3
"""
Test script to debug authentication flow issues
This tests the Supabase integration and auth verification endpoint
"""

import os
import sys
import asyncio
import httpx
from dotenv import load_dotenv
from datetime import datetime

# Add backend to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Test configuration
PRODUCTION_API_URL = "https://fynlopos-9eg2c.ondigitalocean.app"
LOCAL_API_URL = "http://localhost:8000"

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def print_header(text):
    """Print a colored header"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}{text}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")


def print_success(text):
    """Print success message"""
    print(f"{GREEN}✅ {text}{RESET}")


def print_error(text):
    """Print error message"""
    print(f"{RED}❌ {text}{RESET}")


def print_warning(text):
    """Print warning message"""
    print(f"{YELLOW}⚠️  {text}{RESET}")


def print_info(text):
    """Print info message"""
    print(f"{BLUE}ℹ️  {text}{RESET}")


async def test_backend_health(api_url):
    """Test if the backend is healthy"""
    print_header(f"Testing Backend Health: {api_url}")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{api_url}/health", timeout=10.0)
            if response.status_code == 200:
                print_success(f"Backend is healthy: {response.json()}")
                return True
            else:
                print_error(f"Backend health check failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Failed to connect to backend: {e}")
            return False


async def test_supabase_locally():
    """Test Supabase configuration locally"""
    print_header("Testing Local Supabase Configuration")
    
    try:
        from supabase import create_client
        
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url:
            print_error("SUPABASE_URL not found in environment")
            return False
        if not key:
            print_error("SUPABASE_SERVICE_ROLE_KEY not found in environment")
            return False
            
        print_info(f"SUPABASE_URL: {url[:30]}...")
        print_info("SUPABASE_SERVICE_ROLE_KEY: Found")
        
        # Try to create client
        client = create_client(url, key)
        print_success("Supabase client created successfully")
        
        # Test with a dummy token to see error format
        try:
            result = client.auth.get_user("invalid_token")
            print_warning(f"Unexpected success with invalid token: {result}")
        except Exception as e:
            print_info(f"Expected error with invalid token: {type(e).__name__}: {str(e)}")
            
        return True
        
    except Exception as e:
        print_error(f"Failed to test Supabase locally: {e}")
        return False


async def test_auth_verify(api_url, token):
    """Test the auth verify endpoint"""
    print_header(f"Testing Auth Verify Endpoint: {api_url}")
    
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            print_info("Sending verification request...")
            response = await client.post(
                f"{api_url}/api/v1/auth/verify",
                headers=headers,
                timeout=30.0
            )
            
            print_info(f"Response status: {response.status_code}")
            print_info(f"Response headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                data = response.json()
                print_success("Verification successful!")
                print_info(f"User data: {data}")
                return True
            else:
                print_error(f"Verification failed: {response.status_code}")
                print_error(f"Response: {response.text}")
                
                # Try to parse error details
                try:
                    error_data = response.json()
                    if "detail" in error_data:
                        print_error(f"Error detail: {error_data['detail']}")
                except:
                    pass
                    
                return False
                
        except httpx.TimeoutError:
            print_error("Request timed out after 30 seconds")
            return False
        except Exception as e:
            print_error(f"Request failed: {type(e).__name__}: {e}")
            return False


async def main():
    """Run all tests"""
    print_header("Fynlo Authentication Debug Tool")
    print_info(f"Timestamp: {datetime.now().isoformat()}")
    
    # Test 1: Check backend health
    production_healthy = await test_backend_health(PRODUCTION_API_URL)
    
    # Test 2: Check local Supabase configuration
    await test_supabase_locally()
    
    # Test 3: Get token from user
    print_header("Authentication Test")
    print_warning("To test authentication, you need a valid Supabase JWT token")
    print_info("You can get this from:")
    print_info("1. The iOS app after successful login (check console logs)")
    print_info("2. Supabase dashboard after signing in")
    print_info("3. Using the Supabase JS client")
    
    token = input("\nEnter your Supabase JWT token (or 'skip' to skip): ").strip()
    
    if token and token.lower() != 'skip':
        # Test against production
        if production_healthy:
            await test_auth_verify(PRODUCTION_API_URL, token)
        
        # Ask if they want to test locally
        test_local = input("\nTest against local backend? (y/n): ").strip().lower()
        if test_local == 'y':
            local_healthy = await test_backend_health(LOCAL_API_URL)
            if local_healthy:
                await test_auth_verify(LOCAL_API_URL, token)
    
    print_header("Test Complete")
    print_info("Check the output above for any issues")
    print_info("Common issues:")
    print_info("- Missing environment variables")
    print_info("- Invalid or expired tokens")
    print_info("- Backend configuration issues")
    print_info("- Network connectivity problems")


if __name__ == "__main__":
    asyncio.run(main())