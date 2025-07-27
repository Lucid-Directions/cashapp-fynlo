#!/usr/bin/env python3
"""
Script to associate a user with a restaurant
This fixes the WebSocket "No restaurant associated with user" error
"""

import os
import sys
import uuid
from datetime import datetime

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

def fix_user_restaurant_association():
    """Associate user with a restaurant"""
    # Create database connection
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        try:
            # Find the user by email using raw SQL
            user_email = "arnaud@luciddirections.co.uk"
            user_result = conn.execute(
                text("SELECT id, email, restaurant_id, role FROM users WHERE email = :email"),
                {"email": user_email}
            ).fetchone()
            
            if not user_result:
                print(f"❌ User not found: {user_email}")
                return
            
            user_id = user_result[0]
            current_restaurant_id = user_result[2]
            user_role = user_result[3]
            
            print(f"✅ Found user: {user_email} (ID: {user_id})")
            print(f"   Current restaurant_id: {current_restaurant_id}")
            print(f"   Role: {user_role}")
            
            # Check if user already has a restaurant
            if current_restaurant_id:
                restaurant_result = conn.execute(
                    text("SELECT name FROM restaurants WHERE id = :id"),
                    {"id": current_restaurant_id}
                ).fetchone()
                if restaurant_result:
                    print(f"✅ User already associated with restaurant: {restaurant_result[0]}")
                    return
            
            # Find existing restaurant
            restaurant_result = conn.execute(
                text("SELECT id, name FROM restaurants LIMIT 1")
            ).fetchone()
            
            if not restaurant_result:
                print("❌ No restaurants found in database. Creating default restaurant...")
                
                # Create a default restaurant
                new_restaurant_id = str(uuid.uuid4())
                conn.execute(
                    text("""
                        INSERT INTO restaurants (
                            id, name, legal_name, address, city, postal_code,
                            country, phone, email, vat_number, vat_rate,
                            currency, timezone, is_active, created_at, updated_at
                        ) VALUES (
                            :id, :name, :legal_name, :address, :city, :postal_code,
                            :country, :phone, :email, :vat_number, :vat_rate,
                            :currency, :timezone, :is_active, :created_at, :updated_at
                        )
                    """),
                    {
                        "id": new_restaurant_id,
                        "name": "Test Restaurant",
                        "legal_name": "Test Restaurant Ltd",
                        "address": "123 Test Street",
                        "city": "London",
                        "postal_code": "SW1A 1AA",
                        "country": "UK",
                        "phone": "+44 20 1234 5678",
                        "email": "info@testrestaurant.com",
                        "vat_number": "GB123456789",
                        "vat_rate": 20.0,
                        "currency": "GBP",
                        "timezone": "Europe/London",
                        "is_active": True,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                )
                conn.commit()
                restaurant_id = new_restaurant_id
                restaurant_name = "Test Restaurant"
                print(f"✅ Created restaurant: {restaurant_name}")
            else:
                restaurant_id = restaurant_result[0]
                restaurant_name = restaurant_result[1]
                print(f"✅ Found existing restaurant: {restaurant_name}")
            
            # Associate user with restaurant
            conn.execute(
                text("UPDATE users SET restaurant_id = :restaurant_id WHERE id = :user_id"),
                {"restaurant_id": restaurant_id, "user_id": user_id}
            )
            conn.commit()
            
            print(f"✅ Successfully associated user {user_email} with restaurant {restaurant_name}")
            print(f"   New restaurant_id: {restaurant_id}")
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            conn.rollback()

if __name__ == "__main__":
    print("🔧 Fixing user restaurant association...")
    fix_user_restaurant_association()
    print("✅ Done!")