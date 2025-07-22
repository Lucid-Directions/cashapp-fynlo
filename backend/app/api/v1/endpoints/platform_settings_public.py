"""
Public Platform Settings Endpoints
Non-admin endpoints for reading platform configurations
"""
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import asyncio
from concurrent.futures import TimeoutError as FuturesTimeoutError

from app.core.database import get_db
from app.core.responses import APIResponseHelper
from app.services.cache_service import PlatformCacheService
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Default service charge configuration
DEFAULT_SERVICE_CHARGE = {
    "enabled": True,
    "rate": 10.0,
    "description": "Platform service charge",
    "currency": "GBP"
}

@router.get("/service-charge")
async def get_service_charge_public(
    db: Session = Depends(get_db)
):
    """
    Get service charge configuration (public endpoint)
    This endpoint doesn't require admin authentication
    """
    try:
        # First, try to get from cache
        cached_config = await PlatformCacheService.get_service_charge_config()
        if cached_config:
            logger.info("Returning cached service charge configuration")
            return APIResponseHelper.success(
                data={"service_charge": cached_config},
                message="Service charge configuration retrieved (cached)"
            )
        
        logger.info("Cache miss - querying database")
        
        # Use defaults as starting point
        result = DEFAULT_SERVICE_CHARGE.copy()
        
        # Try a quick database query with statement timeout
        db_success = False
        try:
            # Set a statement timeout at the database level
            from sqlalchemy import text
            db.execute(text("SET LOCAL statement_timeout = '500ms'"))
            
            from app.models.platform_config import PlatformConfiguration
            
            configs = db.query(PlatformConfiguration).filter(
                PlatformConfiguration.category == "service_charge",
                PlatformConfiguration.is_active == True
            ).limit(4).all()
            
            # Parse configurations if query succeeds
            for config in configs:
                if config.config_key == "platform.service_charge.enabled":
                    result["enabled"] = config.config_value.get("value", True)
                elif config.config_key == "platform.service_charge.rate":
                    result["rate"] = config.config_value.get("value", 12.5)
                elif config.config_key == "platform.service_charge.description":
                    result["description"] = config.config_value.get("value", "Platform service charge")
                elif config.config_key == "platform.service_charge.currency":
                    result["currency"] = config.config_value.get("value", "GBP")
            
            db_success = True
                    
        except Exception as e:
            # If database query fails or times out, use defaults
            logger.warning(f"Database query failed, using defaults: {e}")
        finally:
            # Always reset the timeout for the connection
            try:
                db.execute(text("RESET statement_timeout"))
            except Exception as reset_error:
                logger.warning(f"Failed to reset statement timeout: {reset_error}")
        
        # Cache the result if database query was successful
        if db_success:
            try:
                await PlatformCacheService.set_service_charge_config(result)
            except Exception as cache_error:
                logger.warning(f"Failed to cache configuration: {cache_error}")
        
        return APIResponseHelper.success(
            data={"service_charge": result},
            message="Service charge configuration retrieved"
        )
        
    except Exception as e:
        logger.error(f"Error in get_service_charge_public: {e}")
        # Always return a valid response instead of timing out
        return APIResponseHelper.success(
            data={"service_charge": DEFAULT_SERVICE_CHARGE},
            message="Service charge configuration (default)"
        )

@router.get("/payment-methods")
async def get_payment_methods_public():
    """
    Get available payment methods (public endpoint)
    """
    try:
        payment_methods = {
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
        
        return APIResponseHelper.success(
            data={"payment_methods": payment_methods},
            message="Payment methods retrieved"
        )
        
    except Exception as e:
        logger.error(f"Error in get_payment_methods_public: {e}")
        raise HTTPException(status_code=500, detail=str(e))