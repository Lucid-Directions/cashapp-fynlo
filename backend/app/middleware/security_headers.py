"""Security Headers Middleware for FastAPI.

Implements comprehensive security headers to protect against common web
vulnerabilities.
"""

from typing import Dict, List, Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.types import ASGIApp


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses."""

    def __init__(
        self,
        app: ASGIApp,
        custom_headers: Optional[Dict[str, str]] = None,
        nonce_enabled: bool = True,
    ):
        """Initialize security headers middleware."""
        super().__init__(app)
        self.custom_headers = custom_headers or {}
        self.nonce_enabled = nonce_enabled

    async def dispatch(self, request: Request, call_next):
        """Add security headers to the response."""
        # Generate nonce for CSP if enabled
        nonce = None
        if self.nonce_enabled:
            import secrets

            nonce = secrets.token_urlsafe(16)
            request.state.csp_nonce = nonce

        # Process the request
        response = await call_next(request)

        # Add security headers
        self._add_security_headers(response, request, nonce)

        return response

    def _add_security_headers(
        self, response: Response, request: Request, nonce: Optional[str] = None
    ):
        """Add all security headers to the response."""
        # Content Security Policy (CSP)
        csp_directives = self._build_csp_directives(nonce)
        response.headers["Content-Security-Policy"] = csp_directives

        # Strict Transport Security (HSTS)
        # Enforce HTTPS for 1 year, including subdomains
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )

        # X-Frame-Options - Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # X-Content-Type-Options - Prevent MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # X-XSS-Protection - Legacy XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer-Policy - Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions-Policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = (
            self._build_permissions_policy()
        )

        # Cache-Control for sensitive endpoints
        if self._is_sensitive_endpoint(request):
            response.headers["Cache-Control"] = (
                "no-store, no-cache, must-revalidate, private"
            )
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        # CORS headers (if not already set by CORS middleware)
        if "Access-Control-Allow-Origin" not in response.headers:
            # Set restrictive CORS by default
            response.headers["Access-Control-Allow-Origin"] = (
                request.headers.get("Origin", "*")
                if self._is_allowed_origin(request)
                else "null"
            )
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, DELETE, OPTIONS"
            )
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, Authorization, X-Requested-With"
            )
            response.headers["Access-Control-Max-Age"] = "86400"  # 24 hours

        # Security.txt location
        response.headers["X-Security-Txt"] = "/.well-known/security.txt"

        # Custom headers
        for header, value in self.custom_headers.items():
            response.headers[header] = value

    def _build_csp_directives(self, nonce: Optional[str] = None) -> str:
        """Build Content Security Policy directives."""
        directives = {
            "default-src": ["'self'"],
            "script-src": [
                "'self'",
                "'unsafe-inline'" if not nonce else f"'nonce-{nonce}'",
                "https://cdn.jsdelivr.net",  # For libraries
                "https://www.googletagmanager.com",  # Analytics
                "https://www.google-analytics.com",
            ],
            "style-src": [
                "'self'",
                "'unsafe-inline'",  # Required for inline styles
                "https://fonts.googleapis.com",
                "https://cdn.jsdelivr.net",
            ],
            "img-src": [
                "'self'",
                "data:",  # For base64 images
                "https:",  # Allow HTTPS images
                "blob:",  # For blob URLs
            ],
            "font-src": [
                "'self'",
                "https://fonts.gstatic.com",
                "data:",  # For inline fonts
            ],
            "connect-src": [
                "'self'",
                "https://api.stripe.com",  # Payment processing
                "wss:",  # WebSocket connections
                "https:",  # API calls
            ],
            "media-src": ["'self'"],
            "object-src": ["'none'"],  # Disable plugins
            "frame-src": [
                "'self'",
                "https://js.stripe.com",  # Stripe elements
            ],
            "frame-ancestors": ["'none'"],  # Same as X-Frame-Options
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
            "upgrade-insecure-requests": [],  # Upgrade HTTP to HTTPS
            "block-all-mixed-content": [],  # Block HTTP on HTTPS pages
        }

        # Build the CSP string
        csp_parts = []
        for directive, sources in directives.items():
            if sources:
                csp_parts.append(f"{directive} {' '.join(sources)}")
            else:
                csp_parts.append(directive)

        return "; ".join(csp_parts)

    def _build_permissions_policy(self) -> str:
        """Build Permissions Policy (Feature Policy) directives."""
        policies = {
            "accelerometer": "()",  # Deny all
            "ambient-light-sensor": "()",
            "autoplay": "(self)",  # Allow on same origin
            "battery": "()",
            "camera": "()",  # Deny camera access
            "display-capture": "()",
            "document-domain": "()",
            "encrypted-media": "(self)",
            "execution-while-not-rendered": "()",
            "execution-while-out-of-viewport": "()",
            "fullscreen": "(self)",
            "geolocation": "()",  # Deny location access
            "gyroscope": "()",
            "magnetometer": "()",
            "microphone": "()",  # Deny microphone access
            "midi": "()",
            "navigation-override": "()",
            "payment": "(self)",  # Allow payments on same origin
            "picture-in-picture": "()",
            "publickey-credentials-get": "(self)",
            "screen-wake-lock": "()",
            "sync-xhr": "()",  # Deny synchronous XHR
            "usb": "()",
            "web-share": "(self)",
            "xr-spatial-tracking": "()",
        }

        return ", ".join(
            f"{feature}={value}" for feature, value in policies.items()
        )

    def _is_sensitive_endpoint(self, request: Request) -> bool:
        """Check if the endpoint handles sensitive data."""
        sensitive_paths = [
            "/api/v1/auth",
            "/api/v1/users",
            "/api/v1/payments",
            "/api/v1/platform",
            "/api/v1/reports",
        ]

        path = str(request.url.path)
        return any(path.startswith(sensitive) for sensitive in sensitive_paths)

    def _is_allowed_origin(self, request: Request) -> bool:
        """Check if the origin is allowed for CORS."""
        origin = request.headers.get("Origin", "")

        # Define allowed origins
        allowed_origins = [
            "https://fynlo.com",
            "https://app.fynlo.com",
            "https://admin.fynlo.com",
            "http://localhost:3000",  # Development
            "http://localhost:8100",  # Ionic development
        ]

        # Check if origin is in allowed list
        if origin in allowed_origins:
            return True

        # Check for subdomain pattern
        import re

        allowed_patterns = [
            r"^https://[a-z0-9-]+\.fynlo\.com$",  # Any subdomain of fynlo.com
            r"^https://fynlo-[a-z0-9-]+\.vercel\.app$",  # Vercel preview URLs
        ]

        for pattern in allowed_patterns:
            if re.match(pattern, origin):
                return True

        return False


class SecurityMiddleware:
    """Combined security middleware with additional protections."""

    @staticmethod
    def remove_server_header(response: Response):
        """Remove server identification headers."""
        headers_to_remove = [
            "Server",
            "X-Powered-By",
            "X-AspNet-Version",
            "X-AspNetMvc-Version",
        ]

        for header in headers_to_remove:
            if header in response.headers:
                del response.headers[header]

    @staticmethod
    def add_security_headers(app: ASGIApp) -> ASGIApp:
        """Add all security middleware to the application."""
        # Add security headers middleware
        app = SecurityHeadersMiddleware(app)

        return app


# Additional security utilities
class ContentSecurityPolicyBuilder:
    """Builder for complex CSP policies."""

    def __init__(self):
        """Initialize CSP builder."""
        self.directives = {}

    def add_directive(self, directive: str, sources: List[str]):
        """Add a CSP directive."""
        self.directives[directive] = sources
        return self

    def add_script_src(self, sources: List[str]):
        """Add script sources."""
        return self.add_directive("script-src", sources)

    def add_style_src(self, sources: List[str]):
        """Add style sources."""
        return self.add_directive("style-src", sources)

    def add_img_src(self, sources: List[str]):
        """Add image sources."""
        return self.add_directive("img-src", sources)

    def build(self) -> str:
        """Build the CSP string."""
        parts = []
        for directive, sources in self.directives.items():
            if sources:
                parts.append(f"{directive} {' '.join(sources)}")
        return "; ".join(parts)


# Security.txt content
SECURITY_TXT_CONTENT = """Contact: security@fynlo.com
Expires: 2025-12-31T23:59:59.000Z
Encryption: https://fynlo.com/security-pgp-key.txt
Acknowledgments: https://fynlo.com/security-thanks
Preferred-Languages: en
Canonical: https://fynlo.com/.well-known/security.txt
Policy: https://fynlo.com/security-policy
Hiring: https://fynlo.com/careers

# Fynlo POS Security Contact
#
# We take security seriously. If you discover a security vulnerability,
# please report it to security@fynlo.com. We appreciate your efforts
# and responsible disclosure.
#
# For urgent security issues, please encrypt your message using our PGP key.
"""
