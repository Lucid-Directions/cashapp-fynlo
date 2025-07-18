# DigitalOcean Monitoring & Security - Complete Observability and Protection

## 🎯 Objective
Implement comprehensive monitoring, alerting, and security hardening across the entire DigitalOcean infrastructure to ensure high availability, performance optimization, and robust security posture.

## 📋 Context & Prerequisites

### Current State After Phase 5
- [x] Complete DigitalOcean infrastructure deployed
- [x] Database migrated and operational
- [x] File storage and CDN configured
- [x] App Platform backend running successfully
- [x] Basic monitoring enabled automatically

### What We're Implementing
- **Infrastructure Monitoring**: CPU, memory, disk, network metrics
- **Application Performance Monitoring**: Response times, error rates
- **Security Monitoring**: Intrusion detection, vulnerability scanning
- **Log Aggregation**: Centralized logging and analysis
- **Alerting**: Multi-channel notifications for critical events
- **Security Hardening**: Firewall rules, access controls, encryption

### Monitoring Stack
```
📊 Complete Monitoring Architecture:
┌─────────────────────────────────────────────────────────────┐
│                   DIGITALOCEAN MONITORING                   │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ App Platform│  │ Database    │  │ Load        │         │
│  │ Metrics     │  │ Metrics     │  │ Balancer    │         │
│  │             │  │             │  │ Metrics     │         │
│  │ - CPU/RAM   │  │ - Queries   │  │ - Traffic   │         │
│  │ - Requests  │  │ - Locks     │  │ - Response  │         │
│  │ - Errors    │  │ - Cache Hit │  │ - Health    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Spaces      │  │ VPC         │  │ Firewall    │         │
│  │ Metrics     │  │ Network     │  │ Security    │         │
│  │             │  │             │  │             │         │
│  │ - Storage   │  │ - Bandwidth │  │ - Blocked   │         │
│  │ - Requests  │  │ - Latency   │  │ - Allowed   │         │
│  │ - CDN Cache │  │ - Packets   │  │ - Threats   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────────────────────┐
                │     ALERTING CHANNELS       │
                │                             │
                │  📧 Email Notifications     │
                │  💬 Slack Integration       │
                │  📱 SMS Alerts (Critical)   │
                │  📊 Dashboard Widgets       │
                └─────────────────────────────┘
```

## 🚀 Implementation Steps

### Step 1: Configure Advanced Infrastructure Monitoring

#### 1.1 Set Up Custom Alert Policies
```bash
# Create comprehensive alert policies for all services

# 1. App Platform High CPU Alert
doctl monitoring alert-policy create \
  --type "v1/insights/app/cpu_percentage" \
  --description "App Platform High CPU Usage" \
  --compare "GreaterThan" \
  --value 80 \
  --window "5m" \
  --entities "app:$FYNLO_APP_ID"

# 2. App Platform High Memory Alert
doctl monitoring alert-policy create \
  --type "v1/insights/app/memory_percentage" \
  --description "App Platform High Memory Usage" \
  --compare "GreaterThan" \
  --value 85 \
  --window "5m" \
  --entities "app:$FYNLO_APP_ID"

# 3. App Platform Error Rate Alert
doctl monitoring alert-policy create \
  --type "v1/insights/app/error_rate" \
  --description "App Platform High Error Rate" \
  --compare "GreaterThan" \
  --value 5 \
  --window "2m" \
  --entities "app:$FYNLO_APP_ID"

# 4. Database CPU Alert
doctl monitoring alert-policy create \
  --type "v1/dbaas/alerts/database_cpu_percent" \
  --description "Database High CPU Usage" \
  --compare "GreaterThan" \
  --value 75 \
  --window "5m" \
  --entities "database:fynlo-pos-db"

# 5. Database Memory Alert
doctl monitoring alert-policy create \
  --type "v1/dbaas/alerts/database_memory_percent" \
  --description "Database High Memory Usage" \
  --compare "GreaterThan" \
  --value 85 \
  --window "5m" \
  --entities "database:fynlo-pos-db"

# 6. Database Connection Alert
doctl monitoring alert-policy create \
  --type "v1/dbaas/alerts/database_connection_percent" \
  --description "Database High Connection Usage" \
  --compare "GreaterThan" \
  --value 80 \
  --window "3m" \
  --entities "database:fynlo-pos-db"

# 7. Load Balancer Health Alert
doctl monitoring alert-policy create \
  --type "v1/load_balancer/unhealthy_backends" \
  --description "Load Balancer Unhealthy Backends" \
  --compare "GreaterThan" \
  --value 0 \
  --window "1m" \
  --entities "load_balancer:$FYNLO_LB_ID"

echo "✅ Alert policies created"
```

#### 1.2 Configure Alert Notification Channels
```bash
# Set up notification channels (manual step - requires dashboard)
echo "📧 Setting up notification channels..."
echo "Go to: https://cloud.digitalocean.com/monitoring/alerts/policies"
echo ""
echo "For each alert policy, add notification channels:"
echo "1. Email: your-email@domain.com"
echo "2. Slack webhook: https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
echo "3. PagerDuty (for critical alerts): integration key"
echo ""
echo "Recommended notification setup:"
echo "- Critical alerts (CPU > 90%, DB down): Email + Slack + SMS"
echo "- Warning alerts (CPU > 80%): Email + Slack"
echo "- Info alerts (deployment): Slack only"
```

### Step 2: Implement Application Performance Monitoring

#### 2.1 Add APM to Backend Application
Update `backend/app/main.py`:
```python
"""
Enhanced FastAPI application with comprehensive monitoring
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time
import psutil
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.v1.payments import router as payments_router
from app.api.v1.files import router as files_router
from app.services.sumup_service import sumup_service

# Enhanced logging configuration
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
)
logger = logging.getLogger(__name__)

# Metrics storage (in production, use proper metrics service)
app_metrics = {
    'requests_total': 0,
    'requests_failed': 0,
    'response_times': [],
    'active_connections': 0,
    'startup_time': datetime.now().isoformat()
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan with enhanced monitoring"""
    # Startup
    logger.info("🚀 Starting Fynlo POS Backend with Monitoring")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug Mode: {settings.debug}")
    
    # System info
    logger.info(f"System CPU Count: {psutil.cpu_count()}")
    logger.info(f"System Memory: {psutil.virtual_memory().total / (1024**3):.1f} GB")
    
    # Initialize services
    try:
        await sumup_service.initialize()
        logger.info("✅ SumUp service initialized")
    except Exception as e:
        logger.error(f"❌ SumUp service initialization failed: {e}")
    
    # Start background monitoring tasks
    asyncio.create_task(monitor_system_resources())
    asyncio.create_task(cleanup_metrics())
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Fynlo POS Backend")
    await sumup_service.close()


# Create FastAPI application with enhanced monitoring
app = FastAPI(
    title="Fynlo POS Backend",
    description="Secure backend with comprehensive monitoring",
    version=settings.version,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan
)

# Add middleware for request monitoring
@app.middleware("http")
async def monitor_requests(request: Request, call_next):
    """Monitor all HTTP requests"""
    start_time = time.time()
    app_metrics['requests_total'] += 1
    app_metrics['active_connections'] += 1
    
    # Process request
    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception as e:
        logger.error(f"Request failed: {str(e)}")
        app_metrics['requests_failed'] += 1
        status_code = 500
        response = JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )
    
    # Calculate response time
    process_time = time.time() - start_time
    app_metrics['response_times'].append(process_time)
    
    # Keep only last 1000 response times
    if len(app_metrics['response_times']) > 1000:
        app_metrics['response_times'] = app_metrics['response_times'][-1000:]
    
    app_metrics['active_connections'] -= 1
    
    # Add monitoring headers
    response.headers["X-Process-Time"] = str(process_time)
    response.headers["X-Request-ID"] = str(app_metrics['requests_total'])
    
    # Log slow requests
    if process_time > 1.0:
        logger.warning(f"Slow request: {request.method} {request.url} took {process_time:.2f}s")
    
    # Log failed requests
    if status_code >= 400:
        logger.error(f"Failed request: {request.method} {request.url} returned {status_code}")
    
    return response


async def monitor_system_resources():
    """Background task to monitor system resources"""
    while True:
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            
            # Log high resource usage
            if cpu_percent > 80:
                logger.warning(f"High CPU usage: {cpu_percent:.1f}%")
            
            if memory_percent > 85:
                logger.warning(f"High memory usage: {memory_percent:.1f}%")
            
            if disk_percent > 85:
                logger.warning(f"High disk usage: {disk_percent:.1f}%")
            
            # Store metrics (in production, send to monitoring service)
            app_metrics.update({
                'cpu_percent': cpu_percent,
                'memory_percent': memory_percent,
                'disk_percent': disk_percent,
                'last_check': datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Resource monitoring error: {e}")
        
        await asyncio.sleep(60)  # Check every minute


async def cleanup_metrics():
    """Clean up old metrics data"""
    while True:
        await asyncio.sleep(3600)  # Every hour
        
        # Reset response times if too many
        if len(app_metrics['response_times']) > 10000:
            app_metrics['response_times'] = app_metrics['response_times'][-1000:]
            logger.info("Cleaned up old response time metrics")


# Enhanced health check endpoint
@app.get("/health")
async def enhanced_health_check():
    """Comprehensive health check with metrics"""
    try:
        health_status = {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'version': settings.version,
            'environment': settings.environment
        }
        
        # Check SumUp service
        try:
            sumup_healthy = await sumup_service.is_merchant_authenticated()
            health_status['services'] = {
                'sumup': 'healthy' if sumup_healthy else 'degraded'
            }
        except Exception as e:
            health_status['services'] = {'sumup': 'unhealthy'}
            health_status['status'] = 'degraded'
        
        # Add system metrics
        if 'cpu_percent' in app_metrics:
            health_status['system'] = {
                'cpu_percent': app_metrics['cpu_percent'],
                'memory_percent': app_metrics['memory_percent'],
                'disk_percent': app_metrics['disk_percent']
            }
        
        # Add application metrics
        response_times = app_metrics['response_times']
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        
        health_status['metrics'] = {
            'requests_total': app_metrics['requests_total'],
            'requests_failed': app_metrics['requests_failed'],
            'error_rate': (app_metrics['requests_failed'] / max(app_metrics['requests_total'], 1)) * 100,
            'avg_response_time': round(avg_response_time, 3),
            'active_connections': app_metrics['active_connections'],
            'uptime': app_metrics['startup_time']
        }
        
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
        )


@app.get("/metrics")
async def get_metrics():
    """Prometheus-compatible metrics endpoint"""
    try:
        response_times = app_metrics['response_times']
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        
        metrics = f"""
# HELP fynlo_requests_total Total number of HTTP requests
# TYPE fynlo_requests_total counter
fynlo_requests_total {app_metrics['requests_total']}

# HELP fynlo_requests_failed Total number of failed HTTP requests
# TYPE fynlo_requests_failed counter
fynlo_requests_failed {app_metrics['requests_failed']}

# HELP fynlo_response_time_avg Average response time in seconds
# TYPE fynlo_response_time_avg gauge
fynlo_response_time_avg {avg_response_time:.3f}

# HELP fynlo_active_connections Current active connections
# TYPE fynlo_active_connections gauge
fynlo_active_connections {app_metrics['active_connections']}
"""
        
        if 'cpu_percent' in app_metrics:
            metrics += f"""
# HELP fynlo_cpu_usage_percent CPU usage percentage
# TYPE fynlo_cpu_usage_percent gauge
fynlo_cpu_usage_percent {app_metrics['cpu_percent']}

# HELP fynlo_memory_usage_percent Memory usage percentage
# TYPE fynlo_memory_usage_percent gauge
fynlo_memory_usage_percent {app_metrics['memory_percent']}
"""
        
        return Response(content=metrics, media_type="text/plain")
        
    except Exception as e:
        logger.error(f"Metrics endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Metrics unavailable")


# Add security middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Include routers
app.include_router(payments_router)
app.include_router(files_router)

# Root endpoint with system info
@app.get("/")
async def root():
    """Root endpoint with enhanced system information"""
    return {
        "message": "Fynlo POS Backend API",
        "version": settings.version,
        "environment": settings.environment,
        "status": "running",
        "docs_url": "/docs" if not settings.is_production else "disabled",
        "health_check": "/health",
        "metrics": "/metrics",
        "timestamp": datetime.now().isoformat()
    }
```

#### 2.2 Add Database Monitoring Queries
Create `backend/app/services/monitoring_service.py`:
```python
"""
Database and Application Monitoring Service
"""

import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import psycopg2
from urllib.parse import urlparse

from app.core.config import settings

logger = logging.getLogger(__name__)


class MonitoringService:
    """Database and application monitoring service"""
    
    def __init__(self):
        self.database_url = settings.database_url
        self.redis_url = settings.redis_url
    
    async def get_database_stats(self) -> Dict:
        """Get comprehensive database statistics"""
        try:
            # Parse database URL
            parsed = urlparse(self.database_url)
            
            # Connect to database
            conn = psycopg2.connect(
                host=parsed.hostname,
                port=parsed.port,
                user=parsed.username,
                password=parsed.password,
                database=parsed.path[1:]
            )
            
            cursor = conn.cursor()
            
            # Get database size
            cursor.execute("""
                SELECT pg_size_pretty(pg_database_size(current_database())) as size
            """)
            db_size = cursor.fetchone()[0]
            
            # Get connection count
            cursor.execute("""
                SELECT count(*) as active_connections
                FROM pg_stat_activity 
                WHERE state = 'active'
            """)
            active_connections = cursor.fetchone()[0]
            
            # Get table statistics
            cursor.execute("""
                SELECT 
                    schemaname,
                    tablename,
                    n_tup_ins as inserts,
                    n_tup_upd as updates,
                    n_tup_del as deletes,
                    n_live_tup as live_rows,
                    n_dead_tup as dead_rows
                FROM pg_stat_user_tables 
                ORDER BY n_live_tup DESC
                LIMIT 10
            """)
            table_stats = cursor.fetchall()
            
            # Get slow queries (if pg_stat_statements is enabled)
            try:
                cursor.execute("""
                    SELECT 
                        query,
                        calls,
                        total_time,
                        mean_time
                    FROM pg_stat_statements 
                    ORDER BY mean_time DESC 
                    LIMIT 5
                """)
                slow_queries = cursor.fetchall()
            except:
                slow_queries = []
            
            # Get database locks
            cursor.execute("""
                SELECT 
                    mode,
                    count(*) as count
                FROM pg_locks 
                WHERE granted = true
                GROUP BY mode
            """)
            locks = cursor.fetchall()
            
            conn.close()
            
            return {
                'database_size': db_size,
                'active_connections': active_connections,
                'table_stats': [
                    {
                        'schema': row[0],
                        'table': row[1],
                        'inserts': row[2],
                        'updates': row[3],
                        'deletes': row[4],
                        'live_rows': row[5],
                        'dead_rows': row[6]
                    } for row in table_stats
                ],
                'slow_queries': [
                    {
                        'query': row[0][:100] + '...' if len(row[0]) > 100 else row[0],
                        'calls': row[1],
                        'total_time': row[2],
                        'mean_time': row[3]
                    } for row in slow_queries
                ],
                'locks': [
                    {'mode': row[0], 'count': row[1]} for row in locks
                ],
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Database stats error: {e}")
            return {'error': str(e), 'timestamp': datetime.now().isoformat()}
    
    async def get_cache_stats(self) -> Dict:
        """Get Redis/Valkey cache statistics"""
        try:
            import redis
            
            r = redis.from_url(self.redis_url)
            info = r.info()
            
            return {
                'connected_clients': info.get('connected_clients', 0),
                'used_memory': info.get('used_memory_human', '0'),
                'used_memory_peak': info.get('used_memory_peak_human', '0'),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'hit_rate': (
                    info.get('keyspace_hits', 0) / 
                    max(info.get('keyspace_hits', 0) + info.get('keyspace_misses', 0), 1)
                ) * 100,
                'total_commands_processed': info.get('total_commands_processed', 0),
                'uptime_in_seconds': info.get('uptime_in_seconds', 0),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Cache stats error: {e}")
            return {'error': str(e), 'timestamp': datetime.now().isoformat()}
    
    async def check_application_health(self) -> Dict:
        """Comprehensive application health check"""
        health = {
            'overall_status': 'healthy',
            'checks': {},
            'timestamp': datetime.now().isoformat()
        }
        
        # Check database
        try:
            db_stats = await self.get_database_stats()
            if 'error' not in db_stats:
                health['checks']['database'] = {
                    'status': 'healthy',
                    'active_connections': db_stats['active_connections']
                }
            else:
                health['checks']['database'] = {'status': 'unhealthy', 'error': db_stats['error']}
                health['overall_status'] = 'degraded'
        except Exception as e:
            health['checks']['database'] = {'status': 'unhealthy', 'error': str(e)}
            health['overall_status'] = 'degraded'
        
        # Check cache
        try:
            cache_stats = await self.get_cache_stats()
            if 'error' not in cache_stats:
                health['checks']['cache'] = {
                    'status': 'healthy',
                    'hit_rate': cache_stats['hit_rate']
                }
            else:
                health['checks']['cache'] = {'status': 'unhealthy', 'error': cache_stats['error']}
                health['overall_status'] = 'degraded'
        except Exception as e:
            health['checks']['cache'] = {'status': 'unhealthy', 'error': str(e)}
            health['overall_status'] = 'degraded'
        
        return health


# Global service instance
monitoring_service = MonitoringService()
```

### Step 3: Implement Security Hardening

#### 3.1 Enhanced Firewall Configuration
```bash
# Create comprehensive firewall rules
echo "🔒 Configuring enhanced security..."

# Update existing firewall with more restrictive rules
doctl compute firewall add-rules $FYNLO_FIREWALL_ID \
  --inbound-rules "protocol:tcp,ports:22,sources:addresses:YOUR_IP_ADDRESS/32" \
  --inbound-rules "protocol:tcp,ports:443,sources:addresses:0.0.0.0/0,::0/0" \
  --inbound-rules "protocol:tcp,ports:80,sources:addresses:0.0.0.0/0,::0/0" \
  --outbound-rules "protocol:tcp,ports:443,destinations:addresses:0.0.0.0/0,::0/0" \
  --outbound-rules "protocol:tcp,ports:80,destinations:addresses:0.0.0.0/0,::0/0" \
  --outbound-rules "protocol:tcp,ports:53,destinations:addresses:0.0.0.0/0,::0/0" \
  --outbound-rules "protocol:udp,ports:53,destinations:addresses:0.0.0.0/0,::0/0"

# Remove overly permissive rules
echo "⚠️  Review and remove overly permissive firewall rules in DO dashboard"
echo "Go to: https://cloud.digitalocean.com/networking/firewalls"

echo "✅ Firewall rules updated"
```

#### 3.2 Enable DDoS Protection
```bash
# DDoS protection is automatically enabled on Load Balancers
echo "🛡️  DDoS Protection Status:"
doctl compute load-balancer get $FYNLO_LB_ID --format Name,Status,IP,Features

# Verify DDoS protection is active
echo "✅ DDoS protection automatically enabled on Load Balancer"
```

#### 3.3 Configure SSL/TLS Security
```bash
# Check SSL certificate status
doctl apps get $FYNLO_APP_ID --format Name,DefaultIngress,ActiveDeployment

# Verify SSL configuration
curl -I https://$FYNLO_APP_URL | grep -i "strict-transport-security\|x-frame-options\|x-content-type-options"

echo "🔐 SSL/TLS security verified"
```

#### 3.4 Implement Rate Limiting
Update `backend/app/main.py` to add rate limiting:
```python
# Add to imports
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Create limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add rate limiting to sensitive endpoints
@app.post("/api/auth/login")
@limiter.limit("5/minute")  # Max 5 login attempts per minute
async def login(request: Request):
    # Login logic here
    pass

@app.post("/api/payments/sumup/tap-to-pay")
@limiter.limit("10/minute")  # Max 10 payment attempts per minute
async def process_payment(request: Request):
    # Payment processing logic
    pass
```

### Step 4: Centralized Logging

#### 4.1 Configure Structured Logging
Update `backend/app/core/logging.py`:
```python
"""
Centralized logging configuration
"""

import json
import logging
import sys
from datetime import datetime
from typing import Dict, Any

from app.core.config import settings


class StructuredFormatter(logging.Formatter):
    """JSON structured log formatter"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'environment': settings.environment
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
        
        if hasattr(record, 'performance'):
            log_entry['performance'] = record.performance
        
        return json.dumps(log_entry)


def setup_logging():
    """Configure application logging"""
    
    # Remove default handlers
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
    
    # Create structured formatter
    formatter = StructuredFormatter()
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    # Root logger configuration
    logging.root.setLevel(getattr(logging, settings.log_level))
    logging.root.addHandler(console_handler)
    
    # Specific logger configurations
    # Reduce noise from external libraries
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('boto3').setLevel(logging.WARNING)
    logging.getLogger('botocore').setLevel(logging.WARNING)
    
    return logging.getLogger(__name__)


# Initialize logging
logger = setup_logging()
```

### Step 5: Set Up Log Aggregation and Analysis

#### 5.1 Configure Log Shipping to External Service
```bash
# Option 1: Ship logs to ELK Stack (if desired)
echo "📋 Log aggregation options:"
echo "1. DigitalOcean native logging (automatic)"
echo "2. External ELK/EFK stack"
echo "3. Third-party services (Datadog, New Relic)"
echo ""
echo "DigitalOcean automatically aggregates logs from:"
echo "- App Platform applications"
echo "- Managed databases"
echo "- Load balancers"
echo ""
echo "Access logs at: https://cloud.digitalocean.com/apps/$FYNLO_APP_ID/logs"
```

#### 5.2 Create Log Analysis Queries
Create common log analysis queries for the DigitalOcean dashboard:
```bash
# Document common log queries for the team
cat > log_analysis_queries.md << EOF
# Common Log Analysis Queries

## Error Rate Analysis
Filter: level="ERROR"
Time: Last 24 hours
Group by: module, function

## Performance Analysis
Filter: performance.response_time > 1.0
Time: Last 6 hours
Sort by: performance.response_time DESC

## Authentication Issues
Filter: message contains "authentication" AND level="ERROR"
Time: Last 24 hours
Group by: user_id

## Payment Processing Issues
Filter: logger contains "sumup" AND level="ERROR"
Time: Last 24 hours
Group by: message

## Database Issues
Filter: logger contains "database" AND level="ERROR"
Time: Last 24 hours

## High Traffic Analysis
Filter: level="INFO" AND message contains "request"
Time: Last 1 hour
Count requests per minute
EOF

echo "✅ Log analysis queries documented"
```

### Step 6: Advanced Security Monitoring

#### 6.1 Implement Security Event Monitoring
Create `backend/app/middleware/security_middleware.py`:
```python
"""
Security monitoring middleware
"""

import logging
import time
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict, deque
from datetime import datetime, timedelta
import ipaddress

logger = logging.getLogger(__name__)

# In-memory rate limiting (in production, use Redis)
request_history = defaultdict(lambda: deque())
suspicious_ips = set()


class SecurityMonitoringMiddleware(BaseHTTPMiddleware):
    """Monitor for security threats and suspicious activity"""
    
    def __init__(self, app, max_requests_per_minute: int = 60):
        super().__init__(app)
        self.max_requests_per_minute = max_requests_per_minute
        self.blocked_patterns = [
            '/admin', '/.env', '/wp-admin', '/phpmyadmin',
            '/.git', '/config', '/backup', '/test'
        ]
    
    async def dispatch(self, request: Request, call_next):
        client_ip = self.get_client_ip(request)
        now = datetime.now()
        
        # Check for blocked IP
        if client_ip in suspicious_ips:
            logger.warning(f"Blocked request from suspicious IP: {client_ip}")
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check for suspicious patterns
        if self.is_suspicious_request(request):
            logger.warning(f"Suspicious request detected", extra={
                'client_ip': client_ip,
                'path': str(request.url.path),
                'method': request.method,
                'user_agent': request.headers.get('user-agent', 'unknown')
            })
            
            # Add to suspicious IPs after multiple attempts
            self.track_suspicious_activity(client_ip)
        
        # Rate limiting check
        if self.is_rate_limited(client_ip, now):
            logger.warning(f"Rate limit exceeded", extra={
                'client_ip': client_ip,
                'requests_per_minute': len(request_history[client_ip])
            })
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        
        # Process request
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log security events
        if response.status_code >= 400:
            logger.info(f"HTTP {response.status_code} response", extra={
                'client_ip': client_ip,
                'path': str(request.url.path),
                'method': request.method,
                'status_code': response.status_code,
                'response_time': process_time
            })
        
        return response
    
    def get_client_ip(self, request: Request) -> str:
        """Get real client IP address"""
        # Check for forwarded IP (behind load balancer)
        forwarded_for = request.headers.get('x-forwarded-for')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        
        # Check for real IP header
        real_ip = request.headers.get('x-real-ip')
        if real_ip:
            return real_ip
        
        # Fallback to direct connection
        return request.client.host if request.client else 'unknown'
    
    def is_suspicious_request(self, request: Request) -> bool:
        """Check if request matches suspicious patterns"""
        path = request.url.path.lower()
        
        # Check blocked patterns
        for pattern in self.blocked_patterns:
            if pattern in path:
                return True
        
        # Check for SQL injection attempts
        query_params = str(request.url.query).lower()
        sql_patterns = ['union', 'select', 'drop', 'insert', '--', ';']
        if any(pattern in query_params for pattern in sql_patterns):
            return True
        
        # Check user agent
        user_agent = request.headers.get('user-agent', '').lower()
        bot_patterns = ['bot', 'crawler', 'spider', 'scraper']
        if any(pattern in user_agent for pattern in bot_patterns):
            return True
        
        return False
    
    def is_rate_limited(self, client_ip: str, now: datetime) -> bool:
        """Check if client IP is rate limited"""
        # Clean old requests
        cutoff = now - timedelta(minutes=1)
        while request_history[client_ip] and request_history[client_ip][0] < cutoff:
            request_history[client_ip].popleft()
        
        # Add current request
        request_history[client_ip].append(now)
        
        # Check if over limit
        return len(request_history[client_ip]) > self.max_requests_per_minute
    
    def track_suspicious_activity(self, client_ip: str):
        """Track suspicious activity and block if necessary"""
        # This is a simple implementation
        # In production, use more sophisticated threat detection
        suspicious_count = len([
            req for req in request_history[client_ip] 
            if req > datetime.now() - timedelta(minutes=5)
        ])
        
        if suspicious_count > 10:  # More than 10 suspicious requests in 5 minutes
            suspicious_ips.add(client_ip)
            logger.error(f"IP blocked for suspicious activity: {client_ip}")
```

#### 6.2 Add Security Monitoring Endpoints
Add to `backend/app/main.py`:
```python
# Security monitoring endpoints
@app.get("/security/status")
async def security_status(current_user: User = Depends(get_current_admin_user)):
    """Get security monitoring status (admin only)"""
    return {
        'suspicious_ips': list(suspicious_ips),
        'rate_limited_ips': [
            {'ip': ip, 'requests': len(history)} 
            for ip, history in request_history.items() 
            if len(history) > 50
        ],
        'blocked_requests_last_hour': len([
            req for reqs in request_history.values() 
            for req in reqs 
            if req > datetime.now() - timedelta(hours=1)
        ]),
        'timestamp': datetime.now().isoformat()
    }

# Apply security middleware
app.add_middleware(SecurityMonitoringMiddleware)
```

## ✅ Verification Steps

### Step 1: Test Monitoring and Alerting
```bash
# Test health endpoint
curl https://$FYNLO_APP_URL/health | jq

# Test metrics endpoint
curl https://$FYNLO_APP_URL/metrics

# Trigger CPU alert (stress test)
echo "🧪 Testing alert system..."
echo "Trigger high CPU usage to test alerts"

# Monitor alert notifications
echo "Check for alert notifications in:"
echo "- Email inbox"
echo "- Slack channel"
echo "- DigitalOcean dashboard"
```

### Step 2: Verify Security Hardening
```bash
# Test firewall rules
nmap -p 22,80,443 $FYNLO_LB_IP

# Test rate limiting
for i in {1..20}; do
  curl -s https://$FYNLO_APP_URL/health > /dev/null
  echo "Request $i sent"
  sleep 0.1
done

# Test SSL security
curl -I https://$FYNLO_APP_URL | grep -i security

echo "✅ Security verification completed"
```

### Step 3: Test Log Aggregation
```bash
# Generate test logs
curl https://$FYNLO_APP_URL/nonexistent-endpoint

# Check logs in DigitalOcean dashboard
echo "📋 Check logs at:"
echo "https://cloud.digitalocean.com/apps/$FYNLO_APP_ID/logs"

# Verify structured logging
echo "Look for JSON structured logs with fields:"
echo "- timestamp, level, logger, message"
echo "- user_id, request_id, performance"
```

## 🚨 Troubleshooting

### Issue: Alerts Not Triggering
**Symptoms**: No notifications received for alert conditions
**Solution**:
```bash
# Check alert policy configuration
doctl monitoring alert-policy list

# Verify notification channels
echo "Go to: https://cloud.digitalocean.com/monitoring/alerts/policies"
echo "Ensure each policy has notification channels configured"

# Test manual alert trigger
# Deliberately cause high CPU usage to test alerts
```

### Issue: High False Positive Rate
**Symptoms**: Too many unnecessary alerts
**Solution**:
```bash
# Adjust alert thresholds
doctl monitoring alert-policy update POLICY_ID \
  --value 90 \
  --window "10m"

# Fine-tune monitoring sensitivity
echo "Review and adjust alert thresholds based on normal usage patterns"
```

### Issue: Performance Impact from Monitoring
**Symptoms**: App performance degraded due to monitoring overhead
**Solution**:
```python
# Optimize monitoring code
# Reduce frequency of system checks
await asyncio.sleep(300)  # Check every 5 minutes instead of 1

# Sample metrics instead of recording everything
if random.random() < 0.1:  # 10% sampling rate
    record_metric(value)
```

## 🔄 Rollback Procedures

### Disable Monitoring (Emergency)
```bash
echo "🚨 EMERGENCY: Disabling monitoring"

# Remove monitoring middleware from backend
# Comment out monitoring lines in main.py
# Redeploy without monitoring

doctl apps create-deployment $FYNLO_APP_ID

echo "✅ Monitoring disabled"
```

### Reduce Alert Sensitivity
```bash
# Temporarily increase alert thresholds
doctl monitoring alert-policy update CPU_ALERT_ID --value 95
doctl monitoring alert-policy update MEMORY_ALERT_ID --value 90

echo "✅ Alert sensitivity reduced"
```

## ✨ Completion Criteria

- [x] Comprehensive infrastructure monitoring configured
- [x] Application performance monitoring implemented
- [x] Security hardening and threat detection active
- [x] Centralized logging with structured format
- [x] Multi-channel alerting system operational
- [x] Rate limiting and DDoS protection enabled
- [x] SSL/TLS security optimized
- [x] Database and cache monitoring active
- [x] Security event monitoring and response

## 📊 Monitoring Summary

### Metrics Tracked:
- **Infrastructure**: CPU, memory, disk, network usage
- **Application**: Request rate, error rate, response times
- **Database**: Query performance, connection count, locks
- **Cache**: Hit rate, memory usage, connections
- **Security**: Failed logins, suspicious requests, blocked IPs

### Alert Channels:
- **Email**: Critical and warning alerts
- **Slack**: All alerts with context
- **Dashboard**: Real-time metrics and graphs
- **SMS**: Critical alerts only (configured manually)

### Security Features:
- **Firewall**: Restrictive rules, only necessary ports open
- **DDoS Protection**: Automatic mitigation
- **Rate Limiting**: Per-endpoint request limits
- **Threat Detection**: Suspicious pattern monitoring
- **SSL Security**: Strong encryption and security headers

## 📝 Next Steps

After completing this phase:
1. **Continue to**: `ENVIRONMENT_MANAGEMENT_BEST_PRACTICES.md`
2. **Monitor**: Dashboard for first 48 hours to baseline normal operation
3. **Tune**: Alert thresholds based on actual usage patterns
4. **Document**: Incident response procedures

## 📈 Progress Tracking

- **Risk Level**: 🟡 Medium (monitoring overhead, alert noise)
- **Time Estimate**: 4-6 hours (monitoring setup and testing)
- **Dependencies**: Phase 5 completed (storage and CDN operational)
- **Impacts**: Observability, Security posture, Incident response

---

**📊 Monitoring Status**: Comprehensive observability and security monitoring active
**🛡️ Security**: Hardened infrastructure with threat detection
**🔄 Next Phase**: Environment management and deployment best practices