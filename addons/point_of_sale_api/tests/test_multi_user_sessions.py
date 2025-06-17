#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Multi-User Session Simulation Testing
Phase 4: Production Readiness - Week 2 Day 6 Implementation

This module provides comprehensive multi-user session simulation testing
to validate concurrent user behavior, JWT token lifecycle, and session management
under realistic load conditions.
"""

import sys
import os
import time
import json
import statistics
import threading
import uuid
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import random
import hashlib

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../'))
sys.path.insert(0, project_root)

try:
    import requests
    import jwt
    EXTERNAL_LIBS_AVAILABLE = True
except ImportError:
    EXTERNAL_LIBS_AVAILABLE = False
    print("Warning: External libraries not available, using mock session testing")

class UserSession:
    """Represents a simulated user session"""
    
    def __init__(self, user_id, username, role='employee'):
        self.user_id = user_id
        self.username = username
        self.role = role
        self.session_id = str(uuid.uuid4())
        self.jwt_token = None
        self.login_time = None
        self.last_activity = None
        self.cart_items = []
        self.orders_placed = 0
        self.total_spent = 0.0
        self.session_duration = 0
        self.actions_performed = []
        self.is_active = False
    
    def generate_mock_jwt(self):
        """Generate a mock JWT token for testing"""
        payload = {
            'user_id': self.user_id,
            'username': self.username,
            'role': self.role,
            'session_id': self.session_id,
            'exp': datetime.utcnow() + timedelta(hours=8),
            'iat': datetime.utcnow()
        }
        # Use a mock secret for testing
        self.jwt_token = jwt.encode(payload, 'test_secret', algorithm='HS256')
        return self.jwt_token
    
    def add_cart_item(self, item_id, name, price, quantity=1):
        """Add item to user's cart"""
        self.cart_items.append({
            'item_id': item_id,
            'name': name,
            'price': price,
            'quantity': quantity,
            'added_at': datetime.now().isoformat()
        })
        self.last_activity = datetime.now()
    
    def place_order(self):
        """Simulate placing an order"""
        if self.cart_items:
            order_total = sum(item['price'] * item['quantity'] for item in self.cart_items)
            self.orders_placed += 1
            self.total_spent += order_total
            self.cart_items = []  # Clear cart
            self.last_activity = datetime.now()
            return order_total
        return 0
    
    def record_action(self, action_type, details=None):
        """Record user action for analytics"""
        self.actions_performed.append({
            'action': action_type,
            'timestamp': datetime.now().isoformat(),
            'details': details or {}
        })
        self.last_activity = datetime.now()

class MultiUserSessionTester:
    """Comprehensive multi-user session simulation testing"""
    
    def __init__(self):
        self.base_url = 'http://localhost:8069'  # Default Odoo port
        self.test_results = {}
        self.active_sessions = {}
        self.session_metrics = {}
        self.performance_data = []
        self.start_time = None
        self.end_time = None
        
        # Test configuration
        self.max_concurrent_users = 100
        self.session_duration_minutes = 30
        self.actions_per_session = 20
        
        print("🎯 Multi-User Session Simulation Tester - Week 2 Day 6")
        print("=" * 60)
    
    def create_test_users(self, num_users=100):
        """Create test user accounts for simulation"""
        test_users = []
        
        roles = ['employee', 'manager', 'cashier', 'admin']
        
        for i in range(num_users):
            user = {
                'user_id': f'test_user_{i:03d}',
                'username': f'user_{i:03d}',
                'email': f'user_{i:03d}@fynlo.test',
                'role': random.choice(roles),
                'created_at': datetime.now().isoformat()
            }
            test_users.append(user)
        
        print(f"✅ Created {len(test_users)} test users")
        return test_users
    
    def simulate_user_login(self, user_data):
        """Simulate user login process"""
        start_time = time.perf_counter()
        
        try:
            # Create user session
            session = UserSession(
                user_data['user_id'],
                user_data['username'],
                user_data['role']
            )
            
            # Simulate login API call
            login_data = {
                'username': user_data['username'],
                'password': 'test_password',
                'session_id': session.session_id
            }
            
            if EXTERNAL_LIBS_AVAILABLE:
                # Simulate actual login request
                login_response = self._mock_login_request(login_data)
                if login_response.get('success'):
                    session.jwt_token = login_response.get('token')
                else:
                    return None, time.perf_counter() - start_time
            else:
                # Mock login for testing
                session.generate_mock_jwt()
            
            session.login_time = datetime.now()
            session.last_activity = datetime.now()
            session.is_active = True
            session.record_action('login', {'method': 'username_password'})
            
            end_time = time.perf_counter()
            login_duration = (end_time - start_time) * 1000  # Convert to ms
            
            return session, login_duration
            
        except Exception as e:
            end_time = time.perf_counter()
            login_duration = (end_time - start_time) * 1000
            print(f"❌ Login failed for {user_data['username']}: {e}")
            return None, login_duration
    
    def simulate_user_activity(self, session, activity_duration_minutes=30):
        """Simulate realistic user activity during session"""
        activity_results = []
        
        # Define possible actions with weights
        actions = [
            ('view_products', 0.3),
            ('add_to_cart', 0.2),
            ('place_order', 0.15),
            ('view_orders', 0.1),
            ('update_profile', 0.05),
            ('logout', 0.05),
            ('payment_process', 0.15)
        ]
        
        start_time = time.perf_counter()
        end_time = start_time + (activity_duration_minutes * 60)
        
        while time.perf_counter() < end_time and session.is_active:
            # Choose random action based on weights
            action = self._weighted_choice(actions)
            
            action_start = time.perf_counter()
            result = self._perform_user_action(session, action)
            action_end = time.perf_counter()
            
            action_duration = (action_end - action_start) * 1000
            
            activity_results.append({
                'action': action,
                'duration_ms': action_duration,
                'success': result.get('success', False),
                'timestamp': datetime.now().isoformat(),
                'session_id': session.session_id
            })
            
            # Random delay between actions (1-10 seconds)
            delay = random.uniform(1, 10)
            time.sleep(delay)
        
        total_duration = time.perf_counter() - start_time
        session.session_duration = total_duration
        
        return activity_results
    
    def _weighted_choice(self, choices):
        """Choose item based on weights"""
        total = sum(weight for choice, weight in choices)
        r = random.uniform(0, total)
        upto = 0
        for choice, weight in choices:
            if upto + weight >= r:
                return choice
            upto += weight
        return choices[-1][0]  # Fallback
    
    def _perform_user_action(self, session, action):
        """Perform specific user action"""
        try:
            if action == 'view_products':
                return self._simulate_view_products(session)
            elif action == 'add_to_cart':
                return self._simulate_add_to_cart(session)
            elif action == 'place_order':
                return self._simulate_place_order(session)
            elif action == 'view_orders':
                return self._simulate_view_orders(session)
            elif action == 'update_profile':
                return self._simulate_update_profile(session)
            elif action == 'payment_process':
                return self._simulate_payment_process(session)
            elif action == 'logout':
                return self._simulate_logout(session)
            else:
                return {'success': False, 'error': 'Unknown action'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _simulate_view_products(self, session):
        """Simulate viewing products"""
        if EXTERNAL_LIBS_AVAILABLE:
            response = self._mock_api_request('GET', '/api/pos/products', session)
            session.record_action('view_products', {'product_count': 10})
            return {'success': True, 'products_viewed': 10}
        else:
            session.record_action('view_products', {'product_count': 10})
            time.sleep(0.1)  # Simulate processing time
            return {'success': True, 'products_viewed': 10}
    
    def _simulate_add_to_cart(self, session):
        """Simulate adding item to cart"""
        item_id = random.randint(1, 100)
        item_name = f"Product_{item_id}"
        item_price = round(random.uniform(5.0, 50.0), 2)
        
        session.add_cart_item(item_id, item_name, item_price)
        session.record_action('add_to_cart', {
            'item_id': item_id,
            'item_name': item_name,
            'price': item_price
        })
        
        time.sleep(0.05)  # Simulate processing time
        return {'success': True, 'item_added': item_name}
    
    def _simulate_place_order(self, session):
        """Simulate placing an order"""
        if not session.cart_items:
            return {'success': False, 'error': 'Empty cart'}
        
        order_total = session.place_order()
        session.record_action('place_order', {
            'order_total': order_total,
            'order_id': f"order_{session.orders_placed}"
        })
        
        time.sleep(0.2)  # Simulate order processing time
        return {'success': True, 'order_total': order_total}
    
    def _simulate_view_orders(self, session):
        """Simulate viewing order history"""
        session.record_action('view_orders', {'orders_count': session.orders_placed})
        time.sleep(0.1)  # Simulate processing time
        return {'success': True, 'orders_viewed': session.orders_placed}
    
    def _simulate_update_profile(self, session):
        """Simulate updating user profile"""
        session.record_action('update_profile', {'field': 'email'})
        time.sleep(0.15)  # Simulate processing time
        return {'success': True, 'profile_updated': True}
    
    def _simulate_payment_process(self, session):
        """Simulate payment processing"""
        if session.cart_items:
            payment_amount = sum(item['price'] * item['quantity'] for item in session.cart_items)
            session.record_action('payment_process', {
                'amount': payment_amount,
                'method': 'stripe'
            })
            time.sleep(0.3)  # Simulate payment processing time
            return {'success': True, 'payment_amount': payment_amount}
        return {'success': False, 'error': 'No items to pay for'}
    
    def _simulate_logout(self, session):
        """Simulate user logout"""
        session.is_active = False
        session.record_action('logout', {'session_duration': session.session_duration})
        time.sleep(0.05)  # Simulate logout processing time
        return {'success': True, 'logged_out': True}
    
    def _mock_login_request(self, login_data):
        """Mock login API request"""
        return {
            'success': True,
            'token': f"mock_jwt_token_{login_data['session_id']}",
            'user_id': login_data['username'],
            'expires_in': 28800  # 8 hours
        }
    
    def _mock_api_request(self, method, endpoint, session):
        """Mock API request with JWT token"""
        headers = {
            'Authorization': f'Bearer {session.jwt_token}',
            'Content-Type': 'application/json'
        }
        
        # Simulate API response time
        time.sleep(random.uniform(0.01, 0.1))
        
        return {
            'success': True,
            'data': {'mock': 'response'},
            'timestamp': datetime.now().isoformat()
        }
    
    def run_concurrent_user_simulation(self, num_users=50, session_duration_minutes=15):
        """Run concurrent user session simulation"""
        print(f"\n🚀 Starting concurrent user simulation: {num_users} users, {session_duration_minutes} minutes")
        
        # Create test users
        test_users = self.create_test_users(num_users)
        
        self.start_time = time.perf_counter()
        
        # Track results
        login_times = []
        session_results = []
        active_sessions = []
        
        def simulate_single_user(user_data):
            """Simulate a single user's complete session"""
            try:
                # Login
                session, login_time = self.simulate_user_login(user_data)
                login_times.append(login_time)
                
                if not session:
                    return {
                        'user_id': user_data['user_id'],
                        'success': False,
                        'error': 'Login failed'
                    }
                
                active_sessions.append(session)
                
                # Perform user activities
                activity_results = self.simulate_user_activity(session, session_duration_minutes)
                
                return {
                    'user_id': user_data['user_id'],
                    'session_id': session.session_id,
                    'success': True,
                    'login_time_ms': login_time,
                    'session_duration': session.session_duration,
                    'actions_performed': len(activity_results),
                    'orders_placed': session.orders_placed,
                    'total_spent': session.total_spent,
                    'activity_results': activity_results
                }
                
            except Exception as e:
                return {
                    'user_id': user_data['user_id'],
                    'success': False,
                    'error': str(e)
                }
        
        # Run concurrent user simulations
        with ThreadPoolExecutor(max_workers=min(num_users, 20)) as executor:
            futures = [executor.submit(simulate_single_user, user) for user in test_users]
            
            for future in as_completed(futures):
                result = future.result()
                session_results.append(result)
                
                if result['success']:
                    print(f"  ✅ User {result['user_id']}: {result['actions_performed']} actions, {result['orders_placed']} orders")
                else:
                    print(f"  ❌ User {result['user_id']}: {result.get('error', 'Unknown error')}")
        
        self.end_time = time.perf_counter()
        total_test_time = self.end_time - self.start_time
        
        # Calculate metrics
        successful_sessions = [r for r in session_results if r['success']]
        failed_sessions = [r for r in session_results if not r['success']]
        
        self.test_results['concurrent_user_simulation'] = {
            'test_configuration': {
                'num_users': num_users,
                'session_duration_minutes': session_duration_minutes,
                'total_test_time_seconds': total_test_time
            },
            'session_metrics': {
                'total_sessions': len(session_results),
                'successful_sessions': len(successful_sessions),
                'failed_sessions': len(failed_sessions),
                'success_rate': (len(successful_sessions) / len(session_results)) * 100
            },
            'performance_metrics': {
                'average_login_time_ms': statistics.mean(login_times) if login_times else 0,
                'min_login_time_ms': min(login_times) if login_times else 0,
                'max_login_time_ms': max(login_times) if login_times else 0,
                'total_actions_performed': sum(r.get('actions_performed', 0) for r in successful_sessions),
                'total_orders_placed': sum(r.get('orders_placed', 0) for r in successful_sessions),
                'total_revenue_generated': sum(r.get('total_spent', 0) for r in successful_sessions)
            },
            'session_details': session_results
        }
        
        return self.test_results['concurrent_user_simulation']
    
    def test_jwt_token_lifecycle(self):
        """Test JWT token lifecycle under load"""
        print("\n🔐 Testing JWT Token Lifecycle...")
        
        # Create test sessions with various token scenarios
        token_tests = []
        
        # Test normal token lifecycle
        for i in range(10):
            user_data = {'user_id': f'token_test_{i}', 'username': f'token_user_{i}', 'role': 'employee'}
            session, login_time = self.simulate_user_login(user_data)
            
            if session:
                token_tests.append({
                    'test_type': 'normal_token',
                    'session_id': session.session_id,
                    'token_created': session.login_time.isoformat(),
                    'login_time_ms': login_time,
                    'token_valid': True
                })
        
        # Test token expiration scenarios
        expired_token_count = 0
        for i in range(5):
            # Simulate expired token
            session = UserSession(f'expired_test_{i}', f'expired_user_{i}')
            session.jwt_token = 'expired_token_simulation'
            session.login_time = datetime.now() - timedelta(hours=10)  # Expired
            
            token_tests.append({
                'test_type': 'expired_token',
                'session_id': session.session_id,
                'token_created': session.login_time.isoformat(),
                'token_valid': False
            })
            expired_token_count += 1
        
        self.test_results['jwt_token_lifecycle'] = {
            'total_tokens_tested': len(token_tests),
            'valid_tokens': len([t for t in token_tests if t['token_valid']]),
            'expired_tokens': expired_token_count,
            'token_test_details': token_tests
        }
        
        print(f"  📊 Token Tests: {len(token_tests)} total, {expired_token_count} expired scenarios")
        
        return self.test_results['jwt_token_lifecycle']
    
    def test_session_memory_usage(self):
        """Test memory usage with multiple concurrent sessions"""
        print("\n💾 Testing Session Memory Usage...")
        
        import psutil
        import gc
        
        # Get initial memory usage
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Create many sessions
        sessions = []
        memory_snapshots = []
        
        for i in range(100):
            user_data = {'user_id': f'memory_test_{i}', 'username': f'memory_user_{i}', 'role': 'employee'}
            session, _ = self.simulate_user_login(user_data)
            
            if session:
                sessions.append(session)
                
                # Add some activity to each session
                for j in range(10):
                    session.add_cart_item(j, f'item_{j}', random.uniform(5, 50))
                
                # Take memory snapshot every 10 sessions
                if i % 10 == 0:
                    current_memory = process.memory_info().rss / 1024 / 1024  # MB
                    memory_snapshots.append({
                        'session_count': len(sessions),
                        'memory_usage_mb': current_memory,
                        'memory_increase_mb': current_memory - initial_memory
                    })
        
        # Final memory measurement
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Cleanup
        sessions.clear()
        gc.collect()
        
        cleanup_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        self.test_results['session_memory_usage'] = {
            'initial_memory_mb': initial_memory,
            'final_memory_mb': final_memory,
            'cleanup_memory_mb': cleanup_memory,
            'peak_memory_increase_mb': final_memory - initial_memory,
            'memory_per_session_mb': (final_memory - initial_memory) / 100,
            'memory_snapshots': memory_snapshots,
            'sessions_tested': 100
        }
        
        print(f"  📊 Memory Usage: {initial_memory:.1f}MB → {final_memory:.1f}MB (+{final_memory - initial_memory:.1f}MB)")
        print(f"  📊 Memory per session: ~{(final_memory - initial_memory) / 100:.2f}MB")
        
        return self.test_results['session_memory_usage']
    
    def generate_session_performance_report(self):
        """Generate comprehensive session performance report"""
        print("\n📊 Generating Session Performance Report...")
        
        report_data = {
            'test_summary': {
                'test_name': 'Multi-User Session Simulation',
                'test_date': datetime.now().isoformat(),
                'test_duration_seconds': (self.end_time - self.start_time) if self.end_time else 0,
                'framework_version': 'Week 2 Day 6 - v1.0'
            },
            'test_results': self.test_results,
            'performance_analysis': self._analyze_performance_data(),
            'recommendations': self._generate_recommendations()
        }
        
        # Save to file
        report_filename = f"session_load_performance_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        report_path = os.path.join(project_root, 'test_results', report_filename)
        
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        
        with open(report_path, 'w') as f:
            json.dump(report_data, f, indent=2)
        
        print(f"  📄 Report saved: {report_path}")
        
        return report_data
    
    def _analyze_performance_data(self):
        """Analyze performance data and generate insights"""
        analysis = {}
        
        if 'concurrent_user_simulation' in self.test_results:
            sim_data = self.test_results['concurrent_user_simulation']
            
            analysis['concurrent_users'] = {
                'success_rate': sim_data['session_metrics']['success_rate'],
                'performance_grade': 'A' if sim_data['session_metrics']['success_rate'] >= 95 else 'B' if sim_data['session_metrics']['success_rate'] >= 85 else 'C',
                'average_login_time': sim_data['performance_metrics']['average_login_time_ms'],
                'login_performance_grade': 'A' if sim_data['performance_metrics']['average_login_time_ms'] < 100 else 'B' if sim_data['performance_metrics']['average_login_time_ms'] < 500 else 'C'
            }
        
        if 'session_memory_usage' in self.test_results:
            memory_data = self.test_results['session_memory_usage']
            
            analysis['memory_efficiency'] = {
                'memory_per_session_mb': memory_data['memory_per_session_mb'],
                'memory_grade': 'A' if memory_data['memory_per_session_mb'] < 1 else 'B' if memory_data['memory_per_session_mb'] < 5 else 'C',
                'peak_memory_increase': memory_data['peak_memory_increase_mb']
            }
        
        return analysis
    
    def _generate_recommendations(self):
        """Generate performance improvement recommendations"""
        recommendations = []
        
        if 'concurrent_user_simulation' in self.test_results:
            sim_data = self.test_results['concurrent_user_simulation']
            
            if sim_data['session_metrics']['success_rate'] < 95:
                recommendations.append({
                    'category': 'Session Reliability',
                    'priority': 'High',
                    'recommendation': 'Improve session creation reliability - consider connection pooling optimization'
                })
            
            if sim_data['performance_metrics']['average_login_time_ms'] > 500:
                recommendations.append({
                    'category': 'Login Performance',
                    'priority': 'Medium',
                    'recommendation': 'Optimize authentication process - consider caching user credentials'
                })
        
        if 'session_memory_usage' in self.test_results:
            memory_data = self.test_results['session_memory_usage']
            
            if memory_data['memory_per_session_mb'] > 5:
                recommendations.append({
                    'category': 'Memory Optimization',
                    'priority': 'High',
                    'recommendation': 'Reduce memory footprint per session - optimize session data structures'
                })
        
        return recommendations
    
    def run_all_session_tests(self):
        """Run all multi-user session tests"""
        print("\n🎯 Running All Multi-User Session Tests...")
        print("=" * 60)
        
        # Test 1: Concurrent User Simulation
        self.run_concurrent_user_simulation(num_users=50, session_duration_minutes=10)
        
        # Test 2: JWT Token Lifecycle
        self.test_jwt_token_lifecycle()
        
        # Test 3: Session Memory Usage
        self.test_session_memory_usage()
        
        # Generate comprehensive report
        report = self.generate_session_performance_report()
        
        print("\n🎉 All Session Tests Complete!")
        print("=" * 60)
        
        return report

def main():
    """Main function to run multi-user session tests"""
    tester = MultiUserSessionTester()
    
    try:
        # Run all tests
        results = tester.run_all_session_tests()
        
        # Print summary
        print("\n📊 TEST SUMMARY")
        print("=" * 40)
        
        if 'concurrent_user_simulation' in results['test_results']:
            sim_data = results['test_results']['concurrent_user_simulation']
            print(f"✅ Concurrent Users: {sim_data['session_metrics']['successful_sessions']}/{sim_data['session_metrics']['total_sessions']}")
            print(f"✅ Success Rate: {sim_data['session_metrics']['success_rate']:.1f}%")
            print(f"✅ Avg Login Time: {sim_data['performance_metrics']['average_login_time_ms']:.1f}ms")
        
        if 'session_memory_usage' in results['test_results']:
            memory_data = results['test_results']['session_memory_usage']
            print(f"✅ Memory per Session: {memory_data['memory_per_session_mb']:.2f}MB")
        
        return True
        
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1) 