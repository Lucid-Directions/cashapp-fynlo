#!/usr/bin/env python3
"""
Database State Diagnostic Tool
Checks current database schema and identifies missing columns
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv
from urllib.parse import urlparse
from tabulate import tabulate

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

def check_database_schema():
    """Check database schema and report on missing columns"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment variables")
        return
    
    print("🔍 Checking database schema...")
    print(f"📊 Database URL: {database_url.split('@')[1] if '@' in database_url else 'hidden'}")
    
    try:
        # Connect to database
        conn_params = parse_database_url(database_url)
        conn = psycopg2.connect(**conn_params)
        cursor = conn.cursor()
        
        # Check if restaurants table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'restaurants'
            )
        """)
        if not cursor.fetchone()[0]:
            print("❌ Table 'restaurants' does not exist!")
            return
        
        print("✅ Table 'restaurants' exists")
        
        # Get all columns in restaurants table
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'restaurants'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        column_names = [col[0] for col in columns]
        
        print(f"\n📋 Found {len(columns)} columns in 'restaurants' table:")
        print(tabulate(columns, headers=['Column', 'Type', 'Nullable', 'Default'], tablefmt='grid'))
        
        # Check for subscription-related columns
        subscription_columns = [
            'subscription_plan',
            'subscription_status', 
            'subscription_started_at',
            'subscription_expires_at'
        ]
        
        missing_columns = [col for col in subscription_columns if col not in column_names]
        
        if missing_columns:
            print(f"\n❌ MISSING COLUMNS DETECTED:")
            for col in missing_columns:
                print(f"   - {col}")
            print("\n⚠️  These columns are required for authentication to work properly!")
            print("💡 Run 'python apply_migrations.py' to fix this issue")
        else:
            print("\n✅ All subscription columns are present")
        
        # Check current Alembic version
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'alembic_version'
            )
        """)
        
        if cursor.fetchone()[0]:
            cursor.execute("SELECT version_num FROM alembic_version")
            version = cursor.fetchone()
            if version:
                print(f"\n📌 Current migration version: {version[0]}")
            else:
                print("\n⚠️  Alembic version table exists but is empty")
        else:
            print("\n⚠️  No Alembic version table found - migrations may not be initialized")
        
        # Check for other authentication-related tables
        auth_tables = ['users', 'user_roles', 'platforms']
        print("\n🔐 Checking authentication-related tables:")
        
        for table in auth_tables:
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                )
            """, (table,))
            exists = cursor.fetchone()[0]
            print(f"   {'✅' if exists else '❌'} Table '{table}'")
        
        cursor.close()
        conn.close()
        
        if missing_columns:
            print("\n🔧 RECOMMENDED ACTIONS:")
            print("1. Run 'python apply_migrations.py' to apply pending migrations")
            print("2. If migrations fail, run 'python fix_missing_columns.py' as emergency fix")
            print("3. Restart the backend service after fixing the database")
        else:
            print("\n✅ Database schema appears to be up to date!")
            
    except Exception as e:
        print(f"\n❌ Error checking database: {str(e)}")
        print("💡 Make sure your DATABASE_URL is correct and the database is accessible")

if __name__ == "__main__":
    check_database_schema()