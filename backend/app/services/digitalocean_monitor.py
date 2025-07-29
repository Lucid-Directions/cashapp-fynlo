"""
DigitalOcean App Platform monitoring service.
Provides direct API access to get accurate instance counts and deployment status.
"""

import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
import httpx
from functools import lru_cache

from app.core.config import settings

logger = logging.getLogger(__name__)


class DigitalOceanMonitor:
    """
    Monitor DigitalOcean App Platform instances and deployments.
    
    Uses the DigitalOcean API to get accurate information about:
    - Current app configuration
    - Deployment status
    - Actual vs desired replica counts
    """
    
    def __init__(self):
        self.api_token = os.environ.get("DO_API_TOKEN")
        self.app_id = os.environ.get("DO_APP_ID")
        self.base_url = "https://api.digitalocean.com/v2"
        self.timeout = httpx.Timeout(10.0)  # 10 second timeout
        self._cache_ttl = 60  # Cache API responses for 60 seconds
        self._last_cache_time: Optional[datetime] = None
        self._cached_app_info: Optional[Dict] = None
        
    def _is_configured(self) -> bool:
        """Check if DO monitoring is properly configured."""
        return bool(self.api_token and self.app_id)
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for DO API requests."""
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
    
    async def get_app_info(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Get current app configuration from DigitalOcean API.
        
        Args:
            force_refresh: Bypass cache and fetch fresh data
            
        Returns:
            App configuration including services and replica counts
        """
        if not self._is_configured():
            return {"error": "DigitalOcean API not configured"}
        
        # Check cache
        if not force_refresh and self._cached_app_info and self._last_cache_time:
            cache_age = (datetime.now(timezone.utc) - self._last_cache_time).total_seconds()
            if cache_age < self._cache_ttl:
                logger.debug(f"Returning cached app info (age: {cache_age}s)")
                return self._cached_app_info
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/apps/{self.app_id}",
                    headers=self._get_headers()
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self._cached_app_info = data
                    self._last_cache_time = datetime.now(timezone.utc)
                    return data
                else:
                    error_msg = f"DO API error: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    return {"error": error_msg}
                    
        except httpx.TimeoutException:
            logger.error("DigitalOcean API request timed out")
            return {"error": "API request timed out"}
        except Exception as e:
            logger.error(f"Error fetching app info: {e}")
            return {"error": str(e)}
    
    async def get_deployments(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent deployment history.
        
        Args:
            limit: Number of recent deployments to fetch
            
        Returns:
            List of deployment records
        """
        if not self._is_configured():
            return []
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/apps/{self.app_id}/deployments",
                    headers=self._get_headers(),
                    params={"per_page": limit}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("deployments", [])
                else:
                    logger.error(f"Failed to fetch deployments: {response.status_code}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching deployments: {e}")
            return []
    
    async def get_actual_replicas(self) -> Dict[str, Any]:
        """
        Get actual replica count and status for the backend service.
        
        Returns:
            Dictionary with replica information and status
        """
        app_info = await self.get_app_info()
        
        if "error" in app_info:
            return app_info
        
        app = app_info.get("app", {})
        
        # Find backend service in the app configuration
        backend_info = None
        for service in app.get("spec", {}).get("services", []):
            if service.get("name") == "backend":
                backend_info = service
                break
        
        if not backend_info:
            return {"error": "Backend service not found in app spec"}
        
        # Get deployment status
        deployment_id = app.get("active_deployment", {}).get("id")
        deployment_phase = app.get("active_deployment", {}).get("phase")
        
        # Extract replica information
        result = {
            "service_name": "backend",
            "desired_replicas": backend_info.get("instance_count", 0),
            "instance_size": backend_info.get("instance_size_slug", "unknown"),
            "deployment": {
                "id": deployment_id,
                "phase": deployment_phase,
                "updated_at": app.get("updated_at"),
                "created_at": app.get("created_at")
            },
            "status": {
                "phase": deployment_phase,
                "tier_slug": app.get("tier_slug"),
                "pending_deployment": app.get("pending_deployment") is not None
            },
            "region": app.get("region", {}).get("slug", "unknown"),
            "app_id": self.app_id,
            "app_name": app.get("spec", {}).get("name", "unknown")
        }
        
        # Check live URLs to see if they're responding
        if app.get("live_url"):
            result["live_url"] = app.get("live_url")
        
        return result
    
    async def get_deployment_logs(self, deployment_id: Optional[str] = None) -> List[str]:
        """
        Get logs for a specific deployment.
        
        Args:
            deployment_id: Specific deployment ID, or None for active deployment
            
        Returns:
            List of log lines
        """
        if not self._is_configured():
            return ["DigitalOcean API not configured"]
        
        # If no deployment ID provided, get the active one
        if not deployment_id:
            app_info = await self.get_app_info()
            deployment_id = app_info.get("app", {}).get("active_deployment", {}).get("id")
            
        if not deployment_id:
            return ["No active deployment found"]
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/apps/{self.app_id}/deployments/{deployment_id}/logs",
                    headers=self._get_headers(),
                    params={
                        "type": "BUILD",  # or "DEPLOY" or "RUN"
                        "follow": False
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("historic_urls", [])
                else:
                    return [f"Failed to fetch logs: {response.status_code}"]
                    
        except Exception as e:
            logger.error(f"Error fetching deployment logs: {e}")
            return [f"Error: {str(e)}"]
    
    async def force_deployment_refresh(self) -> Dict[str, Any]:
        """
        Trigger a new deployment to refresh metrics.
        
        WARNING: This will cause a brief downtime during deployment.
        Should only be used when absolutely necessary.
        
        Returns:
            Deployment response or error
        """
        if not self._is_configured():
            return {"error": "DigitalOcean API not configured"}
        
        if settings.ENVIRONMENT == "production":
            logger.warning("Attempting to force deployment refresh in production!")
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/apps/{self.app_id}/deployments",
                    headers=self._get_headers(),
                    json={
                        "force_rebuild": False  # Don't rebuild, just redeploy
                    }
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    logger.info(f"Deployment triggered: {data.get('deployment', {}).get('id')}")
                    return data
                else:
                    error_msg = f"Failed to trigger deployment: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    return {"error": error_msg}
                    
        except Exception as e:
            logger.error(f"Error triggering deployment: {e}")
            return {"error": str(e)}
    
    async def get_metrics_summary(self) -> Dict[str, Any]:
        """
        Get a summary of app metrics and status.
        
        Returns:
            Summary of current app state and metrics
        """
        # Get app info
        app_info = await self.get_app_info()
        if "error" in app_info:
            return {"error": app_info["error"], "configured": False}
        
        # Get actual replicas
        replica_info = await self.get_actual_replicas()
        
        # Get recent deployments
        deployments = await self.get_deployments(limit=5)
        
        # Build summary
        summary = {
            "configured": True,
            "app": {
                "id": self.app_id,
                "name": app_info.get("app", {}).get("spec", {}).get("name", "unknown"),
                "region": app_info.get("app", {}).get("region", {}).get("slug", "unknown"),
                "created_at": app_info.get("app", {}).get("created_at"),
                "updated_at": app_info.get("app", {}).get("updated_at")
            },
            "replicas": replica_info,
            "recent_deployments": [
                {
                    "id": d.get("id"),
                    "phase": d.get("phase"),
                    "created_at": d.get("created_at"),
                    "cause": d.get("cause")
                }
                for d in deployments[:3]  # Just show last 3
            ],
            "last_check": datetime.now(timezone.utc).isoformat()
        }
        
        return summary


# Global monitor instance
_do_monitor: Optional[DigitalOceanMonitor] = None


def get_do_monitor() -> DigitalOceanMonitor:
    """Get or create the global DigitalOcean monitor instance."""
    global _do_monitor
    if _do_monitor is None:
        _do_monitor = DigitalOceanMonitor()
    return _do_monitor