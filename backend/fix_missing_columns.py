#!/usr/bin/env python3
"""Fix missing columns in restaurants table"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment")
    sys.exit(1)

# Create engine
engine = create_engine(DATABASE_URL, echo=True)

# SQL to add missing columns
ADD_COLUMNS_SQL = """
DO $$ 
BEGIN
    -- Add subscription_plan if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='restaurants' AND column_name='subscription_plan') THEN
        ALTER TABLE restaurants ADD COLUMN subscription_plan VARCHAR(50) DEFAULT 'beta';
    END IF;
    
    -- Add subscription_status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='restaurants' AND column_name='subscription_status') THEN
        ALTER TABLE restaurants ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'active';
    END IF;
    
    -- Add subscription_started_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='restaurants' AND column_name='subscription_started_at') THEN
        ALTER TABLE restaurants ADD COLUMN subscription_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    -- Add subscription_expires_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='restaurants' AND column_name='subscription_expires_at') THEN
        ALTER TABLE restaurants ADD COLUMN subscription_expires_at TIMESTAMP;
    END IF;
END $$;
"""

def fix_missing_columns():
    """Add missing columns to restaurants table"""
    try:
        with engine.connect() as conn:
            # Execute the SQL
            conn.execute(text(ADD_COLUMNS_SQL))
            conn.commit()
            
            # Verify columns were added
            result = conn.execute(text("""
                SELECT column_name, data_type, column_default
                FROM information_schema.columns
                WHERE table_name = 'restaurants'
                AND column_name IN ('subscription_plan', 'subscription_status', 
                                   'subscription_started_at', 'subscription_expires_at')
                ORDER BY column_name
            """))
            
            print("\nVerifying columns:")
            for row in result:
                print(f"  - {row[0]}: {row[1]} (default: {row[2]})")
                
            print("\n✅ Missing columns have been added successfully!")
            
    except Exception as e:
        print(f"\n❌ Error adding columns: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    print("Adding missing columns to restaurants table...")
    fix_missing_columns()