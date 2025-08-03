#!/usr/bin/env python3
"""
Test script for replica monitoring system.
Verifies that instance tracking and monitoring endpoints are working correctly.
"""

import asyncio
import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.redis_client import redis_client
from app.services.instance_tracker import InstanceTracker
from app.services.digitalocean_monitor import DigitalOceanMonitor


async def test_instance_tracking():
    """Test instance tracking functionality."""
    logger.info("\n=== Testing Instance Tracking ===")
    
    # Initialize Redis
    await redis_client.connect()
    
    # Create instance tracker
    tracker = InstanceTracker(redis_client)
    
    logger.info(f"Instance ID: {tracker.instance_id}")
    logger.info(f"Starting instance tracker...")
    
    # Start tracking
    await tracker.start()
    
    # Wait a bit for registration
    await asyncio.sleep(2)
    
    # Get active instances
    instances = await tracker.get_active_instances()
    logger.info(f"\nActive instances: {len(instances)}")
    
    for inst in instances:
        logger.info(f"  - {inst.get('instance_id')} (last heartbeat: {inst.get('last_heartbeat')})")
    
    # Get instance count
    counts = await tracker.get_instance_count()
    logger.info(f"\nInstance counts:")
    logger.info(f"  Active: {counts['active']}")
    logger.info(f"  Stale: {counts['stale']}")
    logger.info(f"  Total: {counts['total']}")
    
    # Stop tracking
    await tracker.stop()
    
    # Close Redis
    await redis_client.disconnect()
    
    logger.info("\n✅ Instance tracking test completed")


async def test_digitalocean_monitor():
    """Test DigitalOcean monitoring functionality."""
    logger.info("\n=== Testing DigitalOcean Monitor ===")
    
    monitor = DigitalOceanMonitor()
    
    # Check if configured
    if not (os.environ.get("DO_API_TOKEN") and os.environ.get("DO_APP_ID")):
        logger.info("⚠️  DO_API_TOKEN and DO_APP_ID not configured")
        logger.info("   Set these environment variables to test DO monitoring")
        return
    
    logger.info("Testing DigitalOcean API connection...")
    
    # Get app info
    app_info = await monitor.get_app_info()
    if "error" in app_info:
        logger.error(f"❌ Error: {app_info['error']}")
        return
    
    logger.info("✅ Connected to DigitalOcean API")
    
    # Get replica info
    replica_info = await monitor.get_actual_replicas()
    if "error" not in replica_info:
        logger.info(f"\nReplica Information:")
        logger.info(f"  Service: {replica_info['service_name']}")
        logger.info(f"  Desired replicas: {replica_info['desired_replicas']}")
        logger.info(f"  Instance size: {replica_info['instance_size']}")
        logger.info(f"  Region: {replica_info['region']}")
        logger.info(f"  Deployment phase: {replica_info['deployment']['phase']}")
    
    # Get metrics summary
    metrics = await monitor.get_metrics_summary()
    if metrics.get("configured"):
        logger.info(f"\nApp Summary:")
        logger.info(f"  App ID: {metrics['app']['id']}")
        logger.info(f"  App Name: {metrics['app']['name']}")
        logger.info(f"  Region: {metrics['app']['region']}")
        logger.info(f"  Recent deployments: {len(metrics['recent_deployments'])}")
    
    logger.info("\n✅ DigitalOcean monitoring test completed")


async def test_health_endpoints():
    """Test health check endpoints (requires running server)."""
    logger.info("\n=== Testing Health Endpoints ===")
    logger.info("Note: This test requires the backend server to be running")
    logger.info("Start the server with: uvicorn app.main:app --reload")
    
    try:
        import httpx
import logging

logger = logging.getLogger(__name__)

        
        base_url = "http://localhost:8000"
        
        async with httpx.AsyncClient() as client:
            # Test basic health
            logger.info("\nTesting /health endpoint...")
            response = await client.get(f"{base_url}/health")
            logger.info(f"  Status: {response.status_code}")
            logger.info(f"  Response: {response.json()}")
            
            # Test detailed health
            logger.info("\nTesting /api/v1/health/detailed endpoint...")
            response = await client.get(f"{base_url}/api/v1/health/detailed")
            if response.status_code == 200:
                data = response.json()
                logger.info(f"  Status: {data['data']['status']}")
                logger.info(f"  Instance ID: {data['data']['instance']['id']}")
                logger.info(f"  Uptime: {data['data']['system']['uptime_human']}")
            else:
                logger.info(f"  Status: {response.status_code} (auth may be required)")
            
            # Test instances endpoint
            logger.info("\nTesting /api/v1/health/instances endpoint...")
            response = await client.get(f"{base_url}/api/v1/health/instances")
            if response.status_code == 200:
                data = response.json()
                logger.info(f"  Desired replicas: {data['data']['desired_replicas']}")
                logger.info(f"  Active instances: {data['data']['active_instances']}")
            else:
                logger.info(f"  Status: {response.status_code} (auth may be required)")
                
    except Exception as e:
        logger.error(f"❌ Error testing endpoints: {e}")
        logger.info("   Make sure the backend server is running")
        return
    
    logger.info("\n✅ Health endpoint test completed")


async def main():
    """Run all tests."""
    logger.info("Fynlo Replica Monitoring Test Suite")
    logger.info("=" * 40)
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Redis URL: {settings.REDIS_URL}")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    
    # Test instance tracking
    await test_instance_tracking()
    
    # Test DO monitoring
    await test_digitalocean_monitor()
    
    # Test health endpoints
    await test_health_endpoints()
    
    logger.info("\n" + "=" * 40)
    logger.info("All tests completed!")


if __name__ == "__main__":
    asyncio.run(main())
