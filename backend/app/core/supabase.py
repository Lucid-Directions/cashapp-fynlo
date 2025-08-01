"""
Supabase client configuration for authentication
"""


"""
import os
import logging
from typing import Optional
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger(__name__)

# Module-level client instance
_supabase_admin: Optional[Client] = None


def get_supabase_client() -> Client:
    """Get Supabase client with service role key for admin operations"""
    # Try multiple sources for environment variables
    # 1. First try settings (pydantic-settings loads from env)
    # 2. Then try direct os.getenv
    # 3. Finally try alternate variable names
    
    supabase_url = None
    supabase_key = None
    
    # Try to get URL
    if hasattr(settings, 'SUPABASE_URL') and settings.SUPABASE_URL:
        supabase_url = settings.SUPABASE_URL
    if not supabase_url:
        supabase_url = os.getenv("SUPABASE_URL")
    
    # Try to get service role key
    if hasattr(settings, 'SUPABASE_SERVICE_ROLE_KEY') and settings.SUPABASE_SERVICE_ROLE_KEY:
        supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY
    if not supabase_key:
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_key:
        supabase_key = os.getenv("supabase_secret_key")  # Check alternate env var name
    
    # Log what we found (without exposing sensitive data)
    logger.info(f"Environment check - SUPABASE_URL: {'Found' if supabase_url else 'Missing'}")
    logger.info(f"Environment check - Service Key: {'Found' if supabase_key else 'Missing'}")
    
    if not supabase_url or not supabase_key:
        # Log which variables are missing for debugging
        missing = []
        if not supabase_url:
            missing.append("SUPABASE_URL")
        if not supabase_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY or supabase_secret_key")
        
        error_msg = f"Missing required environment variables: {', '.join(missing)}"
        logger.error(error_msg)
        
        # Log all available environment variable names (not values) for debugging
        env_vars = list(os.environ.keys())
        supabase_related = [var for var in env_vars if 'SUPA' in var.upper() or 'SECRET' in var.upper()]
        logger.info(f"Available Supabase-related env vars: {supabase_related}")
        
        raise ValueError(error_msg)
    
    logger.info(f"Initializing Supabase client with URL: {supabase_url[:30]}...")
    
    return create_client(
        supabase_url,
        supabase_key
    )


def get_admin_client() -> Optional[Client]:
    """Get or create the Supabase admin client instance"""
    global _supabase_admin
    
    if _supabase_admin is None:
        try:
            _supabase_admin = get_supabase_client()
            logger.info("✅ Supabase admin client initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Supabase admin client: {e}")
            return None
    
    return _supabase_admin


# Initialize the Supabase admin client at module load
try:
    supabase_admin = get_supabase_client()
    logger.info("✅ Supabase client initialized successfully at module load")
except Exception as e:
    # Log the error but don't crash the app
    logger.warning(f"⚠️  Failed to initialize Supabase client at module load: {e}")
    logger.warning("Supabase client will be initialized on first use")
    supabase_admin = None