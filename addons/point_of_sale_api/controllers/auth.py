import json
import logging
from datetime import datetime, timedelta

from odoo import http, fields
from odoo.http import request
from odoo.exceptions import AccessDenied, ValidationError
from odoo.addons.point_of_sale_api.controllers.base import POSAPIController, api_route
from odoo.addons.point_of_sale_api.utils.jwt_utils import JWTUtils

_logger = logging.getLogger(__name__)


class AuthController(POSAPIController):
    """Authentication endpoints for POS API"""

    @api_route('/api/v1/auth/login', methods=['POST'], auth=False, rate_limit=True)
    def login(self, auth_info=None):
        """
        Authenticate user and return JWT tokens
        
        POST /api/v1/auth/login
        {
            "username": "user@domain.com",
            "password": "password",
            "device_id": "optional_device_id"
        }
        """
        try:
            # Validate request data
            data = self._validate_json(['username', 'password'])
            
            username = data.get('username')
            password = data.get('password')
            device_id = data.get('device_id')
            
            # Authenticate user
            user = request.env['res.users'].sudo().search([
                ('login', '=', username),
                ('active', '=', True)
            ], limit=1)
            
            if not user:
                raise AccessDenied("Invalid username or password")
            
            # Check password
            try:
                user._check_credentials(password, user_agent_env={})
            except AccessDenied:
                # Log failed login attempt
                self._log_failed_login(username, request.httprequest.remote_addr)
                raise AccessDenied("Invalid username or password")
            
            # Check if user has POS access
            if not user.has_group('point_of_sale.group_pos_user'):
                raise AccessDenied("User does not have POS access")
            
            # Get user permissions
            permissions = JWTUtils.get_user_permissions(user)
            
            # Find active POS session (optional)
            pos_session = None
            pos_config = request.env['pos.config'].sudo().search([
                ('active', '=', True)
            ], limit=1)
            
            if pos_config:
                pos_session = request.env['pos.session'].sudo().search([
                    ('config_id', '=', pos_config.id),
                    ('state', '=', 'opened'),
                    ('user_id', '=', user.id)
                ], limit=1)
            
            # Generate tokens
            access_token = JWTUtils.generate_token(
                user_id=user.id,
                session_id=pos_session.id if pos_session else None,
                device_id=device_id,
                permissions=permissions,
                expires_in=3600  # 1 hour
            )
            
            refresh_token = JWTUtils.generate_refresh_token(
                user_id=user.id,
                device_id=device_id,
                expires_in=86400  # 24 hours
            )
            
            # Log successful login
            self._log_successful_login(user.id, device_id, request.httprequest.remote_addr)
            
            # Prepare response data
            response_data = {
                'access_token': access_token,
                'refresh_token': refresh_token,
                'token_type': 'Bearer',
                'expires_in': 3600,
                'user': {
                    'id': user.id,
                    'name': user.name,
                    'login': user.login,
                    'email': user.email,
                    'role': self._get_user_role(user),
                    'permissions': permissions
                }
            }
            
            if pos_session:
                response_data['session'] = {
                    'id': pos_session.id,
                    'name': pos_session.name,
                    'state': pos_session.state,
                    'config_name': pos_session.config_id.name
                }
            
            return self._json_response(response_data, message="Login successful")
            
        except (AccessDenied, ValidationError) as e:
            return self._error_response(str(e), status=401)
        except Exception as e:
            _logger.error(f"Login error: {e}")
            return self._error_response("Authentication failed", status=500)

    @api_route('/api/v1/auth/logout', methods=['POST'], auth=True)
    def logout(self, auth_info=None):
        """
        Logout user and invalidate tokens
        
        POST /api/v1/auth/logout
        """
        try:
            user_id = auth_info.get('user_id')
            device_id = auth_info.get('device_id')
            
            # Log logout
            self._log_logout(user_id, device_id, request.httprequest.remote_addr)
            
            # In a production system, you would add token to blacklist
            # For now, we'll just return success
            
            return self._json_response(message="Logout successful")
            
        except Exception as e:
            _logger.error(f"Logout error: {e}")
            return self._error_response("Logout failed", status=500)

    @api_route('/api/v1/auth/refresh', methods=['POST'], auth=False)
    def refresh_token(self, auth_info=None):
        """
        Refresh access token using refresh token
        
        POST /api/v1/auth/refresh
        {
            "refresh_token": "refresh_token_here"
        }
        """
        try:
            # Validate request data
            data = self._validate_json(['refresh_token'])
            refresh_token = data.get('refresh_token')
            
            # Refresh tokens
            new_tokens = JWTUtils.refresh_access_token(refresh_token)
            
            return self._json_response(new_tokens, message="Token refreshed successfully")
            
        except Exception as e:
            _logger.error(f"Token refresh error: {e}")
            return self._error_response("Token refresh failed", status=401)

    @api_route('/api/v1/auth/validate', methods=['GET'], auth=True)
    def validate_token(self, auth_info=None):
        """
        Validate current token and return user info
        
        GET /api/v1/auth/validate
        """
        try:
            user = auth_info.get('user')
            session_id = auth_info.get('session_id')
            
            response_data = {
                'valid': True,
                'user': {
                    'id': user.id,
                    'name': user.name,
                    'login': user.login,
                    'email': user.email,
                    'role': self._get_user_role(user),
                    'permissions': auth_info.get('permissions', [])
                },
                'expires_at': (datetime.utcnow() + timedelta(hours=1)).isoformat()
            }
            
            if session_id:
                pos_session = request.env['pos.session'].sudo().browse(session_id)
                if pos_session.exists():
                    response_data['session'] = {
                        'id': pos_session.id,
                        'name': pos_session.name,
                        'state': pos_session.state,
                        'config_name': pos_session.config_id.name
                    }
            
            return self._json_response(response_data)
            
        except Exception as e:
            _logger.error(f"Token validation error: {e}")
            return self._error_response("Token validation failed", status=401)

    @api_route('/api/v1/auth/forgot-password', methods=['POST'], auth=False, rate_limit=True)
    def forgot_password(self, auth_info=None):
        """
        Initiate password reset process
        
        POST /api/v1/auth/forgot-password
        {
            "email": "user@domain.com"
        }
        """
        try:
            # Validate request data
            data = self._validate_json(['email'])
            email = data.get('email')
            
            # Find user by email
            user = request.env['res.users'].sudo().search([
                ('email', '=', email),
                ('active', '=', True)
            ], limit=1)
            
            if user:
                # Generate reset token (simplified for demo)
                reset_token = request.env['auth.signup.token'].sudo().create({
                    'user_id': user.id,
                    'email': email,
                    'token': request.env['auth.signup.token']._generate_signup_token(),
                    'expiration': datetime.now() + timedelta(hours=24)
                })
                
                # In production, send email with reset link
                # For now, just log the token
                _logger.info(f"Password reset token for {email}: {reset_token.token}")
            
            # Always return success to prevent email enumeration
            return self._json_response(
                message="If the email exists, a password reset link has been sent"
            )
            
        except Exception as e:
            _logger.error(f"Password reset error: {e}")
            return self._error_response("Password reset failed", status=500)

    @api_route('/api/v1/auth/reset-password', methods=['POST'], auth=False, rate_limit=True)
    def reset_password(self, auth_info=None):
        """
        Reset password using reset token
        
        POST /api/v1/auth/reset-password
        {
            "token": "reset_token",
            "new_password": "new_password"
        }
        """
        try:
            # Validate request data
            data = self._validate_json(['token', 'new_password'])
            token = data.get('token')
            new_password = data.get('new_password')
            
            # Validate password strength
            if len(new_password) < 8:
                raise ValidationError("Password must be at least 8 characters long")
            
            # Find and validate token
            reset_token = request.env['auth.signup.token'].sudo().search([
                ('token', '=', token),
                ('expiration', '>', datetime.now())
            ], limit=1)
            
            if not reset_token:
                raise ValidationError("Invalid or expired reset token")
            
            # Update user password
            user = reset_token.user_id
            user.write({'password': new_password})
            
            # Delete used token
            reset_token.unlink()
            
            # Log password reset
            _logger.info(f"Password reset successful for user {user.login}")
            
            return self._json_response(message="Password reset successful")
            
        except ValidationError as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Password reset error: {e}")
            return self._error_response("Password reset failed", status=500)

    def _get_user_role(self, user):
        """Get user role for API response"""
        if user.has_group('base.group_system'):
            return 'admin'
        elif user.has_group('point_of_sale.group_pos_manager'):
            return 'manager'
        elif user.has_group('point_of_sale.group_pos_user'):
            return 'user'
        else:
            return 'guest'

    def _log_successful_login(self, user_id, device_id, ip_address):
        """Log successful login attempt"""
        request.env['pos.api.session.log'].sudo().create({
            'user_id': user_id,
            'device_id': device_id,
            'ip_address': ip_address,
            'action': 'login',
            'success': True,
            'timestamp': fields.Datetime.now()
        })

    def _log_failed_login(self, username, ip_address):
        """Log failed login attempt"""
        request.env['pos.api.session.log'].sudo().create({
            'username': username,
            'ip_address': ip_address,
            'action': 'login',
            'success': False,
            'timestamp': fields.Datetime.now()
        })

    def _log_logout(self, user_id, device_id, ip_address):
        """Log logout"""
        request.env['pos.api.session.log'].sudo().create({
            'user_id': user_id,
            'device_id': device_id,
            'ip_address': ip_address,
            'action': 'logout',
            'success': True,
            'timestamp': fields.Datetime.now()
        }) 