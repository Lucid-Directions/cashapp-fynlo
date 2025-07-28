"""Tests for security monitoring and alerting system."""

import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import redis.asyncio as redis

from app.core.security_monitoring import (
    SecurityMonitor,
    SecurityEventType,
    ThreatLevel,
    SecurityAlert,
    log_security_event,
    check_ip_blocked
)
from app.core.anomaly_detection import (
    AnomalyDetector,
    AnomalyType,
    UserBehaviorProfile
)


class TestSecurityMonitor:
    """Test SecurityMonitor functionality."""
    
    @pytest.fixture
    async def monitor(self):
        """Create test security monitor."""
        monitor = SecurityMonitor()
        # Mock Redis client
        monitor.redis_client = AsyncMock()
        monitor.redis_client.lpush = AsyncMock()
        monitor.redis_client.zadd = AsyncMock()
        monitor.redis_client.sadd = AsyncMock()
        monitor.redis_client.setex = AsyncMock()
        monitor.redis_client.exists = AsyncMock(return_value=False)
        monitor.redis_client.smembers = AsyncMock(return_value=set())
        monitor.redis_client.zrevrange = AsyncMock(return_value=[])
        yield monitor
        # No cleanup needed for mock
    
    @pytest.mark.asyncio
    async def test_log_security_event(self, monitor):
        """Test logging security events."""
        await monitor.log_security_event(
            event_type=SecurityEventType.FAILED_LOGIN,
            source_ip="192.168.1.1",
            user_id="user123",
            details={"reason": "invalid_password"}
        )
        
        # Verify event was stored in Redis
        monitor.redis_client.lpush.assert_called_once()
        call_args = monitor.redis_client.lpush.call_args[0]
        assert call_args[0] == "security:events"
        
        # Verify event data
        event_data = json.loads(call_args[1])
        assert event_data["type"] == SecurityEventType.FAILED_LOGIN.value
        assert event_data["source_ip"] == "192.168.1.1"
        assert event_data["user_id"] == "user123"
        assert event_data["details"]["reason"] == "invalid_password"
    
    @pytest.mark.asyncio
    async def test_threat_pattern_detection(self, monitor):
        """Test threat pattern detection."""
        # Simulate multiple failed login attempts
        for i in range(6):  # Threshold is 5
            await monitor.log_security_event(
                event_type=SecurityEventType.FAILED_LOGIN,
                source_ip="192.168.1.1",
                user_id="user123"
            )
        
        # Verify alert was created
        assert monitor.redis_client.lpush.call_count >= 7  # 6 events + 1 alert
        
        # Check alert was queued
        alert_calls = [
            call for call in monitor.redis_client.lpush.call_args_list
            if call[0][0] == "security:alerts"
        ]
        assert len(alert_calls) == 1
        
        # Verify alert content
        alert_data = json.loads(alert_calls[0][0][1])
        alert = SecurityAlert(**alert_data)
        assert alert.event_type == SecurityEventType.FAILED_LOGIN
        assert alert.threat_level == ThreatLevel.MEDIUM
        assert alert.source_ip == "192.168.1.1"
        assert "Multiple failed login attempts" in alert.description
    
    @pytest.mark.asyncio
    async def test_auto_ip_blocking(self, monitor):
        """Test automatic IP blocking."""
        # Simulate brute force attack
        for i in range(11):  # Threshold is 10 for brute force
            await monitor.log_security_event(
                event_type=SecurityEventType.BRUTE_FORCE,
                source_ip="192.168.1.1"
            )
        
        # Verify IP was blocked
        monitor.redis_client.sadd.assert_called_with(
            "security:blocked_ips", "192.168.1.1"
        )
        monitor.redis_client.setex.assert_called_with(
            "security:ip_block:192.168.1.1",
            3600,
            "blocked"
        )
    
    @pytest.mark.asyncio
    async def test_critical_event_immediate_alert(self, monitor):
        """Test immediate alerts for critical events."""
        # SQL injection attempt - immediate alert
        await monitor.log_security_event(
            event_type=SecurityEventType.SQL_INJECTION_ATTEMPT,
            source_ip="192.168.1.1",
            details={"query": "SELECT * FROM users; DROP TABLE users;"}
        )
        
        # Verify immediate alert creation
        alert_calls = [
            call for call in monitor.redis_client.lpush.call_args_list
            if call[0][0] == "security:alerts"
        ]
        assert len(alert_calls) == 1
        
        alert_data = json.loads(alert_calls[0][0][1])
        alert = SecurityAlert(**alert_data)
        assert alert.threat_level == ThreatLevel.CRITICAL
        assert alert.auto_blocked is True
    
    @pytest.mark.asyncio
    async def test_get_security_metrics(self, monitor):
        """Test security metrics generation."""
        # Mock some data
        monitor.redis_client.zrevrange.return_value = [
            (json.dumps({
                "id": "alert1",
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": SecurityEventType.SQL_INJECTION_ATTEMPT.value,
                "threat_level": ThreatLevel.CRITICAL.value,
                "source_ip": "192.168.1.1",
                "description": "SQL injection detected",
                "details": {},
                "recommended_action": "Block IP",
                "auto_blocked": True
            }).encode(), 1234567890)
        ]
        monitor.redis_client.smembers.return_value = {b"192.168.1.1", b"10.0.0.1"}
        
        metrics = await monitor.get_security_metrics()
        
        assert metrics["overall_threat_level"] == ThreatLevel.MEDIUM
        assert metrics["active_alerts"] == 1
        assert metrics["blocked_ips"] == 2
        assert len(metrics["recent_alerts"]) == 1
        assert "timestamp" in metrics


class TestAnomalyDetector:
    """Test AnomalyDetector functionality."""
    
    @pytest.fixture
    def detector(self):
        """Create test anomaly detector."""
        return AnomalyDetector()
    
    def test_user_profile_creation(self, detector):
        """Test user profile creation."""
        detector.update_user_profile(
            user_id="user123",
            login_time=datetime(2024, 1, 1, 9, 0),  # 9 AM
            ip_address="192.168.1.1",
            request_count=100,
            data_accessed=50,
            endpoints_used=["/api/v1/orders", "/api/v1/products"]
        )
        
        assert "user123" in detector.user_profiles
        profile = detector.user_profiles["user123"]
        assert profile.typical_login_hours == [9]
        assert profile.typical_ip_locations == ["192.168.1.1"]
    
    def test_time_anomaly_detection(self, detector):
        """Test unusual access time detection."""
        # Create profile with business hours access
        for hour in range(9, 18):  # 9 AM to 6 PM
            detector.update_user_profile(
                user_id="user123",
                login_time=datetime(2024, 1, 1, hour, 0),
                ip_address="192.168.1.1",
                request_count=100,
                data_accessed=50,
                endpoints_used=[]
            )
        
        # Test late night access
        anomalies = detector.detect_anomalies(
            user_id="user123",
            login_time=datetime(2024, 1, 1, 2, 0),  # 2 AM
            ip_address="192.168.1.1",
            request_count=100,
            data_accessed=50,
            endpoints_used=[]
        )
        
        assert len(anomalies) == 1
        assert anomalies[0][0] == AnomalyType.UNUSUAL_ACCESS_TIME
        assert anomalies[0][1] == ThreatLevel.HIGH
        assert "late-night" in anomalies[0][2]
    
    def test_volume_anomaly_detection(self, detector):
        """Test abnormal data volume detection."""
        # Build history with normal data access
        for i in range(10):
            detector.update_user_profile(
                user_id="user123",
                login_time=datetime.utcnow(),
                ip_address="192.168.1.1",
                request_count=100,
                data_accessed=50,  # Normal: 50 records
                endpoints_used=[]
            )
            # Add to historical data
            detector.data_access_rates[f"user123:{datetime.utcnow().date()}"].append(50)
        
        # Test abnormal data access
        anomalies = detector.detect_anomalies(
            user_id="user123",
            login_time=datetime.utcnow(),
            ip_address="192.168.1.1",
            request_count=100,
            data_accessed=5000,  # 100x normal
            endpoints_used=[]
        )
        
        # Should detect volume anomaly
        volume_anomalies = [a for a in anomalies if a[0] == AnomalyType.ABNORMAL_DATA_VOLUME]
        assert len(volume_anomalies) > 0
        assert volume_anomalies[0][1] == ThreatLevel.HIGH
    
    def test_velocity_anomaly_detection(self, detector):
        """Test velocity anomaly detection."""
        # Normal activity
        detector.request_rates[f"user123:{datetime.utcnow().date()}"] = [10, 10, 10, 10, 10]
        
        detector.update_user_profile(
            user_id="user123",
            login_time=datetime.utcnow(),
            ip_address="192.168.1.1",
            request_count=10,
            data_accessed=50,
            endpoints_used=[]
        )
        
        # Sudden spike
        anomalies = detector.detect_anomalies(
            user_id="user123",
            login_time=datetime.utcnow(),
            ip_address="192.168.1.1",
            request_count=200,  # 20x normal
            data_accessed=50,
            endpoints_used=[]
        )
        
        velocity_anomalies = [a for a in anomalies if a[0] == AnomalyType.VELOCITY_ANOMALY]
        assert len(velocity_anomalies) > 0
        assert velocity_anomalies[0][1] == ThreatLevel.HIGH
    
    def test_behavioral_anomaly_detection(self, detector):
        """Test behavioral anomaly detection."""
        # Create profile with normal endpoints
        profile = UserBehaviorProfile(
            user_id="user123",
            typical_login_hours=[9, 10, 11],
            typical_ip_locations=["192.168.1.1"],
            average_daily_requests=100,
            average_data_access=50,
            typical_endpoints=["/api/v1/orders", "/api/v1/products"],
            last_updated=datetime.utcnow()
        )
        detector.user_profiles["user123"] = profile
        
        # Access to sensitive endpoints
        anomalies = detector.detect_anomalies(
            user_id="user123",
            login_time=datetime.utcnow(),
            ip_address="192.168.1.1",
            request_count=100,
            data_accessed=50,
            endpoints_used=[
                "/api/v1/orders",
                "/api/v1/platform/settings",  # Sensitive!
                "/api/v1/admin/users"  # Sensitive!
            ]
        )
        
        behavioral_anomalies = [a for a in anomalies if a[0] == AnomalyType.BEHAVIORAL_ANOMALY]
        assert len(behavioral_anomalies) > 0
        assert behavioral_anomalies[0][1] == ThreatLevel.HIGH
        assert "sensitive endpoints" in behavioral_anomalies[0][2]
    
    def test_risk_score_calculation(self, detector):
        """Test risk score calculation."""
        # No anomalies
        assert detector.calculate_risk_score([]) == 0.0
        
        # Single medium anomaly
        anomalies = [(AnomalyType.UNUSUAL_ACCESS_TIME, ThreatLevel.MEDIUM, "Test")]
        score = detector.calculate_risk_score(anomalies)
        assert 0.2 < score < 0.4
        
        # Multiple high anomalies
        anomalies = [
            (AnomalyType.VELOCITY_ANOMALY, ThreatLevel.HIGH, "Test"),
            (AnomalyType.BEHAVIORAL_ANOMALY, ThreatLevel.HIGH, "Test"),
            (AnomalyType.ABNORMAL_DATA_VOLUME, ThreatLevel.CRITICAL, "Test")
        ]
        score = detector.calculate_risk_score(anomalies)
        assert score > 0.7


@pytest.mark.asyncio
async def test_security_integration():
    """Test integration between security components."""
    with patch("app.core.security_monitoring.security_monitor") as mock_monitor:
        mock_monitor.log_security_event = AsyncMock()
        
        # Test helper function
        await log_security_event(
            SecurityEventType.FAILED_LOGIN,
            user_id="user123",
            details={"test": "data"}
        )
        
        mock_monitor.log_security_event.assert_called_once_with(
            event_type=SecurityEventType.FAILED_LOGIN,
            source_ip=None,
            user_id="user123",
            details={"test": "data"}
        )


@pytest.mark.asyncio
async def test_ip_blocking_check():
    """Test IP blocking check function."""
    with patch("app.core.security_monitoring.security_monitor") as mock_monitor:
        mock_monitor.redis_client = AsyncMock()
        mock_monitor.redis_client.exists = AsyncMock(return_value=True)
        
        # Test blocked IP
        is_blocked = await check_ip_blocked("192.168.1.1")
        assert is_blocked is True
        
        # Test non-blocked IP
        mock_monitor.redis_client.exists = AsyncMock(return_value=False)
        is_blocked = await check_ip_blocked("192.168.1.2")
        assert is_blocked is False