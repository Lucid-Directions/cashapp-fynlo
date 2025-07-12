#!/usr/bin/env python3
"""
Run pending database migrations
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

def check_current_migration():
    """Check current migration version"""
    print("🔍 Checking current migration status...")
    
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT version_num FROM alembic_version LIMIT 1
            """))
            current = result.fetchone()
            if current:
                print(f"✅ Current migration: {current[0]}")
            else:
                print("⚠️  No migrations applied yet")
    except Exception as e:
        print(f"❌ Error checking migration status: {str(e)}")
        if "alembic_version" in str(e):
            print("   Note: alembic_version table might not exist yet")

def run_migrations():
    """Run pending migrations"""
    print("\n🚀 Running pending migrations...")
    
    try:
        # Create Alembic configuration
        alembic_cfg = Config("alembic.ini")
        
        # Run migrations
        command.upgrade(alembic_cfg, "head")
        
        print("✅ Migrations completed successfully!")
        
    except Exception as e:
        print(f"❌ Error running migrations: {str(e)}")
        return False
    
    return True

def verify_supabase_columns():
    """Verify Supabase columns were added"""
    print("\n🔍 Verifying Supabase columns...")
    
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns
                WHERE table_name = 'users'
                AND column_name IN ('supabase_id', 'auth_provider')
                ORDER BY column_name
            """))
            
            columns = [row[0] for row in result.fetchall()]
            
            if 'supabase_id' in columns:
                print("✅ supabase_id column exists")
            else:
                print("❌ supabase_id column missing")
                
            if 'auth_provider' in columns:
                print("✅ auth_provider column exists")
            else:
                print("❌ auth_provider column missing")
                
            return len(columns) == 2
            
    except Exception as e:
        print(f"❌ Error verifying columns: {str(e)}")
        return False

def main():
    """Main function"""
    print("🗄️ Fynlo POS - Database Migration Tool")
    print("=" * 50)
    
    if not DATABASE_URL:
        print("❌ DATABASE_URL not set in .env file")
        sys.exit(1)
    
    # Check current status
    check_current_migration()
    
    # Ask for confirmation
    print("\n⚠️  This will apply all pending migrations to the database.")
    print("   Make sure you have a backup if this is production!")
    response = input("\nContinue? (yes/no): ").strip().lower()
    
    if response != 'yes':
        print("❌ Migration cancelled")
        sys.exit(0)
    
    # Run migrations
    if run_migrations():
        # Verify the Supabase columns
        if verify_supabase_columns():
            print("\n✅ All done! Supabase authentication support is now enabled.")
            print("\n🎯 Next steps:")
            print("1. Create Supabase users with: python get_supabase_token.py")
            print("2. Test authentication with the mobile app")
            print("3. Remove mock authentication from main.py")
        else:
            print("\n⚠️  Migrations ran but Supabase columns not found.")
            print("   Check the migration logs above for errors.")
    else:
        print("\n❌ Migration failed. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()