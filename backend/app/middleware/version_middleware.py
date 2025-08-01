"""
API Version Detection and Routing Middleware
Provides automatic version detection and backward compatibility
"""

from fastapi import Request, Response
from fastapi.responses import RedirectResponse
import re
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class APIVersionMiddleware:
    """
    Middleware to handle API versioning and provide backward compatibility
    
    Features:
    - Automatic /api/ to /api/v1/ routing
    - WebSocket path normalization
    - Version header detection
    - Graceful fallback mechanisms
    """
    
    def __init__(self, app):
        self.app = app
        
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Handle HTTP requests
            request = Request(scope, receive)
            path = request.url.path
            
            # Check if path needs version routing
            rewritten_path = self.rewrite_api_path(path)
            
            if rewritten_path != path:
                # Log the rewrite for debugging
                logger.info(f"API version rewrite: {path} -> {rewritten_path}")
                
                # Update the scope with new path
                scope["path"] = rewritten_path
                scope["raw_path"] = rewritten_path.encode()
                
        elif scope["type"] == "websocket":
            # Handle WebSocket connections
            path = scope["path"]
            rewritten_path = self.rewrite_websocket_path(path)
            
            if rewritten_path != path:
                logger.info(f"WebSocket path rewrite: {path} -> {rewritten_path}")
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
        
        # Pattern for unversioned API calls
        unversioned_pattern = r'^/api/(?!v\d+/)(.+)$'
        match = re.match(unversioned_pattern, path)
        
        if match:
            # Extract the resource path
            resource_path = match.group(1)
            # Add v1 version
            return f"/api/v1/{resource_path}"
        
        return path
    
    def rewrite_websocket_path(self, path: str) -> str:
        """
        Rewrite WebSocket paths for consistency
        
        Examples:
        /ws/{restaurant_id} -> /api/v1/websocket/ws/{restaurant_id}
        /websocket/{restaurant_id} -> /api/v1/websocket/ws/{restaurant_id}
        """
        
        # Pattern for direct WebSocket paths
        ws_patterns = [
            (r'^/ws/(.+)$', r'/api/v1/websocket/ws/\1'),
            (r'^/websocket/(.+)$', r'/api/v1/websocket/ws/\1'),
        ]
        
        for pattern, replacement in ws_patterns:
            if re.match(pattern, path):
                return re.sub(pattern, replacement, path)
        
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
        version_match = re.search(r'application/json;version=(\d+)', accept_header)
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
    def normalize_ws_path(path: str, restaurant_id: str, connection_type: str = "general") -> str:
        """
        Normalize WebSocket path to standard format
        
        Args:
            path: Original path
            restaurant_id: Restaurant ID
            connection_type: Type of connection (general, kitchen, pos, management)
            
        Returns:
            Normalized path
        """
        
        base_path = f"/api/v1/websocket/ws"
        
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
            r'/ws/([^/]+)',
            r'/websocket/([^/]+)',
            r'/api/v1/websocket/ws/([^/]+)',
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