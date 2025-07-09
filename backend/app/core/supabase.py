"""
Supabase client configuration for authentication
"""

from supabase import create_client, Client
from app.core.config import settings


def get_supabase_client() -> Client:
    """Get Supabase client with service role key for admin operations"""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables"
        )
    
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY
    )


# Initialize the Supabase admin client
try:
    supabase_admin = get_supabase_client()
except ValueError as e:
    # During development or if Supabase is not configured yet
    print(f"Warning: Supabase client not initialized: {e}")
    supabase_admin = None