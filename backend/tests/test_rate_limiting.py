"""Tests for rate limiting and DDoS protection."""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import Request
from starlette.datastructures import Address
from starlette.middleware.base import BaseHTTPMiddleware

from app.middleware.rate_limiting import (
    DDoSProtection,
    IPWhitelist,
    RateLimitConfig,
    RateLimitMiddleware,
)


class TestRateLimitConfig:
    """Test rate limit configuration."""

    def test_default_config(self):
        """Test default rate limit configuration."""
        config = RateLimitConfig(requests=100, window=60)
        assert config.requests == 100
        assert config.window == 60
        assert config.burst == 100  # Defaults to requests
        assert config.key_func is not None

    def test_custom_config(self):
        """Test custom rate limit configuration."""

        def custom_key(request):
            return "custom_key"

        config = RateLimitConfig(
            requests=50, window=300, burst=10, key_func=custom_key
        )
        assert config.requests == 50
        assert config.window == 300
        assert config.burst == 10
        assert config.key_func == custom_key

    def test_default_key_function(self):
        """Test default key generation function."""
        config = RateLimitConfig(requests=100, window=60)

        # Mock request with client
        request = MagicMock()
        request.client = Address("192.168.1.1", 12345)
        assert config.key_func(request) == "rate_limit:192.168.1.1"

        # Mock request without client
        request.client = None
        assert config.key_func(request) == "rate_limit:unknown"


class TestIPWhitelist:
    """Test IP whitelist functionality."""

    def test_direct_ip_match(self):
        """Test direct IP matching."""
        whitelist = IPWhitelist(["192.168.1.1", "10.0.0.1"])
        assert whitelist.is_whitelisted("192.168.1.1")
        assert whitelist.is_whitelisted("10.0.0.1")
        assert not whitelist.is_whitelisted("192.168.1.2")

    def test_network_match(self):
        """Test CIDR network matching."""
        whitelist = IPWhitelist(["192.168.1.0/24", "10.0.0.0/8"])
        assert whitelist.is_whitelisted("192.168.1.100")
        assert whitelist.is_whitelisted("10.1.2.3")
        assert not whitelist.is_whitelisted("172.16.0.1")

    def test_mixed_whitelist(self):
        """Test mixed IP and network whitelist."""
        whitelist = IPWhitelist(["192.168.1.1", "10.0.0.0/16"])
        assert whitelist.is_whitelisted("192.168.1.1")
        assert whitelist.is_whitelisted("10.0.50.100")
        assert not whitelist.is_whitelisted("192.168.1.2")


class TestDDoSProtection:
    """Test DDoS protection mechanisms."""

    @pytest.mark.asyncio
    async def test_rapid_requests_detection(self):
        """Test detection of rapid requests from same IP."""
        ddos = DDoSProtection()
        redis_mock = AsyncMock()

        # Mock Redis responses for rapid requests
        redis_mock.incr.return_value = 51  # Over threshold
        redis_mock.expire = AsyncMock()
        redis_mock.exists.return_value = 0
        redis_mock.setex = AsyncMock()

        request = MagicMock()
        request.client = Address("192.168.1.1", 12345)
        request.url.path = "/api/v1/test"

        # Should detect attack
        is_attack = await ddos.is_attack_detected(request, redis_mock)
        assert is_attack

        # Should have blocked the IP
        redis_mock.setex.assert_called_once()
        call_args = redis_mock.setex.call_args[0]
        assert "ddos:blocked:192.168.1.1" in call_args[0]

    @pytest.mark.asyncio
    async def test_blocked_ip_check(self):
        """Test blocked IP detection."""
        ddos = DDoSProtection()
        redis_mock = AsyncMock()

        # Mock blocked IP
        redis_mock.exists.return_value = 1

        request = MagicMock()
        request.client = Address("192.168.1.1", 12345)

        # First check should show IP is blocked
        redis_mock.incr.return_value = 5  # Under threshold
        redis_mock.expire = AsyncMock()

        is_attack = await ddos.is_attack_detected(request, redis_mock)
        assert is_attack

    @pytest.mark.asyncio
    async def test_distributed_attack_detection(self):
        """Test distributed attack detection."""
        ddos = DDoSProtection()
        redis_mock = AsyncMock()

        # Mock distributed attack
        redis_mock.incr.side_effect = [
            10,
            201,
        ]  # First rapid check, then distributed
        redis_mock.expire = AsyncMock()
        redis_mock.exists.return_value = 0

        request = MagicMock()
        request.client = Address("192.168.1.1", 12345)
        request.url.path = "/api/v1/payments"

        # Should detect distributed attack
        is_attack = await ddos.is_attack_detected(request, redis_mock)
        assert is_attack


class TestRateLimitMiddleware:
    """Test rate limiting middleware."""

    def create_mock_request(
        self, path="/api/v1/test", ip="192.168.1.1", method="GET"
    ):
        """Create a mock request object."""
        request = MagicMock()
        request.url.path = path
        request.client = Address(ip, 12345) if ip else None
        request.method = method
        request.state = MagicMock()
        return request

    @pytest.mark.asyncio
    async def test_whitelisted_ip_bypass(self):
        """Test that whitelisted IPs bypass rate limiting."""
        app = MagicMock()
        middleware = RateLimitMiddleware(app)

        # Mock request from whitelisted IP
        request = self.create_mock_request(ip="127.0.0.1")

        # Mock call_next
        response = MagicMock()
        call_next = AsyncMock(return_value=response)

        # Should bypass rate limiting
        result = await middleware.dispatch(request, call_next)
        assert result == response
        call_next.assert_called_once_with(request)

    @pytest.mark.asyncio
    async def test_rate_limit_enforcement(self):
        """Test rate limit enforcement."""
        app = MagicMock()
        middleware = RateLimitMiddleware(app)

        # Mock Redis client
        redis_mock = AsyncMock()
        middleware.redis_client = redis_mock

        # Mock rate limit check - exceeded
        redis_mock.pipeline.return_value = redis_mock
        redis_mock.zremrangebyscore = AsyncMock()
        redis_mock.zcard = AsyncMock()
        redis_mock.zadd = AsyncMock()
        redis_mock.expire = AsyncMock()
        redis_mock.execute.return_value = [None, 101, None, None]  # Over limit
        redis_mock.zrange.return_value = [(b"1234567890", 1234567890)]

        request = self.create_mock_request(path="/api/v1/auth/login")

        # Should raise rate limit exception
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(request, AsyncMock())

        assert exc_info.value.status_code == 429
        assert "Rate limit exceeded" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_different_endpoint_limits(self):
        """Test different rate limits for different endpoints."""
        app = MagicMock()
        middleware = RateLimitMiddleware(app)

        # Check configured limits
        limits = middleware.rate_limits

        # Auth endpoints should have stricter limits
        assert limits["/api/v1/auth/login"].requests == 5
        assert limits["/api/v1/auth/login"].window == 300

        # Payment endpoints should have moderate limits
        assert limits["/api/v1/payments"].requests == 30
        assert limits["/api/v1/payments"].window == 60

        # General API should have standard limits
        assert limits["/api/v1"].requests == 100
        assert limits["/api/v1"].window == 60

        # Platform endpoints should have relaxed limits
        assert limits["/api/v1/platform"].requests == 200
        assert limits["/api/v1/platform"].window == 60

    @pytest.mark.asyncio
    async def test_rate_limit_headers(self):
        """Test rate limit headers in response."""
        app = MagicMock()
        middleware = RateLimitMiddleware(app)

        # Mock Redis client
        redis_mock = AsyncMock()
        middleware.redis_client = redis_mock

        # Mock rate limit check - within limit
        redis_mock.pipeline.return_value = redis_mock
        redis_mock.zremrangebyscore = AsyncMock()
        redis_mock.zcard = AsyncMock(return_value=50)
        redis_mock.zadd = AsyncMock()
        redis_mock.expire = AsyncMock()
        redis_mock.execute.return_value = [
            None,
            50,
            None,
            None,
        ]  # Within limit

        # Mock response
        response = MagicMock()
        response.headers = {}
        call_next = AsyncMock(return_value=response)

        request = self.create_mock_request(path="/api/v1/test")

        # Process request
        result = await middleware.dispatch(request, call_next)

        # Check headers were added
        assert "X-RateLimit-Limit" in result.headers
        assert "X-RateLimit-Remaining" in result.headers
        assert "X-RateLimit-Window" in result.headers

    def test_find_rate_limit(self):
        """Test finding appropriate rate limit for request."""
        app = MagicMock()
        middleware = RateLimitMiddleware(app)

        # Test exact match
        request = self.create_mock_request(path="/api/v1/auth/login")
        limit = middleware._find_rate_limit(request)
        assert limit.requests == 5

        # Test prefix match
        request = self.create_mock_request(path="/api/v1/payments/process")
        limit = middleware._find_rate_limit(request)
        assert limit.requests == 30

        # Test general API match
        request = self.create_mock_request(path="/api/v1/orders")
        limit = middleware._find_rate_limit(request)
        assert limit.requests == 100

        # Test no match
        request = self.create_mock_request(path="/health")
        limit = middleware._find_rate_limit(request)
        assert limit is None

    def test_platform_key_function(self):
        """Test platform-specific key generation."""
        app = MagicMock()
        middleware = RateLimitMiddleware(app)

        # Test with authenticated user
        request = self.create_mock_request()
        request.state.user_id = "user123"
        key = middleware._platform_key(request)
        assert key == "rate_limit:platform:user123"

        # Test without authenticated user
        request = self.create_mock_request(ip="192.168.1.1")
        request.state = MagicMock()
        key = middleware._platform_key(request)
        assert key == "rate_limit:platform:ip:192.168.1.1"


@pytest.mark.asyncio
async def test_integration_with_redis():
    """Integration test with actual Redis operations (requires Redis)."""
    # This test would require a real Redis connection
    # Skip if Redis is not available
    pytest.skip("Requires Redis connection")
