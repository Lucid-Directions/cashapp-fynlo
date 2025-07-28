# 🚀 Fynlo POS Production Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Docker Configuration](#docker-configuration)
3. [Environment Configuration](#environment-configuration)
4. [Database Migration Strategies](#database-migration-strategies)
5. [Monitoring and Logging Setup](#monitoring-and-logging-setup)
6. [Security Hardening Checklist](#security-hardening-checklist)
7. [Performance Optimization](#performance-optimization)
8. [CI/CD Pipeline](#cicd-pipeline-recommendations)
9. [Deployment Checklist](#deployment-checklist)
10. [Troubleshooting](#troubleshooting)

## Overview

This guide covers the complete production deployment process for the Fynlo POS system, a multi-tenant restaurant management platform with React Native mobile app and FastAPI backend.

### Architecture Components
- **Backend**: FastAPI + PostgreSQL + Redis
- **Frontend**: React Native iOS/Android app
- **Infrastructure**: Docker containers orchestrated with docker-compose
- **Monitoring**: Prometheus + Grafana
- **Reverse Proxy**: Nginx with SSL/TLS

## Docker Configuration

### 1. Production Dockerfile for FastAPI

Create `backend/Dockerfile.production`:

```dockerfile
# Multi-stage build for production
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libc6-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser

# Set working directory
WORKDIR /app

# Copy application code
COPY --chown=appuser:appuser . .

# Create necessary directories
RUN mkdir -p uploads logs && chown -R appuser:appuser uploads logs

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Use gunicorn for production
CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8080", \
     "--workers", "4", \
     "--threads", "2", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "50", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]
```

### 2. Production Docker Compose

Create `backend/docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  # Main API Service
  fynlo-api:
    build:
      context: .
      dockerfile: Dockerfile.production
    image: fynlo-pos-api:latest
    container_name: fynlo-api
    restart: always
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?sslmode=require
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    networks:
      - fynlo-network
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # PostgreSQL with replication support
  postgres:
    image: postgres:15-alpine
    container_name: fynlo-postgres
    restart: always
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_INITDB_ARGS=--encoding=UTF8 --lc-collate=C --lc-ctype=C
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/postgres-backup.sh:/usr/local/bin/backup.sh:ro
    networks:
      - fynlo-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Redis with persistence
  redis:
    image: redis:7-alpine
    container_name: fynlo-redis
    restart: always
    command: >
      redis-server
      --appendonly yes
      --appendfsync everysec
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - fynlo-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: fynlo-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - fynlo-api
    networks:
      - fynlo-network
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 256M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Monitoring Stack
  prometheus:
    image: prom/prometheus:latest
    container_name: fynlo-prometheus
    restart: always
    ports:
      - "127.0.0.1:9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    networks:
      - fynlo-network
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

  grafana:
    image: grafana/grafana:latest
    container_name: fynlo-grafana
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_ROOT_URL=https://metrics.fynlo.co.uk
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
    networks:
      - fynlo-network
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M

  # Log aggregation
  loki:
    image: grafana/loki:latest
    container_name: fynlo-loki
    restart: always
    ports:
      - "127.0.0.1:3100:3100"
    volumes:
      - ./monitoring/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki_data:/loki
    networks:
      - fynlo-network

  # Database backup service
  postgres-backup:
    image: postgres:15-alpine
    container_name: fynlo-postgres-backup
    restart: always
    environment:
      - PGPASSWORD=${DB_PASSWORD}
    volumes:
      - ./backups:/backups
      - ./scripts/backup-cron.sh:/etc/periodic/daily/backup:ro
    networks:
      - fynlo-network
    command: ["crond", "-f"]

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  nginx_logs:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
  loki_data:
    driver: local

networks:
  fynlo-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

## Environment Configuration

### 1. Production Environment Variables

Create `.env.production`:

```bash
# Application Settings
APP_NAME="Fynlo POS"
DEBUG=false
ENVIRONMENT=production
API_V1_STR="/api/v1"
BASE_URL=https://api.fynlo.co.uk

# Database Configuration (Use managed database in production)
DATABASE_URL=postgresql://fynlo_prod:${SECURE_DB_PASSWORD}@db.fynlo.co.uk:5432/fynlo_production?sslmode=require&sslcert=/app/certs/client.crt&sslkey=/app/certs/client.key&sslrootcert=/app/certs/ca.crt

# Redis Configuration (Use managed Redis in production)
REDIS_URL=rediss://:${SECURE_REDIS_PASSWORD}@redis.fynlo.co.uk:6380/0?ssl_cert_reqs=required

# Security Settings (Generate these!)
SECRET_KEY=${SECURE_SECRET_KEY}  # 64+ character random string
JWT_SECRET_KEY=${SECURE_JWT_KEY}  # 64+ character random string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
PLATFORM_OWNER_SECRET_KEY=${SECURE_PLATFORM_KEY}  # Platform admin 2FA

# Supabase Authentication
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY}

# Payment Processing (Production Keys)
STRIPE_SECRET_KEY=sk_live_${STRIPE_LIVE_KEY}
STRIPE_PUBLISHABLE_KEY=pk_live_${STRIPE_PUB_KEY}
STRIPE_WEBHOOK_SECRET=whsec_${STRIPE_WEBHOOK_KEY}

SQUARE_APPLICATION_ID=${SQUARE_PROD_APP_ID}
SQUARE_ACCESS_TOKEN=${SQUARE_PROD_TOKEN}
SQUARE_LOCATION_ID=${SQUARE_PROD_LOCATION}
SQUARE_WEBHOOK_SIGNATURE_KEY=${SQUARE_WEBHOOK_KEY}
SQUARE_ENVIRONMENT=production

SUMUP_API_KEY=${SUMUP_PROD_KEY}
SUMUP_MERCHANT_CODE=${SUMUP_MERCHANT}
SUMUP_ENVIRONMENT=production

# CORS Origins (Production domains only)
CORS_ORIGINS=https://app.fynlo.co.uk,https://fynlo.co.uk,https://api.fynlo.co.uk

# File Storage
SPACES_ACCESS_KEY_ID=${DO_SPACES_KEY}
SPACES_SECRET_ACCESS_KEY=${DO_SPACES_SECRET}
SPACES_BUCKET=fynlo-pos-production
SPACES_REGION=lon1
CDN_ENDPOINT=https://cdn.fynlo.co.uk
ENABLE_SPACES_STORAGE=true

# Email Service
RESEND_API_KEY=${RESEND_PROD_KEY}
RESEND_FROM_EMAIL=noreply@fynlo.co.uk

# Logging
LOG_LEVEL=INFO
ERROR_DETAIL_ENABLED=false

# Monitoring
SENTRY_DSN=${SENTRY_DSN}
NEW_RELIC_LICENSE_KEY=${NEW_RELIC_KEY}
PROMETHEUS_ENABLED=true
```

### 2. Secret Management Best Practices

```bash
# Generate secure keys
python3 -c "import secrets; print(secrets.token_urlsafe(64))"

# Store secrets in environment or secret management service
# Options:
# 1. HashiCorp Vault
# 2. AWS Secrets Manager  
# 3. DigitalOcean Spaces (encrypted)
# 4. Kubernetes Secrets (if using K8s)

# Example: Using DigitalOcean App Platform
doctl apps create --spec app.yaml
doctl apps config set <app-id> SECRET_KEY="<generated-key>" --encrypt
```

## Database Migration Strategies

### 1. Zero-Downtime Migration Process

Create `scripts/migrate-production.sh`:

```bash
#!/bin/bash
set -euo pipefail

# Configuration
DB_URL=${DATABASE_URL}
BACKUP_DIR="/backups/migrations"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 Starting production migration process..."

# Step 1: Create backup
echo "📦 Creating database backup..."
pg_dump $DB_URL > "$BACKUP_DIR/pre_migration_$TIMESTAMP.sql"

# Step 2: Run migrations in transaction
echo "🔄 Running migrations..."
cd /app
alembic upgrade head

# Step 3: Verify migration
echo "✅ Verifying migration..."
python scripts/verify_migration.py

# Step 4: Health check
echo "🏥 Running health checks..."
curl -f http://localhost:8080/health || exit 1

echo "✨ Migration completed successfully!"
```

### 2. Rollback Strategy

Create `scripts/rollback-migration.sh`:

```bash
#!/bin/bash
set -euo pipefail

REVISION=${1:-"-1"}
echo "⚠️  Rolling back to revision: $REVISION"

# Create safety backup
pg_dump $DATABASE_URL > "/backups/rollback_$(date +%Y%m%d_%H%M%S).sql"

# Rollback
alembic downgrade $REVISION

# Restart services
docker-compose restart fynlo-api

echo "✅ Rollback completed"
```

### 3. Blue-Green Deployment

```yaml
# docker-compose.blue-green.yml
version: '3.8'

services:
  fynlo-api-blue:
    extends:
      file: docker-compose.production.yml
      service: fynlo-api
    container_name: fynlo-api-blue
    labels:
      - "traefik.http.routers.api-blue.rule=Host(`api.fynlo.co.uk`) && Headers(`X-Version`, `blue`)"

  fynlo-api-green:
    extends:
      file: docker-compose.production.yml
      service: fynlo-api
    container_name: fynlo-api-green
    labels:
      - "traefik.http.routers.api-green.rule=Host(`api.fynlo.co.uk`) && Headers(`X-Version`, `green`)"
```

## Monitoring and Logging Setup

### 1. Prometheus Alerts Configuration

Create `monitoring/alerts.yml`:

```yaml
groups:
  - name: fynlo_alerts
    interval: 30s
    rules:
      # API Performance
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API response time (95th percentile > 500ms)"
          description: "{{ $labels.method }} {{ $labels.endpoint }} is slow"

      - alert: APIDown
        expr: up{job="fynlo-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Fynlo API is down"
          description: "API has been down for more than 1 minute"

      # Database
      - alert: DatabaseConnectionPoolExhausted
        expr: postgresql_connections_used / postgresql_connections_max > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool near exhaustion"

      - alert: DatabaseReplicationLag
        expr: postgresql_replication_lag_seconds > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database replication lag is high"

      # Redis
      - alert: RedisHighMemoryUsage
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis memory usage is high"

      # Payment Processing
      - alert: PaymentProcessingFailureRate
        expr: rate(payment_failures_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High payment failure rate"
          description: "More than 5% of payments are failing"

      # Security
      - alert: SuspiciousLoginActivity
        expr: rate(failed_login_attempts[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Suspicious login activity detected"

      # Resource Usage
      - alert: HighCPUUsage
        expr: rate(process_cpu_seconds_total[5m]) > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"

      - alert: DiskSpaceLow
        expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space (< 10% available)"
```

### 2. Grafana Dashboard Configuration

Create `monitoring/grafana/dashboards/fynlo-dashboard.json`:

```json
{
  "dashboard": {
    "title": "Fynlo POS Production Dashboard",
    "panels": [
      {
        "title": "API Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Response Time (95th percentile)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"
          }
        ]
      },
      {
        "title": "Payment Success Rate",
        "targets": [
          {
            "expr": "rate(payment_success_total[5m]) / rate(payment_attempts_total[5m])"
          }
        ]
      },
      {
        "title": "Active WebSocket Connections",
        "targets": [
          {
            "expr": "websocket_connections_active"
          }
        ]
      },
      {
        "title": "Database Connections",
        "targets": [
          {
            "expr": "postgresql_connections_used"
          }
        ]
      },
      {
        "title": "Redis Memory Usage",
        "targets": [
          {
            "expr": "redis_memory_used_bytes / 1024 / 1024"
          }
        ]
      }
    ]
  }
}
```

### 3. Centralized Logging with Loki

Create `monitoring/loki-config.yml`:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1

schema_config:
  configs:
    - from: 2023-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  retention_period: 720h
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h
```

## Security Hardening Checklist

### 1. Infrastructure Security

```bash
# Firewall Rules (ufw)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp  # SSH (restrict to specific IPs)
sudo ufw allow 80/tcp  # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable

# Fail2ban Configuration
sudo apt-get install fail2ban
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
EOF
```

### 2. SSL/TLS Configuration

```nginx
# Strong SSL Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# Security Headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:;" always;
```

### 3. Application Security

```python
# backend/app/core/security.py
from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limiting
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri="redis://redis:6379"
)

# Security middleware
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# Input validation
from pydantic import validator

class SecureInput(BaseModel):
    @validator('*', pre=True)
    def sanitize_input(cls, v):
        if isinstance(v, str):
            # Remove dangerous characters
            dangerous = ['<', '>', '"', "'", '&', ';', '(', ')', '\\']
            for char in dangerous:
                v = v.replace(char, '')
        return v
```

### 4. Database Security

```sql
-- Create read-only user for reporting
CREATE USER fynlo_readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE fynlo_production TO fynlo_readonly;
GRANT USAGE ON SCHEMA public TO fynlo_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO fynlo_readonly;

-- Enable row-level security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY restaurant_isolation ON orders
    FOR ALL TO fynlo_app
    USING (restaurant_id = current_setting('app.current_restaurant_id')::int);
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Critical indexes for performance
CREATE INDEX CONCURRENTLY idx_orders_restaurant_created 
    ON orders(restaurant_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_payments_order_id 
    ON payments(order_id) 
    WHERE status = 'completed';

CREATE INDEX CONCURRENTLY idx_users_email 
    ON users(lower(email));

-- Materialized view for analytics
CREATE MATERIALIZED VIEW daily_revenue AS
SELECT 
    date_trunc('day', created_at) as date,
    restaurant_id,
    SUM(total_amount) as revenue,
    COUNT(*) as order_count
FROM orders
WHERE status = 'completed'
GROUP BY 1, 2;

CREATE INDEX ON daily_revenue (restaurant_id, date DESC);

-- Refresh materialized view daily
CREATE OR REPLACE FUNCTION refresh_daily_revenue()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_revenue;
END;
$$ LANGUAGE plpgsql;
```

### 2. Redis Caching Strategy

```python
# backend/app/core/cache.py
from functools import wraps
import json
from typing import Optional
import redis.asyncio as redis

class CacheManager:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    def cache_key(self, prefix: str, *args, **kwargs):
        """Generate cache key from function arguments"""
        key_parts = [prefix]
        key_parts.extend(str(arg) for arg in args)
        key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))
        return ":".join(key_parts)
    
    def cached(self, prefix: str, ttl: int = 300):
        """Decorator for caching function results"""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Skip cache for certain conditions
                if kwargs.get('skip_cache'):
                    return await func(*args, **kwargs)
                
                cache_key = self.cache_key(prefix, *args, **kwargs)
                
                # Try to get from cache
                cached_value = await self.redis.get(cache_key)
                if cached_value:
                    return json.loads(cached_value)
                
                # Compute and cache result
                result = await func(*args, **kwargs)
                await self.redis.setex(
                    cache_key, 
                    ttl, 
                    json.dumps(result, default=str)
                )
                return result
            
            return wrapper
        return decorator

# Usage example
cache_manager = CacheManager(redis_client)

@cache_manager.cached("menu", ttl=3600)
async def get_restaurant_menu(restaurant_id: int):
    # Expensive database query
    return await db.fetch_menu(restaurant_id)
```

### 3. API Response Optimization

```python
# backend/app/core/performance.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import gzip
import json

class CompressionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Check if client accepts gzip
        accept_encoding = request.headers.get("Accept-Encoding", "")
        if "gzip" not in accept_encoding:
            return response
        
        # Compress response if it's JSON and large enough
        if response.headers.get("Content-Type", "").startswith("application/json"):
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            
            if len(body) > 1024:  # Only compress if > 1KB
                compressed = gzip.compress(body)
                response.headers["Content-Encoding"] = "gzip"
                response.headers["Content-Length"] = str(len(compressed))
                return Response(
                    content=compressed,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type
                )
        
        return response
```

### 4. Connection Pooling

```python
# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import NullPool, QueuePool

# Production database configuration
engine = create_async_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True,
    echo=False,
    connect_args={
        "server_settings": {
            "application_name": "fynlo_pos_api",
            "jit": "off"
        },
        "command_timeout": 60,
        "options": "-c statement_timeout=30000"  # 30 second statement timeout
    }
)
```

## CI/CD Pipeline Recommendations

### 1. GitHub Actions Production Pipeline

Create `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements-dev.txt
      
      - name: Run tests
        run: |
          pytest tests/ -v --cov=app --cov-report=xml
      
      - name: Run security scan
        run: |
          pip install bandit safety
          bandit -r app/ -f json -o bandit-report.json
          safety check --json > safety-report.json

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          file: ./backend/Dockerfile.production
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to DigitalOcean
        env:
          DIGITALOCEAN_ACCESS_TOKEN: ${{ secrets.DO_ACCESS_TOKEN }}
        run: |
          # Install doctl
          cd ~
          wget https://github.com/digitalocean/doctl/releases/download/v1.98.0/doctl-1.98.0-linux-amd64.tar.gz
          tar xf ~/doctl-1.98.0-linux-amd64.tar.gz
          sudo mv ~/doctl /usr/local/bin
          
          # Authenticate
          doctl auth init -t $DIGITALOCEAN_ACCESS_TOKEN
          
          # Deploy app
          doctl apps update ${{ secrets.DO_APP_ID }} --spec .do/app.yaml
      
      - name: Run database migrations
        run: |
          doctl apps run ${{ secrets.DO_APP_ID }} -- alembic upgrade head
      
      - name: Health check
        run: |
          sleep 30
          curl -f https://api.fynlo.co.uk/health || exit 1
      
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment completed for version ${{ github.ref }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  post-deploy:
    needs: deploy
    runs-on: ubuntu-latest
    
    steps:
      - name: Warm up cache
        run: |
          # Warm up common endpoints
          curl -s https://api.fynlo.co.uk/api/v1/restaurants
          curl -s https://api.fynlo.co.uk/api/v1/menu
      
      - name: Run smoke tests
        run: |
          npm install -g newman
          newman run tests/postman/production-smoke-tests.json \
            --environment tests/postman/production-env.json \
            --reporters cli,json \
            --reporter-json-export smoke-test-results.json
      
      - name: Update status page
        run: |
          curl -X POST https://api.statuspage.io/v1/pages/${{ secrets.STATUSPAGE_ID }}/incidents \
            -H "Authorization: OAuth ${{ secrets.STATUSPAGE_TOKEN }}" \
            -d "incident[name]=Deployment completed" \
            -d "incident[status]=resolved" \
            -d "incident[component_ids][]=${{ secrets.API_COMPONENT_ID }}"
```

### 2. Rollback Pipeline

Create `.github/workflows/rollback-production.yml`:

```yaml
name: Rollback Production

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to rollback to'
        required: true
        type: string

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Confirm rollback
        uses: trstringer/manual-approval@v1
        with:
          secret: ${{ github.TOKEN }}
          approvers: prod-team
          minimum-approvals: 2
      
      - name: Rollback deployment
        env:
          DIGITALOCEAN_ACCESS_TOKEN: ${{ secrets.DO_ACCESS_TOKEN }}
        run: |
          doctl auth init -t $DIGITALOCEAN_ACCESS_TOKEN
          doctl apps update ${{ secrets.DO_APP_ID }} \
            --image fynlo-pos-api:${{ github.event.inputs.version }}
      
      - name: Verify rollback
        run: |
          sleep 30
          VERSION=$(curl -s https://api.fynlo.co.uk/version | jq -r .version)
          if [ "$VERSION" != "${{ github.event.inputs.version }}" ]; then
            echo "Rollback failed! Current version: $VERSION"
            exit 1
          fi
```

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (unit, integration, e2e)
- [ ] Security scan completed (no high/critical vulnerabilities)
- [ ] Database migrations tested on staging
- [ ] Performance benchmarks meet SLA requirements
- [ ] Documentation updated
- [ ] Rollback plan prepared
- [ ] Stakeholders notified

### Deployment Steps

1. **Database Backup**
   ```bash
   ./scripts/backup-production.sh
   ```

2. **Deploy Database Migrations**
   ```bash
   ./scripts/migrate-production.sh
   ```

3. **Deploy Application**
   ```bash
   docker-compose -f docker-compose.production.yml up -d --no-deps fynlo-api
   ```

4. **Verify Deployment**
   ```bash
   ./scripts/verify-deployment.sh
   ```

5. **Monitor Metrics**
   - Check Grafana dashboards
   - Monitor error rates
   - Verify payment processing

### Post-Deployment

- [ ] Smoke tests passing
- [ ] No increase in error rates
- [ ] Performance metrics stable
- [ ] Cache warmed up
- [ ] Status page updated
- [ ] Team notified

## Troubleshooting

### Common Issues and Solutions

#### 1. High Memory Usage

```bash
# Check memory usage
docker stats

# Analyze memory leaks
docker exec fynlo-api python -m memory_profiler app/main.py

# Emergency restart
docker-compose restart fynlo-api
```

#### 2. Database Connection Issues

```bash
# Check connection pool
docker exec fynlo-postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Reset connections
docker exec fynlo-postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';"
```

#### 3. Redis Performance

```bash
# Monitor Redis
docker exec fynlo-redis redis-cli INFO stats

# Clear cache if needed
docker exec fynlo-redis redis-cli FLUSHDB
```

#### 4. Payment Processing Failures

```bash
# Check payment logs
docker logs fynlo-api --tail 1000 | grep -i payment

# Verify webhook endpoints
curl -X POST https://api.fynlo.co.uk/webhooks/stripe \
  -H "Stripe-Signature: test" \
  -d '{}'
```

### Emergency Procedures

#### Complete Rollback

```bash
#!/bin/bash
# emergency-rollback.sh

# Stop current deployment
docker-compose -f docker-compose.production.yml down

# Restore database
psql $DATABASE_URL < /backups/last-known-good.sql

# Deploy previous version
docker-compose -f docker-compose.production.yml up -d

# Clear Redis cache
docker exec fynlo-redis redis-cli FLUSHALL

# Notify team
curl -X POST $SLACK_WEBHOOK -d '{"text":"Emergency rollback completed"}'
```

## Conclusion

This guide provides a comprehensive approach to deploying the Fynlo POS system in production. Key points:

1. **Security First**: Every configuration prioritizes security
2. **High Availability**: Built for 99.9% uptime
3. **Performance**: Optimized for < 500ms response times
4. **Monitoring**: Complete observability stack
5. **Automation**: CI/CD pipeline for safe deployments

Remember to:
- Test everything in staging first
- Keep backups current
- Monitor continuously
- Document any customizations

For additional support, consult the team documentation or reach out to the DevOps team.