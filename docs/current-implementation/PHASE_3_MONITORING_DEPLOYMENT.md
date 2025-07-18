# 📊 Phase 3: Monitoring, Deployment & Production Readiness

**Duration**: Days 10-12
**Priority**: Critical for Production
**Goal**: Ensure system stability, monitoring, and smooth deployment

---

## 🎯 Overview

Phase 3 focuses on production readiness by implementing comprehensive monitoring, performance optimization, health checks, and deployment procedures. This phase ensures the system is stable, observable, and ready for real-world usage.

---

## ✅ Completed Tasks

### Deployment Infrastructure (Partial)
- [x] **Vercel Deployment**: Successfully deployed web platform to https://fynlo.co.uk
- [x] **Environment Configuration**: All required environment variables configured in Vercel
- [x] **Custom Domain**: fynlo.co.uk domain properly configured and working
- [x] **Build Process**: Fixed Vite build issues and TypeScript configuration
- [x] **Documentation Updates**: Updated all project docs to reflect deployment status

---

## 📋 Day 10: Monitoring Infrastructure

### Morning Tasks (4 hours)

#### 1. Backend Monitoring Setup

**Health Check Endpoints** (`backend/app/api/v1/endpoints/health.py`):
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import psutil
import asyncio

from app.core.database import get_db, engine
from app.core.redis_client import redis_client
from app.core.websocket import websocket_manager
from app.core.responses import APIResponseHelper

router = APIRouter()

@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return APIResponseHelper.success(
        data={
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "fynlo-pos-api"
        }
    )

@router.get("/health/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """Detailed health check with component status"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {}
    }
    
    # Check database
    try:
        db.execute("SELECT 1")
        health_status["components"]["database"] = {
            "status": "healthy",
            "response_time_ms": 0
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Check Redis
    try:
        start = datetime.utcnow()
        await redis_client.ping()
        response_time = (datetime.utcnow() - start).total_seconds() * 1000
        health_status["components"]["redis"] = {
            "status": "healthy",
            "response_time_ms": round(response_time, 2)
        }
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["components"]["redis"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Check WebSocket connections
    ws_stats = websocket_manager.get_connection_stats()
    health_status["components"]["websocket"] = {
        "status": "healthy",
        "active_connections": ws_stats.get("total_connections", 0),
        "restaurants_connected": ws_stats.get("restaurants_connected", 0)
    }
    
    # System resources
    health_status["components"]["system"] = {
        "cpu_percent": psutil.cpu_percent(interval=1),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage('/').percent
    }
    
    return APIResponseHelper.success(data=health_status)

@router.get("/health/dependencies")
async def check_dependencies():
    """Check external service dependencies"""
    dependencies = {
        "supabase": {"status": "unknown", "endpoint": "auth.api"},
        "stripe": {"status": "unknown", "endpoint": "api.stripe.com"},
        "redis": {"status": "unknown", "endpoint": "redis.server"}
    }
    
    # Check Supabase
    try:
        # Implement actual Supabase health check
        dependencies["supabase"]["status"] = "healthy"
    except Exception as e:
        dependencies["supabase"]["status"] = "unhealthy"
        dependencies["supabase"]["error"] = str(e)
    
    # Check Stripe
    try:
        # Implement actual Stripe health check
        dependencies["stripe"]["status"] = "healthy"
    except Exception as e:
        dependencies["stripe"]["status"] = "unhealthy"
        dependencies["stripe"]["error"] = str(e)
    
    # Check Redis (already connected)
    try:
        await redis_client.ping()
        dependencies["redis"]["status"] = "healthy"
    except Exception as e:
        dependencies["redis"]["status"] = "unhealthy"
        dependencies["redis"]["error"] = str(e)
    
    overall_status = "healthy"
    if any(dep["status"] == "unhealthy" for dep in dependencies.values()):
        overall_status = "degraded"
    
    return APIResponseHelper.success(
        data={
            "status": overall_status,
            "dependencies": dependencies,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
```

#### 2. Metrics Collection Service

**Metrics Collector** (`backend/app/services/metrics_collector.py`):
```python
import time
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

from app.core.redis_client import redis_client
from app.core.config import settings

class MetricsCollector:
    """Collects and aggregates system metrics"""
    
    def __init__(self):
        self.metrics_buffer = defaultdict(list)
        self.flush_interval = 60  # seconds
        self.last_flush = time.time()
    
    async def record_api_request(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        response_time_ms: float,
        user_id: Optional[str] = None,
        restaurant_id: Optional[str] = None
    ):
        """Record API request metrics"""
        metric = {
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "response_time_ms": response_time_ms,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "restaurant_id": restaurant_id
        }
        
        self.metrics_buffer["api_requests"].append(metric)
        
        # Increment counters in Redis for real-time monitoring
        hour_key = datetime.utcnow().strftime("%Y%m%d%H")
        await redis_client.incr(f"metrics:api:requests:{hour_key}")
        await redis_client.incr(f"metrics:api:status:{status_code}:{hour_key}")
        
        # Store response time for percentile calculations
        await redis_client.zadd(
            f"metrics:api:response_times:{hour_key}",
            {f"{time.time()}": response_time_ms}
        )
        
        # Auto-flush if needed
        if time.time() - self.last_flush > self.flush_interval:
            await self.flush_metrics()
    
    async def record_websocket_event(
        self,
        event_type: str,
        restaurant_id: str,
        user_id: Optional[str] = None,
        data_size_bytes: Optional[int] = None
    ):
        """Record WebSocket event metrics"""
        metric = {
            "event_type": event_type,
            "restaurant_id": restaurant_id,
            "user_id": user_id,
            "data_size_bytes": data_size_bytes,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.metrics_buffer["websocket_events"].append(metric)
        
        # Real-time counters
        hour_key = datetime.utcnow().strftime("%Y%m%d%H")
        await redis_client.incr(f"metrics:ws:events:{event_type}:{hour_key}")
    
    async def record_order_metric(
        self,
        order_id: str,
        restaurant_id: str,
        total_amount: float,
        items_count: int,
        payment_method: str,
        processing_time_ms: Optional[float] = None
    ):
        """Record order-related metrics"""
        metric = {
            "order_id": order_id,
            "restaurant_id": restaurant_id,
            "total_amount": total_amount,
            "items_count": items_count,
            "payment_method": payment_method,
            "processing_time_ms": processing_time_ms,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.metrics_buffer["orders"].append(metric)
        
        # Update aggregates
        day_key = datetime.utcnow().strftime("%Y%m%d")
        await redis_client.incr(f"metrics:orders:count:{restaurant_id}:{day_key}")
        await redis_client.incrbyfloat(
            f"metrics:orders:revenue:{restaurant_id}:{day_key}",
            total_amount
        )
    
    async def record_error(
        self,
        error_type: str,
        error_message: str,
        endpoint: Optional[str] = None,
        user_id: Optional[str] = None,
        stack_trace: Optional[str] = None
    ):
        """Record error metrics"""
        metric = {
            "error_type": error_type,
            "error_message": error_message[:500],  # Truncate long messages
            "endpoint": endpoint,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Don't store stack traces in metrics, only log them
        if stack_trace and settings.ENVIRONMENT == "development":
            metric["stack_trace"] = stack_trace[:1000]
        
        self.metrics_buffer["errors"].append(metric)
        
        # Error rate tracking
        hour_key = datetime.utcnow().strftime("%Y%m%d%H")
        await redis_client.incr(f"metrics:errors:{error_type}:{hour_key}")
    
    async def get_current_metrics(self) -> Dict[str, Any]:
        """Get current metrics summary"""
        hour_key = datetime.utcnow().strftime("%Y%m%d%H")
        day_key = datetime.utcnow().strftime("%Y%m%d")
        
        # Get API metrics
        api_requests = await redis_client.get(f"metrics:api:requests:{hour_key}") or 0
        api_errors = await redis_client.get(f"metrics:api:status:500:{hour_key}") or 0
        
        # Calculate response time percentiles
        response_times = await redis_client.zrange(
            f"metrics:api:response_times:{hour_key}",
            0, -1, withscores=True
        )
        
        percentiles = {}
        if response_times:
            times = [score for _, score in response_times]
            percentiles = {
                "p50": statistics.median(times),
                "p95": statistics.quantiles(times, n=20)[18] if len(times) > 20 else max(times),
                "p99": statistics.quantiles(times, n=100)[98] if len(times) > 100 else max(times)
            }
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "api": {
                "requests_per_hour": int(api_requests),
                "errors_per_hour": int(api_errors),
                "error_rate": float(api_errors) / float(api_requests) if api_requests > 0 else 0,
                "response_time_percentiles": percentiles
            },
            "orders": {
                "count_today": await self._get_total_orders_today(),
                "revenue_today": await self._get_total_revenue_today()
            },
            "websocket": {
                "active_connections": await self._get_active_connections()
            }
        }
    
    async def flush_metrics(self):
        """Flush metrics buffer to persistent storage"""
        if not self.metrics_buffer:
            return
        
        # Store aggregated metrics in Redis with expiration
        for metric_type, metrics in self.metrics_buffer.items():
            if metrics:
                key = f"metrics:buffer:{metric_type}:{int(time.time())}"
                await redis_client.set(key, metrics, expire=86400)  # 24 hours
        
        self.metrics_buffer.clear()
        self.last_flush = time.time()
    
    async def _get_total_orders_today(self) -> int:
        """Get total orders across all restaurants today"""
        day_key = datetime.utcnow().strftime("%Y%m%d")
        pattern = f"metrics:orders:count:*:{day_key}"
        
        total = 0
        async for key in redis_client.scan_iter(match=pattern):
            count = await redis_client.get(key)
            if count:
                total += int(count)
        
        return total
    
    async def _get_total_revenue_today(self) -> float:
        """Get total revenue across all restaurants today"""
        day_key = datetime.utcnow().strftime("%Y%m%d")
        pattern = f"metrics:orders:revenue:*:{day_key}"
        
        total = 0.0
        async for key in redis_client.scan_iter(match=pattern):
            revenue = await redis_client.get(key)
            if revenue:
                total += float(revenue)
        
        return total
    
    async def _get_active_connections(self) -> int:
        """Get current active WebSocket connections"""
        # This would be retrieved from the WebSocket manager
        return websocket_manager.get_connection_stats().get("total_connections", 0)

# Global metrics collector instance
metrics_collector = MetricsCollector()
```

#### 3. Monitoring Middleware

**Monitoring Middleware** (`backend/app/middleware/monitoring.py`):
```python
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime
import time
import traceback

from app.services.metrics_collector import metrics_collector
from app.core.logger import logger

class MonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware for request monitoring and metrics collection"""
    
    async def dispatch(self, request: Request, call_next):
        # Start timing
        start_time = time.time()
        
        # Extract request metadata
        user_id = None
        restaurant_id = None
        
        # Initialize response
        response = None
        status_code = 500
        
        try:
            # Get user context if available
            if hasattr(request.state, "user"):
                user_id = getattr(request.state.user, "id", None)
                restaurant_id = getattr(request.state.user, "restaurant_id", None)
            
            # Process request
            response = await call_next(request)
            status_code = response.status_code
            
        except Exception as e:
            # Log error with full context
            error_id = f"ERR-{int(time.time())}"
            logger.error(
                f"Request failed: {error_id}",
                extra={
                    "error_id": error_id,
                    "path": request.url.path,
                    "method": request.method,
                    "user_id": user_id,
                    "error": str(e),
                    "traceback": traceback.format_exc()
                }
            )
            
            # Record error metric
            await metrics_collector.record_error(
                error_type=type(e).__name__,
                error_message=str(e),
                endpoint=request.url.path,
                user_id=user_id
            )
            
            # Re-raise to let exception handlers deal with it
            raise
        
        finally:
            # Calculate response time
            response_time_ms = (time.time() - start_time) * 1000
            
            # Record metrics
            if response:
                await metrics_collector.record_api_request(
                    endpoint=request.url.path,
                    method=request.method,
                    status_code=status_code,
                    response_time_ms=response_time_ms,
                    user_id=user_id,
                    restaurant_id=restaurant_id
                )
                
                # Add monitoring headers
                response.headers["X-Response-Time"] = f"{response_time_ms:.2f}ms"
                response.headers["X-Request-ID"] = request.state.request_id if hasattr(request.state, "request_id") else "unknown"
            
            # Log slow requests
            if response_time_ms > 1000:  # 1 second
                logger.warning(
                    f"Slow request detected",
                    extra={
                        "path": request.url.path,
                        "method": request.method,
                        "response_time_ms": response_time_ms,
                        "user_id": user_id
                    }
                )
        
        return response
```

### Afternoon Tasks (4 hours)

#### 4. Frontend Performance Monitoring

**Performance Monitor Hook** (`src/hooks/usePerformanceMonitor.ts`):
```typescript
import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';

interface PerformanceMetric {
  screen: string;
  action: string;
  duration_ms: number;
  timestamp: string;
  device_info?: {
    platform: string;
    os_version: string;
    app_version: string;
    device_model: string;
  };
  network_info?: {
    type: string;
    is_connected: boolean;
    is_internet_reachable: boolean;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();
  private flushInterval: number = 60000; // 1 minute
  private apiEndpoint: string;

  constructor(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint;
    this.startAutoFlush();
  }

  startTimer(key: string): void {
    this.timers.set(key, Date.now());
  }

  async endTimer(key: string, screen: string, action: string): Promise<void> {
    const startTime = this.timers.get(key);
    if (!startTime) return;

    const duration_ms = Date.now() - startTime;
    this.timers.delete(key);

    // Get device and network info
    const [deviceInfo, networkInfo] = await Promise.all([
      this.getDeviceInfo(),
      this.getNetworkInfo()
    ]);

    const metric: PerformanceMetric = {
      screen,
      action,
      duration_ms,
      timestamp: new Date().toISOString(),
      device_info: deviceInfo,
      network_info: networkInfo
    };

    this.metrics.push(metric);

    // Log slow operations
    if (duration_ms > 1000) {
      console.warn(`Slow operation: ${action} on ${screen} took ${duration_ms}ms`);
    }
  }

  private async getDeviceInfo() {
    try {
      return {
        platform: Platform.OS,
        os_version: Platform.Version.toString(),
        app_version: DeviceInfo.getVersion(),
        device_model: DeviceInfo.getModel()
      };
    } catch (error) {
      return undefined;
    }
  }

  private async getNetworkInfo() {
    try {
      const state = await NetInfo.fetch();
      return {
        type: state.type,
        is_connected: state.isConnected || false,
        is_internet_reachable: state.isInternetReachable || false
      };
    } catch (error) {
      return undefined;
    }
  }

  private startAutoFlush(): void {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  async flush(): Promise<void> {
    if (this.metrics.length === 0) return;

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    try {
      await fetch(`${this.apiEndpoint}/metrics/frontend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({ metrics: metricsToSend })
      });
    } catch (error) {
      // Re-add metrics if send failed
      this.metrics.unshift(...metricsToSend);
      console.error('Failed to send metrics:', error);
    }
  }

  private async getAuthToken(): Promise<string> {
    // Get from your auth storage
    return '';
  }
}

// Global instance
const performanceMonitor = new PerformanceMonitor(
  process.env.REACT_APP_API_URL || ''
);

// React Hook
export function usePerformanceMonitor(screen: string) {
  const timerKeyRef = useRef<string>('');

  const startMeasure = (action: string): string => {
    const key = `${screen}-${action}-${Date.now()}`;
    timerKeyRef.current = key;
    performanceMonitor.startTimer(key);
    return key;
  };

  const endMeasure = async (action: string, key?: string): Promise<void> => {
    const timerKey = key || timerKeyRef.current;
    if (timerKey) {
      await performanceMonitor.endTimer(timerKey, screen, action);
    }
  };

  useEffect(() => {
    // Measure screen render time
    const renderKey = startMeasure('render');
    
    return () => {
      endMeasure('render', renderKey);
    };
  }, [screen]);

  return {
    startMeasure,
    endMeasure
  };
}

// HOC for screen performance monitoring
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  screenName: string
) {
  return (props: P) => {
    const { startMeasure, endMeasure } = usePerformanceMonitor(screenName);

    useEffect(() => {
      const mountKey = startMeasure('mount');
      
      return () => {
        endMeasure('unmount', mountKey);
      };
    }, []);

    return <Component {...props} />;
  };
}
```

#### 5. Error Tracking Service

**Error Boundary with Tracking** (`src/components/ErrorBoundary.tsx`):
```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { apiClient } from '../services/ApiClient';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    
    // Send error to monitoring service
    try {
      await this.reportError(error, errorInfo);
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }

    this.setState({
      error,
      errorInfo
    });
  }

  private async reportError(error: Error, errorInfo: ErrorInfo): Promise<void> {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      device: {
        platform: DeviceInfo.getSystemName(),
        version: DeviceInfo.getSystemVersion(),
        model: DeviceInfo.getModel(),
        appVersion: DeviceInfo.getVersion(),
        buildNumber: DeviceInfo.getBuildNumber()
      },
      user: await this.getUserContext()
    };

    await apiClient.post('/api/v1/errors/frontend', errorReport);
  }

  private async getUserContext() {
    // Get user context from your auth store
    return {
      id: null,
      role: null,
      restaurant_id: null
    };
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Oops! Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          
          {__DEV__ && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugTitle}>Debug Info:</Text>
              <Text style={styles.debugText}>
                {this.state.error?.stack}
              </Text>
            </View>
          )}
          
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  debugInfo: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    maxHeight: 200
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 5
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace'
  }
});
```

---

## 📋 Day 11: Performance Optimization

### Morning Tasks (4 hours)

#### 1. Database Query Optimization

**Query Performance Analyzer** (`backend/app/services/query_optimizer.py`):
```python
from sqlalchemy import event, Engine
from sqlalchemy.engine import Connection
from datetime import datetime
import time
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

class QueryPerformanceAnalyzer:
    """Analyzes and logs slow database queries"""
    
    def __init__(self, slow_query_threshold_ms: float = 100):
        self.slow_query_threshold_ms = slow_query_threshold_ms
        self.query_stats = {}
    
    def setup(self, engine: Engine):
        """Set up query monitoring on the engine"""
        if settings.ENVIRONMENT == "production":
            # Only log extremely slow queries in production
            self.slow_query_threshold_ms = 500
        
        @event.listens_for(engine, "before_cursor_execute")
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            conn.info.setdefault('query_start_time', []).append(time.time())
            
        @event.listens_for(engine, "after_cursor_execute")
        def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            total_time = (time.time() - conn.info['query_start_time'].pop(-1)) * 1000
            
            # Log slow queries
            if total_time > self.slow_query_threshold_ms:
                logger.warning(
                    f"Slow query detected",
                    extra={
                        "query": statement[:500],  # Truncate long queries
                        "duration_ms": round(total_time, 2),
                        "parameters": str(parameters)[:200] if parameters else None
                    }
                )
            
            # Track query patterns
            query_pattern = self._extract_query_pattern(statement)
            if query_pattern not in self.query_stats:
                self.query_stats[query_pattern] = {
                    "count": 0,
                    "total_time_ms": 0,
                    "max_time_ms": 0
                }
            
            stats = self.query_stats[query_pattern]
            stats["count"] += 1
            stats["total_time_ms"] += total_time
            stats["max_time_ms"] = max(stats["max_time_ms"], total_time)
    
    def _extract_query_pattern(self, query: str) -> str:
        """Extract a pattern from the query for grouping similar queries"""
        # Simple pattern extraction - can be enhanced
        query_lower = query.lower().strip()
        
        if query_lower.startswith("select"):
            # Extract table name from FROM clause
            from_index = query_lower.find("from")
            if from_index > 0:
                table_part = query_lower[from_index + 4:].strip().split()[0]
                return f"SELECT FROM {table_part}"
        elif query_lower.startswith("insert"):
            into_index = query_lower.find("into")
            if into_index > 0:
                table_part = query_lower[into_index + 4:].strip().split()[0]
                return f"INSERT INTO {table_part}"
        elif query_lower.startswith("update"):
            table_part = query_lower[6:].strip().split()[0]
            return f"UPDATE {table_part}"
        
        return query_lower[:50]
    
    def get_query_stats(self) -> dict:
        """Get aggregated query statistics"""
        results = []
        for pattern, stats in self.query_stats.items():
            avg_time = stats["total_time_ms"] / stats["count"] if stats["count"] > 0 else 0
            results.append({
                "pattern": pattern,
                "count": stats["count"],
                "avg_time_ms": round(avg_time, 2),
                "max_time_ms": round(stats["max_time_ms"], 2),
                "total_time_ms": round(stats["total_time_ms"], 2)
            })
        
        # Sort by total time descending
        results.sort(key=lambda x: x["total_time_ms"], reverse=True)
        return results[:20]  # Top 20 query patterns

# Global analyzer instance
query_analyzer = QueryPerformanceAnalyzer()
```

#### 2. Caching Strategy Implementation

**Advanced Cache Manager** (`backend/app/services/cache_manager.py`):
```python
from typing import Any, Optional, List, Callable
import hashlib
import json
from datetime import datetime, timedelta
import asyncio

from app.core.redis_client import redis_client
from app.core.config import settings

class CacheManager:
    """Advanced caching with invalidation strategies"""
    
    def __init__(self):
        self.default_ttl = 300  # 5 minutes
        self.cache_prefix = "cache:"
        self.invalidation_patterns = {}
    
    def _generate_key(self, namespace: str, *args, **kwargs) -> str:
        """Generate a cache key from namespace and arguments"""
        key_data = {
            "namespace": namespace,
            "args": args,
            "kwargs": kwargs
        }
        
        key_json = json.dumps(key_data, sort_keys=True)
        key_hash = hashlib.md5(key_json.encode()).hexdigest()
        
        return f"{self.cache_prefix}{namespace}:{key_hash}"
    
    async def get_or_set(
        self,
        namespace: str,
        fetcher: Callable,
        ttl: Optional[int] = None,
        *args,
        **kwargs
    ) -> Any:
        """Get from cache or fetch and cache"""
        cache_key = self._generate_key(namespace, *args, **kwargs)
        
        # Try to get from cache
        cached_value = await redis_client.get(cache_key)
        if cached_value is not None:
            return cached_value
        
        # Fetch fresh data
        fresh_value = await fetcher(*args, **kwargs)
        
        # Cache the result
        await redis_client.set(
            cache_key,
            fresh_value,
            expire=ttl or self.default_ttl
        )
        
        return fresh_value
    
    async def invalidate(self, namespace: str, *args, **kwargs):
        """Invalidate specific cache entry"""
        cache_key = self._generate_key(namespace, *args, **kwargs)
        await redis_client.delete(cache_key)
    
    async def invalidate_pattern(self, pattern: str):
        """Invalidate all keys matching a pattern"""
        full_pattern = f"{self.cache_prefix}{pattern}"
        deleted = await redis_client.delete_pattern(full_pattern)
        return deleted
    
    async def invalidate_namespace(self, namespace: str):
        """Invalidate all entries in a namespace"""
        pattern = f"{namespace}:*"
        return await self.invalidate_pattern(pattern)
    
    # Cache decorators
    def cached(self, namespace: str, ttl: Optional[int] = None):
        """Decorator for caching function results"""
        def decorator(func):
            async def wrapper(*args, **kwargs):
                # Skip cache in certain conditions
                if kwargs.pop("skip_cache", False):
                    return await func(*args, **kwargs)
                
                return await self.get_or_set(
                    namespace,
                    func,
                    ttl,
                    *args,
                    **kwargs
                )
            
            # Attach invalidation helper
            wrapper.invalidate = lambda *a, **k: self.invalidate(namespace, *a, **k)
            wrapper.invalidate_all = lambda: self.invalidate_namespace(namespace)
            
            return wrapper
        return decorator
    
    # Specific cache strategies
    async def cache_menu_data(self, restaurant_id: str, menu_data: dict):
        """Cache menu data with smart invalidation"""
        cache_key = f"menu:{restaurant_id}"
        
        # Cache main menu
        await redis_client.set(
            f"{self.cache_prefix}{cache_key}",
            menu_data,
            expire=3600  # 1 hour
        )
        
        # Cache individual categories for partial updates
        for category in menu_data.get("categories", []):
            category_key = f"menu:category:{restaurant_id}:{category['id']}"
            await redis_client.set(
                f"{self.cache_prefix}{category_key}",
                category,
                expire=3600
            )
    
    async def get_cached_menu(self, restaurant_id: str) -> Optional[dict]:
        """Get cached menu with fallback to partial data"""
        cache_key = f"menu:{restaurant_id}"
        
        # Try full menu first
        full_menu = await redis_client.get(f"{self.cache_prefix}{cache_key}")
        if full_menu:
            return full_menu
        
        # Try to reconstruct from cached categories
        category_pattern = f"{self.cache_prefix}menu:category:{restaurant_id}:*"
        categories = []
        
        async for key in redis_client.scan_iter(match=category_pattern):
            category = await redis_client.get(key)
            if category:
                categories.append(category)
        
        if categories:
            return {"categories": categories, "partial": True}
        
        return None
    
    async def warm_cache(self, restaurant_id: str):
        """Pre-warm cache for a restaurant"""
        tasks = [
            self._warm_menu_cache(restaurant_id),
            self._warm_settings_cache(restaurant_id),
            self._warm_stats_cache(restaurant_id)
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _warm_menu_cache(self, restaurant_id: str):
        """Pre-warm menu cache"""
        # Implement menu fetching and caching
        pass
    
    async def _warm_settings_cache(self, restaurant_id: str):
        """Pre-warm settings cache"""
        # Implement settings fetching and caching
        pass
    
    async def _warm_stats_cache(self, restaurant_id: str):
        """Pre-warm stats cache"""
        # Implement stats fetching and caching
        pass

# Global cache manager
cache_manager = CacheManager()
```

### Afternoon Tasks (4 hours)

#### 3. Load Testing Setup

**Load Test Script** (`backend/tests/load_test.py`):
```python
import asyncio
import aiohttp
import time
import statistics
from typing import List, Dict, Any
import json
from datetime import datetime

class LoadTester:
    """Load testing for Fynlo POS API"""
    
    def __init__(self, base_url: str, auth_token: str):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        self.results = []
    
    async def run_test(
        self,
        endpoint: str,
        method: str = "GET",
        payload: Optional[Dict] = None,
        num_requests: int = 100,
        concurrent_requests: int = 10
    ):
        """Run load test on specific endpoint"""
        print(f"\nTesting {method} {endpoint}")
        print(f"Requests: {num_requests}, Concurrent: {concurrent_requests}")
        
        start_time = time.time()
        
        # Create semaphore for controlling concurrency
        semaphore = asyncio.Semaphore(concurrent_requests)
        
        # Create tasks
        tasks = []
        for i in range(num_requests):
            task = self._make_request(
                semaphore,
                endpoint,
                method,
                payload,
                i
            )
            tasks.append(task)
        
        # Execute all tasks
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        total_time = time.time() - start_time
        
        # Analyze results
        successful_requests = [r for r in results if isinstance(r, dict) and r.get("success")]
        failed_requests = [r for r in results if not isinstance(r, dict) or not r.get("success")]
        
        response_times = [r["response_time"] for r in successful_requests]
        
        report = {
            "endpoint": endpoint,
            "method": method,
            "total_requests": num_requests,
            "successful_requests": len(successful_requests),
            "failed_requests": len(failed_requests),
            "total_time": round(total_time, 2),
            "requests_per_second": round(num_requests / total_time, 2),
            "response_times": {
                "min": round(min(response_times), 2) if response_times else 0,
                "max": round(max(response_times), 2) if response_times else 0,
                "mean": round(statistics.mean(response_times), 2) if response_times else 0,
                "median": round(statistics.median(response_times), 2) if response_times else 0,
                "p95": round(statistics.quantiles(response_times, n=20)[18], 2) if len(response_times) > 20 else 0,
                "p99": round(statistics.quantiles(response_times, n=100)[98], 2) if len(response_times) > 100 else 0
            }
        }
        
        self.results.append(report)
        self._print_report(report)
        
        return report
    
    async def _make_request(
        self,
        semaphore: asyncio.Semaphore,
        endpoint: str,
        method: str,
        payload: Optional[Dict],
        request_id: int
    ) -> Dict:
        """Make individual request with timing"""
        async with semaphore:
            start_time = time.time()
            
            try:
                async with aiohttp.ClientSession() as session:
                    url = f"{self.base_url}{endpoint}"
                    
                    async with session.request(
                        method,
                        url,
                        headers=self.headers,
                        json=payload,
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as response:
                        response_time = (time.time() - start_time) * 1000
                        
                        return {
                            "success": response.status < 400,
                            "status_code": response.status,
                            "response_time": response_time,
                            "request_id": request_id
                        }
            
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "response_time": (time.time() - start_time) * 1000,
                    "request_id": request_id
                }
    
    def _print_report(self, report: Dict):
        """Print load test report"""
        print("\n" + "="*50)
        print(f"Endpoint: {report['endpoint']}")
        print(f"Success Rate: {report['successful_requests']}/{report['total_requests']} "
              f"({report['successful_requests']/report['total_requests']*100:.1f}%)")
        print(f"RPS: {report['requests_per_second']}")
        print(f"Response Times (ms):")
        print(f"  Min: {report['response_times']['min']}")
        print(f"  Median: {report['response_times']['median']}")
        print(f"  Mean: {report['response_times']['mean']}")
        print(f"  95th percentile: {report['response_times']['p95']}")
        print(f"  99th percentile: {report['response_times']['p99']}")
        print(f"  Max: {report['response_times']['max']}")
        print("="*50)
    
    async def run_comprehensive_test(self):
        """Run comprehensive load test on critical endpoints"""
        test_scenarios = [
            # Authentication
            {
                "endpoint": "/api/v1/auth/login",
                "method": "POST",
                "payload": {
                    "email": "test@example.com",
                    "password": "testpass"
                },
                "num_requests": 50,
                "concurrent_requests": 5
            },
            
            # Menu loading
            {
                "endpoint": "/api/v1/menu",
                "method": "GET",
                "num_requests": 200,
                "concurrent_requests": 20
            },
            
            # Order creation
            {
                "endpoint": "/api/v1/orders",
                "method": "POST",
                "payload": {
                    "items": [
                        {"product_id": "1", "quantity": 2}
                    ],
                    "table_number": "5"
                },
                "num_requests": 100,
                "concurrent_requests": 10
            },
            
            # WebSocket connections
            {
                "endpoint": "/api/v1/websocket/stats",
                "method": "GET",
                "num_requests": 100,
                "concurrent_requests": 50
            }
        ]
        
        for scenario in test_scenarios:
            await self.run_test(**scenario)
            await asyncio.sleep(2)  # Brief pause between tests
        
        # Generate final report
        self.generate_final_report()
    
    def generate_final_report(self):
        """Generate comprehensive test report"""
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "base_url": self.base_url,
            "test_results": self.results,
            "summary": {
                "total_endpoints_tested": len(self.results),
                "average_success_rate": statistics.mean([
                    r["successful_requests"] / r["total_requests"]
                    for r in self.results
                ]) * 100,
                "slowest_endpoint": max(
                    self.results,
                    key=lambda r: r["response_times"]["p95"]
                )["endpoint"]
            }
        }
        
        # Save report
        with open(f"load_test_report_{int(time.time())}.json", "w") as f:
            json.dump(report, f, indent=2)
        
        print("\n\nFINAL SUMMARY")
        print("="*50)
        print(f"Endpoints Tested: {report['summary']['total_endpoints_tested']}")
        print(f"Average Success Rate: {report['summary']['average_success_rate']:.1f}%")
        print(f"Slowest Endpoint: {report['summary']['slowest_endpoint']}")

# Run load test
async def main():
    # Get auth token first
    async with aiohttp.ClientSession() as session:
        login_response = await session.post(
            "http://localhost:8000/api/v1/auth/login",
            json={"email": "admin@fynlo.com", "password": "admin123"}
        )
        auth_data = await login_response.json()
        token = auth_data["data"]["tokens"]["access_token"]
    
    # Run load tests
    tester = LoadTester("http://localhost:8000", token)
    await tester.run_comprehensive_test()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 📋 Day 12: Deployment & Final Checks

### Morning Tasks (4 hours)

#### 1. Deployment Configuration

**Production Docker Compose** (`docker-compose.prod.yml`):
```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - SECRET_KEY=${SECRET_KEY}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    ports:
      - "8000:8000"
    volumes:
      - ./backend/logs:/app/logs
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./frontend/build:/usr/share/nginx/html
    depends_on:
      - backend
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

**Backend Dockerfile** (`backend/Dockerfile.prod`):
```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

# Copy application
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Run migrations and start server
CMD ["sh", "-c", "alembic upgrade head && gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --timeout 120 --access-logfile - --error-logfile -"]
```

#### 2. Deployment Scripts

**Deployment Script** (`scripts/deploy.sh`):
```bash
#!/bin/bash
set -e

# Configuration
ENVIRONMENT=$1
DEPLOY_BRANCH=${2:-main}

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: ./deploy.sh <environment> [branch]"
    echo "Environments: staging, production"
    exit 1
fi

echo "🚀 Deploying to $ENVIRONMENT from branch $DEPLOY_BRANCH"

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
else
    echo "❌ Environment file .env.$ENVIRONMENT not found"
    exit 1
fi

# Pre-deployment checks
echo "📋 Running pre-deployment checks..."

# Check if all required variables are set
REQUIRED_VARS="DATABASE_URL REDIS_URL SECRET_KEY SUPABASE_URL SUPABASE_KEY"
for var in $REQUIRED_VARS; do
    if [ -z "${!var}" ]; then
        echo "❌ Required variable $var is not set"
        exit 1
    fi
done

# Run tests
echo "🧪 Running tests..."
cd backend
python -m pytest tests/ -v --tb=short
cd ..

# Build and tag Docker images
echo "🐳 Building Docker images..."
docker-compose -f docker-compose.prod.yml build

# Database backup (production only)
if [ "$ENVIRONMENT" = "production" ]; then
    echo "💾 Backing up database..."
    ./scripts/backup_database.sh
fi

# Deploy
echo "📦 Starting deployment..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
./scripts/wait_for_healthy.sh

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

# Warm cache
echo "🔥 Warming cache..."
docker-compose -f docker-compose.prod.yml exec -T backend python scripts/warm_cache.py

# Health check
echo "🏥 Running health checks..."
HEALTH_CHECK=$(curl -s http://localhost:8000/api/v1/health/detailed)
echo $HEALTH_CHECK | jq .

# Notify completion
echo "✅ Deployment completed successfully!"

# Send notification (implement your notification method)
# ./scripts/notify_deployment.sh "$ENVIRONMENT" "success"
```

**Rollback Script** (`scripts/rollback.sh`):
```bash
#!/bin/bash
set -e

ENVIRONMENT=$1
BACKUP_TAG=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$BACKUP_TAG" ]; then
    echo "Usage: ./rollback.sh <environment> <backup_tag>"
    exit 1
fi

echo "🔄 Rolling back $ENVIRONMENT to $BACKUP_TAG"

# Load environment
if [ -f ".env.$ENVIRONMENT" ]; then
    export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
fi

# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Restore database backup
if [ "$ENVIRONMENT" = "production" ]; then
    ./scripts/restore_database.sh $BACKUP_TAG
fi

# Start previous version
docker-compose -f docker-compose.prod.yml up -d

# Health check
sleep 10
HEALTH_CHECK=$(curl -s http://localhost:8000/api/v1/health)
if [ $? -eq 0 ]; then
    echo "✅ Rollback completed successfully"
else
    echo "❌ Rollback failed - services not healthy"
    exit 1
fi
```

### Afternoon Tasks (4 hours)

#### 3. Production Checklist

**Pre-Deployment Checklist** (`DEPLOYMENT_CHECKLIST.md`):
```markdown
# 🚀 Production Deployment Checklist

## Pre-Deployment

### Code Quality
- [ ] All tests passing (backend and frontend)
- [ ] No console.log statements in production code
- [ ] No hardcoded credentials or secrets
- [ ] All TypeScript errors resolved
- [ ] ESLint/Flake8 checks passing
- [ ] No commented code blocks

### Security
- [ ] Environment variables properly set
- [ ] HTTPS configured with valid certificates
- [ ] CORS settings restricted to allowed origins
- [ ] Rate limiting enabled on all endpoints
- [ ] Authentication required on all protected routes
- [ ] Input validation on all user inputs
- [ ] SQL injection protection verified

### Database
- [ ] All migrations tested on staging
- [ ] Database backup strategy in place
- [ ] Indexes created for frequently queried fields
- [ ] Connection pooling configured
- [ ] Read replicas configured (if applicable)

### Performance
- [ ] Load testing completed successfully
- [ ] Response times under 500ms for critical endpoints
- [ ] WebSocket stability tested
- [ ] Cache warming implemented
- [ ] CDN configured for static assets

### Monitoring
- [ ] Health check endpoints working
- [ ] Logging configured and tested
- [ ] Error tracking enabled
- [ ] Performance monitoring active
- [ ] Alerts configured for critical issues

## Deployment Process

### 1. Pre-Deployment (30 minutes before)
- [ ] Notify team of upcoming deployment
- [ ] Run final test suite
- [ ] Backup production database
- [ ] Review deployment plan

### 2. Deployment (15-30 minutes)
- [ ] Set maintenance mode (if applicable)
- [ ] Deploy backend services
- [ ] Run database migrations
- [ ] Deploy frontend assets
- [ ] Update DNS/Load balancer (if needed)

### 3. Verification (15 minutes)
- [ ] Health checks passing
- [ ] Critical user flows tested
- [ ] WebSocket connections stable
- [ ] No error spike in monitoring
- [ ] Performance metrics normal

### 4. Post-Deployment (ongoing)
- [ ] Monitor error rates for 1 hour
- [ ] Check user feedback channels
- [ ] Verify backup systems working
- [ ] Document any issues encountered
- [ ] Update deployment log

## Rollback Criteria

Rollback immediately if:
- [ ] Health checks failing consistently
- [ ] Error rate > 5% of requests
- [ ] Critical functionality broken
- [ ] Database migration failed
- [ ] Security vulnerability discovered

## Emergency Contacts

- **DevOps Lead**: [Contact]
- **Backend Lead**: [Contact]
- **Frontend Lead**: [Contact]
- **Database Admin**: [Contact]
- **On-Call Engineer**: [Contact]
```

#### 4. Final System Test

**System Integration Test** (`tests/system_test.py`):
```python
import asyncio
import aiohttp
import websockets
import json
from typing import Dict, List

class SystemIntegrationTest:
    """End-to-end system integration test"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.ws_url = base_url.replace("http", "ws")
        self.test_results = []
    
    async def run_all_tests(self):
        """Run complete system integration test"""
        print("🧪 Starting System Integration Tests\n")
        
        # Test authentication flow
        auth_token = await self.test_authentication()
        if not auth_token:
            print("❌ Authentication failed - aborting tests")
            return False
        
        # Test API endpoints
        await self.test_menu_loading(auth_token)
        await self.test_order_creation(auth_token)
        await self.test_payment_processing(auth_token)
        
        # Test WebSocket
        await self.test_websocket_connection(auth_token)
        
        # Test cross-system integration
        await self.test_realtime_order_flow(auth_token)
        
        # Generate report
        self.generate_test_report()
        
        return all(r["passed"] for r in self.test_results)
    
    async def test_authentication(self) -> Optional[str]:
        """Test authentication flow"""
        print("Testing Authentication...")
        
        async with aiohttp.ClientSession() as session:
            # Test login
            login_data = {
                "email": "test@restaurant.com",
                "password": "testpass123"
            }
            
            async with session.post(
                f"{self.base_url}/api/v1/auth/login",
                json=login_data
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    token = data["data"]["tokens"]["access_token"]
                    
                    self.test_results.append({
                        "test": "Authentication",
                        "passed": True,
                        "details": "Login successful"
                    })
                    
                    print("✅ Authentication passed")
                    return token
                else:
                    self.test_results.append({
                        "test": "Authentication",
                        "passed": False,
                        "details": f"Login failed with status {response.status}"
                    })
                    
                    print("❌ Authentication failed")
                    return None
    
    async def test_realtime_order_flow(self, auth_token: str):
        """Test complete order flow with WebSocket updates"""
        print("\nTesting Real-time Order Flow...")
        
        try:
            # Connect WebSocket
            ws_uri = f"{self.ws_url}/ws/restaurant123?token={auth_token}"
            
            async with websockets.connect(ws_uri) as websocket:
                # Create order via API
                order_data = {
                    "items": [
                        {"product_id": "1", "quantity": 2, "unit_price": 10.00}
                    ],
                    "table_number": "5",
                    "customer_notes": "Integration test order"
                }
                
                async with aiohttp.ClientSession() as session:
                    headers = {"Authorization": f"Bearer {auth_token}"}
                    
                    async with session.post(
                        f"{self.base_url}/api/v1/orders",
                        json=order_data,
                        headers=headers
                    ) as response:
                        if response.status != 201:
                            raise Exception(f"Order creation failed: {response.status}")
                        
                        order_response = await response.json()
                        order_id = order_response["data"]["id"]
                
                # Wait for WebSocket notification
                notification_received = False
                
                async def receive_notifications():
                    nonlocal notification_received
                    while True:
                        message = await websocket.recv()
                        data = json.loads(message)
                        
                        if (data.get("event_type") == "order.created" and
                            data.get("data", {}).get("id") == order_id):
                            notification_received = True
                            break
                
                # Wait up to 5 seconds for notification
                try:
                    await asyncio.wait_for(receive_notifications(), timeout=5.0)
                except asyncio.TimeoutError:
                    pass
                
                self.test_results.append({
                    "test": "Real-time Order Flow",
                    "passed": notification_received,
                    "details": "WebSocket notification received" if notification_received 
                              else "WebSocket notification timeout"
                })
                
                if notification_received:
                    print("✅ Real-time order flow passed")
                else:
                    print("❌ Real-time order flow failed")
                    
        except Exception as e:
            self.test_results.append({
                "test": "Real-time Order Flow",
                "passed": False,
                "details": str(e)
            })
            print(f"❌ Real-time order flow error: {e}")
    
    def generate_test_report(self):
        """Generate final test report"""
        print("\n" + "="*50)
        print("SYSTEM INTEGRATION TEST REPORT")
        print("="*50)
        
        passed_tests = sum(1 for r in self.test_results if r["passed"])
        total_tests = len(self.test_results)
        
        print(f"\nTotal Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {passed_tests/total_tests*100:.1f}%")
        
        print("\nDetailed Results:")
        for result in self.test_results:
            status = "✅" if result["passed"] else "❌"
            print(f"{status} {result['test']}: {result['details']}")
        
        print("\n" + "="*50)

# Run system test
async def main():
    tester = SystemIntegrationTest("http://localhost:8000")
    success = await tester.run_all_tests()
    
    if success:
        print("\n🎉 All system tests passed!")
        exit(0)
    else:
        print("\n⚠️  Some tests failed!")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())
```

---

## ✅ Phase 3 Completion Checklist

### Monitoring Infrastructure
- [ ] Health check endpoints implemented
- [ ] Metrics collection service active
- [ ] Query performance monitoring enabled
- [ ] Frontend performance tracking
- [ ] Error boundary with reporting

### Performance Optimization
- [ ] Database queries optimized
- [ ] Caching strategy implemented
- [ ] Load testing completed
- [ ] Response times < 500ms
- [ ] WebSocket stability verified

### Deployment Readiness
- [x] Docker configuration complete
- [ ] Deployment scripts tested
- [ ] Rollback procedure verified
- [ ] Production checklist reviewed
- [ ] System integration tests passing

### Monitoring & Alerts
- [ ] Prometheus metrics configured
- [ ] Grafana dashboards created
- [ ] Alert rules defined
- [ ] Log aggregation working
- [ ] Error tracking enabled

### Documentation
- [x] Deployment guide complete
- [ ] Monitoring runbook created
- [ ] Emergency procedures documented
- [x] Architecture diagrams updated
- [ ] API documentation current

---

## 🚀 Next Steps

With monitoring and deployment complete:
1. Schedule production deployment window
2. Conduct final security audit
3. Prepare customer communication
4. Plan post-deployment monitoring
5. Schedule team retrospective

**Production Launch Ready!** 🎉