"""Rate Limiting and DDoS Protection Middleware.

Implements comprehensive rate limiting with Redis backend for distributed
systems.
"""

import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import redis.asyncio as redis
from fastapi import HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.status import HTTP_429_TOO_MANY_REQUESTS
from starlette.types import ASGIApp

from app.core.config import settings


class RateLimitConfig:
    """Configuration for rate limiting rules."""

    def __init__(
        self,
        requests: int,
        window: int,  # seconds
        burst: Optional[int] = None,
        key_func: Optional[callable] = None,
    ):
        """Initialize rate limit configuration."""
        self.requests = requests
        self.window = window
        self.burst = burst or requests
        self.key_func = key_func or self._default_key

    def _default_key(self, request: Request) -> str:
        """Default key function using IP address."""
        client_ip = request.client.host if request.client else "unknown"
        return f"rate_limit:{client_ip}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware with advanced DDoS protection."""

    def __init__(self, app: ASGIApp):
        """Initialize rate limiting middleware."""
        super().__init__(app)
        self.redis_client = None
        self.rate_limits = self._configure_rate_limits()
        self.ddos_protection = DDoSProtection()
        self.ip_whitelist = IPWhitelist(TRUSTED_IPS)

    def _configure_rate_limits(self) -> Dict[str, RateLimitConfig]:
        """Configure rate limits for different endpoints."""
        return {
            # Authentication endpoints - strict limits
            "/api/v1/auth/login": RateLimitConfig(
                requests=5,
                window=300,  # 5 requests per 5 minutes
                burst=3,
            ),
            "/api/v1/auth/register": RateLimitConfig(
                requests=3,
                window=3600,  # 3 requests per hour
                burst=1,
            ),
            "/api/v1/auth/password/reset": RateLimitConfig(
                requests=3,
                window=3600,  # 3 requests per hour
                burst=1,
            ),
            # Payment endpoints - moderate limits
            "/api/v1/payments": RateLimitConfig(
                requests=30,
                window=60,  # 30 requests per minute
                burst=10,
            ),
            # General API endpoints - standard limits
            "/api/v1": RateLimitConfig(
                requests=100,
                window=60,  # 100 requests per minute
                burst=20,
            ),
            # Platform admin endpoints - relaxed limits for platform owners
            "/api/v1/platform": RateLimitConfig(
                requests=200,
                window=60,  # 200 requests per minute
                burst=50,
                key_func=self._platform_key,
            ),
            # Public endpoints - strict limits
            "/api/v1/public": RateLimitConfig(
                requests=20,
                window=60,  # 20 requests per minute
                burst=5,
            ),
        }

    async def dispatch(self, request: Request, call_next):
        """Apply rate limiting to the request."""
        # Initialize Redis connection if not already done
        if not self.redis_client:
            self.redis_client = await redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )

        # Skip rate limiting for whitelisted IPs
        client_ip = request.client.host if request.client else None
        if client_ip and self.ip_whitelist.is_whitelisted(client_ip):
            return await call_next(request)

        # Check DDoS protection first
        if await self.ddos_protection.is_attack_detected(
            request, self.redis_client
        ):
            await self._log_rate_limit_exceeded(
                request, "DDoS attack detected"
            )
            raise HTTPException(
                status_code=HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": "3600"},  # 1 hour
            )

        # Find applicable rate limit
        rate_limit = self._find_rate_limit(request)
        if not rate_limit:
            # No rate limit configured, allow the request
            return await call_next(request)

        # Generate rate limit key
        key = rate_limit.key_func(request)

        # Check rate limit
        allowed, retry_after = await self._check_rate_limit(key, rate_limit)

        if not allowed:
            await self._log_rate_limit_exceeded(request, key)
            raise HTTPException(
                status_code=HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(rate_limit.requests),
                    "X-RateLimit-Window": str(rate_limit.window),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        await self._add_rate_limit_headers(response, key, rate_limit)

        return response

    def _find_rate_limit(self, request: Request) -> Optional[RateLimitConfig]:
        """Find the most specific rate limit for the request."""
        path = str(request.url.path)

        # Check exact match first
        if path in self.rate_limits:
            return self.rate_limits[path]

        # Check prefix match
        for prefix, config in sorted(
            self.rate_limits.items(), key=lambda x: len(x[0]), reverse=True
        ):
            if path.startswith(prefix):
                return config

        return None

    async def _check_rate_limit(
        self, key: str, config: RateLimitConfig
    ) -> Tuple[bool, int]:
        """Check if request is within rate limit using sliding window."""
        now = time.time()
        window_start = now - config.window

        # Use Redis pipeline for atomic operations
        pipe = self.redis_client.pipeline()

        # Remove old entries
        pipe.zremrangebyscore(key, 0, window_start)

        # Count current requests
        pipe.zcard(key)

        # Add current request
        pipe.zadd(key, {str(now): now})

        # Set expiry
        pipe.expire(key, config.window)

        # Execute pipeline
        results = await pipe.execute()
        current_requests = results[1]

        # Check if within limit
        if current_requests < config.requests:
            return True, 0

        # Calculate retry after
        oldest_request = await self.redis_client.zrange(
            key, 0, 0, withscores=True
        )
        if oldest_request:
            oldest_time = oldest_request[0][1]
            retry_after = int(oldest_time + config.window - now)
            return False, max(retry_after, 1)

        return False, config.window

    async def _add_rate_limit_headers(
        self, response: Response, key: str, config: RateLimitConfig
    ):
        """Add rate limit information headers to response."""
        current_requests = await self.redis_client.zcard(key)
        remaining = max(0, config.requests - current_requests)

        response.headers["X-RateLimit-Limit"] = str(config.requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Window"] = str(config.window)

        if remaining == 0:
            # Get oldest request to calculate reset time
            oldest_request = await self.redis_client.zrange(
                key, 0, 0, withscores=True
            )
            if oldest_request:
                oldest_time = oldest_request[0][1]
                reset_time = int(oldest_time + config.window)
                response.headers["X-RateLimit-Reset"] = str(reset_time)

    def _platform_key(self, request: Request) -> str:
        """Key function for platform endpoints (per user instead of IP)."""
        # Extract user from request if authenticated
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"rate_limit:platform:{user_id}"

        # Fall back to IP
        client_ip = request.client.host if request.client else "unknown"
        return f"rate_limit:platform:ip:{client_ip}"

    async def _log_rate_limit_exceeded(self, request: Request, key: str):
        """Log rate limit exceeded event."""
        # This would integrate with the audit logging system
        # For now, just print
        print(f"Rate limit exceeded: {key} - {request.url.path}")


class DDoSProtection:
    """Advanced DDoS protection mechanisms."""

    def __init__(self):
        """Initialize DDoS protection handler."""
        self.suspicious_patterns = [
            # Rapid requests from same IP
            {"pattern": "rapid_requests", "threshold": 50, "window": 10},
            # Distributed attack from multiple IPs
            {"pattern": "distributed_attack", "threshold": 200, "window": 60},
            # Slowloris attack detection
            {"pattern": "slow_requests", "threshold": 10, "window": 300},
        ]

    async def is_attack_detected(
        self, request: Request, redis_client: redis.Redis
    ) -> bool:
        """Check if current request is part of a DDoS attack."""
        client_ip = request.client.host if request.client else "unknown"

        # Check rapid requests from same IP
        rapid_key = f"ddos:rapid:{client_ip}"
        rapid_count = await redis_client.incr(rapid_key)
        await redis_client.expire(rapid_key, 10)

        if rapid_count > 50:  # More than 50 requests in 10 seconds
            await self._block_ip(
                client_ip, redis_client, reason="rapid_requests"
            )
            return True

        # Check if IP is blocked
        if await self._is_ip_blocked(client_ip, redis_client):
            return True

        # Check for distributed attack patterns
        endpoint = str(request.url.path)
        distributed_key = f"ddos:distributed:{endpoint}"
        distributed_count = await redis_client.incr(distributed_key)
        await redis_client.expire(distributed_key, 60)

        if (
            distributed_count > 200
        ):  # More than 200 requests to same endpoint in 60s
            # This might be a distributed attack
            await self._trigger_ddos_alert(endpoint, distributed_count)
            return True

        # Check for slow request patterns (potential Slowloris)
        if hasattr(request, "receive"):
            # Track request duration
            start_key = f"ddos:slow:start:{client_ip}:{id(request)}"
            await redis_client.set(start_key, time.time(), ex=300)

        return False

    async def _is_ip_blocked(self, ip: str, redis_client: redis.Redis) -> bool:
        """Check if IP is in blocklist."""
        block_key = f"ddos:blocked:{ip}"
        return await redis_client.exists(block_key) > 0

    async def _block_ip(
        self,
        ip: str,
        redis_client: redis.Redis,
        reason: str,
        duration: int = 3600,
    ):
        """Block an IP address for specified duration."""
        block_key = f"ddos:blocked:{ip}"
        block_data = {
            "reason": reason,
            "blocked_at": datetime.utcnow().isoformat(),
            "duration": duration,
        }
        await redis_client.setex(block_key, duration, json.dumps(block_data))

        # Log the blocking event
        print(f"Blocked IP {ip} for {reason}")

    async def _trigger_ddos_alert(self, endpoint: str, request_count: int):
        """Trigger alert for potential DDoS attack."""
        alert_message = f"""
        POTENTIAL DDoS ATTACK DETECTED
        Endpoint: {endpoint}
        Request Count: {request_count} in last 60 seconds
        Time: {datetime.utcnow().isoformat()}
        """

        # In production, this would:
        # 1. Send alerts to security team
        # 2. Trigger automated mitigation
        # 3. Log to SIEM
        # 4. Enable additional protections

        print(alert_message)


class IPWhitelist:
    """IP whitelist for trusted sources."""

    def __init__(self, whitelist: List[str]):
        self.whitelist = set(whitelist)
        self.whitelist_networks = self._parse_networks(whitelist)

    def _parse_networks(self, whitelist: List[str]) -> List[Tuple[str, int]]:
        """Parse CIDR notation networks."""
        networks = []
        for entry in whitelist:
            if "/" in entry:
                # CIDR notation
                ip, mask = entry.split("/")
                networks.append((ip, int(mask)))
        return networks

    def is_whitelisted(self, ip: str) -> bool:
        """Check if IP is whitelisted."""
        # Direct IP match
        if ip in self.whitelist:
            return True

        # Network match
        for network_ip, mask in self.whitelist_networks:
            if self._ip_in_network(ip, network_ip, mask):
                return True

        return False

    def _ip_in_network(self, ip: str, network: str, mask: int) -> bool:
        """Check if IP is in network range."""
        try:
            import ipaddress

            ip_obj = ipaddress.ip_address(ip)
            network_obj = ipaddress.ip_network(
                f"{network}/{mask}", strict=False
            )
            return ip_obj in network_obj
        except Exception:
            return False


# Configuration for trusted IPs (platform infrastructure)
TRUSTED_IPS = [
    "127.0.0.1",  # Localhost
    "10.0.0.0/8",  # Private network
    "172.16.0.0/12",  # Private network
    "192.168.0.0/16",  # Private network
    # Add your infrastructure IPs here
]
