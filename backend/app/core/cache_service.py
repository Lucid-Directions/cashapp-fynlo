"""
Enhanced cache service for Fynlo POS with comprehensive caching strategies.
Implements decorator pattern for easy endpoint caching and cache invalidation.
"""

import hashlib
import json
import logging
from functools import wraps
from typing import Any, Callable, Optional, Dict, List, Union
import inspect

from app.core.redis_client import redis_client
from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """Enhanced cache service with advanced features"""
    
    def __init__(self):
        self.redis = redis_client
        self.metrics = CacheMetrics()
        
    def cache_key(self, prefix: str, **kwargs) -> str:
        """
        Generate a cache key from prefix and parameters.
        Ensures consistent key generation for cache hits.
        
        Args:
            prefix: Cache key prefix
            **kwargs: Key-value pairs to include in the key
            
        Returns:
            str: Generated cache key
        """
        # Sort kwargs to ensure consistent key generation
        key_data = f"{prefix}:" + ":".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
        # Use MD5 hash for long keys to avoid Redis key length limits
        if len(key_data) > 200:
            key_hash = hashlib.md5(key_data.encode()).hexdigest()
            return f"{prefix}:hash:{key_hash}"
        return key_data
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found/expired
        """
        try:
            value = await self.redis.get(key)
            if value is not None:
                self.metrics.record_hit()
                logger.debug(f"Cache hit for key: {key}")
            else:
                self.metrics.record_miss()
                logger.debug(f"Cache miss for key: {key}")
            return value
        except Exception as e:
            self.metrics.record_error()
            logger.error(f"Cache get error for key {key}: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """
        Set value in cache with TTL.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (default: 1 hour)
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            success = await self.redis.set(key, value, expire=ttl)
            if success:
                logger.debug(f"Cache set for key: {key} with TTL: {ttl}s")
            return success
        except Exception as e:
            self.metrics.record_error()
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """
        Delete a specific cache key.
        
        Args:
            key: Cache key to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            success = await self.redis.delete(key)
            if success:
                logger.debug(f"Cache deleted for key: {key}")
            return success
        except Exception as e:
            self.metrics.record_error()
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching a pattern.
        
        Args:
            pattern: Pattern to match (e.g., "menu:restaurant_id=*")
            
        Returns:
            int: Number of keys deleted
        """
        try:
            count = await self.redis.delete_pattern(pattern)
            logger.info(f"Deleted {count} cache keys matching pattern: {pattern}")
            return count
        except Exception as e:
            self.metrics.record_error()
            logger.error(f"Cache delete pattern error for {pattern}: {e}")
            return 0
    
    async def invalidate_restaurant_cache(self, restaurant_id: str) -> int:
        """
        Invalidate all cache entries for a restaurant.
        
        Args:
            restaurant_id: Restaurant ID
            
        Returns:
            int: Number of keys deleted
        """
        patterns = [
            f"menu:restaurant_id={restaurant_id}*",
            f"menu:hash:*",  # Hash-based keys that might contain this restaurant
            f"products:restaurant_id={restaurant_id}*",
            f"categories:restaurant_id={restaurant_id}*",
            f"settings:restaurant_id={restaurant_id}*",
            f"analytics:restaurant_id={restaurant_id}*",
        ]
        
        total_deleted = 0
        for pattern in patterns:
            deleted = await self.delete_pattern(pattern)
            total_deleted += deleted
        
        logger.info(f"Invalidated {total_deleted} cache entries for restaurant {restaurant_id}")
        return total_deleted
    
    async def invalidate_user_cache(self, user_id: str) -> int:
        """
        Invalidate all cache entries for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            int: Number of keys deleted
        """
        patterns = [
            f"user:user_id={user_id}*",
            f"session:*{user_id}*",
            f"permissions:user_id={user_id}*",
        ]
        
        total_deleted = 0
        for pattern in patterns:
            deleted = await self.delete_pattern(pattern)
            total_deleted += deleted
        
        logger.info(f"Invalidated {total_deleted} cache entries for user {user_id}")
        return total_deleted
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get cache performance metrics"""
        return self.metrics.get_metrics()


class CacheMetrics:
    """Track cache performance metrics"""
    
    def __init__(self):
        self.hits = 0
        self.misses = 0
        self.errors = 0
    
    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate percentage"""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0
    
    def record_hit(self):
        """Record a cache hit"""
        self.hits += 1
    
    def record_miss(self):
        """Record a cache miss"""
        self.misses += 1
    
    def record_error(self):
        """Record a cache error"""
        self.errors += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get all metrics"""
        return {
            "hits": self.hits,
            "misses": self.misses,
            "errors": self.errors,
            "hit_rate": f"{self.hit_rate:.2f}%",
            "total_requests": self.hits + self.misses
        }


# Global cache service instance
cache_service = CacheService()


def cached(
    ttl: int = 3600,
    prefix: Optional[str] = None,
    key_params: Optional[List[str]] = None,
    invalidate_on: Optional[List[str]] = None
):
    """
    Decorator for caching function results.
    
    Args:
        ttl: Time-to-live in seconds (default: 1 hour)
        prefix: Cache key prefix (default: function name)
        key_params: List of parameter names to include in cache key
        invalidate_on: List of parameter names that trigger cache invalidation
    
    Example:
        @cached(ttl=3600, prefix="menu", key_params=["restaurant_id"])
        async def get_menu(restaurant_id: str, db: Session):
            return db.query(MenuItem).filter(...).all()
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get function signature to map args to parameter names
            sig = inspect.signature(func)
            bound_args = sig.bind(*args, **kwargs)
            bound_args.apply_defaults()
            
            # Generate cache key prefix
            cache_prefix = prefix or f"{func.__module__}.{func.__name__}"
            
            # Build cache key parameters
            cache_params = {}
            if key_params:
                for param in key_params:
                    if param in bound_args.arguments:
                        value = bound_args.arguments[param]
                        # Convert complex objects to string representation
                        if hasattr(value, '__dict__'):
                            value = str(value)
                        cache_params[param] = value
            else:
                # Use all non-database parameters by default
                for param, value in bound_args.arguments.items():
                    # Skip common non-cacheable parameters
                    if param not in ['db', 'session', 'request', 'response', 'background_tasks']:
                        if hasattr(value, '__dict__'):
                            value = str(value)
                        cache_params[param] = value
            
            # Generate cache key
            cache_key = cache_service.cache_key(cache_prefix, **cache_params)
            
            # Check if we need to invalidate cache
            if invalidate_on:
                for param in invalidate_on:
                    if param in bound_args.arguments and bound_args.arguments[param]:
                        await cache_service.delete_pattern(f"{cache_prefix}*")
                        logger.debug(f"Cache invalidated for prefix: {cache_prefix}")
                        break
            
            # Try to get from cache
            cached_value = await cache_service.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            
            # Cache the result
            await cache_service.set(cache_key, result, ttl)
            
            return result
        
        # Add cache management methods to the wrapper
        wrapper.invalidate_cache = lambda **params: cache_service.delete_pattern(
            f"{prefix or f'{func.__module__}.{func.__name__}'}*"
        )
        
        return wrapper
    return decorator


# Cache warming utilities
async def warm_menu_cache(db):
    """
    Pre-populate cache with active restaurant menus.
    Should be called on startup and periodically.
    """
    from app.models import Restaurant, MenuItem
    
    try:
        # Get all active restaurants
        restaurants = db.query(Restaurant).filter(
            Restaurant.is_active == True
        ).all()
        
        warmed_count = 0
        for restaurant in restaurants:
            # Generate cache key
            cache_key = cache_service.cache_key(
                "menu",
                restaurant_id=str(restaurant.id)
            )
            
            # Get menu data
            menu_items = db.query(MenuItem).filter(
                MenuItem.restaurant_id == restaurant.id,
                MenuItem.is_active == True
            ).all()
            
            # Convert to dict for caching
            menu_data = [
                {
                    "id": str(item.id),
                    "name": item.name,
                    "description": item.description,
                    "price": float(item.price),
                    "category_id": str(item.category_id) if item.category_id else None,
                    "image_url": item.image_url,
                    "is_available": item.is_available,
                }
                for item in menu_items
            ]
            
            # Cache it
            if await cache_service.set(cache_key, menu_data, ttl=3600):
                warmed_count += 1
        
        logger.info(f"Warmed cache for {warmed_count}/{len(restaurants)} restaurants")
        return warmed_count
    except Exception as e:
        logger.error(f"Error warming menu cache: {e}")
        return 0


async def warm_settings_cache(db):
    """
    Pre-populate cache with restaurant settings.
    """
    from app.models import Restaurant, RestaurantSettings
    
    try:
        # Get all active restaurants
        restaurants = db.query(Restaurant).filter(
            Restaurant.is_active == True
        ).all()
        
        warmed_count = 0
        for restaurant in restaurants:
            # Get settings
            settings = db.query(RestaurantSettings).filter(
                RestaurantSettings.restaurant_id == restaurant.id
            ).first()
            
            if settings:
                # Generate cache key
                cache_key = cache_service.cache_key(
                    "settings",
                    restaurant_id=str(restaurant.id)
                )
                
                # Convert to dict for caching
                settings_data = {
                    "service_charge_percentage": float(settings.service_charge_percentage),
                    "vat_percentage": float(settings.vat_percentage),
                    "currency": settings.currency,
                    "timezone": settings.timezone,
                    "opening_hours": settings.opening_hours,
                }
                
                # Cache it
                if await cache_service.set(cache_key, settings_data, ttl=1800):
                    warmed_count += 1
        
        logger.info(f"Warmed settings cache for {warmed_count} restaurants")
        return warmed_count
    except Exception as e:
        logger.error(f"Error warming settings cache: {e}")
        return 0