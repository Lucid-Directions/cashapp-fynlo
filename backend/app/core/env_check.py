"""
Environment variable validation and debugging
"""
import os
import logging

logger = logging.getLogger(__name__)

def check_environment_variables():
    """Check and log environment variables for debugging deployment issues"""
    
    # Check DATABASE_URL
    database_url = os.getenv("DATABASE_URL", "")
    if database_url:
        # Log the protocol only for security
        protocol = database_url.split("://")[0] if "://" in database_url else "unknown"
        logger.info(f"DATABASE_URL protocol: {protocol}")
        
        if protocol.startswith("redis"):
            logger.error("🚨 DATABASE_URL is set to a Redis URL instead of PostgreSQL!")
            logger.error("Please check your DigitalOcean environment variables")
            logger.error("DATABASE_URL should be postgresql://...")
            logger.error("REDIS_URL should be redis(s)://...")
    else:
        logger.warning("DATABASE_URL is not set")
    
    # Check REDIS_URL
    redis_url = os.getenv("REDIS_URL", "")
    if redis_url:
        protocol = redis_url.split("://")[0] if "://" in redis_url else "unknown"
        logger.info(f"REDIS_URL protocol: {protocol}")
        
        if protocol.startswith("postgres"):
            logger.error("🚨 REDIS_URL is set to a PostgreSQL URL instead of Redis!")
            logger.error("Please check your DigitalOcean environment variables")
    else:
        logger.info("REDIS_URL is not set (will use in-memory fallback)")
    
    # Check for common mixups
    if database_url and redis_url:
        if database_url == redis_url:
            logger.error("🚨 DATABASE_URL and REDIS_URL are set to the same value!")
            logger.error("These must be different services")
    
    # Log other important environment variables
    logger.info(f"ENVIRONMENT: {os.getenv('ENVIRONMENT', 'not set')}")
    logger.info(f"APP_ENV: {os.getenv('APP_ENV', 'not set')}")
    logger.info(f"PORT: {os.getenv('PORT', 'not set')}")
    
    # Check Supabase configuration
    supabase_url = os.getenv("SUPABASE_URL", "")
    if supabase_url:
        logger.info("SUPABASE_URL is configured")
    else:
        logger.warning("SUPABASE_URL is not set")