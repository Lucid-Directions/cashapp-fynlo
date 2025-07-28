"""Anomaly detection for security monitoring.

Implements statistical and ML-based anomaly detection for
identifying unusual patterns in user behavior and system usage.
"""

import math
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import statistics

from pydantic import BaseModel

from app.core.security_monitoring import SecurityEventType, ThreatLevel


class AnomalyType(str):
    """Types of anomalies to detect."""
    UNUSUAL_ACCESS_TIME = "unusual_access_time"
    ABNORMAL_DATA_VOLUME = "abnormal_data_volume"
    GEOGRAPHIC_ANOMALY = "geographic_anomaly"
    VELOCITY_ANOMALY = "velocity_anomaly"
    BEHAVIORAL_ANOMALY = "behavioral_anomaly"
    PRIVILEGE_ESCALATION = "privilege_escalation"


class UserBehaviorProfile(BaseModel):
    """User behavior profile for anomaly detection."""
    user_id: str
    typical_login_hours: List[int]  # Hours of day (0-23)
    typical_ip_locations: List[str]  # IP addresses or subnets
    average_daily_requests: float
    average_data_access: float  # Records per session
    typical_endpoints: List[str]
    last_updated: datetime


class AnomalyDetector:
    """Detects anomalous behavior patterns."""
    
    def __init__(self):
        """Initialize anomaly detector."""
        # User behavior profiles
        self.user_profiles: Dict[str, UserBehaviorProfile] = {}
        
        # Rolling statistics (last 30 days)
        self.request_rates = defaultdict(lambda: deque(maxlen=30))
        self.data_access_rates = defaultdict(lambda: deque(maxlen=30))
        self.login_times = defaultdict(lambda: deque(maxlen=100))
        
        # Anomaly thresholds
        self.thresholds = {
            "z_score": 3.0,  # Standard deviations from mean
            "velocity_multiplier": 10.0,  # Max increase in activity
            "time_window_hours": 1,  # Time window for velocity checks
            "min_data_points": 7  # Minimum data points for statistics
        }
    
    def update_user_profile(
        self,
        user_id: str,
        login_time: datetime,
        ip_address: str,
        request_count: int,
        data_accessed: int,
        endpoints_used: List[str]
    ):
        """Update user behavior profile with new activity."""
        # Record login time
        self.login_times[user_id].append(login_time.hour)
        
        # Record daily statistics
        today = datetime.utcnow().date()
        self.request_rates[f"{user_id}:{today}"].append(request_count)
        self.data_access_rates[f"{user_id}:{today}"].append(data_accessed)
        
        # Update or create profile
        if user_id not in self.user_profiles:
            self.user_profiles[user_id] = self._create_initial_profile(
                user_id, login_time, ip_address
            )
        else:
            self._update_existing_profile(
                user_id, login_time, ip_address, endpoints_used
            )
    
    def _create_initial_profile(
        self,
        user_id: str,
        login_time: datetime,
        ip_address: str
    ) -> UserBehaviorProfile:
        """Create initial user profile."""
        return UserBehaviorProfile(
            user_id=user_id,
            typical_login_hours=[login_time.hour],
            typical_ip_locations=[ip_address],
            average_daily_requests=0.0,
            average_data_access=0.0,
            typical_endpoints=[],
            last_updated=datetime.utcnow()
        )
    
    def _update_existing_profile(
        self,
        user_id: str,
        login_time: datetime,
        ip_address: str,
        endpoints_used: List[str]
    ):
        """Update existing user profile."""
        profile = self.user_profiles[user_id]
        
        # Update typical login hours (keep most common)
        if login_time.hour not in profile.typical_login_hours:
            hour_counts = defaultdict(int)
            for hour in self.login_times[user_id]:
                hour_counts[hour] += 1
            
            # Keep top 5 most common hours
            common_hours = sorted(
                hour_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )[:5]
            profile.typical_login_hours = [h[0] for h in common_hours]
        
        # Update IP locations
        if ip_address not in profile.typical_ip_locations:
            profile.typical_ip_locations.append(ip_address)
            # Keep last 10 IPs
            profile.typical_ip_locations = profile.typical_ip_locations[-10:]
        
        # Update endpoints
        for endpoint in endpoints_used:
            if endpoint not in profile.typical_endpoints:
                profile.typical_endpoints.append(endpoint)
        
        profile.last_updated = datetime.utcnow()
    
    def detect_anomalies(
        self,
        user_id: str,
        login_time: datetime,
        ip_address: str,
        request_count: int,
        data_accessed: int,
        endpoints_used: List[str],
        geo_location: Optional[str] = None
    ) -> List[Tuple[AnomalyType, ThreatLevel, str]]:
        """Detect anomalies in user behavior.
        
        Returns list of (anomaly_type, threat_level, description).
        """
        anomalies = []
        
        # Check if we have enough data for this user
        if user_id not in self.user_profiles:
            return anomalies
        
        profile = self.user_profiles[user_id]
        
        # 1. Unusual access time
        time_anomaly = self._check_time_anomaly(user_id, login_time, profile)
        if time_anomaly:
            anomalies.append(time_anomaly)
        
        # 2. Abnormal data volume
        volume_anomaly = self._check_volume_anomaly(user_id, data_accessed)
        if volume_anomaly:
            anomalies.append(volume_anomaly)
        
        # 3. Geographic anomaly
        if geo_location:
            geo_anomaly = self._check_geographic_anomaly(
                user_id, geo_location, profile
            )
            if geo_anomaly:
                anomalies.append(geo_anomaly)
        
        # 4. Velocity anomaly (rapid increase in activity)
        velocity_anomaly = self._check_velocity_anomaly(user_id, request_count)
        if velocity_anomaly:
            anomalies.append(velocity_anomaly)
        
        # 5. Behavioral anomaly (unusual endpoints)
        behavior_anomaly = self._check_behavioral_anomaly(
            user_id, endpoints_used, profile
        )
        if behavior_anomaly:
            anomalies.append(behavior_anomaly)
        
        return anomalies
    
    def _check_time_anomaly(
        self,
        user_id: str,
        login_time: datetime,
        profile: UserBehaviorProfile
    ) -> Optional[Tuple[AnomalyType, ThreatLevel, str]]:
        """Check for unusual access time."""
        current_hour = login_time.hour
        
        # If user typically logs in during business hours (9-18)
        business_hours = list(range(9, 19))
        typical_hours = profile.typical_login_hours
        
        if all(h in business_hours for h in typical_hours):
            # User typically works business hours
            if current_hour not in business_hours:
                if current_hour in [0, 1, 2, 3, 4, 5]:  # Late night
                    return (
                        AnomalyType.UNUSUAL_ACCESS_TIME,
                        ThreatLevel.HIGH,
                        f"Unusual late-night access at {current_hour}:00"
                    )
                else:
                    return (
                        AnomalyType.UNUSUAL_ACCESS_TIME,
                        ThreatLevel.MEDIUM,
                        f"Access outside typical hours at {current_hour}:00"
                    )
        
        return None
    
    def _check_volume_anomaly(
        self,
        user_id: str,
        data_accessed: int
    ) -> Optional[Tuple[AnomalyType, ThreatLevel, str]]:
        """Check for abnormal data access volume."""
        # Get historical data access
        historical_data = []
        for key in self.data_access_rates:
            if key.startswith(f"{user_id}:"):
                historical_data.extend(self.data_access_rates[key])
        
        if len(historical_data) < self.thresholds["min_data_points"]:
            return None
        
        # Calculate statistics
        mean = statistics.mean(historical_data)
        stdev = statistics.stdev(historical_data)
        
        if stdev == 0:
            return None
        
        # Calculate z-score
        z_score = abs((data_accessed - mean) / stdev)
        
        if z_score > self.thresholds["z_score"]:
            if data_accessed > mean * 10:  # 10x normal
                return (
                    AnomalyType.ABNORMAL_DATA_VOLUME,
                    ThreatLevel.HIGH,
                    f"Accessed {data_accessed} records (normal: {int(mean)})"
                )
            else:
                return (
                    AnomalyType.ABNORMAL_DATA_VOLUME,
                    ThreatLevel.MEDIUM,
                    f"Unusual data access volume: {data_accessed} records"
                )
        
        return None
    
    def _check_geographic_anomaly(
        self,
        user_id: str,
        geo_location: str,
        profile: UserBehaviorProfile
    ) -> Optional[Tuple[AnomalyType, ThreatLevel, str]]:
        """Check for geographic anomalies."""
        # Simple check - in production, use GeoIP database
        # Check if location is drastically different
        if geo_location not in ["UK", "GB", "United Kingdom"]:
            if all("UK" in loc or "GB" in loc for loc in profile.typical_ip_locations):
                return (
                    AnomalyType.GEOGRAPHIC_ANOMALY,
                    ThreatLevel.HIGH,
                    f"Access from unusual location: {geo_location}"
                )
        
        return None
    
    def _check_velocity_anomaly(
        self,
        user_id: str,
        request_count: int
    ) -> Optional[Tuple[AnomalyType, ThreatLevel, str]]:
        """Check for velocity anomalies (rapid activity increase)."""
        # Get recent request rates
        now = datetime.utcnow()
        recent_key = f"{user_id}:{now.date()}"
        
        if recent_key not in self.request_rates:
            return None
        
        recent_requests = list(self.request_rates[recent_key])
        if len(recent_requests) < 2:
            return None
        
        # Check for sudden spike
        recent_avg = statistics.mean(recent_requests[-5:]) if len(recent_requests) >= 5 else recent_requests[-1]
        
        if request_count > recent_avg * self.thresholds["velocity_multiplier"]:
            return (
                AnomalyType.VELOCITY_ANOMALY,
                ThreatLevel.HIGH,
                f"Sudden activity spike: {request_count} requests"
            )
        
        return None
    
    def _check_behavioral_anomaly(
        self,
        user_id: str,
        endpoints_used: List[str],
        profile: UserBehaviorProfile
    ) -> Optional[Tuple[AnomalyType, ThreatLevel, str]]:
        """Check for behavioral anomalies."""
        # Check for access to unusual endpoints
        unusual_endpoints = []
        sensitive_endpoints = [
            "/api/v1/platform",
            "/api/v1/users/bulk",
            "/api/v1/export",
            "/api/v1/admin"
        ]
        
        for endpoint in endpoints_used:
            # Check if accessing sensitive endpoints for first time
            if endpoint in sensitive_endpoints and endpoint not in profile.typical_endpoints:
                unusual_endpoints.append(endpoint)
        
        if unusual_endpoints:
            if any("platform" in ep or "admin" in ep for ep in unusual_endpoints):
                return (
                    AnomalyType.BEHAVIORAL_ANOMALY,
                    ThreatLevel.HIGH,
                    f"Access to sensitive endpoints: {', '.join(unusual_endpoints)}"
                )
            else:
                return (
                    AnomalyType.BEHAVIORAL_ANOMALY,
                    ThreatLevel.MEDIUM,
                    f"Unusual endpoint access: {', '.join(unusual_endpoints)}"
                )
        
        return None
    
    def calculate_risk_score(
        self,
        anomalies: List[Tuple[AnomalyType, ThreatLevel, str]]
    ) -> float:
        """Calculate overall risk score from anomalies.
        
        Returns score from 0.0 (no risk) to 1.0 (maximum risk).
        """
        if not anomalies:
            return 0.0
        
        # Weight by threat level
        weights = {
            ThreatLevel.LOW: 0.1,
            ThreatLevel.MEDIUM: 0.3,
            ThreatLevel.HIGH: 0.6,
            ThreatLevel.CRITICAL: 1.0
        }
        
        total_weight = sum(weights.get(a[1], 0) for a in anomalies)
        max_possible = len(anomalies) * weights[ThreatLevel.CRITICAL]
        
        return min(total_weight / max_possible, 1.0)


# Singleton instance
anomaly_detector = AnomalyDetector()