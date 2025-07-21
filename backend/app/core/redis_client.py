"""
Redis client for caching, session management, and rate limiting.
Connects to DigitalOcean Valkey (Redis compatible).
"""

import json
import logging
import sys
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
        self.is_available = False  # Track if Redis is actually available
        self._last_connection_attempt = 0  # Track last connection attempt time
        self._connection_retry_interval = 30  # Minimum seconds between connection attempts

    async def connect(self):
        """Connect to Redis"""
        import time
        
        # Rate limit connection attempts
        current_time = time.time()
        if current_time - self._last_connection_attempt < self._connection_retry_interval:
            logger.debug(f"Skipping Redis connection attempt - last attempt was {current_time - self._last_connection_attempt:.1f}s ago")
            return
        
        self._last_connection_attempt = current_time
        
        if not self.redis:
            try:
                # Check if REDIS_URL is configured
                if not hasattr(settings, 'REDIS_URL') or not settings.REDIS_URL:
                    logger.warning("⚠️ REDIS_URL not configured. Using mock storage.")
                    if settings.ENVIRONMENT == "production":
                        raise ValueError("REDIS_URL must be configured in production")
                    return
                    
                # Mask password in logs
                redis_url_masked = settings.REDIS_URL
                if '@' in redis_url_masked and ':' in redis_url_masked:
                    # Extract and mask password
                    protocol_end = redis_url_masked.find('://') + 3
                    at_sign = redis_url_masked.find('@')
                    if protocol_end < at_sign:
                        user_pass = redis_url_masked[protocol_end:at_sign]
                        if ':' in user_pass:
                            user, _ = user_pass.split(':', 1)
                            redis_url_masked = f"{redis_url_masked[:protocol_end]}{user}:****{redis_url_masked[at_sign:]}"
                
                logger.info(f"Attempting to connect to Redis at {redis_url_masked}")
                
                # For DigitalOcean Valkey, handle SSL carefully
                import asyncio
                import socket
                
                # First, check if this is a rediss:// URL
                is_ssl = settings.REDIS_URL.startswith('rediss://')
                logger.info(f"Redis URL uses SSL: {is_ssl}")
                
                # Basic connection parameters with increased timeouts
                connection_kwargs = {
                    'decode_responses': True,
                    'max_connections': 10,  # Reduced for DigitalOcean Valkey
                    'socket_connect_timeout': 60,  # Increased to 60s for DigitalOcean
                    'socket_timeout': 60,  # Increased to 60s for DigitalOcean
                    'retry_on_timeout': True,
                    'retry_on_error': [aioredis.ConnectionError, aioredis.TimeoutError],
                    'health_check_interval': 120,  # Less frequent health checks
                    'socket_keepalive': True,  # Enable TCP keepalive
                }
                
                # Add socket keepalive options for non-Windows platforms
                if sys.platform != 'win32' and hasattr(socket, 'TCP_KEEPIDLE'):
                    connection_kwargs['socket_keepalive_options'] = {
                        socket.TCP_KEEPIDLE: 1,    # Start keepalives after 1 second of idle
                        socket.TCP_KEEPINTVL: 3,   # Send keepalive every 3 seconds
                        socket.TCP_KEEPCNT: 5,     # Send 5 keepalive probes before declaring dead
                    }
                
                # For DigitalOcean Valkey with SSL, add specific SSL settings
                if is_ssl:
                    import ssl
                    # Use proper SSL module constants, not strings
                    connection_kwargs.update({
                        'ssl_cert_reqs': ssl.CERT_NONE,  # Use SSL constant
                        'ssl_check_hostname': False,  # Don't check hostname
                    })
                    logger.info("Using SSL parameters for DigitalOcean Valkey")
                
                # Try to connect
                try:
                    logger.info("Creating Redis connection pool...")
                    self.pool = ConnectionPool.from_url(
                        settings.REDIS_URL, 
                        **connection_kwargs
                    )
                    self.redis = aioredis.Redis(connection_pool=self.pool)
                    
                    # Test connection with extended timeout
                    logger.info("Testing Redis connection with ping...")
                    await asyncio.wait_for(self.redis.ping(), timeout=30.0)
                    logger.info("✅ Redis connected successfully")
                    self.is_available = True
                    
                    # Clear mock storage only on successful connection
                    self._mock_storage = {}
                    logger.info("🧹 Cleared mock storage after successful Redis connection")
                    
                except (asyncio.TimeoutError, aioredis.TimeoutError, aioredis.ConnectionError) as e:
                    logger.error(f"Redis connection failed: {type(e).__name__}: {str(e)}")
                    
                    # Clean up failed connection
                    await self._cleanup_connection()
                    
                    # For DigitalOcean, provide helpful error message
                    if "digitalocean.com" in settings.REDIS_URL:
                        logger.error("\n" + "="*60)
                        logger.error("DigitalOcean Valkey Connection Troubleshooting:")
                        logger.error("1. Check Trusted Sources in DO Database Settings")
                        logger.error("2. Ensure your app is added as trusted source")
                        logger.error("3. Verify both app and database are in same region")
                        logger.error("4. Try using rediss:// URL for SSL connection")
                        logger.error("="*60 + "\n")
                    
                    # Don't raise - allow fallback to mock storage
                    self.is_available = False
                    logger.warning("⚠️ Continuing without Redis - using in-memory fallback")
                    # Keep existing mock storage data on connection failure
                    return
            except Exception as e:
                # Clean up any partially created connections
                if self.redis:
                    try:
                        await self.redis.close()
                    except:
                        pass
                    self.redis = None
                if self.pool:
                    try:
                        await self.pool.disconnect()
                    except:
                        pass
                    self.pool = None
                
                # Log the full error details
                error_msg = str(e) if str(e) else type(e).__name__
                logger.error(f"❌ Failed to connect to Redis: {error_msg}")
                
                # In production, allow fallback to mock storage with warning
                # This prevents complete application failure if Redis is temporarily unavailable
                if settings.ENVIRONMENT == "production":
                    logger.warning("⚠️ Redis unavailable in production - using in-memory fallback. This may impact performance and data persistence.")
                    # Continue with mock storage
                elif settings.ENVIRONMENT in ["development", "testing", "local"]:
                    logger.warning("⚠️ Redis connection failed. Falling back to mock storage.")
                else:
                    # For any other environment, raise the error
                    raise ConnectionError(f"Failed to connect to Redis: {error_msg}")


    async def disconnect(self):
        """Disconnect from Redis"""
        await self._cleanup_connection()
    
    async def _cleanup_connection(self):
        """Clean up Redis connection and pool"""
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
        # CRITICAL: Reset availability flag to allow reconnection attempts
        self.is_available = False

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

    async def ping(self) -> bool:
        """Ping Redis to check if connection is alive"""
        if not self.redis:  # Mock fallback
            # Mock is always "alive"
            return True
        try:
            response = await self.redis.ping()
            return response is True or str(response).upper() == 'PONG'
        except Exception as e:
            logger.error(f"Error pinging Redis: {str(e)}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self.redis: # Mock fallback
             return key in self._mock_storage
        try:
            return bool(await self.redis.exists(key)) # Ensure boolean return
        except Exception as e:
            logger.error(f"Error checking existence of key {key} in Redis: {e}")
            return False
    
    async def zadd(self, key: str, mapping: dict, **kwargs) -> int:
        """Add members to a sorted set"""
        if not self.redis: # Mock fallback
            if key not in self._mock_storage:
                self._mock_storage[key] = {}
            self._mock_storage[key].update(mapping)
            return len(mapping)
        try:
            return await self.redis.zadd(key, mapping, **kwargs)
        except Exception as e:
            logger.error(f"Error adding to sorted set {key}: {e}")
            return 0
    
    async def zrange(self, key: str, start: int, end: int, withscores: bool = False) -> list:
        """Get range of members from sorted set"""
        if not self.redis: # Mock fallback
            if key not in self._mock_storage:
                return []
            # Simple mock - return all items
            items = list(self._mock_storage[key].items())
            if withscores:
                return items[:end+1] if end != -1 else items
            else:
                # Extract just the keys from the items
                selected_items = items[:end+1] if end != -1 else items
                return [k for k, v in selected_items]
        try:
            return await self.redis.zrange(key, start, end, withscores=withscores)
        except Exception as e:
            logger.error(f"Error getting range from sorted set {key}: {e}")
            return []
    
    async def incrbyfloat(self, key: str, amount: float) -> float:
        """Increment value by float amount"""
        if not self.redis: # Mock fallback
            current = float(self._mock_storage.get(key, 0))
            new_value = current + amount
            self._mock_storage[key] = str(new_value)
            return new_value
        try:
            return await self.redis.incrbyfloat(key, amount)
        except Exception as e:
            logger.error(f"Error incrementing float key {key}: {e}")
            return 0.0
    
    async def scan(self, cursor: int = 0, match: Optional[str] = None, count: int = 100):
        """Scan keys matching pattern"""
        if not self.redis: # Mock fallback
            import fnmatch
            if match:
                # Return strings, not bytes, to match decode_responses=True behavior
                keys = [k for k in self._mock_storage.keys() if fnmatch.fnmatch(k, match)]
            else:
                keys = list(self._mock_storage.keys())
            # Simple mock - return all matching keys at once
            return (0, keys[:count])
        try:
            return await self.redis.scan(cursor, match=match, count=count)
        except Exception as e:
            logger.error(f"Error scanning keys with pattern {match}: {e}")
            return (0, [])

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
    try:
        await redis_client.connect()
        # No explicit init for fastapi-limiter here; it will call redis_client.get_client()
    except Exception as e:
        logger.warning(f"Redis initialization failed: {str(e)}")
        logger.warning("App will continue with in-memory fallback for caching/sessions")
        # Don't re-raise - allow app to start without Redis

async def close_redis():
    """Close Redis connection."""
    await redis_client.disconnect()

async def get_redis() -> RedisClient:
    """Get Redis client instance, ensuring it's connected."""
    # Attempt connection if Redis is not connected and not marked as available
    # This allows reconnection attempts after failures
    if not redis_client.redis and not redis_client.is_available:
        logger.info("Redis not connected, attempting to connect...")
        await redis_client.connect()
    return redis_client