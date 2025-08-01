#!/usr/bin/env python3
"""
Redis Optimization Script for Fynlo POS
Configures eviction policies and monitors usage


import redis
import json
from datetime import datetime
from urllib.parse import urlparse
import os
import sys

def parse_redis_url(url):
    """Parse Redis URL into connection parameters"""
    parsed = urlparse(url)
    
    # Handle rediss:// (SSL) vs redis://
    use_ssl = parsed.scheme == 'rediss'
    
    return {
        'host': parsed.hostname,
        'port': parsed.port or 6379,
        'password': parsed.password,
        'decode_responses': True,
        'ssl': use_ssl,
        'ssl_cert_reqs': 'required' if use_ssl else None
    }

def get_redis_client(redis_url):
    """Get Redis client with proper SSL settings"""
    conn_params = parse_redis_url(redis_url)
    return redis.Redis(**conn_params)

def analyze_memory_usage(client):
    """Analyze Redis memory usage"""
    print("\n=== REDIS MEMORY ANALYSIS ===")
    
    try:
        # Get memory info
        info = client.info('memory')
        
        used_memory = info['used_memory']
        used_memory_human = info['used_memory_human']
        used_memory_peak = info['used_memory_peak']
        used_memory_peak_human = info['used_memory_peak_human']
        
        print(f"Current memory usage: {used_memory_human}")
        print(f"Peak memory usage: {used_memory_peak_human}")
        print(f"Memory fragmentation ratio: {info.get('mem_fragmentation_ratio', 'N/A')}")
        
        # Get maxmemory setting
        maxmemory = client.config_get('maxmemory')['maxmemory']
        if maxmemory == '0':
            print("Max memory: Not set (using all available)")
            recommendation_memory = '512mb'
        else:
            print(f"Max memory: {int(maxmemory) / 1024 / 1024:.0f} MB")
            recommendation_memory = '512mb' if int(maxmemory) > 536870912 else None
        
        # Calculate usage percentage
        if maxmemory != '0':
            usage_percent = (used_memory / int(maxmemory)) * 100
            print(f"Memory usage: {usage_percent:.1f}%")
        
        # Memory usage by data type
        print("\nMemory by data type:")
        for key in ['used_memory_scripts', 'used_memory_startup']:
            if key in info:
                print(f"  {key}: {info[key] / 1024:.2f} KB")
        
        return used_memory, recommendation_memory
        
    except Exception as e:
        print(f"Error analyzing memory: {str(e)}")
        return 0, None

def analyze_key_patterns(client):
    """Analyze key patterns and TTLs"""
    print("\n=== KEY PATTERN ANALYSIS ===")
    
    try:
        # Sample keys (careful in production with large datasets)
        keys = []
        cursor = 0
        sample_size = 100
        
        while len(keys) < sample_size:
            cursor, batch = client.scan(cursor, count=10)
            keys.extend(batch)
            if cursor == 0:
                break
        
        print(f"Sampled {len(keys)} keys")
        
        # Analyze key patterns
        patterns = {}
        no_ttl_count = 0
        
        for key in keys[:sample_size]:
            # Get key type and TTL
            key_type = client.type(key)
            ttl = client.ttl(key)
            
            # Extract pattern (e.g., "session:*", "cache:*")
            pattern = key.split(':')[0] if ':' in key else 'other'
            
            if pattern not in patterns:
                patterns[pattern] = {
                    'count': 0,
                    'types': {},
                    'no_ttl': 0
                }
            
            patterns[pattern]['count'] += 1
            patterns[pattern]['types'][key_type] = patterns[pattern]['types'].get(key_type, 0) + 1
            
            if ttl == -1:  # No expiration
                patterns[pattern]['no_ttl'] += 1
                no_ttl_count += 1
        
        print("\nKey patterns found:")
        for pattern, stats in patterns.items():
            print(f"\n  {pattern}:* ({stats['count']} keys)")
            print(f"    Types: {stats['types']}")
            print(f"    Without TTL: {stats['no_ttl']}")
        
        if no_ttl_count > len(keys) * 0.5:
            print(f"\n⚠️  Warning: {no_ttl_count}/{len(keys)} sampled keys have no TTL!")
            print("   Consider setting expiration for cache keys")
        
        return patterns
        
    except Exception as e:
        print(f"Error analyzing keys: {str(e)}")
        return {}

def check_persistence(client):
    """Check Redis persistence configuration"""
    print("\n=== PERSISTENCE CONFIGURATION ===")
    
    try:
        # Check AOF
        aof_enabled = client.config_get('appendonly')['appendonly']
        print(f"AOF (Append Only File): {aof_enabled}")
        
        # Check RDB
        save_config = client.config_get('save')['save']
        print(f"RDB snapshots: {save_config if save_config else 'Disabled'}")
        
        # Last save time
        last_save = client.lastsave()
        print(f"Last save: {datetime.fromtimestamp(last_save)}")
        
    except Exception as e:
        print(f"Error checking persistence: {str(e)}")

def configure_eviction_policy(client, dry_run=True):
    """Configure optimal eviction policy"""
    print("\n=== EVICTION POLICY CONFIGURATION ===")
    
    try:
        # Get current policy
        current_policy = client.config_get('maxmemory-policy')['maxmemory-policy']
        print(f"Current eviction policy: {current_policy}")
        
        # Recommended policy for cache
        recommended_policy = 'allkeys-lru'
        
        if current_policy != recommended_policy:
            print(f"Recommended policy: {recommended_policy}")
            print("  - Evicts least recently used keys when memory is full")
            print("  - Best for general caching scenarios")
            
            if not dry_run:
                client.config_set('maxmemory-policy', recommended_policy)
                print(f"✅ Updated eviction policy to {recommended_policy}")
        else:
            print("✅ Eviction policy is already optimal")
            
    except Exception as e:
        print(f"Error configuring eviction: {str(e)}")

def check_cache_performance(client):
    """Check cache hit rates and performance"""
    print("\n=== CACHE PERFORMANCE ===")
    
    try:
        stats = client.info('stats')
        
        keyspace_hits = int(stats.get('keyspace_hits', 0))
        keyspace_misses = int(stats.get('keyspace_misses', 0))
        
        if keyspace_hits + keyspace_misses > 0:
            hit_rate = (keyspace_hits / (keyspace_hits + keyspace_misses)) * 100
            print(f"Cache hit rate: {hit_rate:.2f}%")
            print(f"Total hits: {keyspace_hits:,}")
            print(f"Total misses: {keyspace_misses:,}")
            
            if hit_rate < 80:
                print("⚠️  Cache hit rate is below 80% - review caching strategy")
            else:
                print("✅ Cache hit rate is good")
        else:
            print("No cache statistics available yet")
            
        # Check command stats
        total_commands = int(stats.get('total_commands_processed', 0))
        print(f"\nTotal commands processed: {total_commands:,}")
        
    except Exception as e:
        print(f"Error checking performance: {str(e)}")

def generate_redis_config(memory_mb=512):
    """Generate optimized Redis configuration"""
    print("\n=== RECOMMENDED REDIS CONFIGURATION ===")
    
    config = f"""
# Fynlo POS Redis Configuration
# Memory limit (prevent OOM)
maxmemory {memory_mb}mb

# Eviction policy (remove least recently used keys)
maxmemory-policy allkeys-lru

# Persistence (balanced for cache usage)
save 900 1      # Save after 900 sec if at least 1 key changed
save 300 10     # Save after 300 sec if at least 10 keys changed
save 60 10000   # Save after 60 sec if at least 10000 keys changed

# AOF disabled for better performance (cache can be rebuilt)
appendonly no

# Lazy freeing for better performance
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes

# Timeout for idle clients (5 minutes)
timeout 300

# TCP keepalive
tcp-keepalive 60

# Disable dangerous commands in production
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""

    
    print(config)
    
    # Save to file
    with open('redis-optimized.conf', 'w') as f:
        f.write(config)
    
    print(f"\nConfiguration saved to: redis-optimized.conf")

def generate_recommendations(used_memory, recommendation_memory):
    """Generate optimization recommendations"""
    print("\n" + "="*60)
    print("REDIS OPTIMIZATION RECOMMENDATIONS")
    print("="*60)
    
    used_memory_mb = used_memory / 1024 / 1024
    
    recommendations = []
    
    if used_memory_mb < 200:
        print(f"\n1. REDIS SIZE")
        print(f"   Current: 1GB plan ($15/month)")
        print(f"   Actual usage: {used_memory_mb:.2f} MB")
        print(f"   Recommendation: Downsize to 512MB plan ($7/month)")
        print(f"   Monthly savings: $8")
        recommendations.append("Downsize Redis from 1GB to 512MB")
    
    print(f"\n2. EVICTION POLICY")
    print(f"   Set maxmemory-policy to 'allkeys-lru'")
    print(f"   This ensures old cache entries are removed automatically")
    
    print(f"\n3. KEY EXPIRATION")
    print(f"   Implement TTLs for all cache keys:")
    print(f"   - Session data: 24 hours")
    print(f"   - API cache: 5-15 minutes")
    print(f"   - Static data: 1 hour")
    
    print(f"\n4. CONNECTION POOLING")
    print(f"   Use connection pooling in your application")
    print(f"   Recommended pool size: 10-20 connections")
    
    return recommendations

def main():
    """Run Redis optimization analysis"""
    print("="*60)
    print("Fynlo POS Redis Optimization")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    # For DigitalOcean managed Redis, you would need the connection details
    print("\nTo run this script, you need:")
    print("1. Redis connection URL from DigitalOcean")
    print("2. Format: rediss://default:password@host:port")
    print("\nExample usage:")
    print("python optimize_redis.py --redis-url 'rediss://default:password@redis-host:25061'")
    
    # Check if Redis URL is provided via environment
    redis_url = os.environ.get('REDIS_URL')
    
    if not redis_url:
        print("\n❌ REDIS_URL environment variable not set")
        print("\nManual recommendations for DigitalOcean Managed Redis:")
        print("\n1. Check memory usage in DigitalOcean dashboard")
        print("2. If < 200MB used, downsize to 512MB plan")
        print("3. Configure eviction policy via dashboard")
        print("4. Monitor cache hit rates")
        
        # Generate config anyway
        generate_redis_config(512)
        
        return
    
    try:
        client = get_redis_client(redis_url)
        
        # Test connection
        client.ping()
        print("✅ Connected to Redis successfully")
        
        # Run analysis
        used_memory, recommendation_memory = analyze_memory_usage(client)
        analyze_key_patterns(client)
        check_persistence(client)
        configure_eviction_policy(client, dry_run=True)
        check_cache_performance(client)
        
        # Generate recommendations
        recommendations = generate_recommendations(used_memory, recommendation_memory)
        
        # Save report
        report = {
            "timestamp": datetime.now().isoformat(),
            "memory_usage_mb": used_memory / 1024 / 1024,
            "recommendations": recommendations
        }
        
        with open(f"redis-optimization-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json", 'w') as f:
            json.dump(report, f, indent=2)
        
        print("\n✅ Redis optimization analysis complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()