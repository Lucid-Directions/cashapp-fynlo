"""
Redis client for caching and session management
"""

import redis.asyncio as redis
import json
import logging
from typing import Any, Optional
from datetime import timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)

class RedisClient:
    """Redis client wrapper"""
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
    
    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
            await self.redis.ping()
            logger.info("✅ Redis connected successfully")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis:
            await self.redis.close()
    
    async def set(self, key: str, value: Any, expire: Optional[int] = None) -> bool:
        """Set a value in Redis"""
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            
            result = await self.redis.set(key, value, ex=expire)
            return result
        except Exception as e:
            logger.error(f"Redis SET error: {e}")
            return False
    
    async def get(self, key: str) -> Optional[Any]:
        """Get a value from Redis"""
        try:
            value = await self.redis.get(key)
            if value is None:
                return None
            
            # Try to parse as JSON
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        except Exception as e:
            logger.error(f"Redis GET error: {e}")
            return None
    
    async def delete(self, key: str) -> bool:
        """Delete a key from Redis"""
        try:
            result = await self.redis.delete(key)
            return bool(result)
        except Exception as e:
            logger.error(f"Redis DELETE error: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern"""
        try:
            # Get all keys matching the pattern
            keys = await self.redis.keys(pattern)
            if not keys:
                return 0
            
            # Delete all matching keys
            result = await self.redis.delete(*keys)
            logger.info(f"Deleted {result} keys matching pattern: {pattern}")
            return result
        except Exception as e:
            logger.error(f"Redis DELETE PATTERN error for {pattern}: {e}")
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        try:
            result = await self.redis.exists(key)
            return bool(result)
        except Exception as e:
            logger.error(f"Redis EXISTS error: {e}")
            return False
    
    async def set_session(self, session_id: str, data: dict, expire: int = 3600):
        """Set session data"""
        await self.set(f"session:{session_id}", data, expire)
    
    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get session data"""
        return await self.get(f"session:{session_id}")
    
    async def delete_session(self, session_id: str):
        """Delete session"""
        await self.delete(f"session:{session_id}")
    
    async def cache_menu(self, restaurant_id: str, menu_data: dict, expire: int = 300):
        """Cache menu data"""
        await self.set(f"menu:{restaurant_id}", menu_data, expire)
    
    async def get_cached_menu(self, restaurant_id: str) -> Optional[dict]:
        """Get cached menu"""
        return await self.get(f"menu:{restaurant_id}")
    
    async def cache_order(self, order_id: str, order_data: dict, expire: int = 3600):
        """Cache order data"""
        await self.set(f"order:{order_id}", order_data, expire)
    
    async def get_cached_order(self, order_id: str) -> Optional[dict]:
        """Get cached order"""
        return await self.get(f"order:{order_id}")
    
    async def invalidate_restaurant_cache(self, restaurant_id: str) -> int:
        """Invalidate all cache for a restaurant"""
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
        """Invalidate product-related cache for a restaurant"""
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
    """Initialize Redis connection"""
    await redis_client.connect()

async def get_redis() -> RedisClient:
    """Get Redis client instance"""
    return redis_client