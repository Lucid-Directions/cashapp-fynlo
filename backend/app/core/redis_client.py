"""
Redis client for caching and session management
TEMPORARY MOCK VERSION - Will be replaced with DigitalOcean Valkey in production
"""

import json
import logging
from typing import Any, Optional
from datetime import timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)

class RedisClient:
    """Redis client wrapper - TEMPORARY MOCK for development"""
    
    def __init__(self):
        self.redis = None  # Will be replaced with DigitalOcean Valkey
        self._mock_storage = {}  # Temporary in-memory storage
    
    async def connect(self):
        """Connect to Redis - MOCK VERSION"""
        logger.info("✅ Redis MOCK connected (will use DigitalOcean Valkey in production)")
        return True
    
    async def disconnect(self):
        """Disconnect from Redis - MOCK VERSION"""
        logger.info("Redis MOCK disconnected")
    
    async def set(self, key: str, value: Any, expire: Optional[int] = None) -> bool:
        """Set a value in Redis - MOCK VERSION"""
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        self._mock_storage[key] = value
        return True
    
    async def get(self, key: str) -> Optional[Any]:
        """Get a value from Redis - MOCK VERSION"""
        value = self._mock_storage.get(key)
        if value is None:
            return None
        
        # Try to parse as JSON
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    
    async def delete(self, key: str) -> bool:
        """Delete a key from Redis - MOCK VERSION"""
        if key in self._mock_storage:
            del self._mock_storage[key]
            return True
        return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern - MOCK VERSION"""
        # Simple pattern matching for mock
        import fnmatch
        keys_to_delete = [k for k in self._mock_storage.keys() if fnmatch.fnmatch(k, pattern)]
        for key in keys_to_delete:
            del self._mock_storage[key]
        logger.info(f"Deleted {len(keys_to_delete)} keys matching pattern: {pattern}")
        return len(keys_to_delete)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists - MOCK VERSION"""
        return key in self._mock_storage
    
    async def set_session(self, session_id: str, data: dict, expire: int = 3600):
        """Set session data - MOCK VERSION"""
        await self.set(f"session:{session_id}", data, expire)
    
    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get session data - MOCK VERSION"""
        return await self.get(f"session:{session_id}")
    
    async def delete_session(self, session_id: str):
        """Delete session - MOCK VERSION"""
        await self.delete(f"session:{session_id}")
    
    async def cache_menu(self, restaurant_id: str, menu_data: dict, expire: int = 300):
        """Cache menu data - MOCK VERSION"""
        await self.set(f"menu:{restaurant_id}", menu_data, expire)
    
    async def get_cached_menu(self, restaurant_id: str) -> Optional[dict]:
        """Get cached menu - MOCK VERSION"""
        return await self.get(f"menu:{restaurant_id}")
    
    async def cache_order(self, order_id: str, order_data: dict, expire: int = 3600):
        """Cache order data - MOCK VERSION"""
        await self.set(f"order:{order_id}", order_data, expire)
    
    async def get_cached_order(self, order_id: str) -> Optional[dict]:
        """Get cached order - MOCK VERSION"""
        return await self.get(f"order:{order_id}")
    
    async def invalidate_restaurant_cache(self, restaurant_id: str) -> int:
        """Invalidate all cache for a restaurant - MOCK VERSION"""
        patterns = [
            f"products:{restaurant_id}:*",
            f"categories:{restaurant_id}:*", 
            f"menu:{restaurant_id}:*",
            f"orders:{restaurant_id}:*"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            deleted = await self.delete_pattern(pattern)
            total_deleted += deleted
        
        logger.info(f"Invalidated {total_deleted} cache keys for restaurant {restaurant_id}")
        return total_deleted
    
    async def invalidate_product_cache(self, restaurant_id: str) -> int:
        """Invalidate product-related cache for a restaurant - MOCK VERSION"""
        patterns = [
            f"products:{restaurant_id}:*",
            f"menu:{restaurant_id}:*"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            deleted = await self.delete_pattern(pattern)
            total_deleted += deleted
        
        logger.info(f"Invalidated {total_deleted} product cache keys for restaurant {restaurant_id}")
        return total_deleted

# Global Redis client instance
redis_client = RedisClient()

async def init_redis():
    """Initialize Redis connection - MOCK VERSION"""
    await redis_client.connect()

async def get_redis() -> RedisClient:
    """Get Redis client instance - MOCK VERSION"""
    return redis_client