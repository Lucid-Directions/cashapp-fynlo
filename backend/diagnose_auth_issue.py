#!/usr/bin/env python3
"""
Diagnose authentication issues with Supabase and backend integration
"""

import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client
from sqlalchemy import create_engine, text
import requests

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
BACKEND_URL = "https://fynlopos-9eg2c.ondigitalocean.app"

def check_backend_health():
    """Check if backend is responding"""
    print("\n1. Checking Backend Health...")
    print("=" * 50)
    
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.ok:
            print(f"✅ Backend is healthy: {response.json()}")
            return True
        else:
            print(f"❌ Backend returned error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend connection failed: {str(e)}")
        return False

def check_auth_endpoint():
    """Check if auth/verify endpoint is accessible"""
    print("\n2. Checking Auth Endpoint...")
    print("=" * 50)
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/v1/auth/verify",
            json={},
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        print(f"Response status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        return True
    except Exception as e:
        print(f"❌ Auth endpoint error: {str(e)}")
        return False

def check_database_users():
    """Check users in database"""
    print("\n3. Checking Database Users...")
    print("=" * 50)
    
    if not DATABASE_URL:
        print("❌ DATABASE_URL not configured")
        return False
    
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            # Check if users table exists
            result = conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_name = 'users'
            """))
            if result.scalar() == 0:
                print("❌ Users table doesn't exist")
                return False
            
            # Check users with Supabase IDs
            result = conn.execute(text("""
                SELECT email, supabase_id, auth_provider, role, is_active
                FROM users
                WHERE email = 'arnaud@luciddirections.co.uk'
                OR supabase_id IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 5
            """))
            
            users = result.fetchall()
            if users:
                print("Users in database:")
                for user in users:
                    print(f"  - {user[0]} | Supabase ID: {user[1]} | Auth: {user[2]} | Role: {user[3]} | Active: {user[4]}")
            else:
                print("❌ No users found with Supabase IDs")
                
            # Check for arnaud specifically
            result = conn.execute(text("""
                SELECT * FROM users WHERE email = 'arnaud@luciddirections.co.uk'
            """))
            arnaud = result.fetchone()
            if arnaud:
                print(f"\n✅ Found arnaud@luciddirections.co.uk in database")
                print(f"   Supabase ID: {arnaud['supabase_id'] if 'supabase_id' in result.keys() else 'N/A'}")
            else:
                print("\n❌ arnaud@luciddirections.co.uk not found in database")
                
        return True
    except Exception as e:
        print(f"❌ Database error: {str(e)}")
        return False

async def check_supabase_users():
    """Check Supabase users"""
    print("\n4. Checking Supabase Users...")
    print("=" * 50)
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Supabase configuration missing")
        print(f"   SUPABASE_URL: {'Set' if SUPABASE_URL else 'Missing'}")
        print(f"   SUPABASE_SERVICE_ROLE_KEY: {'Set' if SUPABASE_SERVICE_ROLE_KEY else 'Missing'}")
        return False
    
    try:
        # Use service role key to list users
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
        }
        
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers=headers,
            timeout=5
        )
        
        if response.ok:
            users = response.json()
            print(f"Found {len(users.get('users', []))} users in Supabase")
            
            # Look for arnaud
            for user in users.get('users', []):
                if user['email'] == 'arnaud@luciddirections.co.uk':
                    print(f"\n✅ Found arnaud@luciddirections.co.uk in Supabase")
                    print(f"   ID: {user['id']}")
                    print(f"   Created: {user['created_at']}")
                    print(f"   Confirmed: {user.get('email_confirmed_at') is not None}")
                    return user['id']
        else:
            print(f"❌ Failed to list Supabase users: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            
    except Exception as e:
        print(f"❌ Supabase error: {str(e)}")
        
    return None

def check_environment_variables():
    """Check all required environment variables"""
    print("\n5. Checking Environment Variables...")
    print("=" * 50)
    
    required_vars = [
        "DATABASE_URL",
        "REDIS_URL",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUMUP_API_KEY",
        "SUMUP_MERCHANT_CODE"
    ]
    
    missing = []
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # Mask sensitive values
            if "KEY" in var or "URL" in var:
                masked = value[:10] + "..." if len(value) > 10 else "***"
                print(f"✅ {var}: {masked}")
            else:
                print(f"✅ {var}: Set")
        else:
            print(f"❌ {var}: Missing")
            missing.append(var)
    
    return len(missing) == 0

async def main():
    """Run all diagnostics"""
    print("🔍 Fynlo POS Authentication Diagnostics")
    print("=" * 50)
    
    # Run checks
    backend_ok = check_backend_health()
    auth_ok = check_auth_endpoint()
    db_ok = check_database_users()
    supabase_id = await check_supabase_users()
    env_ok = check_environment_variables()
    
    # Summary
    print("\n📊 SUMMARY")
    print("=" * 50)
    print(f"Backend Health: {'✅' if backend_ok else '❌'}")
    print(f"Auth Endpoint: {'✅' if auth_ok else '❌'}")
    print(f"Database Users: {'✅' if db_ok else '❌'}")
    print(f"Supabase Users: {'✅' if supabase_id else '❌'}")
    print(f"Environment Vars: {'✅' if env_ok else '❌'}")
    
    # Recommendations
    print("\n💡 RECOMMENDATIONS")
    print("=" * 50)
    
    if not env_ok:
        print("1. Set missing environment variables in DigitalOcean dashboard")
        
    if supabase_id and db_ok:
        print(f"2. Link Supabase user to database:")
        print(f"   UPDATE users SET supabase_id = '{supabase_id}'")
        print(f"   WHERE email = 'arnaud@luciddirections.co.uk';")
        
    if not backend_ok:
        print("3. Check DigitalOcean deployment logs - backend may be down")
        
    print("\n🔧 Quick Fix Commands:")
    print("1. Test with curl:")
    print(f"   curl {BACKEND_URL}/health")
    print("2. Check logs in DigitalOcean Activity tab")
    print("3. Redeploy if needed")

if __name__ == "__main__":
    asyncio.run(main())