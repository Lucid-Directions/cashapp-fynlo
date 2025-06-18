import json
import logging
import time
from datetime import datetime, timedelta
from functools import wraps

import jwt
from odoo import http
from odoo.http import request, Response
from odoo.exceptions import AccessDenied, ValidationError
import redis

_logger = logging.getLogger(__name__)


class RateLimiter:
    """Redis-based rate limiter for API endpoints"""
    
    def __init__(self):
        self.redis_client = redis.Redis(
            host='localhost', 
            port=6379, 
            db=0, 
            decode_responses=True
        )
    
    def is_allowed(self, key, limit=100, window=60):
        """Check if request is within rate limit"""
        try:
            current = self.redis_client.get(key)
            if current is None:
                self.redis_client.setex(key, window, 1)
                return True
            
            if int(current) >= limit:
                return False
            
            self.redis_client.incr(key)
            return True
        except Exception as e:
            _logger.error(f"Rate limiter error: {e}")
            return True  # Allow request on Redis failure


class POSAPIController(http.Controller):
    """Base API controller with authentication and common utilities"""
    
    def __init__(self):
        super().__init__()
        self.rate_limiter = RateLimiter()
    
    def _cors_headers(self):
        """Generate CORS headers for iOS app compatibility"""
        return {
            'Access-Control-Allow-Origin': '*',  # Configure based on environment
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key, X-Device-ID',
            'Access-Control-Max-Age': '86400',
        }
    
    def _json_response(self, data=None, success=True, message=None, status=200, headers=None):
        """Standardized JSON response format"""
        response_data = {
            'success': success,
            'timestamp': datetime.utcnow().isoformat(),
        }
        
        if data is not None:
            response_data['data'] = data
        
        if message is not None:
            response_data['message'] = message
        
        response_headers = self._cors_headers()
        if headers:
            response_headers.update(headers)
        
        return Response(
            json.dumps(response_data, default=str),
            status=status,
            headers=response_headers,
            content_type='application/json'
        )
    
    def _error_response(self, message, status=400, error_code=None):
        """Standardized error response format"""
        error_data = {
            'success': False,
            'error': {
                'message': message,
                'code': error_code,
                'timestamp': datetime.utcnow().isoformat()
            }
        }
        
        return Response(
            json.dumps(error_data),
            status=status,
            headers=self._cors_headers(),
            content_type='application/json'
        )
    
    def _validate_json(self, required_fields=None):
        """Validate JSON request data"""
        try:
            if not request.httprequest.is_json:
                raise ValidationError("Content-Type must be application/json")
            
            data = request.httprequest.get_json()
            if data is None:
                raise ValidationError("Invalid JSON data")
            
            if required_fields:
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")
            
            return data
        except Exception as e:
            raise ValidationError(f"JSON validation error: {str(e)}")
    
    def _authenticate(self, require_active_session=True):
        """Authenticate API request using JWT token"""
        try:
            # Get token from Authorization header
            auth_header = request.httprequest.headers.get('Authorization')
            if not auth_header:
                raise AccessDenied("Authorization header required")
            
            if not auth_header.startswith('Bearer '):
                raise AccessDenied("Invalid authorization format. Use 'Bearer <token>'")
            
            token = auth_header[7:]  # Remove 'Bearer ' prefix
            
            # Decode JWT token
            try:
                payload = jwt.decode(
                    token,
                    request.env['ir.config_parameter'].sudo().get_param('pos_api.jwt_secret'),
                    algorithms=['HS256']
                )
            except jwt.ExpiredSignatureError:
                raise AccessDenied("Token has expired")
            except jwt.InvalidTokenError:
                raise AccessDenied("Invalid token")
            
            # Get user from token
            user_id = payload.get('user_id')
            if not user_id:
                raise AccessDenied("Invalid token payload")
            
            user = request.env['res.users'].sudo().browse(user_id)
            if not user.exists() or not user.active:
                raise AccessDenied("User not found or inactive")
            
            # Check session if required
            if require_active_session:
                session_id = payload.get('session_id')
                if session_id:
                    session = request.env['pos.session'].sudo().browse(session_id)
                    if not session.exists() or session.state != 'opened':
                        raise AccessDenied("POS session not active")
            
            # Set authenticated user context
            request.env = request.env(user=user_id)
            return {
                'user': user,
                'user_id': user_id,
                'session_id': payload.get('session_id'),
                'device_id': payload.get('device_id'),
                'permissions': payload.get('permissions', [])
            }
            
        except AccessDenied:
            raise
        except Exception as e:
            _logger.error(f"Authentication error: {e}")
            raise AccessDenied("Authentication failed")
    
    def _check_permissions(self, auth_info, required_permissions):
        """Check if user has required permissions"""
        user_permissions = auth_info.get('permissions', [])
        missing_permissions = [perm for perm in required_permissions if perm not in user_permissions]
        
        if missing_permissions:
            raise AccessDenied(f"Missing permissions: {', '.join(missing_permissions)}")
    
    def _rate_limit_check(self, identifier=None):
        """Check rate limiting for the request"""
        if not identifier:
            identifier = request.httprequest.remote_addr
        
        key = f"rate_limit:{identifier}"
        if not self.rate_limiter.is_allowed(key, limit=100, window=60):
            raise ValidationError("Rate limit exceeded. Maximum 100 requests per minute.")
    
    def _log_api_access(self, endpoint, user_id=None, success=True, error=None):
        """Log API access for monitoring and debugging"""
        log_data = {
            'endpoint': endpoint,
            'user_id': user_id,
            'timestamp': datetime.utcnow(),
            'ip_address': request.httprequest.remote_addr,
            'user_agent': request.httprequest.headers.get('User-Agent'),
            'success': success,
            'error': error
        }
        
        if success:
            _logger.info(f"API Access: {endpoint} - User: {user_id} - IP: {request.httprequest.remote_addr}")
        else:
            _logger.warning(f"API Error: {endpoint} - Error: {error} - IP: {request.httprequest.remote_addr}")


def api_route(route, methods=['GET'], auth=True, rate_limit=True, permissions=None):
    """Decorator for API routes with built-in authentication and rate limiting"""
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            try:
                # Rate limiting check
                if rate_limit:
                    self._rate_limit_check()
                
                # Authentication check
                auth_info = None
                if auth:
                    auth_info = self._authenticate()
                    
                    # Permission check
                    if permissions:
                        self._check_permissions(auth_info, permissions)
                
                # Log API access
                self._log_api_access(
                    endpoint=route,
                    user_id=auth_info.get('user_id') if auth_info else None,
                    success=True
                )
                
                # Call the actual controller method
                return func(self, auth_info=auth_info, *args, **kwargs)
                
            except (AccessDenied, ValidationError) as e:
                self._log_api_access(
                    endpoint=route,
                    user_id=None,
                    success=False,
                    error=str(e)
                )
                return self._error_response(str(e), status=401 if isinstance(e, AccessDenied) else 400)
            
            except Exception as e:
                _logger.error(f"Unexpected API error in {route}: {e}")
                self._log_api_access(
                    endpoint=route,
                    user_id=None,
                    success=False,
                    error=str(e)
                )
                return self._error_response("Internal server error", status=500)
        
        return http.route(route, methods=methods, type='http', auth='none', csrf=False)(wrapper)
    return decorator 