"""
Enhanced Redis client configuration for DigitalOcean Valkey
This shows the proper SSL configuration needed
"""

import ssl
import redis.asyncio as aioredis
from redis.asyncio.connection import ConnectionPool

async def create_digitalocean_redis_connection(redis_url: str):
    """Create Redis connection with proper DigitalOcean Valkey SSL configuration"""
    
    # DigitalOcean Valkey requires specific SSL settings
    connection_kwargs = {
        'decode_responses': True,
        'max_connections': 20,
        'socket_connect_timeout': 10,  # Increased from 5
        'socket_timeout': 10,  # Increased from 5
        'retry_on_timeout': True,
        'retry_on_error': [ConnectionError, TimeoutError],
        'retry': redis.retry.Retry(
            retries=3,
            backoff=redis.retry.ExponentialBackoff()
        )
    }
    
    # For rediss:// URLs, we need proper SSL configuration
    if redis_url.startswith('rediss://'):
        # Create SSL context for DigitalOcean
        ssl_context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        # Apply SSL context
        connection_kwargs['ssl'] = ssl_context
        connection_kwargs['ssl_cert_reqs'] = None
        connection_kwargs['ssl_check_hostname'] = False
        connection_kwargs['ssl_ca_certs'] = None
    
    # Create connection pool with URL
    pool = ConnectionPool.from_url(
        redis_url,
        **connection_kwargs
    )
    
    # Create Redis client
    redis_client = aioredis.Redis(connection_pool=pool)
    
    return redis_client

# Alternative approach using connection class
def get_enhanced_connection_kwargs(redis_url: str):
    """Get enhanced connection kwargs for DigitalOcean Valkey"""
    
    base_kwargs = {
        'decode_responses': True,
        'max_connections': 20,
        'socket_connect_timeout': 10,
        'socket_timeout': 10,
        'retry_on_timeout': True,
        'health_check_interval': 30,
    }
    
    if redis_url.startswith('rediss://'):
        # Option 1: Disable SSL verification completely
        base_kwargs.update({
            'ssl_cert_reqs': None,
            'ssl_check_hostname': False,
            'ssl_keyfile': None,
            'ssl_certfile': None,
            'ssl_ca_certs': None,
        })
        
        # Option 2: Use ssl module (more control)
        # ssl_context = ssl.create_default_context()
        # ssl_context.check_hostname = False
        # ssl_context.verify_mode = ssl.CERT_NONE
        # base_kwargs['ssl'] = ssl_context
    
    return base_kwargs