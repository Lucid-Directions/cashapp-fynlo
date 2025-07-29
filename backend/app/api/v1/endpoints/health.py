"""
Health monitoring endpoints for tracking instance status and system health.
"""

from fastapi import APIRouter, Request, Depends
from datetime import datetime, timezone
import os
import platform
import socket
import psutil
from typing import Dict, Any, Optional
import logging

from app.core.response_helper import APIResponseHelper
from app.core.redis_client import get_redis, RedisClient
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)

router = APIRouter()

# Instance startup time for uptime calculation
INSTANCE_START_TIME = datetime.now(timezone.utc)

def get_instance_id() -> str:
    """Generate a unique instance ID based on hostname and environment."""
    hostname = socket.gethostname()
    # In container environments, hostname might be the container ID
    # Also check for DigitalOcean specific environment variables
    pod_name = os.environ.get("POD_NAME", "")
    do_app_id = os.environ.get("DO_APP_ID", "")
    
    if pod_name:
        return pod_name
    elif do_app_id and hostname:
        return f"{do_app_id}-{hostname}"
    else:
        return hostname


@router.get("/detailed")
async def health_detailed(
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis)
) -> Dict[str, Any]:
    """
    Detailed health check with comprehensive instance and system information.
    
    Returns:
        - Instance identification details
        - Environment configuration
        - System resource usage
        - Connection statistics
        - Service health status
    """
    current_time = datetime.now(timezone.utc)
    uptime_seconds = (current_time - INSTANCE_START_TIME).total_seconds()
    
    # Get system metrics
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # Check database health
    db_healthy = False
    db_latency_ms = None
    try:
        start = datetime.now()
        result = await db.execute(text("SELECT 1"))
        await db.commit()
        db_healthy = result.scalar() == 1
        db_latency_ms = (datetime.now() - start).total_seconds() * 1000
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
    
    # Check Redis health
    redis_healthy = False
    redis_latency_ms = None
    try:
        start = datetime.now()
        test_key = f"health_check_{get_instance_id()}"
        await redis.set(test_key, "healthy", expire=10)
        value = await redis.get(test_key)
        redis_healthy = value == "healthy"
        redis_latency_ms = (datetime.now() - start).total_seconds() * 1000
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
    
    # Get active connections count (if available from app state)
    active_connections = 0
    if hasattr(request.app.state, 'connections'):
        active_connections = len(request.app.state.connections)
    
    health_data = {
        "status": "healthy" if db_healthy and redis_healthy else "degraded",
        "timestamp": current_time.isoformat(),
        "instance": {
            "id": get_instance_id(),
            "hostname": socket.gethostname(),
            "pod_name": os.environ.get("POD_NAME", "not_set"),
            "node_name": os.environ.get("NODE_NAME", "not_set"),
            "namespace": os.environ.get("POD_NAMESPACE", "default"),
            "container_id": os.environ.get("HOSTNAME", "not_set"),
            "digitalocean": {
                "app_id": os.environ.get("DO_APP_ID", "not_set"),
                "app_name": os.environ.get("DO_APP_NAME", "not_set"),
                "region": os.environ.get("DO_REGION", "not_set"),
                "deployment_id": os.environ.get("DO_DEPLOYMENT_ID", "not_set"),
                "component_name": os.environ.get("DO_COMPONENT_NAME", "backend")
            }
        },
        "environment": {
            "app_env": os.environ.get("APP_ENV", "unknown"),
            "environment": os.environ.get("ENVIRONMENT", "unknown"),
            "app_version": os.environ.get("APP_VERSION", "unknown"),
            "git_commit": os.environ.get("GIT_COMMIT", "unknown"),
            "build_time": os.environ.get("BUILD_TIME", "unknown")
        },
        "system": {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "uptime_seconds": int(uptime_seconds),
            "uptime_human": _format_uptime(int(uptime_seconds)),
            "cpu_count": psutil.cpu_count(),
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory": {
                "total_mb": memory.total // (1024 * 1024),
                "available_mb": memory.available // (1024 * 1024),
                "used_mb": memory.used // (1024 * 1024),
                "percent": memory.percent
            },
            "disk": {
                "total_gb": disk.total // (1024 * 1024 * 1024),
                "used_gb": disk.used // (1024 * 1024 * 1024),
                "free_gb": disk.free // (1024 * 1024 * 1024),
                "percent": disk.percent
            }
        },
        "connections": {
            "active_websocket_connections": active_connections,
            "database": {
                "healthy": db_healthy,
                "latency_ms": db_latency_ms
            },
            "redis": {
                "healthy": redis_healthy,
                "latency_ms": redis_latency_ms
            }
        },
        "services": {
            "database": "healthy" if db_healthy else "unhealthy",
            "redis": "healthy" if redis_healthy else "unhealthy",
            "storage": await _check_storage_health()
        }
    }
    
    return APIResponseHelper.success(
        data=health_data,
        message="Detailed health information retrieved"
    )


@router.get("/instances")
async def health_instances(
    redis: RedisClient = Depends(get_redis)
) -> Dict[str, Any]:
    """
    List all active instances registered in the system.
    
    This endpoint shows:
    - Desired replica count (from environment)
    - Currently registered instances
    - Instance details and last heartbeat
    """
    desired_replicas = int(os.environ.get("DESIRED_REPLICAS", "2"))
    
    # Get all registered instances from Redis
    registered_instances = []
    instance_pattern = "fynlo:instances:*"
    
    try:
        # Scan for all instance keys
        if redis.redis:  # Real Redis
            async for key in redis.redis.scan_iter(match=instance_pattern):
                instance_data = await redis.redis.hgetall(key)
                if instance_data:
                    # Convert bytes to strings if needed
                    instance_info = {
                        k.decode() if isinstance(k, bytes) else k: 
                        v.decode() if isinstance(v, bytes) else v 
                        for k, v in instance_data.items()
                    }
                    
                    # Calculate time since last heartbeat
                    if 'last_heartbeat' in instance_info:
                        last_heartbeat = datetime.fromisoformat(instance_info['last_heartbeat'])
                        time_since_heartbeat = (datetime.now(timezone.utc) - last_heartbeat).total_seconds()
                        instance_info['seconds_since_heartbeat'] = int(time_since_heartbeat)
                        instance_info['is_stale'] = time_since_heartbeat > 60  # Consider stale after 60s
                    
                    registered_instances.append(instance_info)
        else:
            # Mock Redis fallback
            logger.warning("Using mock Redis, instance tracking not available")
    except Exception as e:
        logger.error(f"Error fetching instances: {e}")
    
    # Sort instances by last heartbeat (most recent first)
    registered_instances.sort(
        key=lambda x: x.get('last_heartbeat', ''), 
        reverse=True
    )
    
    # Analyze discrepancies
    active_count = len([i for i in registered_instances if not i.get('is_stale', False)])
    discrepancy = active_count != desired_replicas
    
    instance_data = {
        "desired_replicas": desired_replicas,
        "registered_instances": registered_instances,
        "active_instances": active_count,
        "total_registered": len(registered_instances),
        "discrepancy": discrepancy,
        "last_check": datetime.now(timezone.utc).isoformat(),
        "current_instance": {
            "id": get_instance_id(),
            "is_registered": any(
                i.get('instance_id') == get_instance_id() 
                for i in registered_instances
            )
        }
    }
    
    # Add warnings if there are issues
    warnings = []
    if discrepancy:
        if active_count > desired_replicas:
            warnings.append(f"WARNING: {active_count - desired_replicas} extra instances detected")
        elif active_count < desired_replicas:
            warnings.append(f"WARNING: {desired_replicas - active_count} instances missing")
    
    stale_count = len([i for i in registered_instances if i.get('is_stale', False)])
    if stale_count > 0:
        warnings.append(f"WARNING: {stale_count} stale instances detected (no heartbeat in 60s)")
    
    if warnings:
        instance_data['warnings'] = warnings
    
    return APIResponseHelper.success(
        data=instance_data,
        message="Instance information retrieved"
    )


@router.get("/ready")
async def health_ready(
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis)
) -> Dict[str, Any]:
    """
    Kubernetes/container readiness probe endpoint.
    
    Returns 200 if the instance is ready to serve traffic.
    Returns 503 if any critical service is unavailable.
    """
    # Check database
    try:
        result = await db.execute(text("SELECT 1"))
        await db.commit()
        db_ready = result.scalar() == 1
    except:
        db_ready = False
    
    # Check Redis
    try:
        await redis.set("readiness_check", "1", expire=5)
        redis_ready = await redis.get("readiness_check") == "1"
    except:
        redis_ready = False
    
    if db_ready and redis_ready:
        return APIResponseHelper.success(
            data={"ready": True, "services": {"database": "ready", "redis": "ready"}},
            message="Instance is ready"
        )
    else:
        return APIResponseHelper.error(
            message="Instance not ready",
            status_code=503,
            errors={
                "database": "not ready" if not db_ready else "ready",
                "redis": "not ready" if not redis_ready else "ready"
            }
        )


@router.get("/live")
async def health_live() -> Dict[str, Any]:
    """
    Kubernetes/container liveness probe endpoint.
    
    Simple check that the application is running.
    Returns 200 if the application is alive.
    """
    return APIResponseHelper.success(
        data={
            "alive": True,
            "instance_id": get_instance_id(),
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        message="Instance is alive"
    )


# Helper functions

def _format_uptime(seconds: int) -> str:
    """Format uptime seconds into human-readable string."""
    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    minutes = (seconds % 3600) // 60
    seconds = seconds % 60
    
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    if seconds > 0 or not parts:
        parts.append(f"{seconds}s")
    
    return " ".join(parts)


async def _check_storage_health() -> str:
    """Check if storage service (DigitalOcean Spaces) is healthy."""
    # This is a placeholder - implement actual storage health check if needed
    # For now, we'll assume it's healthy if the environment variables are set
    if os.environ.get("SPACES_ACCESS_KEY_ID") and os.environ.get("SPACES_SECRET_ACCESS_KEY"):
        return "healthy"
    return "not_configured"