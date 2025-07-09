#!/usr/bin/env python3
"""
Quick test script to verify your admin login works correctly.
This will test the entire authentication flow and role assignment.
"""

import requests
import json
from typing import Optional
import sys

# Configuration
SUPABASE_URL = "https://eweggzpvuqczrrrwszyy.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZWdnenB2dXFjenJycndzenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODIyMTcsImV4cCI6MjA2NjM1ODIxN30.CRjEJ4w9xsIWB_PAMV_RfZox6yVMSnVT1b4QrA9SC0s"

# Backend URLs to test
BACKEND_URLS = [
    "https://api.fynlo.co.uk",
    "https://fynlopos-9eg2c.ondigitalocean.app",
    "http://localhost:8000"
]

def test_supabase_login(email: str, password: str) -> Optional[str]:
    """Test logging in to Supabase"""
    print(f"\n1️⃣  Testing Supabase login for {email}...")
    
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "email": email,
        "password": password
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            result = response.json()
            print("✅ Supabase login successful!")
            print(f"   Access token: {result['access_token'][:50]}...")
            return result['access_token']
        else:
            print(f"❌ Supabase login failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return None

def test_backend_verify(token: str) -> dict:
    """Test backend verification endpoint"""
    print("\n2️⃣  Testing backend verification...")
    
    for backend_url in BACKEND_URLS:
        print(f"\n   Trying {backend_url}...")
        
        try:
            # First test if backend is reachable
            health_response = requests.get(f"{backend_url}/health", timeout=5)
            if health_response.status_code != 200:
                print(f"   ⚠️  Backend not healthy")
                continue
                
            # Test verify endpoint
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.post(
                f"{backend_url}/api/v1/auth/verify",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Backend verification successful!")
                return result
            else:
                print(f"   ❌ Verification failed: {response.status_code}")
                print(f"   Response: {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"   ⚠️  Connection failed: {type(e).__name__}")
            continue
    
    return None

def display_results(user_data: dict):
    """Display the verification results"""
    print("\n3️⃣  Your User Profile:")
    print("=" * 50)
    
    user = user_data.get('user', {})
    
    print(f"📧 Email: {user.get('email')}")
    print(f"👤 Name: {user.get('full_name', 'Not set')}")
    print(f"🎭 Role: {user.get('role')} {'👑' if user.get('role') == 'platform_owner' else ''}")
    print(f"🏢 Restaurant: {user.get('restaurant_name', 'None (Platform level)')}")
    print(f"📅 Joined: {user.get('created_at', 'Unknown')}")
    
    # Check platform owner status
    if user.get('role') == 'platform_owner':
        print("\n✅ SUCCESS! You are configured as the PLATFORM OWNER!")
        print("   You have full access to:")
        print("   • Platform dashboard")
        print("   • All restaurants")
        print("   • Platform settings")
        print("   • User management")
    else:
        print(f"\n⚠️  WARNING: Your role is '{user.get('role')}', not 'platform_owner'")
        print("   Check that your backend .env has:")
        print(f"   PLATFORM_OWNER_EMAIL=sleepyarno@gmail.com")

def main():
    """Run the admin login test"""
    print("🔐 Fynlo POS Admin Login Test")
    print("=" * 50)
    
    # Get credentials
    print("\nThis will test your admin login with Supabase and backend.")
    print("Using email: sleepyarno@gmail.com")
    
    password = input("Enter your Supabase password: ")
    
    if not password:
        print("❌ Password is required")
        return
    
    # Test Supabase login
    token = test_supabase_login("sleepyarno@gmail.com", password)
    if not token:
        print("\n❌ Failed to login to Supabase. Please check:")
        print("   1. Your password is correct")
        print("   2. User exists in Supabase Dashboard")
        return
    
    # Test backend verification
    result = test_backend_verify(token)
    if not result:
        print("\n❌ Failed to verify with backend. Please check:")
        print("   1. Backend is running and accessible")
        print("   2. Backend has Supabase credentials configured")
        print("   3. PLATFORM_OWNER_EMAIL is set to sleepyarno@gmail.com")
        return
    
    # Display results
    display_results(result)
    
    print("\n" + "=" * 50)
    print("Test complete! You can now use these credentials in the mobile app.")

if __name__ == "__main__":
    main()