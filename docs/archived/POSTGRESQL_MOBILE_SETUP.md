# 🐘 PostgreSQL Mobile Optimization Guide

## 📋 **Quick Setup for CashApp iOS Integration**

This guide provides the specific PostgreSQL configuration optimizations needed for the CashApp iOS implementation.

---

## 🚀 **1. PostgreSQL Installation & Setup**

### **macOS Installation**
```bash
# Install PostgreSQL 14+ with tools
brew install postgresql@14 pgbouncer redis nginx

# Start services
brew services start postgresql@14
brew services start redis
brew services start nginx

# Create mobile-optimized database
createdb cashapp_mobile
```

### **Linux Installation (Ubuntu/Debian)**
```bash
# Install PostgreSQL 14+
sudo apt update
sudo apt install -y postgresql-14 postgresql-contrib-14 pgbouncer redis-server nginx

# Create database
sudo -u postgres createdb cashapp_mobile
```

---

## ⚙️ **2. PostgreSQL Mobile Configuration**

### **Main Configuration (postgresql.conf)**
```bash
# Save as: config/postgresql.conf

# Connection Settings (Mobile Optimized)
max_connections = 200                    # Increased for mobile connections
shared_buffers = 256MB                  # 25% of RAM for small instances
effective_cache_size = 1GB             # 75% of RAM for query planning

# Mobile Performance Optimizations
work_mem = 4MB                          # Memory per operation (mobile friendly)
maintenance_work_mem = 64MB             # Memory for maintenance operations
checkpoint_completion_target = 0.9     # Spread checkpoints for consistent performance

# Logging (for mobile debugging)
log_statement = 'mod'                   # Log modifications for debugging
log_min_duration_statement = 1000      # Log slow queries (>1 second)
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Mobile Connection Optimizations
tcp_keepalives_idle = 600              # 10 minutes before keepalive
tcp_keepalives_interval = 30           # 30 seconds between keepalives
tcp_keepalives_count = 3               # 3 failed keepalives before disconnect

# SSL for Mobile Security
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
```

### **Create Mobile-Specific Indexes**
```sql
-- Save as: scripts/mobile_indexes.sql

-- Optimize for mobile queries
CREATE INDEX CONCURRENT idx_pos_order_date_status ON pos_order(date_order, state);
CREATE INDEX CONCURRENT idx_pos_order_session ON pos_order(session_id) WHERE state != 'cancel';
CREATE INDEX CONCURRENT idx_product_mobile ON product_product(active, available_in_pos) WHERE active = true;
CREATE INDEX CONCURRENT idx_pos_payment_mobile ON pos_payment(pos_order_id, payment_method_id);

-- Partial indexes for active records only
CREATE INDEX CONCURRENT idx_res_partner_active ON res_partner(id) WHERE active = true;
CREATE INDEX CONCURRENT idx_product_template_pos ON product_template(id) WHERE available_in_pos = true;

-- Composite indexes for common mobile queries
CREATE INDEX CONCURRENT idx_pos_order_composite ON pos_order(session_id, date_order, state, user_id);
```

---

## 🔄 **3. Connection Pooling with pgbouncer**

### **pgbouncer Configuration**
```ini
# Save as: config/pgbouncer.ini

[databases]
cashapp_mobile = host=localhost port=5432 dbname=cashapp_mobile user=cashapp_user

[pgbouncer]
# Mobile-optimized pooling settings
pool_mode = transaction                  # Transaction-level pooling for mobile
max_client_conn = 1000                  # Max mobile client connections
default_pool_size = 50                  # Pool size per database
max_db_connections = 100                # Max connections to PostgreSQL
max_user_connections = 100              # Max connections per user

# Timeouts (mobile-friendly)
server_idle_timeout = 600               # 10 minutes server idle
client_idle_timeout = 0                 # No client timeout (mobile apps)
server_connect_timeout = 15             # 15 seconds to connect
query_timeout = 30                      # 30 seconds per query

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1

# Authentication
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Admin
admin_users = postgres
stats_users = postgres

# Listen
listen_addr = 127.0.0.1
listen_port = 6432
```

### **User Authentication File**
```bash
# Save as: config/userlist.txt
"cashapp_user" "md5_password_hash"
"postgres" "md5_admin_password_hash"

# Generate password hash:
echo -n "passwordusername" | md5sum
```

---

## 🏃‍♂️ **4. Redis Caching Configuration**

### **Redis Configuration for Mobile**
```bash
# Save as: config/redis.conf

# Memory Management
maxmemory 512mb
maxmemory-policy allkeys-lru

# Mobile-optimized settings
timeout 300                             # 5 minute timeout
tcp-keepalive 60                        # Keepalive for mobile connections

# Persistence (for session data)
save 900 1                              # Save if at least 1 key changed in 900 seconds
save 300 10                             # Save if at least 10 keys changed in 300 seconds
save 60 10000                           # Save if at least 10000 keys changed in 60 seconds

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Security
requirepass your_redis_password
```

### **Redis Key Patterns for Mobile**
```python
# Cache patterns for mobile app
CACHE_PATTERNS = {
    'products': 'mobile:products:*',           # TTL: 1 hour
    'orders': 'mobile:orders:session:*',       # TTL: 24 hours
    'user_session': 'mobile:session:*',        # TTL: 8 hours
    'table_status': 'mobile:tables:*',         # TTL: 5 minutes
    'menu_items': 'mobile:menu:*',             # TTL: 2 hours
}
```

---

## 🌐 **5. Mobile API Configuration**

### **Nginx Configuration for Mobile API**
```nginx
# Save as: config/nginx_mobile.conf

upstream cashapp_backend {
    server 127.0.0.1:8069;              # CashApp backend
    keepalive 32;
}

upstream pgbouncer_pool {
    server 127.0.0.1:6432;              # pgbouncer connection
    keepalive 16;
}

server {
    listen 80;
    server_name cashapp-mobile.local;

    # Mobile API routes
    location /api/v1/ {
        proxy_pass http://cashapp_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Mobile-specific headers
        proxy_set_header X-Mobile-App "true";
        proxy_set_header X-Client-Type "ios";
        
        # Timeouts for mobile
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Caching for mobile
        proxy_cache mobile_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_valid 404 1m;
    }

    # WebSocket for real-time updates
    location /ws/ {
        proxy_pass http://cashapp_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}

# Cache configuration
proxy_cache_path /tmp/nginx_cache levels=1:2 keys_zone=mobile_cache:10m max_size=100m;
```

---

## 📊 **6. Database Monitoring for Mobile**

### **Performance Monitoring Queries**
```sql
-- Save as: scripts/mobile_monitoring.sql

-- Monitor mobile connections
SELECT 
    application_name,
    client_addr,
    state,
    query_start,
    query
FROM pg_stat_activity 
WHERE application_name LIKE '%mobile%' OR client_addr IS NOT NULL;

-- Check slow queries affecting mobile
SELECT 
    query,
    mean_exec_time,
    calls,
    total_exec_time
FROM pg_stat_statements 
WHERE mean_exec_time > 1000  -- Queries taking more than 1 second
ORDER BY mean_exec_time DESC;

-- Mobile-relevant table statistics
SELECT 
    schemaname,
    tablename,
    n_tup_ins + n_tup_upd + n_tup_del as total_changes,
    n_tup_hot_upd,
    seq_scan,
    idx_scan
FROM pg_stat_user_tables 
WHERE tablename IN ('pos_order', 'pos_payment', 'product_product', 'res_partner')
ORDER BY total_changes DESC;
```

### **Health Check Script**
```bash
#!/bin/bash
# Save as: scripts/mobile_health_check.sh

echo "=== CashApp Mobile Database Health Check ==="

# PostgreSQL Status
echo "1. PostgreSQL Status:"
pg_isready -h localhost -p 5432 && echo "✅ PostgreSQL: OK" || echo "❌ PostgreSQL: DOWN"

# pgbouncer Status
echo "2. pgbouncer Status:"
nc -z localhost 6432 && echo "✅ pgbouncer: OK" || echo "❌ pgbouncer: DOWN"

# Redis Status
echo "3. Redis Status:"
redis-cli ping | grep -q PONG && echo "✅ Redis: OK" || echo "❌ Redis: DOWN"

# Connection Count
echo "4. Active Connections:"
psql -h localhost -p 6432 -d cashapp_mobile -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';" -t

# Cache Hit Ratio
echo "5. Cache Hit Ratio:"
psql -h localhost -p 5432 -d cashapp_mobile -c "SELECT round((sum(heap_blks_hit) / sum(heap_blks_hit + heap_blks_read) * 100)::numeric, 2) as cache_hit_ratio FROM pg_statio_user_tables;" -t

echo "=== Health Check Complete ==="
```

---

## 🚀 **7. Mobile-Specific Setup Script**

### **Automated Setup Script**
```bash
#!/bin/bash
# Save as: scripts/setup_mobile_db.sh

set -e

echo "🚀 Setting up CashApp Mobile Database..."

# 1. Create database and user
echo "1. Creating database and user..."
psql -c "CREATE DATABASE cashapp_mobile;"
psql -c "CREATE USER cashapp_user WITH PASSWORD 'secure_mobile_password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE cashapp_mobile TO cashapp_user;"

# 2. Apply mobile optimizations
echo "2. Applying mobile optimizations..."
psql -d cashapp_mobile -f scripts/mobile_indexes.sql

# 3. Setup pgbouncer
echo "3. Configuring pgbouncer..."
cp config/pgbouncer.ini /etc/pgbouncer/
cp config/userlist.txt /etc/pgbouncer/
systemctl restart pgbouncer

# 4. Configure Redis
echo "4. Configuring Redis..."
cp config/redis.conf /etc/redis/
systemctl restart redis

# 5. Setup Nginx
echo "5. Configuring Nginx..."
cp config/nginx_mobile.conf /etc/nginx/sites-available/cashapp-mobile
ln -sf /etc/nginx/sites-available/cashapp-mobile /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 6. Create monitoring user
echo "6. Setting up monitoring..."
psql -d cashapp_mobile -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# 7. Set permissions
echo "7. Setting up permissions..."
chmod +x scripts/mobile_health_check.sh

echo "✅ Mobile database setup complete!"
echo ""
echo "Connection details:"
echo "  Database: cashapp_mobile"
echo "  Host: localhost"
echo "  Port: 6432 (via pgbouncer)"
echo "  User: cashapp_user"
echo "  Redis: localhost:6379"
echo ""
echo "Run health check: ./scripts/mobile_health_check.sh"
```

---

## 📱 **8. iOS App Database Connection**

### **iOS Connection Configuration**
```swift
// iOS Database Service Configuration
struct DatabaseConfig {
    static let host = "your-server.com"
    static let port = 6432  // pgbouncer port
    static let database = "cashapp_mobile"
    static let username = "cashapp_user"
    static let useSSL = true
    static let connectionTimeout = 15.0
    static let queryTimeout = 30.0
}

// Connection Pool Settings
struct ConnectionPool {
    static let maxConnections = 10
    static let minConnections = 2
    static let connectionLifetime = 3600  // 1 hour
    static let retryAttempts = 3
    static let retryDelay = 1.0
}
```

### **React Native Database Service**
```javascript
// Mobile Database Service
class MobileDatabaseService {
    constructor() {
        this.baseURL = 'https://cashapp-mobile.local/api/v1';
        this.timeout = 30000; // 30 seconds
        this.retryAttempts = 3;
    }

    async query(endpoint, params = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Mobile-App': 'true',
                'X-Client-Type': 'ios',
            },
            timeout: this.timeout,
        };

        // Add retry logic for mobile connectivity
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) {
                    return await response.json();
                }
                throw new Error(`HTTP ${response.status}`);
            } catch (error) {
                if (attempt === this.retryAttempts) throw error;
                await this.delay(1000 * attempt); // Exponential backoff
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

---

## ✅ **9. Verification Steps**

### **Test Database Performance**
```bash
# 1. Test PostgreSQL direct connection
psql -h localhost -p 5432 -d cashapp_mobile -c "SELECT version();"

# 2. Test pgbouncer pooled connection
psql -h localhost -p 6432 -d cashapp_mobile -c "SELECT count(*) FROM pg_stat_activity;"

# 3. Test Redis caching
redis-cli set mobile:test "working" EX 60
redis-cli get mobile:test

# 4. Run performance test
pgbench -h localhost -p 6432 -d cashapp_mobile -c 10 -t 100

# 5. Check mobile health
./scripts/mobile_health_check.sh
```

### **Expected Results**
- ✅ PostgreSQL connections stable at < 50ms latency
- ✅ pgbouncer pooling reduces connection overhead by 70%+
- ✅ Redis caching improves query response by 80%+
- ✅ Mobile API responses under 500ms for 95% of requests

---

## 🔧 **Troubleshooting**

### **Common Issues**
1. **High connection count**: Check pgbouncer pool settings
2. **Slow queries**: Review mobile_indexes.sql and add missing indexes
3. **Redis memory issues**: Adjust maxmemory and eviction policy
4. **SSL certificate errors**: Ensure proper SSL setup for mobile

### **Performance Tuning**
- Monitor `pg_stat_statements` for slow queries
- Use `EXPLAIN ANALYZE` for query optimization
- Adjust `work_mem` based on mobile query patterns
- Fine-tune Redis cache TTL values based on usage

---

This configuration provides a production-ready PostgreSQL setup optimized specifically for mobile CashApp iOS connections with proper connection pooling, caching, and monitoring.