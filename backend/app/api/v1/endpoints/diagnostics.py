"""
Diagnostic endpoints for troubleshooting production issues
Only accessible to platform owners or with special diagnostic key
"""

import os
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime
import logging

from app.core.config import settings
from app.core.redis_client import redis_client
from app.core.database import get_db
from app.core.responses import APIResponseHelper
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter()


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, otherwise return None"""
    if not authorization:
        return None
    
    try:
        # Import here to avoid circular dependency
        from app.core.auth import get_current_user
        from fastapi import Request
        from starlette.datastructures import Headers
        
        # Create a proper mock request for the auth function
        class MockClient:
            def __init__(self):
                self.host = "diagnostic"
        
        class MockURL:
            def __init__(self):
                self.path = "/diagnostics"
        
        class MockRequest:
            def __init__(self):
                self.client = MockClient()
                self.headers = Headers({"user-agent": "diagnostic-endpoint"})
                self.url = MockURL()
        
        # Try to get the user
        return await get_current_user(MockRequest(), authorization, db)
    except Exception as e:
        # If auth fails, return None instead of raising
        logger.debug(f"Optional auth failed: {type(e).__name__}: {e}")
        return None


def verify_diagnostic_access(
    diagnostic_key: Optional[str] = None,
    current_user: Optional[User] = None
) -> bool:
    """Verify access via diagnostic key or platform owner role"""
    # Check if diagnostic key is provided and valid
    if diagnostic_key:
        expected_key = os.getenv("DIAGNOSTIC_KEY")
        if not expected_key:
            # No diagnostic key configured - deny access
            logger.warning("Diagnostic key authentication attempted but DIAGNOSTIC_KEY not configured")
            return False
        return diagnostic_key == expected_key
    
    # Check if user is platform owner
    if current_user and current_user.role == "platform_owner":
        return True
    
    return False


@router.get("/environment")
async def check_environment(
    diagnostic_key: Optional[str] = Query(None, description="Diagnostic access key"),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Check environment variables and configuration status"""
    
    # Verify access
    if not verify_diagnostic_access(diagnostic_key, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check critical environment variables
    env_status = {
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
        "timestamp": datetime.utcnow().isoformat(),
        "variables": {
            "database": {
                "configured": bool(os.getenv("DATABASE_URL")),
                "has_value": bool(settings.DATABASE_URL),
                "starts_with": settings.DATABASE_URL[:30] + "..." if settings.DATABASE_URL else None
            },
            "redis": {
                "configured": bool(os.getenv("REDIS_URL")),
                "has_value": bool(settings.REDIS_URL),
                "url_prefix": settings.REDIS_URL[:20] + "..." if settings.REDIS_URL else None,
                "is_rediss": settings.REDIS_URL.startswith("rediss://") if settings.REDIS_URL else False
            },
            "supabase": {
                "url_configured": bool(os.getenv("SUPABASE_URL")),
                "url_in_settings": bool(settings.SUPABASE_URL),
                "service_key_configured": bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
                "service_key_in_settings": bool(settings.SUPABASE_SERVICE_ROLE_KEY),
                "anon_key_configured": bool(os.getenv("SUPABASE_ANON_KEY")),
                "anon_key_in_settings": bool(settings.SUPABASE_ANON_KEY),
                "url_prefix": settings.SUPABASE_URL[:40] + "..." if settings.SUPABASE_URL else None
            },
            "platform": {
                "owner_email": settings.PLATFORM_OWNER_EMAIL,
                "owner_secret_configured": bool(os.getenv("PLATFORM_OWNER_SECRET_KEY")),
                "require_2fa": settings.PLATFORM_OWNER_REQUIRE_2FA
            }
        }
    }
    
    # Test Redis connection
    try:
        redis_ping = await redis_client.ping()
        env_status["redis_status"] = {
            "connected": redis_ping,
            "mode": "mock" if redis_client.redis is None else "real",
            "error": None
        }
    except Exception as e:
        env_status["redis_status"] = {
            "connected": False,
            "mode": "error",
            "error": str(e)
        }
    
    # Test Supabase initialization
    try:
        from app.core.supabase import supabase_admin
        env_status["supabase_status"] = {
            "initialized": supabase_admin is not None,
            "error": None
        }
    except Exception as e:
        env_status["supabase_status"] = {
            "initialized": False,
            "error": str(e)
        }
    
    return APIResponseHelper.success(data=env_status)


@router.get("/redis-test")
async def test_redis_connection(
    diagnostic_key: Optional[str] = Query(None, description="Diagnostic access key"),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Test Redis connection with detailed diagnostics"""
    
    # Verify access
    if not verify_diagnostic_access(diagnostic_key, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "redis_url": settings.REDIS_URL[:30] + "..." if settings.REDIS_URL else None,
        "tests": []
    }
    
    # Test 1: Basic ping
    try:
        ping_result = await redis_client.ping()
        results["tests"].append({
            "test": "ping",
            "success": ping_result,
            "mode": "mock" if redis_client.redis is None else "real"
        })
    except Exception as e:
        results["tests"].append({
            "test": "ping",
            "success": False,
            "error": f"{type(e).__name__}: {str(e)}"
        })
    
    # Test 2: Set/Get operation
    try:
        test_key = "diagnostic:test"
        test_value = f"test_{datetime.utcnow().isoformat()}"
        
        await redis_client.set(test_key, test_value, expire=60)
        retrieved = await redis_client.get(test_key)
        
        results["tests"].append({
            "test": "set_get",
            "success": retrieved == test_value,
            "set_value": test_value,
            "get_value": retrieved
        })
    except Exception as e:
        results["tests"].append({
            "test": "set_get",
            "success": False,
            "error": f"{type(e).__name__}: {str(e)}"
        })
    
    # Test 3: Connection info
    if redis_client.redis:
        try:
            info = await redis_client.redis.info()
            results["connection_info"] = {
                "redis_version": info.get("redis_version"),
                "connected_clients": info.get("connected_clients"),
                "used_memory_human": info.get("used_memory_human")
            }
        except Exception as e:
            results["connection_info"] = {
                "error": f"{type(e).__name__}: {str(e)}"
            }
    else:
        results["connection_info"] = {
            "status": "Using mock storage (Redis not connected)"
        }
    
    return APIResponseHelper.success(data=results)


@router.get("/supabase-test")
async def test_supabase_connection(
    diagnostic_key: Optional[str] = Query(None, description="Diagnostic access key"),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Test Supabase connection and configuration"""
    
    # Verify access
    if not verify_diagnostic_access(diagnostic_key, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "tests": []
    }
    
    # Test 1: Check environment variables
    results["tests"].append({
        "test": "environment_variables",
        "supabase_url_set": bool(os.getenv("SUPABASE_URL")),
        "service_key_set": bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
        "anon_key_set": bool(os.getenv("SUPABASE_ANON_KEY"))
    })
    
    # Test 2: Check settings
    results["tests"].append({
        "test": "settings_loaded",
        "url_in_settings": bool(settings.SUPABASE_URL),
        "service_key_in_settings": bool(settings.SUPABASE_SERVICE_ROLE_KEY),
        "anon_key_in_settings": bool(settings.SUPABASE_ANON_KEY)
    })
    
    # Test 3: Check initialization
    try:
        from app.core.supabase import supabase_admin
        results["tests"].append({
            "test": "initialization",
            "supabase_admin_initialized": supabase_admin is not None
        })
        
        # Test 4: Try to use the client
        if supabase_admin:
            try:
                # This should work even with no users
                response = supabase_admin.auth.admin.list_users(page=1, per_page=1)
                results["tests"].append({
                    "test": "api_call",
                    "success": True,
                    "message": "Successfully connected to Supabase"
                })
            except Exception as e:
                results["tests"].append({
                    "test": "api_call",
                    "success": False,
                    "error": f"{type(e).__name__}: {str(e)}"
                })
        else:
            results["tests"].append({
                "test": "api_call",
                "success": False,
                "error": "supabase_admin is None"
            })
            
    except Exception as e:
        results["tests"].append({
            "test": "initialization",
            "success": False,
            "error": f"{type(e).__name__}: {str(e)}"
        })
    
    return APIResponseHelper.success(data=results)