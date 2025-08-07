#!/usr/bin/env python3
"""
Test which environment variable is being used and validate the token
"""

import requests
import base64
import json

# The correct service role key you just confirmed
CORRECT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZWdnenB2dXFjenJycndzenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDc4MjIxNywiZXhwIjoyMDY2MzU4MjE3fQ.3MZGwVJXzzeI4pRgN2amPnBrL6LuAKJLiAPmUBucFZE"

# Decode the JWT payload (middle part)
def decode_jwt_payload(token):
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        # Add padding if needed
        payload = parts[1]
        padding = 4 - (len(payload) % 4)
        if padding != 4:
            payload += '=' * padding
        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except:
        return None

print("Analyzing the correct service role key...")
print("=" * 60)

payload = decode_jwt_payload(CORRECT_KEY)
if payload:
    print("JWT Payload:")
    print(json.dumps(payload, indent=2))
    print("\nKey details:")
    print(f"  - Issuer: {payload.get('iss')}")
    print(f"  - Project Ref: {payload.get('ref')}")
    print(f"  - Role: {payload.get('role')}")
    print(f"  - Issued At: {payload.get('iat')}")
    print(f"  - Expires: {payload.get('exp')}")

print("\n" + "=" * 60)
print("Testing with Supabase API...")

# Test if this key works with Supabase
response = requests.get(
    "https://eweggzpvuqczrrrwszyy.supabase.co/rest/v1/",
    headers={
        'apikey': CORRECT_KEY,
        'Authorization': f'Bearer {CORRECT_KEY}'
    }
)

print(f"Supabase API Response: {response.status_code}")
if response.status_code == 200:
    print("✅ Service role key is valid and working!")
else:
    print(f"❌ Service role key test failed: {response.text}")

print("\n" + "=" * 60)
print("Testing key with user token verification...")

# Get a user token first
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

if auth_response.status_code == 200:
    user_token = auth_response.json()['access_token']
    print(f"Got user token: {user_token[:50]}...")
    
    # Now verify the user with the service role key
    verify_response = requests.get(
        f"https://eweggzpvuqczrrrwszyy.supabase.co/auth/v1/user",
        headers={
            'apikey': CORRECT_KEY,
            'Authorization': f'Bearer {user_token}'
        }
    )
    
    print(f"\nUser verification response: {verify_response.status_code}")
    if verify_response.status_code == 200:
        user_data = verify_response.json()
        print("✅ Successfully verified user with service role key!")
        print(f"User: {user_data.get('email')}")
        print(f"ID: {user_data.get('id')}")
    else:
        print(f"❌ Failed to verify user: {verify_response.text}")