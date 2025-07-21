#!/usr/bin/env python3
"""
Check Supabase User Diagnostic Tool

Usage:
    python check_supabase_user.py <identifier>
    
Arguments:
    identifier    Supabase ID (UUID) or email address

Examples:
    python check_supabase_user.py d2b96734-18db-43f8-a30e-bf936c7b8bc8
    python check_supabase_user.py user@example.com
"""

import os
import sys
import argparse
import re
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in environment variables")
    sys.exit(1)

# Parse command line arguments
parser = argparse.ArgumentParser(description='Check user by Supabase ID or email')
parser.add_argument('identifier', help='Supabase ID (UUID) or email address')
args = parser.parse_args()

# Determine if identifier is UUID or email
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
is_uuid = bool(UUID_PATTERN.match(args.identifier))

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # Check if user exists by Supabase ID or email
        if is_uuid:
            print(f"\n🔍 Looking up user by Supabase ID: {args.identifier}\n")
            result = conn.execute(text("""
                SELECT 
                    u.id,
                    u.email,
                    u.role,
                    u.restaurant_id,
                    u.is_active,
                    u.supabase_id,
                    u.first_name,
                    u.last_name,
                    r.name as restaurant_name,
                    r.subscription_plan,
                    r.subscription_status
                FROM users u
                LEFT JOIN restaurants r ON u.restaurant_id = r.id
                WHERE u.supabase_id = :identifier
            """), {"identifier": args.identifier})
        else:
            print(f"\n🔍 Looking up user by email: {args.identifier}\n")
            result = conn.execute(text("""
                SELECT 
                    u.id,
                    u.email,
                    u.role,
                    u.restaurant_id,
                    u.is_active,
                    u.supabase_id,
                    u.first_name,
                    u.last_name,
                    r.name as restaurant_name,
                    r.subscription_plan,
                    r.subscription_status
                FROM users u
                LEFT JOIN restaurants r ON u.restaurant_id = r.id
                WHERE u.email = :identifier
            """), {"identifier": args.identifier})
        
        user = result.fetchone()
        if user:
            print(f"User found by Supabase ID:")
            print(f"  ID: {user[0]}")
            print(f"  Email: {user[1]}")
            print(f"  Role: {user[2]}")
            print(f"  Restaurant ID: {user[3]}")
            print(f"  Is Active: {user[4]}")
            print(f"  Supabase ID: {user[5]}")
            print(f"  Name: {user[6]} {user[7]}")
            print(f"  Restaurant Name: {user[8] if user[8] else 'None'}")
            if user[8]:
                print(f"  Subscription Plan: {user[9] if user[9] else 'None'}")
                print(f"  Subscription Status: {user[10] if user[10] else 'None'}")
            
            if not user[3]:
                print("\n⚠️  User has no restaurant_id assigned!")
                
                # Check if we should create a restaurant
                if user[2] == 'restaurant_owner':
                    print("\n🔧 This user is a restaurant_owner but has no restaurant. A default restaurant should have been created.")
                elif user[2] == 'platform_owner':
                    print("\n✓ This is a platform owner - they don't need a specific restaurant_id")
                    print("   Platform owners can access all restaurants")
                else:
                    print(f"\n❌ This user has role '{user[2]}' which requires a restaurant_id to access WebSocket")
        else:
            print(f"❌ User not found: {args.identifier}")
            print("\nPossible reasons:")
            print("1. User hasn't logged in yet (not created during authentication)")
            print("2. Wrong Supabase ID or email")
            print("3. User exists in Supabase but not in local database")
            
            # Try to check Supabase directly if email provided
            if not is_uuid:
                print("\n🔍 Checking Supabase directly...")
                try:
                    from app.core.supabase import supabase_admin
                    if supabase_admin:
                        users = supabase_admin.auth.admin.list_users()
                        for user in users:
                            if user.email == args.identifier:
                                print(f"✅ Found in Supabase with ID: {user.id}")
                                print(f"   Metadata: {user.user_metadata}")
                                break
                        else:
                            print("❌ Not found in Supabase either")
                except Exception as e:
                    print(f"Could not check Supabase: {e}")
            
except Exception as e:
    print(f"Error: {e}")