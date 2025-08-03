"""
DigitalOcean App Platform monitoring service.
Provides direct API access to get accurate instance counts and deployment status.
Enhanced with security best practices and resilience patterns.
"""

import os
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone
import httpx
from pybreaker import CircuitBreaker, CircuitBreakerError

from app.core.config import settings
from app.core.security import TokenEncryption, InputValidator

logger = logging.getLogger(__name__)

# Circuit breaker for DigitalOcean API calls
do_circuit_breaker = CircuitBreaker(
    fail_max=5,
    reset_timeout=60,
    exclude=[httpx.HTTPStatusError],  # Don't trip on 4xx errors
    name="DigitalOceanAPI",
)


class DigitalOceanMonitorError(Exception):
    """Base exception for DigitalOcean monitoring errors."""

    pass


class DigitalOceanAPIError(DigitalOceanMonitorError):
    """Raised when DigitalOcean API returns an error."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        super().__init__(f"DO API error {status_code}: {message}")


class DigitalOceanConfigError(DigitalOceanMonitorError):
    """Raised when DigitalOcean monitoring is not properly configured."""

    pass


class DigitalOceanMonitor:
    """
    Monitor DigitalOcean App Platform instances and deployments.

    Uses the DigitalOcean API to get accurate information about:
    - Current app configuration
    - Deployment status
    - Actual vs desired replica counts

    Enhanced with:
    - Secure token storage
    - Circuit breaker pattern
    - Input validation
    - Proper error handling
    """

    def __init__(self):
        # Load and decrypt API token securely
        self._api_token = self._load_api_token()
        self.app_id = self._load_app_id()
        self.base_url = "https://api.digitalocean.com/v2"

        # Configure timeouts based on environment
        timeout_seconds = 30.0 if settings.ENVIRONMENT == "production" else 10.0
        self.timeout = httpx.Timeout(timeout_seconds)

        # Cache configuration
        self._cache_ttl = 60 if settings.ENVIRONMENT == "production" else 30
        self._cache: Dict[str, Tuple[Any, datetime]] = {}

        # HTTP client pool for connection reuse
        self._client: Optional[httpx.AsyncClient] = None

    def _load_api_token(self) -> Optional[str]:
        """Load and decrypt the DigitalOcean API token."""
        encrypted_token = os.environ.get("DO_API_TOKEN_ENCRYPTED")
        if encrypted_token:
            try:
                token_encryption = TokenEncryption()
                return token_encryption.decrypt_token(encrypted_token)
            except Exception as e:
                logger.error(f"Failed to decrypt DO API token: {type(e).__name__}")
                return None

        # No fallback to plain token - must use encrypted token
        logger.error(
            "DO_API_TOKEN_ENCRYPTED not configured - token encryption is required"
        )
        return None

    def _load_app_id(self) -> Optional[str]:
        """Load and validate the DigitalOcean app ID."""
        app_id = os.environ.get("DO_APP_ID")
        if app_id:
            try:
                # Validate app ID format (alphanumeric with hyphens)
                if not InputValidator.validate_instance_id(app_id):
                    raise ValueError("Invalid app ID format")
                return app_id
            except ValueError as e:
                logger.error(f"Invalid DO_APP_ID format: {e}")
        return None

    def _is_configured(self) -> bool:
        """Check if DO monitoring is properly configured."""
        return bool(self._api_token and self.app_id)

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for DO API requests."""
        if not self._api_token:
            raise DigitalOceanConfigError("API token not configured")

        return {
            "Authorization": f"Bearer {self._api_token}",
            "Content-Type": "application/json",
            "User-Agent": f"Fynlo-Monitoring/{settings.APP_VERSION}",
        }

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with connection pooling."""
        if not self._client:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                limits=httpx.Limits(
                    max_keepalive_connections=5,
                    max_connections=10,
                    keepalive_expiry=30.0,
                ),
                headers=self._get_headers(),
            )
        return self._client

    def _get_from_cache(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        if key in self._cache:
            value, timestamp = self._cache[key]
            age_seconds = (datetime.now(timezone.utc) - timestamp).total_seconds()
            if age_seconds < self._cache_ttl:
                logger.debug(f"Cache hit for {key} (age: {age_seconds:.1f}s)")
                return value
        return None

    def _set_cache(self, key: str, value: Any):
        """Store value in cache with timestamp."""
        self._cache[key] = (value, datetime.now(timezone.utc))

    def _clear_cache(self):
        """Clear all cached data."""
        self._cache.clear()

    @do_circuit_breaker
    async def get_app_info(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Get current app configuration from DigitalOcean API.

        Args:
            force_refresh: Bypass cache and fetch fresh data

        Returns:
            App configuration including services and replica counts

        Raises:
            DigitalOceanConfigError: If not properly configured
            DigitalOceanAPIError: If API request fails
        """
        if not self._is_configured():
            raise DigitalOceanConfigError("DigitalOcean API not configured")

        # Check cache unless force refresh
        cache_key = f"app_info_{self.app_id}"
        if not force_refresh:
            cached = self._get_from_cache(cache_key)
            if cached:
                return cached

        try:
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/apps/{self.app_id}")

            if response.status_code == 200:
                data = response.json()
                # Validate response structure
                if "app" not in data:
                    raise DigitalOceanAPIError(200, "Invalid response structure")

                self._set_cache(cache_key, data)
                return data
            elif response.status_code == 404:
                raise DigitalOceanAPIError(404, f"App {self.app_id} not found")
            else:
                error_msg = response.json().get("message", response.text)
                raise DigitalOceanAPIError(response.status_code, error_msg)

        except httpx.TimeoutException:
            logger.error("DigitalOcean API request timed out")
            raise DigitalOceanAPIError(0, "Request timed out")
        except httpx.RequestError as e:
            logger.error(f"Request error: {type(e).__name__}: {e}")
            raise DigitalOceanAPIError(0, f"Request failed: {type(e).__name__}")
        except CircuitBreakerError:
            logger.warning("Circuit breaker is open for DigitalOcean API")
            raise DigitalOceanAPIError(0, "Service temporarily unavailable")

    @do_circuit_breaker
    async def get_deployments(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent deployment history.

        Args:
            limit: Number of recent deployments to fetch (max 200)

        Returns:
            List of deployment records

        Raises:
            DigitalOceanConfigError: If not properly configured
            DigitalOceanAPIError: If API request fails
        """
        if not self._is_configured():
            raise DigitalOceanConfigError("DigitalOcean API not configured")

        # Validate limit
        limit = min(max(1, limit), 200)

        cache_key = f"deployments_{self.app_id}_{limit}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        try:
            client = await self._get_client()
            response = await client.get(
                f"{self.base_url}/apps/{self.app_id}/deployments",
                params={"per_page": limit},
            )

            if response.status_code == 200:
                data = response.json()
                deployments = data.get("deployments", [])
                self._set_cache(cache_key, deployments)
                return deployments
            else:
                logger.error(f"Failed to fetch deployments: {response.status_code}")
                return []

        except Exception as e:
            logger.error(f"Error fetching deployments: {type(e).__name__}: {e}")
            return []

    async def get_actual_replicas(self) -> Dict[str, Any]:
        """
        Get actual replica count and status for the backend service.

        Returns:
            Dictionary with replica information and status

        Raises:
            DigitalOceanConfigError: If not properly configured
            DigitalOceanAPIError: If API request fails
        """
        try:
            app_info = await self.get_app_info()
        except DigitalOceanMonitorError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting app info: {type(e).__name__}: {e}")
            raise DigitalOceanAPIError(0, f"Unexpected error: {type(e).__name__}")

        app = app_info.get("app", {})

        # Find backend service in the app configuration
        backend_info = None
        for service in app.get("spec", {}).get("services", []):
            if service.get("name") == "backend":
                backend_info = service
                break

        if not backend_info:
            raise DigitalOceanAPIError(404, "Backend service not found in app spec")

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
                "created_at": app.get("created_at"),
            },
            "status": {
                "phase": deployment_phase,
                "tier_slug": app.get("tier_slug"),
                "pending_deployment": app.get("pending_deployment") is not None,
            },
            "region": app.get("region", {}).get("slug", "unknown"),
            "app_id": self.app_id,
            "app_name": app.get("spec", {}).get("name", "unknown"),
        }

        # Check live URLs to see if they're responding
        if app.get("live_url"):
            result["live_url"] = app.get("live_url")

        return result

    @do_circuit_breaker
    async def get_deployment_logs(
        self, deployment_id: Optional[str] = None
    ) -> List[str]:
        """
        Get logs for a specific deployment.

        Args:
            deployment_id: Specific deployment ID, or None for active deployment

        Returns:
            List of log URLs

        Raises:
            DigitalOceanConfigError: If not properly configured
        """
        if not self._is_configured():
            raise DigitalOceanConfigError("DigitalOcean API not configured")

        # If no deployment ID provided, get the active one
        if not deployment_id:
            try:
                app_info = await self.get_app_info()
                deployment_id = (
                    app_info.get("app", {}).get("active_deployment", {}).get("id")
                )
            except Exception as e:
                logger.error(f"Failed to get active deployment: {e}")
                return ["Failed to get active deployment ID"]

        if not deployment_id:
            return ["No active deployment found"]

        try:
            # Validate deployment ID format
            InputValidator.validate_instance_id(deployment_id)

            client = await self._get_client()
            response = await client.get(
                f"{self.base_url}/apps/{self.app_id}/deployments/{deployment_id}/logs",
                params={"type": "BUILD", "follow": False},  # or "DEPLOY" or "RUN"
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("historic_urls", [])
            else:
                return [f"Failed to fetch logs: HTTP {response.status_code}"]

        except ValueError as e:
            return [f"Invalid deployment ID: {e}"]
        except Exception as e:
            logger.error(f"Error fetching deployment logs: {type(e).__name__}: {e}")
            return [f"Error: {type(e).__name__}"]

    async def force_deployment_refresh(
        self, force_rebuild: bool = False
    ) -> Dict[str, Any]:
        """
        Trigger a new deployment to refresh metrics.

        WARNING: This will cause a brief downtime during deployment.
        Should only be used when absolutely necessary.

        Args:
            force_rebuild: Whether to force rebuild containers

        Returns:
            Deployment response or error

        Raises:
            DigitalOceanConfigError: If not properly configured
            DigitalOceanAPIError: If deployment fails
        """
        if not self._is_configured():
            raise DigitalOceanConfigError("DigitalOcean API not configured")

        if settings.ENVIRONMENT == "production":
            logger.warning("Attempting to force deployment refresh in production!")

        # This operation should not be cached
        self._clear_cache()

        try:
            client = await self._get_client()
            response = await client.post(
                f"{self.base_url}/apps/{self.app_id}/deployments",
                json={"force_rebuild": force_rebuild},
            )

            if response.status_code in [200, 201]:
                data = response.json()
                deployment = data.get("deployment", {})
                logger.info(f"Deployment triggered: {deployment.get('id')}")
                return data
            else:
                error_msg = response.json().get("message", response.text)
                raise DigitalOceanAPIError(response.status_code, error_msg)

        except httpx.RequestError as e:
            logger.error(
                f"Request error triggering deployment: {type(e).__name__}: {e}"
            )
            raise DigitalOceanAPIError(0, f"Request failed: {type(e).__name__}")

    async def get_metrics_summary(self) -> Dict[str, Any]:
        """
        Get a summary of app metrics and status.

        Returns:
            Summary of current app state and metrics
        """
        summary = {
            "configured": self._is_configured(),
            "circuit_breaker_state": do_circuit_breaker.state.name,
            "cache_size": len(self._cache),
            "last_check": datetime.now(timezone.utc).isoformat(),
        }

        if not self._is_configured():
            summary["error"] = "DigitalOcean monitoring not configured"
            return summary

        try:
            # Get app info
            app_info = await self.get_app_info()

            # Get actual replicas
            replica_info = await self.get_actual_replicas()

            # Get recent deployments
            deployments = await self.get_deployments(limit=5)

            # Build summary
            summary.update(
                {
                    "app": {
                        "id": self.app_id,
                        "name": app_info.get("app", {})
                        .get("spec", {})
                        .get("name", "unknown"),
                        "region": app_info.get("app", {})
                        .get("region", {})
                        .get("slug", "unknown"),
                        "created_at": app_info.get("app", {}).get("created_at"),
                        "updated_at": app_info.get("app", {}).get("updated_at"),
                    },
                    "replicas": replica_info,
                    "recent_deployments": [
                        {
                            "id": d.get("id"),
                            "phase": d.get("phase"),
                            "created_at": d.get("created_at"),
                            "cause": d.get("cause"),
                        }
                        for d in deployments[:3]  # Just show last 3
                    ],
                }
            )
        except DigitalOceanMonitorError as e:
            summary["error"] = str(e)
        except Exception as e:
            summary["error"] = f"Unexpected error: {type(e).__name__}"
            logger.error(f"Error getting metrics summary: {type(e).__name__}: {e}")

        return summary

    async def close(self):
        """Close HTTP client connections."""
        if self._client:
            await self._client.aclose()
            self._client = None


# Global monitor instance
_do_monitor: Optional[DigitalOceanMonitor] = None


def get_do_monitor() -> DigitalOceanMonitor:
    """Get or create the global DigitalOcean monitor instance."""
    global _do_monitor
    if _do_monitor is None:
        _do_monitor = DigitalOceanMonitor()
    return _do_monitor


async def close_do_monitor():
    """Close the global DigitalOcean monitor instance."""
    global _do_monitor
    if _do_monitor:
        await _do_monitor.close()
        _do_monitor = None
