#!/usr/bin/env python3
"""
Test script to verify performance optimizations
Run this after starting the backend to ensure all optimizations are working
"""

import asyncio
import aiohttp
import time
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

async def test_performance_optimizations(base_url: str = "http://localhost:8000"):
    """Test all performance optimization components"""
    
    print("🧪 Testing Performance Optimizations")
    print("="*50)
    
    async with aiohttp.ClientSession() as session:
        # 1. Test basic health check
        print("\n1️⃣ Testing basic health check...")
        try:
            start = time.time()
            async with session.get(f"{base_url}/api/v1/health") as resp:
                if resp.status == 200:
                    elapsed = (time.time() - start) * 1000
                    print(f"✅ Health check successful ({elapsed:.2f}ms)")
                else:
                    print(f"❌ Health check failed: {resp.status}")
        except Exception as e:
            print(f"❌ Health check error: {e}")
        
        # 2. Login to get auth token
        print("\n2️⃣ Authenticating...")
        auth_token = None
        try:
            async with session.post(
                f"{base_url}/api/v1/auth/login",
                json={"email": "admin@fynlo.com", "password": "admin123"}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    auth_token = data.get("data", {}).get("tokens", {}).get("access_token")
                    if auth_token:
                        print("✅ Authentication successful")
                    else:
                        print("❌ No auth token received")
                        return
                else:
                    print(f"❌ Authentication failed: {resp.status}")
                    return
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return
        
        # Setup headers with auth
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # 3. Test performance metrics endpoint
        print("\n3️⃣ Testing performance metrics endpoint...")
        try:
            async with session.get(f"{base_url}/api/v1/health/performance", headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    perf_data = data.get("data", {})
                    
                    # Display query stats
                    db_stats = perf_data.get("database", {})
                    print(f"✅ Performance metrics retrieved:")
                    print(f"   - Query patterns tracked: {len(db_stats.get('query_patterns', []))}")
                    print(f"   - Slow queries: {db_stats.get('slow_query_count', 0)}")
                    print(f"   - Threshold: {db_stats.get('slow_query_threshold_ms', 0)}ms")
                    
                    # Display cache stats
                    cache_stats = perf_data.get("cache", {})
                    print(f"   - Cache hits: {cache_stats.get('hits', 0)}")
                    print(f"   - Cache misses: {cache_stats.get('misses', 0)}")
                    print(f"   - Hit rate: {cache_stats.get('hit_rate_percentage', 0)}%")
                    
                    # Display recommendations
                    recommendations = perf_data.get("recommendations", {})
                    for level, items in recommendations.items():
                        if items:
                            print(f"   - {level.upper()}: {len(items)} recommendations")
                else:
                    print(f"❌ Performance metrics failed: {resp.status}")
        except Exception as e:
            print(f"❌ Performance metrics error: {e}")
        
        # 4. Test menu endpoint (should use cache)
        print("\n4️⃣ Testing menu endpoint (cache test)...")
        menu_times = []
        for i in range(3):
            try:
                start = time.time()
                async with session.get(f"{base_url}/api/v1/menu", headers=headers) as resp:
                    if resp.status == 200:
                        elapsed = (time.time() - start) * 1000
                        menu_times.append(elapsed)
                        print(f"   Request {i+1}: {elapsed:.2f}ms")
                    else:
                        print(f"❌ Menu request {i+1} failed: {resp.status}")
            except Exception as e:
                print(f"❌ Menu request {i+1} error: {e}")
        
        if len(menu_times) >= 2:
            if menu_times[1] < menu_times[0] * 0.5:  # Second request should be much faster
                print("✅ Cache appears to be working (subsequent requests faster)")
            else:
                print("⚠️  Cache may not be working optimally")
        
        # 5. Test WebSocket monitoring
        print("\n5️⃣ Testing WebSocket stats...")
        try:
            async with session.get(f"{base_url}/api/v1/health/stats") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    stats = data.get("data", {})
                    ws_stats = stats.get("websocket", {})
                    print(f"✅ WebSocket stats retrieved:")
                    print(f"   - Active connections: {ws_stats.get('active_connections', 0)}")
                    print(f"   - Total connections: {ws_stats.get('total_connections', 0)}")
                else:
                    print(f"❌ WebSocket stats failed: {resp.status}")
        except Exception as e:
            print(f"❌ WebSocket stats error: {e}")
        
        # 6. Test system metrics
        print("\n6️⃣ Testing system metrics...")
        try:
            async with session.get(f"{base_url}/api/v1/health/metrics", headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    metrics = data.get("data", {})
                    api_metrics = metrics.get("api", {})
                    print(f"✅ System metrics retrieved:")
                    print(f"   - Requests/hour: {api_metrics.get('requests_per_hour', 0)}")
                    print(f"   - Errors/hour: {api_metrics.get('errors_per_hour', 0)}")
                    print(f"   - Error rate: {api_metrics.get('error_rate', 0):.2%}")
                    
                    percentiles = api_metrics.get("response_time_percentiles", {})
                    if percentiles:
                        print(f"   - Response times:")
                        print(f"     • p50: {percentiles.get('p50', 0):.2f}ms")
                        print(f"     • p95: {percentiles.get('p95', 0):.2f}ms")
                        print(f"     • p99: {percentiles.get('p99', 0):.2f}ms")
                else:
                    print(f"❌ System metrics failed: {resp.status}")
        except Exception as e:
            print(f"❌ System metrics error: {e}")
    
    print("\n" + "="*50)
    print("✅ Performance optimization tests complete!")
    print("\nℹ️  Note: Run load tests for comprehensive performance analysis")
    print("   python tests/load_test.py --comprehensive")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Test performance optimizations")
    parser.add_argument("--url", default="http://localhost:8000", help="Base URL of the API")
    args = parser.parse_args()
    
    asyncio.run(test_performance_optimizations(args.url))