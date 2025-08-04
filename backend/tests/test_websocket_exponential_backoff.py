"""
Test suite for WebSocket exponential backoff and rate limiting
Tests rate limiting, connection history, and backoff behavior
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, List
from unittest.mock import Mock, patch, AsyncMock
import pytest

from app.core.websocket_rate_limiter import WebSocketRateLimiter
from app.core.redis_client import RedisClient


class ExponentialBackoffTracker:
    """
    Tracks connection attempts and calculates exponential backoff delays
    """
    
    def __init__(self, base_delay: float = 1.0, max_delay: float = 30.0, 
                 max_attempts: int = 10, jitter_factor: float = 0.3):
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.max_attempts = max_attempts
        self.jitter_factor = jitter_factor
        self.attempt_count = 0
        self.connection_history: List[Dict] = []
        
    def get_next_delay(self) -> float:
        """Calculate next delay with exponential backoff and jitter"""
        if self.attempt_count >= self.max_attempts:
            raise Exception(f"Maximum retry attempts ({self.max_attempts}) exceeded")
        
        # Exponential calculation
        exponential_delay = min(
            self.base_delay * (2 ** self.attempt_count),
            self.max_delay
        )
        
        # Apply jitter
        import random
        jitter = exponential_delay * self.jitter_factor
        random_jitter = (random.random() * 2 - 1) * jitter
        delay_with_jitter = exponential_delay + random_jitter
        
        # Ensure within bounds
        final_delay = max(self.base_delay, min(delay_with_jitter, self.max_delay))
        
        self.attempt_count += 1
        return round(final_delay, 3)
    
    def reset(self):
        """Reset attempt counter"""
        self.attempt_count = 0
        
    def record_attempt(self, ip: str, user_id: str = None, success: bool = False,
                      error: str = None):
        """Record connection attempt in history"""
        self.connection_history.append({
            'timestamp': datetime.now(),
            'ip': ip,
            'user_id': user_id,
            'attempt': self.attempt_count,
            'success': success,
            'error': error
        })
        
        # Keep only last 100 entries
        if len(self.connection_history) > 100:
            self.connection_history.pop(0)


class TestWebSocketExponentialBackoff:
    """Test exponential backoff implementation"""
    
    @pytest.fixture
    def backoff_tracker(self):
        return ExponentialBackoffTracker()
    
    @pytest.fixture
    def mock_redis(self):
        mock = AsyncMock(spec=RedisClient)
        mock.get = AsyncMock(return_value=None)
        mock.set = AsyncMock(return_value=True)
        mock.incr = AsyncMock(return_value=1)
        mock.expire = AsyncMock(return_value=True)
        mock.delete = AsyncMock(return_value=True)
        return mock
    
    @pytest.fixture
    def rate_limiter(self, mock_redis):
        return WebSocketRateLimiter(redis_client=mock_redis)
    
    def test_exponential_delay_calculation(self, backoff_tracker):
        """Test exponential delay follows correct pattern"""
        # Disable jitter for predictable testing
        backoff_tracker.jitter_factor = 0
        
        expected_delays = [1.0, 2.0, 4.0, 8.0, 16.0, 30.0, 30.0]  # Capped at 30
        
        for i, expected in enumerate(expected_delays):
            delay = backoff_tracker.get_next_delay()
            assert delay == expected, f"Attempt {i}: expected {expected}, got {delay}"
    
    def test_jitter_randomization(self, backoff_tracker):
        """Test jitter is applied within correct range"""
        delays = []
        
        # Collect multiple samples for first attempt
        for _ in range(100):
            tracker = ExponentialBackoffTracker()
            delay = tracker.get_next_delay()
            delays.append(delay)
        
        # All delays should be within [0.7, 1.3] (1.0 ± 30%)
        assert all(0.7 <= d <= 1.3 for d in delays)
        
        # Verify randomness - should have variety
        unique_delays = set(delays)
        assert len(unique_delays) > 10
    
    def test_max_attempts_enforcement(self, backoff_tracker):
        """Test that max attempts is enforced"""
        # Use up all attempts
        for _ in range(10):
            backoff_tracker.get_next_delay()
        
        # Next attempt should raise
        with pytest.raises(Exception) as exc_info:
            backoff_tracker.get_next_delay()
        
        assert "Maximum retry attempts (10) exceeded" in str(exc_info.value)
    
    def test_reset_functionality(self, backoff_tracker):
        """Test reset clears attempt counter"""
        # Make some attempts
        for _ in range(5):
            backoff_tracker.get_next_delay()
        
        assert backoff_tracker.attempt_count == 5
        
        # Reset
        backoff_tracker.reset()
        assert backoff_tracker.attempt_count == 0
        
        # Should be able to get delay again starting from base
        backoff_tracker.jitter_factor = 0  # Disable jitter
        delay = backoff_tracker.get_next_delay()
        assert delay == 1.0
    
    def test_connection_history_tracking(self, backoff_tracker):
        """Test connection history is properly tracked"""
        # Record some attempts
        backoff_tracker.record_attempt("192.168.1.1", "user123", success=True)
        backoff_tracker.record_attempt("192.168.1.2", "user456", success=False,
                                     error="Connection timeout")
        
        history = backoff_tracker.connection_history
        assert len(history) == 2
        assert history[0]['ip'] == "192.168.1.1"
        assert history[0]['success'] is True
        assert history[1]['error'] == "Connection timeout"
    
    def test_history_limit(self, backoff_tracker):
        """Test history is limited to 100 entries"""
        # Add 150 entries
        for i in range(150):
            backoff_tracker.record_attempt(f"192.168.1.{i % 255}", f"user{i}")
        
        assert len(backoff_tracker.connection_history) == 100
        # First entry should be from attempt 50
        assert backoff_tracker.connection_history[0]['user_id'] == "user50"


class TestWebSocketRateLimiting:
    """Test WebSocket rate limiting with exponential backoff"""
    
    @pytest.mark.asyncio
    async def test_connection_rate_limit_per_ip(self, rate_limiter):
        """Test IP-based connection rate limiting"""
        ip = "192.168.1.1"
        user_id = "user123"
        
        # Should allow initial connections
        for i in range(5):
            allowed = await rate_limiter.check_connection_limit(ip, user_id)
            assert allowed is True
        
        # Set up Redis mock to return high count
        rate_limiter.redis.get = AsyncMock(return_value="50")
        
        # Should deny when limit exceeded
        allowed = await rate_limiter.check_connection_limit(ip, user_id)
        assert allowed is False
    
    @pytest.mark.asyncio
    async def test_connection_rate_limit_per_user(self, rate_limiter):
        """Test user-based simultaneous connection limiting"""
        ip = "192.168.1.1"
        user_id = "user123"
        
        # Mock active connections
        rate_limiter.redis.smembers = AsyncMock(
            return_value={b"conn1", b"conn2", b"conn3", b"conn4", b"conn5"}
        )
        
        # Should deny when user has too many connections
        allowed = await rate_limiter.check_connection_limit(ip, user_id)
        assert allowed is False
    
    @pytest.mark.asyncio
    async def test_message_rate_limiting(self, rate_limiter):
        """Test message rate limiting per connection"""
        connection_id = "conn123"
        
        # Should allow initial messages
        for i in range(10):
            allowed = await rate_limiter.check_message_rate(
                connection_id, f"message{i}"
            )
            assert allowed is True
        
        # Mock high message count
        rate_limiter.redis.get = AsyncMock(return_value="60")
        
        # Should deny when rate exceeded
        allowed = await rate_limiter.check_message_rate(connection_id, "message")
        assert allowed is False
    
    @pytest.mark.asyncio
    async def test_penalty_system(self, rate_limiter):
        """Test violation penalty system"""
        ip = "192.168.1.1"
        
        # Record violations
        for i in range(5):
            await rate_limiter.record_violation(ip)
        
        # Check if IP is banned
        rate_limiter.redis.get = AsyncMock(return_value="5")
        is_banned = await rate_limiter.is_ip_banned(ip)
        assert is_banned is True
    
    @pytest.mark.asyncio
    async def test_backoff_delay_calculation(self, rate_limiter):
        """Test rate limiter suggests appropriate backoff delays"""
        ip = "192.168.1.1"
        
        # Mock violation count
        violation_counts = [0, 1, 2, 3, 4]
        expected_multipliers = [1, 2, 4, 8, 16]
        
        for violations, multiplier in zip(violation_counts, expected_multipliers):
            rate_limiter.redis.get = AsyncMock(
                side_effect=lambda key: str(violations) if "violations" in key else "0"
            )
            
            delay = await rate_limiter.get_backoff_delay(ip)
            # Base delay is 1000ms in rate limiter
            expected_delay = min(1000 * multiplier, 30000)
            
            # Allow for jitter
            assert expected_delay * 0.7 <= delay <= expected_delay * 1.3
    
    @pytest.mark.asyncio
    async def test_connection_cleanup(self, rate_limiter):
        """Test cleanup of stale connections"""
        user_id = "user123"
        connection_id = "conn123"
        
        # Register connection
        await rate_limiter.register_connection(user_id, connection_id)
        
        # Unregister connection
        await rate_limiter.unregister_connection(user_id, connection_id)
        
        # Verify cleanup
        rate_limiter.redis.srem.assert_called_with(
            f"ws:user_connections:{user_id}", connection_id
        )


class TestIntegrationScenarios:
    """Integration tests for WebSocket reconnection scenarios"""
    
    @pytest.mark.asyncio
    async def test_gradual_backoff_scenario(self, rate_limiter):
        """Test complete reconnection scenario with gradual backoff"""
        ip = "192.168.1.1"
        user_id = "user123"
        backoff = ExponentialBackoffTracker()
        
        # Simulate failed connection attempts
        for attempt in range(5):
            # Check if connection allowed
            allowed = await rate_limiter.check_connection_limit(ip, user_id)
            
            if not allowed:
                # Calculate backoff delay
                try:
                    delay = backoff.get_next_delay()
                    backoff.record_attempt(ip, user_id, success=False,
                                         error="Rate limited")
                    
                    # Simulate waiting
                    await asyncio.sleep(0.001)  # Mock sleep
                    
                except Exception as e:
                    # Max attempts reached
                    break
            else:
                # Connection successful
                backoff.record_attempt(ip, user_id, success=True)
                backoff.reset()
                break
        
        # Verify history
        history = backoff.connection_history
        assert len(history) > 0
        assert any(h['error'] == "Rate limited" for h in history if not h['success'])
    
    @pytest.mark.asyncio
    async def test_network_aware_reconnection(self, rate_limiter):
        """Test reconnection behavior based on network conditions"""
        ip = "192.168.1.1"
        user_id = "user123"
        
        # Simulate network states
        network_states = [
            ("online", True),
            ("offline", False),
            ("online", True),
            ("congested", True),  # Online but rate limited
        ]
        
        backoff = ExponentialBackoffTracker()
        
        for state, is_online in network_states:
            if not is_online:
                # Don't attempt connection when offline
                backoff.record_attempt(ip, user_id, success=False,
                                     error="Network offline")
                continue
            
            # Check rate limit
            if state == "congested":
                rate_limiter.redis.get = AsyncMock(return_value="100")
            else:
                rate_limiter.redis.get = AsyncMock(return_value="0")
            
            allowed = await rate_limiter.check_connection_limit(ip, user_id)
            
            if allowed:
                backoff.record_attempt(ip, user_id, success=True)
                backoff.reset()
            else:
                delay = backoff.get_next_delay()
                backoff.record_attempt(ip, user_id, success=False,
                                     error=f"Rate limited, retry in {delay}s")
        
        # Verify appropriate behavior
        history = backoff.connection_history
        offline_attempts = [h for h in history if h['error'] == "Network offline"]
        assert len(offline_attempts) == 1
        
        rate_limited = [h for h in history if "Rate limited" in h.get('error', '')]
        assert len(rate_limited) >= 1
    
    @pytest.mark.asyncio
    async def test_ui_status_reporting(self, rate_limiter):
        """Test status updates for UI display"""
        ip = "192.168.1.1"
        user_id = "user123"
        backoff = ExponentialBackoffTracker()
        
        status_updates = []
        
        async def update_ui_status(status: str, details: dict = None):
            status_updates.append({
                'status': status,
                'details': details,
                'timestamp': datetime.now()
            })
        
        # Simulate connection attempts with UI updates
        for attempt in range(3):
            await update_ui_status("connecting", {'attempt': attempt + 1})
            
            # Mock rate limit check
            allowed = attempt < 2  # Fail first 2 attempts
            
            if not allowed:
                delay = backoff.get_next_delay()
                await update_ui_status("reconnecting", {
                    'attempt': backoff.attempt_count,
                    'next_retry_in': delay,
                    'remaining_attempts': backoff.max_attempts - backoff.attempt_count
                })
            else:
                await update_ui_status("connected")
                break
        
        # Verify status updates
        assert len(status_updates) >= 3
        assert status_updates[0]['status'] == "connecting"
        assert any(s['status'] == "reconnecting" for s in status_updates)
        assert status_updates[-1]['status'] == "connected"
        
        # Check reconnecting details
        reconnecting_statuses = [s for s in status_updates 
                               if s['status'] == "reconnecting"]
        for status in reconnecting_statuses:
            assert 'attempt' in status['details']
            assert 'next_retry_in' in status['details']
            assert 'remaining_attempts' in status['details']


class TestEdgeCases:
    """Test edge cases and error scenarios"""
    
    def test_zero_base_delay(self):
        """Test handling of zero base delay"""
        backoff = ExponentialBackoffTracker(base_delay=0)
        delay = backoff.get_next_delay()
        assert delay == 0
    
    def test_very_large_delays(self):
        """Test handling of very large delay values"""
        backoff = ExponentialBackoffTracker(
            base_delay=1000000, 
            max_delay=5000000
        )
        delay = backoff.get_next_delay()
        assert 700000 <= delay <= 1300000  # With 30% jitter
    
    def test_single_attempt_limit(self):
        """Test behavior with single attempt limit"""
        backoff = ExponentialBackoffTracker(max_attempts=1)
        
        # First attempt should work
        delay = backoff.get_next_delay()
        assert delay > 0
        
        # Second attempt should fail
        with pytest.raises(Exception):
            backoff.get_next_delay()
    
    @pytest.mark.asyncio
    async def test_redis_failure_fallback(self, rate_limiter):
        """Test fallback behavior when Redis is unavailable"""
        # Make Redis fail
        rate_limiter.redis = None
        
        # Should still work with in-memory fallback
        ip = "192.168.1.1"
        user_id = "user123"
        
        allowed = await rate_limiter.check_connection_limit(ip, user_id)
        assert allowed is True
        
        # Test message rate limiting fallback
        allowed = await rate_limiter.check_message_rate("conn123", "message")
        assert allowed is True
    
    def test_concurrent_modifications(self):
        """Test thread safety of backoff tracker"""
        import threading
        
        backoff = ExponentialBackoffTracker()
        errors = []
        
        def attempt_connections():
            try:
                for _ in range(5):
                    backoff.get_next_delay()
                    backoff.record_attempt("127.0.0.1", "user1")
            except Exception as e:
                errors.append(e)
        
        # Start multiple threads
        threads = []
        for _ in range(10):
            t = threading.Thread(target=attempt_connections)
            threads.append(t)
            t.start()
        
        # Wait for completion
        for t in threads:
            t.join()
        
        # Should handle concurrent access gracefully
        assert backoff.attempt_count <= backoff.max_attempts
        assert len(backoff.connection_history) <= 100


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
