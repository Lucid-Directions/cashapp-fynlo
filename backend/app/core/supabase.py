"""
Supabase client configuration for authentication
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
    # Check both settings and direct environment variables
    supabase_url = settings.SUPABASE_URL or os.getenv("SUPABASE_URL")
    supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        # Log which variables are missing for debugging
        missing = []
        if not supabase_url:
            missing.append("SUPABASE_URL")
        if not supabase_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")
        
        error_msg = f"Missing required environment variables: {', '.join(missing)}"
        logger.error(error_msg)
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
    logger.error(f"❌ Failed to initialize Supabase client at module load: {e}")
    supabase_admin = None
    
    # Try to get it from the getter function as a fallback
    supabase_admin = get_admin_client()