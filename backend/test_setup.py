#!/usr/bin/env python3
"""
Quick test script to verify backend setup and dependencies
"""

import sys
import subprocess

def check_python_version():
    """Check Python version"""
    logger.info(f"Python version: {sys.version}")
    if sys.version_info < (3, 11):
        logger.warning("⚠️  Warning: Python 3.11+ recommended")
    else:
        logger.info("✅ Python version OK")

def install_dependencies():
    """Install required dependencies"""
    logger.info("\n📦 Installing dependencies...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                      check=True, capture_output=True, text=True)
        logger.info("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Failed to install dependencies: {e}")
        logger.error(f"Error output: {e.stderr}")
        return False

def test_imports():
    """Test critical imports"""
    logger.info("\n🔍 Testing imports...")
    
    try:
        from app.core.config import settings
        logger.info("✅ Config loaded")
    except Exception as e:
        logger.error(f"❌ Config failed: {e}")
        return False
    
    try:
        from app.core.database import Base
        logger.info("✅ Database models loaded")
    except Exception as e:
        logger.error(f"❌ Database models failed: {e}")
        return False
    
    try:
        from app.main import app
        logger.info("✅ FastAPI app loaded")
    except Exception as e:
        logger.error(f"❌ FastAPI app failed: {e}")
        return False
    
    return True

def test_database_connection():
    """Test database connection"""
    logger.info("\n🗄️ Testing database connection...")
    
    try:
        import psycopg2
        from app.core.config import settings
        
        conn = psycopg2.connect(settings.DATABASE_URL)
        conn.close()
        logger.info("✅ Database connection successful")
        return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        logger.info("💡 Make sure PostgreSQL is running and database is created")
        return False

def test_redis_connection():
    """Test Redis connection"""
    logger.info("\n🚀 Testing Redis connection...")
    
    try:
        import redis
        from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

        
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        logger.info("✅ Redis connection successful")
        return True
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
        logger.info("💡 Make sure Redis is running")
        return False

if __name__ == "__main__":
    logger.info("🚀 Fynlo POS Backend Setup Test")
    logger.info("=" * 40)
    
    check_python_version()
    
    if not install_dependencies():
        sys.exit(1)
    
    if not test_imports():
        sys.exit(1)
    
    if not test_database_connection():
        logger.error("⚠️  Database connection failed - you may need to run setup script")
    
    if not test_redis_connection():
        logger.error("⚠️  Redis connection failed - you may need to start Redis")
    
    logger.info("\n🎉 Backend setup test completed!")
    logger.info("\n📋 Next steps:")
    logger.info("1. Ensure PostgreSQL and Redis are running")
    logger.info("2. Run: alembic revision --autogenerate -m 'Initial migration'")
    logger.info("3. Run: alembic upgrade head")
    logger.info("4. Start server: uvicorn app.main:app --reload")
