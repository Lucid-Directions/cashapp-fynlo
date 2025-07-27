#!/usr/bin/env python3
"""Check database schema"""

import os
import sys
from sqlalchemy import create_engine, inspect

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings

# Create database connection
engine = create_engine(settings.DATABASE_URL)

def check_schema():
    inspector = inspect(engine)
    
    # Check if users table exists
    if 'users' in inspector.get_table_names():
        print("✅ Users table exists")
        columns = inspector.get_columns('users')
        print("\nColumns in users table:")
        for col in columns:
            print(f"  - {col['name']}: {col['type']}")
    else:
        print("❌ Users table does not exist")
    
    print("\n" + "="*50 + "\n")
    
    # Check if restaurants table exists
    if 'restaurants' in inspector.get_table_names():
        print("✅ Restaurants table exists")
        columns = inspector.get_columns('restaurants')
        print("\nColumns in restaurants table:")
        for col in columns:
            print(f"  - {col['name']}: {col['type']}")
    else:
        print("❌ Restaurants table does not exist")

if __name__ == "__main__":
    check_schema()