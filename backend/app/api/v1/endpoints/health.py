"""
Comprehensive Health Check API endpoints
Monitor system health, dependencies, and performance metrics
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import psutil
import time
from typing import Dict, Any

from app.core.database import get_db
from app.core.redis_client import redis_client
from app.core.responses import APIResponseHelper
from app.core.config import settings
from app.core.auth import get_current_user
from app.core.websocket import websocket_manager
from app.models import User

router = APIRouter()

@router.get("")
async def basic_health_check():
    """Basic health check endpoint - fast response for load balancers"""
    return APIResponseHelper.success(
        data={
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "fynlo-pos-api",
            "version": "1.0.0"
        }
    )

@router.get("/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """Detailed health check with component status"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {},
        "metrics": {}
    }
    
    # Check database
    try:
        start_time = time.time()
        result = db.execute(text("SELECT 1"))
        db_response_time = (time.time() - start_time) * 1000
        
        health_status["components"]["database"] = {
            "status": "healthy",
            "response_time_ms": round(db_response_time, 2),
            "type": "postgresql"
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e),
            "type": "postgresql"
        }
    
    # Check Redis
    try:
        start_time = time.time()
        redis_ping = await redis_client.ping()
        redis_response_time = (time.time() - start_time) * 1000
        
        health_status["components"]["redis"] = {
            "status": "healthy" if redis_ping else "unhealthy",
            "response_time_ms": round(redis_response_time, 2),
            "type": "redis"
        }
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["components"]["redis"] = {
            "status": "unhealthy",
            "error": str(e),
            "type": "redis"
        }
    
    # System resources
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        health_status["components"]["system"] = {
            "status": "healthy",
            "cpu_percent": round(cpu_percent, 2),
            "memory_percent": round(memory.percent, 2),
            "memory_available_mb": round(memory.available / 1024 / 1024, 2),
            "disk_percent": round(disk.percent, 2),
            "disk_free_gb": round(disk.free / 1024 / 1024 / 1024, 2)
        }
        
        # Determine if system is under stress
        if cpu_percent > 80 or memory.percent > 85 or disk.percent > 90:
            health_status["status"] = "degraded"
            health_status["components"]["system"]["status"] = "stressed"
            
    except Exception as e:
        health_status["components"]["system"] = {
            "status": "unknown",
            "error": str(e)
        }
    
    # Add performance metrics
    health_status["metrics"] = {
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "process_count": len(psutil.pids()),
        "load_average": psutil.getloadavg() if hasattr(psutil, 'getloadavg') else [0, 0, 0]
    }
    
    return APIResponseHelper.success(data=health_status)

@router.get("/dependencies")
async def check_dependencies(current_user: User = Depends(get_current_user)):
    """Check external service dependencies - requires authentication"""
    
    # Only allow platform owners to check dependencies
    if current_user.role != "platform_owner":
        return APIResponseHelper.error(
            message="Access denied",
            status_code=403
        )
    
    dependencies = {
        "supabase": {"status": "unknown", "endpoint": settings.SUPABASE_URL if hasattr(settings, 'SUPABASE_URL') else "not_configured"},
        "stripe": {"status": "unknown", "endpoint": "api.stripe.com"},
        "sumup": {"status": "unknown", "endpoint": "api.sumup.com"},
        "storage": {"status": "unknown", "endpoint": "digitalocean_spaces"}
    }
    
    # Check Supabase
    try:
        if hasattr(settings, 'SUPABASE_URL') and settings.SUPABASE_URL:
            # TODO: Implement actual Supabase health check
            dependencies["supabase"]["status"] = "healthy"
            dependencies["supabase"]["configured"] = True
        else:
            dependencies["supabase"]["status"] = "not_configured"
            dependencies["supabase"]["configured"] = False
    except Exception as e:
        dependencies["supabase"]["status"] = "unhealthy"
        dependencies["supabase"]["error"] = str(e)
    
    # Check payment providers
    try:
        if hasattr(settings, 'STRIPE_SECRET_KEY') and settings.STRIPE_SECRET_KEY:
            dependencies["stripe"]["status"] = "configured"
            dependencies["stripe"]["configured"] = True
        else:
            dependencies["stripe"]["status"] = "not_configured"
            dependencies["stripe"]["configured"] = False
    except Exception as e:
        dependencies["stripe"]["status"] = "error"
        dependencies["stripe"]["error"] = str(e)
    
    # Check storage
    try:
        if hasattr(settings, 'ENABLE_SPACES_STORAGE') and settings.ENABLE_SPACES_STORAGE:
            dependencies["storage"]["status"] = "configured"
            dependencies["storage"]["type"] = "spaces"
        else:
            dependencies["storage"]["status"] = "local"
            dependencies["storage"]["type"] = "local"
    except Exception as e:
        dependencies["storage"]["status"] = "error"
        dependencies["storage"]["error"] = str(e)
    
    overall_status = "healthy"
    if any(dep["status"] in ["unhealthy", "error"] for dep in dependencies.values()):
        overall_status = "degraded"
    
    return APIResponseHelper.success(
        data={
            "status": overall_status,
            "dependencies": dependencies,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@router.get("/stats")
async def get_system_stats(current_user: User = Depends(get_current_user)):
    """Get detailed system statistics - requires authentication"""
    
    try:
        # Get process info
        process = psutil.Process()
        
        # Get network stats
        net_io = psutil.net_io_counters()
        
        stats = {
            "process": {
                "pid": process.pid,
                "cpu_percent": process.cpu_percent(interval=0.1),
                "memory_mb": round(process.memory_info().rss / 1024 / 1024, 2),
                "threads": process.num_threads(),
                "open_files": len(process.open_files()) if hasattr(process, 'open_files') else 0,
                "connections": len(process.connections()) if hasattr(process, 'connections') else 0
            },
            "network": {
                "bytes_sent": net_io.bytes_sent,
                "bytes_recv": net_io.bytes_recv,
                "packets_sent": net_io.packets_sent,
                "packets_recv": net_io.packets_recv,
                "errors_in": net_io.errin,
                "errors_out": net_io.errout
            },
            "system": {
                "boot_time": datetime.fromtimestamp(psutil.boot_time()).isoformat(),
                "cpu_count": psutil.cpu_count(),
                "cpu_freq": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None
            }
        }
        
        return APIResponseHelper.success(data=stats)
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to get system stats: {str(e)}",
            status_code=500
        )

@router.get("/metrics")
async def get_metrics(current_user: User = Depends(get_current_user)):
    """Get current system metrics - requires authentication"""
    
    # Only allow platform owners and managers to view metrics
    if current_user.role not in ["platform_owner", "restaurant_owner", "manager"]:
        return APIResponseHelper.error(
            message="Access denied",
            status_code=403
        )
    
    try:
        # Import metrics collector
        from app.services.metrics_collector import metrics_collector
        
        # Get current metrics
        metrics = await metrics_collector.get_current_metrics()
        
        # Add WebSocket stats
        ws_stats = websocket_manager.get_connection_stats()
        metrics["websocket"]["stats"] = ws_stats
        
        return APIResponseHelper.success(data=metrics)
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to get metrics: {str(e)}",
            status_code=500
        )

@router.get("/performance")
async def get_performance_metrics(current_user: User = Depends(get_current_user)):
    """Get database query performance metrics - requires authentication"""
    
    # Only allow platform owners and managers to view performance metrics
    if current_user.role not in ["platform_owner", "restaurant_owner", "manager"]:
        return APIResponseHelper.error(
            message="Access denied",
            status_code=403
        )
    
    try:
        # Import query analyzer and cache manager
        from app.services.query_optimizer import query_analyzer
        from app.services.cache_manager import cache_manager
        
        # Get query performance stats
        query_stats = query_analyzer.get_query_stats()
        slow_query_count = query_analyzer.get_slow_query_count()
        optimization_suggestions = query_analyzer.get_optimization_suggestions()
        
        # Get cache performance stats
        cache_stats = cache_manager.get_cache_stats()
        
        performance_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "database": {
                "query_patterns": query_stats,
                "slow_query_count": slow_query_count,
                "optimization_suggestions": optimization_suggestions,
                "slow_query_threshold_ms": query_analyzer.slow_query_threshold_ms
            },
            "cache": cache_stats,
            "recommendations": {
                "critical": [],
                "warnings": [],
                "info": []
            }
        }
        
        # Add recommendations based on stats
        if slow_query_count > 10:
            performance_data["recommendations"]["critical"].append(
                f"High number of slow queries detected ({slow_query_count}). Review query patterns and add indexes."
            )
        
        if cache_stats["hit_rate_percentage"] < 50 and cache_stats["total_requests"] > 100:
            performance_data["recommendations"]["warnings"].append(
                f"Low cache hit rate ({cache_stats['hit_rate_percentage']}%). Consider reviewing cache strategy."
            )
        
        if any(stat["avg_time_ms"] > 500 for stat in query_stats):
            performance_data["recommendations"]["warnings"].append(
                "Some queries have very high average execution time (>500ms)."
            )
        
        return APIResponseHelper.success(data=performance_data)
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to get performance metrics: {str(e)}",
            status_code=500
        )