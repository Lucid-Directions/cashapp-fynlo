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
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Default service charge configuration
DEFAULT_SERVICE_CHARGE = {
    "enabled": True,
    "rate": 12.5,
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
        # Use asyncio timeout to prevent long-running queries
        async def get_config_with_timeout():
            try:
                # Simple direct query without complex service logic
                from app.models.platform_config import PlatformConfiguration
                
                configs = db.query(PlatformConfiguration).filter(
                    PlatformConfiguration.category == "service_charge",
                    PlatformConfiguration.is_active == True
                ).limit(10).all()
                
                result = DEFAULT_SERVICE_CHARGE.copy()
                
                # Parse configurations
                for config in configs:
                    if config.config_key == "platform.service_charge.enabled":
                        result["enabled"] = config.config_value.get("value", True)
                    elif config.config_key == "platform.service_charge.rate":
                        result["rate"] = config.config_value.get("value", 12.5)
                    elif config.config_key == "platform.service_charge.description":
                        result["description"] = config.config_value.get("value", "Platform service charge")
                    elif config.config_key == "platform.service_charge.currency":
                        result["currency"] = config.config_value.get("value", "GBP")
                
                return result
                
            except Exception as e:
                logger.warning(f"Error fetching service charge config: {e}")
                return DEFAULT_SERVICE_CHARGE
        
        # Set a 2-second timeout for the database query
        try:
            result = await asyncio.wait_for(get_config_with_timeout(), timeout=2.0)
        except asyncio.TimeoutError:
            logger.warning("Service charge query timed out, using defaults")
            result = DEFAULT_SERVICE_CHARGE
        
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