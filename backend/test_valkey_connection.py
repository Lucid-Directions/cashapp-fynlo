#!/usr/bin/env python3
"""
Test DigitalOcean Valkey (Redis) connection with various configurations
"""

import os
import sys
import redis
import asyncio
import redis.asyncio as aioredis
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_sync_connection():
    """Test synchronous Redis connection"""
    redis_url = os.getenv('REDIS_URL')
    if not redis_url:
        print("❌ REDIS_URL not found in environment")
        return False
    
    # Mask password in output
    if '@' in redis_url and ':' in redis_url:
        parts = redis_url.split('@')
        if len(parts) == 2 and ':' in parts[0]:
            protocol_user = parts[0].rsplit(':', 1)[0]
            host_part = parts[1]
            masked_url = f"{protocol_user}:****@{host_part}"
        else:
            masked_url = redis_url[:20] + "..."
    else:
        masked_url = redis_url
    
    print(f"Testing connection to: {masked_url}")
    
    # Test different connection configurations
    configs = [
        {
            "name": "Default SSL",
            "options": {
                "socket_connect_timeout": 10,
                "socket_timeout": 10,
                "ssl_cert_reqs": "none"
            }
        },
        {
            "name": "No SSL verification",
            "options": {
                "socket_connect_timeout": 10,
                "socket_timeout": 10,
                "ssl_cert_reqs": None,
                "ssl_check_hostname": False
            }
        },
        {
            "name": "With retry",
            "options": {
                "socket_connect_timeout": 10,
                "socket_timeout": 10,
                "ssl_cert_reqs": "none",
                "retry_on_timeout": True,
                "retry_on_error": [redis.ConnectionError, redis.TimeoutError]
            }
        }
    ]
    
    for config in configs:
        print(f"\n📝 Testing with {config['name']} configuration...")
        try:
            r = redis.from_url(redis_url, **config['options'])
            r.ping()
            print(f"✅ {config['name']}: Connection successful!")
            
            # Test basic operations
            r.set('test_key', 'test_value', ex=60)
            value = r.get('test_key')
            print(f"✅ Basic operations working: {value}")
            r.delete('test_key')
            
            return True
        except redis.exceptions.TimeoutError:
            print(f"❌ {config['name']}: Connection timeout")
        except redis.exceptions.ConnectionError as e:
            print(f"❌ {config['name']}: Connection error - {str(e)}")
        except Exception as e:
            print(f"❌ {config['name']}: {type(e).__name__} - {str(e)}")
    
    return False

async def test_async_connection():
    """Test asynchronous Redis connection"""
    redis_url = os.getenv('REDIS_URL')
    if not redis_url:
        return False
    
    print("\n📝 Testing async connection...")
    
    try:
        # Create connection with proper SSL handling for DigitalOcean
        if redis_url.startswith('rediss://'):
            connection_kwargs = {
                'decode_responses': True,
                'socket_connect_timeout': 10,
                'socket_timeout': 10,
                'ssl_cert_reqs': 'none'  # DigitalOcean uses self-signed certs
            }
        else:
            connection_kwargs = {
                'decode_responses': True,
                'socket_connect_timeout': 10,
                'socket_timeout': 10
            }
        
        pool = aioredis.ConnectionPool.from_url(redis_url, **connection_kwargs)
        redis_client = aioredis.Redis(connection_pool=pool)
        
        await redis_client.ping()
        print("✅ Async connection successful!")
        
        # Test basic operations
        await redis_client.set('async_test_key', 'async_test_value', ex=60)
        value = await redis_client.get('async_test_key')
        print(f"✅ Async operations working: {value}")
        await redis_client.delete('async_test_key')
        
        await redis_client.close()
        await pool.disconnect()
        
        return True
    except asyncio.TimeoutError:
        print("❌ Async connection timeout")
    except Exception as e:
        print(f"❌ Async error: {type(e).__name__} - {str(e)}")
    
    return False

def check_network_connectivity():
    """Check basic network connectivity to Redis host"""
    redis_url = os.getenv('REDIS_URL')
    if not redis_url:
        return False
    
    # Extract host and port from URL
    try:
        if redis_url.startswith('rediss://'):
            url_part = redis_url[9:]  # Remove 'rediss://'
        elif redis_url.startswith('redis://'):
            url_part = redis_url[8:]  # Remove 'redis://'
        else:
            print("❌ Invalid Redis URL format")
            return False
        
        # Extract host and port
        if '@' in url_part:
            _, host_part = url_part.split('@', 1)
        else:
            host_part = url_part
        
        if ':' in host_part:
            if host_part.count(':') == 1:
                host, port = host_part.split(':')
                port = int(port.split('/')[0])  # Remove database number if present
            else:
                # IPv6 address or complex format
                print("❌ Complex host format, skipping network test")
                return True
        else:
            print("❌ No port found in Redis URL")
            return False
        
        print(f"\n📝 Testing network connectivity to {host}:{port}")
        
        import socket
        
        # Test TCP connection
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        
        result = sock.connect_ex((host, port))
        sock.close()
        
        if result == 0:
            print(f"✅ TCP connection to {host}:{port} successful!")
            return True
        else:
            print(f"❌ TCP connection failed with error code: {result}")
            
            # Try DNS resolution
            try:
                ip = socket.gethostbyname(host)
                print(f"📝 DNS resolved {host} to {ip}")
            except socket.gaierror:
                print(f"❌ DNS resolution failed for {host}")
            
            return False
            
    except Exception as e:
        print(f"❌ Network test error: {type(e).__name__} - {str(e)}")
        return False

def main():
    """Run all connection tests"""
    print("🔍 DigitalOcean Valkey (Redis) Connection Diagnostics")
    print("=" * 50)
    
    # Check environment
    redis_url = os.getenv('REDIS_URL')
    if not redis_url:
        print("❌ REDIS_URL environment variable not set!")
        print("\nPlease ensure your .env file contains REDIS_URL")
        sys.exit(1)
    
    # Run tests
    network_ok = check_network_connectivity()
    
    if not network_ok:
        print("\n⚠️  Network connectivity issue detected!")
        print("\nPossible causes:")
        print("1. Firewall blocking outbound connections")
        print("2. DigitalOcean trusted sources not configured")
        print("3. VPN or proxy interference")
        print("4. Redis instance is down or being maintained")
    
    sync_ok = test_sync_connection()
    
    # Run async test
    async_ok = asyncio.run(test_async_connection())
    
    print("\n" + "=" * 50)
    print("📊 Summary:")
    print(f"  Network connectivity: {'✅' if network_ok else '❌'}")
    print(f"  Sync connection: {'✅' if sync_ok else '❌'}")
    print(f"  Async connection: {'✅' if async_ok else '❌'}")
    
    if not any([network_ok, sync_ok, async_ok]):
        print("\n💡 Recommendations:")
        print("1. Check DigitalOcean dashboard for Redis instance status")
        print("2. Verify trusted sources configuration in DigitalOcean")
        print("3. Try connecting from a DigitalOcean droplet in the same region")
        print("4. Consider using local Redis for development:")
        print("   docker run -d -p 6379:6379 redis:alpine")
        print("   Then set REDIS_URL=redis://localhost:6379/0")

if __name__ == "__main__":
    main()