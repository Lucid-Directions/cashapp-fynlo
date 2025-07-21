#!/usr/bin/env python3
"""Get user details for WebSocket connection"""

import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_ID = "d2b96734-18db-43f8-a30e-bf936c7b8bc8"

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, email, role, restaurant_id
            FROM users 
            WHERE supabase_id = :supabase_id
        """), {"supabase_id": SUPABASE_ID})
        
        user = result.fetchone()
        if user:
            print("User details for WebSocket connection:")
            print(f"User ID: {user[0]}")
            print(f"Email: {user[1]}")
            print(f"Role: {user[2]}")
            print(f"Restaurant ID: {user[3] if user[3] else 'None (platform owner can access any)'}")
            
except Exception as e:
    print(f"Error: {e}")