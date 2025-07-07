#!/usr/bin/env python3
"""Test authentication directly"""

from passlib.context import CryptContext
import psycopg2
from psycopg2.extras import RealDictCursor

# Password context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database connection
conn = psycopg2.connect(
    host="localhost",
    database="fynlo_pos", 
    user="arnauddecube"
)

# Test authentication
email = "carlos@casaestrella.co.uk"
password = "securepass123"

with conn.cursor(cursor_factory=RealDictCursor) as cur:
    # Get user
    cur.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    
    if not user:
        print(f"❌ User not found: {email}")
    else:
        print(f"✅ User found: {user['email']} (role: {user['role']})")
        print(f"   Active: {user['is_active']}")
        print(f"   Password hash: {user['password_hash'][:20]}...")
        
        # Test password
        is_valid = pwd_context.verify(password, user['password_hash'])
        print(f"   Password valid: {is_valid}")
        
        if not is_valid:
            # Try creating a new hash and comparing
            new_hash = pwd_context.hash(password)
            print(f"\n   New hash would be: {new_hash[:20]}...")

conn.close()