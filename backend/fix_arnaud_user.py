#!/usr/bin/env python3
"""
Create arnaud@luciddirections.co.uk user in database with correct Supabase ID
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def create_arnaud_user():
    """Create user for arnaud@luciddirections.co.uk"""
    print("🔧 Creating user for arnaud@luciddirections.co.uk")
    print("=" * 50)
    
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # First check if user exists
            result = conn.execute(text("""
                SELECT id, email, supabase_id 
                FROM users 
                WHERE email = 'arnaud@luciddirections.co.uk'
            """))
            
            existing = result.fetchone()
            
            if existing:
                print(f"✅ User already exists with ID: {existing[0]}")
                if not existing[2]:
                    # Update with Supabase ID
                    conn.execute(text("""
                        UPDATE users 
                        SET supabase_id = :supabase_id,
                            auth_provider = 'supabase',
                            updated_at = NOW()
                        WHERE email = :email
                    """), {
                        "email": "arnaud@luciddirections.co.uk",
                        "supabase_id": "459da6bc-3472-4de6-8f0c-793373f1a7b0"
                    })
                    print("✅ Updated user with Supabase ID")
                else:
                    print(f"✅ User already has Supabase ID: {existing[2]}")
            else:
                # Create new user
                print("Creating new user...")
                
                # First, check if we have any restaurants
                result = conn.execute(text("SELECT id, name FROM restaurants LIMIT 1"))
                restaurant = result.fetchone()
                
                if not restaurant:
                    print("❌ No restaurants found. Creating default restaurant...")
                    # Create a default restaurant
                    result = conn.execute(text("""
                        INSERT INTO restaurants (
                            name, slug, address, phone, email,
                            is_active, created_at, updated_at,
                            settings
                        ) VALUES (
                            'Chucho Restaurant', 'chucho-restaurant',
                            '123 Main St, London', '+44 20 1234 5678',
                            'info@chuchorestaurant.com',
                            true, NOW(), NOW(),
                            '{}'::jsonb
                        ) RETURNING id, name
                    """))
                    restaurant = result.fetchone()
                    print(f"✅ Created restaurant: {restaurant[1]}")
                
                # Create the user
                conn.execute(text("""
                    INSERT INTO users (
                        id, email, supabase_id, auth_provider,
                        first_name, last_name, role,
                        is_active,
                        restaurant_id,
                        created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), :email, :supabase_id, 'supabase',
                        :first_name, :last_name, :role,
                        true,
                        :restaurant_id,
                        NOW(), NOW()
                    )
                """), {
                    "email": "arnaud@luciddirections.co.uk",
                    "supabase_id": "459da6bc-3472-4de6-8f0c-793373f1a7b0",
                    "first_name": "Arnaud",
                    "last_name": "Decube",
                    "role": "restaurant_owner",
                    "restaurant_id": restaurant[0]
                })
                
                print("✅ Created user successfully!")
                print(f"   Email: arnaud@luciddirections.co.uk")
                print(f"   Role: restaurant_owner")
                print(f"   Restaurant: {restaurant[1]}")
                print(f"   Supabase ID: 459da6bc-3472-4de6-8f0c-793373f1a7b0")
            
            trans.commit()
            
            # Verify the user
            print("\n🔍 Verifying user...")
            result = conn.execute(text("""
                SELECT u.email, u.role, u.supabase_id, r.name as restaurant_name
                FROM users u
                LEFT JOIN restaurants r ON u.restaurant_id = r.id
                WHERE u.email = 'arnaud@luciddirections.co.uk'
            """))
            
            user = result.fetchone()
            if user:
                print(f"✅ User verified:")
                print(f"   Email: {user[0]}")
                print(f"   Role: {user[1]}")
                print(f"   Restaurant: {user[3]}")
                print(f"   Supabase ID: {user[2]}")
            
            return True
            
        except Exception as e:
            trans.rollback()
            print(f"❌ Error: {str(e)}")
            return False

if __name__ == "__main__":
    if create_arnaud_user():
        print("\n✅ Success! You should now be able to sign in.")
        print("\n📱 Next steps:")
        print("1. Open the app")
        print("2. Sign in with arnaud@luciddirections.co.uk")
        print("3. Use your Supabase password")
    else:
        print("\n❌ Failed to create user. Check the error above.")