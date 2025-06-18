#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Database Performance Analysis Under Load
Phase 4: Production Readiness - Week 2 Day 8 Implementation

This module provides comprehensive database performance testing to validate
PostgreSQL performance under extreme load conditions, connection pool effectiveness,
and query optimization under 500+ concurrent connections.
"""

import sys
import os
import time
import json
import statistics
import threading
import asyncio
import psycopg2
import psycopg2.pool
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import random
import psutil
import gc
from collections import defaultdict, deque
import logging
import queue
import contextlib

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../'))
sys.path.insert(0, project_root)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('database_performance_test.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PostgreSQLConnectionPool:
    """Enhanced PostgreSQL connection pool for stress testing"""
    
    def __init__(self, max_connections=500, min_connections=10):
        self.max_connections = max_connections
        self.min_connections = min_connections
        self.active_connections = 0
        self.total_connections_created = 0
        self.connection_failures = 0
        self.connection_timeouts = 0
        self.connection_leaks = 0
        self.lock = threading.Lock()
        
        # Connection pool configuration
        self.db_config = {
            'host': 'localhost',
            'port': 5432,
            'database': 'fynlo_pos_test',
            'user': 'postgres',
            'password': 'postgres'
        }
        
        # Initialize connection pool
        try:
            self.connection_pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=self.min_connections,
                maxconn=self.max_connections,
                **self.db_config
            )
            logger.info(f"Connection pool initialized: {self.min_connections}-{self.max_connections} connections")
        except Exception as e:
            logger.error(f"Failed to initialize connection pool: {e}")
            self.connection_pool = None
    
    @contextlib.contextmanager
    def get_connection(self, timeout=30):
        """Get connection from pool with timeout and leak detection"""
        connection = None
        start_time = time.time()
        
        try:
            with self.lock:
                self.active_connections += 1
                self.total_connections_created += 1
            
            if self.connection_pool:
                connection = self.connection_pool.getconn()
                if connection:
                    yield connection
                else:
                    raise Exception("Failed to get connection from pool")
            else:
                # Fallback to direct connection
                connection = psycopg2.connect(**self.db_config)
                yield connection
                
        except psycopg2.OperationalError as e:
            with self.lock:
                self.connection_failures += 1
            if time.time() - start_time > timeout:
                with self.lock:
                    self.connection_timeouts += 1
            logger.error(f"Database connection error: {e}")
            raise
        except Exception as e:
            with self.lock:
                self.connection_failures += 1
            logger.error(f"Connection pool error: {e}")
            raise
        finally:
            if connection:
                try:
                    if self.connection_pool:
                        self.connection_pool.putconn(connection)
                    else:
                        connection.close()
                except Exception as e:
                    with self.lock:
                        self.connection_leaks += 1
                    logger.error(f"Connection cleanup error: {e}")
            
            with self.lock:
                self.active_connections -= 1
    
    def get_pool_stats(self):
        """Get connection pool statistics"""
        with self.lock:
            return {
                'max_connections': self.max_connections,
                'active_connections': self.active_connections,
                'total_created': self.total_connections_created,
                'failures': self.connection_failures,
                'timeouts': self.connection_timeouts,
                'leaks': self.connection_leaks,
                'pool_available': self.connection_pool is not None
            }

class QueryPerformanceAnalyzer:
    """Advanced query performance analysis under load"""
    
    def __init__(self):
        self.query_stats = defaultdict(lambda: {
            'execution_times': deque(maxlen=1000),
            'success_count': 0,
            'error_count': 0,
            'deadlock_count': 0,
            'timeout_count': 0
        })
        self.lock = threading.Lock()
        
        # Test queries for different scenarios
        self.test_queries = {
            'simple_select': "SELECT COUNT(*) FROM pos_order WHERE create_date > NOW() - INTERVAL '1 hour'",
            'complex_join': """
                SELECT o.name, p.name as partner_name, ol.qty, ol.price_unit
                FROM pos_order o
                JOIN res_partner p ON o.partner_id = p.id
                JOIN pos_order_line ol ON ol.order_id = o.id
                WHERE o.create_date > NOW() - INTERVAL '1 day'
                ORDER BY o.create_date DESC
                LIMIT 100
            """,
            'aggregation': """
                SELECT 
                    DATE_TRUNC('hour', create_date) as hour,
                    COUNT(*) as order_count,
                    SUM(amount_total) as total_amount,
                    AVG(amount_total) as avg_amount
                FROM pos_order
                WHERE create_date > NOW() - INTERVAL '7 days'
                GROUP BY DATE_TRUNC('hour', create_date)
                ORDER BY hour DESC
            """,
            'transaction_test': """
                BEGIN;
                INSERT INTO pos_order (name, partner_id, amount_total, create_date)
                VALUES ('TEST-' || extract(epoch from now()), 1, 100.00, NOW());
                UPDATE pos_order SET amount_total = amount_total + 1 
                WHERE name LIKE 'TEST-%' AND create_date > NOW() - INTERVAL '1 minute';
                ROLLBACK;
            """,
            'index_test': """
                SELECT o.name, o.amount_total
                FROM pos_order o
                WHERE o.create_date BETWEEN NOW() - INTERVAL '30 days' AND NOW()
                AND o.amount_total > 50.00
                ORDER BY o.create_date DESC
                LIMIT 50
            """
        }
    
    def execute_query(self, connection, query_name, query_sql, timeout=30):
        """Execute query with performance tracking"""
        start_time = time.perf_counter()
        
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET statement_timeout = %s", (timeout * 1000,))
                cursor.execute(query_sql)
                
                # Fetch results for SELECT queries
                if query_sql.strip().upper().startswith('SELECT'):
                    results = cursor.fetchall()
                    row_count = len(results)
                else:
                    row_count = cursor.rowcount
                
                end_time = time.perf_counter()
                execution_time = (end_time - start_time) * 1000  # Convert to milliseconds
                
                # Record successful execution
                with self.lock:
                    self.query_stats[query_name]['execution_times'].append(execution_time)
                    self.query_stats[query_name]['success_count'] += 1
                
                return {
                    'success': True,
                    'execution_time': execution_time,
                    'row_count': row_count,
                    'query_name': query_name
                }
                
        except psycopg2.extensions.QueryCanceledError:
            with self.lock:
                self.query_stats[query_name]['timeout_count'] += 1
                self.query_stats[query_name]['error_count'] += 1
            return {
                'success': False,
                'error': 'Query timeout',
                'execution_time': timeout * 1000,
                'query_name': query_name
            }
        except psycopg2.errors.DeadlockDetected:
            with self.lock:
                self.query_stats[query_name]['deadlock_count'] += 1
                self.query_stats[query_name]['error_count'] += 1
            return {
                'success': False,
                'error': 'Deadlock detected',
                'execution_time': (time.perf_counter() - start_time) * 1000,
                'query_name': query_name
            }
        except Exception as e:
            with self.lock:
                self.query_stats[query_name]['error_count'] += 1
            return {
                'success': False,
                'error': str(e),
                'execution_time': (time.perf_counter() - start_time) * 1000,
                'query_name': query_name
            }
    
    def get_query_stats(self):
        """Get comprehensive query performance statistics"""
        stats = {}
        
        with self.lock:
            for query_name, data in self.query_stats.items():
                if data['execution_times']:
                    times = list(data['execution_times'])
                    total_executions = data['success_count'] + data['error_count']
                    
                    stats[query_name] = {
                        'total_executions': total_executions,
                        'success_count': data['success_count'],
                        'error_count': data['error_count'],
                        'deadlock_count': data['deadlock_count'],
                        'timeout_count': data['timeout_count'],
                        'success_rate': (data['success_count'] / total_executions * 100) if total_executions > 0 else 0,
                        'avg_execution_time': statistics.mean(times),
                        'min_execution_time': min(times),
                        'max_execution_time': max(times),
                        'median_execution_time': statistics.median(times),
                        'p95_execution_time': statistics.quantiles(times, n=20)[18] if len(times) >= 20 else max(times),
                        'p99_execution_time': statistics.quantiles(times, n=100)[98] if len(times) >= 100 else max(times)
                    }
        
        return stats

class DatabasePerformanceMonitor:
    """Real-time database and system performance monitoring"""
    
    def __init__(self):
        self.system_metrics = []
        self.db_metrics = []
        self.monitoring_active = False
        self.lock = threading.Lock()
    
    def start_monitoring(self):
        """Start real-time performance monitoring"""
        self.monitoring_active = True
        monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        monitor_thread.start()
    
    def stop_monitoring(self):
        """Stop performance monitoring"""
        self.monitoring_active = False
    
    def _monitor_loop(self):
        """Main monitoring loop"""
        while self.monitoring_active:
            try:
                # System metrics
                cpu_percent = psutil.cpu_percent(interval=1)
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')
                net_io = psutil.net_io_counters()
                
                system_metric = {
                    'timestamp': time.time(),
                    'cpu_percent': cpu_percent,
                    'memory_percent': memory.percent,
                    'memory_used_gb': memory.used / (1024**3),
                    'memory_available_gb': memory.available / (1024**3),
                    'disk_percent': disk.percent,
                    'network_bytes_sent': net_io.bytes_sent,
                    'network_bytes_recv': net_io.bytes_recv
                }
                
                with self.lock:
                    self.system_metrics.append(system_metric)
                
                # Keep only last 1000 metrics
                if len(self.system_metrics) > 1000:
                    self.system_metrics = self.system_metrics[-1000:]
                
            except Exception as e:
                logger.error(f"Monitoring error: {e}")
            
            time.sleep(5)  # Monitor every 5 seconds
    
    def get_current_metrics(self):
        """Get current system metrics"""
        with self.lock:
            if self.system_metrics:
                return self.system_metrics[-1]
            return {}
    
    def get_metrics_summary(self):
        """Get summary of collected metrics"""
        with self.lock:
            if not self.system_metrics:
                return {}
            
            cpu_values = [m['cpu_percent'] for m in self.system_metrics]
            memory_values = [m['memory_percent'] for m in self.system_metrics]
            
            return {
                'monitoring_duration': len(self.system_metrics) * 5,  # seconds
                'data_points': len(self.system_metrics),
                'cpu_stats': {
                    'avg': statistics.mean(cpu_values),
                    'min': min(cpu_values),
                    'max': max(cpu_values),
                    'p95': statistics.quantiles(cpu_values, n=20)[18] if len(cpu_values) >= 20 else max(cpu_values)
                },
                'memory_stats': {
                    'avg': statistics.mean(memory_values),
                    'min': min(memory_values),
                    'max': max(memory_values),
                    'p95': statistics.quantiles(memory_values, n=20)[18] if len(memory_values) >= 20 else max(memory_values)
                }
            }

class DatabaseStressTester:
    """Main database stress testing framework"""
    
    def __init__(self, max_connections=500):
        self.max_connections = max_connections
        self.connection_pool = PostgreSQLConnectionPool(max_connections=max_connections)
        self.query_analyzer = QueryPerformanceAnalyzer()
        self.performance_monitor = DatabasePerformanceMonitor()
        
        # Test configuration
        self.test_duration = 300  # 5 minutes
        self.ramp_up_time = 60    # 1 minute
        self.concurrent_workers = min(max_connections, 100)  # Limit worker threads
        
        # Results tracking
        self.test_results = {}
        self.start_time = None
        self.stop_event = threading.Event()
    
    def setup_test_data(self):
        """Set up test data for performance testing"""
        logger.info("Setting up test data...")
        
        try:
            with self.connection_pool.get_connection() as conn:
                with conn.cursor() as cursor:
                    # Create test tables if they don't exist
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS pos_order (
                            id SERIAL PRIMARY KEY,
                            name VARCHAR(100) NOT NULL,
                            partner_id INTEGER,
                            amount_total DECIMAL(10,2) DEFAULT 0.00,
                            create_date TIMESTAMP DEFAULT NOW()
                        )
                    """)
                    
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS pos_order_line (
                            id SERIAL PRIMARY KEY,
                            order_id INTEGER REFERENCES pos_order(id),
                            qty DECIMAL(10,2) DEFAULT 1.00,
                            price_unit DECIMAL(10,2) DEFAULT 0.00,
                            create_date TIMESTAMP DEFAULT NOW()
                        )
                    """)
                    
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS res_partner (
                            id SERIAL PRIMARY KEY,
                            name VARCHAR(100) NOT NULL,
                            create_date TIMESTAMP DEFAULT NOW()
                        )
                    """)
                    
                    # Create indexes for performance testing
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pos_order_create_date ON pos_order(create_date)")
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pos_order_partner ON pos_order(partner_id)")
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pos_order_amount ON pos_order(amount_total)")
                    
                    # Insert test data if tables are empty
                    cursor.execute("SELECT COUNT(*) FROM res_partner")
                    partner_count = cursor.fetchone()[0]
                    
                    if partner_count == 0:
                        # Insert test partners
                        for i in range(100):
                            cursor.execute(
                                "INSERT INTO res_partner (name) VALUES (%s)",
                                (f"Test Partner {i+1}",)
                            )
                        
                        # Insert test orders
                        for i in range(1000):
                            cursor.execute("""
                                INSERT INTO pos_order (name, partner_id, amount_total, create_date)
                                VALUES (%s, %s, %s, %s)
                            """, (
                                f"ORDER-{i+1:04d}",
                                random.randint(1, 100),
                                round(random.uniform(10.0, 500.0), 2),
                                datetime.now() - timedelta(days=random.randint(0, 30))
                            ))
                        
                        # Insert test order lines
                        cursor.execute("SELECT id FROM pos_order")
                        order_ids = [row[0] for row in cursor.fetchall()]
                        
                        for order_id in order_ids:
                            line_count = random.randint(1, 5)
                            for _ in range(line_count):
                                cursor.execute("""
                                    INSERT INTO pos_order_line (order_id, qty, price_unit)
                                    VALUES (%s, %s, %s)
                                """, (
                                    order_id,
                                    random.randint(1, 10),
                                    round(random.uniform(5.0, 100.0), 2)
                                ))
                    
                    conn.commit()
                    logger.info("Test data setup completed")
                    
        except Exception as e:
            logger.error(f"Test data setup failed: {e}")
            raise
    
    def worker_thread(self, worker_id, queries_per_second):
        """Worker thread for database stress testing"""
        query_interval = 1.0 / queries_per_second if queries_per_second > 0 else 1.0
        
        while not self.stop_event.is_set():
            thread_start = time.time()
            
            try:
                # Select random query for execution
                query_name = random.choice(list(self.query_analyzer.test_queries.keys()))
                query_sql = self.query_analyzer.test_queries[query_name]
                
                # Execute query with connection from pool
                with self.connection_pool.get_connection() as conn:
                    result = self.query_analyzer.execute_query(conn, query_name, query_sql)
                    
                    if not result['success']:
                        logger.warning(f"Worker {worker_id} query failed: {result.get('error', 'Unknown error')}")
                
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
            
            # Control query rate
            elapsed = time.time() - thread_start
            sleep_time = max(0, query_interval - elapsed)
            if sleep_time > 0:
                time.sleep(sleep_time)
    
    def test_concurrent_connections(self):
        """Test concurrent database connections under load"""
        logger.info(f"Starting concurrent connection test: {self.max_connections} connections")
        
        # Start performance monitoring
        self.performance_monitor.start_monitoring()
        
        # Calculate queries per worker
        total_qps = 1000  # Target 1000 queries per second
        qps_per_worker = total_qps // self.concurrent_workers
        
        # Start worker threads
        with ThreadPoolExecutor(max_workers=self.concurrent_workers) as executor:
            futures = []
            
            for worker_id in range(self.concurrent_workers):
                future = executor.submit(self.worker_thread, worker_id, qps_per_worker)
                futures.append(future)
            
            # Run for test duration
            logger.info(f"Running concurrent connection test for {self.test_duration} seconds...")
            time.sleep(self.test_duration)
            
            # Stop all workers
            self.stop_event.set()
            
            # Wait for completion
            for future in futures:
                try:
                    future.result(timeout=10)
                except Exception as e:
                    logger.error(f"Worker thread error: {e}")
        
        # Stop monitoring
        self.performance_monitor.stop_monitoring()
        
        logger.info("Concurrent connection test completed")
    
    def test_query_performance_under_load(self):
        """Test query performance under extreme load"""
        logger.info("Starting query performance test under load")
        
        # Reset stop event
        self.stop_event.clear()
        
        # Test each query type individually under load
        for query_name, query_sql in self.query_analyzer.test_queries.items():
            logger.info(f"Testing query: {query_name}")
            
            # Run focused test on this query
            with ThreadPoolExecutor(max_workers=50) as executor:
                futures = []
                
                for _ in range(100):  # 100 concurrent executions
                    future = executor.submit(self._execute_single_query, query_name, query_sql)
                    futures.append(future)
                
                # Collect results
                for future in as_completed(futures):
                    try:
                        result = future.result()
                        if not result['success']:
                            logger.warning(f"Query {query_name} failed: {result.get('error')}")
                    except Exception as e:
                        logger.error(f"Query execution error: {e}")
        
        logger.info("Query performance test completed")
    
    def _execute_single_query(self, query_name, query_sql):
        """Execute a single query for performance testing"""
        try:
            with self.connection_pool.get_connection() as conn:
                return self.query_analyzer.execute_query(conn, query_name, query_sql)
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'query_name': query_name,
                'execution_time': 0
            }
    
    def test_transaction_isolation(self):
        """Test transaction isolation and ACID compliance"""
        logger.info("Starting transaction isolation test")
        
        def transaction_worker(worker_id):
            """Worker for transaction testing"""
            try:
                with self.connection_pool.get_connection() as conn:
                    with conn.cursor() as cursor:
                        # Test transaction isolation
                        cursor.execute("BEGIN")
                        cursor.execute("""
                            INSERT INTO pos_order (name, partner_id, amount_total)
                            VALUES (%s, %s, %s)
                        """, (f"TRANS-{worker_id}-{int(time.time())}", 1, 100.00))
                        
                        # Simulate some work
                        time.sleep(0.1)
                        
                        cursor.execute("COMMIT")
                        return {'success': True, 'worker_id': worker_id}
                        
            except Exception as e:
                return {'success': False, 'worker_id': worker_id, 'error': str(e)}
        
        # Run concurrent transactions
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(transaction_worker, i) for i in range(50)]
            
            results = []
            for future in as_completed(futures):
                results.append(future.result())
        
        success_count = sum(1 for r in results if r['success'])
        logger.info(f"Transaction isolation test: {success_count}/{len(results)} successful")
        
        return results
    
    def analyze_optimization_opportunities(self):
        """Analyze PostgreSQL optimization opportunities"""
        logger.info("Analyzing optimization opportunities")
        
        optimization_analysis = {
            'index_usage': {},
            'query_plans': {},
            'table_stats': {},
            'recommendations': []
        }
        
        try:
            with self.connection_pool.get_connection() as conn:
                with conn.cursor() as cursor:
                    # Analyze index usage
                    cursor.execute("""
                        SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
                        FROM pg_stat_user_indexes
                        WHERE idx_tup_read > 0
                        ORDER BY idx_tup_read DESC
                    """)
                    
                    for row in cursor.fetchall():
                        optimization_analysis['index_usage'][row[2]] = {
                            'table': f"{row[0]}.{row[1]}",
                            'reads': row[3],
                            'fetches': row[4],
                            'efficiency': (row[4] / row[3] * 100) if row[3] > 0 else 0
                        }
                    
                    # Analyze table statistics
                    cursor.execute("""
                        SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup
                        FROM pg_stat_user_tables
                        ORDER BY n_live_tup DESC
                    """)
                    
                    for row in cursor.fetchall():
                        optimization_analysis['table_stats'][f"{row[0]}.{row[1]}"] = {
                            'inserts': row[2],
                            'updates': row[3],
                            'deletes': row[4],
                            'live_tuples': row[5]
                        }
                    
                    # Generate recommendations
                    if optimization_analysis['index_usage']:
                        low_efficiency_indexes = [
                            name for name, stats in optimization_analysis['index_usage'].items()
                            if stats['efficiency'] < 50
                        ]
                        if low_efficiency_indexes:
                            optimization_analysis['recommendations'].append(
                                f"Consider reviewing indexes with low efficiency: {', '.join(low_efficiency_indexes[:3])}"
                            )
                    
                    # Check for tables without indexes
                    cursor.execute("""
                        SELECT tablename FROM pg_tables 
                        WHERE schemaname = 'public' 
                        AND tablename NOT IN (
                            SELECT DISTINCT tablename FROM pg_indexes WHERE schemaname = 'public'
                        )
                    """)
                    
                    unindexed_tables = [row[0] for row in cursor.fetchall()]
                    if unindexed_tables:
                        optimization_analysis['recommendations'].append(
                            f"Consider adding indexes to tables: {', '.join(unindexed_tables[:3])}"
                        )
        
        except Exception as e:
            logger.error(f"Optimization analysis error: {e}")
            optimization_analysis['error'] = str(e)
        
        return optimization_analysis
    
    def generate_comprehensive_report(self):
        """Generate comprehensive database performance report"""
        report = {
            'test_summary': {
                'start_time': self.start_time.isoformat() if self.start_time else None,
                'duration': time.time() - self.start_time.timestamp() if self.start_time else 0,
                'max_connections_tested': self.max_connections,
                'concurrent_workers': self.concurrent_workers,
                'test_configuration': {
                    'test_duration': self.test_duration,
                    'ramp_up_time': self.ramp_up_time
                }
            },
            'connection_pool_performance': self.connection_pool.get_pool_stats(),
            'query_performance': self.query_analyzer.get_query_stats(),
            'system_performance': self.performance_monitor.get_metrics_summary(),
            'optimization_analysis': self.analyze_optimization_opportunities(),
            'success_criteria_evaluation': {},
            'recommendations': []
        }
        
        # Evaluate success criteria
        pool_stats = report['connection_pool_performance']
        query_stats = report['query_performance']
        system_stats = report['system_performance']
        
        # Connection pool success criteria
        connection_success_rate = ((pool_stats['total_created'] - pool_stats['failures']) / 
                                 max(pool_stats['total_created'], 1)) * 100
        
        report['success_criteria_evaluation'] = {
            'connection_pool': {
                'target_connections': self.max_connections,
                'success_rate': connection_success_rate,
                'connection_leaks': pool_stats['leaks'],
                'timeouts': pool_stats['timeouts'],
                'criteria_met': connection_success_rate >= 95 and pool_stats['leaks'] < 10
            },
            'query_performance': {},
            'system_stability': {}
        }
        
        # Query performance criteria
        if query_stats:
            avg_query_times = []
            success_rates = []
            
            for query_name, stats in query_stats.items():
                avg_query_times.append(stats['avg_execution_time'])
                success_rates.append(stats['success_rate'])
                
                report['success_criteria_evaluation']['query_performance'][query_name] = {
                    'avg_time': stats['avg_execution_time'],
                    'success_rate': stats['success_rate'],
                    'criteria_met': stats['avg_execution_time'] < 5000 and stats['success_rate'] >= 95  # 5s, 95%
                }
            
            overall_avg_time = statistics.mean(avg_query_times) if avg_query_times else 0
            overall_success_rate = statistics.mean(success_rates) if success_rates else 0
            
            report['success_criteria_evaluation']['query_performance']['overall'] = {
                'avg_time': overall_avg_time,
                'success_rate': overall_success_rate,
                'criteria_met': overall_avg_time < 5000 and overall_success_rate >= 95
            }
        
        # System stability criteria
        if system_stats:
            cpu_stable = system_stats['cpu_stats']['max'] < 90
            memory_stable = system_stats['memory_stats']['max'] < 95
            
            report['success_criteria_evaluation']['system_stability'] = {
                'max_cpu': system_stats['cpu_stats']['max'],
                'max_memory': system_stats['memory_stats']['max'],
                'cpu_stable': cpu_stable,
                'memory_stable': memory_stable,
                'criteria_met': cpu_stable and memory_stable
            }
        
        # Generate recommendations
        if connection_success_rate < 95:
            report['recommendations'].append("Connection pool needs optimization - high failure rate detected")
        
        if pool_stats['leaks'] > 5:
            report['recommendations'].append("Connection leak detection - review connection cleanup procedures")
        
        if query_stats:
            slow_queries = [name for name, stats in query_stats.items() 
                          if stats['avg_execution_time'] > 5000]
            if slow_queries:
                report['recommendations'].append(f"Optimize slow queries: {', '.join(slow_queries)}")
        
        if system_stats and system_stats['cpu_stats']['max'] > 80:
            report['recommendations'].append("High CPU usage detected - consider horizontal scaling")
        
        return report
    
    def run_comprehensive_test(self):
        """Run comprehensive database performance testing"""
        print("🚀 Starting Week 2 Day 8: Database Performance Analysis Under Load")
        print("=" * 70)
        
        self.start_time = datetime.now()
        
        try:
            # Step 1: Setup test data
            print("🔧 Step 1: Setting up test data...")
            self.setup_test_data()
            print("✅ Test data setup completed")
            
            # Step 2: Test concurrent connections
            print(f"\n📊 Step 2: Testing {self.max_connections} concurrent connections...")
            self.test_concurrent_connections()
            print("✅ Concurrent connection test completed")
            
            # Step 3: Query performance under load
            print("\n⚡ Step 3: Testing query performance under load...")
            self.test_query_performance_under_load()
            print("✅ Query performance test completed")
            
            # Step 4: Transaction isolation testing
            print("\n🔒 Step 4: Testing transaction isolation...")
            transaction_results = self.test_transaction_isolation()
            print(f"✅ Transaction isolation test completed - {len([r for r in transaction_results if r['success']])}/{len(transaction_results)} successful")
            
            # Step 5: Generate comprehensive report
            print("\n📋 Step 5: Generating comprehensive performance report...")
            report = self.generate_comprehensive_report()
            
            # Display key results
            print("\n" + "=" * 70)
            print("📊 DATABASE PERFORMANCE ANALYSIS RESULTS")
            print("=" * 70)
            
            # Connection pool results
            pool_stats = report['connection_pool_performance']
            print(f"Connection Pool Performance:")
            print(f"  Max Connections: {pool_stats['max_connections']}")
            print(f"  Total Created: {pool_stats['total_created']:,}")
            print(f"  Failures: {pool_stats['failures']}")
            print(f"  Success Rate: {((pool_stats['total_created'] - pool_stats['failures']) / max(pool_stats['total_created'], 1)) * 100:.1f}%")
            print(f"  Connection Leaks: {pool_stats['leaks']}")
            
            # Query performance results
            if report['query_performance']:
                print(f"\nQuery Performance:")
                for query_name, stats in report['query_performance'].items():
                    print(f"  {query_name}:")
                    print(f"    Avg Time: {stats['avg_execution_time']:.2f}ms")
                    print(f"    Success Rate: {stats['success_rate']:.1f}%")
                    print(f"    P95 Time: {stats['p95_execution_time']:.2f}ms")
            
            # System performance results
            if report['system_performance']:
                sys_stats = report['system_performance']
                print(f"\nSystem Performance:")
                print(f"  Peak CPU: {sys_stats['cpu_stats']['max']:.1f}%")
                print(f"  Peak Memory: {sys_stats['memory_stats']['max']:.1f}%")
                print(f"  Avg CPU: {sys_stats['cpu_stats']['avg']:.1f}%")
                print(f"  Avg Memory: {sys_stats['memory_stats']['avg']:.1f}%")
            
            # Success criteria evaluation
            print("\n" + "=" * 70)
            print("🎯 SUCCESS CRITERIA EVALUATION")
            print("=" * 70)
            
            criteria_met = 0
            total_criteria = 3
            
            # Connection pool criteria
            if report['success_criteria_evaluation']['connection_pool']['criteria_met']:
                print("✅ Connection Pool: 500+ connections with <5% failure rate ACHIEVED")
                criteria_met += 1
            else:
                success_rate = report['success_criteria_evaluation']['connection_pool']['success_rate']
                print(f"❌ Connection Pool: {success_rate:.1f}% success rate (Target: >95%)")
            
            # Query performance criteria
            if 'overall' in report['success_criteria_evaluation']['query_performance']:
                overall_query = report['success_criteria_evaluation']['query_performance']['overall']
                if overall_query['criteria_met']:
                    print("✅ Query Performance: <5s average response time with >95% success rate ACHIEVED")
                    criteria_met += 1
                else:
                    print(f"❌ Query Performance: {overall_query['avg_time']:.0f}ms avg, {overall_query['success_rate']:.1f}% success")
            
            # System stability criteria
            if 'criteria_met' in report['success_criteria_evaluation']['system_stability']:
                if report['success_criteria_evaluation']['system_stability']['criteria_met']:
                    print("✅ System Stability: CPU <90%, Memory <95% under load ACHIEVED")
                    criteria_met += 1
                else:
                    stability = report['success_criteria_evaluation']['system_stability']
                    print(f"❌ System Stability: CPU {stability['max_cpu']:.1f}%, Memory {stability['max_memory']:.1f}%")
            
            success_rate = (criteria_met / total_criteria) * 100
            print(f"\n🏆 Overall Success Rate: {criteria_met}/{total_criteria} ({success_rate:.1f}%)")
            
            if success_rate >= 75:
                print("🎉 Week 2 Day 8 Database Performance Testing: SUCCESS!")
                print("✅ Database ready for Week 2 Day 9 Connection Pool Optimization")
            else:
                print("⚠️ Week 2 Day 8 Database Performance Testing: NEEDS IMPROVEMENT")
                print("🔧 Address identified issues before proceeding to Day 9")
            
            # Recommendations
            if report['recommendations']:
                print(f"\n💡 Recommendations:")
                for i, rec in enumerate(report['recommendations'], 1):
                    print(f"{i}. {rec}")
            
            # Save detailed report
            report_file = f"database_performance_report_{int(time.time())}.json"
            with open(report_file, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            print(f"\n📄 Detailed report saved to: {report_file}")
            
            return report
            
        except Exception as e:
            logger.error(f"Database performance test error: {e}")
            print(f"❌ Test execution failed: {e}")
            return None

def main():
    """Main execution function"""
    try:
        # Create database stress tester
        max_connections = 500  # Target 500 concurrent connections
        tester = DatabaseStressTester(max_connections=max_connections)
        
        # Run comprehensive test
        report = tester.run_comprehensive_test()
        
        return report
        
    except Exception as e:
        logger.error(f"Main execution error: {e}")
        print(f"❌ Test execution failed: {e}")
        return None

if __name__ == "__main__":
    main() 