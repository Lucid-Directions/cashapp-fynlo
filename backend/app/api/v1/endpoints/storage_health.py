"""
Storage Health Check API endpoints
Monitor DigitalOcean Spaces integration status
"""

from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.models import User
from app.core.responses import APIResponseHelper
from app.services.storage_service import storage_service
from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def storage_health_check(current_user: User = Depends(get_current_user)):
    """
    Check storage service health and configuration
    Requires authentication to prevent information disclosure
    """

    # Only allow platform owners to check health
    if current_user.role != "platform_owner":
        return APIResponseHelper.error(message="Access denied", status_code=403)

    # Get health status
    health_status = await storage_service.check_health()

    # Add configuration info (without sensitive data)
    config_info = {
        "spaces_enabled": settings.ENABLE_SPACES_STORAGE,
        "bucket_name": settings.SPACES_BUCKET if storage_service.enabled else None,
        "region": settings.SPACES_REGION if storage_service.enabled else None,
        "cdn_configured": bool(settings.CDN_ENDPOINT),
        "max_file_size": f"{settings.MAX_FILE_SIZE / (1024*1024):.1f} MB",
        "allowed_file_types": settings.ALLOWED_FILE_TYPES.split(","),
    }

    return APIResponseHelper.success(
        data={"storage_health": health_status, "configuration": config_info},
        message="Storage health check completed",
    )


@router.get("/files/count")
async def get_file_count(
    prefix: str = "", current_user: User = Depends(get_current_user)
):
    """
    Get count of files in Spaces storage
    """

    # Only allow platform owners or restaurant owners
    if current_user.role not in ["platform_owner", "restaurant_owner"]:
        return APIResponseHelper.error(message="Access denied", status_code=403)

    if not storage_service.enabled:
        return APIResponseHelper.error(
            message="Spaces storage not enabled", status_code=503
        )

    try:
        # Restrict prefix for non-platform owners
        if current_user.role != "platform_owner":
            if hasattr(current_user, "restaurant_id") and current_user.restaurant_id:
                # Restaurant owners see their restaurant's files
                prefix = f"uploads/restaurant_{current_user.restaurant_id}/"
            else:
                # Other users see only their own files
                prefix = f"uploads/user_{current_user.id}/"

        # List files with limit to get count
        files = await storage_service.list_files(prefix=prefix, limit=1000)

        return APIResponseHelper.success(
            data={
                "file_count": len(files),
                "prefix": prefix,
                "storage_type": "spaces" if storage_service.enabled else "local",
            },
            message="File count retrieved successfully",
        )

    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to get file count: {str(e)}", status_code=500
        )
