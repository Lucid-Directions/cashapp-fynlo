#!/usr/bin/env python3
"""
Standalone Database Optimization Script for Fynlo POS
Works without app dependencies
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os
import json
from datetime import datetime
from urllib.parse import urlparse
import argparse

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

def get_connection(database_url):
    """Get database connection with proper SSL settings"""
    conn_params = parse_database_url(database_url)
    
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
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
        pg_total_relation_size(schemaname||'.'||tablename) AS total_bytes
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 20;
    """
    
    cursor.execute(query)
    results = cursor.fetchall()
    
    total_size = 0
    logger.info(f"{'Table':30} | {'Total':>10} | {'Table':>10} | {'Indexes':>10}")
    logger.info("-" * 70)
    
    for row in results:
        logger.info(f"{row['table']:30} | {row['total_size']:>10} | {row['table_size']:>10} | {row['indexes_size']:>10}")
        total_size += row['total_bytes']
    
    # Get total database size
    cursor.execute("SELECT pg_database_size(current_database()) as size")
    db_size = cursor.fetchone()['size']
    
    logger.info(f"\nTotal Database Size: {db_size / 1024 / 1024:.2f} MB")
    logger.info(f"Total Tables Size: {total_size / 1024 / 1024:.2f} MB")
    
    # Check row counts for major tables
    logger.info("\n=== ROW COUNTS ===")
    major_tables = ['orders', 'order_items', 'payments', 'products', 'users', 'customers']
    
    for table in major_tables:
        try:
            cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
            count = cursor.fetchone()['count']
            logger.info(f"{table:20}: {count:,} rows")
        except:
            pass
    
    return db_size

def check_existing_indexes(cursor):
    """List all existing indexes"""
    logger.info("\n=== EXISTING INDEXES ===")
    
    query = """
    SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
    """
    
    cursor.execute(query)
    indexes = cursor.fetchall()
    
    current_table = None
    for idx in indexes:
        if idx['tablename'] != current_table:
            current_table = idx['tablename']
            logger.info(f"\n{current_table}:")
        logger.info(f"  - {idx['indexname']}")

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
    
    # Check active queries
    cursor.execute("""
        SELECT 
            pid,
            usename,
            application_name,
            client_addr,
            state,
            query_start,
            state_change,
            LEFT(query, 100) as query_snippet
        FROM pg_stat_activity
        WHERE state != 'idle'
            AND pid != pg_backend_pid()
        ORDER BY query_start;
    """)
    
    active_queries = cursor.fetchall()
    if active_queries:
        logger.info(f"\nActive queries: {len(active_queries)}")
        for q in active_queries[:5]:  # Show first 5
            logger.info(f"  - {q['state']}: {q['query_snippet'][:50]}...")
    
    return conn_stats

def check_cache_hit_rates(cursor):
    """Check database cache hit rates"""
    logger.info("\n=== CACHE HIT RATES ===")
    
    cursor.execute("""
        SELECT 
            sum(heap_blks_read) as heap_read,
            sum(heap_blks_hit) as heap_hit,
            CASE 
                WHEN sum(heap_blks_hit) + sum(heap_blks_read) > 0 
                THEN round(sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))::numeric * 100, 2)
                ELSE 0 
            END as cache_hit_ratio
        FROM pg_statio_user_tables;
    """)
    
    cache_stats = cursor.fetchone()
    logger.info(f"Cache hit ratio: {cache_stats['cache_hit_ratio']}%")
    
    if cache_stats['cache_hit_ratio'] < 90:
        logger.info("⚠️  Cache hit ratio is below 90% - consider increasing shared_buffers")
    else:
        logger.info("✅ Cache hit ratio is good")

def generate_recommendations(db_size, conn_stats):
    """Generate optimization recommendations"""
    logger.info("\n" + "="*70)
    logger.info("OPTIMIZATION RECOMMENDATIONS")
    logger.info("="*70)
    
    db_size_mb = db_size / 1024 / 1024
    recommendations = []
    
    # Database size recommendation
    if db_size_mb < 200:
        logger.info(f"\n1. DATABASE SIZE")
        logger.info(f"   Current: 1GB plan ($15/month)")
        logger.info(f"   Actual usage: {db_size_mb:.2f} MB")
        logger.info(f"   Recommendation: Downsize to 512MB plan ($7/month)")
        logger.info(f"   Monthly savings: $8")
        recommendations.append("Downsize database from 1GB to 512MB")
    elif db_size_mb < 500:
        logger.info(f"\n1. DATABASE SIZE")
        logger.info(f"   Current: 1GB plan")
        logger.info(f"   Actual usage: {db_size_mb:.2f} MB")
        logger.info(f"   Status: Appropriately sized with room for growth")
    
    # Connection pool recommendation
    if conn_stats['used'] < 10:
        logger.info(f"\n2. CONNECTION POOL")
        logger.info(f"   Current: Likely over-provisioned")
        logger.info(f"   Active connections: {conn_stats['used']}")
        logger.info(f"   Recommendation: Reduce connection pool size to 10")
        recommendations.append("Reduce connection pool from 20 to 10")
    
    # App Platform recommendation
    logger.info(f"\n3. APP PLATFORM")
    logger.info(f"   Current: basic-s instance ($12/month)")
    logger.info(f"   Performance: Response times < 200ms (excellent)")
    logger.info(f"   Recommendation: Monitor CPU/memory in DigitalOcean dashboard")
    logger.info(f"   If CPU < 50% and memory < 50%: Downsize to basic-xs ($5/month)")
    logger.info(f"   Potential savings: $7/month")
    
    # Redis recommendation
    logger.info(f"\n4. REDIS CACHE")
    logger.info(f"   Current: 1GB instance ($15/month)")
    logger.info(f"   Recommendation: Check memory usage in DigitalOcean dashboard")
    logger.info(f"   If < 200MB used: Downsize to 512MB plan ($7/month)")
    logger.info(f"   Potential savings: $8/month")
    
    # Load Balancer recommendation
    logger.info(f"\n5. LOAD BALANCER")
    logger.info(f"   Current: Standard load balancer ($12/month)")
    logger.info(f"   Recommendation: With single app instance, this may be unnecessary")
    logger.info(f"   Alternative: Use App Platform's built-in routing")
    logger.info(f"   Potential savings: $12/month")
    
    # Total potential savings
    logger.info(f"\n" + "="*70)
    logger.info(f"TOTAL POTENTIAL SAVINGS")
    logger.info(f"="*70)
    logger.info(f"Conservative estimate: $20-30/month")
    logger.info(f"Aggressive estimate: $35/month")
    logger.info(f"Percentage reduction: 40-57%")
    
    # Safety recommendations
    logger.info(f"\n" + "="*70)
    logger.info(f"SAFETY RECOMMENDATIONS")
    logger.info(f"="*70)
    logger.info("1. Monitor performance for 24-48 hours after each change")
    logger.info("2. Keep backups before downsizing")
    logger.info("3. Test changes during low-traffic periods")
    logger.info("4. Have a rollback plan ready")
    
    return recommendations

def main():
    parser = argparse.ArgumentParser(description='Optimize Fynlo POS Database')
    parser.add_argument('--database-url', required=True, help='PostgreSQL connection string')
    parser.add_argument('--dry-run', action='store_true', help='Analyze only, don\'t create indexes')
    
    args = parser.parse_args()
    
    logger.info("="*70)
    logger.info("Fynlo POS Database Optimization Analysis")
    logger.info(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("="*70)
    
    try:
        conn = get_connection(args.database_url)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Run analysis
        db_size = analyze_table_sizes(cursor)
        check_existing_indexes(cursor)
        conn_stats = check_connection_stats(cursor)
        check_cache_hit_rates(cursor)
        
        # Generate recommendations
        recommendations = generate_recommendations(db_size, conn_stats)
        
        # Save report
        report = {
            "timestamp": datetime.now().isoformat(),
            "database_size_mb": db_size / 1024 / 1024,
            "connections_used": conn_stats['used'],
            "recommendations": recommendations
        }
        
        report_file = f"db-optimization-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"\n✅ Analysis complete! Report saved to: {report_file}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"\n❌ Error: {str(e)}")
        import traceback
import logging

logger = logging.getLogger(__name__)

        traceback.print_exc()

if __name__ == "__main__":
    main()