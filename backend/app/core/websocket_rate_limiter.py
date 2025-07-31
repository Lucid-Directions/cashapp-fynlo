"""
WebSocket Rate Limiting System
Prevents DoS attacks by limiting connections and messages
"""

import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Optional, Set, Tuple
import logging

from app.core.redis_client import RedisClient
from app.core.config import settings

logger = logging.getLogger(__name__)


class WebSocketRateLimiter:
    """
    Comprehensive rate limiting for WebSocket connections and messages
    """
    
    def __init__(self, redis_client: Optional[RedisClient] = None):
        self.redis = redis_client
        
        # Configuration
        self.MAX_CONNECTIONS_PER_IP = 50  # per minute
        self.MAX_CONNECTIONS_PER_USER = 5  # simultaneous connections
        self.MAX_MESSAGES_PER_CONNECTION = 60  # per minute
        self.MAX_MESSAGE_SIZE = 10 * 1024  # 10KB
        
        # Rate limit windows
        self.CONNECTION_WINDOW = 60  # seconds
        self.MESSAGE_WINDOW = 60  # seconds
        
        # Penalty system
        self.VIOLATION_PENALTY_MULTIPLIER = 2  # Double the wait time for violations
        self.MAX_VIOLATIONS = 5  # Before temporary ban
        self.TEMP_BAN_DURATION = 300  # 5 minutes
        
        # In-memory fallback if Redis not available
        self.connection_attempts: Dict[str, Dict[str, any]] = defaultdict(
            lambda: {"count": 0, "window_start": time.time(), "violations": 0}
        )
        self.message_counts: Dict[str, Dict[str, any]] = defaultdict(
            lambda: {"count": 0, "window_start": time.time()}
        )
        self.active_connections: Dict[str, Set[str]] = defaultdict(set)
        self.banned_ips: Dict[str, float] = {}  # IP -> ban_until timestamp
    
    async def check_connection_limit(
        self, 
        ip_address: str, 
        user_id: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a new connection is allowed
        
        Returns:
            Tuple[bool, Optional[str]]: (is_allowed, error_message)
        """
        # Check if IP is temporarily banned
        if ip_address in self.banned_ips:
            if time.time() < self.banned_ips[ip_address]:
                remaining = int(self.banned_ips[ip_address] - time.time())
                return False, f"Temporarily banned. Try again in {remaining} seconds"
            else:
                del self.banned_ips[ip_address]
        
        # Check IP-based rate limit
        if self.redis:
            try:
                key = f"ws:conn:ip:{ip_address}"
                current = await self.redis.get(key)
                current_count = int(current) if current else 0
                
                if current_count >= self.MAX_CONNECTIONS_PER_IP:
                    await self._record_violation(ip_address)
                    return False, "Too many connection attempts from this IP"
                
                await self.redis.set(key, current_count + 1, expire=self.CONNECTION_WINDOW)
            except Exception as e:
                logger.error(f"Redis error in connection rate limit: {e}")
                # In production, fail closed
                if settings.ENVIRONMENT not in ["development", "testing", "local"]:
                    return False, "Rate limiting service temporarily unavailable"
                # Fall back to in-memory in dev
        else:
            # In-memory rate limiting (dev only)
            if settings.ENVIRONMENT not in ["development", "testing", "local"]:
                # Production without Redis - fail closed
                return False, "Rate limiting service unavailable"
                
            now = time.time()
            tracker = self.connection_attempts[ip_address]
            
            # Reset window if expired
            if now - tracker["window_start"] > self.CONNECTION_WINDOW:
                tracker["count"] = 0
                tracker["window_start"] = now
            
            if tracker["count"] >= self.MAX_CONNECTIONS_PER_IP:
                await self._record_violation(ip_address)
                return False, "Too many connection attempts from this IP"
            
            tracker["count"] += 1
        
        # Check user connection limit if authenticated
        if user_id:
            active_count = len(self.active_connections.get(user_id, set()))
            if active_count >= self.MAX_CONNECTIONS_PER_USER:
                return False, f"Maximum {self.MAX_CONNECTIONS_PER_USER} simultaneous connections allowed"
        
        return True, None
    
    async def check_message_rate(
        self, 
        connection_id: str,
        message_size: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a message is allowed based on rate limits
        
        Returns:
            Tuple[bool, Optional[str]]: (is_allowed, error_message)
        """
        # Check message size
        if message_size > self.MAX_MESSAGE_SIZE:
            return False, f"Message too large. Maximum size: {self.MAX_MESSAGE_SIZE} bytes"
        
        # Check message rate
        if self.redis:
            try:
                key = f"ws:msg:conn:{connection_id}"
                current = await self.redis.get(key)
                current_count = int(current) if current else 0
                
                if current_count >= self.MAX_MESSAGES_PER_CONNECTION:
                    return False, "Message rate limit exceeded"
                
                await self.redis.set(key, current_count + 1, expire=self.MESSAGE_WINDOW)
            except Exception as e:
                logger.error(f"Redis error in message rate limit: {e}")
                # In production, fail closed
                if settings.ENVIRONMENT not in ["development", "testing", "local"]:
                    return False, "Rate limiting service temporarily unavailable"
                # Fall back to in-memory in dev
        else:
            # In-memory rate limiting (dev only)
            if settings.ENVIRONMENT not in ["development", "testing", "local"]:
                # Production without Redis - fail closed
                return False, "Rate limiting service unavailable"
                
            now = time.time()
            tracker = self.message_counts[connection_id]
            
            # Reset window if expired
            if now - tracker["window_start"] > self.MESSAGE_WINDOW:
                tracker["count"] = 0
                tracker["window_start"] = now
            
            if tracker["count"] >= self.MAX_MESSAGES_PER_CONNECTION:
                return False, "Message rate limit exceeded"
            
            tracker["count"] += 1
        
        return True, None
    
    async def register_connection(self, connection_id: str, user_id: Optional[str], ip_address: str):
        """Register a new active connection"""
        if user_id:
            self.active_connections[user_id].add(connection_id)
        
        # Log for security monitoring
        logger.info(
            f"WebSocket connection established - "
            f"ID: {connection_id}, User: {user_id or 'anonymous'}, IP: {ip_address}"
        )
    
    async def unregister_connection(self, connection_id: str, user_id: Optional[str]):
        """Remove a closed connection"""
        if user_id and user_id in self.active_connections:
            self.active_connections[user_id].discard(connection_id)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        # Clean up message tracking
        if connection_id in self.message_counts:
            del self.message_counts[connection_id]
        
        logger.info(f"WebSocket connection closed - ID: {connection_id}")
    
    async def _record_violation(self, ip_address: str):
        """Record a rate limit violation and apply penalties"""
        if ip_address in self.connection_attempts:
            self.connection_attempts[ip_address]["violations"] += 1
            violations = self.connection_attempts[ip_address]["violations"]
            
            logger.warning(
                f"Rate limit violation #{violations} from IP: {ip_address}"
            )
            
            # Apply temporary ban after max violations
            if violations >= self.MAX_VIOLATIONS:
                self.banned_ips[ip_address] = time.time() + self.TEMP_BAN_DURATION
                logger.warning(
                    f"IP {ip_address} temporarily banned for {self.TEMP_BAN_DURATION} seconds"
                )
    
    async def get_rate_limit_info(self, connection_id: str) -> Dict[str, any]:
        """Get current rate limit status for a connection"""
        if connection_id in self.message_counts:
            tracker = self.message_counts[connection_id]
            remaining = self.MAX_MESSAGES_PER_CONNECTION - tracker["count"]
            reset_in = max(0, self.MESSAGE_WINDOW - (time.time() - tracker["window_start"]))
            
            return {
                "messages_remaining": max(0, remaining),
                "reset_in_seconds": int(reset_in),
                "max_messages": self.MAX_MESSAGES_PER_CONNECTION,
                "window_seconds": self.MESSAGE_WINDOW
            }
        
        return {
            "messages_remaining": self.MAX_MESSAGES_PER_CONNECTION,
            "reset_in_seconds": self.MESSAGE_WINDOW,
            "max_messages": self.MAX_MESSAGES_PER_CONNECTION,
            "window_seconds": self.MESSAGE_WINDOW
        }
    
    async def cleanup_expired_data(self):
        """Periodic cleanup of expired tracking data"""
        now = time.time()
        
        # Clean up connection attempts
        expired_ips = []
        for ip, data in self.connection_attempts.items():
            if now - data["window_start"] > self.CONNECTION_WINDOW * 2:
                expired_ips.append(ip)
        
        for ip in expired_ips:
            del self.connection_attempts[ip]
        
        # Clean up expired bans
        expired_bans = [ip for ip, until in self.banned_ips.items() if now > until]
        for ip in expired_bans:
            del self.banned_ips[ip]
        
        # Clean up message counts for closed connections
        # This is handled in unregister_connection()
        
        if expired_ips or expired_bans:
            logger.debug(
                f"Cleaned up {len(expired_ips)} connection trackers "
                f"and {len(expired_bans)} expired bans"
            )


# Global rate limiter instance
websocket_rate_limiter = WebSocketRateLimiter()