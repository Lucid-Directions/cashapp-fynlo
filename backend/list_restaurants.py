#!/usr/bin/env python3
"""List available restaurants for WebSocket connection"""

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
        # Get all active restaurants (with basic columns only)
        result = conn.execute(text("""
            SELECT 
                id,
                name,
                is_active
            FROM restaurants 
            WHERE is_active = true
            ORDER BY name
        """))
        
        restaurants = result.fetchall()
        
        if restaurants:
            print("Active restaurants available for WebSocket connection:")
            print("-" * 80)
            for r in restaurants:
                print(f"Restaurant ID: {r[0]}")
                print(f"Name: {r[1]}")
                print(f"Active: {r[2]}")
                print("-" * 80)
                
            print(f"\nTotal: {len(restaurants)} active restaurant(s)")
            print("\nTo connect to WebSocket, use one of the restaurant IDs above.")
            print("Example WebSocket URL:")
            print(f"ws://localhost:8000/api/v1/ws/{restaurants[0][0]}?user_id=YOUR_USER_ID&token=YOUR_TOKEN")
        else:
            print("No active restaurants found in the database.")
            print("You may need to create a restaurant first.")
            
except Exception as e:
    print(f"Error: {e}")