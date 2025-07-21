#!/usr/bin/env python3
"""
Check User-Restaurant Association Diagnostic Tool

Usage:
    python check_user_restaurant.py [email]
    
Arguments:
    email    Optional: Check specific user by email
             If not provided, shows all users with missing restaurants

Examples:
    python check_user_restaurant.py                    # Show all users
    python check_user_restaurant.py user@example.com   # Check specific user
"""

import os
import sys
import argparse
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from tabulate import tabulate

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in environment variables")
    sys.exit(1)

# Parse command line arguments
parser = argparse.ArgumentParser(description='Check user-restaurant associations')
parser.add_argument('email', nargs='?', help='User email address (optional)')
args = parser.parse_args()

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        if args.email:
            # Check specific user
            print(f"\n🔍 Checking user: {args.email}\n")
            result = conn.execute(text("""
                SELECT 
                    u.id,
                    u.email,
                    u.role,
                    u.restaurant_id,
                    u.is_active,
                    u.supabase_id,
                    r.name as restaurant_name,
                    r.subscription_plan,
                    r.subscription_status
                FROM users u
                LEFT JOIN restaurants r ON u.restaurant_id = r.id
                WHERE u.email = :email
            """), {"email": args.email})
        
            user = result.fetchone()
            if user:
                print(f"User found:")
                print(f"  ID: {user[0]}")
                print(f"  Email: {user[1]}")
                print(f"  Role: {user[2]}")
                print(f"  Restaurant ID: {user[3]}")
                print(f"  Is Active: {user[4]}")
                print(f"  Supabase ID: {user[5]}")
                print(f"  Restaurant Name: {user[6] if user[6] else 'None'}")
                if user[6]:
                    print(f"  Subscription Plan: {user[7] if user[7] else 'None'}")
                    print(f"  Subscription Status: {user[8] if user[8] else 'None'}")
                
                if not user[3]:
                    print("\n⚠️  User has no restaurant_id assigned!")
                    
                    # Check available restaurants
                    print("\nAvailable restaurants:")
                    restaurants = conn.execute(text("SELECT id, name FROM restaurants WHERE is_active = true"))
                    for rest in restaurants:
                        print(f"  - {rest[0]}: {rest[1]}")
                        
                    # For platform owners, they might not need a restaurant_id
                    if user[2] == 'platform_owner':
                        print("\n✓ This is a platform owner - they don't need a specific restaurant_id")
                    else:
                        print("\n❌ This user role requires a restaurant_id to access WebSocket")
                        print("\n💡 To fix: python fix_user_restaurant.py", args.email)
            else:
                print(f"❌ User not found: {args.email}")
        else:
            # Show all users without restaurants
            print("\n📊 User-Restaurant Association Report\n")
            
            # Get all users with their restaurant info
            result = conn.execute(text("""
                SELECT 
                    u.email,
                    u.role,
                    u.is_active,
                    CASE WHEN u.restaurant_id IS NULL THEN '❌ Missing' ELSE '✅ Assigned' END as status,
                    r.name as restaurant_name,
                    u.created_at
                FROM users u
                LEFT JOIN restaurants r ON u.restaurant_id = r.id
                ORDER BY 
                    CASE WHEN u.restaurant_id IS NULL THEN 0 ELSE 1 END,
                    u.created_at DESC
            """))
            
            users = result.fetchall()
            if users:
                headers = ['Email', 'Role', 'Active', 'Restaurant Status', 'Restaurant Name', 'Created']
                table_data = []
                
                missing_count = 0
                for user in users:
                    if '❌ Missing' in user[3] and user[1] != 'platform_owner':
                        missing_count += 1
                    
                    table_data.append([
                        user[0],
                        user[1],
                        '✅' if user[2] else '❌',
                        user[3],
                        user[4] or 'N/A',
                        str(user[5])[:10] if user[5] else 'Unknown'
                    ])
                
                print(tabulate(table_data, headers=headers, tablefmt='grid'))
                print(f"\nTotal users: {len(users)}")
                print(f"Users missing restaurants: {missing_count} (excluding platform owners)")
                
                if missing_count > 0:
                    print("\n💡 To fix missing associations, run:")
                    print("   python fix_user_restaurant.py <email>")
            else:
                print("No users found in database")
            
except Exception as e:
    print(f"Error: {e}")