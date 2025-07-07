#!/usr/bin/env python3
"""Update user passwords with correct bcrypt hashes"""

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

# Users and their passwords
users_to_update = [
    ("owner@fynlopos.com", "platformpass123"),
    ("carlos@casaestrella.co.uk", "securepass123"),
    ("john@fynlopos.com", "restaurantpass123"),
    ("sarah@fynlopos.com", "managerpass123"),
    ("demo@fynlopos.com", "demopass123"),
]

with conn.cursor(cursor_factory=RealDictCursor) as cur:
    for email, password in users_to_update:
        # Generate bcrypt hash
        password_hash = pwd_context.hash(password)
        
        # Update user
        cur.execute("""
            UPDATE users 
            SET password_hash = %s, updated_at = NOW()
            WHERE email = %s
            RETURNING id, email, role
        """, (password_hash, email))
        
        result = cur.fetchone()
        if result:
            print(f"✅ Updated password for {email} (role: {result['role']})")
        else:
            print(f"❌ User not found: {email}")
    
    conn.commit()
    print("\n✅ All passwords updated successfully!")

conn.close()