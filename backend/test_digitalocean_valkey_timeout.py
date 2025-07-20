#!/usr/bin/env python3
"""
Diagnostic script for DigitalOcean Valkey timeout issues
Tests various connection methods to identify the problem
"""

import asyncio
import os
import ssl
import socket
import time
from urllib.parse import urlparse
import redis
import redis.asyncio as aioredis

def test_socket_connectivity(host, port, timeout=10):
    """Test basic TCP connectivity"""
    print(f"\n🔌 Testing socket connectivity to {host}:{port}")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    
    try:
        start = time.time()
        sock.connect((host, port))
        elapsed = time.time() - start
        print(f"✅ Socket connected in {elapsed:.2f} seconds")
        sock.close()
        return True
    except socket.timeout:
        print(f"❌ Socket connection timed out after {timeout} seconds")
        return False
    except Exception as e:
        print(f"❌ Socket connection failed: {type(e).__name__}: {e}")
        return False

def test_ssl_handshake(host, port, timeout=10):
    """Test SSL/TLS handshake"""
    print(f"\n🔒 Testing SSL handshake to {host}:{port}")
    
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    
    try:
        start = time.time()
        sock.connect((host, port))
        ssock = context.wrap_socket(sock, server_hostname=host)
        elapsed = time.time() - start
        print(f"✅ SSL handshake successful in {elapsed:.2f} seconds")
        print(f"   Protocol: {ssock.version()}")
        print(f"   Cipher: {ssock.cipher()}")
        ssock.close()
        return True
    except socket.timeout:
        print(f"❌ SSL handshake timed out after {timeout} seconds")
        return False
    except Exception as e:
        print(f"❌ SSL handshake failed: {type(e).__name__}: {e}")
        return False

def test_sync_redis(redis_url, timeout=30):
    """Test synchronous Redis connection"""
    print(f"\n🔄 Testing sync Redis connection (timeout={timeout}s)")
    
    try:
        start = time.time()
        # Simple connection letting redis-py handle SSL from URL
        client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=timeout,
            socket_timeout=timeout,
            retry_on_timeout=True
        )
        
        result = client.ping()
        elapsed = time.time() - start
        print(f"✅ Sync Redis connected in {elapsed:.2f} seconds: {result}")
        client.close()
        return True
    except redis.TimeoutError:
        elapsed = time.time() - start
        print(f"❌ Sync Redis timed out after {elapsed:.2f} seconds")
        return False
    except Exception as e:
        elapsed = time.time() - start
        print(f"❌ Sync Redis failed after {elapsed:.2f} seconds: {type(e).__name__}: {e}")
        return False

async def test_async_redis(redis_url, timeout=30):
    """Test async Redis connection"""
    print(f"\n⚡ Testing async Redis connection (timeout={timeout}s)")
    
    try:
        start = time.time()
        # Simple connection
        client = await aioredis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=timeout,
            socket_timeout=timeout,
            retry_on_timeout=True
        )
        
        result = await asyncio.wait_for(client.ping(), timeout=timeout)
        elapsed = time.time() - start
        print(f"✅ Async Redis connected in {elapsed:.2f} seconds: {result}")
        await client.close()
        return True
    except asyncio.TimeoutError:
        elapsed = time.time() - start
        print(f"❌ Async Redis timed out after {elapsed:.2f} seconds")
        return False
    except Exception as e:
        elapsed = time.time() - start
        print(f"❌ Async Redis failed after {elapsed:.2f} seconds: {type(e).__name__}: {e}")
        return False

async def test_redis_with_ssl_params(redis_url, timeout=30):
    """Test Redis with explicit SSL parameters"""
    print(f"\n🔐 Testing Redis with explicit SSL params (timeout={timeout}s)")
    
    try:
        start = time.time()
        client = await aioredis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=timeout,
            socket_timeout=timeout,
            retry_on_timeout=True,
            ssl_cert_reqs='none',
            ssl_check_hostname=False
        )
        
        result = await asyncio.wait_for(client.ping(), timeout=timeout)
        elapsed = time.time() - start
        print(f"✅ Redis with SSL params connected in {elapsed:.2f} seconds: {result}")
        await client.close()
        return True
    except Exception as e:
        elapsed = time.time() - start
        print(f"❌ Redis with SSL params failed after {elapsed:.2f} seconds: {type(e).__name__}: {e}")
        return False

async def main():
    redis_url = os.getenv('REDIS_URL')
    if not redis_url:
        print("❌ REDIS_URL environment variable not set")
        print("Set it with: export REDIS_URL='rediss://...'")
        return
    
    parsed = urlparse(redis_url)
    host = parsed.hostname
    port = parsed.port or (6380 if parsed.scheme == 'rediss' else 6379)
    
    print(f"🚀 DigitalOcean Valkey Connection Diagnostics")
    print(f"="*50)
    print(f"URL: {parsed.scheme}://{parsed.username}:****@{host}:{port}")
    print(f"SSL Required: {parsed.scheme == 'rediss'}")
    
    # Run tests
    socket_ok = test_socket_connectivity(host, port, timeout=10)
    
    if socket_ok and parsed.scheme == 'rediss':
        ssl_ok = test_ssl_handshake(host, port, timeout=10)
    else:
        ssl_ok = True  # Skip SSL test for non-SSL connections
    
    if socket_ok:
        sync_ok = test_sync_redis(redis_url, timeout=30)
        async_ok = await test_async_redis(redis_url, timeout=30)
        
        if not async_ok and parsed.scheme == 'rediss':
            ssl_params_ok = await test_redis_with_ssl_params(redis_url, timeout=30)
    
    # Summary
    print(f"\n📊 Summary")
    print(f"="*50)
    print(f"Socket connectivity: {'✅' if socket_ok else '❌'}")
    if parsed.scheme == 'rediss':
        print(f"SSL handshake: {'✅' if ssl_ok else '❌'}")
    print(f"Sync Redis: {'✅' if 'sync_ok' in locals() and sync_ok else '❌'}")
    print(f"Async Redis: {'✅' if 'async_ok' in locals() and async_ok else '❌'}")
    
    # Recommendations
    print(f"\n💡 Recommendations")
    print(f"="*50)
    if not socket_ok:
        print("- Check if the Redis host is accessible from your network")
        print("- Verify firewall rules and VPC settings in DigitalOcean")
        print("- Try using the public hostname instead of private")
    elif parsed.scheme == 'rediss' and not ssl_ok:
        print("- SSL handshake is failing, check DigitalOcean SSL configuration")
        print("- Ensure the Redis port is correct for SSL (usually 25061)")
    elif 'async_ok' in locals() and not async_ok:
        print("- Redis client can't connect, but network is OK")
        print("- Try increasing timeouts further")
        print("- Check Redis authentication credentials")
        print("- Verify the Redis URL format is correct")

if __name__ == "__main__":
    asyncio.run(main())