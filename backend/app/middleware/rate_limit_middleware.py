"""
Rate limiting middleware using fastapi-limiter.
"""
import logging
from typing import Optional

from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.extension import RateLimiter
from jose import JWTError, jwt

from app.core.config import settings
from app.core.redis_client import redis_client, RedisClient # Import global instance

logger = logging.getLogger(__name__)

# --- User Identification ---
security = HTTPBearer(auto_error=False)

async def get_current_user_id(
    request: Request,
    token: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[str]:
    """
    Extracts user ID from JWT token if present.
    Returns None if no token or token is invalid.
    """
    if token is None:
        return None
    try:
        payload = jwt.decode(token.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: Optional[str] = payload.get("sub") # Assuming 'sub' contains the user ID
        if user_id is None:
            return None
        return str(user_id) # Ensure it's a string
    except JWTError:
        return None # Invalid token

# --- Limiter Configuration ---

# This function determines the key for rate limiting.
# It prioritizes user ID if available, otherwise falls back to IP address.
async def identify_client(request: Request) -> str:
    user_id = await get_current_user_id(request)
    client_type = request.headers.get("X-Client-Type", "unknown")
    
    if user_id:
        return f"user:{user_id}:{client_type}"
    return f"ip:{get_remote_address(request)}:{client_type}"

# Specialized key functions for different client types
async def identify_mobile_client(request: Request) -> str:
    user_id = await get_current_user_id(request)
    if user_id:
        return f"mobile:user:{user_id}"
    return f"mobile:ip:{get_remote_address(request)}"

async def identify_portal_client(request: Request) -> str:
    user_id = await get_current_user_id(request)
    if user_id:
        return f"portal:user:{user_id}"
    return f"portal:ip:{get_remote_address(request)}"

# Initialize the Limiter with our identifier function
# The redis_client.get_client() will provide the actual aioredis.Redis instance
# or a compatible mock if Redis connection fails in dev/test.
limiter = Limiter(key_func=identify_client, strategy="moving-window")


# --- RateLimitMiddleware ---
# We will use the SlowAPIMiddleware and apply limits per-route using decorators.
# However, to manage the redis connection for the limiter, we need to initialize it.

# It's important that `init_redis` (which connects redis_client) is called during app startup,
# and `close_redis` during shutdown. This is handled in main.py's lifespan.

# The limiter instance needs to be aware of the Redis client.
# fastapi-limiter's global limiter state can be tricky.
# We'll ensure it's configured when the app starts.

async def init_fastapi_limiter():
    """
    Initializes the fastapi-limiter with the Redis client.
    This should be called during application startup after Redis is connected.
    """
    try:
        # Check if Redis is available
        redis_available = False
        if redis_client and redis_client.redis:
            # Test the connection
            try:
                await redis_client.redis.ping()
                redis_available = True
            except:
                pass
        
        # Check if we're in mock mode
        mock_mode = redis_client and redis_client._mock_storage is not None and not redis_client.redis
        
        if not redis_available and not mock_mode:
            # No Redis and no mock mode - rate limiting cannot work
            error_msg = "Rate limiter cannot be initialized: Redis is not available and not in mock mode."
            logger.error(error_msg)
            
            if settings.ENVIRONMENT == "production":
                # In production, log warning but continue (rate limiting will be disabled)
                logger.warning("⚠️ Rate limiting disabled in production due to Redis unavailability")
            return
        
        # Rate limiter can work with either real Redis or mock storage
        if redis_available:
            logger.info("✅ Rate limiter initialized with Redis backend")
        else:
            logger.info("✅ Rate limiter initialized with mock storage backend")
            
    except Exception as e:
        logger.error(f"❌ Error initializing rate limiter: {str(e)}")
        if settings.ENVIRONMENT == "production":
            logger.warning("⚠️ Rate limiting disabled due to initialization error")


# Custom exception handler for RateLimitExceeded to provide a standard API response.
# This is already handled by slowapi's default handler if we add it to the app.
# We can customize it if needed.

# --- Application of Limits ---
# Limits will be applied via decorators on specific routes/routers in `api.py` or endpoint files.
# Example:
# from app.middleware.rate_limit_middleware import limiter
#
# @router.post("/login")
# @limiter.limit("5/minute") # Applied to the key from identify_client
# async def login(...):
#     ...

# This file primarily sets up the `limiter` instance.
# The actual middleware registration (`app.add_middleware(SlowAPIMiddleware)`) and
# exception handler (`app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)`)
# will be done in `main.py`.
# And `init_fastapi_limiter` will also be called in `main.py`'s lifespan.

# Define default limits (can be overridden by decorators)
DEFAULT_RATE = "60/minute"

# Define specific limits for endpoint categories
AUTH_RATE = "5/minute"
PAYMENT_RATE = "15/minute" # As per requirement "10-20", using 15

# Portal vs Mobile specific limits
MOBILE_APP_RATE = "100/minute"
PORTAL_DASHBOARD_RATE = "300/minute"  # Higher for analytics
PORTAL_EXPORT_RATE = "10/minute"     # Lower for resource-intensive operations

# API-specific limits
ANALYTICS_RATE = "200/minute"        # High for dashboard queries
WEBSOCKET_RATE = "500/minute"        # Very high for real-time updates
SYNC_RATE = "200/minute"             # High for synchronization

logger.info(f"Rate Limiter Configured: DEFAULT_RATE={DEFAULT_RATE}, AUTH_RATE={AUTH_RATE}, PAYMENT_RATE={PAYMENT_RATE}")
logger.info("Rate limiting strategy: User ID if authenticated, otherwise IP address.")
logger.info("Rate limits will be applied via decorators on specific routes.")
