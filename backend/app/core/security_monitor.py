"""
Security Monitoring and Audit Logging
Tracks security events, access violations, and provides audit trail
"""

import json
import logging
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from sqlalchemy.orm import 

from app.core.redis_client import RedisClient
from app.models import User

logger = logging.getLogger("security")


class SecurityEventType(str, Enum):
    """Types of security events to monitor"""
    # Authentication events
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    TOKEN_EXPIRED = "token_expired"
    TOKEN_INVALID = "token_invalid"
    
    # Access control events
    ACCESS_GRANTED = "access_granted"
    ACCESS_DENIED = "access_denied"
    CROSS_TENANT_ATTEMPT = "cross_tenant_attempt"
    PRIVILEGE_ESCALATION_ATTEMPT = "privilege_escalation_attempt"
    
    # Rate limiting events
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    IP_BANNED = "ip_banned"
    DDOS_ATTEMPT = "ddos_attempt"
    
    # WebSocket events
    WS_CONNECTION_ACCEPTED = "ws_connection_accepted"
    WS_CONNECTION_REJECTED = "ws_connection_rejected"
    WS_CROSS_TENANT_MESSAGE = "ws_cross_tenant_message"
    
    # Platform owner events
    PLATFORM_OWNER_ACCESS = "platform_owner_access"
    PLATFORM_OWNER_CROSS_TENANT = "platform_owner_cross_tenant"
    
    # Data modification events
    SENSITIVE_DATA_ACCESS = "sensitive_data_access"
    BULK_DATA_EXPORT = "bulk_data_export"
    DATA_DELETION = "data_deletion"


class SecurityMonitor:
    """
    Central security monitoring and logging system
    """
    
    def __init__(self, redis_client: Optional[RedisClient] = None):
        self.redis = redis_client
        
        # Configure security logger
        self.security_logger = logging.getLogger("security.audit")
        handler = logging.FileHandler("security_audit.log")
        handler.setFormatter(
            logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
        )
        self.security_logger.addHandler(handler)
        self.security_logger.setLevel(logging.INFO)
        
        # Alert thresholds
        self.FAILED_LOGIN_THRESHOLD = 5  # Failed logins before alert
        self.ACCESS_DENIED_THRESHOLD = 10  # Access denials before alert
        self.RATE_LIMIT_THRESHOLD = 20  # Rate limit hits before alert
    
    async def log_event(
        self,
        event_type: SecurityEventType,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        ip_address: Optional[str] = None,
        restaurant_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: str = "INFO"
    ):
        """
        Log a security event with full context
        """
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type.value,
            "severity": severity,
            "user_id": user_id,
            "user_email": user_email,
            "ip_address": ip_address,
            "restaurant_id": restaurant_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {}
        }
        
        # Log to file
        self.security_logger.log(
            getattr(logging, severity),
            json.dumps(event)
        )
        
        # Store in Redis for real-time monitoring
        if self.redis:
            try:
                # Store event
                event_key = f"security:event:{datetime.utcnow().timestamp()}"
                await self.redis.setex(event_key, 86400, json.dumps(event))  # 24 hour retention
                
                # Update counters for alerting
                await self._update_security_counters(event_type, user_id, ip_address)
                
                # Check for security alerts
                await self._check_security_alerts(event_type, user_id, ip_address)
                
            except Exception as e:
                logger.error(f"Failed to store security event in Redis: {e}")
        
        # Log to standard logger for immediate visibility
        if severity in ["WARNING", "ERROR", "CRITICAL"]:
            logger.warning(
                f"SECURITY EVENT: {event_type.value} - "
                f"User: {user_email or user_id} - IP: {ip_address} - "
                f"Details: {details}"
            )
    
    async def log_access_attempt(
        self,
        user: User,
        resource_type: str,
        resource_id: str,
        action: str,
        granted: bool,
        ip_address: str,
        reason: Optional[str] = None
    ):
        """
        Log an access control decision
        """
        event_type = SecurityEventType.ACCESS_GRANTED if granted else SecurityEventType.ACCESS_DENIED
        severity = "INFO" if granted else "WARNING"
        
        # Check if this is a cross-tenant attempt
        if not granted and reason and "restaurant" in reason.lower():
            event_type = SecurityEventType.CROSS_TENANT_ATTEMPT
            severity = "ERROR"
        
        await self.log_event(
            event_type=event_type,
            user_id=str(user.id),
            user_email=user.email,
            ip_address=ip_address,
            restaurant_id=str(user.restaurant_id) if user.restaurant_id else None,
            resource_type=resource_type,
            resource_id=resource_id,
            details={
                "action": action,
                "reason": reason,
                "user_role": user.role,
                "granted": granted
            },
            severity=severity
        )
    
    async def log_platform_owner_access(
        self,
        user: User,
        target_restaurant_id: str,
        action: str,
        resource_type: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Special logging for platform owner access to track their activities
        """
        await self.log_event(
            event_type=SecurityEventType.PLATFORM_OWNER_ACCESS,
            user_id=str(user.id),
            user_email=user.email,
            restaurant_id=target_restaurant_id,
            resource_type=resource_type,
            details={
                "action": action,
                "platform_owner": True,
                **(details or {})
            },
            severity="INFO"
        )
    
    async def log_rate_limit_violation(
        self,
        ip_address: str,
        user_id: Optional[str] = None,
        limit_type: str = "connection",
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Log rate limiting violations
        """
        await self.log_event(
            event_type=SecurityEventType.RATE_LIMIT_EXCEEDED,
            user_id=user_id,
            ip_address=ip_address,
            details={
                "limit_type": limit_type,
                **(details or {})
            },
            severity="WARNING"
        )
    
    async def _update_security_counters(
        self,
        event_type: SecurityEventType,
        user_id: Optional[str],
        ip_address: Optional[str]
    ):
        """
        Update security event counters for alerting
        """
        if not self.redis:
            return
        
        try:
            # Track failed logins
            if event_type == SecurityEventType.LOGIN_FAILED and ip_address:
                key = f"security:failed_logins:{ip_address}"
                await self.redis.incr(key)
                await self.redis.expire(key, 3600)  # Reset after 1 hour
            
            # Track access denials
            elif event_type == SecurityEventType.ACCESS_DENIED and user_id:
                key = f"security:access_denied:{user_id}"
                await self.redis.incr(key)
                await self.redis.expire(key, 3600)
            
            # Track rate limit violations
            elif event_type == SecurityEventType.RATE_LIMIT_EXCEEDED and ip_address:
                key = f"security:rate_limits:{ip_address}"
                await self.redis.incr(key)
                await self.redis.expire(key, 3600)
                
        except Exception as e:
            logger.error(f"Failed to update security counters: {e}")
    
    async def _check_security_alerts(
        self,
        event_type: SecurityEventType,
        user_id: Optional[str],
        ip_address: Optional[str]
    ):
        """
        Check if security thresholds are exceeded and generate alerts
        """
        if not self.redis:
            return
        
        try:
            # Check failed login threshold
            if event_type == SecurityEventType.LOGIN_FAILED and ip_address:
                key = f"security:failed_logins:{ip_address}"
                count = await self.redis.get(key)
                if count and int(count) >= self.FAILED_LOGIN_THRESHOLD:
                    logger.critical(
                        f"SECURITY ALERT: {count} failed login attempts from IP {ip_address}"
                    )
                    # Could trigger additional actions like temporary IP ban
            
            # Check access denial threshold
            elif event_type == SecurityEventType.ACCESS_DENIED and user_id:
                key = f"security:access_denied:{user_id}"
                count = await self.redis.get(key)
                if count and int(count) >= self.ACCESS_DENIED_THRESHOLD:
                    logger.critical(
                        f"SECURITY ALERT: User {user_id} has {count} access denials"
                    )
            
            # Check rate limit threshold
            elif event_type == SecurityEventType.RATE_LIMIT_EXCEEDED and ip_address:
                key = f"security:rate_limits:{ip_address}"
                count = await self.redis.get(key)
                if count and int(count) >= self.RATE_LIMIT_THRESHOLD:
                    logger.critical(
                        f"SECURITY ALERT: IP {ip_address} has hit rate limits {count} times - Possible DDoS"
                    )
                    await self.log_event(
                        event_type=SecurityEventType.DDOS_ATTEMPT,
                        ip_address=ip_address,
                        severity="CRITICAL",
                        details={"rate_limit_hits": count}
                    )
                    
        except Exception as e:
            logger.error(f"Failed to check security alerts: {e}")
    
    async def get_security_summary(
        self,
        time_window_hours: int = 24
    ) -> Dict[str, Any]:
        """
        Get a summary of security events for monitoring dashboard
        """
        if not self.redis:
            return {"error": "Redis not available"}
        
        try:
            # This would aggregate security events from Redis
            # For now, return a placeholder
            return {
                "time_window_hours": time_window_hours,
                "total_events": 0,
                "failed_logins": 0,
                "access_denials": 0,
                "rate_limit_violations": 0,
                "cross_tenant_attempts": 0,
                "platform_owner_actions": 0
            }
        except Exception as e:
            logger.error(f"Failed to get security summary: {e}")
            return {"error": str(e)}


# Global security monitor instance
security_monitor = SecurityMonitor()