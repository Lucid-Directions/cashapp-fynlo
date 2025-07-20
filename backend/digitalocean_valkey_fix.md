# DigitalOcean Valkey Connection Fix

## Problem
The current Redis client is failing to connect to DigitalOcean Valkey with a timeout error, even with correct credentials.

## Root Cause
DigitalOcean Valkey requires specific SSL/TLS configuration that our current implementation doesn't fully support. The issue is likely:

1. **SSL Context**: Simply setting `ssl_cert_reqs='none'` is not sufficient
2. **Connection Timeouts**: 5-second timeout may be too short for initial SSL handshake
3. **Retry Logic**: No retry mechanism for transient network issues

## Solution

### Option 1: Enhanced SSL Configuration (Recommended)

Update `/backend/app/core/redis_client.py` in the `connect` method:

```python
# Replace lines 57-59 with:
if settings.REDIS_URL.startswith('rediss://'):
    import ssl
    # Create SSL context for DigitalOcean
    ssl_context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    connection_kwargs.update({
        'ssl': ssl_context,
        'ssl_cert_reqs': None,
        'ssl_check_hostname': False,
    })
```

### Option 2: Increase Timeouts and Add Retry

Update the connection kwargs:

```python
connection_kwargs = {
    'decode_responses': True,
    'max_connections': 20,
    'socket_connect_timeout': 15,  # Increased from 5
    'socket_timeout': 15,  # Increased from 5
    'retry_on_timeout': True,
    'health_check_interval': 30,
}
```

### Option 3: Test Connection String Format

The documentation suggests the connection might need explicit database selection:

```
rediss://default:AVNS_ZSfCiU1eo6lTVbr410O@private-fynlo-pos-cache-do-user-23457625-0.i.db.ondigitalocean.com:25061/0
```

Note the `/0` at the end for database 0.

### Option 4: Use Public Hostname

If the private hostname isn't accessible from App Platform, try the public hostname:

```
rediss://default:AVNS_ZSfCiU1eo6lTVbr410O@fynlo-pos-cache-do-user-23457625-0.i.db.ondigitalocean.com:25061
```

(Remove the "private-" prefix)

## Testing the Connection

Create a simple test script to verify the connection:

```python
import asyncio
import redis.asyncio as aioredis
import ssl
import os

async def test_connection():
    redis_url = os.getenv('REDIS_URL')
    
    # Test 1: Basic connection
    try:
        client = aioredis.from_url(redis_url, decode_responses=True)
        await client.ping()
        print("✅ Basic connection successful")
        await client.close()
    except Exception as e:
        print(f"❌ Basic connection failed: {e}")
    
    # Test 2: With SSL context
    try:
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        client = aioredis.from_url(
            redis_url, 
            decode_responses=True,
            ssl=ssl_context,
            socket_connect_timeout=15
        )
        await client.ping()
        print("✅ SSL context connection successful")
        await client.close()
    except Exception as e:
        print(f"❌ SSL context connection failed: {e}")

asyncio.run(test_connection())
```

## Verification Steps

1. **Check App Platform Networking**:
   - Ensure the app is in the same region as the Valkey database
   - Verify VPC configuration allows internal communication

2. **Test from App Console**:
   - SSH into the app container if possible
   - Run the test script above

3. **Check Trusted Sources**:
   - In DigitalOcean Valkey settings, ensure "App Platform" is in trusted sources
   - Or temporarily add "0.0.0.0/0" for testing (remove after!)

## Most Likely Fix

Based on DigitalOcean's requirements and common issues, the most likely fix is:

1. Use the enhanced SSL configuration (Option 1)
2. Increase timeouts to 15 seconds
3. Ensure the connection string ends with `/0` for database selection
4. Use the public hostname if private isn't working