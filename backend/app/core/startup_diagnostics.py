"""
Startup diagnostics for production debugging
Logs critical configuration status at application startup
"""

import os
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def log_startup_diagnostics():
    """Log diagnostic information at startup"""
    logger.info("="*60)
    logger.info("🚀 FYNLO POS STARTUP DIAGNOSTICS")
    logger.info("="*60)
    
    # Environment info
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"Base URL: {settings.BASE_URL}")
    
    # Database configuration
    db_configured = bool(os.getenv("DATABASE_URL"))
    logger.info(f"Database URL configured: {db_configured}")
    if db_configured:
        db_prefix = settings.DATABASE_URL[:30] if settings.DATABASE_URL else "None"
        logger.info(f"Database URL prefix: {db_prefix}...")
    
    # Redis configuration
    redis_configured = bool(os.getenv("REDIS_URL"))
    logger.info(f"Redis URL configured: {redis_configured}")
    if redis_configured:
        redis_prefix = settings.REDIS_URL[:30] if settings.REDIS_URL else "None"
        is_ssl = settings.REDIS_URL.startswith("rediss://") if settings.REDIS_URL else False
        logger.info(f"Redis URL prefix: {redis_prefix}...")
        logger.info(f"Redis using SSL: {is_ssl}")
    
    # Supabase configuration
    supabase_url_configured = bool(os.getenv("SUPABASE_URL"))
    supabase_key_configured = bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    logger.info(f"Supabase URL configured: {supabase_url_configured}")
    logger.info(f"Supabase Service Role Key configured: {supabase_key_configured}")
    
    if supabase_url_configured:
        url_prefix = settings.SUPABASE_URL[:40] if settings.SUPABASE_URL else "None"
        logger.info(f"Supabase URL prefix: {url_prefix}...")
    
    # Payment provider configuration
    stripe_configured = bool(os.getenv("STRIPE_SECRET_KEY"))
    sumup_configured = bool(os.getenv("SUMUP_API_KEY"))
    logger.info(f"Stripe configured: {stripe_configured}")
    logger.info(f"SumUp configured: {sumup_configured}")
    
    # CORS configuration
    logger.info(f"CORS origins count: {len(settings.CORS_ORIGINS) if hasattr(settings, 'CORS_ORIGINS') else 0}")
    
    # Feature flags
    spaces_enabled = bool(settings.ENABLE_SPACES_STORAGE) if hasattr(settings, 'ENABLE_SPACES_STORAGE') else False
    logger.info(f"DigitalOcean Spaces storage: {spaces_enabled}")
    
    logger.info("="*60)
    
    # Check for critical missing configurations
    critical_issues = []
    
    if settings.ENVIRONMENT == "production":
        if not db_configured:
            critical_issues.append("DATABASE_URL not configured")
        if not redis_configured:
            critical_issues.append("REDIS_URL not configured (will use mock storage)")
        if not supabase_url_configured or not supabase_key_configured:
            critical_issues.append("Supabase authentication not fully configured")
    
    if critical_issues:
        logger.warning("⚠️  CRITICAL CONFIGURATION ISSUES:")
        for issue in critical_issues:
            logger.warning(f"  - {issue}")
        logger.warning("="*60)
    else:
        logger.info("✅ All critical configurations appear to be set")
        logger.info("="*60)
    
    # Test Supabase initialization
    try:
        from app.core.supabase import supabase_admin
        if supabase_admin:
            logger.info("✅ Supabase admin client initialized successfully")
        else:
            logger.warning("⚠️  Supabase admin client is None")
    except Exception as e:
        logger.error(f"❌ Error importing Supabase: {type(e).__name__}: {e}")