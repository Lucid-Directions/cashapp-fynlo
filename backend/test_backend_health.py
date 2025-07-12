#!/usr/bin/env python3
"""Test backend health and basic endpoints"""

import requests
import json
import time

# Base URL - change this for production
BASE_URL = "http://localhost:8000"
# BASE_URL = "https://fynlopos-9eg2c.ondigitalocean.app"

def test_health():
    """Test health endpoint"""
    print("Testing /health endpoint...")
    start = time.time()
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        elapsed = time.time() - start
        print(f"✅ Health check responded in {elapsed:.2f}s")
        print(f"Response: {response.json()}")
        return True
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_auth():
    """Test authentication endpoint"""
    print("\nTesting /api/v1/auth/login endpoint...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={
                "email": "arnaud@luciddirections.co.uk",
                "password": "test123"
            },
            timeout=10
        )
        if response.status_code == 200:
            print("✅ Authentication successful")
            data = response.json()
            if "data" in data and "access_token" in data["data"]:
                print(f"Token: {data['data']['access_token'][:20]}...")
                return data['data']['access_token']
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Authentication error: {e}")
    return None

def test_menu(token=None):
    """Test menu endpoints"""
    print("\nTesting /api/v1/menu/items endpoint...")
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/v1/menu/items",
            headers=headers,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if "data" in data:
                print(f"✅ Menu items retrieved: {len(data['data'])} items")
                print(f"First item: {data['data'][0]['name'] if data['data'] else 'No items'}")
            else:
                print("✅ Menu endpoint responded but no data")
        else:
            print(f"❌ Menu request failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Menu error: {e}")

def test_orders(token=None):
    """Test orders endpoint"""
    print("\nTesting /api/v1/orders endpoint...")
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/v1/orders",
            headers=headers,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if "data" in data:
                print(f"✅ Orders retrieved: {len(data['data'])} orders")
            else:
                print("✅ Orders endpoint responded but no data")
        else:
            print(f"❌ Orders request failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Orders error: {e}")

if __name__ == "__main__":
    print(f"🧪 Testing backend at {BASE_URL}")
    print("=" * 50)
    
    # Test health check
    if test_health():
        # Test authentication
        token = test_auth()
        
        # Test other endpoints
        test_menu(token)
        test_orders(token)
    
    print("\n✅ Backend testing complete!")