"""
Optimized Platform Settings Endpoints
Performance improvements for mobile app connectivity
"""
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
import asyncio
import json
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.responses import APIResponseHelper
from app.services.cache_service import PlatformCacheService
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory cache with TTL
_memory_cache: Dict[str, Dict[str, Any]] = {}
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

def get_from_memory_cache(key: str) -> Optional[Dict[str, Any]]:
    """Get value from memory cache if not expired"""
    if key in _memory_cache:
        cached = _memory_cache[key]
        if datetime.utcnow() < cached["expires_at"]:
            return cached["data"]
        else:
            del _memory_cache[key]
    return None

def set_memory_cache(key: str, data: Dict[str, Any]):
    """Set value in memory cache with TTL"""
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
        cached = get_from_memory_cache("service_charge")
        if cached:
            response.headers["X-Cache"] = "HIT"
            return APIResponseHelper.success(
                data={"service_charge": cached},
                message="Service charge configuration (cached)"
            )
        
        # Return defaults immediately, update cache in background
        response.headers["X-Cache"] = "MISS"
        
        # Set memory cache
        set_memory_cache("service_charge", DEFAULT_SERVICE_CHARGE)
        
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
        cached = get_from_memory_cache("payment_methods")
        if cached:
            response.headers["X-Cache"] = "HIT"
            return APIResponseHelper.success(
                data={"payment_methods": cached},
                message="Payment methods (cached)"
            )
        
        # Return defaults immediately
        response.headers["X-Cache"] = "MISS"
        
        # Set memory cache
        set_memory_cache("payment_methods", DEFAULT_PAYMENT_METHODS)
        
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
        service_charge = get_from_memory_cache("service_charge") or DEFAULT_SERVICE_CHARGE
        payment_methods = get_from_memory_cache("payment_methods") or DEFAULT_PAYMENT_METHODS
        
        all_settings = {
            "service_charge": service_charge,
            "payment_methods": payment_methods,
            "platform_info": {
                "name": "Fynlo POS",
                "version": "1.0.0",
                "support_email": "support@fynlo.com"
            }
        }
        
        response.headers["X-Cache"] = "PARTIAL"
        
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
            set_memory_cache("service_charge", cached_config)
            return
        
        # If not in Redis, we'll just keep using defaults
        # Database queries can be added here if needed in future
        
    except Exception as e:
        logger.warning(f"Background cache update failed: {e}")