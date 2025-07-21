#!/usr/bin/env python3
"""
Get User Details for WebSocket Connection

Usage:
    python get_user_details.py <email>
    
Arguments:
    email    User's email address

Example:
    python get_user_details.py user@example.com
"""

import os
import sys
import argparse
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in environment variables")
    sys.exit(1)

# Parse command line arguments
parser = argparse.ArgumentParser(description='Get user details for WebSocket connection')
parser.add_argument('email', help='User email address')
args = parser.parse_args()

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print(f"\n🔍 Getting details for user: {args.email}\n")
        
        result = conn.execute(text("""
            SELECT 
                u.id,
                u.email,
                u.role,
                u.restaurant_id,
                u.supabase_id,
                u.is_active,
                u.created_at,
                u.last_login,
                r.name as restaurant_name,
                r.subscription_plan,
                r.subscription_status
            FROM users u
            LEFT JOIN restaurants r ON u.restaurant_id = r.id
            WHERE u.email = :email
        """), {"email": args.email})
        
        user = result.fetchone()
        if user:
            print("✅ User found!\n")
            print("=== User Details ===")
            print(f"ID: {user[0]}")
            print(f"Email: {user[1]}")
            print(f"Role: {user[2]}")
            print(f"Active: {'Yes' if user[5] else 'No'}")
            print(f"Created: {user[6]}")
            print(f"Last Login: {user[7] if user[7] else 'Never'}")
            print(f"\n=== Authentication ===")
            print(f"Supabase ID: {user[4] if user[4] else '⚠️  Missing - User cannot authenticate!'}")
            
            print(f"\n=== Restaurant Assignment ===")
            if user[3]:
                print(f"Restaurant ID: {user[3]}")
                print(f"Restaurant Name: {user[8]}")
                print(f"Subscription Plan: {user[9] if user[9] else 'None'}")
                print(f"Subscription Status: {user[10] if user[10] else 'None'}")
            else:
                if user[2] == 'platform_owner':
                    print("✓ No restaurant needed (platform owner can access all)")
                else:
                    print("❌ No restaurant assigned - WebSocket will fail!")
                    print("   Fix: python fix_user_restaurant.py", args.email)
            
            print(f"\n=== WebSocket Connection Info ===")
            print(f"Will authenticate as: {user[2]}")
            if user[3] or user[2] == 'platform_owner':
                print("✅ User can connect to WebSocket")
            else:
                print("❌ User CANNOT connect to WebSocket (missing restaurant)")
                
        else:
            print(f"❌ User not found: {args.email}")
            print("\nPossible reasons:")
            print("1. User hasn't signed up yet")
            print("2. Wrong email address")
            print("3. User in Supabase but not synced to database")
            
except Exception as e:
    print(f"Error: {e}")