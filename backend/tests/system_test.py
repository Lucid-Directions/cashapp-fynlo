#!/usr/bin/env python3
"""
System Integration Test for Fynlo POS
Comprehensive end-to-end testing of all system components
"""

import asyncio
import aiohttp
import websockets
import json
import time
import sys
from typing import Dict, List, Optional, Any
from datetime import datetime
import argparse


class SystemIntegrationTest:
    """End-to-end system integration test"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.ws_url = base_url.replace("http", "ws")
        self.test_results = []
        self.auth_token = None
        self.test_user = {
            "email": "test@restaurant.com",
            "password": "testpass123"
        }
        self.test_data = {}
    
    async def run_all_tests(self) -> bool:
        """Run complete system integration test"""
        print("🧪 Starting System Integration Tests")
        print(f"Target: {self.base_url}")
        print("=" * 50)
        
        start_time = time.time()
        
        # Test suite
        test_suites = [
            ("Infrastructure", self.test_infrastructure),
            ("Authentication", self.test_authentication),
            ("API Endpoints", self.test_api_endpoints),
            ("WebSocket", self.test_websocket),
            ("Real-time Flow", self.test_realtime_flow),
            ("Performance", self.test_performance),
            ("Error Handling", self.test_error_handling),
            ("Data Integrity", self.test_data_integrity)
        ]
        
        for suite_name, test_func in test_suites:
            print(f"\n📋 Testing {suite_name}...")
            try:
                await test_func()
            except Exception as e:
                self._record_result(
                    f"{suite_name} Suite",
                    False,
                    f"Suite failed with error: {str(e)}"
                )
        
        # Generate report
        elapsed_time = time.time() - start_time
        self.generate_test_report(elapsed_time)
        
        return all(r["passed"] for r in self.test_results)
    
    async def test_infrastructure(self):
        """Test basic infrastructure components"""
        async with aiohttp.ClientSession() as session:
            # Test basic health
            await self._test_endpoint(
                session,
                "GET",
                "/api/v1/health",
                "Basic Health Check",
                expected_status=200
            )
            
            # Test detailed health
            result = await self._test_endpoint(
                session,
                "GET",
                "/api/v1/health/detailed",
                "Detailed Health Check",
                expected_status=200
            )
            
            if result and result.get("success"):
                data = result.get("data", {})
                components = data.get("data", {}).get("components", {})
                
                # Check individual components
                for component, status in components.items():
                    if isinstance(status, dict):
                        is_healthy = status.get("status") == "healthy"
                        self._record_result(
                            f"{component.title()} Health",
                            is_healthy,
                            f"Status: {status.get('status', 'unknown')}"
                        )
    
    async def test_authentication(self):
        """Test authentication flow"""
        async with aiohttp.ClientSession() as session:
            # Test login
            result = await self._test_endpoint(
                session,
                "POST",
                "/api/v1/auth/login",
                "User Login",
                json=self.test_user,
                expected_status=200
            )
            
            if result and result.get("success"):
                data = result.get("data", {})
                self.auth_token = data.get("data", {}).get("access_token")
                
                if self.auth_token:
                    self._record_result("Token Generation", True, "Access token received")
                    
                    # Test token validation
                    headers = {"Authorization": f"Bearer {self.auth_token}"}
                    await self._test_endpoint(
                        session,
                        "GET",
                        "/api/v1/auth/me",
                        "Token Validation",
                        headers=headers,
                        expected_status=200
                    )
                else:
                    self._record_result("Token Generation", False, "No access token received")
    
    async def test_api_endpoints(self):
        """Test critical API endpoints"""
        if not self.auth_token:
            self._record_result("API Endpoints", False, "No auth token available")
            return
        
        async with aiohttp.ClientSession() as session:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Test menu endpoint
            result = await self._test_endpoint(
                session,
                "GET",
                "/api/v1/menu",
                "Menu Loading",
                headers=headers,
                expected_status=200
            )
            
            if result and result.get("success"):
                menu_data = result.get("data", {}).get("data", {})
                self.test_data["menu"] = menu_data
                
                if menu_data.get("categories"):
                    self._record_result(
                        "Menu Data",
                        True,
                        f"Found {len(menu_data['categories'])} categories"
                    )
            
            # Test order creation
            if self.test_data.get("menu", {}).get("items"):
                test_item = self.test_data["menu"]["items"][0]
                order_data = {
                    "items": [{
                        "product_id": test_item["id"],
                        "quantity": 2,
                        "unit_price": test_item["price"]
                    }],
                    "table_number": "5",
                    "customer_notes": "Integration test order"
                }
                
                result = await self._test_endpoint(
                    session,
                    "POST",
                    "/api/v1/orders",
                    "Order Creation",
                    headers=headers,
                    json=order_data,
                    expected_status=201
                )
                
                if result and result.get("success"):
                    order_id = result.get("data", {}).get("data", {}).get("id")
                    self.test_data["order_id"] = order_id
            
            # Test other critical endpoints
            endpoints = [
                ("/api/v1/employees", "Employee List"),
                ("/api/v1/analytics/dashboard", "Analytics Dashboard"),
                ("/api/v1/inventory", "Inventory Status"),
                ("/api/v1/health/metrics", "System Metrics")
            ]
            
            for endpoint, test_name in endpoints:
                await self._test_endpoint(
                    session,
                    "GET",
                    endpoint,
                    test_name,
                    headers=headers,
                    expected_status=200
                )
    
    async def test_websocket(self):
        """Test WebSocket connectivity"""
        if not self.auth_token:
            self._record_result("WebSocket", False, "No auth token available")
            return
        
        try:
            ws_uri = f"{self.ws_url}/api/v1/websocket/ws/test123?token={self.auth_token}"
            
            async with websockets.connect(ws_uri) as websocket:
                # Send ping
                await websocket.send(json.dumps({"type": "ping"}))
                
                # Wait for pong
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)
                
                if data.get("type") == "pong":
                    self._record_result("WebSocket Ping/Pong", True, "Heartbeat working")
                else:
                    self._record_result("WebSocket Ping/Pong", False, f"Unexpected response: {data}")
                
                # Test subscription
                await websocket.send(json.dumps({
                    "type": "subscribe",
                    "channel": "orders"
                }))
                
                self._record_result("WebSocket Connection", True, "Connected and responsive")
                
        except Exception as e:
            self._record_result("WebSocket Connection", False, str(e))
    
    async def test_realtime_flow(self):
        """Test real-time order flow with WebSocket updates"""
        if not self.auth_token or not self.test_data.get("menu"):
            self._record_result("Real-time Flow", False, "Prerequisites not met")
            return
        
        try:
            # Connect WebSocket
            ws_uri = f"{self.ws_url}/api/v1/websocket/ws/restaurant123?token={self.auth_token}"
            
            async with websockets.connect(ws_uri) as websocket:
                # Subscribe to orders
                await websocket.send(json.dumps({
                    "type": "subscribe",
                    "channel": "orders"
                }))
                
                # Create order via API
                async with aiohttp.ClientSession() as session:
                    headers = {"Authorization": f"Bearer {self.auth_token}"}
                    test_item = self.test_data["menu"]["items"][0]
                    
                    order_data = {
                        "items": [{
                            "product_id": test_item["id"],
                            "quantity": 1,
                            "unit_price": test_item["price"]
                        }],
                        "table_number": "RT-Test",
                        "customer_notes": "Real-time test"
                    }
                    
                    result = await self._test_endpoint(
                        session,
                        "POST",
                        "/api/v1/orders",
                        "Real-time Order Creation",
                        headers=headers,
                        json=order_data,
                        expected_status=201
                    )
                    
                    if result and result.get("success"):
                        order_id = result.get("data", {}).get("data", {}).get("id")
                        
                        # Wait for WebSocket notification
                        notification_received = False
                        start_time = time.time()
                        
                        while time.time() - start_time < 5.0:
                            try:
                                message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                                data = json.loads(message)
                                
                                if (data.get("type") == "order_created" and
                                    str(data.get("data", {}).get("id")) == str(order_id)):
                                    notification_received = True
                                    break
                            except asyncio.TimeoutError:
                                continue
                        
                        self._record_result(
                            "Real-time Notification",
                            notification_received,
                            "WebSocket notification received" if notification_received
                            else "Notification timeout"
                        )
                        
        except Exception as e:
            self._record_result("Real-time Flow", False, str(e))
    
    async def test_performance(self):
        """Test system performance metrics"""
        if not self.auth_token:
            self._record_result("Performance", False, "No auth token available")
            return
        
        async with aiohttp.ClientSession() as session:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Test response times for critical endpoints
            endpoints = [
                ("/api/v1/health", "Health Check", 100),
                ("/api/v1/menu", "Menu Loading", 500),
                ("/api/v1/orders", "Order List", 1000)
            ]
            
            for endpoint, name, threshold_ms in endpoints:
                start_time = time.time()
                
                result = await self._test_endpoint(
                    session,
                    "GET",
                    endpoint,
                    f"{name} Performance",
                    headers=headers if endpoint != "/api/v1/health" else None,
                    expected_status=200
                )
                
                response_time_ms = (time.time() - start_time) * 1000
                
                if result and result.get("success"):
                    passed = response_time_ms < threshold_ms
                    self._record_result(
                        f"{name} Response Time",
                        passed,
                        f"{response_time_ms:.2f}ms (threshold: {threshold_ms}ms)"
                    )
    
    async def test_error_handling(self):
        """Test error handling and validation"""
        async with aiohttp.ClientSession() as session:
            # Test invalid login
            await self._test_endpoint(
                session,
                "POST",
                "/api/v1/auth/login",
                "Invalid Login Handling",
                json={"email": "invalid@test.com", "password": "wrong"},
                expected_status=401
            )
            
            # Test missing auth
            await self._test_endpoint(
                session,
                "GET",
                "/api/v1/orders",
                "Missing Auth Handling",
                expected_status=401
            )
            
            if self.auth_token:
                headers = {"Authorization": f"Bearer {self.auth_token}"}
                
                # Test invalid order
                await self._test_endpoint(
                    session,
                    "POST",
                    "/api/v1/orders",
                    "Invalid Order Handling",
                    headers=headers,
                    json={"items": []},  # Empty order
                    expected_status=422
                )
    
    async def test_data_integrity(self):
        """Test data integrity and consistency"""
        if not self.auth_token:
            self._record_result("Data Integrity", False, "No auth token available")
            return
        
        async with aiohttp.ClientSession() as session:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Get performance metrics
            result = await self._test_endpoint(
                session,
                "GET",
                "/api/v1/health/performance",
                "Performance Metrics",
                headers=headers,
                expected_status=200
            )
            
            if result and result.get("success"):
                perf_data = result.get("data", {}).get("data", {})
                
                # Check cache stats
                cache_stats = perf_data.get("cache", {})
                if cache_stats:
                    hit_rate = cache_stats.get("hit_rate_percentage", 0)
                    self._record_result(
                        "Cache Performance",
                        hit_rate > 0 or cache_stats.get("total_requests", 0) == 0,
                        f"Hit rate: {hit_rate}%"
                    )
                
                # Check database stats
                db_stats = perf_data.get("database", {})
                if db_stats:
                    slow_queries = db_stats.get("slow_query_count", 0)
                    self._record_result(
                        "Database Performance",
                        slow_queries < 10,
                        f"Slow queries: {slow_queries}"
                    )
    
    async def _test_endpoint(
        self,
        session: aiohttp.ClientSession,
        method: str,
        endpoint: str,
        test_name: str,
        headers: Optional[Dict] = None,
        json: Optional[Dict] = None,
        expected_status: int = 200
    ) -> Optional[Dict]:
        """Test a single endpoint"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            async with session.request(
                method,
                url,
                headers=headers,
                json=json,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                status = response.status
                
                try:
                    data = await response.json()
                except:
                    data = {"error": "Invalid JSON response"}
                
                success = status == expected_status
                
                self._record_result(
                    test_name,
                    success,
                    f"Status: {status}" + (f" - {data.get('message', '')}" if not success else "")
                )
                
                return {"success": success, "status": status, "data": data}
                
        except Exception as e:
            self._record_result(test_name, False, f"Exception: {str(e)}")
            return None
    
    def _record_result(self, test_name: str, passed: bool, details: str):
        """Record test result"""
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        status = "✅" if passed else "❌"
        print(f"{status} {test_name}: {details}")
    
    def generate_test_report(self, elapsed_time: float):
        """Generate final test report"""
        print("\n" + "=" * 50)
        print("SYSTEM INTEGRATION TEST REPORT")
        print("=" * 50)
        
        passed_tests = sum(1 for r in self.test_results if r["passed"])
        total_tests = len(self.test_results)
        pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"\nTest Summary:")
        print(f"  Total Tests: {total_tests}")
        print(f"  Passed: {passed_tests}")
        print(f"  Failed: {total_tests - passed_tests}")
        print(f"  Pass Rate: {pass_rate:.1f}%")
        print(f"  Duration: {elapsed_time:.2f}s")
        
        if total_tests - passed_tests > 0:
            print("\nFailed Tests:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        # Save detailed report
        report_file = f"test_report_{int(time.time())}.json"
        with open(report_file, "w") as f:
            json.dump({
                "timestamp": datetime.utcnow().isoformat(),
                "base_url": self.base_url,
                "summary": {
                    "total_tests": total_tests,
                    "passed": passed_tests,
                    "failed": total_tests - passed_tests,
                    "pass_rate": pass_rate,
                    "duration_seconds": elapsed_time
                },
                "results": self.test_results
            }, f, indent=2)
        
        print(f"\nDetailed report saved to: {report_file}")
        print("=" * 50)


async def main():
    """Run system test"""
    parser = argparse.ArgumentParser(description="Fynlo POS System Integration Test")
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="Base URL of the API (default: http://localhost:8000)"
    )
    args = parser.parse_args()
    
    tester = SystemIntegrationTest(args.url)
    success = await tester.run_all_tests()
    
    if success:
        print("\n🎉 All system tests passed!")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())