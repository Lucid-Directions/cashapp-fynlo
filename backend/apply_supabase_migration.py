#!/usr/bin/env python3
"""
Apply Supabase migration directly to database
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def apply_migration():
    """Apply the Supabase migration manually"""
    print("🗄️ Applying Supabase Migration Directly")
    print("=" * 50)
    
    if not DATABASE_URL:
        print("❌ DATABASE_URL not set in .env file")
        return False
    
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        try:
            # Start transaction
            trans = conn.begin()
            
            print("📋 Checking current table structure...")
            
            # Check if columns already exist
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns
                WHERE table_name = 'users'
                AND column_name IN ('supabase_id', 'auth_provider')
            """))
            existing_columns = [row[0] for row in result.fetchall()]
            
            # Add supabase_id if it doesn't exist
            if 'supabase_id' not in existing_columns:
                print("➕ Adding supabase_id column...")
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN supabase_id UUID UNIQUE
                """))
                print("✅ supabase_id column added")
            else:
                print("✅ supabase_id column already exists")
            
            # Add auth_provider if it doesn't exist
            if 'auth_provider' not in existing_columns:
                print("➕ Adding auth_provider column...")
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'supabase'
                """))
                print("✅ auth_provider column added")
            else:
                print("✅ auth_provider column already exists")
            
            # Make password_hash nullable
            print("🔧 Making password_hash nullable...")
            conn.execute(text("""
                ALTER TABLE users 
                ALTER COLUMN password_hash DROP NOT NULL
            """))
            print("✅ password_hash is now nullable")
            
            # Create index for supabase_id
            print("📇 Creating index on supabase_id...")
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_users_supabase_id 
                    ON users(supabase_id)
                """))
                print("✅ Index created")
            except Exception as e:
                if "already exists" in str(e):
                    print("✅ Index already exists")
                else:
                    raise e
            
            # Create alembic_version table if it doesn't exist
            print("📋 Checking alembic_version table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS alembic_version (
                    version_num VARCHAR(32) NOT NULL,
                    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                )
            """))
            
            # Mark migration as applied
            conn.execute(text("""
                INSERT INTO alembic_version (version_num) 
                VALUES ('009_add_supabase_auth_support')
                ON CONFLICT (version_num) DO NOTHING
            """))
            
            # Commit transaction
            trans.commit()
            print("\n✅ Migration completed successfully!")
            
            # Verify the changes
            print("\n🔍 Verifying changes...")
            result = conn.execute(text("""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable
                FROM information_schema.columns
                WHERE table_name = 'users'
                AND column_name IN ('supabase_id', 'auth_provider', 'password_hash')
                ORDER BY column_name
            """))
            
            print("\nUsers table structure:")
            for row in result:
                print(f"  - {row[0]}: {row[1]} (nullable: {row[2]})")
            
            return True
            
        except Exception as e:
            print(f"\n❌ Error: {str(e)}")
            trans.rollback()
            return False

if __name__ == "__main__":
    if apply_migration():
        print("\n🎉 Success! Supabase columns have been added to the database.")
        print("\nNext steps:")
        print("1. Create/link Supabase users")
        print("2. Test authentication with the mobile app")
        print("3. Remove mock authentication from main.py")
    else:
        print("\n❌ Migration failed. Please check the error above.")