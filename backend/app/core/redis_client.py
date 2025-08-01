"""TODO: Add docstring."""

from app.core.exceptions import ServiceUnavailableError
Redis client for caching, session management, and rate limiting.
Connects to DigitalOcean Valkey (Redis compatible).
"""TODO: Add docstring."""

import json
import logging
import time
from typing import Any, Optional
import redis.asyncio as aioredis
from redis.asyncio.connection import ConnectionPool

from app.core.config import settings

logger = logging.getLogger(__name__)

class RedisClient:
    """Redis client wrapper with circuit breaker pattern"""

    def __init__(self):
        self.pool: Optional[ConnectionPool] = None
        self.redis: Optional[aioredis.Redis] = None
        self._mock_storage = {} # For fallback
        self._is_connected = False  # Track if we've attempted connection
        self._last_health_check = 0
        self._health_check_interval = 5  # seconds
        self._is_healthy = False
        
        # Circuit breaker state
        self._circuit_state = "closed"  # closed, open, half-open
        self._failure_count = 0
        self._failure_threshold = 5  # failures before opening circuit
        self._success_threshold = 2  # successes before closing circuit
        self._circuit_open_time = 0
        self._circuit_timeout = 30  # seconds before trying half-open
        self._consecutive_successes = 0

    async def connect(self):
        """Connect to Redis"""
        if not self.redis and not self._is_connected:
            self._is_connected = True  # Mark that we've attempted connection
            try:
                logger.info(f"Attempting to connect to Redis at {settings.REDIS_URL}")
                self.pool = ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True, max_connections=20)
                self.redis = aioredis.Redis(connection_pool=self.pool)
                await self.redis.ping()
                logger.info("✅ Redis connected successfully.")
                # Clear mock storage if real connection is successful
                self._mock_storage = {}
                self._is_healthy = True
            except Exception as e:
                logger.error(f"❌ Failed to connect to Redis: {e}")
                self.redis = None  # Ensure redis is None if connection failed
                self._is_healthy = False
                
                # Only allow mock storage in development/testing environments
                if settings.ENVIRONMENT in ["development", "testing", "local"]:
                    logger.warning("⚠️ Redis connection failed. Using in-memory storage (DEV MODE ONLY).")
                    # _mock_storage is already initialized as {} which indicates mock mode is active
                else:
                    # In production, fail closed - don't allow bypass
                    raise ServiceUnavailableError(
                        message="Cache service is currently unavailable. Please try again later.",
                        service_name="Redis",
                        retry_after=30,
                        details={"reason": "Redis connection failed", "error": str(e)}
                    )


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
        self._is_healthy = False

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
            self._on_success()
            return True
        except Exception as e:
            logger.error(f"Error setting key {key} in Redis: {e}")
            self._on_failure()
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
            self._on_success()
            if value is None:
                return None
            try:
                # decode_responses=True means value is already a string
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        except Exception as e:
            logger.error(f"Error getting key {key} from Redis: {e}")
            self._on_failure()
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
        """Set session data - critical operation that must not fail silently"""
        self._require_redis("session management")
        success = await self.set(f"session:{session_id}", data, expire)
        if not success and settings.ENVIRONMENT not in ["development", "testing", "local"]:
            raise ServiceUnavailableError(
                message="Failed to create session",
                service_name="Redis",
                retry_after=30
            )
        return success

    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get session data - returns None if not found or Redis unavailable in dev"""
        self._require_redis("session retrieval")
        return await self.get(f"session:{session_id}")

    async def delete_session(self, session_id: str):
        """Delete session - critical for security"""
        self._require_redis("session deletion")
        success = await self.delete(f"session:{session_id}")
        if not success and settings.ENVIRONMENT not in ["development", "testing", "local"]:
            logger.error(f"Failed to delete session {session_id} - potential security risk")

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
            if settings.ENVIRONMENT in ["development", "testing", "local"]:
                current_value = self._mock_storage.get(key, "0")
                new_value = int(current_value) + 1
                self._mock_storage[key] = str(new_value)
                return new_value
            else:
                # In production, fail closed for rate limiting
                logger.error(f"Rate limiting unavailable - Redis not connected")
                return 99999  # Effectively block the request
        try:
            # INCR is atomic and returns the value after incrementing
            result = await self.redis.incr(key)
            self._on_success()
            return result
        except Exception as e:
            logger.error(f"Error incrementing key {key} in Redis: {e}")
            self._on_failure()
            # For rate limiting, failing closed is safer than failing open
            # Returning a high number effectively blocks the request
            if settings.ENVIRONMENT not in ["development", "testing", "local"]:
                return 99999  # Block in production
            else:
                # In dev, try mock fallback
                current_value = self._mock_storage.get(key, "0")
                new_value = int(current_value) + 1
                self._mock_storage[key] = str(new_value)
                return new_value

    async def expire(self, key: str, timeout: int):
        """Set an expire on a key. Required by fastapi-limiter."""
        if not self.redis: # Mock fallback
            logger.debug(f"Mock Redis: EXPIRE {key} {timeout} (not implemented in mock)")
            return
        try:
            await self.redis.expire(key, timeout)
        except Exception as e:
            logger.error(f"Error setting expire for key {key} in Redis: {e}")

    async def is_healthy(self) -> bool:
        """Check if Redis connection is healthy"""
        if not self.redis:
            return False
            
        # Check circuit breaker state
        if self._circuit_state == "open":
            if time.time() - self._circuit_open_time > self._circuit_timeout:
                logger.info("Circuit breaker timeout reached, trying half-open state")
                self._circuit_state = "half-open"
            else:
                return False
            
        # Rate limit health checks
        current_time = time.time()
        if current_time - self._last_health_check < self._health_check_interval:
            return self._is_healthy
            
        try:
            await self.redis.ping()
            self._is_healthy = True
            self._last_health_check = current_time
            self._on_success()
            return True
        except Exception as e:
            logger.warning(f"Redis health check failed: {e}")
            self._is_healthy = False
            self._last_health_check = current_time
            self._on_failure()
            return False
    
    def _on_success(self):
        """Handle successful Redis operation"""
        if self._circuit_state == "half-open":
            self._consecutive_successes += 1
            if self._consecutive_successes >= self._success_threshold:
                logger.info("Circuit breaker closing after successful operations")
                self._circuit_state = "closed"
                self._failure_count = 0
                self._consecutive_successes = 0
        elif self._circuit_state == "closed":
            self._failure_count = 0
    
    def _on_failure(self):
        """Handle failed Redis operation"""
        self._consecutive_successes = 0
        self._failure_count += 1
        
        if self._circuit_state == "half-open":
            logger.warning("Circuit breaker reopening after failure in half-open state")
            self._circuit_state = "open"
            self._circuit_open_time = time.time()
        elif self._circuit_state == "closed" and self._failure_count >= self._failure_threshold:
            logger.error(f"Circuit breaker opening after {self._failure_count} failures")
            self._circuit_state = "open"
            self._circuit_open_time = time.time()

    def _require_redis(self, operation: str = "operation"):
        """Ensure Redis is available or raise exception in production"""
        # Check circuit breaker first
        if self._circuit_state == "open" and settings.ENVIRONMENT not in ["development", "testing", "local"]:
            time_until_retry = int(self._circuit_timeout - (time.time() - self._circuit_open_time))
            raise ServiceUnavailableError(
                message=f"Service temporarily unavailable due to repeated failures",
                service_name="Redis",
                retry_after=max(1, time_until_retry),
                details={"circuit_state": "open", "operation": operation}
            )
            
        if not self.redis and settings.ENVIRONMENT not in ["development", "testing", "local"]:
            raise ServiceUnavailableError(
                message=f"Cannot perform {operation}: Cache service unavailable",
                service_name="Redis",
                retry_after=30
            )

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
    # If we haven't attempted connection yet
    if not redis_client._is_connected:
        logger.info("Redis client accessed before initial connect, attempting to connect.")
        await redis_client.connect()
    return redis_client

async def get_redis_health() -> dict:
    """Get Redis health status for monitoring"""
    try:
        is_healthy = await redis_client.is_healthy()
        return {
            "service": "redis",
            "status": "healthy" if is_healthy else "unhealthy",
            "connected": redis_client.redis is not None,
            "circuit_state": redis_client._circuit_state,
            "failure_count": redis_client._failure_count,
            "is_mock": redis_client.redis is None and bool(redis_client._mock_storage),
            "environment": settings.ENVIRONMENT
        }
    except Exception as e:
        logger.error(f"Error checking Redis health: {e}")
        return {
            "service": "redis",
            "status": "error",
            "error": str(e),
            "environment": settings.ENVIRONMENT
        }