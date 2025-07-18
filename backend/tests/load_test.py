import asyncio
import aiohttp
import time
import statistics
from typing import List, Dict, Any, Optional
import json
from datetime import datetime
import argparse
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

class LoadTester:
    """Load testing for Fynlo POS API"""
    
    def __init__(self, base_url: str, auth_token: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.headers = {
            "Content-Type": "application/json"
        }
        if auth_token:
            self.headers["Authorization"] = f"Bearer {auth_token}"
        self.results: List[Dict] = []
        self.errors: List[Dict] = []
    
    async def authenticate(self, email: str, password: str) -> Optional[str]:
        """Authenticate and get access token"""
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"{self.base_url}/api/v1/auth/login",
                    json={"email": email, "password": password}
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        token = data.get("data", {}).get("tokens", {}).get("access_token")
                        if token:
                            self.headers["Authorization"] = f"Bearer {token}"
                            print(f"✅ Authentication successful")
                            return token
                    else:
                        print(f"❌ Authentication failed: {response.status}")
                        return None
            except Exception as e:
                print(f"❌ Authentication error: {e}")
                return None
    
    async def run_test(
        self,
        endpoint: str,
        method: str = "GET",
        payload: Optional[Dict] = None,
        num_requests: int = 100,
        concurrent_requests: int = 10,
        test_name: Optional[str] = None
    ):
        """Run load test on specific endpoint"""
        test_name = test_name or f"{method} {endpoint}"
        print(f"\n🧪 Testing: {test_name}")
        print(f"📊 Requests: {num_requests}, Concurrent: {concurrent_requests}")
        
        start_time = time.time()
        
        # Create semaphore for controlling concurrency
        semaphore = asyncio.Semaphore(concurrent_requests)
        
        # Create tasks
        tasks = []
        for i in range(num_requests):
            task = self._make_request(
                semaphore,
                endpoint,
                method,
                payload,
                i
            )
            tasks.append(task)
        
        # Execute all tasks
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        total_time = time.time() - start_time
        
        # Analyze results
        successful_requests = [r for r in results if isinstance(r, dict) and r.get("success")]
        failed_requests = [r for r in results if not isinstance(r, dict) or not r.get("success")]
        
        # Store errors for analysis
        for r in failed_requests:
            if isinstance(r, dict):
                self.errors.append({
                    "test": test_name,
                    "error": r.get("error", "Unknown error"),
                    "status_code": r.get("status_code")
                })
        
        response_times = [r["response_time"] for r in successful_requests]
        
        report = {
            "test_name": test_name,
            "endpoint": endpoint,
            "method": method,
            "total_requests": num_requests,
            "successful_requests": len(successful_requests),
            "failed_requests": len(failed_requests),
            "total_time": round(total_time, 2),
            "requests_per_second": round(num_requests / total_time, 2) if total_time > 0 else 0
        }
        
        if response_times:
            report["response_times"] = {
                "min": round(min(response_times), 2),
                "max": round(max(response_times), 2),
                "mean": round(statistics.mean(response_times), 2),
                "median": round(statistics.median(response_times), 2),
                "p95": round(statistics.quantiles(response_times, n=20)[18], 2) if len(response_times) > 20 else round(max(response_times), 2),
                "p99": round(statistics.quantiles(response_times, n=100)[98], 2) if len(response_times) > 100 else round(max(response_times), 2)
            }
        else:
            report["response_times"] = {
                "min": 0, "max": 0, "mean": 0, "median": 0, "p95": 0, "p99": 0
            }
        
        self.results.append(report)
        self._print_report(report)
        
        return report
    
    async def _make_request(
        self,
        semaphore: asyncio.Semaphore,
        endpoint: str,
        method: str,
        payload: Optional[Dict],
        request_id: int
    ) -> Dict:
        """Make individual request with timing"""
        async with semaphore:
            start_time = time.time()
            
            try:
                async with aiohttp.ClientSession() as session:
                    url = f"{self.base_url}{endpoint}"
                    
                    async with session.request(
                        method,
                        url,
                        headers=self.headers,
                        json=payload,
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as response:
                        response_time = (time.time() - start_time) * 1000
                        
                        # Read response body to ensure complete request
                        await response.text()
                        
                        return {
                            "success": response.status < 400,
                            "status_code": response.status,
                            "response_time": response_time,
                            "request_id": request_id
                        }
            
            except asyncio.TimeoutError:
                return {
                    "success": False,
                    "error": "Request timeout",
                    "response_time": (time.time() - start_time) * 1000,
                    "request_id": request_id
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "response_time": (time.time() - start_time) * 1000,
                    "request_id": request_id
                }
    
    def _print_report(self, report: Dict):
        """Print load test report"""
        print("\n" + "="*50)
        print(f"📊 {report['test_name']}")
        print(f"✅ Success Rate: {report['successful_requests']}/{report['total_requests']} "
              f"({report['successful_requests']/report['total_requests']*100:.1f}%)")
        print(f"⚡ RPS: {report['requests_per_second']}")
        
        if report['response_times']['mean'] > 0:
            print(f"⏱️  Response Times (ms):")
            print(f"   Min: {report['response_times']['min']}")
            print(f"   Median: {report['response_times']['median']}")
            print(f"   Mean: {report['response_times']['mean']}")
            print(f"   95th percentile: {report['response_times']['p95']}")
            print(f"   99th percentile: {report['response_times']['p99']}")
            print(f"   Max: {report['response_times']['max']}")
        print("="*50)
    
    async def run_comprehensive_test(self, restaurant_id: Optional[str] = None):
        """Run comprehensive load test on critical endpoints"""
        print("\n🚀 Starting Comprehensive Load Test")
        print("="*60)
        
        # Test scenarios
        test_scenarios = [
            # Authentication (lower concurrency)
            {
                "test_name": "User Authentication",
                "endpoint": "/api/v1/auth/login",
                "method": "POST",
                "payload": {
                    "email": "test@restaurant.com",
                    "password": "testpass123"
                },
                "num_requests": 50,
                "concurrent_requests": 5
            },
            
            # Health check (high concurrency)
            {
                "test_name": "Health Check",
                "endpoint": "/api/v1/health",
                "method": "GET",
                "num_requests": 200,
                "concurrent_requests": 50
            },
            
            # Menu loading (read-heavy)
            {
                "test_name": "Menu Loading",
                "endpoint": "/api/v1/menu",
                "method": "GET",
                "num_requests": 200,
                "concurrent_requests": 20
            },
            
            # Orders list (database-heavy)
            {
                "test_name": "Orders Listing",
                "endpoint": "/api/v1/orders",
                "method": "GET",
                "num_requests": 100,
                "concurrent_requests": 10
            },
            
            # Analytics (computation-heavy)
            {
                "test_name": "Analytics Dashboard",
                "endpoint": "/api/v1/analytics/dashboard/mobile",
                "method": "GET",
                "num_requests": 50,
                "concurrent_requests": 5
            }
        ]
        
        # Add restaurant-specific tests if ID provided
        if restaurant_id:
            test_scenarios.extend([
                {
                    "test_name": "Restaurant Settings",
                    "endpoint": f"/api/v1/restaurants/{restaurant_id}/settings",
                    "method": "GET",
                    "num_requests": 100,
                    "concurrent_requests": 10
                },
                {
                    "test_name": "WebSocket Stats",
                    "endpoint": "/api/v1/health/stats",
                    "method": "GET",
                    "num_requests": 100,
                    "concurrent_requests": 20
                }
            ])
        
        # Run all test scenarios
        for scenario in test_scenarios:
            await self.run_test(**scenario)
            await asyncio.sleep(2)  # Brief pause between tests
        
        # Generate final report
        self.generate_final_report()
    
    def generate_final_report(self):
        """Generate comprehensive test report"""
        timestamp = datetime.utcnow().isoformat()
        
        # Calculate overall statistics
        total_requests = sum(r["total_requests"] for r in self.results)
        total_successful = sum(r["successful_requests"] for r in self.results)
        overall_success_rate = (total_successful / total_requests * 100) if total_requests > 0 else 0
        
        # Find slowest endpoint
        slowest_endpoint = max(
            self.results,
            key=lambda r: r["response_times"]["p95"] if r["response_times"]["p95"] > 0 else 0
        ) if self.results else None
        
        report = {
            "timestamp": timestamp,
            "base_url": self.base_url,
            "test_results": self.results,
            "errors_summary": self._summarize_errors(),
            "summary": {
                "total_endpoints_tested": len(self.results),
                "total_requests": total_requests,
                "total_successful": total_successful,
                "overall_success_rate": round(overall_success_rate, 2),
                "slowest_endpoint": slowest_endpoint["test_name"] if slowest_endpoint else "N/A",
                "slowest_p95": slowest_endpoint["response_times"]["p95"] if slowest_endpoint else 0
            }
        }
        
        # Save report
        report_filename = f"load_test_report_{int(time.time())}.json"
        with open(report_filename, "w") as f:
            json.dump(report, f, indent=2)
        
        print("\n\n" + "="*60)
        print("📊 FINAL LOAD TEST SUMMARY")
        print("="*60)
        print(f"⏰ Timestamp: {timestamp}")
        print(f"🎯 Endpoints Tested: {report['summary']['total_endpoints_tested']}")
        print(f"📨 Total Requests: {report['summary']['total_requests']}")
        print(f"✅ Success Rate: {report['summary']['overall_success_rate']}%")
        print(f"🐌 Slowest Endpoint: {report['summary']['slowest_endpoint']} ({report['summary']['slowest_p95']}ms p95)")
        
        if self.errors:
            print(f"\n⚠️  Total Errors: {len(self.errors)}")
            error_summary = self._summarize_errors()
            for error_type, count in error_summary.items():
                print(f"   - {error_type}: {count}")
        
        print(f"\n💾 Full report saved to: {report_filename}")
        print("="*60)
    
    def _summarize_errors(self) -> Dict[str, int]:
        """Summarize errors by type"""
        error_summary = {}
        for error in self.errors:
            error_type = error.get("error", "Unknown")
            if error_type not in error_summary:
                error_summary[error_type] = 0
            error_summary[error_type] += 1
        return error_summary


# CLI entry point
async def main():
    parser = argparse.ArgumentParser(description="Fynlo POS Load Testing Tool")
    parser.add_argument("--url", default="http://localhost:8000", help="Base URL of the API")
    parser.add_argument("--email", default="admin@fynlo.com", help="Login email")
    parser.add_argument("--password", default="admin123", help="Login password")
    parser.add_argument("--restaurant-id", help="Restaurant ID for specific tests")
    parser.add_argument("--endpoint", help="Test specific endpoint")
    parser.add_argument("--method", default="GET", help="HTTP method")
    parser.add_argument("--requests", type=int, default=100, help="Number of requests")
    parser.add_argument("--concurrent", type=int, default=10, help="Concurrent requests")
    parser.add_argument("--comprehensive", action="store_true", help="Run comprehensive test suite")
    
    args = parser.parse_args()
    
    # Initialize tester
    tester = LoadTester(args.url)
    
    # Authenticate
    print(f"🔐 Authenticating with {args.email}...")
    token = await tester.authenticate(args.email, args.password)
    
    if not token:
        print("❌ Authentication failed. Exiting.")
        return
    
    # Run tests
    if args.comprehensive or not args.endpoint:
        await tester.run_comprehensive_test(args.restaurant_id)
    else:
        await tester.run_test(
            endpoint=args.endpoint,
            method=args.method,
            num_requests=args.requests,
            concurrent_requests=args.concurrent
        )


if __name__ == "__main__":
    asyncio.run(main())