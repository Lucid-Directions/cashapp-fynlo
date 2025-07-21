#!/usr/bin/env python3
"""
Fix User-Restaurant Association Tool

SECURITY WARNING: This is a development/debugging tool only.
Do NOT use in production. Platform owner roles should be assigned
through proper administrative procedures, not this script.

Usage:
    python fix_user_restaurant.py <email> [--supabase-id <id>] [--role <role>]

Arguments:
    email             User's email address
    --supabase-id     Optional: Supabase ID (will be looked up if not provided)
    --role            Optional: User role (restaurant_owner/platform_owner/manager/employee)
                      Default: restaurant_owner

Examples:
    python fix_user_restaurant.py user@example.com
    python fix_user_restaurant.py user@example.com --role manager
    python fix_user_restaurant.py user@example.com --supabase-id abc-123 --role restaurant_owner

This script fixes missing user-restaurant associations and can optionally
set or update user roles. It will:
1. Look up the user by email or Supabase ID
2. Create the user if they don't exist
3. Assign a restaurant if they don't have one
4. Skip platform owners (they don't need restaurant assignments)
"""

import os
import sys
import uuid
import argparse
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in environment variables")
    sys.exit(1)

# Parse command line arguments
parser = argparse.ArgumentParser(description='Fix user-restaurant associations')
parser.add_argument('email', help='User email address')
parser.add_argument('--supabase-id', help='Supabase ID (optional)')
parser.add_argument('--role', default='restaurant_owner', 
                    choices=['restaurant_owner', 'platform_owner', 'manager', 'employee'],
                    help='User role (default: restaurant_owner)')
args = parser.parse_args()

EMAIL = args.email
SUPABASE_ID = args.supabase_id
DEFAULT_ROLE = args.role

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # Begin transaction
        trans = conn.begin()
        
        try:
            # If no Supabase ID provided, try to find it
            if not SUPABASE_ID:
                print(f"Looking up Supabase ID for {EMAIL}...")
                # Try Supabase first
                from app.core.supabase import supabase_admin
                if supabase_admin:
                    try:
                        users = supabase_admin.auth.admin.list_users()
                        for user in users:
                            if user.email == EMAIL:
                                SUPABASE_ID = str(user.id)
                                print(f"Found Supabase ID: {SUPABASE_ID}")
                                break
                    except Exception as e:
                        print(f"Could not lookup in Supabase: {e}")
            
            # First check if user already exists
            if SUPABASE_ID:
                result = conn.execute(text("""
                    SELECT id, email, role, restaurant_id, supabase_id
                    FROM users 
                    WHERE supabase_id = :supabase_id OR email = :email
                """), {"supabase_id": SUPABASE_ID, "email": EMAIL})
            else:
                result = conn.execute(text("""
                    SELECT id, email, role, restaurant_id, supabase_id
                    FROM users 
                    WHERE email = :email
                """), {"email": EMAIL})
            
            existing_user = result.fetchone()
            
            if existing_user:
                print(f"User already exists: {existing_user}")
                user_id = existing_user[0]
                role = existing_user[2]  # Get role from database
                
                # If we found a Supabase ID in the database, use it
                if existing_user[4] and not SUPABASE_ID:
                    SUPABASE_ID = existing_user[4]
                    print(f"Using Supabase ID from database: {SUPABASE_ID}")
                
                if not existing_user[3]:  # No restaurant_id
                    print(f"User exists but has no restaurant. Will assign one. Role: {role}")
                else:
                    print("User already has a restaurant. Nothing to do.")
                    trans.rollback()
                    sys.exit(0)
            else:
                # Create the user
                print("Creating new user...")
                user_id = str(uuid.uuid4())
                
                # Use the role specified in command line arguments
                role = DEFAULT_ROLE
                
                if not SUPABASE_ID:
                    print("Warning: No Supabase ID found. User will need to be linked to Supabase later.")
                    SUPABASE_ID = None
                
                conn.execute(text("""
                    INSERT INTO users (
                        id, email, supabase_id, auth_provider,
                        first_name, last_name, role, is_active,
                        created_at, last_login
                    ) VALUES (
                        :id, :email, :supabase_id, 'supabase',
                        :first_name, :last_name, :role, true,
                        :created_at, :last_login
                    )
                """), {
                    "id": user_id,
                    "email": EMAIL,
                    "supabase_id": SUPABASE_ID,
                    "first_name": EMAIL.split('@')[0].split('_')[0].capitalize() if '_' in EMAIL.split('@')[0] else EMAIL.split('@')[0].capitalize(),
                    "last_name": EMAIL.split('@')[0].split('_')[1].capitalize() if '_' in EMAIL.split('@')[0] else "",
                    "role": role,
                    "created_at": datetime.utcnow(),
                    "last_login": datetime.utcnow()
                })
                print(f"Created user with ID: {user_id}, Role: {role}")
            
            # If platform owner, no restaurant needed
            if role == 'platform_owner':
                print("User is a platform owner - no specific restaurant needed")
                trans.commit()
                print("✅ User setup complete!")
                sys.exit(0)
            
            # For restaurant owners, find or create a restaurant
            print("\nChecking for existing restaurants...")
            restaurants = conn.execute(text("""
                SELECT id, name, is_active 
                FROM restaurants 
                WHERE is_active = true
                ORDER BY created_at DESC
                LIMIT 5
            """))
            
            restaurant_list = list(restaurants)
            if restaurant_list:
                print("Found existing restaurants:")
                for r in restaurant_list:
                    print(f"  - {r[0]}: {r[1]}")
                
                # Use the first active restaurant (Chucho Grill)
                restaurant_id = restaurant_list[0][0]
                print(f"\nAssigning user to restaurant: {restaurant_list[0][1]}")
            else:
                # Create a new restaurant
                print("No restaurants found. Creating a new one...")
                restaurant_id = str(uuid.uuid4())
                
                conn.execute(text("""
                    INSERT INTO restaurants (
                        id, name, email, is_active,
                        subscription_plan, subscription_status,
                        subscription_started_at, created_at,
                        address, settings, tax_configuration, payment_methods
                    ) VALUES (
                        :id, :name, :email, true,
                        'alpha', 'trial',
                        :started_at, :created_at,
                        :address, :settings, :tax_config, :payment_methods
                    )
                """), {
                    "id": restaurant_id,
                    "name": "My Restaurant",
                    "email": EMAIL,
                    "started_at": datetime.utcnow(),
                    "created_at": datetime.utcnow(),
                    "address": '{"street": "123 Main St", "city": "London", "postcode": "SW1A 1AA"}',
                    "settings": '{}',
                    "tax_config": '{"vatEnabled": true, "vatRate": 20, "serviceTaxEnabled": true, "serviceTaxRate": 12.5}',
                    "payment_methods": '{"qrCode": {"enabled": true, "feePercentage": 1.2}, "cash": {"enabled": true, "requiresAuth": false}, "card": {"enabled": true, "feePercentage": 2.9}, "applePay": {"enabled": true, "feePercentage": 2.9}}'
                })
                print(f"Created restaurant with ID: {restaurant_id}")
            
            # Update user with restaurant_id
            conn.execute(text("""
                UPDATE users 
                SET restaurant_id = :restaurant_id
                WHERE id = :user_id
            """), {"restaurant_id": restaurant_id, "user_id": user_id})
            
            print(f"Assigned restaurant {restaurant_id} to user")
            
            # Commit transaction
            trans.commit()
            print("\n✅ User setup complete!")
            
            # Verify the setup - use user_id which we know exists
            result = conn.execute(text("""
                SELECT u.id, u.email, u.role, u.restaurant_id, r.name, u.supabase_id
                FROM users u
                LEFT JOIN restaurants r ON u.restaurant_id = r.id
                WHERE u.id = :user_id
            """), {"user_id": user_id})
            
            user = result.fetchone()
            if user:
                print("\nFinal user state:")
                print(f"  User ID: {user[0]}")
                print(f"  Email: {user[1]}")
                print(f"  Role: {user[2]}")
                print(f"  Restaurant ID: {user[3]}")
                print(f"  Restaurant Name: {user[4]}")
                print(f"  Supabase ID: {user[5] if user[5] else '⚠️  Not set - authentication will fail!'}")
                
        except Exception as e:
            trans.rollback()
            print(f"Transaction failed: {e}")
            raise
            
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()