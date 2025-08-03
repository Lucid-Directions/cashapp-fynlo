from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Common headers for all environments
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = (
            "1; mode=block"  # Deprecated but still good for older browsers
        )

        if settings.ENVIRONMENT == "production":
            # Production specific headers
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            # CSP needs careful configuration, will be more complex
            response.headers["Content-Security-Policy"] = self.get_production_csp()
            response.headers["Permissions-Policy"] = self.get_permissions_policy()
        else:
            # Development/staging specific headers (more permissive)
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"  # Can be less strict if not preloading
            )
            response.headers["Referrer-Policy"] = (
                "no-referrer-when-downgrade"  # More permissive
            )
            response.headers["Content-Security-Policy"] = self.get_development_csp()
            response.headers["Permissions-Policy"] = (
                "camera=(), microphone=(), geolocation=()"  # Example, adjust as needed
            )

        return response
        # Base policy: restrict to self, allow necessary scripts and styles
        # This needs to be carefully configured based on actual needs, especially for payment providers
        # and WebSocket connections.
        # Example: default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self' 'unsafe-inline'; ...
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
                # "wss://" + settings.DOMAIN if hasattr(settings, 'DOMAIN') and settings.DOMAIN else "", # WebSocket - Re-evaluate how to best set this
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
            # "report-uri": ["/api/v1/csp-reports"], # Endpoint to report violations (optional) - needs an endpoint
        }

        # CSP directives for connect-src might need to be adjusted based on settings.DOMAIN availability
        # For now, WebSocket connections to a different domain than 'self' might be blocked in production.
        # Consider adding settings.DOMAIN or making CSP more dynamically configurable.

        return "; ".join(
            [
                f"{key} {' '.join(values)}"
                for key, values in csp_directives.items()
                if values
            ]
        )
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
            "payment=()",  # Example: "payment=(self \"https://stripe.com\")" if Stripe handles payments in an iframe
            "picture-in-picture=()",
            "speaker=()",
            "sync-xhr=(self)",
            "usb=()",
            "vr=()",
            "screen-wake-lock=()",
        ]
        return ", ".join(permissions)
