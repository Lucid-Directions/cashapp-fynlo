"""
Mobile Compatibility Middleware for Fynlo POS
Handles port compatibility and mobile-specific request processing


from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import json
import logging

logger = logging.getLogger(__name__)

class MobileCompatibilityMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle mobile app compatibility requirements
    
    
    def __init__(self, app, enable_cors: bool = True, enable_port_redirect: bool = True):
        super().__init__(app)
        self.enable_cors = enable_cors
        self.enable_port_redirect = enable_port_redirect
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process mobile-specific request handling
        """
        # Add mobile-friendly headers
        if self.is_mobile_request(request):
            # Log mobile requests for monitoring
            logger.info(f"Mobile request: {request.method} {request.url.path}")
        
        # Process request
        response = await call_next(request)
        
        # Add mobile-friendly response headers
        if self.enable_cors:
            self.add_cors_headers(response, request)
        
        # Add mobile-specific headers
        self.add_mobile_headers(response, request)
        
        return response
    
    def is_mobile_request(self, request: Request) -> bool:
        """
        Detect if request is from mobile app
        """
        user_agent = request.headers.get("user-agent", "").lower()
        mobile_indicators = [
            "ios",
            "iphone",
            "ipad",
            "fynlo",
            "react-native",
            "mobile"
        ]
        
        return any(indicator in user_agent for indicator in mobile_indicators)
    
    def add_cors_headers(self, response: Response, request: Request):
        """
        Add CORS headers for mobile app requests
        """
        # Allow all origins for development (restrict in production)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Max-Age"] = "3600"
    
    def add_mobile_headers(self, response: Response, request: Request):
        """
        Add mobile-specific headers
        """
        if self.is_mobile_request(request):
            response.headers["X-Mobile-Optimized"] = "true"
            response.headers["X-API-Version"] = "1.0"
            response.headers["X-Cache-Control"] = "public, max-age=300"  # 5 minutes cache
        
        # Add JSON content type for consistency
        if not response.headers.get("content-type"):
            response.headers["Content-Type"] = "application/json"

class JSONRPCCompatibilityMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle JSONRPC requests for Odoo compatibility
    
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Handle JSONRPC format requests
        """
        # Check if this is a JSONRPC request
        if self.is_jsonrpc_request(request):
            # Transform JSONRPC to REST format
            request = await self.transform_jsonrpc_request(request)
        
        response = await call_next(request)
        
        # Transform response back to JSONRPC format if needed
        if self.is_jsonrpc_request(request):
            response = await self.transform_to_jsonrpc_response(response)
        
        return response
    
    def is_jsonrpc_request(self, request: Request) -> bool:
        """
        Detect JSONRPC requests
        """
        content_type = request.headers.get("content-type", "")
        return (
            "application/json" in content_type and
            request.url.path.startswith("/web/")
        )
    
    async def transform_jsonrpc_request(self, request: Request) -> Request:
        """
        Transform JSONRPC request to REST format
        """
        # This is a simplified transformation
        # In a full implementation, you'd parse the JSONRPC structure
        return request
    
    async def transform_to_jsonrpc_response(self, response: Response) -> Response:
        """
        Transform REST response to JSONRPC format
        """
        # This is a simplified transformation
        # In a full implementation, you'd wrap the response in JSONRPC structure
        return response

class MobileDataOptimizationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to optimize data payloads for mobile devices
    
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Optimize responses for mobile bandwidth
        """
        response = await call_next(request)
        
        # Only optimize for mobile requests
        if not self.is_mobile_request(request):
            return response
        
        # Optimize response if it's JSON
        if self.is_json_response(response):
            response = await self.optimize_json_response(response, request)
        
        return response
    
    def is_mobile_request(self, request: Request) -> bool:
        """
        Detect mobile requests
        """
        user_agent = request.headers.get("user-agent", "").lower()
        return any(indicator in user_agent for indicator in ["ios", "mobile", "react-native"])
    
    def is_json_response(self, response: Response) -> bool:
        """
        Check if response is JSON
        """
        content_type = response.headers.get("content-type", "")
        return "application/json" in content_type
    
    async def optimize_json_response(self, response: Response, request: Request) -> Response:
        """
        Optimize JSON response for mobile
        """
        try:
            # Get response body
            body = b"".join([chunk async for chunk in response.body_iterator])
            
            if not body:
                return response
            
            # Parse JSON
            data = json.loads(body.decode())
            
            # Apply mobile optimizations
            optimized_data = self.apply_mobile_optimizations(data, request)
            
            # Create new response with optimized data
            optimized_body = json.dumps(optimized_data, separators=(',', ':')).encode()
            
            # Update response
            response.headers["content-length"] = str(len(optimized_body))
            response.body_iterator = iter([optimized_body])
            
            return response
            
        except Exception as e:
            logger.warning(f"Failed to optimize response for mobile: {e}")
            return response
    
    def apply_mobile_optimizations(self, data: dict, request: Request) -> dict:
        """
        Apply mobile-specific optimizations to response data
        """
        # Remove null values to reduce payload size
        if isinstance(data, dict):
            optimized = {}
            for key, value in data.items():
                if value is not None:
                    if isinstance(value, (dict, list)):
                        optimized[key] = self.apply_mobile_optimizations(value, request)
                    else:
                        optimized[key] = value
            return optimized
        
        elif isinstance(data, list):
            return [
                self.apply_mobile_optimizations(item, request) if isinstance(item, (dict, list))
                else item
                for item in data if item is not None
            ]
        
        return data

# Utility functions for mobile compatibility
def get_client_info(request: Request) -> dict:
    """
    Extract client information from request headers
    """
    user_agent = request.headers.get("user-agent", "")
    
    return {
        "user_agent": user_agent,
        "is_mobile": any(indicator in user_agent.lower() for indicator in ["ios", "mobile", "react-native"]),
        "ip_address": request.client.host if request.client else None,
        "accept_language": request.headers.get("accept-language", "en-US"),
        "app_version": request.headers.get("x-app-version"),
        "device_id": request.headers.get("x-device-id")
    }

def is_feature_enabled_for_client(feature: str, request: Request) -> bool:
    """
    Check if a feature is enabled for the requesting client
    """
    client_info = get_client_info(request)
    
    # Feature flags based on client type
    mobile_features = {
        "offline_mode": True,
        "push_notifications": True,
        "image_optimization": True,
        "reduced_payloads": True,
        "background_sync": True
    }
    
    if client_info["is_mobile"]:
        return mobile_features.get(feature, False)
    
    return True  # All features enabled for web clients