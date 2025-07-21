"""
Supabase client configuration for authentication
"""

import os
from supabase import create_client, Client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    """Get Supabase client with service role key for admin operations"""
    # Try environment variables directly if not in settings
    supabase_url = settings.SUPABASE_URL or os.getenv("SUPABASE_URL")
    supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        # Log what we're missing for debugging
        missing = []
        if not supabase_url:
            missing.append("SUPABASE_URL")
        if not supabase_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")
        
        error_msg = f"Missing environment variables: {', '.join(missing)}"
        logger.error(f"Supabase configuration error: {error_msg}")
        raise ValueError(error_msg)
    
    logger.info(f"Creating Supabase client with URL: {supabase_url[:50]}...")
    return create_client(supabase_url, supabase_key)


# Initialize the Supabase admin client
try:
    supabase_admin = get_supabase_client()
    logger.info("Supabase admin client initialized successfully")
except ValueError as e:
    # During development or if Supabase is not configured yet
    logger.warning(f"Supabase client not initialized: {e}")
    # Don't print to stdout as it might interfere with app startup
    supabase_admin = None
except Exception as e:
    # Catch any other initialization errors
    logger.error(f"Unexpected error initializing Supabase client: {type(e).__name__}: {e}")
    import traceback
    logger.debug(f"Traceback: {traceback.format_exc()}")
    supabase_admin = None