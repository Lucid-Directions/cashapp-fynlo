#!/usr/bin/env python3
"""
Emergency Database Fix Tool
Manually adds missing columns when migrations fail
USE ONLY AS LAST RESORT!
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv
from urllib.parse import urlparse

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def parse_database_url(url):
    """Parse database URL into connection parameters"""
    parsed = urlparse(url)
    return {
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'database': parsed.path.lstrip('/'),
        'user': parsed.username,
        'password': parsed.password
    }

def fix_missing_columns():
    """Add missing columns to the database"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment variables")
        return False
    
    print("⚠️  EMERGENCY DATABASE FIX TOOL")
    print("⚠️  This tool will manually add missing columns to your database")
    print("⚠️  Use only if regular migrations fail!")
    print()
    
    response = input("Do you want to continue? (yes/no): ")
    if response.lower() != 'yes':
        print("Cancelled.")
        return False
    
    try:
        # Connect to database
        conn_params = parse_database_url(database_url)
        conn = psycopg2.connect(**conn_params)
        cursor = conn.cursor()
        
        print("\n🔍 Checking for missing columns...")
        
        # Define the columns that should exist
        required_columns = {
            'restaurants': [
                ('subscription_plan', "VARCHAR(50) DEFAULT 'alpha'"),
                ('subscription_status', "VARCHAR(50) DEFAULT 'trial'"),
                ('subscription_started_at', "TIMESTAMP WITH TIME ZONE"),
                ('subscription_expires_at', "TIMESTAMP WITH TIME ZONE"),
                ('floor_plan_layout', "JSONB")
            ],
            'users': [
                ('supabase_id', "UUID UNIQUE"),
                ('auth_provider', "VARCHAR(50) DEFAULT 'supabase'"),
                ('username', "VARCHAR(100) UNIQUE")
            ]
        }
        
        columns_added = 0
        
        for table_name, columns in required_columns.items():
            print(f"\n📋 Checking table: {table_name}")
            
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                )
            """, (table_name,))
            
            if not cursor.fetchone()[0]:
                print(f"❌ Table '{table_name}' does not exist - skipping")
                continue
            
            # Get existing columns
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = %s
            """, (table_name,))
            
            existing_columns = [row[0] for row in cursor.fetchall()]
            
            # Add missing columns
            for column_name, column_definition in columns:
                if column_name not in existing_columns:
                    try:
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_name} {column_definition}"
                        print(f"   ➕ Adding column: {column_name}")
                        cursor.execute(alter_sql)
                        columns_added += 1
                    except Exception as e:
                        print(f"   ❌ Failed to add column {column_name}: {str(e)}")
                        # Try without the default or constraints
                        try:
                            basic_type = column_definition.split(' ')[0]
                            alter_sql = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_name} {basic_type}"
                            cursor.execute(alter_sql)
                            print(f"   ✅ Added column {column_name} (basic type only)")
                            columns_added += 1
                        except Exception as e2:
                            print(f"   ❌ Still failed: {str(e2)}")
                else:
                    print(f"   ✓ Column {column_name} already exists")
        
        # Special handling for password_hash nullable
        print("\n📋 Checking password_hash nullable status...")
        try:
            cursor.execute("""
                SELECT is_nullable 
                FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'users'
                AND column_name = 'password_hash'
            """)
            result = cursor.fetchone()
            if result and result[0] == 'NO':
                print("   ➕ Making password_hash nullable for Supabase auth")
                cursor.execute("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL")
                columns_added += 1
            else:
                print("   ✓ password_hash is already nullable")
        except Exception as e:
            print(f"   ⚠️  Could not modify password_hash: {str(e)}")
        
        # Create indexes
        print("\n📋 Creating indexes...")
        indexes = [
            ("idx_users_supabase_id", "users", "supabase_id"),
            ("idx_restaurants_subscription_plan", "restaurants", "subscription_plan"),
            ("idx_restaurants_subscription_status", "restaurants", "subscription_status")
        ]
        
        for index_name, table_name, column_name in indexes:
            try:
                # Check if column exists before creating index
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns
                        WHERE table_schema = 'public' 
                        AND table_name = %s
                        AND column_name = %s
                    )
                """, (table_name, column_name))
                
                if cursor.fetchone()[0]:
                    cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({column_name})")
                    print(f"   ✓ Created index: {index_name}")
                else:
                    print(f"   ⚠️  Skipping index {index_name} - column doesn't exist")
            except Exception as e:
                print(f"   ⚠️  Index {index_name} may already exist: {str(e)}")
        
        # Update alembic version if needed
        print("\n📋 Updating migration tracking...")
        try:
            # Check if alembic_version table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'alembic_version'
                )
            """)
            
            if cursor.fetchone()[0]:
                # Update to the version that adds subscription fields
                cursor.execute("""
                    INSERT INTO alembic_version (version_num) 
                    VALUES ('009_add_supabase_auth_support')
                    ON CONFLICT (version_num) DO NOTHING
                """)
                print("   ✓ Updated migration version")
            else:
                print("   ⚠️  No alembic_version table - skipping migration tracking")
        except Exception as e:
            print(f"   ⚠️  Could not update migration version: {str(e)}")
        
        # Commit changes
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"\n✅ Emergency fix completed!")
        print(f"   - Added {columns_added} missing columns")
        print("\n💡 Next steps:")
        print("   1. Run 'python check_database_state.py' to verify the fix")
        print("   2. Try logging in to the application again")
        print("   3. Consider running proper migrations when possible")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Emergency fix failed: {str(e)}")
        print("💡 Please check your database connection and try again")
        return False

if __name__ == "__main__":
    print("="*60)
    print("🔧 Fynlo Emergency Database Fix Tool")
    print("="*60)
    
    success = fix_missing_columns()
    
    if not success:
        sys.exit(1)
    else:
        sys.exit(0)