#!/usr/bin/env python3
"""
Fynlo POS Performance Baseline Script
Checks current app performance before optimization
"""

import requests
import time
import statistics
from datetime import datetime
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
BASE_URL = "https://fynlopos-9eg2c.ondigitalocean.app"
ENDPOINTS = {
    "health": "/health",
    "api_root": "/api/v1",
    "restaurants": "/api/v1/restaurants",
    "menu_categories": "/api/v1/menu/categories",
}

# Number of requests per endpoint for averaging
REQUESTS_PER_ENDPOINT = 10
CONCURRENT_REQUESTS = 5

def measure_endpoint(endpoint_name, endpoint_path, num_requests=10):
    """Measure response times for a specific endpoint"""
    url = f"{BASE_URL}{endpoint_path}"
    response_times = []
    errors = 0
    
    print(f"\nTesting {endpoint_name} ({url})...")
    
    for i in range(num_requests):
        try:
            start_time = time.time()
            response = requests.get(url, timeout=30)
            end_time = time.time()
            
            response_time = (end_time - start_time) * 1000  # Convert to ms
            response_times.append(response_time)
            
            if response.status_code != 200:
                print(f"  Request {i+1}: {response.status_code} - {response_time:.2f}ms")
                errors += 1
            else:
                print(f"  Request {i+1}: {response.status_code} - {response_time:.2f}ms")
                
        except requests.RequestException as e:
            print(f"  Request {i+1}: ERROR - {str(e)}")
            errors += 1
            
        # Small delay between requests
        time.sleep(0.5)
    
    if response_times:
        return {
            "endpoint": endpoint_name,
            "url": url,
            "requests": num_requests,
            "successful": len(response_times),
            "errors": errors,
            "avg_response_time": statistics.mean(response_times),
            "min_response_time": min(response_times),
            "max_response_time": max(response_times),
            "median_response_time": statistics.median(response_times),
            "std_deviation": statistics.stdev(response_times) if len(response_times) > 1 else 0
        }
    else:
        return {
            "endpoint": endpoint_name,
            "url": url,
            "requests": num_requests,
            "successful": 0,
            "errors": errors,
            "status": "All requests failed"
        }

def concurrent_load_test(endpoint_path="/health", num_concurrent=5, total_requests=20):
    """Test endpoint under concurrent load"""
    url = f"{BASE_URL}{endpoint_path}"
    response_times = []
    errors = 0
    
    print(f"\nConcurrent load test on {url}...")
    print(f"Concurrent requests: {num_concurrent}, Total requests: {total_requests}")
    
    def make_request(request_num):
        try:
            start_time = time.time()
            response = requests.get(url, timeout=30)
            end_time = time.time()
            
            response_time = (end_time - start_time) * 1000
            return {
                "request_num": request_num,
                "status_code": response.status_code,
                "response_time": response_time,
                "success": True
            }
        except Exception as e:
            return {
                "request_num": request_num,
                "error": str(e),
                "success": False
            }
    
    with ThreadPoolExecutor(max_workers=num_concurrent) as executor:
        futures = [executor.submit(make_request, i) for i in range(total_requests)]
        
        for future in as_completed(futures):
            result = future.result()
            if result["success"]:
                response_times.append(result["response_time"])
                print(f"  Request {result['request_num']}: {result['status_code']} - {result['response_time']:.2f}ms")
            else:
                errors += 1
                print(f"  Request {result['request_num']}: ERROR - {result['error']}")
    
    if response_times:
        return {
            "test_type": "concurrent_load",
            "endpoint": endpoint_path,
            "concurrent_requests": num_concurrent,
            "total_requests": total_requests,
            "successful": len(response_times),
            "errors": errors,
            "avg_response_time": statistics.mean(response_times),
            "min_response_time": min(response_times),
            "max_response_time": max(response_times),
            "median_response_time": statistics.median(response_times),
            "p95_response_time": sorted(response_times)[int(len(response_times) * 0.95)] if len(response_times) > 20 else max(response_times)
        }
    else:
        return {
            "test_type": "concurrent_load",
            "endpoint": endpoint_path,
            "status": "All requests failed"
        }

def main():
    print("=" * 60)
    print("Fynlo POS Performance Baseline Test")
    print(f"Target: {BASE_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    results = {
        "timestamp": datetime.now().isoformat(),
        "base_url": BASE_URL,
        "endpoint_tests": [],
        "load_test": None,
        "summary": {}
    }
    
    # Test individual endpoints
    for endpoint_name, endpoint_path in ENDPOINTS.items():
        result = measure_endpoint(endpoint_name, endpoint_path, REQUESTS_PER_ENDPOINT)
        results["endpoint_tests"].append(result)
    
    # Concurrent load test on health endpoint
    load_result = concurrent_load_test("/health", CONCURRENT_REQUESTS, 20)
    results["load_test"] = load_result
    
    # Calculate summary
    successful_tests = [t for t in results["endpoint_tests"] if "avg_response_time" in t]
    if successful_tests:
        results["summary"] = {
            "total_endpoints_tested": len(ENDPOINTS),
            "successful_endpoints": len(successful_tests),
            "overall_avg_response_time": statistics.mean([t["avg_response_time"] for t in successful_tests]),
            "fastest_endpoint": min(successful_tests, key=lambda x: x["avg_response_time"])["endpoint"],
            "slowest_endpoint": max(successful_tests, key=lambda x: x["avg_response_time"])["endpoint"],
            "recommendation": "BASELINE ESTABLISHED"
        }
    
    # Print summary
    print("\n" + "=" * 60)
    print("PERFORMANCE SUMMARY")
    print("=" * 60)
    
    for test in results["endpoint_tests"]:
        if "avg_response_time" in test:
            print(f"\n{test['endpoint']}:")
            print(f"  Average: {test['avg_response_time']:.2f}ms")
            print(f"  Min: {test['min_response_time']:.2f}ms")
            print(f"  Max: {test['max_response_time']:.2f}ms")
            print(f"  Success Rate: {(test['successful']/test['requests'])*100:.1f}%")
    
    if results["load_test"] and "avg_response_time" in results["load_test"]:
        print(f"\nConcurrent Load Test:")
        print(f"  Average: {results['load_test']['avg_response_time']:.2f}ms")
        print(f"  P95: {results['load_test']['p95_response_time']:.2f}ms")
        print(f"  Success Rate: {(results['load_test']['successful']/results['load_test']['total_requests'])*100:.1f}%")
    
    # Save results
    output_file = f"performance-baseline-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to: {output_file}")
    
    # Performance recommendations
    print("\n" + "=" * 60)
    print("PERFORMANCE ANALYSIS")
    print("=" * 60)
    
    if results["summary"]:
        avg_response = results["summary"]["overall_avg_response_time"]
        if avg_response < 200:
            print("✅ EXCELLENT: Average response time is under 200ms")
            print("   Safe to proceed with optimization")
        elif avg_response < 500:
            print("⚠️  GOOD: Average response time is under 500ms")
            print("   Monitor closely during optimization")
        else:
            print("❌ CONCERN: Average response time is over 500ms")
            print("   Consider performance improvements before downsizing")

if __name__ == "__main__":
    main()