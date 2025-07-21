#!/usr/bin/env python3
"""Check if user exists by Supabase ID"""

import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in environment variables")
    sys.exit(1)

# The Supabase ID from the error logs
SUPABASE_ID = "d2b96734-18db-43f8-a30e-bf936c7b8bc8"

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # Check if user exists by Supabase ID
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
                r.name as restaurant_name
            FROM users u
            LEFT JOIN restaurants r ON u.restaurant_id = r.id
            WHERE u.supabase_id = :supabase_id
        """), {"supabase_id": SUPABASE_ID})
        
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
            print(f"User with Supabase ID {SUPABASE_ID} not found in database")
            print("\nThis suggests the user hasn't been created yet during authentication.")
            
except Exception as e:
    print(f"Error: {e}")