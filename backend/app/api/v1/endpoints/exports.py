"""
Export API endpoints for Fynlo POS - Portal export functionality
TEMPORARILY DISABLED DUE TO MISSING DEPENDENCIES
"""

from fastapi import APIRouter, HTTPException
from app.core.responses import APIResponseHelper

router = APIRouter()

@router.get("/menu/{restaurant_id}/export")
async def export_menu_disabled(restaurant_id: str):
    """Temporarily disabled endpoint"""
    return APIResponseHelper.error(
        message="Export functionality is temporarily unavailable. Please try again later.",
        status_code=503
    )

@router.get("/reports/{restaurant_id}/export")
async def export_report_disabled(restaurant_id: str):
    """Temporarily disabled endpoint"""
    return APIResponseHelper.error(
        message="Export functionality is temporarily unavailable. Please try again later.",
        status_code=503
    )

@router.post("/menu/{restaurant_id}/import")
async def import_menu_disabled(restaurant_id: str):
    """Temporarily disabled endpoint"""
    return APIResponseHelper.error(
        message="Import functionality is temporarily unavailable. Please try again later.",
        status_code=503
    )