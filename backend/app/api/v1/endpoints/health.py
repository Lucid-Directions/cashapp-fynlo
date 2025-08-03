"""
Health monitoring endpoints for tracking instance status and system health.
Enhanced with security best practices and proper authentication.
"""

from fastapi import APIRouter, Request, Depends
from datetime import datetime, timezone
import os
import platform
import socket
import psutil
import secrets
from typing import Dict, Any
import logging

from app.core.response_helper import APIResponseHelper
from app.core.redis_client import get_redis, RedisClient, get_redis_health
from app.core.security import (
    SafeEnvironmentFilter,
    SecurityLevel,
    InputValidator,
    HealthDetailedQueryParams,
)
from app.core.database import get_db
from app.middleware.rate_limit_middleware import limiter, DEFAULT_RATE
from app.core.auth import get_current_user
from app.core.database import User
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

router = APIRouter()

# Instance startup time for uptime calculation
INSTANCE_START_TIME = datetime.now(timezone.utc)


def get_instance_id() -> str:
    """Generate a unique instance ID based on hostname and environment with random suffix."""
    hostname = socket.gethostname()
    # In container environments, hostname might be the container ID
    # Also check for DigitalOcean specific environment variables
    pod_name = os.environ.get("POD_NAME", "")
    do_app_id = os.environ.get("DO_APP_ID", "")

    # Generate 8-character random suffix for security
    random_suffix = secrets.token_hex(4)

    if pod_name:
        # Validate pod name with random suffix
        instance_id = f"{pod_name}-{random_suffix}"
        try:
            return InputValidator.validate_instance_id(instance_id)
        except ValueError:
            logger.warning(
                f"Invalid pod name format: {pod_name}, falling back to hostname"
            )

    if do_app_id and hostname:
        instance_id = f"{do_app_id}-{hostname}-{random_suffix}"
        try:
            return InputValidator.validate_instance_id(instance_id)
        except ValueError:
            logger.warning(
                f"Invalid instance ID format: {instance_id}, using hostname only"
            )

    # Validate hostname with random suffix
    instance_id = f"{hostname}-{random_suffix}"
    try:
        return InputValidator.validate_instance_id(instance_id)
    except ValueError:
        # If hostname is invalid, generate a safe default with random suffix
        return f"instance-unknown-{random_suffix}"


@router.get("/")
@limiter.limit("1000/minute")  # Very high limit for load balancer health checks
async def health_basic(request: Request):
    """
    Basic health check endpoint - no authentication required.
    Returns minimal information for load balancer health checks.

    This endpoint is designed to be extremely fast and lightweight.
    """
    return APIResponseHelper.success(
        data={
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "fynlo-backend",
        },
        message="Service is healthy",
    )


@router.get("/detailed")
@limiter.limit(DEFAULT_RATE)
async def health_detailed(
    request: Request,
    query_params: HealthDetailedQueryParams = Depends(),
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
    current_user: User = Depends(get_current_user),  # Now requires authentication
) -> Dict[str, Any]:
    """
    Detailed health check with comprehensive instance and system information.

    Requires authentication to prevent information disclosure.

    Returns:
        - Instance identification details
        - Filtered environment configuration
        - System resource usage (if requested)
        - Connection statistics
        - Service health status
    """
    current_time = datetime.now(timezone.utc)
    uptime_seconds = (current_time - INSTANCE_START_TIME).total_seconds()

    # Determine security level based on user role
    security_level = SecurityLevel.AUTHENTICATED
    if current_user.role == "platform_owner":
        security_level = SecurityLevel.PLATFORM_OWNER
    elif current_user.role in ["admin", "manager"]:
        security_level = SecurityLevel.ADMIN

    # Get filtered environment variables based on security level
    safe_environment = SafeEnvironmentFilter.get_safe_environment(security_level)

    # Check database health
    db_healthy = False
    db_latency_ms = None
    db_error = None
    try:
        start = datetime.now()
        result = db.execute(text("SELECT 1"))
        db.commit()
        db_healthy = result.scalar() == 1
        db_latency_ms = (datetime.now() - start).total_seconds() * 1000
    except SQLAlchemyError as e:
        logger.error(f"Database health check failed: {type(e).__name__}")
        db_error = type(e).__name__  # Don't expose full error details
    except Exception as e:
        logger.error(f"Unexpected database error: {type(e).__name__}")
        db_error = "UnexpectedError"

    # Check Redis health with enhanced monitoring
    redis_healthy = False
    redis_latency_ms = None
    redis_error = None
    redis_health_details = await get_redis_health()

    try:
        start = datetime.now()
        test_key = f"health_check_{get_instance_id()}"
        await redis.set(test_key, "healthy", expire=10)
        value = await redis.get(test_key)
        redis_healthy = value == "healthy"
        redis_latency_ms = (datetime.now() - start).total_seconds() * 1000
    except Exception as e:
        logger.error(f"Redis health check failed: {type(e).__name__}")
        redis_error = type(e).__name__

    # Get active connections count (if available from app state)
    active_connections = 0
    if hasattr(request.app.state, "connections"):
        active_connections = len(request.app.state.connections)

    # Build health response
    health_data = {
        "status": "healthy" if db_healthy and redis_healthy else "degraded",
        "timestamp": current_time.isoformat(),
        "instance": {
            "id": get_instance_id(),
            "hostname": socket.gethostname(),
            "uptime_seconds": int(uptime_seconds),
            "uptime_human": _format_uptime(int(uptime_seconds)),
        },
        "environment": safe_environment,  # Filtered based on security level
        "connections": {
            "active_websocket_connections": active_connections,
            "database": {
                "healthy": db_healthy,
                "latency_ms": db_latency_ms,
                "error": db_error,
            },
            "redis": {
                "healthy": redis_healthy,
                "latency_ms": redis_latency_ms,
                "error": redis_error,
                "circuit_state": redis_health_details.get("circuit_state"),
                "failure_count": redis_health_details.get("failure_count"),
                "is_mock": redis_health_details.get("is_mock", False),
            },
        },
        "services": {
            "database": "healthy" if db_healthy else "unhealthy",
            "redis": redis_health_details.get("status", "unknown"),
            "storage": await _check_storage_health(),
        },
    }

    # Only include system metrics if requested and user has sufficient privileges
    if query_params.include_system and current_user.role in ["platform_owner", "admin"]:
        try:
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage("/")

            health_data["system"] = {
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "cpu_count": psutil.cpu_count(),
                "cpu_percent": psutil.cpu_percent(interval=0.1),
                "memory": {
                    "total_mb": memory.total // (1024 * 1024),
                    "available_mb": memory.available // (1024 * 1024),
                    "used_mb": memory.used // (1024 * 1024),
                    "percent": memory.percent,
                },
                "disk": {
                    "total_gb": disk.total // (1024 * 1024 * 1024),
                    "used_gb": disk.used // (1024 * 1024 * 1024),
                    "free_gb": disk.free // (1024 * 1024 * 1024),
                    "percent": disk.percent,
                },
            }
        except Exception as e:
            logger.error(f"Failed to collect system metrics: {type(e).__name__}")
            health_data["system"] = {"error": "Failed to collect metrics"}

    return APIResponseHelper.success(
        data=health_data, message="Detailed health information retrieved"
    )


@router.get("/instances")
@limiter.limit(DEFAULT_RATE)
async def health_instances(
    request: Request,
    redis: RedisClient = Depends(get_redis),
    current_user: User = Depends(get_current_user),  # Now requires authentication
) -> Dict[str, Any]:
    """
    List all active instances registered in the system.

    This endpoint shows:
    - Desired replica count (from environment)
    - Currently registered instances
    - Instance details and last heartbeat

    Note: Sensitive instance details are filtered for non-authenticated users.
    """
    desired_replicas = int(os.environ.get("DESIRED_REPLICAS", "2"))

    # Get all registered instances from Redis
    registered_instances = []
    instance_pattern = "fynlo:instances:*"

    # Validate Redis pattern
    try:
        instance_pattern = InputValidator.validate_redis_pattern(instance_pattern)
    except ValueError as e:
        logger.error(f"Invalid Redis pattern: {e}")
        return APIResponseHelper.error(
            message="Invalid instance pattern", errors={"pattern": str(e)}
        )

    try:
        # Scan for all instance keys with pagination
        if redis.redis:  # Real Redis
            cursor = 0
            while True:
                cursor, keys = await redis.redis.scan(
                    cursor=cursor,
                    match=instance_pattern,
                    count=100,  # Process in batches
                )

                for key in keys:
                    instance_data = await redis.redis.hgetall(key)
                    if instance_data:
                        # Convert bytes to strings if needed
                        instance_info = {
                            k.decode() if isinstance(k, bytes) else k: (
                                v.decode() if isinstance(v, bytes) else v
                            )
                            for k, v in instance_data.items()
                        }

                        # Calculate time since last heartbeat
                        if "last_heartbeat" in instance_info:
                            try:
                                last_heartbeat = datetime.fromisoformat(
                                    instance_info["last_heartbeat"]
                                )
                                time_since_heartbeat = (
                                    datetime.now(timezone.utc) - last_heartbeat
                                ).total_seconds()
                                instance_info["seconds_since_heartbeat"] = int(
                                    time_since_heartbeat
                                )
                                instance_info["is_stale"] = (
                                    time_since_heartbeat > 60
                                )  # Consider stale after 60s
                            except (ValueError, TypeError):
                                instance_info["is_stale"] = True

                        registered_instances.append(instance_info)

                if cursor == 0:
                    break
        else:
            # Mock Redis fallback
            logger.warning("Using mock Redis, instance tracking not available")
    except Exception as e:
        logger.error(f"Error fetching instances: {type(e).__name__}: {e}")
        return APIResponseHelper.error(
            message="Failed to fetch instance data", errors={"error": type(e).__name__}
        )

    # Sort instances by last heartbeat (most recent first)
    registered_instances.sort(key=lambda x: x.get("last_heartbeat", ""), reverse=True)

    # Since authentication is now required, we can show full instance details
    # No need to filter sensitive data anymore

    # Analyze discrepancies
    active_count = len(
        [i for i in registered_instances if not i.get("is_stale", False)]
    )
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
                i.get("instance_id") == get_instance_id() for i in registered_instances
            ),
        },
    }

    # Add warnings if there are issues
    warnings = []
    if discrepancy:
        if active_count > desired_replicas:
            warnings.append(
                f"WARNING: {active_count - desired_replicas} extra instances detected"
            )
        elif active_count < desired_replicas:
            warnings.append(
                f"WARNING: {desired_replicas - active_count} instances missing"
            )

    stale_count = len([i for i in registered_instances if i.get("is_stale", False)])
    if stale_count > 0:
        warnings.append(
            f"WARNING: {stale_count} stale instances detected (no heartbeat in 60s)"
        )

    if warnings:
        instance_data["warnings"] = warnings

    return APIResponseHelper.success(
        data=instance_data, message="Instance information retrieved"
    )


@router.get("/ready")
@limiter.limit("1000/minute")  # High limit for k8s readiness probes
async def health_ready(
    request: Request,
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
) -> Dict[str, Any]:
    """
    Kubernetes/container readiness probe endpoint.

    Returns 200 if the instance is ready to serve traffic.
    Returns 503 if any critical service is unavailable.

    No authentication required for container orchestration compatibility.
    """
    # Check database
    db_ready = False
    try:
        result = db.execute(text("SELECT 1"))
        db.commit()
        db_ready = result.scalar() == 1
    except Exception as e:
        logger.error(f"Database readiness check failed: {type(e).__name__}")

    # Check Redis
    redis_ready = False
    try:
        await redis.set("readiness_check", "1", expire=5)
        redis_ready = await redis.get("readiness_check") == "1"
    except Exception as e:
        logger.error(f"Redis readiness check failed: {type(e).__name__}")

    if db_ready and redis_ready:
        return APIResponseHelper.success(
            data={"ready": True, "services": {"database": "ready", "redis": "ready"}},
            message="Instance is ready",
        )
    else:
        return APIResponseHelper.error(
            message="Instance not ready",
            status_code=503,
            errors={
                "database": "ready" if db_ready else "not ready",
                "redis": "ready" if redis_ready else "not ready",
            },
        )


@router.get("/live")
@limiter.limit("1000/minute")  # High limit for k8s liveness probes
async def health_live(request: Request) -> Dict[str, Any]:
    """
    Kubernetes/container liveness probe endpoint.

    Simple check that the application is running.
    Returns 200 if the application is alive.

    No authentication required for container orchestration compatibility.
    """
    return APIResponseHelper.success(
        data={
            "alive": True,
            "instance_id": get_instance_id(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        message="Instance is alive",
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
    # Don't expose the actual values
    if os.environ.get("SPACES_ACCESS_KEY_ID") and os.environ.get(
        "SPACES_SECRET_ACCESS_KEY"
    ):
        return "healthy"
    return "not_configured"
