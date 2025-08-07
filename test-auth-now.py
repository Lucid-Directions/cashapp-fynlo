#!/usr/bin/env python3
"""Quick test to see if auth is working now"""

import requests
import json

# Get Supabase token
print("Getting token...")
response = requests.post(
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

token = response.json()['access_token']
print(f"Token: {token[:50]}...")

# Test backend
print("\nTesting backend...")
backend = requests.post(
    "https://fynlopos-9eg2c.ondigitalocean.app/api/v1/auth/verify",
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
)

print(f"Status: {backend.status_code}")
if backend.status_code == 200:
    data = backend.json()
    print("✅ SUCCESS! User verified:")
    print(json.dumps(data, indent=2))
else:
    print(f"❌ Failed: {backend.text}")