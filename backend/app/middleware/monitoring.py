"""
Monitoring Middleware
Tracks API request performance and collects metrics
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime
import time
import traceback
import uuid

from app.services.metrics_collector import metrics_collector
from app.core.logger import logger

class MonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware for request monitoring and metrics collection"""
    
    def __init__(self, app):
        super().__init__(app)
        self.exclude_paths = {
            "/health",
            "/api/v1/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/favicon.ico"
        }
    
    async def dispatch(self, request: Request, call_next):
        # Skip monitoring for excluded paths
        if request.url.path in self.exclude_paths:
            return await call_next(request)
        
        # Generate request ID if not present
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        
        # Start timing
        start_time = time.time()
        
        # Extract request metadata
        user_id = None
        restaurant_id = None
        
        # Initialize response variables
        response = None
        status_code = 500
        error_recorded = False
        
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
                    "request_id": request_id,
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
            error_recorded = True
            
            # Re-raise to let exception handlers deal with it
            raise
        
        finally:
            # Calculate response time
            response_time_ms = (time.time() - start_time) * 1000
            
            # Record metrics only if we have a response
            if response or error_recorded:
                # Skip recording for websocket endpoints
                if not request.url.path.startswith("/ws"):
                    await metrics_collector.record_api_request(
                        endpoint=request.url.path,
                        method=request.method,
                        status_code=status_code,
                        response_time_ms=response_time_ms,
                        user_id=user_id,
                        restaurant_id=restaurant_id
                    )
                
                # Add monitoring headers if we have a response
                if response:
                    response.headers["X-Response-Time"] = f"{response_time_ms:.2f}ms"
                    response.headers["X-Request-ID"] = request_id
            
            # Log slow requests
            if response_time_ms > 1000:  # 1 second
                logger.warning(
                    f"Slow request detected",
                    extra={
                        "request_id": request_id,
                        "path": request.url.path,
                        "method": request.method,
                        "response_time_ms": response_time_ms,
                        "user_id": user_id,
                        "status_code": status_code
                    }
                )
            
            # Log all errors (4xx and 5xx)
            if status_code >= 400:
                logger.warning(
                    f"Request error: {status_code}",
                    extra={
                        "request_id": request_id,
                        "path": request.url.path,
                        "method": request.method,
                        "status_code": status_code,
                        "response_time_ms": response_time_ms,
                        "user_id": user_id
                    }
                )
        
        return response

class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware to ensure all requests have a unique ID"""
    
    async def dispatch(self, request: Request, call_next):
        # Add request ID if not present
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = str(uuid.uuid4())
        
        request.state.request_id = request_id
        
        # Process request
        response = await call_next(request)
        
        # Add request ID to response
        response.headers["X-Request-ID"] = request_id
        
        return response