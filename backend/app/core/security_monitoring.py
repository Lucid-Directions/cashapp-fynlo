"""Security monitoring and alerting system.

Provides real-time threat detection, anomaly monitoring, and alerting
for security events in the Fynlo POS system.
"""

import asyncio
import json
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
from enum import Enum

import redis.asyncio as redis
from pydantic import BaseModel

from app.core.config import settings
from app.core.exceptions import FynloException
from app.models.audit_log import AuditEventType, AuditLog
from app.core.database import get_db


class ThreatLevel(str, Enum):
    """Security threat levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SecurityEventType(str, Enum):
    """Types of security events to monitor."""
    # Authentication events
    FAILED_LOGIN = "failed_login"
    BRUTE_FORCE = "brute_force"
    CREDENTIAL_STUFFING = "credential_stuffing"
    ACCOUNT_LOCKOUT = "account_lockout"
    
    # Authorization events
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    CROSS_TENANT_ACCESS = "cross_tenant_access"
    
    # Data security events
    MASS_DATA_ACCESS = "mass_data_access"
    SENSITIVE_DATA_EXPORT = "sensitive_data_export"
    ENCRYPTION_FAILURE = "encryption_failure"
    
    # System security events
    RATE_LIMIT_VIOLATION = "rate_limit_violation"
    DDOS_ATTACK = "ddos_attack"
    SQL_INJECTION_ATTEMPT = "sql_injection_attempt"
    XSS_ATTEMPT = "xss_attempt"
    
    # Compliance events
    PCI_VIOLATION = "pci_violation"
    GDPR_VIOLATION = "gdpr_violation"
    AUDIT_TAMPERING = "audit_tampering"


class SecurityAlert(BaseModel):
    """Security alert model."""
    id: str
    timestamp: datetime
    event_type: SecurityEventType
    threat_level: ThreatLevel
    source_ip: Optional[str]
    user_id: Optional[str]
    restaurant_id: Optional[str]
    description: str
    details: Dict[str, Any]
    recommended_action: str
    auto_blocked: bool = False


class SecurityMonitor:
    """Real-time security monitoring system."""
    
    def __init__(self):
        """Initialize security monitor."""
        self.redis_client = None
        self.alert_handlers = []
        self.threat_thresholds = self._init_threat_thresholds()
        self.event_patterns = defaultdict(lambda: deque(maxlen=100))
        self.blocked_ips: Set[str] = set()
        self.monitoring_tasks = []
    
    def _init_threat_thresholds(self) -> Dict[str, Dict[str, Any]]:
        """Initialize threat detection thresholds."""
        return {
            SecurityEventType.FAILED_LOGIN: {
                "count": 5,
                "window": 300,  # 5 minutes
                "threat_level": ThreatLevel.MEDIUM,
                "auto_block": True
            },
            SecurityEventType.BRUTE_FORCE: {
                "count": 10,
                "window": 600,  # 10 minutes
                "threat_level": ThreatLevel.HIGH,
                "auto_block": True
            },
            SecurityEventType.UNAUTHORIZED_ACCESS: {
                "count": 3,
                "window": 3600,  # 1 hour
                "threat_level": ThreatLevel.HIGH,
                "auto_block": False
            },
            SecurityEventType.CROSS_TENANT_ACCESS: {
                "count": 1,
                "window": 0,  # Immediate
                "threat_level": ThreatLevel.CRITICAL,
                "auto_block": True
            },
            SecurityEventType.SQL_INJECTION_ATTEMPT: {
                "count": 1,
                "window": 0,  # Immediate
                "threat_level": ThreatLevel.CRITICAL,
                "auto_block": True
            },
            SecurityEventType.MASS_DATA_ACCESS: {
                "count": 1000,
                "window": 300,  # 5 minutes
                "threat_level": ThreatLevel.HIGH,
                "auto_block": False
            },
            SecurityEventType.RATE_LIMIT_VIOLATION: {
                "count": 10,
                "window": 60,  # 1 minute
                "threat_level": ThreatLevel.MEDIUM,
                "auto_block": True
            }
        }
    
    async def initialize(self, redis_url: str = None):
        """Initialize Redis connection and start monitoring tasks."""
        redis_url = redis_url or settings.REDIS_URL
        self.redis_client = await redis.from_url(redis_url)
        
        # Start background monitoring tasks
        self.monitoring_tasks = [
            asyncio.create_task(self._monitor_audit_logs()),
            asyncio.create_task(self._monitor_rate_limits()),
            asyncio.create_task(self._monitor_anomalies()),
            asyncio.create_task(self._process_alerts())
        ]
    
    async def shutdown(self):
        """Shutdown monitoring tasks and connections."""
        # Cancel monitoring tasks
        for task in self.monitoring_tasks:
            task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*self.monitoring_tasks, return_exceptions=True)
        
        # Close Redis connection
        if self.redis_client:
            await self.redis_client.close()
    
    async def log_security_event(
        self,
        event_type: SecurityEventType,
        source_ip: Optional[str] = None,
        user_id: Optional[str] = None,
        restaurant_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """Log a security event for monitoring."""
        event = {
            "type": event_type.value,
            "timestamp": datetime.utcnow().isoformat(),
            "source_ip": source_ip,
            "user_id": user_id,
            "restaurant_id": restaurant_id,
            "details": details or {}
        }
        
        # Store in Redis for real-time processing
        await self.redis_client.lpush(
            "security:events",
            json.dumps(event)
        )
        
        # Add to pattern tracking
        key = f"{event_type.value}:{source_ip or user_id}"
        self.event_patterns[key].append(datetime.utcnow())
        
        # Check for threat patterns
        await self._check_threat_patterns(event_type, source_ip, user_id)
    
    async def _check_threat_patterns(
        self,
        event_type: SecurityEventType,
        source_ip: Optional[str],
        user_id: Optional[str]
    ):
        """Check if event patterns indicate a threat."""
        if event_type not in self.threat_thresholds:
            return
        
        threshold = self.threat_thresholds[event_type]
        key = f"{event_type.value}:{source_ip or user_id}"
        events = self.event_patterns[key]
        
        # Count events within time window
        cutoff = datetime.utcnow() - timedelta(seconds=threshold["window"])
        recent_events = [e for e in events if e > cutoff]
        
        if len(recent_events) >= threshold["count"]:
            # Threat detected - create alert
            alert = SecurityAlert(
                id=f"alert_{datetime.utcnow().timestamp()}",
                timestamp=datetime.utcnow(),
                event_type=event_type,
                threat_level=threshold["threat_level"],
                source_ip=source_ip,
                user_id=user_id,
                restaurant_id=None,  # Would be set from context
                description=self._get_threat_description(event_type, len(recent_events)),
                details={
                    "event_count": len(recent_events),
                    "window_seconds": threshold["window"],
                    "pattern": key
                },
                recommended_action=self._get_recommended_action(event_type),
                auto_blocked=False
            )
            
            # Auto-block if configured
            if threshold["auto_block"] and source_ip:
                await self._block_ip(source_ip)
                alert.auto_blocked = True
            
            # Queue alert for processing
            await self.redis_client.lpush(
                "security:alerts",
                alert.json()
            )
    
    async def _block_ip(self, ip: str):
        """Block an IP address."""
        self.blocked_ips.add(ip)
        await self.redis_client.sadd("security:blocked_ips", ip)
        await self.redis_client.setex(
            f"security:ip_block:{ip}",
            3600,  # 1 hour block
            "blocked"
        )
    
    def _get_threat_description(self, event_type: SecurityEventType, count: int) -> str:
        """Get human-readable threat description."""
        descriptions = {
            SecurityEventType.FAILED_LOGIN: f"Multiple failed login attempts detected ({count} attempts)",
            SecurityEventType.BRUTE_FORCE: f"Brute force attack in progress ({count} attempts)",
            SecurityEventType.UNAUTHORIZED_ACCESS: f"Repeated unauthorized access attempts ({count} attempts)",
            SecurityEventType.CROSS_TENANT_ACCESS: "Cross-tenant data access attempt detected",
            SecurityEventType.SQL_INJECTION_ATTEMPT: "SQL injection attack detected",
            SecurityEventType.MASS_DATA_ACCESS: f"Abnormal data access pattern detected ({count} records)",
            SecurityEventType.RATE_LIMIT_VIOLATION: f"Excessive API requests detected ({count} violations)"
        }
        return descriptions.get(event_type, f"Security event detected: {event_type.value}")
    
    def _get_recommended_action(self, event_type: SecurityEventType) -> str:
        """Get recommended action for threat type."""
        actions = {
            SecurityEventType.FAILED_LOGIN: "Review login attempts and consider account lockout",
            SecurityEventType.BRUTE_FORCE: "Block source IP and review account security",
            SecurityEventType.UNAUTHORIZED_ACCESS: "Review user permissions and audit logs",
            SecurityEventType.CROSS_TENANT_ACCESS: "Immediately revoke access and investigate",
            SecurityEventType.SQL_INJECTION_ATTEMPT: "Block IP and review application logs",
            SecurityEventType.MASS_DATA_ACCESS: "Review data export logs and user activity",
            SecurityEventType.RATE_LIMIT_VIOLATION: "Consider adjusting rate limits or blocking client"
        }
        return actions.get(event_type, "Review security logs and take appropriate action")
    
    async def _monitor_audit_logs(self):
        """Monitor audit logs for security events."""
        while True:
            try:
                # Check for suspicious patterns in audit logs
                # This would query recent audit logs and analyze patterns
                await asyncio.sleep(30)  # Check every 30 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error monitoring audit logs: {e}")
                await asyncio.sleep(60)
    
    async def _monitor_rate_limits(self):
        """Monitor rate limit violations."""
        while True:
            try:
                # Subscribe to rate limit events
                event = await self.redis_client.brpop("rate_limit:violations", timeout=5)
                if event:
                    data = json.loads(event[1])
                    await self.log_security_event(
                        SecurityEventType.RATE_LIMIT_VIOLATION,
                        source_ip=data.get("ip"),
                        details=data
                    )
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error monitoring rate limits: {e}")
                await asyncio.sleep(5)
    
    async def _monitor_anomalies(self):
        """Monitor for anomalous behavior patterns."""
        while True:
            try:
                # Implement anomaly detection algorithms
                # - Unusual access patterns
                # - Abnormal data volumes
                # - Time-based anomalies
                await asyncio.sleep(60)  # Check every minute
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error monitoring anomalies: {e}")
                await asyncio.sleep(60)
    
    async def _process_alerts(self):
        """Process security alerts and trigger notifications."""
        while True:
            try:
                # Get pending alerts
                alert_data = await self.redis_client.brpop("security:alerts", timeout=5)
                if alert_data:
                    alert = SecurityAlert.parse_raw(alert_data[1])
                    
                    # Process alert based on threat level
                    if alert.threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
                        await self._send_immediate_notification(alert)
                    
                    # Store alert for dashboard
                    await self._store_alert(alert)
                    
                    # Execute alert handlers
                    for handler in self.alert_handlers:
                        await handler(alert)
                        
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error processing alerts: {e}")
                await asyncio.sleep(5)
    
    async def _send_immediate_notification(self, alert: SecurityAlert):
        """Send immediate notification for high-priority alerts."""
        # In production, this would integrate with:
        # - Email/SMS alerts
        # - Slack/Discord webhooks
        # - PagerDuty integration
        # - Security dashboard push notifications
        print(f"SECURITY ALERT: {alert.threat_level} - {alert.description}")
    
    async def _store_alert(self, alert: SecurityAlert):
        """Store alert for security dashboard."""
        # Store in Redis for real-time dashboard
        await self.redis_client.zadd(
            "security:alerts:history",
            {alert.json(): alert.timestamp.timestamp()}
        )
        
        # Keep only last 1000 alerts
        await self.redis_client.zremrangebyrank("security:alerts:history", 0, -1001)
    
    def register_alert_handler(self, handler):
        """Register a custom alert handler."""
        self.alert_handlers.append(handler)
    
    async def get_security_metrics(self) -> Dict[str, Any]:
        """Get current security metrics for dashboard."""
        # Get recent alerts
        recent_alerts = await self.redis_client.zrevrange(
            "security:alerts:history",
            0, 10,
            withscores=True
        )
        
        # Get blocked IPs
        blocked_ips = await self.redis_client.smembers("security:blocked_ips")
        
        # Calculate threat level
        high_priority_alerts = 0
        for alert_json, _ in recent_alerts:
            alert = SecurityAlert.parse_raw(alert_json)
            if alert.threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
                high_priority_alerts += 1
        
        overall_threat_level = ThreatLevel.LOW
        if high_priority_alerts > 5:
            overall_threat_level = ThreatLevel.CRITICAL
        elif high_priority_alerts > 2:
            overall_threat_level = ThreatLevel.HIGH
        elif high_priority_alerts > 0:
            overall_threat_level = ThreatLevel.MEDIUM
        
        return {
            "overall_threat_level": overall_threat_level,
            "active_alerts": len(recent_alerts),
            "blocked_ips": len(blocked_ips),
            "recent_alerts": [
                SecurityAlert.parse_raw(alert_json).dict()
                for alert_json, _ in recent_alerts[:5]
            ],
            "monitored_events": len(self.event_patterns),
            "timestamp": datetime.utcnow().isoformat()
        }


# Singleton instance
security_monitor = SecurityMonitor()


# Helper functions for integration
async def log_security_event(
    event_type: SecurityEventType,
    request=None,
    user_id=None,
    details=None
):
    """Helper to log security events from anywhere in the application."""
    source_ip = None
    if request:
        source_ip = request.client.host
        user_id = user_id or getattr(request.state, "user_id", None)
    
    await security_monitor.log_security_event(
        event_type=event_type,
        source_ip=source_ip,
        user_id=user_id,
        details=details
    )


async def check_ip_blocked(ip: str) -> bool:
    """Check if an IP is blocked."""
    if not security_monitor.redis_client:
        return False
    
    return await security_monitor.redis_client.exists(f"security:ip_block:{ip}")