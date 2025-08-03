#!/usr/bin/env python3
"""
Database Setup Script for Fynlo POS
Automatically sets up PostgreSQL database with proper schema and sample data
"""

import asyncio
import os
import sys
import subprocess
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.core.config import settings
from app.core.database import init_db, engine, SessionLocal
from sqlalchemy import text, create_engine
from sqlalchemy.exc import OperationalError, ProgrammingError
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def check_postgresql_installed():
    """Check if PostgreSQL is installed and accessible"""
    try:
        result = subprocess.run(['psql', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            logger.info(f"✅ PostgreSQL found: {result.stdout.strip()}")
            return True
        else:
            logger.info("❌ PostgreSQL not found in PATH")
            return False
    except FileNotFoundError:
        logger.info("❌ PostgreSQL not installed or not in PATH")
        return False

def check_postgresql_running():
    """Check if PostgreSQL service is running"""
    try:
        # Try to connect to default postgres database
        conn = psycopg2.connect(
            host="localhost",
            port="5432",
            database="postgres",
            user="postgres"
        )
        conn.close()
        logger.info("✅ PostgreSQL service is running")
        return True
    except psycopg2.OperationalError as e:
        logger.error(f"❌ PostgreSQL service not running or connection failed: {e}")
        return False

def create_database_and_user():
    """Create the Fynlo database and user if they don't exist"""
    try:
        # Connect to PostgreSQL as superuser
        conn = psycopg2.connect(
            host="localhost",
            port="5432",
            database="postgres",
            user="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Create user if not exists
        try:
            cursor.execute("CREATE USER fynlo_user WITH PASSWORD 'fynlo_password';")
            logger.info("✅ Created database user: fynlo_user")
        except psycopg2.errors.DuplicateObject:
            logger.info("ℹ️ Database user 'fynlo_user' already exists")
        
        # Create database if not exists
        try:
            cursor.execute("CREATE DATABASE fynlo_pos OWNER fynlo_user;")
            logger.info("✅ Created database: fynlo_pos")
        except psycopg2.errors.DuplicateDatabase:
            logger.info("ℹ️ Database 'fynlo_pos' already exists")
        
        # Grant privileges
        cursor.execute("GRANT ALL PRIVILEGES ON DATABASE fynlo_pos TO fynlo_user;")
        logger.info("✅ Granted privileges to fynlo_user")
        
        cursor.close()
        conn.close()
        return True
        
    except psycopg2.Error as e:
        logger.error(f"❌ Failed to create database/user: {e}")
        return False

def test_connection():
    """Test connection to the Fynlo database"""
    try:
        # Test connection with our configured settings
        test_engine = create_engine(settings.DATABASE_URL)
        with test_engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.fetchone()[0]
            logger.info(f"✅ Database connection successful")
            logger.info(f"   PostgreSQL version: {version}")
            return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False

def run_migrations():
    """Run Alembic migrations to create tables"""
    try:
        logger.info("🔄 Running database migrations...")
        result = subprocess.run(['alembic', 'upgrade', 'head'], 
                              capture_output=True, text=True, cwd=project_root)
        
        if result.returncode == 0:
            logger.info("✅ Database migrations completed successfully")
            if result.stdout:
                logger.info(f"   Output: {result.stdout}")
            return True
        else:
            logger.error(f"❌ Migration failed: {result.stderr}")
            return False
    except FileNotFoundError:
        logger.info("❌ Alembic not found. Please install: pip install alembic")
        return False
    except Exception as e:
        logger.error(f"❌ Migration error: {e}")
        return False

def create_sample_data():
    """Create sample data for testing"""
    try:
        from app.core.database import Platform, Restaurant, User
        from app.api.v1.endpoints.auth import get_password_hash
        import uuid
import logging

logger = logging.getLogger(__name__)

        
        db = SessionLocal()
        
        # Check if data already exists
        existing_platform = db.query(Platform).first()
        if existing_platform:
            logger.info("ℹ️ Sample data already exists, skipping creation")
            db.close()
            return True
        
        # Create sample platform
        platform = Platform(
            name="Fynlo Demo Platform",
            owner_email="admin@fynlo.com",
            subscription_tier="premium"
        )
        db.add(platform)
        db.flush()  # Get the ID
        
        # Create sample restaurant
        restaurant = Restaurant(
            platform_id=platform.id,
            name="Demo Restaurant",
            address={
                "street": "123 Main Street",
                "city": "San Francisco",
                "state": "CA",
                "zip": "94102",
                "country": "USA"
            },
            phone="+1-555-0123",
            email="restaurant@fynlo.com",
            timezone="America/Los_Angeles"
        )
        db.add(restaurant)
        db.flush()  # Get the ID
        
        # Create sample users
        admin_user = User(
            email="admin@fynlo.com",
            username="admin",
            password_hash=get_password_hash("admin123"),
            first_name="Admin",
            last_name="User",
            role="platform_owner",
            platform_id=platform.id,
            restaurant_id=restaurant.id
        )
        
        manager_user = User(
            email="manager@fynlo.com",
            username="manager",
            password_hash=get_password_hash("manager123"),
            first_name="Restaurant",
            last_name="Manager",
            role="restaurant_owner",
            restaurant_id=restaurant.id
        )
        
        employee_user = User(
            email="employee@fynlo.com",
            username="employee",
            password_hash=get_password_hash("employee123"),
            first_name="Restaurant",
            last_name="Employee",
            role="employee",
            restaurant_id=restaurant.id,
            pin_code="1234"
        )
        
        db.add_all([admin_user, manager_user, employee_user])
        db.commit()
        
        logger.info("✅ Sample data created successfully")
        logger.info("   Login credentials:")
        logger.info("   - Admin: admin@fynlo.com / admin123")
        logger.info("   - Manager: manager@fynlo.com / manager123")
        logger.info("   - Employee: employee@fynlo.com / employee123")
        
        db.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to create sample data: {e}")
        if 'db' in locals():
            db.rollback()
            db.close()
        return False

def create_upload_directories():
    """Create necessary upload directories"""
    try:
        upload_dir = Path(project_root) / settings.UPLOAD_DIR
        
        # Create main upload directory
        upload_dir.mkdir(exist_ok=True)
        
        # Create subdirectories
        subdirs = ['products', 'receipts', 'temp', 'qr_codes']
        for subdir in subdirs:
            (upload_dir / subdir).mkdir(exist_ok=True)
        
        logger.info(f"✅ Upload directories created at: {upload_dir}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to create upload directories: {e}")
        return False

def main():
    """Main setup function"""
    logger.info("🚀 Fynlo POS Database Setup")
    logger.info("=" * 50)
    
    # Step 1: Check PostgreSQL installation
    if not check_postgresql_installed():
        logger.info("\n💡 To install PostgreSQL:")
        logger.info("   macOS: brew install postgresql")
        logger.info("   Ubuntu: sudo apt-get install postgresql postgresql-contrib")
        logger.info("   Windows: Download from https://www.postgresql.org/download/")
        return False
    
    # Step 2: Check PostgreSQL service
    if not check_postgresql_running():
        logger.info("\n💡 To start PostgreSQL:")
        logger.info("   macOS: brew services start postgresql")
        logger.info("   Ubuntu: sudo systemctl start postgresql")
        logger.info("   Windows: Start PostgreSQL service from Services app")
        return False
    
    # Step 3: Create database and user
    if not create_database_and_user():
        return False
    
    # Step 4: Test connection
    if not test_connection():
        return False
    
    # Step 5: Run migrations
    if not run_migrations():
        return False
    
    # Step 6: Create sample data
    if not create_sample_data():
        return False
    
    # Step 7: Create upload directories
    if not create_upload_directories():
        return False
    
    logger.info("\n🎉 Database setup completed successfully!")
    logger.info("\n📋 Next steps:")
    logger.info("   1. Start the backend server: python -m uvicorn app.main:app --reload")
    logger.info("   2. Test API endpoints at: http://localhost:8000/docs")
    logger.info("   3. Connect the iOS app to test full functionality")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
