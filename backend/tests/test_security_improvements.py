"""
Test suite for security improvements:
- RLS session isolation
- WebSocket rate limiting
- Security monitoring
- 2FA for platform owners
"""

import pytest
import asyncio
import time
import json
import logging
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime

from app.core.websocket_rate_limiter import WebSocketRateLimiter
from app.core.security_monitor import SecurityMonitor, SecurityEventType
from app.core.two_factor_auth import TwoFactorAuth
from app.core.tenant_security import TenantSecurity
from app.models import User


class TestWebSocketRateLimiting:
    """Test WebSocket rate limiting functionality"""
    
    @pytest.fixture
    def rate_limiter(self):
        return WebSocketRateLimiter(redis_client=None)  # Use in-memory
    
    @pytest.mark.asyncio
    async def test_connection_rate_limit_per_ip(self, rate_limiter):
        """Test IP-based connection rate limiting"""
        ip_address = "192.168.1.100"
        
        # Should allow up to MAX_CONNECTIONS_PER_IP
        for i in range(rate_limiter.MAX_CONNECTIONS_PER_IP):
            allowed, error = await rate_limiter.check_connection_limit(ip_address)
            assert allowed is True, f"Connection {i+1} should be allowed"
        
        # Next connection should be denied
        allowed, error = await rate_limiter.check_connection_limit(ip_address)
        assert allowed is False
        assert "Too many connection attempts" in error
    
    @pytest.mark.asyncio
    async def test_user_connection_limit(self, rate_limiter):
        """Test per-user connection limit"""
        user_id = "user_123"
        ip_address = "192.168.1.100"
        
        # Register connections up to limit
        for i in range(rate_limiter.MAX_CONNECTIONS_PER_USER):
            conn_id = f"conn_{i}"
            await rate_limiter.register_connection(conn_id, user_id, ip_address)
        
        # Next connection should be denied
        allowed, error = await rate_limiter.check_connection_limit(ip_address, user_id)
        assert allowed is False
        assert "simultaneous connections allowed" in error
    
    @pytest.mark.asyncio
    async def test_message_rate_limit(self, rate_limiter):
        """Test message rate limiting per connection"""
        connection_id = "test_conn_1"
        
        # Should allow up to MAX_MESSAGES_PER_CONNECTION
        for i in range(rate_limiter.MAX_MESSAGES_PER_CONNECTION):
            allowed, error = await rate_limiter.check_message_rate(connection_id, 100)
            assert allowed is True, f"Message {i+1} should be allowed"
        
        # Next message should be denied
        allowed, error = await rate_limiter.check_message_rate(connection_id, 100)
        assert allowed is False
        assert "Message rate limit exceeded" in error
    
    @pytest.mark.asyncio
    async def test_message_size_limit(self, rate_limiter):
        """Test message size limiting"""
        connection_id = "test_conn_1"
        large_message_size = rate_limiter.MAX_MESSAGE_SIZE + 1
        
        allowed, error = await rate_limiter.check_message_rate(connection_id, large_message_size)
        assert allowed is False
        assert "Message too large" in error
    
    @pytest.mark.asyncio
    async def test_temporary_ban_after_violations(self, rate_limiter):
        """Test temporary IP ban after repeated violations"""
        ip_address = "192.168.1.101"
        
        # Fill up the connection limit
        for i in range(rate_limiter.MAX_CONNECTIONS_PER_IP):
            await rate_limiter.check_connection_limit(ip_address)
        
        # Trigger violations
        for i in range(rate_limiter.MAX_VIOLATIONS):
            await rate_limiter.check_connection_limit(ip_address)
        
        # IP should now be banned
        allowed, error = await rate_limiter.check_connection_limit(ip_address)
        assert allowed is False
        assert "Temporarily banned" in error
    
    @pytest.mark.asyncio
    async def test_rate_limit_window_reset(self, rate_limiter):
        """Test that rate limits reset after time window"""
        # Override window for faster testing
        rate_limiter.CONNECTION_WINDOW = 1  # 1 second
        ip_address = "192.168.1.102"
        
        # Use up the limit
        for i in range(rate_limiter.MAX_CONNECTIONS_PER_IP):
            await rate_limiter.check_connection_limit(ip_address)
        
        # Should be denied
        allowed, _ = await rate_limiter.check_connection_limit(ip_address)
        assert allowed is False
        
        # Wait for window to reset
        await asyncio.sleep(1.5)
        
        # Should be allowed again
        allowed, _ = await rate_limiter.check_connection_limit(ip_address)
        assert allowed is True


class TestSecurityMonitoring:
    """Test security monitoring and audit logging"""
    
    @pytest.fixture
    def security_monitor(self):
        return SecurityMonitor(redis_client=None)
    
    @pytest.fixture
    def mock_user(self):
        user = MagicMock(spec=User)
        user.id = "user_123"
        user.email = "test@restaurant.com"
        user.role = "manager"
        user.restaurant_id = "rest_123"
        return user
    
    @pytest.mark.asyncio
    async def test_log_access_denied(self, security_monitor, mock_user):
        """Test logging of access denial events"""
        with patch.object(security_monitor.security_logger, 'log') as mock_log:
            await security_monitor.log_access_attempt(
                user=mock_user,
                resource_type="order",
                resource_id="order_456",
                action="view",
                granted=False,
                ip_address="192.168.1.100",
                reason="Cross-tenant access attempt"
            )
            
            # Verify log was called
            mock_log.assert_called_once()
            args = mock_log.call_args
            assert args[0][0] == logging.WARNING  # Log level
            
            # Parse logged event
            import json
            event = json.loads(args[0][1])
            # The actual event type depends on the reason - it's ACCESS_DENIED with cross-tenant in the details
            assert event["event_type"] == SecurityEventType.ACCESS_DENIED.value
            assert event["severity"] == "WARNING"  # ACCESS_DENIED is WARNING
            assert event["user_email"] == "test@restaurant.com"
    
    @pytest.mark.asyncio
    async def test_log_platform_owner_access(self, security_monitor):
        """Test logging of platform owner access"""
        platform_owner = MagicMock(spec=User)
        platform_owner.id = "ryan_id"
        platform_owner.email = "ryan@fynlo.com"
        platform_owner.role = "platform_owner"
        
        with patch.object(security_monitor.security_logger, 'log') as mock_log:
            await security_monitor.log_platform_owner_access(
                user=platform_owner,
                target_restaurant_id="rest_789",
                action="view_orders",
                resource_type="orders"
            )
            
            # Verify appropriate logging
            mock_log.assert_called_once()
            event = json.loads(mock_log.call_args[0][1])
            assert event["event_type"] == SecurityEventType.PLATFORM_OWNER_ACCESS.value
            assert event["user_email"] == "ryan@fynlo.com"
    
    @pytest.mark.asyncio
    async def test_rate_limit_logging(self, security_monitor):
        """Test logging of rate limit violations"""
        with patch.object(security_monitor.security_logger, 'log') as mock_log:
            await security_monitor.log_rate_limit_violation(
                ip_address="192.168.1.100",
                user_id="user_123",
                limit_type="websocket_messages"
            )
            
            mock_log.assert_called_once()
            event = json.loads(mock_log.call_args[0][1])
            assert event["event_type"] == SecurityEventType.RATE_LIMIT_EXCEEDED.value


class TestTwoFactorAuth:
    """Test 2FA implementation for platform owners"""
    
    @pytest.fixture
    def two_fa(self):
        mock_redis = AsyncMock()
        return TwoFactorAuth(redis_client=mock_redis)
    
    @pytest.fixture
    def platform_owner(self):
        user = MagicMock(spec=User)
        user.id = "ryan_id"
        user.email = "ryan@fynlo.com"
        user.role = "platform_owner"
        return user
    
    @pytest.fixture
    def regular_user(self):
        user = MagicMock(spec=User)
        user.id = "user_123"
        user.email = "user@restaurant.com"
        user.role = "manager"
        return user
    
    def test_generate_secret(self, two_fa):
        """Test TOTP secret generation"""
        secret = two_fa.generate_secret()
        assert len(secret) == 32  # Base32 encoded
        assert secret.isalnum()
    
    def test_generate_backup_codes(self, two_fa):
        """Test backup code generation"""
        codes = two_fa.generate_backup_codes()
        assert len(codes) == 10
        for code in codes:
            assert "-" in code  # Format: XXXX-XXXX
            assert len(code) == 9
    
    @pytest.mark.asyncio
    async def test_2fa_setup_platform_owner_only(self, two_fa, platform_owner, regular_user):
        """Test that only platform owners can set up 2FA"""
        # Platform owner should succeed
        with patch.object(TenantSecurity, 'is_platform_owner', return_value=True):
            result = await two_fa.setup_2fa(platform_owner)
            assert "secret" in result
            assert "qr_code" in result
            assert "backup_codes" in result
        
        # Regular user should be denied
        with patch.object(TenantSecurity, 'is_platform_owner', return_value=False):
            with pytest.raises(Exception) as exc_info:
                await two_fa.setup_2fa(regular_user)
            # HTTPException has detail attribute, not str representation
            assert exc_info.value.status_code == 403
            assert "only required for platform owners" in exc_info.value.detail
    
    def test_verify_totp(self, two_fa):
        """Test TOTP token verification"""
        import pyotp
        
        secret = two_fa.generate_secret()
        totp = pyotp.TOTP(secret)
        
        # Valid token should pass
        valid_token = totp.now()
        assert two_fa.verify_totp(secret, valid_token) is True
        
        # Invalid token should fail
        assert two_fa.verify_totp(secret, "123456") is False
    
    @pytest.mark.asyncio
    async def test_verify_2fa_with_backup_code(self, two_fa, platform_owner):
        """Test 2FA verification with backup codes"""
        # Set up proper 2FA data with a valid secret
        secret = two_fa.generate_secret()  # Generate a real secret
        backup_codes = two_fa.generate_backup_codes()  # Generate real backup codes
        
        # Configure the mock Redis to return proper data
        two_fa.redis.get = AsyncMock(return_value={
            "enabled": True,
            "secret": secret,
            "backup_codes": ",".join(backup_codes)
        })
        
        # Configure Redis set to track calls
        two_fa.redis.set = AsyncMock()
        
        with patch.object(TenantSecurity, 'is_platform_owner', return_value=True):
            # Test with an invalid TOTP token (to force backup code usage)
            # Use the first backup code
            backup_code_to_use = backup_codes[0]
            valid, error = await two_fa.verify_2fa(platform_owner, backup_code_to_use)
            assert valid is True
            assert error is None
            
            # Verify that backup code was removed after use
            two_fa.redis.set.assert_called_once()
            # Get the updated data that was saved
            updated_data = two_fa.redis.set.call_args[0][1]
            
            # Verify the used backup code was removed
            remaining_codes = updated_data["backup_codes"].split(",")
            assert backup_code_to_use not in remaining_codes
            assert len(remaining_codes) == len(backup_codes) - 1


class TestIntegratedSecurity:
    """Test integrated security features working together"""
    
    @pytest.mark.asyncio
    async def test_platform_owner_full_flow(self):
        """Test complete security flow for platform owners"""
        # Create instances
        rate_limiter = WebSocketRateLimiter(redis_client=None)
        monitor = SecurityMonitor(redis_client=None)
        two_fa = TwoFactorAuth(redis_client=AsyncMock())
        
        # Create platform owner
        platform_owner = MagicMock(spec=User)
        platform_owner.id = "ryan_id"
        platform_owner.email = "ryan@fynlo.com"
        platform_owner.role = "platform_owner"
        
        # Test 1: Platform owner setup 2FA
        with patch.object(TenantSecurity, 'is_platform_owner', return_value=True):
            setup_result = await two_fa.setup_2fa(platform_owner)
            assert "secret" in setup_result
            assert "qr_code" in setup_result
            assert len(setup_result["backup_codes"]) == 10
        
        # Test 2: Platform owner WebSocket connection with rate limiting
        ip_address = "192.168.1.200"
        conn_id = "platform_conn_1"
        
        # Should allow connection
        allowed, error = await rate_limiter.check_connection_limit(ip_address, str(platform_owner.id))
        assert allowed is True
        
        # Register connection
        await rate_limiter.register_connection(conn_id, str(platform_owner.id), ip_address)
        
        # Test 3: Platform owner access logging
        with patch.object(monitor.security_logger, 'log') as mock_log:
            await monitor.log_platform_owner_access(
                user=platform_owner,
                target_restaurant_id="rest_123",
                action="view_all_orders",
                resource_type="orders"
            )
            mock_log.assert_called_once()
        
        # Test 4: Message rate limiting for platform owner
        for i in range(5):
            allowed, error = await rate_limiter.check_message_rate(conn_id, 100)
            assert allowed is True
    
    @pytest.mark.asyncio
    async def test_regular_user_restrictions(self):
        """Test that regular users are properly restricted"""
        # Create instances
        rate_limiter = WebSocketRateLimiter(redis_client=None)
        monitor = SecurityMonitor(redis_client=None)
        two_fa = TwoFactorAuth(redis_client=AsyncMock())
        
        # Create regular user
        regular_user = MagicMock(spec=User)
        regular_user.id = "user_456"
        regular_user.email = "manager@restaurant.com"
        regular_user.role = "manager"
        regular_user.restaurant_id = "rest_456"
        
        # Test 1: Regular user cannot setup 2FA
        with patch.object(TenantSecurity, 'is_platform_owner', return_value=False):
            with pytest.raises(Exception) as exc_info:
                await two_fa.setup_2fa(regular_user)
            assert exc_info.value.status_code == 403
        
        # Test 2: Cross-tenant access attempt is logged
        with patch.object(monitor.security_logger, 'log') as mock_log:
            await monitor.log_access_attempt(
                user=regular_user,
                resource_type="order",
                resource_id="order_789",
                action="view",
                granted=False,
                ip_address="192.168.1.100",
                reason="Cross-tenant access attempt from restaurant rest_456 to rest_789"
            )
            
            # Verify it was logged as CROSS_TENANT_ATTEMPT (because reason contains "restaurant")
            mock_log.assert_called_once()
            event = json.loads(mock_log.call_args[0][1])
            assert event["event_type"] == SecurityEventType.CROSS_TENANT_ATTEMPT.value
            assert event["severity"] == "ERROR"  # Cross-tenant attempts are ERROR severity
        
        # Test 3: Rate limits apply to regular users
        ip_address = "192.168.1.101"
        
        # Fill up connection limit
        for i in range(rate_limiter.MAX_CONNECTIONS_PER_USER):
            conn_id = f"user_conn_{i}"
            await rate_limiter.register_connection(conn_id, str(regular_user.id), ip_address)
        
        # Next connection should be denied
        allowed, error = await rate_limiter.check_connection_limit(ip_address, str(regular_user.id))
        assert allowed is False
        assert "simultaneous connections allowed" in error
        
        # Test 4: No 2FA required for regular users
        with patch.object(TenantSecurity, 'is_platform_owner', return_value=False):
            # Regular users bypass 2FA verification
            valid, error = await two_fa.verify_2fa(regular_user, "any_token")
            assert valid is True  # Always passes for non-platform owners


