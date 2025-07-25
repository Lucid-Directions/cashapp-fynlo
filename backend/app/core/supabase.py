"""
Supabase client configuration for authentication
"""

import os
import logging
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger(__name__)


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


# Initialize the Supabase admin client
try:
    supabase_admin = get_supabase_client()
    logger.info("✅ Supabase client initialized successfully")
except Exception as e:
    # Log the error but don't crash the app
    logger.error(f"❌ Failed to initialize Supabase client: {e}")
    supabase_admin = None