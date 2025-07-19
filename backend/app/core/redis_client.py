"""
Redis client for caching, session management, and rate limiting.
Connects to DigitalOcean Valkey (Redis compatible).
"""

import json
import logging
from typing import Any, Optional
import redis.asyncio as aioredis
from redis.asyncio.connection import ConnectionPool

from app.core.config import settings

logger = logging.getLogger(__name__)

class RedisClient:
    """Redis client wrapper"""

    def __init__(self):
        self.pool: Optional[ConnectionPool] = None
        self.redis: Optional[aioredis.Redis] = None
        self._mock_storage = {} # For fallback

    async def connect(self):
        """Connect to Redis"""
        if not self.redis:
            try:
                # Check if REDIS_URL is configured
                if not hasattr(settings, 'REDIS_URL') or not settings.REDIS_URL:
                    logger.warning("⚠️ REDIS_URL not configured. Using mock storage.")
                    if settings.ENVIRONMENT == "production":
                        raise ValueError("REDIS_URL must be configured in production")
                    return
                    
                logger.info(f"Attempting to connect to Redis at {settings.REDIS_URL}")
                self.pool = ConnectionPool.from_url(
                    settings.REDIS_URL, 
                    decode_responses=True, 
                    max_connections=20,
                    socket_connect_timeout=5,  # 5 second connection timeout
                    socket_timeout=5  # 5 second operation timeout
                )
                self.redis = aioredis.Redis(connection_pool=self.pool)
                # Add timeout to ping operation
                import asyncio
                await asyncio.wait_for(self.redis.ping(), timeout=5.0)
                logger.info("✅ Redis connected successfully.")
                # Clear mock storage if real connection is successful
                self._mock_storage = {}
            except Exception as e:
                logger.error(f"❌ Failed to connect to Redis: {e}")
                if settings.ENVIRONMENT in ["development", "testing", "local"]: # Broader fallback for local dev
                    logger.warning("⚠️ Redis connection failed. Falling back to mock storage.")
                    self.redis = None # Ensure redis is None if connection failed
                    # _mock_storage is already initialized
                else:
                    # In production, a failed Redis connection should be a critical error.
                    # Depending on policy, either raise the error or have a more robust fallback.
                    # For now, let's re-raise to make it visible.
                    raise ConnectionError(f"Critical: Failed to connect to Redis in production environment - {e}")


    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis and hasattr(self.redis, 'close'):
            try:
                await self.redis.close()
                logger.info("Redis client closed.")
            except Exception as e:
                logger.error(f"Error closing Redis client: {e}")
        if self.pool and hasattr(self.pool, 'disconnect'):
            try:
                await self.pool.disconnect()
                logger.info("Redis connection pool disconnected.")
            except Exception as e:
                logger.error(f"Error disconnecting Redis connection pool: {e}")
        self.redis = None
        self.pool = None

    async def set(self, key: str, value: Any, expire: Optional[int] = None) -> bool:
        """Set a value in Redis"""
        if not self.redis: # Mock fallback
            if isinstance(value, (dict, list, tuple)): # Handle tuples as well
                value = json.dumps(value)
            self._mock_storage[key] = str(value) # Store as string for consistency
            # Mock doesn't handle expire well, but log it
            if expire:
                logger.debug(f"Mock Redis: SET {key} with expire {expire} (not implemented in mock)")
            return True

        if isinstance(value, (dict, list, tuple)):
            value_to_set = json.dumps(value)
        else:
            value_to_set = str(value) # Ensure value is string if not complex type

        try:
            await self.redis.set(key, value_to_set, ex=expire)
            return True
        except Exception as e:
            logger.error(f"Error setting key {key} in Redis: {e}")
            return False

    async def get(self, key: str) -> Optional[Any]:
        """Get a value from Redis"""
        if not self.redis: # Mock fallback
            value = self._mock_storage.get(key)
            if value is None:
                return None
            try:
                return json.loads(value) # Try to parse as JSON
            except (json.JSONDecodeError, TypeError):
                return value # Return as is if not JSON or if already primitive

        try:
            value = await self.redis.get(key)
            if value is None:
                return None
            try:
                # decode_responses=True means value is already a string
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        except Exception as e:
            logger.error(f"Error getting key {key} from Redis: {e}")
            return None

    async def delete(self, key: str) -> bool:
        """Delete a key from Redis"""
        if not self.redis: # Mock fallback
            if key in self._mock_storage:
                del self._mock_storage[key]
                return True
            return False
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Error deleting key {key} from Redis: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern"""
        if not self.redis: # Mock fallback
            import fnmatch
            keys_to_delete = [k for k in self._mock_storage.keys() if fnmatch.fnmatch(k, pattern)]
            for key_to_del in keys_to_delete:
                del self._mock_storage[key_to_del]
            logger.info(f"Mock deleted {len(keys_to_delete)} keys matching pattern: {pattern}")
            return len(keys_to_delete)

        keys_deleted_count = 0
        # Use a cursor for potentially large number of keys
        async for key_batch in self.redis.scan_iter(match=pattern, count=100): # Process in batches
            if key_batch: # redis-py scan_iter might yield empty lists
                 # delete can take multiple keys
                num = await self.redis.delete(*key_batch if isinstance(key_batch, list) else [key_batch])
                keys_deleted_count += num
        logger.info(f"Deleted {keys_deleted_count} keys matching pattern: {pattern}")
        return keys_deleted_count

    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self.redis: # Mock fallback
             return key in self._mock_storage
        try:
            return bool(await self.redis.exists(key)) # Ensure boolean return
        except Exception as e:
            logger.error(f"Error checking existence of key {key} in Redis: {e}")
            return False

    # --- Methods for specific application logic ---
    async def set_session(self, session_id: str, data: dict, expire: int = 3600):
        await self.set(f"session:{session_id}", data, expire)

    async def get_session(self, session_id: str) -> Optional[dict]:
        return await self.get(f"session:{session_id}")

    async def delete_session(self, session_id: str):
        await self.delete(f"session:{session_id}")

    async def cache_menu(self, restaurant_id: str, menu_data: dict, expire: int = 300):
        await self.set(f"menu:{restaurant_id}", menu_data, expire)

    async def get_cached_menu(self, restaurant_id: str) -> Optional[dict]:
        return await self.get(f"menu:{restaurant_id}")

    async def cache_order(self, order_id: str, order_data: dict, expire: int = 3600):
        await self.set(f"order:{order_id}", order_data, expire)

    async def get_cached_order(self, order_id: str) -> Optional[dict]:
        return await self.get(f"order:{order_id}")

    async def invalidate_restaurant_cache(self, restaurant_id: str) -> int:
        patterns = [
            f"products:{restaurant_id}:*", f"categories:{restaurant_id}:*",
            f"menu:{restaurant_id}:*", f"orders:{restaurant_id}:*"
        ]
        total_deleted = sum(await self.delete_pattern(p) for p in patterns)
        logger.info(f"Invalidated {total_deleted} cache keys for restaurant {restaurant_id}")
        return total_deleted

    async def invalidate_product_cache(self, restaurant_id: str) -> int:
        patterns = [f"products:{restaurant_id}:*", f"menu:{restaurant_id}:*"]
        total_deleted = sum(await self.delete_pattern(p) for p in patterns)
        logger.info(f"Invalidated {total_deleted} product cache keys for restaurant {restaurant_id}")
        return total_deleted

    # --- Methods required by fastapi-limiter ---
    async def incr(self, key: str) -> int:
        """Increment a key in Redis. Required by fastapi-limiter."""
        if not self.redis: # Mock fallback
            current_value = self._mock_storage.get(key, "0")
            new_value = int(current_value) + 1
            self._mock_storage[key] = str(new_value)
            return new_value
        try:
            # INCR is atomic and returns the value after incrementing
            return await self.redis.incr(key)
        except Exception as e:
            logger.error(f"Error incrementing key {key} in Redis: {e}")
            # Fallback or error handling if INCR fails
            # For rate limiting, failing open might be risky, failing closed might be better.
            # Returning a high number could effectively block if this happens.
            return 99999 # Or re-raise

    async def expire(self, key: str, timeout: int):
        """Set an expire on a key. Required by fastapi-limiter."""
        if not self.redis: # Mock fallback
            logger.debug(f"Mock Redis: EXPIRE {key} {timeout} (not implemented in mock)")
            return
        try:
            await self.redis.expire(key, timeout)
        except Exception as e:
            logger.error(f"Error setting expire for key {key} in Redis: {e}")
    
    async def hset(self, key: str, mapping: dict) -> bool:
        """Set multiple fields in a hash"""
        if not self.redis:  # Mock fallback
            if key not in self._mock_storage:
                self._mock_storage[key] = {}
            # Convert dict values to strings for consistency
            str_mapping = {k: str(v) for k, v in mapping.items()}
            if isinstance(self._mock_storage.get(key), dict):
                self._mock_storage[key].update(str_mapping)
            else:
                self._mock_storage[key] = str_mapping
            return True
        
        try:
            # Convert all values to strings for Redis
            str_mapping = {k: str(v) for k, v in mapping.items()}
            await self.redis.hset(key, mapping=str_mapping)
            return True
        except Exception as e:
            logger.error(f"Error setting hash {key} in Redis: {e}")
            return False

    def get_client(self) -> Optional[aioredis.Redis]:
        """
        Returns the raw aioredis.Redis client instance.
        Useful for fastapi-limiter or other libraries that need direct access.
        """
        if not self.redis and settings.ENVIRONMENT in ["development", "testing", "local"]:
            logger.warning("FastAPI-Limiter might be using a mock RedisClient instance (self).")
            # This is a tricky part for mock compatibility with fastapi-limiter.
            # fastapi-limiter expects an object with specific async methods (incr, expire).
            # The mock fallback in this class implements these.
            return self # type: ignore
        return self.redis


# Global Redis client instance
redis_client = RedisClient()

async def init_redis():
    """Initialize Redis connection and prepare for fastapi-limiter."""
    await redis_client.connect()
    # No explicit init for fastapi-limiter here; it will call redis_client.get_client()

async def close_redis():
    """Close Redis connection."""
    await redis_client.disconnect()

async def get_redis() -> RedisClient:
    """Get Redis client instance, ensuring it's connected."""
    # If redis is not connected and not in a mock state (due to initial connection failure)
    if not redis_client.redis and not redis_client._mock_storage :
        logger.info("Redis client accessed before initial connect or after disconnect, attempting to connect.")
        await redis_client.connect()
    return redis_client