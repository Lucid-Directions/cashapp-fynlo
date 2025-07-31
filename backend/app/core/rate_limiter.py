"""
Rate limiter for WebSocket connections
Implements token bucket algorithm for message rate limiting
"""TODO: Add docstring."""

import time
from typing import Dict, Tuple
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token bucket rate limiter for WebSocket messages"""
    
    def __init__(
        self, 
        max_messages: int = 100,
        window_seconds: int = 60,
        burst_size: int = 20
    ):
        """
        Initialize rate limiter
        
        Args:
            max_messages: Maximum messages allowed in window
            window_seconds: Time window in seconds
            burst_size: Maximum burst allowed
        """
        self.max_messages = max_messages
        self.window_seconds = window_seconds
        self.burst_size = burst_size
        
        # connection_id -> (tokens, last_update_time)
        self.buckets: Dict[str, Tuple[float, float]] = {}
        
        # Track violations
        self.violations: Dict[str, int] = {}
        
    def check_rate_limit(self, connection_id: str) -> bool:
        """
        Check if connection is within rate limit
        
        Returns:
            True if allowed, False if rate limited
        """
        current_time = time.time()
        
        if connection_id not in self.buckets:
            # First request, initialize bucket
            self.buckets[connection_id] = (self.burst_size - 1, current_time)
            return True
            
        tokens, last_update = self.buckets[connection_id]
        
        # Calculate tokens to add based on time elapsed
        time_elapsed = current_time - last_update
        refill_rate = self.max_messages / self.window_seconds
        tokens_to_add = time_elapsed * refill_rate
        
        # Update tokens (cap at burst size)
        tokens = min(tokens + tokens_to_add, self.burst_size)
        
        if tokens >= 1:
            # Allow request, consume token
            self.buckets[connection_id] = (tokens - 1, current_time)
            
            # Reset violations on successful request
            if connection_id in self.violations:
                del self.violations[connection_id]
                
            return True
        else:
            # Rate limited
            self.violations[connection_id] = self.violations.get(connection_id, 0) + 1
            
            if self.violations[connection_id] > 10:
                logger.warning(f"Connection {connection_id} has {self.violations[connection_id]} rate limit violations")
                
            return False
            
    def cleanup_old_buckets(self, inactive_seconds: int = 300):
        """Remove buckets for inactive connections"""
        current_time = time.time()
        expired_connections = []
        
        for conn_id, (_, last_update) in self.buckets.items():
            if current_time - last_update > inactive_seconds:
                expired_connections.append(conn_id)
                
        for conn_id in expired_connections:
            del self.buckets[conn_id]
            if conn_id in self.violations:
                del self.violations[conn_id]
                
        if expired_connections:
            logger.info(f"Cleaned up {len(expired_connections)} inactive rate limit buckets")
            
    def get_wait_time(self, connection_id: str) -> float:
        """Get time to wait before next allowed request"""
        if connection_id not in self.buckets:
            return 0.0
            
        tokens, last_update = self.buckets[connection_id]
        
        if tokens >= 1:
            return 0.0
            
        # Calculate time needed to get 1 token
        refill_rate = self.max_messages / self.window_seconds
        tokens_needed = 1 - tokens
        wait_time = tokens_needed / refill_rate
        
        return wait_time


class ConnectionLimiter:
    """Limit connections per IP and per user"""
    
    def __init__(
        self,
        max_per_ip: int = 20,
        max_per_user: int = 5,
        ip_window_seconds: int = 60
    ):
        self.max_per_ip = max_per_ip
        self.max_per_user = max_per_user
        self.ip_window_seconds = ip_window_seconds
        
        # IP -> list of (timestamp, user_id)
        self.ip_connections: Dict[str, list] = {}
        
        # user_id -> set of connection_ids
        self.user_connections: Dict[str, set] = {}
        
    def check_connection_allowed(
        self, 
        ip_address: str, 
        user_id: str,
        connection_id: str
    ) -> Tuple[bool, str]:
        """
        Check if new connection is allowed
        
        Returns:
            (allowed, reason)
        """
        current_time = time.time()
        
        # Check IP limit
        if ip_address in self.ip_connections:
            # Clean old connections
            self.ip_connections[ip_address] = [
                (ts, uid) for ts, uid in self.ip_connections[ip_address]
                if current_time - ts < self.ip_window_seconds
            ]
            
            if len(self.ip_connections[ip_address]) >= self.max_per_ip:
                return False, f"Too many connections from IP {ip_address}"
        
        # Check user limit
        if user_id in self.user_connections:
            if len(self.user_connections[user_id]) >= self.max_per_user:
                return False, f"User {user_id} has too many active connections"
                
        # Connection allowed, track it
        if ip_address not in self.ip_connections:
            self.ip_connections[ip_address] = []
        self.ip_connections[ip_address].append((current_time, user_id))
        
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(connection_id)
        
        return True, "OK"
        
    def remove_connection(self, user_id: str, connection_id: str):
        """Remove connection when disconnected"""
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(connection_id)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]