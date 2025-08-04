"""
WebSocket Rate Limiting System
Prevents DoS attacks by limiting connections and messages
Enhanced with connection history tracking and exponential backoff
"""

import time
import json
from collections import defaultdict
from typing import Dict, Optional, Set, Tuple, List, Any
import logging
from app.core.redis_client import RedisClient
from app.core.config import settings

logger = logging.getLogger(__name__)


class ConnectionHistory:
    """Track connection history for exponential backoff"""

    def __init__(self):
        self.attempts: List[float] = []
        self.violations: int = 0
        self.last_backoff_duration: int = 0

    def add_attempt(self, timestamp: float):
        """Add a connection attempt timestamp"""
        self.attempts.append(timestamp)
        # Keep only attempts in the last hour
        cutoff = timestamp - 3600
        self.attempts = [t for t in self.attempts if t > cutoff]

    def get_recent_attempts(self, window_seconds: int) -> int:
        """Get number of attempts in the specified window"""
        cutoff = time.time() - window_seconds
        return len([t for t in self.attempts if t > cutoff])

    def calculate_backoff(self) -> int:
        """Calculate exponential backoff duration in seconds"""
        # Base backoff: 30 seconds
        # Exponential increase: 2^violations * base
        base_backoff = 30
        max_backoff = 3600  # 1 hour max

        if self.violations == 0:
            return 0

        backoff = min(base_backoff * (2 ** (self.violations - 1)), max_backoff)
        self.last_backoff_duration = backoff
        return backoff

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Redis storage"""
        return {
            "attempts": self.attempts,
            "violations": self.violations,
            "last_backoff_duration": self.last_backoff_duration,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConnectionHistory":
        """Create from dictionary retrieved from Redis"""
        history = cls()
        history.attempts = data.get("attempts", [])
        history.violations = data.get("violations", 0)
        history.last_backoff_duration = data.get("last_backoff_duration", 0)
        return history


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

        # New: Reconnection limits
        self.MAX_RECONNECTIONS_PER_WINDOW = 10  # per 5 minutes
        self.RECONNECTION_WINDOW = 300  # 5 minutes

        # Rate limit windows
        self.CONNECTION_WINDOW = 60  # seconds
        self.MESSAGE_WINDOW = 60  # seconds
        self.HISTORY_RETENTION = 3600  # 1 hour

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

        # New: Connection history tracking
        self.connection_history: Dict[str, ConnectionHistory] = {}

    async def check_connection_limit(
        self, ip_address: str, user_id: Optional[str] = None
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Check if a new connection is allowed

        Returns:
            Tuple[bool, Optional[str], Optional[Dict]]: (is_allowed, error_message, rate_limit_info)
        """
        current_time = time.time()
        rate_limit_info = None

        # Check connection history and exponential backoff
        history = await self._get_connection_history(ip_address, user_id)
        history.add_attempt(current_time)

        # Check for exponential backoff
        if history.violations > 0:
            backoff_duration = history.calculate_backoff()
            if history.attempts and len(history.attempts) > 1:
                last_attempt = (
                    history.attempts[-2]
                    if len(history.attempts) > 1
                    else history.attempts[-1]
                )
                time_since_last = current_time - last_attempt
                if time_since_last < backoff_duration:
                    remaining = int(backoff_duration - time_since_last)
                    rate_limit_info = {
                        "retry_after": remaining,
                        "violations": history.violations,
                        "backoff_duration": backoff_duration,
                    }
                    await self._save_connection_history(ip_address, user_id, history)
                    return (
                        False,
                        f"Connection throttled. Retry after {remaining} seconds",
                        rate_limit_info,
                    )

        # Check reconnection limit
        recent_attempts = history.get_recent_attempts(self.RECONNECTION_WINDOW)
        if recent_attempts >= self.MAX_RECONNECTIONS_PER_WINDOW:
            history.violations += 1
            await self._save_connection_history(ip_address, user_id, history)
            await self._record_violation(ip_address, user_id)
            rate_limit_info = {
                "retry_after": self.RECONNECTION_WINDOW,
                "violations": history.violations,
                "recent_attempts": recent_attempts,
            }
            return (
                False,
                f"Too many reconnection attempts. Maximum {self.MAX_RECONNECTIONS_PER_WINDOW} per {self.RECONNECTION_WINDOW//60} minutes",
                rate_limit_info,
            )

        # Check if IP is temporarily banned
        ban_info = await self._check_ban_status(ip_address, user_id)
        if ban_info:
            return False, ban_info["message"], ban_info

        # Check IP-based rate limit
        if self.redis:
            try:
                key = f"ws:conn:ip:{ip_address}"
                current = await self.redis.get(key)
                current_count = int(current) if current else 0

                if current_count >= self.MAX_CONNECTIONS_PER_IP:
                    history.violations += 1
                    await self._save_connection_history(ip_address, user_id, history)
                    await self._record_violation(ip_address, user_id)
                    rate_limit_info = {
                        "retry_after": self.CONNECTION_WINDOW,
                        "violations": history.violations,
                    }
                    return (
                        False,
                        "Too many connection attempts from this IP",
                        rate_limit_info,
                    )

                await self.redis.set(
                    key, current_count + 1, expire=self.CONNECTION_WINDOW
                )
            except Exception as e:
                logger.error(f"Redis error in connection rate limit: {e}")
                # In production, fail closed
                if settings.ENVIRONMENT not in ["development", "testing", "local"]:
                    return False, "Rate limiting service temporarily unavailable", None
                # Fall back to in-memory in dev
        else:
            # In-memory rate limiting (dev only)
            if settings.ENVIRONMENT not in ["development", "testing", "local"]:
                # Production without Redis - fail closed
                return False, "Rate limiting service unavailable", None

            now = time.time()
            tracker = self.connection_attempts[ip_address]

            # Reset window if expired
            if now - tracker["window_start"] > self.CONNECTION_WINDOW:
                tracker["count"] = 0
                tracker["window_start"] = now

            if tracker["count"] >= self.MAX_CONNECTIONS_PER_IP:
                history.violations += 1
                await self._save_connection_history(ip_address, user_id, history)
                await self._record_violation(ip_address, user_id)
                rate_limit_info = {
                    "retry_after": self.CONNECTION_WINDOW,
                    "violations": history.violations,
                }
                return (
                    False,
                    "Too many connection attempts from this IP",
                    rate_limit_info,
                )

            tracker["count"] += 1

        # Check user connection limit if authenticated
        if user_id:
            active_count = len(self.active_connections.get(user_id, set()))
            if active_count >= self.MAX_CONNECTIONS_PER_USER:
                rate_limit_info = {
                    "active_connections": active_count,
                    "max_connections": self.MAX_CONNECTIONS_PER_USER,
                }
                return (
                    False,
                    f"Maximum {self.MAX_CONNECTIONS_PER_USER} simultaneous connections allowed",
                    rate_limit_info,
                )

        # Save updated history
        await self._save_connection_history(ip_address, user_id, history)
        return True, None, None

    async def check_message_rate(
        self, connection_id: str, message_size: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a message is allowed based on rate limits

        Returns:
            Tuple[bool, Optional[str]]: (is_allowed, error_message)
        """
        # Check message size
        if message_size > self.MAX_MESSAGE_SIZE:
            return (
                False,
                f"Message too large. Maximum size: {self.MAX_MESSAGE_SIZE} bytes",
            )

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

    async def register_connection(
        self, connection_id: str, user_id: Optional[str], ip_address: str
    ):
        """Register a new active connection and track in history"""
        if user_id:
            self.active_connections[user_id].add(connection_id)

        # Update connection history
        history = await self._get_connection_history(ip_address, user_id)
        await self._save_connection_history(ip_address, user_id, history)

        # Log for security monitoring
        logger.info(
            f"WebSocket connection established - "
            f"ID: {connection_id}, User: {user_id or 'anonymous'}, IP: {ip_address}, "
            f"Recent attempts: {history.get_recent_attempts(self.RECONNECTION_WINDOW)}"
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

    async def _get_connection_history(
        self, ip_address: str, user_id: Optional[str] = None
    ) -> ConnectionHistory:
        """Get connection history for an IP/user"""
        # Create a unique key combining IP and user_id
        history_key = f"{ip_address}:{user_id if user_id else 'anon'}"

        if self.redis:
            try:
                redis_key = f"ws:history:{history_key}"
                data = await self.redis.get(redis_key)
                if data:
                    return ConnectionHistory.from_dict(json.loads(data))
            except Exception as e:
                logger.error(f"Redis error getting connection history: {e}")

        # Return from memory or create new
        if history_key not in self.connection_history:
            self.connection_history[history_key] = ConnectionHistory()
        return self.connection_history[history_key]

    async def _save_connection_history(
        self, ip_address: str, user_id: Optional[str], history: ConnectionHistory
    ):
        """Save connection history to Redis"""
        history_key = f"{ip_address}:{user_id if user_id else 'anon'}"

        if self.redis:
            try:
                redis_key = f"ws:history:{history_key}"
                await self.redis.set(
                    redis_key,
                    json.dumps(history.to_dict()),
                    expire=self.HISTORY_RETENTION,
                )
            except Exception as e:
                logger.error(f"Redis error saving connection history: {e}")

        # Also save in memory
        self.connection_history[history_key] = history

    async def _check_ban_status(
        self, ip_address: str, user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Check if IP or user is banned"""
        current_time = time.time()

        # Check IP ban
        if self.redis:
            try:
                # Check IP ban
                ip_ban_key = f"ws:ban:ip:{ip_address}"
                ip_ban_data = await self.redis.get(ip_ban_key)
                if ip_ban_data:
                    ban_info = json.loads(ip_ban_data)
                    if ban_info["until"] > current_time:
                        remaining = int(ban_info["until"] - current_time)
                        return {
                            "message": f"IP temporarily banned. Try again in {remaining} seconds",
                            "retry_after": remaining,
                            "ban_type": "ip",
                            "reason": ban_info.get("reason", "Rate limit violations"),
                        }

                # Check user ban if user_id provided
                if user_id:
                    user_ban_key = f"ws:ban:user:{user_id}"
                    user_ban_data = await self.redis.get(user_ban_key)
                    if user_ban_data:
                        ban_info = json.loads(user_ban_data)
                        if ban_info["until"] > current_time:
                            remaining = int(ban_info["until"] - current_time)
                            return {
                                "message": f"User temporarily banned. Try again in {remaining} seconds",
                                "retry_after": remaining,
                                "ban_type": "user",
                                "reason": ban_info.get(
                                    "reason", "Rate limit violations"
                                ),
                            }
            except Exception as e:
                logger.error(f"Redis error checking ban status: {e}")
        else:
            # Check in-memory bans
            if ip_address in self.banned_ips:
                if current_time < self.banned_ips[ip_address]:
                    remaining = int(self.banned_ips[ip_address] - current_time)
                    return {
                        "message": f"Temporarily banned. Try again in {remaining} seconds",
                        "retry_after": remaining,
                        "ban_type": "ip",
                    }
                else:
                    del self.banned_ips[ip_address]

        return None

    async def _record_violation(self, ip_address: str, user_id: Optional[str] = None):
        """Record a rate limit violation and apply penalties"""
        current_time = time.time()

        if self.redis:
            try:
                # Track violations for IP
                ip_violations_key = f"ws:violations:ip:{ip_address}"
                violations = await self.redis.get(ip_violations_key)
                violations = int(violations) if violations else 0
                violations += 1

                await self.redis.set(ip_violations_key, violations, expire=3600)

                logger.warning(
                    f"Rate limit violation #{violations} from IP: {ip_address}"
                    f"{f' (User: {user_id})' if user_id else ''}"
                )

                # Apply temporary ban after max violations
                if violations >= self.MAX_VIOLATIONS:
                    ban_duration = self.TEMP_BAN_DURATION * (
                        2 ** ((violations - self.MAX_VIOLATIONS) // 5)
                    )
                    ban_duration = min(ban_duration, 86400)  # Max 24 hours

                    ban_info = {
                        "until": current_time + ban_duration,
                        "violations": violations,
                        "reason": f"Exceeded rate limit {violations} times",
                        "banned_at": current_time,
                    }

                    # Ban IP
                    ip_ban_key = f"ws:ban:ip:{ip_address}"
                    await self.redis.set(
                        ip_ban_key, json.dumps(ban_info), expire=ban_duration
                    )

                    # Also ban user if authenticated
                    if user_id:
                        user_ban_key = f"ws:ban:user:{user_id}"
                        await self.redis.set(
                            user_ban_key, json.dumps(ban_info), expire=ban_duration
                        )

                    logger.warning(
                        f"IP {ip_address} temporarily banned for {ban_duration} seconds "
                        f"after {violations} violations"
                    )
            except Exception as e:
                logger.error(f"Redis error recording violation: {e}")
        else:
            # In-memory violation tracking
            if ip_address in self.connection_attempts:
                self.connection_attempts[ip_address]["violations"] += 1
                violations = self.connection_attempts[ip_address]["violations"]

                logger.warning(
                    f"Rate limit violation #{violations} from IP: {ip_address}"
                )

                # Apply temporary ban after max violations
                if violations >= self.MAX_VIOLATIONS:
                    self.banned_ips[ip_address] = current_time + self.TEMP_BAN_DURATION
                    logger.warning(
                        f"IP {ip_address} temporarily banned for {self.TEMP_BAN_DURATION} seconds"
                    )

    async def get_rate_limit_info(self, connection_id: str) -> Dict[str, any]:
        """Get current rate limit status for a connection"""
        if connection_id in self.message_counts:
            tracker = self.message_counts[connection_id]
            remaining = self.MAX_MESSAGES_PER_CONNECTION - tracker["count"]
            reset_in = max(
                0, self.MESSAGE_WINDOW - (time.time() - tracker["window_start"])
            )

            return {
                "messages_remaining": max(0, remaining),
                "reset_in_seconds": int(reset_in),
                "max_messages": self.MAX_MESSAGES_PER_CONNECTION,
                "window_seconds": self.MESSAGE_WINDOW,
            }

        return {
            "messages_remaining": self.MAX_MESSAGES_PER_CONNECTION,
            "reset_in_seconds": self.MESSAGE_WINDOW,
            "max_messages": self.MAX_MESSAGES_PER_CONNECTION,
            "window_seconds": self.MESSAGE_WINDOW,
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

        # Clean up old connection history
        expired_history = []
        for key, history in self.connection_history.items():
            if not history.attempts or (
                now - max(history.attempts) > self.HISTORY_RETENTION
            ):
                expired_history.append(key)

        for key in expired_history:
            del self.connection_history[key]

        # Clean up message counts for closed connections
        # This is handled in unregister_connection()

        if expired_ips or expired_bans or expired_history:
            logger.debug(
                f"Cleaned up {len(expired_ips)} connection trackers, "
                f"{len(expired_bans)} expired bans, and "
                f"{len(expired_history)} history entries"
            )


# Global rate limiter instance
websocket_rate_limiter = WebSocketRateLimiter()
