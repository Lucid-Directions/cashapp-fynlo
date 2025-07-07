#!/usr/bin/env python3
"""
Quick fix script to add password hashes to existing users
"""

import sys
import os
import asyncio
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

# Database configuration
DATABASE_URL = "sqlite:///./fynlo_pos_dev.db"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)

def fix_user_passwords():
    """Fix password hashes for existing users"""
    
    # Create database engine
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    with SessionLocal() as db:
        # Check existing users
        result = db.execute(text("SELECT id, email, role FROM users WHERE password_hash IS NULL OR password_hash = ''"))
        users = result.fetchall()
        
        print(f"Found {len(users)} users without password hashes")
        
        for user in users:
            user_id, email, role = user
            print(f"Fixing user: {email} (role: {role})")
            
            # Set default password as "password123" for all demo users
            password_hash = get_password_hash("password123")
            
            # Update user with password hash
            db.execute(
                text("UPDATE users SET password_hash = :password_hash WHERE id = :user_id"),
                {"password_hash": password_hash, "user_id": user_id}
            )
        
        # Commit changes
        db.commit()
        print("✅ All user passwords have been fixed")
        
        # Verify the fix
        result = db.execute(text("SELECT email, role FROM users WHERE password_hash IS NOT NULL AND password_hash != ''"))
        fixed_users = result.fetchall()
        print(f"✅ {len(fixed_users)} users now have password hashes")
        
        for user in fixed_users:
            email, role = user
            print(f"  - {email} ({role})")

if __name__ == "__main__":
    fix_user_passwords() 