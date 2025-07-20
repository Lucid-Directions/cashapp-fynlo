"""
Enhanced Redis client for DigitalOcean Valkey with better SSL handling
This shows alternative connection approaches
"""

import redis.asyncio as aioredis
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

async def create_redis_connection_from_url(redis_url: str):
    """
    Create Redis connection with proper handling for DigitalOcean Valkey
    """
    # Parse the URL to understand what we're connecting to
    parsed = urlparse(redis_url)
    is_ssl = parsed.scheme == 'rediss'
    
    # Method 1: Simple approach - let redis-py handle SSL from URL
    try:
        logger.info(f"Attempting connection with simple URL approach to {parsed.hostname}:{parsed.port}")
        
        # For rediss:// URLs, redis-py should handle SSL automatically
        # We just need to increase timeouts
        client = await aioredis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=30,  # Increased from 10
            socket_timeout=30,
            retry_on_timeout=True,
            health_check_interval=30,
            max_connections=20,
        )
        
        await client.ping()
        logger.info("✅ Redis connected successfully with simple URL approach")
        return client
        
    except Exception as e:
        logger.warning(f"Simple URL approach failed: {type(e).__name__}: {e}")
    
    # Method 2: If simple approach fails, try with explicit SSL settings
    if is_ssl:
        try:
            logger.info("Attempting connection with explicit SSL settings")
            
            # For DigitalOcean, we need minimal SSL verification
            client = await aioredis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=30,
                socket_timeout=30,
                retry_on_timeout=True,
                health_check_interval=30,
                max_connections=20,
                ssl_cert_reqs='none',  # DigitalOcean uses self-signed certs
                ssl_check_hostname=False,
            )
            
            await client.ping()
            logger.info("✅ Redis connected successfully with explicit SSL settings")
            return client
            
        except Exception as e:
            logger.warning(f"Explicit SSL approach failed: {type(e).__name__}: {e}")
    
    # Method 3: Manual connection with parsed components
    try:
        logger.info("Attempting manual connection with parsed URL components")
        
        # Extract connection details
        host = parsed.hostname
        port = parsed.port or (6380 if is_ssl else 6379)
        password = parsed.password
        username = parsed.username or 'default'
        db = int(parsed.path[1:]) if parsed.path and parsed.path != '/' else 0
        
        # Create connection with explicit parameters
        connection_kwargs = {
            'host': host,
            'port': port,
            'password': password,
            'username': username,
            'db': db,
            'decode_responses': True,
            'socket_connect_timeout': 30,
            'socket_timeout': 30,
            'retry_on_timeout': True,
            'health_check_interval': 30,
            'max_connections': 20,
        }
        
        if is_ssl:
            connection_kwargs.update({
                'ssl': True,
                'ssl_cert_reqs': 'none',
                'ssl_check_hostname': False,
            })
        
        client = aioredis.Redis(**connection_kwargs)
        await client.ping()
        logger.info("✅ Redis connected successfully with manual approach")
        return client
        
    except Exception as e:
        logger.error(f"All connection methods failed. Last error: {type(e).__name__}: {e}")
        raise

# Alternative approach for debugging
async def test_redis_connectivity(redis_url: str):
    """Test Redis connectivity with detailed logging"""
    import ssl
    import socket
    
    parsed = urlparse(redis_url)
    host = parsed.hostname
    port = parsed.port or (6380 if parsed.scheme == 'rediss' else 6379)
    
    # Test 1: Basic socket connectivity
    logger.info(f"Testing socket connectivity to {host}:{port}")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    
    try:
        sock.connect((host, port))
        logger.info("✅ Socket connection successful")
        sock.close()
    except Exception as e:
        logger.error(f"❌ Socket connection failed: {e}")
        return False
    
    # Test 2: SSL handshake if needed
    if parsed.scheme == 'rediss':
        logger.info("Testing SSL handshake")
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        
        try:
            sock.connect((host, port))
            ssock = context.wrap_socket(sock, server_hostname=host)
            logger.info(f"✅ SSL handshake successful. Protocol: {ssock.version()}")
            ssock.close()
        except Exception as e:
            logger.error(f"❌ SSL handshake failed: {e}")
            return False
    
    return True