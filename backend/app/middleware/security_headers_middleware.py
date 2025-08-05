from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # Pre-compute policies for performance
        self._prod_csp = self.get_production_csp()
        self._dev_csp = self.get_development_csp()
        self._permissions = self.get_permissions_policy()
        self._prod_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            # Removed preload for DigitalOcean compatibility
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Content-Security-Policy": self._prod_csp,
            "Permissions-Policy": self._permissions
        }
        self._dev_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000",
            "Referrer-Policy": "no-referrer-when-downgrade",
            "Content-Security-Policy": self._dev_csp,
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
        }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Fast path for health checks - critical for DigitalOcean
        if request.url.path in ["/health", "/api/health", "/"]:
            return await call_next(request)
            
        response = await call_next(request)
        
        # Use pre-computed headers for performance
        if settings.ENVIRONMENT == "production":
            response.headers.update(self._prod_headers)
        else:
            response.headers.update(self._dev_headers)

        return response

    def get_production_csp(self):
        # Base policy: restrict to self, allow necessary scripts and styles
        # This needs to be carefully configured based on actual needs,
        # especially for payment providers and WebSocket connections.
        # For WebSockets: connect-src 'self' wss://yourdomain.com;

        # Start with a restrictive policy
        csp_directives = {
            "default-src": ["'self'"],
            "script-src": [
                "'self'",
                "https://js.stripe.com",
                "https://checkout.stripe.com",
            ],  # Stripe JS
            "style-src": [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
            ],  # Allow inline styles for now, and Google Fonts
            "img-src": [
                "'self'",
                "data:",
                "https://*.stripe.com",
            ],  # Allow data URIs and Stripe images
            "font-src": ["'self'", "https://fonts.gstatic.com"],  # Google Fonts
            "connect-src": [
                "'self'",
                # WebSocket - Re-evaluate how to best set this
                # "wss://" + settings.DOMAIN if hasattr(settings, 'DOMAIN')
                "https://api.stripe.com",
                "https://errors.stripe.com",
            ],  # Allow self, WebSocket, Stripe API
            "frame-src": [
                "'self'",
                "https://js.stripe.com",
                "https://checkout.stripe.com",
            ],  # Stripe frames
            "object-src": ["'none'"],  # Disallow plugins like Flash
            "base-uri": ["'self'"],
            "form-action": ["'self'"],  # Restrict where forms can submit
            "frame-ancestors": ["'none'"],  # Equivalent to X-Frame-Options: DENY
            # "report-uri": ["/api/v1/csp-reports"], # Optional endpoint
        }

        # CSP directives for connect-src might need to be adjusted based on
        # settings.DOMAIN availability. For now, WebSocket connections to a
        # different domain than 'self' might be blocked in production.

        return "; ".join(
            [
                f"{key} {' '.join(values)}"
                for key, values in csp_directives.items()
                if values
            ]
        )

    def get_development_csp(self):
        # More permissive CSP for development to avoid blocking common dev tools
        # Still, it's good practice to keep it as close to production as possible
        csp_directives = {
            "default-src": ["'self'"],
            "script-src": [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                "https://js.stripe.com",
                "https://checkout.stripe.com",
            ],  # Allow inline scripts and eval for dev
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "img-src": ["'self'", "data:", "https://*.stripe.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "connect-src": [
                "'self'",
                "ws://localhost:8000",  # Local WebSocket
                "wss://localhost:8000",  # Local secure WebSocket
                "http://localhost:8000",  # Local HTTP for API calls
                "https://api.stripe.com",
                "https://errors.stripe.com",
            ],
            "frame-src": [
                "'self'",
                "https://js.stripe.com",
                "https://checkout.stripe.com",
            ],
            "object-src": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
            "frame-ancestors": ["'self'"],  # Allow framing from self for dev tools
        }
        return "; ".join(
            [f"{key} {' '.join(values)}" for key, values in csp_directives.items()]
        )

    def get_permissions_policy(self):
        # Define features and their permissions
        # Example: geolocation=(self "https://example.com"), microphone=()
        # By default, disable most features unless explicitly needed.
        permissions = [
            "accelerometer=()",
            "ambient-light-sensor=()",
            "autoplay=()",
            "camera=()",  # Example: allow self if app needs camera: "camera=(self)"
            "encrypted-media=()",
            "fullscreen=(self)",  # Example: allow self if app needs fullscreen
            "geolocation=()",  # Example: "geolocation=(self \"https://trusted.third-party.com\")"
            "gyroscope=()",
            "magnetometer=()",
            "microphone=()",
            "midi=()",
            # payment=(self "https://stripe.com") if Stripe in iframe
            "payment=()",
            "picture-in-picture=()",
            "speaker=()",
            "sync-xhr=(self)",
            "usb=()",
            "vr=()",
            "screen-wake-lock=()",
        ]
        return ", ".join(permissions)
