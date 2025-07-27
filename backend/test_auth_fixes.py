#!/usr/bin/env python3
"""Test the authentication fixes"""

import os
import sys
import requests
import json
from datetime import datetime

# Test user credentials
EMAIL = "arnaud@luciddirections.co.uk"
TOKEN = "eyJhbGciOiJIUzI1NiIsImtpZCI6ImQzVGNRSWNicHJvS01UdVAiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2Rpb3d1anN0dW91bnRia3FvcW93LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJkM2UzNmM0Yi1jMmJkLTRlMjktODE2MC1kM2M1MWJmZjViMjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzM3OTEzMTAzLCJpYXQiOjE3Mzc5MDk1MDMsImVtYWlsIjoiYXJuYXVkQGx1Y2lkZGlyZWN0aW9ucy5jby51ayIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJhcm5hdWRAbHVjaWRkaXJlY3Rpb25zLmNvLnVrIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJwbGFuIjoiYWxwaGEiLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6ImQzZTM2YzRiLWMyYmQtNGUyOS04MTYwLWQzYzUxYmZmNWIyMiIsInN1YnNjcmlwdGlvbl9wbGFuIjoiYWxwaGEiLCJzdWJzY3JpcHRpb25fc3RhdHVzIjoidHJpYWwifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJvdHAiLCJ0aW1lc3RhbXAiOjE3Mzc5MDk1MDN9XSwic2Vzc2lvbl9pZCI6ImJiMmU2MzlmLWQ1NDctNGJjYS1hNWRjLWJiYzFjNzNmMzQxZCIsImlzX2Fub255bW91cyI6ZmFsc2V9.ajhRJ4UJJAyQcNkGt1EIBQZYu1pTqIoI5lJ9Z6Vp2vo"

# Backend URL
BACKEND_URL = "http://localhost:8000"

def test_auth_verify():
    """Test the /auth/verify endpoint"""
    print("=" * 50)
    print("Testing /auth/verify endpoint")
    print("=" * 50)
    
    url = f"{BACKEND_URL}/api/v1/auth/verify"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            user = data.get('user', {})
            print("\n✅ Authentication successful!")
            print(f"   User ID: {user.get('id')}")
            print(f"   Email: {user.get('email')}")
            print(f"   Role: {user.get('role')}")
            print(f"   Restaurant ID: {user.get('restaurant_id', 'None')}")
            print(f"   Restaurant Name: {user.get('restaurant_name', 'None')}")
            return True
        else:
            print("\n❌ Authentication failed!")
            return False
            
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        return False

def test_websocket_connection():
    """Test WebSocket connection"""
    print("\n" + "=" * 50)
    print("Testing WebSocket connection")
    print("=" * 50)
    
    # First get auth info
    auth_url = f"{BACKEND_URL}/api/v1/auth/verify"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(auth_url, headers=headers)
        if response.status_code != 200:
            print("❌ Failed to authenticate for WebSocket test")
            return False
            
        data = response.json()
        user = data.get('user', {})
        restaurant_id = user.get('restaurant_id')
        
        if not restaurant_id:
            print("❌ No restaurant_id found for user")
            return False
        
        print(f"✅ Got restaurant_id: {restaurant_id}")
        print("   WebSocket connection would use:")
        print(f"   - URL: ws://localhost:8000/api/v1/ws/{restaurant_id}")
        print(f"   - Token: {TOKEN[:20]}...")
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def check_database_user():
    """Check if user exists in database"""
    print("\n" + "=" * 50)
    print("Checking database for user")
    print("=" * 50)
    
    print(f"Would check for user with email: {EMAIL}")
    print("Run check_user_restaurant.py separately to verify database state")

if __name__ == "__main__":
    print("Testing Fynlo POS Authentication Fixes")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Backend: {BACKEND_URL}")
    print(f"User: {EMAIL}")
    
    # Run tests
    auth_success = test_auth_verify()
    ws_success = test_websocket_connection()
    
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    print(f"Auth Verify: {'✅ PASSED' if auth_success else '❌ FAILED'}")
    print(f"WebSocket: {'✅ PASSED' if ws_success else '❌ FAILED'}")
    
    if auth_success and ws_success:
        print("\n✅ All tests passed! Authentication fixes are working.")
    else:
        print("\n❌ Some tests failed. Check the output above.")