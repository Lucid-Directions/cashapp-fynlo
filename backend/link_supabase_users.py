#!/usr/bin/env python3
"""
Link existing Supabase users to database records
"""

import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client
from sqlalchemy import create_engine, text
from datetime import datetime

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

async def test_supabase_user(email: str, password: str):
    """Test if we can sign in a user with Supabase"""
    print(f"\n🔍 Testing Supabase authentication for {email}...")
    
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    try:
        # Try to sign in
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
        if response.user:
            print(f"✅ Successfully authenticated with Supabase")
            print(f"   Supabase ID: {response.user.id}")
            return response.user.id
        else:
            print(f"❌ Authentication failed")
            return None
            
    except Exception as e:
        error_msg = str(e)
        if "Invalid login credentials" in error_msg:
            print(f"❌ Invalid credentials")
        elif "User not found" in error_msg:
            print(f"❌ User doesn't exist in Supabase")
        else:
            print(f"❌ Error: {error_msg}")
        return None

def link_user_to_supabase(email: str, supabase_id: str):
    """Link a database user to their Supabase ID"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # Update the user record
            result = conn.execute(
                text("""
                    UPDATE users 
                    SET supabase_id = :supabase_id,
                        auth_provider = 'supabase',
                        updated_at = NOW()
                    WHERE email = :email
                    AND supabase_id IS NULL
                """),
                {"email": email, "supabase_id": supabase_id}
            )
            
            if result.rowcount > 0:
                trans.commit()
                print(f"✅ Linked {email} to Supabase ID {supabase_id}")
                return True
            else:
                trans.rollback()
                print(f"⚠️  User {email} already has a Supabase ID or doesn't exist")
                return False
                
        except Exception as e:
            trans.rollback()
            print(f"❌ Error linking user: {str(e)}")
            return False

def create_or_update_user(email: str, supabase_id: str, role: str = "restaurant_owner"):
    """Create a new user or update existing one with Supabase ID"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # First try to update existing user
            result = conn.execute(
                text("""
                    UPDATE users 
                    SET supabase_id = :supabase_id,
                        auth_provider = 'supabase',
                        updated_at = NOW()
                    WHERE email = :email
                """),
                {"email": email, "supabase_id": supabase_id}
            )
            
            if result.rowcount > 0:
                trans.commit()
                print(f"✅ Updated existing user {email} with Supabase ID")
                return True
            
            # If no existing user, create one
            # Extract name from email
            username = email.split('@')[0]
            first_name = username.split('.')[0].title() if '.' in username else username.title()
            last_name = username.split('.')[1].title() if '.' in username else 'User'
            
            conn.execute(
                text("""
                    INSERT INTO users (
                        email, supabase_id, auth_provider, 
                        first_name, last_name, role,
                        is_active, created_at, updated_at
                    ) VALUES (
                        :email, :supabase_id, 'supabase',
                        :first_name, :last_name, :role,
                        true, NOW(), NOW()
                    )
                """),
                {
                    "email": email,
                    "supabase_id": supabase_id,
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": role
                }
            )
            
            trans.commit()
            print(f"✅ Created new user {email} with Supabase ID")
            return True
            
        except Exception as e:
            trans.rollback()
            print(f"❌ Error creating/updating user: {str(e)}")
            return False

async def main():
    """Main function"""
    print("🔗 Fynlo POS - Link Supabase Users")
    print("=" * 50)
    print("This tool will help link your Supabase users to the database\n")
    
    # Common test accounts
    test_accounts = [
        ("arnaud@luciddirections.co.uk", "test123", "restaurant_owner"),
        ("admin@fynlo.co.uk", None, "platform_owner"),
        ("owner@fynlopos.com", "platformowner123", "platform_owner"),
    ]
    
    print("Testing known accounts...")
    
    for email, password, role in test_accounts:
        if password:
            # Test authentication
            supabase_id = await test_supabase_user(email, password)
            if supabase_id:
                # Link or create user
                create_or_update_user(email, supabase_id, role)
        else:
            print(f"\n⚠️  Skipping {email} - no test password provided")
    
    # Show current status
    print("\n📊 Current User Status:")
    print("=" * 50)
    
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT 
                email, 
                role,
                CASE WHEN supabase_id IS NOT NULL THEN 'Linked' ELSE 'Not Linked' END as status,
                auth_provider
            FROM users
            WHERE is_active = true
            ORDER BY 
                CASE WHEN supabase_id IS NOT NULL THEN 0 ELSE 1 END,
                created_at DESC
        """))
        
        users = result.fetchall()
        for user in users:
            status_icon = "✅" if user[2] == "Linked" else "❌"
            print(f"{status_icon} {user[0]} | Role: {user[1]} | Status: {user[2]} | Auth: {user[3]}")
    
    print("\n💡 To manually link a user:")
    print("1. Get their Supabase ID using: python get_supabase_token.py")
    print("2. Update the database:")
    print("   UPDATE users SET supabase_id = 'their-supabase-id' WHERE email = 'their-email';")

if __name__ == "__main__":
    asyncio.run(main())