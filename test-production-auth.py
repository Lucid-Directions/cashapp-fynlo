#!/usr/bin/env python3
"""
Test the production authentication endpoint directly
"""

import requests
import json

# Test production endpoint
API_URL = "https://fynlopos-9eg2c.ondigitalocean.app"

# First, get a user token from Supabase
print("Getting user token from Supabase...")
auth_response = requests.post(
    "https://eweggzpvuqczrrrwszyy.supabase.co/auth/v1/token?grant_type=password",
    headers={
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZWdnenB2dXFjenJycndzenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODIyMTcsImV4cCI6MjA2NjM1ODIxN30.CRjEJ4w9xsIWB_PAMV_RfZox6yVMSnVT1b4QrA9SC0s'
    },
    json={
        'email': 'arnaud@luciddirections.co.uk',
        'password': 'Thursday_1'
    }
)

if auth_response.status_code != 200:
    print(f"Failed to get user token: {auth_response.status_code}")
    print(auth_response.text)
    exit(1)

token = auth_response.json()['access_token']
print(f"Got token: {token[:50]}...")

# Now test the production verify endpoint
print("\nTesting production /api/v1/auth/verify endpoint...")
verify_response = requests.post(
    f"{API_URL}/api/v1/auth/verify",
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
)

print(f"Status: {verify_response.status_code}")
print(f"Headers: {dict(verify_response.headers)}")

if verify_response.status_code == 200:
    print("✅ SUCCESS! User verified")
    data = verify_response.json()
    print(json.dumps(data, indent=2))
elif verify_response.status_code == 500:
    print("❌ 500 Internal Server Error")
    print("Response text:", verify_response.text)
    
    # Try to get more details
    print("\nTrying health endpoint...")
    health = requests.get(f"{API_URL}/health")
    print(f"Health status: {health.status_code}")
    if health.status_code == 200:
        print(health.json())
else:
    print(f"❌ Error: {verify_response.status_code}")
    print("Response:", verify_response.text)