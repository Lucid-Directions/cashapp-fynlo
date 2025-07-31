"""
Automated replica count validation service.
Monitors instance counts and sends alerts for discrepancies.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Any
import httpx

from app.services.instance_tracker import InstanceTracker
from app.services.digitalocean_monitor import DigitalOceanMonitor
from app.core.config import settings
from app.core.redis_client import RedisClient

logger = logging.getLogger(__name__)


class ReplicaValidator:
    """
    Validates replica counts and sends alerts for discrepancies.
    
    Continuously monitors:
    - Active instance count from heartbeats
    - Configured replica count from DigitalOcean
    - Sends alerts when mismatches detected
    """
    
    def __init__(
        self, 
        tracker: InstanceTracker, 
        monitor: DigitalOceanMonitor,
        redis_client: RedisClient
    ):
        self.tracker = tracker
        self.monitor = monitor
        self.redis = redis_client
        self.check_interval = 300  # 5 minutes
        self.alert_threshold = 2  # Number of consecutive failures before alerting
        self.validation_task: Optional[asyncio.Task] = None
        self._running = False
        self._consecutive_failures = 0
        self._last_alert_time: Optional[datetime] = None
        self._alert_cooldown = 900  # 15 minutes between alerts
        
    async def start(self):
        """Start the validation loop."""
        if self._running:
            logger.warning("Replica validator already running")
            return
            
        self._running = True
        logger.info("Starting replica validator")
        
        # Start validation loop
        self.validation_task = asyncio.create_task(self._validation_loop())
        
    async def stop(self):
        """Stop the validation loop."""
        if not self._running:
            return
            
        self._running = False
        logger.info("Stopping replica validator")
        
        # Cancel validation task
        if self.validation_task:
            self.validation_task.cancel()
            try:
                await self.validation_task
            except asyncio.CancelledError:
                pass
    
    async def _validation_loop(self):
        """Continuously validate replica counts."""
        while self._running:
            try:
                await self.validate_replicas()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Validation error: {e}", exc_info=True)
                await asyncio.sleep(60)  # Shorter sleep on error
    
    async def validate_replicas(self) -> Dict[str, Any]:
        """
        Check and report replica discrepancies.
        
        Returns:
            Validation result with status and any issues found
        """
        try:
            # Get active instances from tracker
            instances = await self.tracker.get_active_instances()
            instance_counts = await self.tracker.get_instance_count()
            active_count = instance_counts["active"]
            
            # Get desired count from DO API
            do_status = await self.monitor.get_actual_replicas()
            
            if "error" in do_status:
                # If DO API fails, fall back to environment variable
                desired_count = settings.DESIRED_REPLICAS
                do_api_available = False
            else:
                desired_count = do_status.get("desired_replicas", settings.DESIRED_REPLICAS)
                do_api_available = True
            
            # Check for discrepancy
            discrepancy = active_count != desired_count
            
            validation_result = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "active_count": active_count,
                "desired_count": desired_count,
                "stale_count": instance_counts["stale"],
                "total_registered": instance_counts["total"],
                "discrepancy": discrepancy,
                "do_api_available": do_api_available,
                "instances": [
                    {
                        "id": inst.get("instance_id"),
                        "last_heartbeat": inst.get("last_heartbeat")
                    }
                    for inst in instances
                ]
            }
            
            # Store validation result in Redis for monitoring
            await self.redis.set(
                "replica_validation:latest",
                validation_result,
                expire=600  # 10 minutes
            )
            
            if discrepancy:
                self._consecutive_failures += 1
                logger.warning(
                    f"Replica count mismatch: Active={active_count}, Desired={desired_count} "
                    f"(failure {self._consecutive_failures}/{self.alert_threshold})"
                )
                
                # Send alert if threshold reached
                if self._consecutive_failures >= self.alert_threshold:
                    await self._send_alert({
                        "type": "replica_mismatch",
                        "active": active_count,
                        "desired": desired_count,
                        "stale": instance_counts["stale"],
                        "instances": instances,
                        "consecutive_failures": self._consecutive_failures
                    })
            else:
                # Reset failure counter on success
                if self._consecutive_failures > 0:
                    logger.info(f"Replica count recovered after {self._consecutive_failures} failures")
                self._consecutive_failures = 0
            
            # Check for stale instances
            if instance_counts["stale"] > 0:
                logger.warning(f"{instance_counts['stale']} stale instances detected")
                
                # Clean up stale instances
                await self.tracker.cleanup_stale_instances()
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Validation failed: {e}", exc_info=True)
            return {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e),
                "active_count": -1,
                "desired_count": -1
            }
    
    async def _send_alert(self, alert_data: Dict[str, Any]):
        """Send alert for replica discrepancy."""
        # Check cooldown
        now = datetime.now(timezone.utc)
        if self._last_alert_time:
            time_since_last = (now - self._last_alert_time).total_seconds()
            if time_since_last < self._alert_cooldown:
                logger.info(f"Alert cooldown active, skipping (last alert {time_since_last}s ago)")
                return
        
        alert_type = alert_data.get("type", "unknown")
        active = alert_data.get("active", 0)
        desired = alert_data.get("desired", 0)
        
        # Log critical alert
        logger.critical(
            f"REPLICA ALERT: {alert_type} - Active: {active}, Desired: {desired}"
        )
        
        # Store alert in Redis for monitoring dashboard
        alert_record = {
            "timestamp": now.isoformat(),
            "type": alert_type,
            "data": alert_data,
            "environment": settings.ENVIRONMENT
        }
        
        await self.redis.set(
            f"replica_alert:{now.timestamp()}",
            alert_record,
            expire=86400  # Keep alerts for 24 hours
        )
        
        # Send webhook notification if configured
        webhook_url = os.environ.get("REPLICA_ALERT_WEBHOOK")
        if webhook_url:
            await self._send_webhook_alert(webhook_url, alert_record)
        
        # Send email notification if configured
        if settings.RESEND_API_KEY and settings.ENVIRONMENT == "production":
            await self._send_email_alert(alert_record)
        
        # Update last alert time
        self._last_alert_time = now
    
    async def _send_webhook_alert(self, webhook_url: str, alert_data: Dict[str, Any]):
        """Send alert via webhook (Slack, Discord, etc)."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Format message based on webhook type
                if "slack" in webhook_url.lower():
                    payload = self._format_slack_alert(alert_data)
                elif "discord" in webhook_url.lower():
                    payload = self._format_discord_alert(alert_data)
                else:
                    # Generic webhook
                    payload = alert_data
                
                response = await client.post(webhook_url, json=payload)
                
                if response.status_code >= 400:
                    logger.error(f"Webhook alert failed: {response.status_code}")
                else:
                    logger.info("Webhook alert sent successfully")
                    
        except Exception as e:
            logger.error(f"Failed to send webhook alert: {e}")
    
    async def _send_email_alert(self, alert_data: Dict[str, Any]):
        """Send alert via email using Resend."""
        try:
            # Import here to avoid circular dependency
            from app.services.email_service import send_email
            
            alert_type = alert_data["type"]
            data = alert_data["data"]
            
            subject = f"[Fynlo Alert] Replica Count Mismatch - {settings.ENVIRONMENT}"
            
            html_content = f"""
            <h2>Replica Count Alert</h2>
            <p>A replica count discrepancy has been detected in the {settings.ENVIRONMENT} environment.</p>
            
            <h3>Details:</h3>
            <ul>
                <li><strong>Active Instances:</strong> {data.get('active', 'unknown')}</li>
                <li><strong>Desired Instances:</strong> {data.get('desired', 'unknown')}</li>
                <li><strong>Stale Instances:</strong> {data.get('stale', 0)}</li>
                <li><strong>Consecutive Failures:</strong> {data.get('consecutive_failures', 0)}</li>
            </ul>
            
            <h3>Recommended Actions:</h3>
            <ol>
                <li>Check the monitoring dashboard: <a href="{settings.BASE_URL}/api/v1/monitoring/replicas">View Status</a></li>
                <li>Review recent deployments in DigitalOcean</li>
                <li>Use 'doctl apps update' to force scale reset if needed</li>
            </ol>
            
            <p><small>Alert generated at: {alert_data['timestamp']}</small></p>
            """
            
            await send_email(
                to=settings.PLATFORM_OWNER_EMAIL,
                subject=subject,
                html=html_content
            )
            
            logger.info("Email alert sent successfully")
            
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
    
    def _format_slack_alert(self, alert_data: Dict[str, Any]) -> Dict[str, Any]:
        """Format alert for Slack webhook."""
        data = alert_data["data"]
        
        return {
            "text": f"🚨 Replica Count Alert - {settings.ENVIRONMENT}",
            "attachments": [{
                "color": "danger",
                "fields": [
                    {
                        "title": "Active Instances",
                        "value": str(data.get("active", "unknown")),
                        "short": True
                    },
                    {
                        "title": "Desired Instances",
                        "value": str(data.get("desired", "unknown")),
                        "short": True
                    },
                    {
                        "title": "Environment",
                        "value": settings.ENVIRONMENT,
                        "short": True
                    },
                    {
                        "title": "Consecutive Failures",
                        "value": str(data.get("consecutive_failures", 0)),
                        "short": True
                    }
                ],
                "footer": "Fynlo Monitoring",
                "ts": int(datetime.now().timestamp())
            }]
        }
    
    def _format_discord_alert(self, alert_data: Dict[str, Any]) -> Dict[str, Any]:
        """Format alert for Discord webhook."""
        data = alert_data["data"]
        
        return {
            "content": f"🚨 **Replica Count Alert** - {settings.ENVIRONMENT}",
            "embeds": [{
                "title": "Instance Mismatch Detected",
                "color": 15158332,  # Red
                "fields": [
                    {
                        "name": "Active Instances",
                        "value": str(data.get("active", "unknown")),
                        "inline": True
                    },
                    {
                        "name": "Desired Instances",
                        "value": str(data.get("desired", "unknown")),
                        "inline": True
                    },
                    {
                        "name": "Stale Instances",
                        "value": str(data.get("stale", 0)),
                        "inline": True
                    }
                ],
                "timestamp": alert_data["timestamp"]
            }]
        }


# Global validator instance
_replica_validator: Optional[ReplicaValidator] = None


async def init_replica_validator(
    tracker: InstanceTracker,
    monitor: DigitalOceanMonitor,
    redis_client: RedisClient
):
    """Initialize and start the replica validator."""
    global _replica_validator
    
    if settings.ENVIRONMENT == "development":
        logger.info("Skipping replica validator in development mode")
        return
    
    _replica_validator = ReplicaValidator(tracker, monitor, redis_client)
    await _replica_validator.start()
    logger.info("Replica validator initialized and started")


async def stop_replica_validator():
    """Stop the replica validator."""
    global _replica_validator
    if _replica_validator:
        await _replica_validator.stop()
        logger.info("Replica validator stopped")


import os  # Add this import at the top