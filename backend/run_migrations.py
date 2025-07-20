#!/usr/bin/env python3
"""
Run pending database migrations
This script ensures all Alembic migrations are applied to the database
"""

import subprocess
import sys
from app.core.config import settings
from sqlalchemy import create_engine, text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_database_connection():
    """Check if we can connect to the database"""
    try:
        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            logger.info("✅ Database connection successful")
            return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False

def run_migrations():
    """Run pending Alembic migrations"""
    try:
        logger.info("🔄 Running database migrations...")
        
        # Run alembic upgrade head
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            logger.info("✅ Migrations completed successfully")
            logger.info(result.stdout)
            return True
        else:
            logger.error(f"❌ Migration failed: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error running migrations: {e}")
        return False

def check_floor_plan_column():
    """Check if floor_plan_layout column exists in restaurants table"""
    try:
        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'restaurants' 
                AND column_name = 'floor_plan_layout'
            """))
            
            if result.rowcount > 0:
                logger.info("✅ floor_plan_layout column exists")
                return True
            else:
                logger.warning("⚠️ floor_plan_layout column is missing")
                return False
                
    except Exception as e:
        logger.error(f"❌ Error checking column: {e}")
        return False

if __name__ == "__main__":
    logger.info("🚀 Starting migration check...")
    
    if not check_database_connection():
        logger.error("Cannot proceed without database connection")
        sys.exit(1)
    
    # Check if the problematic column exists
    column_exists = check_floor_plan_column()
    
    if not column_exists:
        logger.info("📝 Running migrations to add missing columns...")
        if run_migrations():
            # Verify the column was added
            if check_floor_plan_column():
                logger.info("✅ All migrations applied successfully!")
            else:
                logger.error("❌ Migration ran but column still missing")
                sys.exit(1)
        else:
            logger.error("❌ Migration failed")
            sys.exit(1)
    else:
        logger.info("✅ Database schema is up to date")