#!/usr/bin/env python3
"""Check why user doesn't have restaurant_id"""

import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.core.database import User, Restaurant

# Create database connection
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_user_restaurant():
    db = SessionLocal()
    try:
        # Find user by email
        email = "arnaud@luciddirections.co.uk"
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            print(f"❌ User {email} not found in database")
            return
        
        print(f"✅ Found user: {user.email}")
        print(f"   ID: {user.id}")
        print(f"   Supabase ID: {user.supabase_id}")
        print(f"   Role: {user.role}")
        print(f"   Restaurant ID: {user.restaurant_id}")
        print(f"   Created: {user.created_at}")
        print(f"   Last Login: {user.last_login}")
        
        if user.restaurant_id:
            restaurant = db.query(Restaurant).filter(Restaurant.id == user.restaurant_id).first()
            if restaurant:
                print(f"\n✅ User has restaurant: {restaurant.name}")
                print(f"   ID: {restaurant.id}")
                print(f"   Plan: {restaurant.subscription_plan}")
                print(f"   Status: {restaurant.subscription_status}")
            else:
                print(f"\n❌ Restaurant ID {user.restaurant_id} not found!")
        else:
            print(f"\n❌ User has no restaurant_id")
            
            # Check if there are any restaurants with this user's email
            restaurant = db.query(Restaurant).filter(Restaurant.email == email).first()
            if restaurant:
                print(f"\n⚠️  Found restaurant with same email: {restaurant.name}")
                print(f"   ID: {restaurant.id}")
                print(f"   Should we link this restaurant to the user?")
            else:
                print(f"\n⚠️  No restaurant found with email {email}")
                print(f"   User role is '{user.role}' - should create default restaurant")
        
    finally:
        db.close()

if __name__ == "__main__":
    check_user_restaurant()