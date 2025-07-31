"""
Optimized Platform Settings Endpoints
Performance improvements for mobile app connectivity
"""
from typing import Dict, Any, Optional
from fastapi import APIRouter, Response
import asyncio
from datetime import datetime, timedelta
from asyncio import Lock

from app.core.responses import APIResponseHelper
from app.services.cache_service import PlatformCacheService
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Thread-safe in-memory cache with TTL
_memory_cache: Dict[str, Dict[str, Any]] = {}
_cache_lock = Lock()
_cache_ttl = timedelta(minutes=5)

# Default configurations
DEFAULT_SERVICE_CHARGE = {
    "enabled": True,
    "rate": 12.5,
    "description": "Platform service charge",
    "currency": "GBP"
}

DEFAULT_PAYMENT_METHODS = {
    "qr_code": {
        "enabled": True,
        "fee_percentage": 1.2,
        "name": "QR Code Payment",
        "icon": "qrcode"
    },
    "card": {
        "enabled": True,
        "fee_percentage": 2.9,
        "name": "Card Payment",
        "icon": "credit-card"
    },
    "cash": {
        "enabled": True,
        "fee_percentage": 0.0,
        "name": "Cash",
        "icon": "cash"
    },
    "apple_pay": {
        "enabled": True,
        "fee_percentage": 2.9,
        "name": "Apple Pay",
        "icon": "apple"
    }
}

async def get_from_memory_cache(key: str) -> Optional[Dict[str, Any]]:
    """Get value from memory cache if not expired (thread-safe)"""
    async with _cache_lock:
        if key in _memory_cache:
            cached = _memory_cache[key]
            if datetime.utcnow() < cached["expires_at"]:
                return cached["data"]
            else:
                # Clean up expired entry
                _memory_cache.pop(key, None)
    return None

async def set_memory_cache(key: str, data: Dict[str, Any]):
    """Set value in memory cache with TTL (thread-safe)"""
    async with _cache_lock:
        _memory_cache[key] = {
            "data": data,
            "expires_at": datetime.utcnow() + _cache_ttl
        }

@router.get("/service-charge/fast")
async def get_service_charge_fast(response: Response):
    """
    Ultra-fast service charge endpoint with aggressive caching
    Returns immediately with cached or default values
    """
    try:
        # Check memory cache first
        cached = await get_from_memory_cache("service_charge")
        if cached:
            response.headers["X-Cache"] = "HIT"
            return APIResponseHelper.success(
                data={"service_charge": cached},
                message="Service charge configuration (cached)"
            )
        
        # Return defaults immediately, update cache in background
        response.headers["X-Cache"] = "MISS"
        
        # Set memory cache
        await set_memory_cache("service_charge", DEFAULT_SERVICE_CHARGE)
        
        # Schedule background cache update
        asyncio.create_task(update_service_charge_cache())
        
        return APIResponseHelper.success(
            data={"service_charge": DEFAULT_SERVICE_CHARGE},
            message="Service charge configuration"
        )
        
    except Exception as e:
        logger.error(f"Error in get_service_charge_fast: {e}")
        return APIResponseHelper.success(
            data={"service_charge": DEFAULT_SERVICE_CHARGE},
            message="Service charge configuration (fallback)"
        )

@router.get("/payment-methods/fast")
async def get_payment_methods_fast(response: Response):
    """
    Ultra-fast payment methods endpoint with aggressive caching
    """
    try:
        # Check memory cache first
        cached = await get_from_memory_cache("payment_methods")
        if cached:
            response.headers["X-Cache"] = "HIT"
            return APIResponseHelper.success(
                data={"payment_methods": cached},
                message="Payment methods (cached)"
            )
        
        # Return defaults immediately, update cache in background
        response.headers["X-Cache"] = "MISS"
        
        # Set memory cache
        await set_memory_cache("payment_methods", DEFAULT_PAYMENT_METHODS)
        
        # Schedule background cache update (same as service charge)
        asyncio.create_task(update_payment_methods_cache())
        
        return APIResponseHelper.success(
            data={"payment_methods": DEFAULT_PAYMENT_METHODS},
            message="Payment methods"
        )
        
    except Exception as e:
        logger.error(f"Error in get_payment_methods_fast: {e}")
        return APIResponseHelper.success(
            data={"payment_methods": DEFAULT_PAYMENT_METHODS},
            message="Payment methods (fallback)"
        )

@router.get("/all-settings/fast")
async def get_all_settings_fast(response: Response):
    """
    Combined endpoint to reduce number of API calls
    Returns all platform settings in one response
    """
    try:
        # Check if we have all settings cached
        service_charge_cached = await get_from_memory_cache("service_charge")
        payment_methods_cached = await get_from_memory_cache("payment_methods")
        
        # Track original cache state for header
        service_charge_was_cached = service_charge_cached is not None
        payment_methods_was_cached = payment_methods_cached is not None
        
        # Populate cache for any missing values
        if not service_charge_cached:
            await set_memory_cache("service_charge", DEFAULT_SERVICE_CHARGE)
            asyncio.create_task(update_service_charge_cache())
            service_charge_cached = DEFAULT_SERVICE_CHARGE
            
        if not payment_methods_cached:
            await set_memory_cache("payment_methods", DEFAULT_PAYMENT_METHODS)
            asyncio.create_task(update_payment_methods_cache())
            payment_methods_cached = DEFAULT_PAYMENT_METHODS
        
        all_settings = {
            "service_charge": service_charge_cached,
            "payment_methods": payment_methods_cached,
            "platform_info": {
                "name": "Fynlo POS",
                "version": "1.0.0",
                "support_email": "support@fynlo.com"
            }
        }
        
        # Set cache header based on original cache state
        if service_charge_was_cached and payment_methods_was_cached:
            response.headers["X-Cache"] = "HIT"
        elif service_charge_was_cached or payment_methods_was_cached:
            response.headers["X-Cache"] = "PARTIAL"
        else:
            response.headers["X-Cache"] = "MISS"
        
        return APIResponseHelper.success(
            data=all_settings,
            message="All platform settings"
        )
        
    except Exception as e:
        logger.error(f"Error in get_all_settings_fast: {e}")
        return APIResponseHelper.success(
            data={
                "service_charge": DEFAULT_SERVICE_CHARGE,
                "payment_methods": DEFAULT_PAYMENT_METHODS,
                "platform_info": {
                    "name": "Fynlo POS",
                    "version": "1.0.0",
                    "support_email": "support@fynlo.com"
                }
            },
            message="All platform settings (fallback)"
        )

async def update_service_charge_cache():
    """Background task to update service charge cache from database"""
    try:
        # Try to get from Redis first
        cached_config = await PlatformCacheService.get_service_charge_config()
        if cached_config:
            await set_memory_cache("service_charge", cached_config)
            return
        
        # If not in Redis, we'll just keep using defaults
        # Database queries can be added here if needed in future
        
    except Exception as e:
        logger.warning(f"Background service charge cache update failed: {e}")

async def update_payment_methods_cache():
    """Background task to update payment methods cache from database"""
    try:
        # For now, payment methods are static configuration
        # In future, this could fetch from database or Redis
        # This ensures consistency with service charge pattern
        
        # Could add database query here when payment methods become configurable
        # Example:
        # payment_config = await fetch_payment_methods_from_db()
        # if payment_config:
        #     await set_memory_cache("payment_methods", payment_config)
        
        logger.debug("Payment methods cache update completed (using defaults)")
        
    except Exception as e:
        logger.warning(f"Background payment methods cache update failed: {e}")