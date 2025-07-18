"""
Metrics Collection Service
Collects and aggregates system metrics for monitoring and analysis
"""

import time
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from collections import defaultdict
import statistics
import json

from app.core.redis_client import redis_client
from app.core.config import settings
from app.core.logger import logger

class MetricsCollector:
    """Collects and aggregates system metrics"""
    
    def __init__(self):
        self.metrics_buffer = defaultdict(list)
        self.flush_interval = 60  # seconds
        self.last_flush = time.time()
        self._instance_id = f"api-{int(time.time())}"
    
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
            "restaurant_id": restaurant_id,
            "instance_id": self._instance_id
        }
        
        self.metrics_buffer["api_requests"].append(metric)
        
        # Increment counters in Redis for real-time monitoring
        hour_key = datetime.utcnow().strftime("%Y%m%d%H")
        
        try:
            # Total requests
            await redis_client.incr(f"metrics:api:requests:{hour_key}")
            
            # Status code tracking
            await redis_client.incr(f"metrics:api:status:{status_code}:{hour_key}")
            
            # Endpoint specific tracking
            endpoint_clean = endpoint.replace("/", "_").replace("{", "").replace("}", "")
            await redis_client.incr(f"metrics:api:endpoint:{endpoint_clean}:{hour_key}")
            
            # Store response time for percentile calculations
            await redis_client.zadd(
                f"metrics:api:response_times:{hour_key}",
                {f"{time.time()}:{endpoint}": response_time_ms}
            )
            
            # Set expiry on keys (7 days)
            await redis_client.expire(f"metrics:api:requests:{hour_key}", 604800)
            await redis_client.expire(f"metrics:api:status:{status_code}:{hour_key}", 604800)
            await redis_client.expire(f"metrics:api:response_times:{hour_key}", 604800)
            
        except Exception as e:
            logger.error(f"Failed to record metrics in Redis: {str(e)}")
        
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
            "timestamp": datetime.utcnow().isoformat(),
            "instance_id": self._instance_id
        }
        
        self.metrics_buffer["websocket_events"].append(metric)
        
        # Real-time counters
        hour_key = datetime.utcnow().strftime("%Y%m%d%H")
        
        try:
            await redis_client.incr(f"metrics:ws:events:{event_type}:{hour_key}")
            await redis_client.expire(f"metrics:ws:events:{event_type}:{hour_key}", 604800)
        except Exception as e:
            logger.error(f"Failed to record WebSocket metrics: {str(e)}")
    
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
            "timestamp": datetime.utcnow().isoformat(),
            "instance_id": self._instance_id
        }
        
        self.metrics_buffer["orders"].append(metric)
        
        # Update aggregates
        day_key = datetime.utcnow().strftime("%Y%m%d")
        
        try:
            # Order count
            await redis_client.incr(f"metrics:orders:count:{restaurant_id}:{day_key}")
            await redis_client.incr(f"metrics:orders:count:total:{day_key}")
            
            # Revenue tracking
            await redis_client.incrbyfloat(
                f"metrics:orders:revenue:{restaurant_id}:{day_key}",
                total_amount
            )
            await redis_client.incrbyfloat(
                f"metrics:orders:revenue:total:{day_key}",
                total_amount
            )
            
            # Payment method tracking
            await redis_client.incr(f"metrics:orders:payment:{payment_method}:{day_key}")
            
            # Set expiry (30 days for order data)
            await redis_client.expire(f"metrics:orders:count:{restaurant_id}:{day_key}", 2592000)
            await redis_client.expire(f"metrics:orders:revenue:{restaurant_id}:{day_key}", 2592000)
            
        except Exception as e:
            logger.error(f"Failed to record order metrics: {str(e)}")
    
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
            "timestamp": datetime.utcnow().isoformat(),
            "instance_id": self._instance_id
        }
        
        # Don't store stack traces in metrics, only log them
        if stack_trace and settings.ENVIRONMENT == "development":
            metric["stack_trace"] = stack_trace[:1000]
        
        self.metrics_buffer["errors"].append(metric)
        
        # Error rate tracking
        hour_key = datetime.utcnow().strftime("%Y%m%d%H")
        
        try:
            await redis_client.incr(f"metrics:errors:{error_type}:{hour_key}")
            await redis_client.incr(f"metrics:errors:total:{hour_key}")
            await redis_client.expire(f"metrics:errors:{error_type}:{hour_key}", 604800)
            await redis_client.expire(f"metrics:errors:total:{hour_key}", 604800)
        except Exception as e:
            logger.error(f"Failed to record error metrics: {str(e)}")
    
    async def record_query_performance(
        self,
        query_pattern: str,
        execution_time_ms: float,
        table_name: Optional[str] = None
    ):
        """Record database query performance metrics"""
        metric = {
            "query_pattern": query_pattern,
            "execution_time_ms": execution_time_ms,
            "table_name": table_name,
            "timestamp": datetime.utcnow().isoformat(),
            "instance_id": self._instance_id
        }
        
        self.metrics_buffer["query_performance"].append(metric)
        
        # Track slow queries
        if execution_time_ms > 100:  # Queries slower than 100ms
            hour_key = datetime.utcnow().strftime("%Y%m%d%H")
            try:
                await redis_client.incr(f"metrics:queries:slow:{hour_key}")
                await redis_client.zadd(
                    f"metrics:queries:slow_list:{hour_key}",
                    {f"{query_pattern}:{time.time()}": execution_time_ms}
                )
                # Set expiry
                await redis_client.expire(f"metrics:queries:slow:{hour_key}", 604800)
                await redis_client.expire(f"metrics:queries:slow_list:{hour_key}", 604800)
            except Exception as e:
                logger.error(f"Failed to record slow query metric: {str(e)}")
    
    async def get_current_metrics(self) -> Dict[str, Any]:
        """Get current metrics summary"""
        hour_key = datetime.utcnow().strftime("%Y%m%d%H")
        day_key = datetime.utcnow().strftime("%Y%m%d")
        
        try:
            # Get API metrics
            api_requests = await redis_client.get(f"metrics:api:requests:{hour_key}") or "0"
            api_errors = await redis_client.get(f"metrics:api:status:500:{hour_key}") or "0"
            
            # Calculate response time percentiles
            response_times = await redis_client.zrange(
                f"metrics:api:response_times:{hour_key}",
                0, -1, withscores=True
            )
            
            percentiles = {"p50": 0, "p95": 0, "p99": 0}
            if response_times:
                times = [score for _, score in response_times]
                if times:
                    percentiles = {
                        "p50": statistics.median(times),
                        "p95": statistics.quantiles(times, n=20)[18] if len(times) > 20 else max(times),
                        "p99": statistics.quantiles(times, n=100)[98] if len(times) > 100 else max(times)
                    }
            
            # Get order metrics
            total_orders = await redis_client.get(f"metrics:orders:count:total:{day_key}") or "0"
            total_revenue = await redis_client.get(f"metrics:orders:revenue:total:{day_key}") or "0"
            
            # Get error metrics
            total_errors = await redis_client.get(f"metrics:errors:total:{hour_key}") or "0"
            
            # Get WebSocket metrics
            ws_connections = await self._get_active_websocket_connections()
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "api": {
                    "requests_per_hour": int(api_requests),
                    "errors_per_hour": int(api_errors),
                    "error_rate": float(api_errors) / float(api_requests) if int(api_requests) > 0 else 0,
                    "response_time_percentiles": percentiles
                },
                "orders": {
                    "count_today": int(total_orders),
                    "revenue_today": float(total_revenue)
                },
                "errors": {
                    "total_per_hour": int(total_errors)
                },
                "websocket": {
                    "active_connections": ws_connections
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get current metrics: {str(e)}")
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e)
            }
    
    async def get_endpoint_metrics(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get metrics for all endpoints over specified hours"""
        endpoint_metrics = {}
        
        try:
            # Get metrics for each hour
            for h in range(hours):
                hour_time = datetime.utcnow() - timedelta(hours=h)
                hour_key = hour_time.strftime("%Y%m%d%H")
                
                # Get all endpoint keys for this hour
                pattern = f"metrics:api:endpoint:*:{hour_key}"
                
                cursor = 0
                while True:
                    cursor, keys = await redis_client.scan(
                        cursor, match=pattern, count=100
                    )
                    
                    for key in keys:
                        # Extract endpoint name
                        parts = key.decode().split(":")
                        if len(parts) >= 5:
                            endpoint = parts[3]
                            count = await redis_client.get(key)
                            
                            if endpoint not in endpoint_metrics:
                                endpoint_metrics[endpoint] = {"total": 0, "hourly": []}
                            
                            endpoint_metrics[endpoint]["total"] += int(count or 0)
                            endpoint_metrics[endpoint]["hourly"].append({
                                "hour": hour_key,
                                "count": int(count or 0)
                            })
                    
                    if cursor == 0:
                        break
            
            # Convert to list and sort by total requests
            result = []
            for endpoint, data in endpoint_metrics.items():
                result.append({
                    "endpoint": endpoint.replace("_", "/"),
                    "total_requests": data["total"],
                    "average_per_hour": data["total"] / hours if hours > 0 else 0,
                    "hourly_data": data["hourly"]
                })
            
            result.sort(key=lambda x: x["total_requests"], reverse=True)
            return result[:50]  # Top 50 endpoints
            
        except Exception as e:
            logger.error(f"Failed to get endpoint metrics: {str(e)}")
            return []
    
    async def flush_metrics(self):
        """Flush metrics buffer to persistent storage"""
        if not self.metrics_buffer:
            return
        
        try:
            # Store aggregated metrics in Redis with expiration
            for metric_type, metrics in self.metrics_buffer.items():
                if metrics:
                    key = f"metrics:buffer:{metric_type}:{int(time.time())}"
                    await redis_client.set(
                        key,
                        json.dumps(metrics),
                        expire=86400  # 24 hours
                    )
            
            logger.info(f"Flushed {sum(len(m) for m in self.metrics_buffer.values())} metrics")
            
        except Exception as e:
            logger.error(f"Failed to flush metrics: {str(e)}")
        finally:
            self.metrics_buffer.clear()
            self.last_flush = time.time()
    
    async def _get_active_websocket_connections(self) -> int:
        """Get current active WebSocket connections from Redis"""
        try:
            # This assumes WebSocket manager stores connection count in Redis
            count = await redis_client.get("websocket:connections:active")
            return int(count) if count else 0
        except:
            return 0
    
    async def cleanup_old_metrics(self, days_to_keep: int = 7):
        """Clean up old metrics data"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            
            # Clean up old metric buffers
            pattern = "metrics:buffer:*"
            cursor = 0
            deleted = 0
            
            while True:
                cursor, keys = await redis_client.scan(
                    cursor, match=pattern, count=100
                )
                
                for key in keys:
                    # Extract timestamp from key
                    parts = key.decode().split(":")
                    if len(parts) >= 4:
                        try:
                            timestamp = int(parts[3])
                            if timestamp < cutoff_date.timestamp():
                                await redis_client.delete(key)
                                deleted += 1
                        except ValueError:
                            pass
                
                if cursor == 0:
                    break
            
            logger.info(f"Cleaned up {deleted} old metric entries")
            
        except Exception as e:
            logger.error(f"Failed to cleanup old metrics: {str(e)}")

# Global metrics collector instance
metrics_collector = MetricsCollector()

# Background task to periodically flush metrics
async def metrics_flush_task():
    """Background task to flush metrics periodically"""
    while True:
        await asyncio.sleep(60)  # Flush every minute
        await metrics_collector.flush_metrics()

# Background task to cleanup old metrics
async def metrics_cleanup_task():
    """Background task to cleanup old metrics daily"""
    while True:
        await asyncio.sleep(86400)  # Run daily
        await metrics_collector.cleanup_old_metrics()