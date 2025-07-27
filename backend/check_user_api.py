#!/usr/bin/env python3
"""
Check user status via API
"""

import requests
import json

# API endpoint
BASE_URL = "https://fynlopos-9eg2c.ondigitalocean.app"

# Your auth token (from the logs)
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsImtpZCI6IndRSS8zZXZZcGtjY3ZFV3oiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2V3ZWdnenB2dXFjenJycndzenl5LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0NTlkYTZiYy0zNDcyLTRkZTYtOGYwYy03OTMzNzNmMWE3YjAiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzUzNjQxNDI3LCJpYXQiOjE3NTM2Mzc4MjcsImVtYWlsIjoiYXJuYXVkQGx1Y2lkZGlyZWN0aW9ucy5jby51ayIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJhcm5hdWRAbHVjaWRkaXJlY3Rpb25zLmNvLnVrIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZlYXR1cmVzIjpbIkV2ZXJ5dGhpbmcgaW4gQmV0YSBQTFVTIiwiVW5saW1pdGVkIHN0YWZmIGFjY291bnRzIiwiVW5saW1pdGVkIGxvY2F0aW9ucyIsIldoaXRlLWxhYmVsIG9wdGlvbnMiLCJBZHZhbmNlZCBhbmFseXRpY3MgXHUwMDI2IGZvcmVjYXN0aW5nIiwiQ3VzdG9tIGludGVncmF0aW9ucyIsIlByaW9yaXR5IHN1cHBvcnQiLCJBUEkgYWNjZXNzIiwiTXVsdGktcmVzdGF1cmFudCBtYW5hZ2VtZW50IiwiRW50ZXJwcmlzZSBmZWF0dXJlcyJdLCJmdWxsX25hbWUiOiJ0ZXN0IHJlc3RhdXJhbnQgc2lkZSIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiNDU5ZGE2YmMtMzQ3Mi00ZGU2LThmMGMtNzkzMzczZjFhN2IwIiwic3Vic2NyaXB0aW9uX3BsYW4iOiJvbWVnYSIsInN1YnNjcmlwdGlvbl9zdGF0dXMiOiJhY3RpdmUiLCJzdWJzY3JpcHRpb25fdGllciI6Im9tZWdhIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NTM2Mzc4Mjd9XSwic2Vzc2lvbl9pZCI6ImIxYTI1NWQzLTFhZmQtNGFhNy04YWI0LTJjNTY5OGUyOTEyMiIsImlzX2Fub255bW91cyI6ZmFsc2V9.g6TgutUHkr46prsCETdf3hd5aueUX7O-6Qn2l1EFPtQ"

def check_user_status():
    """Check current user status"""
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Get current user info
    print("🔍 Checking current user...")
    response = requests.get(f"{BASE_URL}/api/v1/users/me", headers=headers)
    
    if response.status_code == 200:
        user_data = response.json()
        print(f"✅ User data:")
        print(json.dumps(user_data, indent=2))
    else:
        print(f"❌ Error getting user data: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    check_user_status()