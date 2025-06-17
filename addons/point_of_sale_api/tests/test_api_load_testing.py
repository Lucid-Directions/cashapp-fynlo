#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
High-Volume API Load Testing Framework
Phase 4: Production Readiness - Week 2 Day 7 Implementation

This module provides comprehensive high-volume API load testing to validate
system performance under extreme load conditions, rate limiting effectiveness,
and error recovery mechanisms.
"""

import sys
import os
import time
import json
import statistics
import threading
import asyncio
import aiohttp
import requests
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import random
import psutil
import gc
from collections import defaultdict, deque
import logging

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../'))
sys.path.insert(0, project_root)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('api_load_test.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class APIEndpoint:
    """Represents an API endpoint for load testing"""
    
    def __init__(self, name, url, method='GET', headers=None, payload=None, 
                 auth_required=True, rate_limit=None):
        self.name = name
        self.url = url
        self.method = method.upper()
        self.headers = headers or {}
        self.payload = payload
        self.auth_required = auth_required
        self.rate_limit = rate_limit  # requests per minute
        self.response_times = deque(maxlen=1000)
        self.error_count = 0
        self.success_count = 0
        self.status_codes = defaultdict(int)
        
    def add_response(self, response_time, status_code, success=True):
        """Record response metrics"""
        self.response_times.append(response_time)
        self.status_codes[status_code] += 1
        if success:
            self.success_count += 1
        else:
            self.error_count += 1
    
    def get_stats(self):
        """Get performance statistics"""
        if not self.response_times:
            return {}
        
        times = list(self.response_times)
        total_requests = self.success_count + self.error_count
        
        return {
            'name': self.name,
            'total_requests': total_requests,
            'success_count': self.success_count,
            'error_count': self.error_count,
            'success_rate': (self.success_count / total_requests) * 100 if total_requests > 0 else 0,
            'avg_response_time': statistics.mean(times),
            'min_response_time': min(times),
            'max_response_time': max(times),
            'median_response_time': statistics.median(times),
            'p95_response_time': statistics.quantiles(times, n=20)[18] if len(times) >= 20 else max(times),
            'p99_response_time': statistics.quantiles(times, n=100)[98] if len(times) >= 100 else max(times),
            'status_codes': dict(self.status_codes)
        }

class LoadTestConfig:
    """Configuration for load testing scenarios"""
    
    def __init__(self):
        self.base_url = "http://localhost:8069"
        self.test_duration = 300  # 5 minutes
        self.ramp_up_time = 60   # 1 minute
        self.target_rps = 1000   # requests per second
        self.burst_multiplier = 10  # 10x normal load for burst testing
        self.burst_duration = 30    # 30 seconds
        self.max_workers = 50       # Thread pool size
        self.timeout = 30           # Request timeout
        
        # Test endpoints
        self.endpoints = [
            # Core POS Endpoints
            APIEndpoint("health_check", f"{self.base_url}/api/health", "GET", auth_required=False),
            APIEndpoint("products_list", f"{self.base_url}/api/products", "GET"),
            APIEndpoint("orders_list", f"{self.base_url}/api/orders", "GET"),
            APIEndpoint("create_order", f"{self.base_url}/api/orders", "POST", 
                       payload={"customer_id": 1, "items": [{"product_id": 1, "quantity": 2}]}),
            
            # Payment Endpoints
            APIEndpoint("payment_methods", f"{self.base_url}/api/payment/methods", "GET"),
            APIEndpoint("create_payment_intent", f"{self.base_url}/api/payment/stripe/create-intent", "POST",
                       payload={"amount": 1000, "currency": "usd"}),
            APIEndpoint("open_banking_qr", f"{self.base_url}/api/payment/open-banking/generate-qr", "POST",
                       payload={"amount": 1000, "order_id": "test-order"}),
            
            # Employee Endpoints
            APIEndpoint("employees_list", f"{self.base_url}/api/employees", "GET"),
            APIEndpoint("clock_in", f"{self.base_url}/api/timeclock/clockin", "POST",
                       payload={"employee_id": 1, "pin": "1234"}),
            
            # WebSocket Connection Test
            APIEndpoint("websocket_health", f"{self.base_url}/api/websocket/health", "GET"),
        ]

class RateLimiter:
    """Rate limiting implementation for testing"""
    
    def __init__(self, max_requests_per_minute=1000):
        self.max_requests = max_requests_per_minute
        self.requests = deque()
        self.lock = threading.Lock()
    
    def can_make_request(self):
        """Check if request is allowed under rate limit"""
        with self.lock:
            now = time.time()
            # Remove requests older than 1 minute
            while self.requests and self.requests[0] < now - 60:
                self.requests.popleft()
            
            if len(self.requests) < self.max_requests:
                self.requests.append(now)
                return True
            return False
    
    def wait_for_slot(self):
        """Wait until a request slot is available"""
        while not self.can_make_request():
            time.sleep(0.1)

class APILoadTester:
    """High-volume API load testing framework"""
    
    def __init__(self, config=None):
        self.config = config or LoadTestConfig()
        self.session = requests.Session()
        self.auth_token = None
        self.rate_limiter = RateLimiter(self.config.target_rps * 60)
        self.test_results = {}
        self.system_metrics = []
        self.start_time = None
        self.stop_event = threading.Event()
        
        # Performance tracking
        self.total_requests = 0
        self.total_errors = 0
        self.circuit_breaker_triggered = False
        
    def authenticate(self):
        """Authenticate and get JWT token"""
        try:
            auth_url = f"{self.config.base_url}/api/auth/login"
            response = self.session.post(auth_url, json={
                "username": "admin",
                "password": "admin"
            }, timeout=self.config.timeout)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('access_token')
                self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                logger.info("Authentication successful")
                return True
            else:
                logger.warning(f"Authentication failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return False
    
    def make_request(self, endpoint):
        """Make a single API request"""
        try:
            # Wait for rate limit slot
            self.rate_limiter.wait_for_slot()
            
            # Prepare request
            headers = endpoint.headers.copy()
            if endpoint.auth_required and self.auth_token:
                headers['Authorization'] = f'Bearer {self.auth_token}'
            
            start_time = time.perf_counter()
            
            # Make request
            if endpoint.method == 'GET':
                response = self.session.get(endpoint.url, headers=headers, 
                                          timeout=self.config.timeout)
            elif endpoint.method == 'POST':
                response = self.session.post(endpoint.url, headers=headers, 
                                           json=endpoint.payload, timeout=self.config.timeout)
            elif endpoint.method == 'PUT':
                response = self.session.put(endpoint.url, headers=headers, 
                                          json=endpoint.payload, timeout=self.config.timeout)
            elif endpoint.method == 'DELETE':
                response = self.session.delete(endpoint.url, headers=headers, 
                                             timeout=self.config.timeout)
            else:
                raise ValueError(f"Unsupported method: {endpoint.method}")
            
            end_time = time.perf_counter()
            response_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            # Record metrics
            success = 200 <= response.status_code < 400
            endpoint.add_response(response_time, response.status_code, success)
            
            if success:
                self.total_requests += 1
            else:
                self.total_errors += 1
                if response.status_code == 429:  # Rate limited
                    logger.warning(f"Rate limited on {endpoint.name}")
                elif response.status_code >= 500:  # Server error
                    logger.error(f"Server error on {endpoint.name}: {response.status_code}")
            
            return response_time, response.status_code, success
            
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout on {endpoint.name}")
            endpoint.add_response(self.config.timeout * 1000, 408, False)
            self.total_errors += 1
            return self.config.timeout * 1000, 408, False
            
        except requests.exceptions.ConnectionError:
            logger.error(f"Connection error on {endpoint.name}")
            endpoint.add_response(0, 503, False)
            self.total_errors += 1
            return 0, 503, False
            
        except Exception as e:
            logger.error(f"Request error on {endpoint.name}: {e}")
            endpoint.add_response(0, 500, False)
            self.total_errors += 1
            return 0, 500, False
    
    def worker_thread(self, endpoint, requests_per_second):
        """Worker thread for making requests"""
        request_interval = 1.0 / requests_per_second if requests_per_second > 0 else 1.0
        
        while not self.stop_event.is_set():
            thread_start = time.time()
            
            # Make request
            self.make_request(endpoint)
            
            # Control request rate
            elapsed = time.time() - thread_start
            sleep_time = max(0, request_interval - elapsed)
            if sleep_time > 0:
                time.sleep(sleep_time)
    
    def monitor_system_resources(self):
        """Monitor system resources during testing"""
        while not self.stop_event.is_set():
            try:
                cpu_percent = psutil.cpu_percent(interval=1)
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')
                
                # Network stats (if available)
                net_io = psutil.net_io_counters()
                
                metrics = {
                    'timestamp': time.time(),
                    'cpu_percent': cpu_percent,
                    'memory_percent': memory.percent,
                    'memory_used_gb': memory.used / (1024**3),
                    'disk_percent': disk.percent,
                    'network_bytes_sent': net_io.bytes_sent,
                    'network_bytes_recv': net_io.bytes_recv,
                    'total_requests': self.total_requests,
                    'total_errors': self.total_errors
                }
                
                self.system_metrics.append(metrics)
                
                # Check for resource exhaustion
                if memory.percent > 90 or cpu_percent > 95:
                    logger.warning(f"High resource usage: CPU {cpu_percent}%, Memory {memory.percent}%")
                
            except Exception as e:
                logger.error(f"System monitoring error: {e}")
            
            time.sleep(5)  # Monitor every 5 seconds
    
    def run_normal_load_test(self):
        """Run normal load test scenario"""
        logger.info("Starting normal load test...")
        
        # Calculate requests per endpoint
        rps_per_endpoint = self.config.target_rps // len(self.config.endpoints)
        
        # Start worker threads
        with ThreadPoolExecutor(max_workers=self.config.max_workers) as executor:
            futures = []
            
            for endpoint in self.config.endpoints:
                future = executor.submit(self.worker_thread, endpoint, rps_per_endpoint)
                futures.append(future)
            
            # Run for specified duration
            time.sleep(self.config.test_duration)
            
            # Stop all threads
            self.stop_event.set()
            
            # Wait for completion
            for future in futures:
                try:
                    future.result(timeout=10)
                except Exception as e:
                    logger.error(f"Worker thread error: {e}")
    
    def run_burst_load_test(self):
        """Run burst load test scenario"""
        logger.info("Starting burst load test...")
        
        # Reset stop event
        self.stop_event.clear()
        
        # Calculate burst requests per endpoint
        burst_rps = self.config.target_rps * self.config.burst_multiplier
        rps_per_endpoint = burst_rps // len(self.config.endpoints)
        
        # Start burst worker threads
        with ThreadPoolExecutor(max_workers=self.config.max_workers * 2) as executor:
            futures = []
            
            for endpoint in self.config.endpoints:
                future = executor.submit(self.worker_thread, endpoint, rps_per_endpoint)
                futures.append(future)
            
            # Run burst for specified duration
            time.sleep(self.config.burst_duration)
            
            # Stop all threads
            self.stop_event.set()
            
            # Wait for completion
            for future in futures:
                try:
                    future.result(timeout=10)
                except Exception as e:
                    logger.error(f"Burst worker thread error: {e}")
    
    def test_rate_limiting(self):
        """Test API rate limiting effectiveness"""
        logger.info("Testing rate limiting...")
        
        # Reset stop event
        self.stop_event.clear()
        
        # Choose a single endpoint for rate limit testing
        test_endpoint = self.config.endpoints[0]  # Health check endpoint
        
        # Make requests at 2x the rate limit
        excessive_rps = (test_endpoint.rate_limit or 1000) * 2
        
        rate_limit_start = time.time()
        rate_limited_count = 0
        
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = []
            
            # Submit excessive requests
            for _ in range(excessive_rps):
                future = executor.submit(self.make_request, test_endpoint)
                futures.append(future)
            
            # Check results
            for future in as_completed(futures):
                try:
                    response_time, status_code, success = future.result()
                    if status_code == 429:  # Rate limited
                        rate_limited_count += 1
                except Exception as e:
                    logger.error(f"Rate limit test error: {e}")
        
        rate_limit_duration = time.time() - rate_limit_start
        
        logger.info(f"Rate limiting test completed in {rate_limit_duration:.2f}s")
        logger.info(f"Rate limited requests: {rate_limited_count}")
        
        return {
            'duration': rate_limit_duration,
            'rate_limited_count': rate_limited_count,
            'total_requests': excessive_rps,
            'rate_limit_effectiveness': (rate_limited_count / excessive_rps) * 100
        }
    
    def test_error_recovery(self):
        """Test error recovery mechanisms"""
        logger.info("Testing error recovery...")
        
        recovery_metrics = {
            'circuit_breaker_tests': 0,
            'recovery_time': 0,
            'graceful_degradation': False
        }
        
        # Simulate server overload by making many concurrent requests
        overload_start = time.time()
        
        with ThreadPoolExecutor(max_workers=100) as executor:
            futures = []
            
            # Submit overload requests
            for endpoint in self.config.endpoints[:3]:  # Test first 3 endpoints
                for _ in range(50):  # 50 requests per endpoint
                    future = executor.submit(self.make_request, endpoint)
                    futures.append(future)
            
            # Monitor for circuit breaker activation
            error_count = 0
            for future in as_completed(futures):
                try:
                    response_time, status_code, success = future.result()
                    if not success:
                        error_count += 1
                        if error_count > 10:  # Threshold for circuit breaker
                            recovery_metrics['circuit_breaker_tests'] += 1
                            break
                except Exception as e:
                    error_count += 1
        
        recovery_metrics['recovery_time'] = time.time() - overload_start
        recovery_metrics['graceful_degradation'] = error_count < 100  # Less than 100 errors
        
        return recovery_metrics
    
    def generate_report(self):
        """Generate comprehensive test report"""
        report = {
            'test_summary': {
                'start_time': self.start_time.isoformat() if self.start_time else None,
                'duration': time.time() - self.start_time.timestamp() if self.start_time else 0,
                'total_requests': self.total_requests,
                'total_errors': self.total_errors,
                'error_rate': (self.total_errors / max(self.total_requests, 1)) * 100,
                'target_rps': self.config.target_rps,
                'actual_rps': self.total_requests / (time.time() - self.start_time.timestamp()) if self.start_time else 0
            },
            'endpoint_performance': {},
            'system_metrics': {
                'peak_cpu': max([m['cpu_percent'] for m in self.system_metrics]) if self.system_metrics else 0,
                'peak_memory': max([m['memory_percent'] for m in self.system_metrics]) if self.system_metrics else 0,
                'avg_cpu': statistics.mean([m['cpu_percent'] for m in self.system_metrics]) if self.system_metrics else 0,
                'avg_memory': statistics.mean([m['memory_percent'] for m in self.system_metrics]) if self.system_metrics else 0
            },
            'performance_analysis': {},
            'recommendations': []
        }
        
        # Collect endpoint performance
        for endpoint in self.config.endpoints:
            stats = endpoint.get_stats()
            if stats:
                report['endpoint_performance'][endpoint.name] = stats
        
        # Performance analysis
        avg_response_times = [stats['avg_response_time'] for stats in report['endpoint_performance'].values() if stats.get('avg_response_time')]
        if avg_response_times:
            report['performance_analysis'] = {
                'overall_avg_response_time': statistics.mean(avg_response_times),
                'fastest_endpoint': min(report['endpoint_performance'].items(), key=lambda x: x[1]['avg_response_time'])[0],
                'slowest_endpoint': max(report['endpoint_performance'].items(), key=lambda x: x[1]['avg_response_time'])[0],
                'endpoints_meeting_sla': sum(1 for t in avg_response_times if t < 10)  # <10ms SLA
            }
        
        # Generate recommendations
        if report['test_summary']['error_rate'] > 1:
            report['recommendations'].append("High error rate detected - investigate server capacity and error handling")
        
        if report['system_metrics']['peak_cpu'] > 80:
            report['recommendations'].append("High CPU usage detected - consider horizontal scaling")
        
        if report['system_metrics']['peak_memory'] > 80:
            report['recommendations'].append("High memory usage detected - optimize memory usage or increase resources")
        
        if report['performance_analysis'].get('overall_avg_response_time', 0) > 10:
            report['recommendations'].append("Response times exceed 10ms target - optimize database queries and caching")
        
        return report
    
    def run_comprehensive_test(self):
        """Run comprehensive API load testing"""
        print("🚀 Starting Week 2 Day 7: High-Volume API Load Testing")
        print("=" * 60)
        
        self.start_time = datetime.now()
        
        # Start system monitoring
        monitor_thread = threading.Thread(target=self.monitor_system_resources)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        try:
            # Step 1: Authentication
            print("🔐 Step 1: Authenticating...")
            if not self.authenticate():
                print("❌ Authentication failed - running without auth")
            else:
                print("✅ Authentication successful")
            
            # Step 2: Normal Load Test
            print(f"\n📊 Step 2: Normal Load Test ({self.config.target_rps} RPS for {self.config.test_duration}s)")
            self.run_normal_load_test()
            print("✅ Normal load test completed")
            
            # Step 3: Burst Load Test
            print(f"\n💥 Step 3: Burst Load Test ({self.config.target_rps * self.config.burst_multiplier} RPS for {self.config.burst_duration}s)")
            self.run_burst_load_test()
            print("✅ Burst load test completed")
            
            # Step 4: Rate Limiting Test
            print("\n🛡️ Step 4: Rate Limiting Test")
            rate_limit_results = self.test_rate_limiting()
            print(f"✅ Rate limiting test completed - {rate_limit_results['rate_limit_effectiveness']:.1f}% effectiveness")
            
            # Step 5: Error Recovery Test
            print("\n🔄 Step 5: Error Recovery Test")
            recovery_results = self.test_error_recovery()
            print(f"✅ Error recovery test completed - Recovery time: {recovery_results['recovery_time']:.2f}s")
            
        except KeyboardInterrupt:
            print("\n⚠️ Test interrupted by user")
        except Exception as e:
            print(f"\n❌ Test error: {e}")
            logger.error(f"Test execution error: {e}")
        finally:
            # Stop monitoring
            self.stop_event.set()
            
            # Generate and display report
            print("\n📋 Generating comprehensive test report...")
            report = self.generate_report()
            
            # Display key metrics
            print("\n" + "=" * 60)
            print("📊 API LOAD TESTING RESULTS")
            print("=" * 60)
            
            summary = report['test_summary']
            print(f"Total Requests: {summary['total_requests']:,}")
            print(f"Total Errors: {summary['total_errors']:,}")
            print(f"Error Rate: {summary['error_rate']:.2f}%")
            print(f"Target RPS: {summary['target_rps']:,}")
            print(f"Actual RPS: {summary['actual_rps']:.1f}")
            
            print(f"\nSystem Resources:")
            sys_metrics = report['system_metrics']
            print(f"Peak CPU: {sys_metrics['peak_cpu']:.1f}%")
            print(f"Peak Memory: {sys_metrics['peak_memory']:.1f}%")
            print(f"Avg CPU: {sys_metrics['avg_cpu']:.1f}%")
            print(f"Avg Memory: {sys_metrics['avg_memory']:.1f}%")
            
            if report['performance_analysis']:
                perf = report['performance_analysis']
                print(f"\nPerformance Analysis:")
                print(f"Overall Avg Response Time: {perf['overall_avg_response_time']:.2f}ms")
                print(f"Fastest Endpoint: {perf['fastest_endpoint']}")
                print(f"Slowest Endpoint: {perf['slowest_endpoint']}")
                print(f"Endpoints Meeting <10ms SLA: {perf['endpoints_meeting_sla']}/{len(self.config.endpoints)}")
            
            if report['recommendations']:
                print(f"\n💡 Recommendations:")
                for i, rec in enumerate(report['recommendations'], 1):
                    print(f"{i}. {rec}")
            
            # Save detailed report
            report_file = f"api_load_test_report_{int(time.time())}.json"
            with open(report_file, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"\n📄 Detailed report saved to: {report_file}")
            
            # Success criteria evaluation
            print("\n" + "=" * 60)
            print("🎯 SUCCESS CRITERIA EVALUATION")
            print("=" * 60)
            
            criteria_met = 0
            total_criteria = 4
            
            # Criterion 1: API Performance <10ms under load
            avg_response = report['performance_analysis'].get('overall_avg_response_time', 0) if report['performance_analysis'] else 0
            if avg_response > 0 and avg_response < 10:
                print("✅ API Performance: <10ms average response time ACHIEVED")
                criteria_met += 1
            else:
                print(f"❌ API Performance: {avg_response:.2f}ms average (Target: <10ms)")
            
            # Criterion 2: Error Rate <1%
            if summary['error_rate'] < 1:
                print("✅ Error Rate: <1% under stress conditions ACHIEVED")
                criteria_met += 1
            else:
                print(f"❌ Error Rate: {summary['error_rate']:.2f}% (Target: <1%)")
            
            # Criterion 3: Rate Limiting Effectiveness
            if 'rate_limit_effectiveness' in locals() and rate_limit_results['rate_limit_effectiveness'] > 50:
                print("✅ Rate Limiting: Effective throttling without service disruption ACHIEVED")
                criteria_met += 1
            else:
                print("❌ Rate Limiting: Needs improvement")
            
            # Criterion 4: System Stability
            if sys_metrics['peak_cpu'] < 90 and sys_metrics['peak_memory'] < 90:
                print("✅ System Stability: Resources within acceptable limits ACHIEVED")
                criteria_met += 1
            else:
                print(f"❌ System Stability: High resource usage (CPU: {sys_metrics['peak_cpu']:.1f}%, Memory: {sys_metrics['peak_memory']:.1f}%)")
            
            success_rate = (criteria_met / total_criteria) * 100
            print(f"\n🏆 Overall Success Rate: {criteria_met}/{total_criteria} ({success_rate:.1f}%)")
            
            if success_rate >= 75:
                print("🎉 Week 2 Day 7 API Load Testing: SUCCESS!")
                print("✅ System ready for Week 2 Day 8 Database Performance Testing")
            else:
                print("⚠️ Week 2 Day 7 API Load Testing: NEEDS IMPROVEMENT")
                print("🔧 Address identified issues before proceeding to Day 8")
            
            return report

def main():
    """Main execution function"""
    try:
        # Create load tester with custom configuration
        config = LoadTestConfig()
        config.test_duration = 120  # 2 minutes for demo
        config.target_rps = 100     # 100 RPS for demo
        config.burst_duration = 15  # 15 seconds burst
        
        tester = APILoadTester(config)
        
        # Run comprehensive test
        report = tester.run_comprehensive_test()
        
        return report
        
    except Exception as e:
        logger.error(f"Main execution error: {e}")
        print(f"❌ Test execution failed: {e}")
        return None

if __name__ == "__main__":
    main() 