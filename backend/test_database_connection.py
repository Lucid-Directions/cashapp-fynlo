#!/usr/bin/env python3
"""
Test database connection and display diagnostic information
Helps troubleshoot DigitalOcean deployment issues
"""
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import logging

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_connection():
    """Test database connection with detailed diagnostics"""
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ ERROR: DATABASE_URL environment variable is not set!")
        return False
    
    # Parse and display connection info (without password)
    print("\n🔍 Database Connection Diagnostics")
    print("=" * 60)
    
    # Extract components safely
    if '://' in database_url and '@' in database_url:
        protocol = database_url.split('://')[0]
        rest = database_url.split('://', 1)[1]
        at_index = rest.rfind('@')
        
        if at_index > 0:
            host_part = rest[at_index+1:]
            # Extract host, port, and database
            if '/' in host_part:
                host_port, db_name = host_part.split('/', 1)
                if '?' in db_name:
                    db_name = db_name.split('?')[0]
            else:
                host_port = host_part
                db_name = 'unknown'
            
            if ':' in host_port:
                host, port = host_port.split(':', 1)
            else:
                host = host_port
                port = '5432'
            
            print(f"Protocol: {protocol}")
            print(f"Host: {host}")
            print(f"Port: {port}")
            print(f"Database: {db_name}")
            
            # Check for DigitalOcean specifics
            if "digitalocean.com" in host:
                print(f"Provider: DigitalOcean Managed Database")
                if port == "25061":
                    print(f"Connection Type: PgBouncer (Connection Pooling)")
                elif port == "25060":
                    print(f"Connection Type: Direct Connection")
            
            # Check SSL
            if "sslmode=require" in database_url:
                print(f"SSL: Required ✓")
            else:
                print(f"SSL: Not Required ⚠️")
    
    print("\n🔄 Testing Connection...")
    print("-" * 40)
    
    try:
        # Create engine
        engine = create_engine(database_url, echo=False)
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ Connection Successful!")
            print(f"PostgreSQL Version: {version}")
            
            # Test database access
            result = conn.execute(text("SELECT current_database()"))
            current_db = result.scalar()
            print(f"Current Database: {current_db}")
            
            # Check tables
            result = conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            table_count = result.scalar()
            print(f"Tables in 'public' schema: {table_count}")
            
            # Check specific tables
            important_tables = ['restaurants', 'users', 'orders', 'products', 'categories']
            print(f"\nChecking important tables:")
            for table in important_tables:
                result = conn.execute(text(f"""
                    SELECT COUNT(*) FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = '{table}'
                """))
                exists = result.scalar() > 0
                status = "✓" if exists else "✗"
                print(f"  {status} {table}")
            
            # Check if Chucho restaurant exists
            try:
                result = conn.execute(text("""
                    SELECT name, subscription_plan, subscription_status 
                    FROM restaurants 
                    WHERE name LIKE '%Chucho%' 
                    LIMIT 1
                """))
                restaurant = result.fetchone()
                if restaurant:
                    print(f"\n✅ Chucho restaurant found:")
                    print(f"   Name: {restaurant[0]}")
                    print(f"   Plan: {restaurant[1]}")
                    print(f"   Status: {restaurant[2]}")
                else:
                    print(f"\n⚠️  Chucho restaurant not found in database")
            except Exception as e:
                print(f"\n⚠️  Could not check for Chucho restaurant: {str(e)}")
            
        print("\n✅ All database connectivity tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Connection Failed!")
        print(f"Error: {str(e)}")
        
        # Provide helpful troubleshooting based on error
        if "no such database" in str(e).lower():
            print("\n🔧 Troubleshooting: Database Name Mismatch")
            print("1. Check your DigitalOcean database dashboard")
            print("2. Verify the actual database name (often 'defaultdb')")
            print("3. Update DATABASE_URL in App Platform settings")
        elif "password authentication failed" in str(e).lower():
            print("\n🔧 Troubleshooting: Authentication Failed")
            print("1. Verify the password in DigitalOcean dashboard")
            print("2. Check for special characters that need escaping")
            print("3. Update DATABASE_URL in App Platform settings")
        elif "could not connect to server" in str(e).lower():
            print("\n🔧 Troubleshooting: Connection Failed")
            print("1. In DO Database Settings > Trusted Sources:")
            print("   - Add your App Platform app (not IP address)")
            print("2. Ensure app and database are in same region")
            print("3. Try port 25060 instead of 25061")
        
        return False

if __name__ == "__main__":
    print("🚀 Fynlo POS Database Connection Test")
    print("=" * 60)
    
    success = test_connection()
    
    if success:
        print("\n✅ Database is properly configured!")
        sys.exit(0)
    else:
        print("\n❌ Database configuration needs attention")
        sys.exit(1)