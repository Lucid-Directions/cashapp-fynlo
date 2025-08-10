"""
API Version Detection and Routing Middleware
Provides automatic version detection and backward compatibility
"""

from fastapi import Request, Response
import re
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class APIVersionMiddleware:
    """
    Optimized middleware to handle API versioning and provide backward compatibility

    Features:
    - Automatic /api/ to /api/v1/ routing
    - WebSocket path normalization
    - Version header detection
    - Graceful fallback mechanisms
    """

    def __init__(self, app):
        self.app = app
        # Pre-compile regex patterns for performance
        self._unversioned_re = re.compile(r"^/api/(?!v\d+/)(.+)$")
        self._ws_patterns = [
            (re.compile(r"^/ws/(.+)$"), r"/api/v1/websocket/ws/\1"),
            (re.compile(r"^/websocket/(.+)$"), r"/api/v1/websocket/ws/\1"),
        ]
        # Path cache to avoid repeated regex matching
        self._path_cache = {}
        self._cache_max_size = 1000

    async def __call__(self, scope, receive, send):
        if scope["type"] in ["http", "websocket"]:
            path = scope.get("path", "")

            # Skip health checks for performance
            if path in ["/health", "/api/health", "/"]:
                await self.app(scope, receive, send)
                return

            # Check cache first
            if path in self._path_cache:
                rewritten_path = self._path_cache[path]
            else:
                # Fast path - already versioned
                if "/api/v1/" in path:
                    rewritten_path = path
                else:
                    if scope["type"] == "http":
                        rewritten_path = self.rewrite_api_path(path)
                    else:  # websocket
                        rewritten_path = self.rewrite_websocket_path(path)

                # Cache result if cache not full
                if len(self._path_cache) < self._cache_max_size:
                    self._path_cache[path] = rewritten_path

            if rewritten_path != path:
                if API_VERSION_CONFIG["log_version_rewrites"]:
                    logger.info(f"Path rewrite: {path} -> {rewritten_path}")
                scope["path"] = rewritten_path
                scope["raw_path"] = rewritten_path.encode()

        # Continue with the request
        await self.app(scope, receive, send)

    def rewrite_api_path(self, path: str) -> str:
        """
        Rewrite API paths to ensure version consistency

        Examples:
        /api/products -> /api/v1/products
        /api/v1/products -> /api/v1/products (unchanged)
        /health -> /health (unchanged)
        """
        match = self._unversioned_re.match(path)
        if match:
            resource_path = match.group(1)
            return f"/api/v1/{resource_path}"
        return path

    def rewrite_websocket_path(self, path: str) -> str:
        """
        Rewrite WebSocket paths for consistency

        Examples:
        /ws/{restaurant_id} -> /api/v1/websocket/ws/{restaurant_id}
        /websocket/{restaurant_id} -> /api/v1/websocket/ws/{restaurant_id}
        """
        for pattern, replacement in self._ws_patterns:
            if pattern.match(path):
                return pattern.sub(replacement, path)
        return path

    def extract_version_from_headers(self, request: Request) -> Optional[str]:
        """
        Extract API version from request headers

        Checks for:
        - X-API-Version header
        - Accept header with version
        """

        # Check X-API-Version header
        api_version = request.headers.get("x-api-version")
        if api_version:
            return f"v{api_version}" if not api_version.startswith("v") else api_version

        # Check Accept header for version
        accept_header = request.headers.get("accept", "")
        version_match = re.search(r"application/json;version=(\d+)", accept_header)
        if version_match:
            return f"v{version_match.group(1)}"

        return None


def add_version_headers_to_response(request: Request, response: Response) -> Response:
    """
    Add version information to response headers
    """

    # Add current API version to response
    response.headers["X-API-Version"] = "1"
    response.headers["X-API-Version-Supported"] = "1"

    # Add compatibility information
    response.headers["X-API-Backward-Compatible"] = "true"

    return response


class WebSocketPathNormalizer:
    """
    Utility class for WebSocket path normalization
    """

    @staticmethod
    def normalize_ws_path(
        path: str, restaurant_id: str, connection_type: str = "general"
    ) -> str:
        """
        Normalize WebSocket path to standard format

        Args:
            path: Original path
            restaurant_id: Restaurant ID
            connection_type: Type of connection (general, kitchen, pos, management)

        Returns:
            Normalized path
        """

        base_path = "/api/v1/websocket/ws"

        if connection_type == "general":
            return f"{base_path}/{restaurant_id}"
        else:
            return f"{base_path}/{connection_type}/{restaurant_id}"

    @staticmethod
    def extract_restaurant_id_from_path(path: str) -> Optional[str]:
        """
        Extract restaurant ID from WebSocket path
        """

        patterns = [
            r"/ws/([^/]+)",
            r"/websocket/([^/]+)",
            r"/api/v1/websocket/ws/([^/]+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, path)
            if match:
                return match.group(1)

        return None


# Configuration constants
API_VERSION_CONFIG = {
    "current_version": "v1",
    "supported_versions": ["v1"],
    "default_version_for_unversioned": "v1",
    "enable_backward_compatibility": True,
    "enable_websocket_normalization": True,
    "log_version_rewrites": True,
}
