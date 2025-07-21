#!/usr/bin/env python3
"""Check user's restaurant association"""

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

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # Check if user exists and their restaurant association
        result = conn.execute(text("""
            SELECT 
                u.id,
                u.email,
                u.role,
                u.restaurant_id,
                u.is_active,
                u.supabase_id,
                r.name as restaurant_name
            FROM users u
            LEFT JOIN restaurants r ON u.restaurant_id = r.id
            WHERE u.email = :email
        """), {"email": "arnaud_decube@hotmail.com"})
        
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
        else:
            print("User not found")
            
except Exception as e:
    print(f"Error: {e}")