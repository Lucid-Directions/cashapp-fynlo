"""
Monitoring and Alerting Service for Payment System
Tracks metrics, health, and sends alerts for payment-related issues
"""TODO: Add docstring."""

import logging
import asyncio
import time
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import json
import httpx
from sqlalchemy.orm import Session

from app.core.database import Payment, Order, Restaurant
from app.services.payment_analytics import PaymentAnalyticsService
from app.services.volume_tracker import VolumeTracker
from app.services.config_manager import config_manager

logger = logging.getLogger(__name__)

class AlertSeverity(Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class MetricType(Enum):
    """Types of metrics to track"""
    PAYMENT_SUCCESS_RATE = "payment_success_rate"
    PAYMENT_VOLUME = "payment_volume"
    PROVIDER_HEALTH = "provider_health"
    COST_EFFICIENCY = "cost_efficiency"
    RESPONSE_TIME = "response_time"
    ERROR_RATE = "error_rate"

@dataclass
class Alert:
    """Alert data structure"""
    id: str
    type: str
    severity: AlertSeverity
    title: str
    description: str
    timestamp: datetime
    restaurant_id: Optional[str] = None
    provider: Optional[str] = None
    value: Optional[float] = None
    threshold: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Metric:
    """Metric data structure"""
    name: str
    type: MetricType
    value: float
    timestamp: datetime
    restaurant_id: Optional[str] = None
    provider: Optional[str] = None
    labels: Dict[str, str] = field(default_factory=dict)

class MonitoringService:
    """Service for monitoring payment system health and performance"""
    
    def __init__(self, db: Session):
        self.db = db
        self.analytics = PaymentAnalyticsService(db)
        self.volume_tracker = VolumeTracker(db)
        
        # Alert thresholds
        self.thresholds = {
            'payment_success_rate_min': 95.0,  # 95% minimum success rate
            'provider_health_min': 80.0,       # 80% minimum health score
            'response_time_max': 5000.0,       # 5 seconds max response time
            'cost_increase_max': 20.0,         # 20% cost increase threshold
            'volume_drop_max': 30.0,           # 30% volume drop threshold
            'error_rate_max': 5.0,             # 5% maximum error rate
        }
        
        # Alert destinations
        self.alert_webhooks = [
            config_manager.get_provider_config('monitoring').custom_settings.get('webhook_url')
            if config_manager.get_provider_config('monitoring') else None
        ]
        
        # Metrics storage (in production, use external time series DB)
        self.metrics_buffer: List[Metric] = []
        self.alerts_sent: Dict[str, datetime] = {}  # Track sent alerts to avoid spam
    
    async def check_system_health(self) -> Dict[str, Any]:
        """Perform comprehensive system health check"""
        health_status = {
            'overall_status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'checks': {},
            'alerts': []
        }
        
        try:
            # Check payment success rates
            success_rate_status = await self._check_payment_success_rates()
            health_status['checks']['payment_success_rate'] = success_rate_status
            
            # Check provider health
            provider_health_status = await self._check_provider_health()
            health_status['checks']['provider_health'] = provider_health_status
            
            # Check volume anomalies
            volume_status = await self._check_volume_anomalies()
            health_status['checks']['volume_tracking'] = volume_status
            
            # Check cost efficiency
            cost_status = await self._check_cost_efficiency()
            health_status['checks']['cost_efficiency'] = cost_status
            
            # Check response times
            response_time_status = await self._check_response_times()
            health_status['checks']['response_times'] = response_time_status
            
            # Determine overall status
            all_checks = [
                success_rate_status, provider_health_status, 
                volume_status, cost_status, response_time_status
            ]
            
            if any(check['status'] == 'critical' for check in all_checks):
                health_status['overall_status'] = 'critical'
            elif any(check['status'] == 'warning' for check in all_checks):
                health_status['overall_status'] = 'warning'
            
            # Collect alerts
            for check in all_checks:
                if 'alerts' in check:
                    health_status['alerts'].extend(check['alerts'])
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            health_status['overall_status'] = 'error'
            health_status['error'] = str(e)
        
        return health_status
    
    async def _check_payment_success_rates(self) -> Dict[str, Any]:
        """Check payment success rates across providers"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(hours=24)  # Last 24 hours
        
        try:
            performance_data = await self.analytics.get_provider_performance_summary(
                start_date=start_date,
                end_date=end_date
            )
            
            status = {
                'status': 'healthy',
                'metrics': {},
                'alerts': []
            }
            
            # Check each provider's success rate
            for provider, data in performance_data['provider_performance'].items():
                if data['transaction_count'] > 0:
                    # Calculate success rate (assuming completed = successful)
                    # In a real implementation, you'd track failed vs successful separately
                    success_rate = 100.0  # Placeholder - calculate from actual data
                    
                    status['metrics'][f'{provider}_success_rate'] = success_rate
                    
                    if success_rate < self.thresholds['payment_success_rate_min']:
                        alert = Alert(
                            id=f"success_rate_{provider}_{int(time.time())}",
                            type="success_rate_low",
                            severity=AlertSeverity.HIGH,
                            title=f"Low Success Rate: {provider}",
                            description=f"Success rate for {provider} is {success_rate:.1f}%, below threshold of {self.thresholds['payment_success_rate_min']}%",
                            timestamp=datetime.utcnow(),
                            provider=provider,
                            value=success_rate,
                            threshold=self.thresholds['payment_success_rate_min']
                        )
                        
                        status['alerts'].append(alert)
                        status['status'] = 'warning'
                        
                        await self._send_alert(alert)
            
            return status
            
        except Exception as e:
            logger.error(f"Success rate check failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def _check_provider_health(self) -> Dict[str, Any]:
        """Check provider health scores"""
        try:
            health_scores = await self.analytics.get_provider_health_scores()
            
            status = {
                'status': 'healthy',
                'metrics': {},
                'alerts': []
            }
            
            for provider, health_data in health_scores['health_scores'].items():
                overall_score = health_data['overall_score']
                status['metrics'][f'{provider}_health_score'] = overall_score
                
                if overall_score < self.thresholds['provider_health_min']:
                    severity = AlertSeverity.CRITICAL if overall_score < 60 else AlertSeverity.HIGH
                    
                    alert = Alert(
                        id=f"health_{provider}_{int(time.time())}",
                        type="provider_health_low",
                        severity=severity,
                        title=f"Provider Health Issue: {provider}",
                        description=f"Health score for {provider} is {overall_score:.1f}, below threshold of {self.thresholds['provider_health_min']}",
                        timestamp=datetime.utcnow(),
                        provider=provider,
                        value=overall_score,
                        threshold=self.thresholds['provider_health_min'],
                        metadata={'health_factors': health_data['factors']}
                    )
                    
                    status['alerts'].append(alert)
                    status['status'] = 'critical' if severity == AlertSeverity.CRITICAL else 'warning'
                    
                    await self._send_alert(alert)
            
            return status
            
        except Exception as e:
            logger.error(f"Provider health check failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def _check_volume_anomalies(self) -> Dict[str, Any]:
        """Check for volume anomalies and drops"""
        try:
            # Get volume data for multiple restaurants
            restaurants = self.db.query(Restaurant.id).limit(50).all()  # Check top 50 restaurants
            
            status = {
                'status': 'healthy',
                'metrics': {},
                'alerts': []
            }
            
            for restaurant in restaurants:
                restaurant_id = str(restaurant.id)
                
                # Get current and previous period volumes
                current_metrics = await self.volume_tracker.track_restaurant_volume(
                    restaurant_id, period_days=7
                )
                
                volume_alerts = await self.volume_tracker.check_volume_thresholds(
                    restaurant_id, current_metrics
                )
                
                # Check for significant volume drops
                if current_metrics.growth_rate < -self.thresholds['volume_drop_max']:
                    alert = Alert(
                        id=f"volume_drop_{restaurant_id}_{int(time.time())}",
                        type="volume_drop",
                        severity=AlertSeverity.MEDIUM,
                        title=f"Volume Drop Alert",
                        description=f"Restaurant {restaurant_id} volume dropped by {abs(current_metrics.growth_rate):.1f}%",
                        timestamp=datetime.utcnow(),
                        restaurant_id=restaurant_id,
                        value=current_metrics.growth_rate,
                        threshold=-self.thresholds['volume_drop_max']
                    )
                    
                    status['alerts'].append(alert)
                    status['status'] = 'warning'
                    
                    await self._send_alert(alert)
                
                # Convert volume alerts to monitoring alerts
                for vol_alert in volume_alerts:
                    if vol_alert.alert_type == 'threshold_exceeded':
                        alert = Alert(
                            id=f"volume_threshold_{restaurant_id}_{vol_alert.threshold_name}_{int(time.time())}",
                            type="volume_threshold",
                            severity=AlertSeverity.LOW,
                            title="Volume Threshold Reached",
                            description=vol_alert.recommendation,
                            timestamp=datetime.utcnow(),
                            restaurant_id=restaurant_id,
                            value=float(vol_alert.current_volume),
                            threshold=float(vol_alert.threshold_volume),
                            metadata={'threshold_name': vol_alert.threshold_name}
                        )
                        
                        status['alerts'].append(alert)
                        await self._send_alert(alert)
            
            return status
            
        except Exception as e:
            logger.error(f"Volume anomaly check failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def _check_cost_efficiency(self) -> Dict[str, Any]:
        """Check cost efficiency and potential savings"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=30)
            
            cost_report = await self.analytics.get_cost_optimization_report(
                start_date=start_date,
                end_date=end_date
            )
            
            status = {
                'status': 'healthy',
                'metrics': {
                    'savings_percentage': cost_report['savings_opportunity']['savings_percentage'],
                    'potential_savings': cost_report['savings_opportunity']['potential_savings']
                },
                'alerts': []
            }
            
            # Alert if significant savings are available
            if cost_report['savings_opportunity']['savings_percentage'] > self.thresholds['cost_increase_max']:
                alert = Alert(
                    id=f"cost_optimization_{int(time.time())}",
                    type="cost_optimization",
                    severity=AlertSeverity.MEDIUM,
                    title="Cost Optimization Opportunity",
                    description=f"Potential savings of {cost_report['savings_opportunity']['savings_percentage']:.1f}% (£{cost_report['savings_opportunity']['potential_savings']:.2f}) available",
                    timestamp=datetime.utcnow(),
                    value=cost_report['savings_opportunity']['savings_percentage'],
                    threshold=self.thresholds['cost_increase_max'],
                    metadata={
                        'recommendations': cost_report['recommendations']
                    }
                )
                
                status['alerts'].append(alert)
                await self._send_alert(alert)
            
            return status
            
        except Exception as e:
            logger.error(f"Cost efficiency check failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def _check_response_times(self) -> Dict[str, Any]:
        """Check API response times"""
        try:
            # In a real implementation, you'd track response times from your metrics system
            # For now, we'll return a placeholder
            
            status = {
                'status': 'healthy',
                'metrics': {
                    'avg_response_time': 1500.0,  # milliseconds
                    'p95_response_time': 3000.0,
                    'p99_response_time': 5000.0
                },
                'alerts': []
            }
            
            # Check if response times are too high
            avg_response_time = status['metrics']['avg_response_time']
            if avg_response_time > self.thresholds['response_time_max']:
                alert = Alert(
                    id=f"response_time_{int(time.time())}",
                    type="high_response_time",
                    severity=AlertSeverity.HIGH,
                    title="High Response Times",
                    description=f"Average response time is {avg_response_time:.0f}ms, above threshold of {self.thresholds['response_time_max']:.0f}ms",
                    timestamp=datetime.utcnow(),
                    value=avg_response_time,
                    threshold=self.thresholds['response_time_max']
                )
                
                status['alerts'].append(alert)
                status['status'] = 'warning'
                
                await self._send_alert(alert)
            
            return status
            
        except Exception as e:
            logger.error(f"Response time check failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def _send_alert(self, alert: Alert):
        """Send alert to configured destinations"""
        alert_key = f"{alert.type}_{alert.provider or 'system'}_{alert.restaurant_id or 'global'}"
        
        # Rate limiting: don't send same alert more than once per hour
        if alert_key in self.alerts_sent:
            last_sent = self.alerts_sent[alert_key]
            if datetime.utcnow() - last_sent < timedelta(hours=1):
                return
        
        self.alerts_sent[alert_key] = datetime.utcnow()
        
        # Prepare alert payload
        payload = {
            'alert_id': alert.id,
            'type': alert.type,
            'severity': alert.severity.value,
            'title': alert.title,
            'description': alert.description,
            'timestamp': alert.timestamp.isoformat(),
            'restaurant_id': alert.restaurant_id,
            'provider': alert.provider,
            'value': alert.value,
            'threshold': alert.threshold,
            'metadata': alert.metadata
        }
        
        # Send to webhook endpoints
        for webhook_url in self.alert_webhooks:
            if webhook_url:
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            webhook_url,
                            json=payload,
                            headers={'Content-Type': 'application/json'},
                            timeout=10.0
                        )
                        response.raise_for_status()
                        logger.info(f"Alert sent to webhook: {alert.id}")
                
                except Exception as e:
                    logger.error(f"Failed to send alert to webhook {webhook_url}: {e}")
        
        # Log alert
        logger.warning(f"ALERT [{alert.severity.value.upper()}] {alert.title}: {alert.description}")
    
    async def record_metric(self, metric: Metric):
        """Record a metric for monitoring"""
        self.metrics_buffer.append(metric)
        
        # In production, send to time series database
        logger.debug(f"Metric recorded: {metric.name}={metric.value} at {metric.timestamp}")
        
        # Flush buffer if it gets too large
        if len(self.metrics_buffer) > 1000:
            await self._flush_metrics()
    
    async def _flush_metrics(self):
        """Flush metrics buffer to storage"""
        if not self.metrics_buffer:
            return
        
        # In production, batch send to Prometheus, InfluxDB, etc.
        logger.info(f"Flushing {len(self.metrics_buffer)} metrics")
        self.metrics_buffer.clear()
    
    async def get_system_metrics(self, hours: int = 24) -> Dict[str, Any]:
        """Get system metrics for the specified time period"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(hours=hours)
            
            # Get payment metrics
            payment_performance = await self.analytics.get_provider_performance_summary(
                start_date=start_date,
                end_date=end_date
            )
            
            # Get volume trends
            volume_trends = await self.analytics.get_transaction_volume_trends(days=hours//24 or 1)
            
            # Get provider health
            provider_health = await self.analytics.get_provider_health_scores()
            
            return {
                'period': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat(),
                    'hours': hours
                },
                'payment_performance': payment_performance,
                'volume_trends': volume_trends,
                'provider_health': provider_health,
                'system_status': await self.check_system_health()
            }
            
        except Exception as e:
            logger.error(f"Failed to get system metrics: {e}")
            return {
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    async def update_thresholds(self, new_thresholds: Dict[str, float]):
        """Update monitoring thresholds"""
        for key, value in new_thresholds.items():
            if key in self.thresholds:
                old_value = self.thresholds[key]
                self.thresholds[key] = value
                logger.info(f"Updated threshold {key}: {old_value} -> {value}")
        
        # Save to configuration
        config_manager.providers.setdefault('monitoring', type('obj', (object,), {
            'custom_settings': {}
        })()).custom_settings.update({'thresholds': self.thresholds})

# Global monitoring service instance (initialized with database session)
_monitoring_service: Optional[MonitoringService] = None

def get_monitoring_service(db: Session) -> MonitoringService:
    """Get or create monitoring service instance"""
    global _monitoring_service
    if _monitoring_service is None:
        _monitoring_service = MonitoringService(db)
    return _monitoring_service