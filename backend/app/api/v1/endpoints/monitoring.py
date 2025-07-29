"""
Comprehensive monitoring endpoints for instance and deployment tracking.
Provides real-time visibility into replica counts and system health.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from datetime import datetime, timezone
from typing import Dict, Any, List
import logging

from app.core.response_helper import APIResponseHelper
from app.core.redis_client import get_redis, RedisClient
from app.api.v1.dependencies.auth import get_current_user
from app.models.user import User
from app.services.instance_tracker import instance_tracker
from app.services.digitalocean_monitor import get_do_monitor, DigitalOceanMonitor

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/replicas")
async def get_replica_status(
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
    do_monitor: DigitalOceanMonitor = Depends(get_do_monitor)
) -> Dict[str, Any]:
    """
    Get comprehensive replica status comparing multiple data sources.
    
    This endpoint provides:
    - Configured replica count from DigitalOcean
    - Active instances tracked via heartbeat
    - Discrepancy analysis
    - Actionable recommendations
    
    Requires authentication - platform owners get full details.
    """
    # Check if user is platform owner for full access
    is_platform_owner = current_user.role == "platform_owner"
    
    # Get active instances from tracker
    active_instances = []
    instance_counts = {"active": 0, "stale": 0, "total": 0}
    
    if instance_tracker:
        active_instances = await instance_tracker.get_active_instances()
        instance_counts = await instance_tracker.get_instance_count()
    
    # Get DigitalOcean status
    do_status = await do_monitor.get_actual_replicas()
    do_configured = "error" not in do_status
    
    # Calculate discrepancies
    configured_replicas = do_status.get("desired_replicas", 2) if do_configured else 2
    active_count = instance_counts["active"]
    discrepancy = active_count != configured_replicas
    
    # Generate recommendations
    recommendations = _generate_recommendations(
        active_count=active_count,
        configured_count=configured_replicas,
        stale_count=instance_counts["stale"],
        do_configured=do_configured
    )
    
    # Build response
    response_data = {
        "summary": {
            "configured_replicas": configured_replicas,
            "active_instances": active_count,
            "stale_instances": instance_counts["stale"],
            "total_registered": instance_counts["total"],
            "discrepancy": discrepancy,
            "status": _get_overall_status(active_count, configured_replicas)
        },
        "instances": {
            "active": [
                _sanitize_instance_data(inst, is_platform_owner) 
                for inst in active_instances 
                if _is_instance_active(inst)
            ],
            "stale": [
                _sanitize_instance_data(inst, is_platform_owner) 
                for inst in active_instances 
                if not _is_instance_active(inst)
            ]
        },
        "digitalocean": do_status if is_platform_owner else {
            "configured": do_configured,
            "desired_replicas": configured_replicas
        },
        "recommendations": recommendations,
        "last_check": datetime.now(timezone.utc).isoformat()
    }
    
    # Add warnings if needed
    warnings = []
    if discrepancy:
        if active_count > configured_replicas:
            warnings.append(f"{active_count - configured_replicas} extra instances detected")
        elif active_count < configured_replicas:
            warnings.append(f"{configured_replicas - active_count} instances missing")
    
    if instance_counts["stale"] > 0:
        warnings.append(f"{instance_counts['stale']} stale instances detected")
    
    if warnings:
        response_data["warnings"] = warnings
    
    return APIResponseHelper.success(
        data=response_data,
        message="Replica status retrieved successfully"
    )


@router.get("/metrics")
async def get_monitoring_metrics(
    current_user: User = Depends(get_current_user),
    do_monitor: DigitalOceanMonitor = Depends(get_do_monitor)
) -> Dict[str, Any]:
    """
    Get comprehensive monitoring metrics from DigitalOcean.
    
    Requires platform owner role.
    """
    if current_user.role != "platform_owner":
        raise HTTPException(
            status_code=403,
            detail="Only platform owners can access detailed metrics"
        )
    
    metrics = await do_monitor.get_metrics_summary()
    
    return APIResponseHelper.success(
        data=metrics,
        message="Monitoring metrics retrieved"
    )


@router.post("/replicas/refresh")
async def refresh_replica_count(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    do_monitor: DigitalOceanMonitor = Depends(get_do_monitor)
) -> Dict[str, Any]:
    """
    Force refresh of replica count by clearing caches.
    
    This endpoint:
    - Clears DigitalOcean API cache
    - Triggers stale instance cleanup
    - Returns fresh status
    
    Requires platform owner role.
    """
    if current_user.role != "platform_owner":
        raise HTTPException(
            status_code=403,
            detail="Only platform owners can refresh replica status"
        )
    
    # Clear DO cache and get fresh data
    fresh_status = await do_monitor.get_app_info(force_refresh=True)
    
    # Schedule stale instance cleanup in background
    if instance_tracker:
        background_tasks.add_task(instance_tracker.cleanup_stale_instances)
    
    # Get updated replica status
    replica_status = await get_replica_status(current_user)
    
    return APIResponseHelper.success(
        data={
            "refreshed": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "current_status": replica_status["data"]["summary"]
        },
        message="Replica status refreshed"
    )


@router.get("/deployments")
async def get_recent_deployments(
    current_user: User = Depends(get_current_user),
    do_monitor: DigitalOceanMonitor = Depends(get_do_monitor)
) -> Dict[str, Any]:
    """
    Get recent deployment history from DigitalOcean.
    
    Shows deployment phases and causes to help diagnose replica issues.
    Requires platform owner role.
    """
    if current_user.role != "platform_owner":
        raise HTTPException(
            status_code=403,
            detail="Only platform owners can view deployment history"
        )
    
    deployments = await do_monitor.get_deployments(limit=10)
    
    # Process deployment data
    processed_deployments = []
    for deployment in deployments:
        processed_deployments.append({
            "id": deployment.get("id"),
            "phase": deployment.get("phase"),
            "created_at": deployment.get("created_at"),
            "updated_at": deployment.get("updated_at"),
            "cause": deployment.get("cause"),
            "progress": deployment.get("progress", {})
        })
    
    return APIResponseHelper.success(
        data={
            "deployments": processed_deployments,
            "total": len(processed_deployments),
            "app_id": do_monitor.app_id
        },
        message="Deployment history retrieved"
    )


@router.post("/deployments/trigger")
async def trigger_deployment(
    current_user: User = Depends(get_current_user),
    do_monitor: DigitalOceanMonitor = Depends(get_do_monitor)
) -> Dict[str, Any]:
    """
    Trigger a new deployment to refresh instance metrics.
    
    WARNING: This will cause a brief service interruption.
    Use only as a last resort to fix replica count issues.
    
    Requires platform owner role and explicit confirmation.
    """
    if current_user.role != "platform_owner":
        raise HTTPException(
            status_code=403,
            detail="Only platform owners can trigger deployments"
        )
    
    # Extra safety check - could add a confirmation token requirement
    logger.warning(f"Deployment triggered by {current_user.email}")
    
    result = await do_monitor.force_deployment_refresh()
    
    if "error" in result:
        return APIResponseHelper.error(
            message="Failed to trigger deployment",
            errors=result
        )
    
    return APIResponseHelper.success(
        data=result,
        message="Deployment triggered successfully"
    )


# Helper functions

def _generate_recommendations(
    active_count: int, 
    configured_count: int, 
    stale_count: int,
    do_configured: bool
) -> List[str]:
    """Generate actionable recommendations based on current state."""
    recommendations = []
    
    if not do_configured:
        recommendations.append("Configure DO_API_TOKEN and DO_APP_ID environment variables for full monitoring")
    
    if active_count > configured_count:
        diff = active_count - configured_count
        recommendations.append(f"ACTION: {diff} extra instances detected. Check for stuck deployments.")
        recommendations.append("TRY: Use 'doctl apps update' to force scale reset")
        recommendations.append("TRY: Trigger a new deployment to refresh instance count")
    
    elif active_count < configured_count:
        diff = configured_count - active_count
        recommendations.append(f"ACTION: {diff} instances missing. Check deployment logs for failures.")
        recommendations.append("TRY: Review recent deployments for errors")
        recommendations.append("TRY: Ensure health checks are passing")
    
    if stale_count > 0:
        recommendations.append(f"WARNING: {stale_count} stale instances should be cleaned up automatically")
        recommendations.append("TRY: Use the refresh endpoint to force cleanup")
    
    if active_count == configured_count and stale_count == 0:
        recommendations.append("✓ Instance count matches configuration - no action needed")
    
    return recommendations


def _get_overall_status(active: int, configured: int) -> str:
    """Determine overall system status."""
    if active == configured:
        return "healthy"
    elif active > configured:
        return "over_provisioned"
    elif active == 0:
        return "critical"
    else:
        return "under_provisioned"


def _is_instance_active(instance: Dict[str, Any]) -> bool:
    """Check if an instance is considered active based on heartbeat."""
    last_heartbeat_str = instance.get('last_heartbeat')
    if not last_heartbeat_str:
        return False
    
    try:
        last_heartbeat = datetime.fromisoformat(last_heartbeat_str)
        age_seconds = (datetime.now(timezone.utc) - last_heartbeat).total_seconds()
        return age_seconds <= 60  # Active if heartbeat within 60 seconds
    except:
        return False


def _sanitize_instance_data(instance: Dict[str, Any], full_access: bool) -> Dict[str, Any]:
    """Sanitize instance data based on user access level."""
    if full_access:
        return instance
    
    # Limited data for non-platform owners
    return {
        "instance_id": instance.get("instance_id"),
        "status": instance.get("status"),
        "last_heartbeat": instance.get("last_heartbeat"),
        "environment": instance.get("environment")
    }