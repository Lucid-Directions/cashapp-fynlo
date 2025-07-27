#!/usr/bin/env python3
import asyncio
import os
import sys
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)

# Load environment variables
load_dotenv()

# Add project to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.api.v1.endpoints.auth import verify_supabase_user
from fastapi import Header
from supabase import create_client

# Test the verify endpoint directly
async def test_verify():
    print("🔍 Testing backend auth verification...")
    
    # Create a fake token for testing
    fake_token = "Bearer test_token_12345"
    
    # Get a database session
    db = SessionLocal()
    
    try:
        # Call the verify function directly
        result = await verify_supabase_user(
            authorization=fake_token,
            db=db
        )
        print(f"✅ Success: {result}")
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

# Test with real Supabase token
async def test_with_real_token():
    print("\n🔍 Testing with real Supabase authentication...")
    
    # Create Supabase client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")  # Use anon key for client-side auth
    
    client = create_client(url, key)
    
    # Sign in to get a real token
    email = "arnaud@luciddirections.co.uk"
    password = "test123"  # Replace with actual password
    
    try:
        response = client.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
        if response.session:
            print(f"✅ Got token: {response.session.access_token[:20]}...")
            
            # Test the backend verify endpoint with real token
            db = SessionLocal()
            try:
                result = await verify_supabase_user(
                    authorization=f"Bearer {response.session.access_token}",
                    db=db
                )
                print(f"✅ Backend verification success: {result}")
            except Exception as e:
                print(f"❌ Backend verification error: {type(e).__name__}: {str(e)}")
                import traceback
                traceback.print_exc()
            finally:
                db.close()
                
    except Exception as e:
        print(f"❌ Supabase auth error: {type(e).__name__}: {str(e)}")

# Run tests
if __name__ == "__main__":
    asyncio.run(test_verify())
    # asyncio.run(test_with_real_token())  # Uncomment with real password