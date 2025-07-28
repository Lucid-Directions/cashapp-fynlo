"""
Cache utilities for platform analytics and data caching.
Uses Valkey (Redis) for high-performance caching.
"""

import json
import logging
from typing import Any, Optional, Dict, List
from datetime import timedelta

from app.core.redis_client import redis_client

logger = logging.getLogger(__name__)


async def cache_data(key: str, data: Any, ttl: int = 300) -> bool:
    """
    Cache data with a specific TTL (time-to-live) in seconds.
    
    Args:
        key: Cache key
        data: Data to cache (will be JSON serialized)
        ttl: Time-to-live in seconds (default: 5 minutes)
    
    Returns:
        bool: True if successful, False otherwise
    """
    if not redis_client:
        logger.warning("Redis client not available for caching")
        return False
    try:
        return await redis_client.set(key, data, expire=ttl)
    except Exception as e:
        logger.error(f"Failed to cache data for key {key}: {e}")
        return False


def get_cached_data(key: str) -> Optional[Any]:
    """
    Get cached data synchronously (for use in sync endpoints).
    
    DEPRECATED: This function has async/sync conflicts. Use get_cached_data_async() instead.
    
    Args:
        key: Cache key
    
    Returns:
        Cached data or None if not found/expired
    """
    logger.warning(f"get_cached_data() is deprecated due to async/sync conflicts. Use get_cached_data_async() for key: {key}")
    # Return None to avoid runtime errors
    # The platform API endpoints should be updated to use async version
    return None


async def get_cached_data_async(key: str) -> Optional[Any]:
    """
    Get cached data asynchronously.
    
    Args:
        key: Cache key
    
    Returns:
        Cached data or None if not found/expired
    """
    if not redis_client:
        logger.warning("Redis client not available for cache retrieval")
        return None
    try:
        return await redis_client.get(key)
    except Exception as e:
        logger.error(f"Failed to get cached data for key {key}: {e}")
        return None


async def delete_cache(key: str) -> bool:
    """
    Delete a specific cache key.
    
    Args:
        key: Cache key to delete
    
    Returns:
        bool: True if successful, False otherwise
    """
    if not redis_client:
        logger.warning("Redis client not available for cache deletion")
        return False
    try:
        return await redis_client.delete(key)
    except Exception as e:
        logger.error(f"Failed to delete cache key {key}: {e}")
        return False


async def delete_cache_pattern(pattern: str) -> int:
    """
    Delete all cache keys matching a pattern.
    
    Args:
        pattern: Pattern to match (e.g., "platform:analytics:*")
    
    Returns:
        int: Number of keys deleted
    """
    if not redis_client:
        logger.warning("Redis client not available for pattern deletion")
        return 0
    try:
        return await redis_client.delete_pattern(pattern)
    except Exception as e:
        logger.error(f"Failed to delete cache pattern {pattern}: {e}")
        return 0


# Platform-specific cache functions

async def cache_platform_analytics(
    metric: str, 
    data: Dict[str, Any], 
    ttl: int = 900
) -> bool:
    """
    Cache platform analytics data.
    
    Args:
        metric: Analytics metric name
        data: Analytics data
        ttl: Time-to-live in seconds (default: 15 minutes)
    
    Returns:
        bool: True if successful
    """
    key = f"platform:analytics:{metric}"
    return await cache_data(key, data, ttl)


async def get_platform_analytics(metric: str) -> Optional[Dict[str, Any]]:
    """
    Get cached platform analytics data.
    
    Args:
        metric: Analytics metric name
    
    Returns:
        Cached analytics data or None
    """
    key = f"platform:analytics:{metric}"
    return await get_cached_data_async(key)


async def cache_platform_report(
    report_type: str,
    params: Dict[str, Any],
    data: Any,
    ttl: int = 3600
) -> bool:
    """
    Cache platform report data.
    
    Args:
        report_type: Type of report
        params: Report parameters (for cache key generation)
        data: Report data
        ttl: Time-to-live in seconds (default: 1 hour)
    
    Returns:
        bool: True if successful
    """
    # Create a deterministic key from params
    param_str = ":".join(f"{k}={v}" for k, v in sorted(params.items()))
    key = f"platform:report:{report_type}:{param_str}"
    return await cache_data(key, data, ttl)


async def get_platform_report(
    report_type: str,
    params: Dict[str, Any]
) -> Optional[Any]:
    """
    Get cached platform report data.
    
    Args:
        report_type: Type of report
        params: Report parameters
    
    Returns:
        Cached report data or None
    """
    param_str = ":".join(f"{k}={v}" for k, v in sorted(params.items()))
    key = f"platform:report:{report_type}:{param_str}"
    return await get_cached_data_async(key)


async def invalidate_platform_cache() -> int:
    """
    Invalidate all platform-related cache entries.
    
    Returns:
        int: Number of keys deleted
    """
    patterns = [
        "platform:analytics:*",
        "platform:report:*",
        "platform:dashboard:*"
    ]
    total_deleted = 0
    for pattern in patterns:
        deleted = await delete_cache_pattern(pattern)
        total_deleted += deleted
    
    logger.info(f"Invalidated {total_deleted} platform cache entries")
    return total_deleted


async def cache_restaurant_metrics(
    restaurant_id: str,
    metrics: Dict[str, Any],
    ttl: int = 600
) -> bool:
    """
    Cache restaurant-specific metrics for platform dashboard.
    
    Args:
        restaurant_id: Restaurant ID
        metrics: Restaurant metrics
        ttl: Time-to-live in seconds (default: 10 minutes)
    
    Returns:
        bool: True if successful
    """
    key = f"platform:restaurant:{restaurant_id}:metrics"
    return await cache_data(key, metrics, ttl)


async def get_restaurant_metrics(restaurant_id: str) -> Optional[Dict[str, Any]]:
    """
    Get cached restaurant metrics.
    
    Args:
        restaurant_id: Restaurant ID
    
    Returns:
        Cached metrics or None
    """
    key = f"platform:restaurant:{restaurant_id}:metrics"
    return await get_cached_data_async(key)


async def cache_subscription_summary(
    summary: Dict[str, Any],
    ttl: int = 1800
) -> bool:
    """
    Cache subscription summary for platform dashboard.
    
    Args:
        summary: Subscription summary data
        ttl: Time-to-live in seconds (default: 30 minutes)
    
    Returns:
        bool: True if successful
    """
    key = "platform:subscriptions:summary"
    return await cache_data(key, summary, ttl)


async def get_subscription_summary() -> Optional[Dict[str, Any]]:
    """
    Get cached subscription summary.
    
    Returns:
        Cached summary or None
    """
    key = "platform:subscriptions:summary"
    return await get_cached_data_async(key)


# Dashboard-specific cache functions

async def cache_dashboard_widget(
    widget_name: str,
    data: Any,
    ttl: int = 300
) -> bool:
    """
    Cache dashboard widget data.
    
    Args:
        widget_name: Name of the dashboard widget
        data: Widget data
        ttl: Time-to-live in seconds (default: 5 minutes)
    
    Returns:
        bool: True if successful
    """
    key = f"platform:dashboard:widget:{widget_name}"
    return await cache_data(key, data, ttl)


async def get_dashboard_widget(widget_name: str) -> Optional[Any]:
    """
    Get cached dashboard widget data.
    
    Args:
        widget_name: Name of the dashboard widget
    
    Returns:
        Cached widget data or None
    """
    key = f"platform:dashboard:widget:{widget_name}"
    return await get_cached_data_async(key)


# Real-time metrics cache (shorter TTL)

async def cache_realtime_metric(
    metric: str,
    value: Any,
    ttl: int = 60
) -> bool:
    """
    Cache real-time metric with short TTL.
    
    Args:
        metric: Metric name
        value: Metric value
        ttl: Time-to-live in seconds (default: 1 minute)
    
    Returns:
        bool: True if successful
    """
    key = f"platform:realtime:{metric}"
    return await cache_data(key, value, ttl)


async def get_realtime_metric(metric: str) -> Optional[Any]:
    """
    Get cached real-time metric.
    
    Args:
        metric: Metric name
    
    Returns:
        Cached metric value or None
    """
    key = f"platform:realtime:{metric}"
    return await get_cached_data_async(key)