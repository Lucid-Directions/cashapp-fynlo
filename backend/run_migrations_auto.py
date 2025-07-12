#!/usr/bin/env python3
"""
Run database migrations automatically (non-interactive)
"""

import os
import sys
from alembic.config import Config
from alembic import command
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def run_migrations():
    """Run pending migrations"""
    print("🗄️ Fynlo POS - Database Migration (Automated)")
    print("=" * 50)
    
    if not DATABASE_URL:
        print("❌ DATABASE_URL not set in .env file")
        return False
    
    print("🔍 Checking current migration status...")
    
    # Check current version
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            try:
                result = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
                current = result.fetchone()
                if current:
                    print(f"✅ Current migration: {current[0]}")
                else:
                    print("⚠️  No migrations applied yet")
            except Exception as e:
                if "alembic_version" in str(e):
                    print("⚠️  alembic_version table doesn't exist - this is the first migration")
                else:
                    print(f"❌ Error: {str(e)}")
    except Exception as e:
        print(f"❌ Database connection error: {str(e)}")
        return False
    
    print("\n🚀 Running migrations...")
    
    try:
        # Create Alembic configuration
        alembic_cfg = Config("alembic.ini")
        
        # Run migrations
        command.upgrade(alembic_cfg, "head")
        
        print("✅ Migrations completed successfully!")
        
    except Exception as e:
        print(f"❌ Error running migrations: {str(e)}")
        return False
    
    # Verify Supabase columns
    print("\n🔍 Verifying Supabase columns...")
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns
                WHERE table_name = 'users'
                AND column_name IN ('supabase_id', 'auth_provider')
                ORDER BY column_name
            """))
            
            columns = [row[0] for row in result.fetchall()]
            
            if 'auth_provider' in columns:
                print("✅ auth_provider column exists")
            else:
                print("❌ auth_provider column missing")
                
            if 'supabase_id' in columns:
                print("✅ supabase_id column exists")
            else:
                print("❌ supabase_id column missing")
            
            # Check if password_hash is nullable
            result = conn.execute(text("""
                SELECT is_nullable 
                FROM information_schema.columns
                WHERE table_name = 'users'
                AND column_name = 'password_hash'
            """))
            nullable = result.fetchone()
            if nullable and nullable[0] == 'YES':
                print("✅ password_hash is nullable (good for Supabase)")
            else:
                print("⚠️  password_hash is not nullable")
                
    except Exception as e:
        print(f"❌ Error verifying columns: {str(e)}")
    
    print("\n✅ Migration process complete!")
    return True

if __name__ == "__main__":
    success = run_migrations()
    sys.exit(0 if success else 1)