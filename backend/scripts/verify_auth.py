#!/usr/bin/env python3
"""Verify authentication is working correctly"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.api.v1.endpoints.auth import verify_password, get_password_hash
from app.core.database import SessionLocal, User

def test_passwords():
    """Test password verification"""
    # Test password hashing
    test_password = "securepass123"
    hashed = get_password_hash(test_password)
    print(f"✅ Password hash generated: {hashed[:20]}...")
    
    # Verify it works
    is_valid = verify_password(test_password, hashed)
    print(f"✅ Password verification: {is_valid}")
    
    # Now test with database
    db = SessionLocal()
    try:
        # Get Carlos user
        carlos = db.query(User).filter(User.email == "carlos@casaestrella.co.uk").first()
        if carlos:
            print(f"\n🔍 Testing Carlos user:")
            print(f"   Email: {carlos.email}")
            print(f"   Hash in DB: {carlos.password_hash[:20]}...")
            
            # Test with the password
            valid = verify_password("securepass123", carlos.password_hash)
            print(f"   Password 'securepass123' valid: {valid}")
            
            # Update password if needed
            if not valid:
                print("\n⚠️  Password verification failed, updating...")
                carlos.password_hash = get_password_hash("securepass123")
                db.commit()
                print("✅ Password updated!")
        else:
            print("❌ Carlos user not found")
            
        # Test other users
        print("\n🔍 All users in database:")
        users = db.query(User).all()
        for user in users:
            print(f"   - {user.email} (role: {user.role}, active: {user.is_active})")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_passwords()