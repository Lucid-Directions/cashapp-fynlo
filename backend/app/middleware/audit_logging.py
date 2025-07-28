"""Audit Logging Middleware for comprehensive security tracking."""

import json
import time
from typing import Optional
from uuid import UUID

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.database import get_db
from app.models.audit_log import AuditEventStatus, AuditEventType, AuditLog
from app.models.user import User


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all security-relevant events."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.sensitive_paths = [
            "/api/v1/auth",
            "/api/v1/payments",
            "/api/v1/users",
            "/api/v1/platform",
        ]
        self.high_risk_actions = [
            "DELETE",
            "PUT",
            "PATCH",
        ]

    async def dispatch(self, request: Request, call_next):
        """Process request and log security events."""
        start_time = time.time()

        # Extract request info
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("User-Agent", "")

        # Initialize audit data
        audit_data = {
            "method": request.method,
            "path": str(request.url.path),
            "query_params": dict(request.query_params),
            "headers": self._safe_headers(request.headers),
        }

        # Get current user if authenticated
        current_user = None
        user_id = None
        username = None

        try:
            # Extract user from request state if available
            if hasattr(request.state, "user"):
                current_user = request.state.user
                user_id = current_user.id
                username = current_user.email
        except Exception:
            pass

        # Determine event type
        event_type = self._determine_event_type(request, current_user)

        # Process request
        response = None
        error = None
        try:
            response = await call_next(request)
        except Exception as e:
            error = str(e)
            response = Response(
                content=json.dumps({"detail": "Internal server error"}),
                status_code=500,
            )

        # Calculate duration
        duration_ms = int((time.time() - start_time) * 1000)

        # Determine event status
        if error:
            event_status = AuditEventStatus.FAILURE
        elif response.status_code >= 400:
            event_status = AuditEventStatus.FAILURE
        elif response.status_code >= 200 and response.status_code < 300:
            event_status = AuditEventStatus.SUCCESS
        else:
            event_status = AuditEventStatus.INFO

        # Calculate risk score
        risk_score = self._calculate_risk_score(
            request, response, current_user, duration_ms
        )

        # Add response info to audit data
        audit_data.update(
            {
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "error": error,
            }
        )

        # Log the event
        await self._log_audit_event(
            event_type=event_type,
            event_status=event_status,
            user_id=user_id,
            username=username,
            ip_address=client_ip,
            user_agent=user_agent,
            resource_type=self._extract_resource_type(request),
            resource_id=self._extract_resource_id(request),
            action=request.method,
            details=audit_data,
            risk_score=risk_score,
        )

        # Check for suspicious activity
        if risk_score >= 70:
            await self._trigger_security_alert(
                event_type, user_id, client_ip, audit_data, risk_score
            )

        return response

    def _safe_headers(self, headers):
        """Get headers without sensitive information."""
        safe_headers = {}
        sensitive_headers = ["authorization", "cookie", "x-api-key"]

        for key, value in headers.items():
            if key.lower() in sensitive_headers:
                safe_headers[key] = "[REDACTED]"
            else:
                safe_headers[key] = value

        return safe_headers

    def _determine_event_type(
        self, request: Request, user: Optional[User]
    ) -> AuditEventType:
        """Determine the audit event type based on request."""
        path = str(request.url.path)
        method = request.method

        # Authentication events
        if "/auth/login" in path:
            return AuditEventType.USER_LOGIN_SUCCESS
        elif "/auth/logout" in path:
            return AuditEventType.USER_LOGOUT
        elif "/auth/register" in path:
            return AuditEventType.USER_REGISTRATION_SUCCESS
        elif "/auth/password" in path:
            return AuditEventType.PASSWORD_CHANGE_SUCCESS

        # Payment events
        elif "/payments" in path:
            if method == "POST":
                return AuditEventType.PAYMENT_INITIATED
            elif "/refund" in path:
                return AuditEventType.REFUND_INITIATED

        # User management
        elif "/users" in path:
            if method == "POST":
                return AuditEventType.USER_CREATED
            elif method in ["PUT", "PATCH"]:
                return AuditEventType.USER_UPDATED
            elif method == "DELETE":
                return AuditEventType.USER_DELETED

        # Data access
        elif method == "GET" and any(
            sensitive in path for sensitive in ["/reports", "/export"]
        ):
            return AuditEventType.DATA_EXPORTED
        elif method == "DELETE":
            return AuditEventType.DATA_DELETED

        # Platform owner actions
        elif user and user.role == "platform_owner":
            if "/platform" in path or "/admin" in path:
                return AuditEventType.SYSTEM_CONFIG_CHANGED

        # Default
        return AuditEventType.ACCESS_GRANTED

    def _extract_resource_type(self, request: Request) -> Optional[str]:
        """Extract resource type from request path."""
        path_parts = str(request.url.path).strip("/").split("/")

        # Common resource types
        resource_types = [
            "users",
            "restaurants",
            "products",
            "orders",
            "payments",
            "inventory",
            "reports",
            "settings",
        ]

        for part in path_parts:
            if part in resource_types:
                return part.rstrip("s")  # Singular form

        return None

    def _extract_resource_id(self, request: Request) -> Optional[str]:
        """Extract resource ID from request path."""
        path_parts = str(request.url.path).strip("/").split("/")

        # Look for UUID pattern
        import re

        uuid_pattern = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        )

        for part in path_parts:
            if uuid_pattern.match(part):
                return part

        return None

    def _calculate_risk_score(
        self,
        request: Request,
        response: Response,
        user: Optional[User],
        duration_ms: int,
    ) -> int:
        """Calculate risk score based on various factors."""
        risk_score = 0

        # Failed authentication attempts
        if response.status_code == 401:
            risk_score += 30

        # Access denied
        if response.status_code == 403:
            risk_score += 20

        # Server errors (might indicate attack)
        if response.status_code >= 500:
            risk_score += 15

        # Suspicious methods
        if request.method in ["DELETE", "PUT"]:
            risk_score += 10

        # Sensitive endpoints
        if any(path in str(request.url.path) for path in self.sensitive_paths):
            risk_score += 15

        # Platform actions by non-platform owners
        if (
            "/platform" in str(request.url.path)
            and user
            and user.role != "platform_owner"
        ):
            risk_score += 50

        # Unusually slow requests (might indicate attack)
        if duration_ms > 5000:
            risk_score += 10

        # Multiple failed attempts (would need to track this)
        # This is simplified - in production, track failed attempts per IP/user

        return min(risk_score, 100)  # Cap at 100

    async def _log_audit_event(self, **kwargs):
        """Log audit event to database."""
        try:
            # Get database session
            db = next(get_db())

            audit_log = AuditLog(
                event_type=kwargs.get("event_type"),
                event_status=kwargs.get("event_status"),
                user_id=kwargs.get("user_id"),
                username_or_email=kwargs.get("username"),
                ip_address=kwargs.get("ip_address"),
                user_agent=kwargs.get("user_agent"),
                resource_type=kwargs.get("resource_type"),
                resource_id=kwargs.get("resource_id"),
                action_performed=kwargs.get("action"),
                details=kwargs.get("details"),
                risk_score=kwargs.get("risk_score"),
            )

            db.add(audit_log)
            db.commit()
            db.close()
        except Exception as e:
            # Log to file or external service if DB fails
            print(f"Failed to log audit event: {e}")

    async def _trigger_security_alert(
        self,
        event_type: AuditEventType,
        user_id: Optional[UUID],
        ip_address: Optional[str],
        details: dict,
        risk_score: int,
    ):
        """Trigger security alert for high-risk events."""
        # In production, this would:
        # 1. Send notifications to security team
        # 2. Trigger automated responses (e.g., block IP)
        # 3. Create security incident ticket
        # 4. Log to SIEM system

        alert_message = f"""
        SECURITY ALERT - Risk Score: {risk_score}
        Event Type: {event_type}
        User ID: {user_id}
        IP Address: {ip_address}
        Details: {json.dumps(details, indent=2)}
        """

        # For now, just log it
        print(alert_message)

        # TODO: Implement actual alerting mechanisms
        # - Email to security team
        # - Slack/Teams notification
        # - PagerDuty integration
        # - SIEM integration
