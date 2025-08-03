"""
WebSocket Rate Limiting Module
Implements rate limiting for WebSocket connections and messages to prevent DoS attacks
"""

import logging
import time
from typing import Dict, Optional, Tuple, Any
from datetime import datetime
from enum import Enum
import asyncio
from collections import defaultdict

from app.core.config import settings
from app.core.redis_client import redis_client

logger = logging.getLogger(__name__)


class RateLimitAction(str, Enum):
    """Actions to take when rate limit is exceeded"""

    BLOCK = "block"
    THROTTLE = "throttle"
    WARN = "warn"


class WebSocketRateLimiter:
    """
    Rate limiter for WebSocket connections and messages
    Uses Redis for distributed rate limiting across multiple servers
    """

    def __init__(self):
        # Connection limits
        self.MAX_CONNECTIONS_PER_IP = settings.get(
            "WEBSOCKET_MAX_CONNECTIONS_PER_IP", 10
        )
        self.MAX_CONNECTIONS_PER_USER = settings.get(
            "WEBSOCKET_MAX_CONNECTIONS_PER_USER", 5
        )
        self.CONNECTION_WINDOW_MINUTES = settings.get(
            "WEBSOCKET_CONNECTION_WINDOW_MINUTES", 1
        )

        # Message limits
        self.MAX_MESSAGES_PER_CONNECTION = settings.get(
            "WEBSOCKET_MAX_MESSAGES_PER_CONNECTION", 60
        )
        self.MESSAGE_WINDOW_SECONDS = settings.get(
            "WEBSOCKET_MESSAGE_WINDOW_SECONDS", 60
        )

        # Violation tracking for exponential backoff
        self.VIOLATION_EXPIRY_HOURS = settings.get(
            "WEBSOCKET_VIOLATION_EXPIRY_HOURS", 24
        )
        self.MAX_VIOLATIONS_BEFORE_BAN = settings.get(
            "WEBSOCKET_MAX_VIOLATIONS_BEFORE_BAN", 10
        )

        # In-memory fallback for when Redis is unavailable
        self._fallback_storage: Dict[str, Dict[str, Any]] = defaultdict(dict)
        self._fallback_lock = asyncio.Lock()

        # Metrics
        self.metrics = {
            "connections_allowed": 0,
            "connections_blocked": 0,
            "messages_allowed": 0,
            "messages_blocked": 0,
            "violations_recorded": 0,
            "bans_applied": 0,
        }

    async def check_connection_limit(
        self, ip_address: str, user_id: Optional[str] = None
    ) -> Tuple[bool, Optional[str], Optional[int]]:
        """
        Check if a new WebSocket connection is allowed

        Returns:
            - allowed: Whether the connection is allowed
            - reason: Reason for blocking (if blocked)
            - retry_after: Seconds until retry is allowed (for exponential backoff)
        """
        try:
            # Check if IP is banned
            is_banned, ban_duration = await self._check_ban_status(ip_address)
            if is_banned:
                self.metrics["connections_blocked"] += 1
                return (
                    False,
                    f"IP banned for {ban_duration} seconds due to repeated violations",
                    ban_duration,
                )

            # Check IP connection rate
            ip_key = f"ws:conn:ip:{ip_address}"
            ip_count = await self._increment_counter(
                ip_key, self.CONNECTION_WINDOW_MINUTES * 60
            )

            if ip_count > self.MAX_CONNECTIONS_PER_IP:
                await self._record_violation(ip_address, "connection_limit_exceeded")
                self.metrics["connections_blocked"] += 1
                return (
                    False,
                    f"Too many connections from IP (limit: {self.MAX_CONNECTIONS_PER_IP}/min)",
                    60,
                )

            # Check user connection rate if user_id provided
            if user_id:
                user_key = f"ws:conn:user:{user_id}"
                user_count = await self._increment_counter(
                    user_key, self.CONNECTION_WINDOW_MINUTES * 60
                )

                if user_count > self.MAX_CONNECTIONS_PER_USER:
                    await self._record_violation(
                        f"user:{user_id}", "user_connection_limit_exceeded"
                    )
                    self.metrics["connections_blocked"] += 1
                    return (
                        False,
                        f"Too many connections for user (limit: {self.MAX_CONNECTIONS_PER_USER}/min)",
                        60,
                    )

            # Check active connections (not rate, but total active)
            active_key = f"ws:active:ip:{ip_address}"
            active_count = await self._get_active_count(active_key)

            if active_count >= self.MAX_CONNECTIONS_PER_IP:
                self.metrics["connections_blocked"] += 1
                return False, "Maximum active connections reached for IP", 60

            self.metrics["connections_allowed"] += 1
            return True, None, None

        except Exception as e:
            logger.error(f"Error checking connection limit: {str(e)}")
            # Fail open in case of Redis issues, but log it
            logger.warning("Rate limiting failed, allowing connection (fail-open)")
            return True, None, None

    async def check_message_limit(
        self, connection_id: str, ip_address: str, user_id: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a message is allowed on a WebSocket connection

        Returns:
            - allowed: Whether the message is allowed
            - reason: Reason for blocking (if blocked)
        """
        try:
            # Check message rate for connection
            conn_key = f"ws:msg:conn:{connection_id}"
            msg_count = await self._increment_counter(
                conn_key, self.MESSAGE_WINDOW_SECONDS
            )

            if msg_count > self.MAX_MESSAGES_PER_CONNECTION:
                await self._record_violation(ip_address, "message_limit_exceeded")
                self.metrics["messages_blocked"] += 1

                # Check if we should escalate to connection termination
                violation_count = await self._get_violation_count(ip_address)
                if (
                    violation_count >= 5
                ):  # Terminate connection after 5 message violations
                    return (
                        False,
                        "Message rate limit exceeded - connection will be terminated",
                    )

                return (
                    False,
                    f"Too many messages (limit: {self.MAX_MESSAGES_PER_CONNECTION}/min)",
                )

            # Additional per-user message limiting
            if user_id:
                user_msg_key = f"ws:msg:user:{user_id}"
                user_msg_count = await self._increment_counter(
                    user_msg_key, self.MESSAGE_WINDOW_SECONDS
                )

                # User gets higher limit (3x connection limit)
                if user_msg_count > self.MAX_MESSAGES_PER_CONNECTION * 3:
                    await self._record_violation(
                        f"user:{user_id}", "user_message_limit_exceeded"
                    )
                    self.metrics["messages_blocked"] += 1
                    return False, "User message rate limit exceeded"

            self.metrics["messages_allowed"] += 1
            return True, None

        except Exception as e:
            logger.error(f"Error checking message limit: {str(e)}")
            # Fail open for messages too
            return True, None

    async def register_connection(self, ip_address: str, connection_id: str):
        """Register a new active connection"""
        try:
            active_key = f"ws:active:ip:{ip_address}"
            await self._add_to_set(
                active_key, connection_id, expire=3600
            )  # 1 hour expiry
        except Exception as e:
            logger.error(f"Error registering connection: {str(e)}")

    async def unregister_connection(self, ip_address: str, connection_id: str):
        """Unregister a closed connection"""
        try:
            active_key = f"ws:active:ip:{ip_address}"
            await self._remove_from_set(active_key, connection_id)
        except Exception as e:
            logger.error(f"Error unregistering connection: {str(e)}")

    async def _increment_counter(self, key: str, window_seconds: int) -> int:
        """Increment a rate limit counter with expiry"""
        if redis_client.redis:
            try:
                # Use Redis INCR with expiry
                count = await redis_client.incr(key)
                if count == 1:
                    # First increment, set expiry
                    await redis_client.expire(key, window_seconds)
                return count
            except Exception as e:
                logger.error(f"Redis error in increment_counter: {str(e)}")

        # Fallback to in-memory
        async with self._fallback_lock:
            current_time = time.time()

            if key not in self._fallback_storage:
                self._fallback_storage[key] = {"count": 0, "window_start": current_time}

            entry = self._fallback_storage[key]

            # Check if window has expired
            if current_time - entry["window_start"] > window_seconds:
                entry["count"] = 1
                entry["window_start"] = current_time
            else:
                entry["count"] += 1

            return entry["count"]

    async def _get_active_count(self, key: str) -> int:
        """Get count of active connections"""
        if redis_client.redis:
            try:
                count = await redis_client.redis.scard(key)
                return count
            except Exception as e:
                logger.error(f"Redis error in get_active_count: {str(e)}")

        # Fallback
        async with self._fallback_lock:
            return len(self._fallback_storage.get(key, {}).get("members", set()))

    async def _add_to_set(self, key: str, value: str, expire: int):
        """Add value to a set with expiry"""
        if redis_client.redis:
            try:
                await redis_client.redis.sadd(key, value)
                await redis_client.expire(key, expire)
                return
            except Exception as e:
                logger.error(f"Redis error in add_to_set: {str(e)}")

        # Fallback
        async with self._fallback_lock:
            if key not in self._fallback_storage:
                self._fallback_storage[key] = {"members": set()}
            self._fallback_storage[key]["members"].add(value)

    async def _remove_from_set(self, key: str, value: str):
        """Remove value from a set"""
        if redis_client.redis:
            try:
                await redis_client.redis.srem(key, value)
                return
            except Exception as e:
                logger.error(f"Redis error in remove_from_set: {str(e)}")

        # Fallback
        async with self._fallback_lock:
            if (
                key in self._fallback_storage
                and "members" in self._fallback_storage[key]
            ):
                self._fallback_storage[key]["members"].discard(value)

    async def _record_violation(self, identifier: str, violation_type: str):
        """Record a rate limit violation"""
        try:
            self.metrics["violations_recorded"] += 1

            violation_key = f"ws:violations:{identifier}"
            violation_count = await self._increment_counter(
                violation_key, self.VIOLATION_EXPIRY_HOURS * 3600
            )

            # Log violation
            logger.warning(
                f"Rate limit violation recorded - "
                f"Identifier: {identifier}, "
                f"Type: {violation_type}, "
                f"Count: {violation_count}"
            )

            # Check if we should ban
            if violation_count >= self.MAX_VIOLATIONS_BEFORE_BAN:
                await self._apply_ban(identifier)

        except Exception as e:
            logger.error(f"Error recording violation: {str(e)}")

    async def _apply_ban(self, identifier: str):
        """Apply a temporary ban with exponential backoff"""
        try:
            violation_count = await self._get_violation_count(identifier)

            # Exponential backoff: 2^(violations-threshold) minutes
            ban_minutes = 2 ** max(
                0, violation_count - self.MAX_VIOLATIONS_BEFORE_BAN + 1
            )
            ban_seconds = min(ban_minutes * 60, 86400)  # Max 24 hours

            ban_key = f"ws:ban:{identifier}"
            await redis_client.set(
                ban_key,
                {
                    "banned_at": datetime.now().isoformat(),
                    "ban_duration": ban_seconds,
                    "violation_count": violation_count,
                },
                expire=ban_seconds,
            )

            self.metrics["bans_applied"] += 1

            logger.warning(
                f"Ban applied - "
                f"Identifier: {identifier}, "
                f"Duration: {ban_seconds}s, "
                f"Violations: {violation_count}"
            )

        except Exception as e:
            logger.error(f"Error applying ban: {str(e)}")

    async def _check_ban_status(self, identifier: str) -> Tuple[bool, Optional[int]]:
        """Check if an identifier is banned"""
        try:
            ban_key = f"ws:ban:{identifier}"
            ban_data = await redis_client.get(ban_key)

            if ban_data:
                # Calculate remaining ban time
                banned_at = datetime.fromisoformat(ban_data["banned_at"])
                ban_duration = ban_data["ban_duration"]
                elapsed = (datetime.now() - banned_at).total_seconds()
                remaining = int(ban_duration - elapsed)

                if remaining > 0:
                    return True, remaining

            return False, None

        except Exception as e:
            logger.error(f"Error checking ban status: {str(e)}")
            return False, None

    async def _get_violation_count(self, identifier: str) -> int:
        """Get current violation count"""
        try:
            violation_key = f"ws:violations:{identifier}"
            count = await redis_client.get(violation_key)
            return int(count) if count else 0
        except Exception:
            return 0

    def get_metrics(self) -> Dict[str, Any]:
        """Get rate limiting metrics"""
        return {
            **self.metrics,
            "limits": {
                "max_connections_per_ip": self.MAX_CONNECTIONS_PER_IP,
                "max_connections_per_user": self.MAX_CONNECTIONS_PER_USER,
                "max_messages_per_connection": self.MAX_MESSAGES_PER_CONNECTION,
                "connection_window_minutes": self.CONNECTION_WINDOW_MINUTES,
                "message_window_seconds": self.MESSAGE_WINDOW_SECONDS,
            },
        }

    async def cleanup_expired_data(self):
        """Periodic cleanup of expired rate limit data"""
        try:
            # Clean up old violations
            pattern = "ws:violations:*"
            await self._cleanup_pattern(pattern, self.VIOLATION_EXPIRY_HOURS * 3600)

            # Clean up expired bans
            pattern = "ws:ban:*"
            await self._cleanup_pattern(pattern, 86400)  # 24 hours max

            # Clean up in-memory fallback storage
            async with self._fallback_lock:
                current_time = time.time()
                keys_to_delete = []

                for key, data in self._fallback_storage.items():
                    if "window_start" in data:
                        # Check if window has expired
                        window_seconds = 3600  # Default 1 hour
                        if key.startswith("ws:msg:"):
                            window_seconds = self.MESSAGE_WINDOW_SECONDS
                        elif key.startswith("ws:conn:"):
                            window_seconds = self.CONNECTION_WINDOW_MINUTES * 60

                        if current_time - data["window_start"] > window_seconds * 2:
                            keys_to_delete.append(key)

                for key in keys_to_delete:
                    del self._fallback_storage[key]

        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")

    async def _cleanup_pattern(self, pattern: str, max_age_seconds: int):
        """Clean up keys matching pattern older than max_age"""
        if not redis_client.redis:
            return

        try:
            # Use SCAN to avoid blocking
            cursor = 0
            while True:
                cursor, keys = await redis_client.redis.scan(
                    cursor, match=pattern, count=100
                )

                for key in keys:
                    # Check TTL
                    ttl = await redis_client.redis.ttl(key)
                    if ttl == -1:  # No expiry set
                        await redis_client.expire(key, max_age_seconds)

                if cursor == 0:
                    break

        except Exception as e:
            logger.error(f"Error in cleanup_pattern: {str(e)}")


# Global rate limiter instance
websocket_rate_limiter = WebSocketRateLimiter()


# Utility functions for easy integration
async def check_websocket_connection_allowed(
    ip_address: str, user_id: Optional[str] = None
) -> Tuple[bool, Optional[str], Optional[int]]:
    """Check if a WebSocket connection is allowed"""
    return await websocket_rate_limiter.check_connection_limit(ip_address, user_id)


async def check_websocket_message_allowed(
    connection_id: str, ip_address: str, user_id: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """Check if a WebSocket message is allowed"""
    return await websocket_rate_limiter.check_message_limit(
        connection_id, ip_address, user_id
    )


async def register_websocket_connection(ip_address: str, connection_id: str):
    """Register a new WebSocket connection"""
    await websocket_rate_limiter.register_connection(ip_address, connection_id)


async def unregister_websocket_connection(ip_address: str, connection_id: str):
    """Unregister a WebSocket connection"""
    await websocket_rate_limiter.unregister_connection(ip_address, connection_id)


def get_websocket_rate_limit_metrics() -> Dict[str, Any]:
    """Get WebSocket rate limiting metrics"""
    return websocket_rate_limiter.get_metrics()


# Background task for periodic cleanup
async def websocket_rate_limit_cleanup_task():
    """Background task to clean up expired rate limit data"""
    while True:
        try:
            await asyncio.sleep(3600)  # Run every hour
            await websocket_rate_limiter.cleanup_expired_data()
            logger.info("WebSocket rate limit cleanup completed")
        except Exception as e:
            logger.error(f"Error in rate limit cleanup task: {str(e)}")
