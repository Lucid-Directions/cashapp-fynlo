#!/usr/bin/env python3
"""
Create Restaurant Script
Creates a restaurant with proper configuration in the database
<<<<<<< HEAD

=======
"""
>>>>>>> parent of af057592 (fix: docstring syntax and formatting issues across backend)

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import uuid
import json
from app.core.config import settings

# Create engine and session
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_restaurant(
    name: str = "Chucho Restaurant",
    email: str = "info@chucho.co.uk",
    phone: str = "+44 20 1234 5678"
):
    """Create a restaurant in the database"""
    db = SessionLocal()
    
    try:
        # Check if restaurant already exists
        result = db.execute(
            text("SELECT id FROM restaurants WHERE name = :name LIMIT 1"),
            {"name": name}
        )
        existing = result.fetchone()
        
        if existing:
            print(f"✅ {name} already exists with ID: {existing[0]}")
            return existing[0]
        
        # Get the platform ID
        result = db.execute(text("SELECT id FROM platforms LIMIT 1"))
        platform = result.fetchone()
        if not platform:
            print("❌ No platform found. Please create a platform first.")
            return None
        platform_id = platform[0]
        print(f"✅ Found platform: {platform_id}")
        
        # Find platform owner or use existing admin
        result = db.execute(
            text("SELECT id FROM users WHERE role = 'platform_owner' LIMIT 1")
        )
        platform_owner = result.fetchone()
        
        if not platform_owner:
            print("❌ No platform owner found. Please create a platform owner first.")
            return None
        
        owner_id = platform_owner[0]
        print(f"✅ Found platform owner: {owner_id}")
        
        # Create restaurant
        restaurant_id = str(uuid.uuid4())
        business_hours = {
            "monday": {"open": "11:00", "close": "22:00"},
            "tuesday": {"open": "11:00", "close": "22:00"},
            "wednesday": {"open": "11:00", "close": "22:00"},
            "thursday": {"open": "11:00", "close": "22:00"},
            "friday": {"open": "11:00", "close": "23:00"},
            "saturday": {"open": "11:00", "close": "23:00"},
            "sunday": {"open": "12:00", "close": "21:00"}
        }
        
        settings_data = {
            "currency": "GBP",
            "service_charge_percentage": 12.5,
            "language": "en"
        }
        
        tax_configuration = {
            "vat_rate": 20.0,
            "include_tax_in_price": False
        }
        
        payment_methods = ["cash", "card", "qr_code"]
        
        address = {
            "line1": "123 High Street",
            "city": "London",
            "country": "UK",
            "postal_code": "SW1A 1AA"
        }
        
        db.execute(
            text("""
                INSERT INTO restaurants (
                    id, platform_id, name, address, phone, email,
                    timezone, business_hours, settings, tax_configuration,
                    payment_methods, is_active, created_at, updated_at
                )
                VALUES (
                    :id, :platform_id, :name, CAST(:address AS jsonb), :phone, :email,
                    :timezone, CAST(:business_hours AS jsonb), CAST(:settings AS jsonb),
                    CAST(:tax_configuration AS jsonb), CAST(:payment_methods AS jsonb),
                    true, NOW(), NOW()
                )
            """),
            {
                'id': restaurant_id,
                'platform_id': str(platform_id),
                'name': name,
                'address': json.dumps(address),
                'phone': phone,
                'email': email,
                'timezone': 'Europe/London',
                'business_hours': json.dumps(business_hours),
                'settings': json.dumps(settings_data),
                'tax_configuration': json.dumps(tax_configuration),
                'payment_methods': json.dumps(payment_methods)
            }
        )
        
        print(f"✅ Created {name} with ID: {restaurant_id}")
        
        # Commit the transaction
        db.commit()
        return restaurant_id
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating restaurant: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Create a restaurant")
    parser.add_argument("--name", default="Chucho Restaurant", help="Restaurant name")
    parser.add_argument("--email", default="info@chucho.co.uk", help="Restaurant email")
    parser.add_argument("--phone", default="+44 20 1234 5678", help="Restaurant phone")
    
    args = parser.parse_args()
    
    create_restaurant(args.name, args.email, args.phone)