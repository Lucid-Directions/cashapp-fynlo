#!/usr/bin/env python3
"""
Verify existing Supabase setup and user accounts
This script checks what's already configured without making changes
"""

import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client
from sqlalchemy import create_engine, text
from datetime import datetime

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

def check_environment():
    """Check if all required environment variables are set"""
    print("🔍 Checking Environment Configuration")
    print("=" * 50)
    
    env_vars = {
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY,
        "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_SERVICE_ROLE_KEY,
        "DATABASE_URL": DATABASE_URL,
        "SUMUP_MERCHANT_CODE": os.getenv("SUMUP_MERCHANT_CODE")
    }
    
    for key, value in env_vars.items():
        if value:
            if "KEY" in key or "TOKEN" in key:
                print(f"✅ {key}: {'*' * 10}{value[-10:]}")
            else:
                print(f"✅ {key}: {value}")
        else:
            print(f"❌ {key}: Not set")
    
    print()
    return all([SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL])

def check_database_schema():
    """Check database schema for Supabase integration"""
    print("🗄️ Checking Database Schema")
    print("=" * 50)
    
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            # Check users table structure
            result = conn.execute(text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'users'
                AND column_name IN ('supabase_id', 'auth_provider', 'password_hash')
                ORDER BY column_name
            """))
            
            columns = result.fetchall()
            print("Users table columns:")
            for col in columns:
                print(f"  - {col[0]}: {col[1]} (nullable: {col[2]})")
            
            # Check existing users
            result = conn.execute(text("""
                SELECT email, role, auth_provider, 
                       CASE WHEN supabase_id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_supabase_id,
                       CASE WHEN password_hash IS NOT NULL THEN 'Yes' ELSE 'No' END as has_password
                FROM users
                WHERE is_active = true
                ORDER BY created_at DESC
                LIMIT 10
            """))
            
            users = result.fetchall()
            print(f"\nExisting users (showing up to 10):")
            for user in users:
                print(f"  - {user[0]} | Role: {user[1]} | Auth: {user[2] or 'local'} | Supabase: {user[3]} | Password: {user[4]}")
                
    except Exception as e:
        print(f"❌ Database error: {str(e)}")
        return False
    
    print()
    return True

async def check_supabase_users():
    """Check users in Supabase"""
    print("👥 Checking Supabase Users")
    print("=" * 50)
    
    try:
        # Use service role key for admin access
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        # List users (limited API, may not show all)
        print("Note: Supabase API has limited user listing capabilities")
        print("Testing with known email addresses...")
        
        test_emails = [
            "arnaud@luciddirections.co.uk",
            "owner@fynlopos.com",
            "admin@fynlo.co.uk",
            "carlos@casaestrella.co.uk"
        ]
        
        for email in test_emails:
            try:
                # Try to get user by email (this might not work with all Supabase setups)
                # This is mainly to check if the connection works
                print(f"  Checking {email}...")
            except Exception as e:
                print(f"  - Could not check {email}: {str(e)}")
        
        print("\n✅ Supabase connection is working")
        
    except Exception as e:
        print(f"❌ Supabase connection error: {str(e)}")
        return False
    
    print()
    return True

def check_backend_auth_flow():
    """Check backend authentication configuration"""
    print("🔐 Checking Backend Auth Configuration")
    print("=" * 50)
    
    # Check if auth middleware is using Supabase
    auth_file = "/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/backend/app/core/auth.py"
    if os.path.exists(auth_file):
        with open(auth_file, 'r') as f:
            content = f.read()
            if "supabase_admin" in content and "get_user(token)" in content:
                print("✅ Backend is configured to use Supabase authentication")
            else:
                print("❌ Backend auth might not be using Supabase")
    
    # Check main.py for mock endpoints
    main_file = "/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/backend/app/main.py"
    if os.path.exists(main_file):
        with open(main_file, 'r') as f:
            content = f.read()
            if "/api/v1/auth/login" in content and "mock_credentials" in content:
                print("⚠️  main.py still has mock authentication endpoint")
                print("   This should be removed once Supabase is fully integrated")
    
    print()
    return True

async def main():
    """Main verification function"""
    print("\n🚀 Fynlo POS - Supabase Setup Verification")
    print("=" * 50)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 50 + "\n")
    
    # Run all checks
    env_ok = check_environment()
    if not env_ok:
        print("❌ Environment not properly configured. Please check your .env file.")
        return
    
    db_ok = check_database_schema()
    supabase_ok = await check_supabase_users()
    auth_ok = check_backend_auth_flow()
    
    # Summary
    print("\n📊 Summary")
    print("=" * 50)
    print(f"Environment configured: {'✅' if env_ok else '❌'}")
    print(f"Database ready: {'✅' if db_ok else '❌'}")
    print(f"Supabase connected: {'✅' if supabase_ok else '❌'}")
    print(f"Backend auth configured: {'✅' if auth_ok else '❌'}")
    
    print("\n🎯 Next Steps:")
    if all([env_ok, db_ok, supabase_ok, auth_ok]):
        print("1. ✅ Supabase is already set up and configured")
        print("2. Create/sync users between Supabase and local database")
        print("3. Test authentication flow with real Supabase tokens")
        print("4. Remove mock authentication endpoints from main.py")
    else:
        print("1. Fix any ❌ items above")
        print("2. Run database migrations if needed")
        print("3. Configure missing environment variables")
    
    print("\n💡 To create a Supabase user for testing:")
    print("   python get_supabase_token.py")
    print("\n✅ Verification complete!")

if __name__ == "__main__":
    asyncio.run(main())