#!/usr/bin/env python3
"""
Database Optimization Script for Fynlo POS
Adds indexes, analyzes tables, and optimizes performance
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os
import sys
import json
from datetime import datetime
from urllib.parse import urlparse

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.config import settings

def parse_database_url(url):
    """Parse DATABASE_URL into connection parameters"""
    parsed = urlparse(url)
    return {
        'dbname': parsed.path[1:],
        'user': parsed.username,
        'password': parsed.password,
        'host': parsed.hostname,
        'port': parsed.port,
        'sslmode': 'require' if ':25060' in url or ':25061' in url else 'prefer'
    }

def get_connection():
    """Get database connection with proper SSL settings"""
    conn_params = parse_database_url(settings.DATABASE_URL)
    
    # Add CA certificate if available for DigitalOcean
    cert_path = os.path.join(os.path.dirname(__file__), '..', 'certs', 'ca-certificate.crt')
    if os.path.exists(cert_path):
        conn_params['sslrootcert'] = cert_path
    
    return psycopg2.connect(**conn_params)

def analyze_table_sizes(cursor):
    """Check actual table sizes to determine if we can downsize the database"""
    logger.info("\n=== TABLE SIZE ANALYSIS ===")
    
    query = """
    SELECT 
        schemaname AS schema,
        tablename AS table,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 20;
    """
    
    cursor.execute(query)
    results = cursor.fetchall()
    
    total_size = 0
    for row in results:
        logger.info(f"{row['table']:30} | Total: {row['total_size']:>10} | Table: {row['table_size']:>10} | Indexes: {row['indexes_size']:>10}")
    
    # Get total database size
    cursor.execute("SELECT pg_database_size(current_database()) as size")
    db_size = cursor.fetchone()['size']
    logger.info(f"\nTotal Database Size: {db_size / 1024 / 1024:.2f} MB")
    
    return db_size

def check_missing_indexes(cursor):
    """Identify tables that might benefit from indexes"""
    logger.info("\n=== MISSING INDEX ANALYSIS ===")
    
    # Check for foreign key columns without indexes
    query = """
    SELECT
        tc.table_name,
        kcu.column_name,
        tc.constraint_name,
        tc.constraint_type
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND NOT EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
                AND tablename = tc.table_name
                AND indexdef LIKE '%' || kcu.column_name || '%'
        )
    ORDER BY tc.table_name, kcu.column_name;
    """
    
    cursor.execute(query)
    missing_fk_indexes = cursor.fetchall()
    
    if missing_fk_indexes:
        logger.info("\nForeign keys without indexes:")
        for row in missing_fk_indexes:
            logger.info(f"  - {row['table_name']}.{row['column_name']}")
    else:
        logger.info("\n✅ All foreign keys have indexes")
    
    return missing_fk_indexes

def create_optimized_indexes(cursor):
    """Create performance-critical indexes"""
    logger.info("\n=== CREATING OPTIMIZED INDEXES ===")
    
    indexes = [
        # Orders - most queried table
        ("idx_orders_restaurant_created", "orders", "(restaurant_id, created_at DESC)"),
        ("idx_orders_status", "orders", "(status)"),
        ("idx_orders_table", "orders", "(table_id)"),
        ("idx_orders_customer", "orders", "(customer_id)", "WHERE customer_id IS NOT NULL"),
        
        # Order Items - for order details
        ("idx_order_items_order", "order_items", "(order_id)"),
        ("idx_order_items_product", "order_items", "(product_id)"),
        
        # Payments - for financial queries
        ("idx_payments_order", "payments", "(order_id)"),
        ("idx_payments_restaurant_created", "payments", "(restaurant_id, created_at DESC)"),
        ("idx_payments_method", "payments", "(payment_method)"),
        
        # Products - for menu queries
        ("idx_products_restaurant_category", "products", "(restaurant_id, category_id)"),
        ("idx_products_active", "products", "(restaurant_id, is_active)", "WHERE is_active = true"),
        
        # Users - for authentication
        ("idx_users_restaurant", "users", "(restaurant_id)"),
        ("idx_users_email", "users", "(email)"),
        ("idx_users_supabase", "users", "(supabase_id)", "WHERE supabase_id IS NOT NULL"),
        
        # Categories - for menu structure
        ("idx_categories_restaurant", "categories", "(restaurant_id)"),
        ("idx_categories_active", "categories", "(restaurant_id, is_active)", "WHERE is_active = true"),
        
        # Inventory - for stock queries
        ("idx_inventory_items_restaurant", "inventory_items", "(restaurant_id)"),
        ("idx_inventory_items_product", "inventory_items", "(product_id)"),
        
        # Analytics indexes
        ("idx_daily_reports_restaurant_date", "daily_reports", "(restaurant_id, report_date DESC)"),
        ("idx_pos_sessions_user", "pos_sessions", "(user_id)"),
        ("idx_pos_sessions_restaurant", "pos_sessions", "(restaurant_id)"),
    ]
    
    created_count = 0
    for index_name, table_name, columns, *conditions in indexes:
        where_clause = conditions[0] if conditions else ""
        
        # Check if index exists
        cursor.execute(
            "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = %s",
            (index_name,)
        )
        
        if not cursor.fetchone():
            try:
                index_sql = f"CREATE INDEX CONCURRENTLY {index_name} ON {table_name} {columns}"
                if where_clause:
                    index_sql += f" {where_clause}"
                
                logger.info(f"Creating index: {index_name}...")
                cursor.execute(index_sql)
                created_count += 1
                logger.info(f"  ✅ Created: {index_name}")
            except Exception as e:
                logger.error(f"  ❌ Error creating {index_name}: {str(e)}")
        else:
            logger.info(f"  ℹ️  Index already exists: {index_name}")
    
    logger.info(f"\n✅ Created {created_count} new indexes")

def analyze_slow_queries(cursor):
    """Check for slow queries using pg_stat_statements"""
    logger.info("\n=== SLOW QUERY ANALYSIS ===")
    
    # Check if pg_stat_statements is available
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        )
    """)
    
    if not cursor.fetchone()[0]:
        logger.info("pg_stat_statements extension not available")
        return
    
    # Get top slow queries
    query = """
    SELECT 
        query,
        calls,
        round(total_exec_time::numeric, 2) as total_time_ms,
        round(mean_exec_time::numeric, 2) as mean_time_ms,
        round(max_exec_time::numeric, 2) as max_time_ms
    FROM pg_stat_statements
    WHERE query NOT LIKE '%pg_stat_statements%'
        AND mean_exec_time > 100  -- Queries averaging over 100ms
    ORDER BY mean_exec_time DESC
    LIMIT 10;
    """
    
    try:
        cursor.execute(query)
        slow_queries = cursor.fetchall()
        
        if slow_queries:
            logger.info("\nTop slow queries (>100ms average):")
            for i, row in enumerate(slow_queries, 1):
                logger.info(f"\n{i}. Mean: {row['mean_time_ms']}ms, Max: {row['max_time_ms']}ms, Calls: {row['calls']}")
                logger.info(f"   Query: {row['query'][:100]}...")
        else:
            logger.info("\n✅ No slow queries found")
    except Exception as e:
        logger.info(f"Could not analyze slow queries: {str(e)}")

def vacuum_and_analyze(cursor):
    """Run VACUUM and ANALYZE on all tables"""
    logger.info("\n=== VACUUM AND ANALYZE ===")
    
    # Get all tables
    cursor.execute("""
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
    """)
    
    tables = cursor.fetchall()
    
    # Close cursor to run VACUUM
    cursor.close()
    conn = cursor.connection
    old_isolation_level = conn.isolation_level
    conn.set_isolation_level(0)  # AUTOCOMMIT mode for VACUUM
    
    cursor = conn.cursor()
    
    for table in tables:
        table_name = table['tablename']
        try:
            logger.info(f"Vacuuming and analyzing {table_name}...")
            cursor.execute(f"VACUUM ANALYZE {table_name}")
            logger.info(f"  ✅ Completed: {table_name}")
        except Exception as e:
            logger.error(f"  ❌ Error on {table_name}: {str(e)}")
    
    # Restore isolation level
    conn.set_isolation_level(old_isolation_level)
    
    return conn.cursor(cursor_factory=RealDictCursor)

def check_connection_stats(cursor):
    """Check database connection usage"""
    logger.info("\n=== CONNECTION STATISTICS ===")
    
    cursor.execute("""
        SELECT 
            max_conn,
            used,
            res_for_super,
            max_conn - used - res_for_super AS available
        FROM 
            (SELECT count(*) AS used FROM pg_stat_activity) t1,
            (SELECT setting::int AS max_conn FROM pg_settings WHERE name='max_connections') t2,
            (SELECT setting::int AS res_for_super FROM pg_settings WHERE name='superuser_reserved_connections') t3
    """)
    
    conn_stats = cursor.fetchone()
    logger.info(f"Max connections: {conn_stats['max_conn']}")
    logger.info(f"Used connections: {conn_stats['used']}")
    logger.info(f"Available connections: {conn_stats['available']}")
    
    # Check connection states
    cursor.execute("""
        SELECT 
            state,
            count(*) as count
        FROM pg_stat_activity
        WHERE pid != pg_backend_pid()
        GROUP BY state
        ORDER BY count DESC
    """)
    
    logger.info("\nConnection states:")
    for row in cursor.fetchall():
        state = row['state'] or 'unknown'
        logger.info(f"  {state}: {row['count']}")
    
    return conn_stats

def generate_optimization_report(db_size, conn_stats):
    """Generate recommendations based on analysis"""
    logger.info("\n" + "="*60)
    logger.info("OPTIMIZATION RECOMMENDATIONS")
    logger.info("="*60)
    
    recommendations = []
    
    # Database size recommendation
    db_size_mb = db_size / 1024 / 1024
    if db_size_mb < 200:
        recommendations.append({
            "type": "DATABASE_SIZE",
            "action": "DOWNSIZE",
            "current": "1GB plan",
            "recommended": "512MB plan",
            "monthly_savings": "$7",
            "reason": f"Database is only {db_size_mb:.2f}MB"
        })
    
    # Connection recommendation
    if conn_stats['used'] < 10:
        recommendations.append({
            "type": "CONNECTION_POOL",
            "action": "REDUCE",
            "current": "20 connections in pool",
            "recommended": "10 connections",
            "reason": f"Only {conn_stats['used']} connections in use"
        })
    
    # Save recommendations
    report = {
        "timestamp": datetime.now().isoformat(),
        "database_size_mb": db_size_mb,
        "connections_used": conn_stats['used'],
        "recommendations": recommendations
    }
    
    with open("database-optimization-report.json", "w") as f:
        json.dump(report, f, indent=2)
    
    logger.info("\nRecommendations:")
    for rec in recommendations:
        logger.info(f"\n{rec['type']}:")
        logger.info(f"  Action: {rec['action']}")
        logger.info(f"  Current: {rec['current']}")
        logger.info(f"  Recommended: {rec['recommended']}")
        if 'monthly_savings' in rec:
            logger.info(f"  Savings: {rec['monthly_savings']}/month")
        logger.info(f"  Reason: {rec['reason']}")
    
    logger.info(f"\nReport saved to: database-optimization-report.json")

def main():
    """Run database optimization"""
    logger.info("="*60)
    logger.info("Fynlo POS Database Optimization")
    logger.info(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("="*60)
    
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Analyze table sizes
        db_size = analyze_table_sizes(cursor)
        
        # 2. Check missing indexes
        check_missing_indexes(cursor)
        
        # 3. Create optimized indexes
        conn.commit()  # Commit any pending transactions
        create_optimized_indexes(cursor)
        conn.commit()
        
        # 4. Analyze slow queries
        analyze_slow_queries(cursor)
        
        # 5. Vacuum and analyze tables
        cursor = vacuum_and_analyze(cursor)
        
        # 6. Check connection stats
        conn_stats = check_connection_stats(cursor)
        
        # 7. Generate optimization report
        generate_optimization_report(db_size, conn_stats)
        
        cursor.close()
        conn.close()
        
        logger.info("\n✅ Database optimization complete!")
        
    except Exception as e:
        logger.error(f"\n❌ Error during optimization: {str(e)}")
        import traceback
import logging

logger = logging.getLogger(__name__)

        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
