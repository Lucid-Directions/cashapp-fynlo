"""
Cache Service for Platform Settings
Provides fast access to frequently requested configuration
"""
import json
import logging
from typing import Dict, Any, Optional
from datetime import 

from app.core.redis_client import get_redis
from app.core.config import 

logger = logging.getLogger(__name__)

class PlatformCacheService:
    """Service for caching platform configuration"""
    
    CACHE_PREFIX = "platform:config:"
    DEFAULT_TTL = 300  # 5 minutes
    
    @staticmethod
    def get_cache_key(key: str) -> str:
        """Generate cache key with prefix"""
        return f"{PlatformCacheService.CACHE_PREFIX}{key}"
    
    @staticmethod
    async def get_service_charge_config() -> Optional[Dict[str, Any]]:
        """Get service charge configuration from cache"""
        try:
            redis = await get_redis()
            if not redis:
                return None
                
            cache_key = PlatformCacheService.get_cache_key("service_charge")
            cached_data = await redis.get(cache_key)
            
            if cached_data:
                return json.loads(cached_data)
                
            return None
            
        except Exception as e:
            logger.warning(f"Cache read failed: {e}")
            return None
    
    @staticmethod
    async def set_service_charge_config(config: Dict[str, Any], ttl: int = DEFAULT_TTL) -> bool:
        """Set service charge configuration in cache"""
        try:
            redis = await get_redis()
            if not redis:
                return False
                
            cache_key = PlatformCacheService.get_cache_key("service_charge")
            await redis.setex(
                cache_key,
                ttl,
                json.dumps(config)
            )
            return True
            
        except Exception as e:
            logger.warning(f"Cache write failed: {e}")
            return False
    
    @staticmethod
    async def invalidate_service_charge_config() -> bool:
        """Invalidate service charge configuration cache"""
        try:
            redis = await get_redis()
            if not redis:
                return False
                
            cache_key = PlatformCacheService.get_cache_key("service_charge")
            await redis.delete(cache_key)
            return True
            
        except Exception as e:
            logger.warning(f"Cache invalidation failed: {e}")
            return False