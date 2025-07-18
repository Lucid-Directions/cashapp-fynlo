from typing import Any, Optional, List, Callable, Union
import hashlib
import json
from datetime import datetime, timedelta
import asyncio
import functools
from collections import defaultdict

from app.core.redis_client import redis_client
from app.core.config import settings
from app.core.logger import logger

class CacheManager:
    """Advanced caching with invalidation strategies"""
    
    def __init__(self):
        self.default_ttl = 300  # 5 minutes
        self.cache_prefix = "cache:"
        self.invalidation_patterns: Dict[str, List[str]] = defaultdict(list)
        self.cache_stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0
        }
    
    def _generate_key(self, namespace: str, *args, **kwargs) -> str:
        """Generate a cache key from namespace and arguments"""
        key_data = {
            "namespace": namespace,
            "args": args,
            "kwargs": kwargs
        }
        
        key_json = json.dumps(key_data, sort_keys=True, default=str)
        key_hash = hashlib.md5(key_json.encode()).hexdigest()
        
        return f"{self.cache_prefix}{namespace}:{key_hash}"
    
    async def get_or_set(
        self,
        namespace: str,
        fetcher: Callable,
        ttl: Optional[int] = None,
        *args,
        **kwargs
    ) -> Any:
        """Get from cache or fetch and cache"""
        cache_key = self._generate_key(namespace, *args, **kwargs)
        
        # Try to get from cache
        try:
            cached_value = await redis_client.get(cache_key)
            if cached_value is not None:
                self.cache_stats["hits"] += 1
                logger.debug(f"Cache hit for key: {cache_key}")
                return cached_value
        except Exception as e:
            logger.error(f"Cache get error: {e}")
        
        # Cache miss
        self.cache_stats["misses"] += 1
        logger.debug(f"Cache miss for key: {cache_key}")
        
        # Fetch fresh data
        fresh_value = await fetcher(*args, **kwargs)
        
        # Cache the result
        try:
            await redis_client.set(
                cache_key,
                fresh_value,
                expire=ttl or self.default_ttl
            )
        except Exception as e:
            logger.error(f"Cache set error: {e}")
        
        return fresh_value
    
    async def invalidate(self, namespace: str, *args, **kwargs):
        """Invalidate specific cache entry"""
        cache_key = self._generate_key(namespace, *args, **kwargs)
        try:
            result = await redis_client.delete(cache_key)
            if result:
                self.cache_stats["evictions"] += 1
                logger.debug(f"Invalidated cache key: {cache_key}")
        except Exception as e:
            logger.error(f"Cache invalidation error: {e}")
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching a pattern"""
        full_pattern = f"{self.cache_prefix}{pattern}"
        deleted_count = 0
        
        try:
            # Use SCAN to find matching keys
            cursor = 0
            while True:
                cursor, keys = await redis_client.scan(cursor, match=full_pattern, count=100)
                if keys:
                    deleted = await redis_client.delete(*keys)
                    deleted_count += deleted
                    self.cache_stats["evictions"] += deleted
                
                if cursor == 0:
                    break
                    
            logger.info(f"Invalidated {deleted_count} cache entries matching pattern: {pattern}")
        except Exception as e:
            logger.error(f"Pattern invalidation error: {e}")
            
        return deleted_count
    
    async def invalidate_namespace(self, namespace: str) -> int:
        """Invalidate all entries in a namespace"""
        pattern = f"{namespace}:*"
        return await self.invalidate_pattern(pattern)
    
    # Cache decorators
    def cached(self, namespace: str, ttl: Optional[int] = None):
        """Decorator for caching function results"""
        def decorator(func):
            @functools.wraps(func)
            async def wrapper(*args, **kwargs):
                # Skip cache in certain conditions
                if kwargs.pop("skip_cache", False):
                    return await func(*args, **kwargs)
                
                # Remove self from args for instance methods
                cache_args = args[1:] if args and hasattr(args[0], '__class__') else args
                
                return await self.get_or_set(
                    namespace,
                    func,
                    ttl,
                    *cache_args,
                    **kwargs
                )
            
            # Attach invalidation helper
            wrapper.invalidate = lambda *a, **k: self.invalidate(namespace, *a, **k)
            wrapper.invalidate_all = lambda: self.invalidate_namespace(namespace)
            
            return wrapper
        return decorator
    
    # Specific cache strategies
    async def cache_menu_data(self, restaurant_id: str, menu_data: dict):
        """Cache menu data with smart invalidation"""
        cache_key = f"menu:{restaurant_id}"
        
        try:
            # Cache main menu (1 hour TTL)
            await redis_client.set(
                f"{self.cache_prefix}{cache_key}",
                menu_data,
                expire=3600
            )
            
            # Cache individual categories for partial updates
            for category in menu_data.get("categories", []):
                category_key = f"menu:category:{restaurant_id}:{category['id']}"
                await redis_client.set(
                    f"{self.cache_prefix}{category_key}",
                    category,
                    expire=3600
                )
            
            # Cache individual items for quick lookups
            for item in menu_data.get("items", []):
                item_key = f"menu:item:{restaurant_id}:{item['id']}"
                await redis_client.set(
                    f"{self.cache_prefix}{item_key}",
                    item,
                    expire=3600
                )
                
            logger.info(f"Cached menu data for restaurant {restaurant_id}")
        except Exception as e:
            logger.error(f"Menu caching error: {e}")
    
    async def get_cached_menu(self, restaurant_id: str) -> Optional[dict]:
        """Get cached menu with fallback to partial data"""
        cache_key = f"menu:{restaurant_id}"
        
        try:
            # Try full menu first
            full_menu = await redis_client.get(f"{self.cache_prefix}{cache_key}")
            if full_menu:
                self.cache_stats["hits"] += 1
                return full_menu
            
            # Try to reconstruct from cached categories
            category_pattern = f"{self.cache_prefix}menu:category:{restaurant_id}:*"
            categories = []
            
            cursor = 0
            while True:
                cursor, keys = await redis_client.scan(cursor, match=category_pattern, count=100)
                for key in keys:
                    category = await redis_client.get(key)
                    if category:
                        categories.append(category)
                
                if cursor == 0:
                    break
            
            if categories:
                self.cache_stats["hits"] += 1
                return {"categories": categories, "partial": True}
                
            self.cache_stats["misses"] += 1
            return None
            
        except Exception as e:
            logger.error(f"Menu cache retrieval error: {e}")
            return None
    
    async def warm_cache(self, restaurant_id: str):
        """Pre-warm cache for a restaurant"""
        tasks = [
            self._warm_menu_cache(restaurant_id),
            self._warm_settings_cache(restaurant_id),
            self._warm_stats_cache(restaurant_id)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        success_count = sum(1 for r in results if not isinstance(r, Exception))
        logger.info(f"Cache warming completed for restaurant {restaurant_id}: {success_count}/3 successful")
    
    async def _warm_menu_cache(self, restaurant_id: str):
        """Pre-warm menu cache"""
        from app.api.v1.endpoints.menu import get_menu_data
        from app.models import Restaurant
        from app.core.database import get_db
        
        try:
            async for db in get_db():
                restaurant = db.query(Restaurant).filter(
                    Restaurant.id == restaurant_id
                ).first()
                
                if restaurant:
                    menu_data = await get_menu_data(restaurant.id, db)
                    await self.cache_menu_data(restaurant_id, menu_data)
                    logger.info(f"Menu cache warmed for restaurant {restaurant_id}")
        except Exception as e:
            logger.error(f"Menu cache warming error: {e}")
            raise
    
    async def _warm_settings_cache(self, restaurant_id: str):
        """Pre-warm settings cache"""
        from app.models import RestaurantSettings
        from app.core.database import get_db
        
        try:
            async for db in get_db():
                settings = db.query(RestaurantSettings).filter(
                    RestaurantSettings.restaurant_id == restaurant_id
                ).first()
                
                if settings:
                    cache_key = f"settings:{restaurant_id}"
                    await redis_client.set(
                        f"{self.cache_prefix}{cache_key}",
                        settings.to_dict(),
                        expire=3600
                    )
                    logger.info(f"Settings cache warmed for restaurant {restaurant_id}")
        except Exception as e:
            logger.error(f"Settings cache warming error: {e}")
            raise
    
    async def _warm_stats_cache(self, restaurant_id: str):
        """Pre-warm stats cache"""
        try:
            # Calculate and cache basic stats
            stats_key = f"stats:daily:{restaurant_id}:{datetime.now().strftime('%Y%m%d')}"
            
            # This would normally calculate from database
            stats = {
                "orders_count": 0,
                "revenue": 0.0,
                "avg_order_value": 0.0,
                "top_items": []
            }
            
            await redis_client.set(
                f"{self.cache_prefix}{stats_key}",
                stats,
                expire=300  # 5 minutes for stats
            )
            logger.info(f"Stats cache warmed for restaurant {restaurant_id}")
        except Exception as e:
            logger.error(f"Stats cache warming error: {e}")
            raise
    
    def get_cache_stats(self) -> dict:
        """Get cache performance statistics"""
        total_requests = self.cache_stats["hits"] + self.cache_stats["misses"]
        hit_rate = (self.cache_stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "hits": self.cache_stats["hits"],
            "misses": self.cache_stats["misses"],
            "evictions": self.cache_stats["evictions"],
            "hit_rate_percentage": round(hit_rate, 2),
            "total_requests": total_requests
        }
    
    def reset_cache_stats(self):
        """Reset cache statistics"""
        self.cache_stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0
        }

# Global cache manager
cache_manager = CacheManager()