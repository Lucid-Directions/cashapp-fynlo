"""Integration middleware for security monitoring components.

Connects audit logging, rate limiting, and anomaly detection
into a cohesive security monitoring system.
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.security_monitoring import (
    security_monitor,
    SecurityEventType,
    log_security_event
)
from app.core.anomaly_detection import anomaly_detector
from app.middleware.audit_logging import AuditLoggingMiddleware


class SecurityIntegrationMiddleware(BaseHTTPMiddleware):
    """Integrates all security components."""
    
    def __init__(self, app: ASGIApp):
        """Initialize security integration middleware."""
        super().__init__(app)
        self.endpoint_counters = {}
        self.user_activity = {}
    
    async def dispatch(self, request: Request, call_next):
        """Process request through security pipeline."""
        # Extract request metadata
        user_id = getattr(request.state, "user_id", None)
        ip_address = request.client.host
        endpoint = str(request.url.path)
        
        # Track endpoint access
        self._track_endpoint_access(user_id, endpoint)
        
        # Process request
        response = await call_next(request)
        
        # Post-request security checks
        await self._perform_security_checks(
            request, response, user_id, ip_address
        )
        
        return response
    
    def _track_endpoint_access(self, user_id: str, endpoint: str):
        """Track endpoint access for anomaly detection."""
        if user_id:
            if user_id not in self.user_activity:
                self.user_activity[user_id] = {
                    "endpoints": [],
                    "request_count": 0,
                    "data_accessed": 0,
                    "first_seen": datetime.utcnow()
                }
            
            self.user_activity[user_id]["endpoints"].append(endpoint)
            self.user_activity[user_id]["request_count"] += 1
    
    async def _perform_security_checks(
        self,
        request: Request,
        response: Response,
        user_id: str,
        ip_address: str
    ):
        """Perform post-request security checks."""
        if not user_id:
            return
        
        # Get user activity
        activity = self.user_activity.get(user_id, {})
        if not activity:
            return
        
        # Check for anomalies every 100 requests
        if activity["request_count"] % 100 == 0:
            await self._check_user_anomalies(
                user_id, ip_address, activity
            )
        
        # Check for mass data access
        if hasattr(response, "headers"):
            content_length = response.headers.get("content-length", "0")
            try:
                data_size = int(content_length)
                if data_size > 1_000_000:  # 1MB
                    activity["data_accessed"] += data_size
                    
                    # Alert on large data access
                    if data_size > 10_000_000:  # 10MB
                        await log_security_event(
                            SecurityEventType.MASS_DATA_ACCESS,
                            request=request,
                            user_id=user_id,
                            details={
                                "data_size": data_size,
                                "endpoint": str(request.url.path)
                            }
                        )
            except ValueError:
                pass
    
    async def _check_user_anomalies(
        self,
        user_id: str,
        ip_address: str,
        activity: Dict
    ):
        """Check for anomalous user behavior."""
        # Update behavior profile
        anomaly_detector.update_user_profile(
            user_id=user_id,
            login_time=datetime.utcnow(),
            ip_address=ip_address,
            request_count=activity["request_count"],
            data_accessed=activity.get("data_accessed", 0),
            endpoints_used=list(set(activity["endpoints"][-100:]))  # Last 100
        )
        
        # Detect anomalies
        anomalies = anomaly_detector.detect_anomalies(
            user_id=user_id,
            login_time=datetime.utcnow(),
            ip_address=ip_address,
            request_count=activity["request_count"],
            data_accessed=activity.get("data_accessed", 0),
            endpoints_used=list(set(activity["endpoints"][-100:]))
        )
        
        # Log anomalies
        for anomaly_type, threat_level, description in anomalies:
            await log_security_event(
                SecurityEventType.UNAUTHORIZED_ACCESS,  # Generic for now
                user_id=user_id,
                details={
                    "anomaly_type": anomaly_type,
                    "threat_level": threat_level,
                    "description": description,
                    "risk_score": anomaly_detector.calculate_risk_score(anomalies)
                }
            )
        
        # Reset counters periodically
        if activity["request_count"] > 1000:
            activity["request_count"] = 0
            activity["data_accessed"] = 0
            activity["endpoints"] = activity["endpoints"][-100:]


class SecurityEventCollector:
    """Collects security events from various sources."""
    
    def __init__(self):
        """Initialize event collector."""
        self.event_queue = asyncio.Queue()
        self.processors = []
    
    async def collect_auth_events(self, event_type: str, user_data: Dict):
        """Collect authentication events."""
        event = {
            "source": "auth",
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": user_data
        }
        await self.event_queue.put(event)
        
        # Map to security event type
        if event_type == "login_failed":
            await log_security_event(
                SecurityEventType.FAILED_LOGIN,
                user_id=user_data.get("user_id"),
                details=user_data
            )
        elif event_type == "login_success":
            # Check for suspicious login patterns
            await self._check_login_patterns(user_data)
    
    async def collect_rate_limit_events(self, ip: str, endpoint: str):
        """Collect rate limit violation events."""
        await log_security_event(
            SecurityEventType.RATE_LIMIT_VIOLATION,
            source_ip=ip,
            details={"endpoint": endpoint}
        )
    
    async def collect_validation_events(self, field: str, attack_type: str):
        """Collect input validation events."""
        event_type = SecurityEventType.XSS_ATTEMPT
        if "sql" in attack_type.lower():
            event_type = SecurityEventType.SQL_INJECTION_ATTEMPT
        
        await log_security_event(
            event_type,
            details={"field": field, "attack_type": attack_type}
        )
    
    async def _check_login_patterns(self, user_data: Dict):
        """Check for suspicious login patterns."""
        # Check for impossible travel (login from different countries quickly)
        # Check for credential stuffing (many different users from same IP)
        # Check for distributed attacks (same user from many IPs)
        pass
    
    async def process_events(self):
        """Process collected security events."""
        while True:
            try:
                event = await asyncio.wait_for(
                    self.event_queue.get(), timeout=5.0
                )
                
                # Process event through all registered processors
                for processor in self.processors:
                    await processor(event)
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"Error processing security event: {e}")
    
    def register_processor(self, processor):
        """Register an event processor."""
        self.processors.append(processor)


# Singleton instances
security_event_collector = SecurityEventCollector()


# Helper function to initialize security monitoring
async def initialize_security_monitoring(app):
    """Initialize all security monitoring components."""
    # Initialize security monitor
    await security_monitor.initialize()
    
    # Register alert handlers
    async def alert_to_websocket(alert):
        """Send alerts to WebSocket clients."""
        # This would integrate with your WebSocket system
        pass
    
    security_monitor.register_alert_handler(alert_to_websocket)
    
    # Start event processing
    asyncio.create_task(security_event_collector.process_events())
    
    # Register shutdown handler
    async def shutdown_security():
        await security_monitor.shutdown()
    
    app.add_event_handler("shutdown", shutdown_security)