#!/usr/bin/env python3
"""
Diagnostic script to test DigitalOcean database connection
Run this locally to verify connection settings
"""

import os
import sys
import psycopg2
from urllib.parse import urlparse

def test_connection():
    # Get DATABASE_URL from environment or command line
    db_url = os.environ.get('DATABASE_URL') or (sys.argv[1] if len(sys.argv) > 1 else None)
    
    if not db_url:
        print("ERROR: Please provide DATABASE_URL as environment variable or argument")
        print("Usage: DATABASE_URL='postgresql://...' python test_db_connection.py")
        print("   or: python test_db_connection.py 'postgresql://...'")
        return
    
    # Parse the URL
    parsed = urlparse(db_url)
    
    print(f"Testing connection to DigitalOcean database...")
    print(f"Host: {parsed.hostname}")
    print(f"Port: {parsed.port}")
    print(f"Database: {parsed.path.lstrip('/')}")
    print(f"SSL Mode: {'require' if 'sslmode=require' in db_url else 'not set'}")
    
    # Check port
    if parsed.port == 25061:
        print("✓ Using connection pooler port (25061)")
    elif parsed.port == 25060:
        print("✓ Using direct connection port (25060)")
    else:
        print(f"⚠️  Unusual port: {parsed.port}")
    
    # Test connection
    try:
        print("\nAttempting connection...")
        
        # Build connection parameters
        conn_params = {
            'host': parsed.hostname,
            'port': parsed.port,
            'database': parsed.path.lstrip('/'),
            'user': parsed.username,
            'password': parsed.password,
            'connect_timeout': 10,
        }
        
        # Add SSL if specified
        if 'sslmode=require' in db_url:
            conn_params['sslmode'] = 'require'
        
        # Try to connect
        conn = psycopg2.connect(**conn_params)
        cursor = conn.cursor()
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
        
        print(f"✅ SUCCESS! Connected to: {version}")
        
        cursor.close()
        conn.close()
        
    except psycopg2.OperationalError as e:
        print(f"\n❌ Connection failed: {e}")
        print("\nTroubleshooting steps:")
        print("1. Check Trusted Sources in DigitalOcean database settings")
        print("2. For App Platform: Add your app (not IP) to trusted sources")
        print("3. Verify DATABASE_URL includes ?sslmode=require")
        print("4. Try both ports: 25060 (direct) and 25061 (pooled)")
        
        if "timeout" in str(e):
            print("\n⚠️  Timeout suggests firewall/network issue")
            print("   Your IP (82.35.184.198) may not match App Platform's IP")
            print("   App Platform apps need to be added by name, not IP")
    
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")

if __name__ == "__main__":
    test_connection()