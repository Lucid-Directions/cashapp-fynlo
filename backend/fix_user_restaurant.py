#!/usr/bin/env python3
"""Create user and assign restaurant"""

import os
import sys
import uuid
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in environment variables")
    sys.exit(1)

# User details from Supabase
SUPABASE_ID = "d2b96734-18db-43f8-a30e-bf936c7b8bc8"
EMAIL = "arnaud_decube@hotmail.com"

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # Begin transaction
        trans = conn.begin()
        
        try:
            # First check if user already exists
            result = conn.execute(text("""
                SELECT id, email, role, restaurant_id 
                FROM users 
                WHERE supabase_id = :supabase_id OR email = :email
            """), {"supabase_id": SUPABASE_ID, "email": EMAIL})
            
            existing_user = result.fetchone()
            
            if existing_user:
                print(f"User already exists: {existing_user}")
                user_id = existing_user[0]
                role = existing_user[2]  # Get role from database
                
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
                
                # Determine role - checking if this is a platform owner
                role = 'platform_owner' if EMAIL == 'arnaud_decube@hotmail.com' else 'restaurant_owner'
                
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
                    "first_name": "Arnaud",
                    "last_name": "Decube",
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
            
            # Verify the setup
            result = conn.execute(text("""
                SELECT u.id, u.email, u.role, u.restaurant_id, r.name
                FROM users u
                LEFT JOIN restaurants r ON u.restaurant_id = r.id
                WHERE u.supabase_id = :supabase_id
            """), {"supabase_id": SUPABASE_ID})
            
            user = result.fetchone()
            if user:
                print("\nFinal user state:")
                print(f"  User ID: {user[0]}")
                print(f"  Email: {user[1]}")
                print(f"  Role: {user[2]}")
                print(f"  Restaurant ID: {user[3]}")
                print(f"  Restaurant Name: {user[4]}")
                
        except Exception as e:
            trans.rollback()
            print(f"Transaction failed: {e}")
            raise
            
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()