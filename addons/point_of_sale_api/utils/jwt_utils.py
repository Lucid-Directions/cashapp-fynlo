import jwt
import logging
from datetime import datetime, timedelta
from odoo import fields, models, api

_logger = logging.getLogger(__name__)


class JWTUtils:
    """JWT token utilities for POS API authentication"""
    
    @staticmethod
    def generate_token(user_id, session_id=None, device_id=None, permissions=None, expires_in=3600):
        """
        Generate JWT access token
        
        Args:
            user_id (int): User ID
            session_id (int, optional): POS session ID
            device_id (str, optional): Device identifier
            permissions (list, optional): User permissions
            expires_in (int): Token expiration time in seconds
            
        Returns:
            str: JWT token
        """
        try:
            secret = JWTUtils._get_jwt_secret()
            
            payload = {
                'user_id': user_id,
                'exp': datetime.utcnow() + timedelta(seconds=expires_in),
                'iat': datetime.utcnow(),
                'type': 'access'
            }
            
            if session_id:
                payload['session_id'] = session_id
            
            if device_id:
                payload['device_id'] = device_id
            
            if permissions:
                payload['permissions'] = permissions
            
            token = jwt.encode(payload, secret, algorithm='HS256')
            return token
            
        except Exception as e:
            _logger.error(f"Error generating JWT token: {e}")
            raise
    
    @staticmethod
    def generate_refresh_token(user_id, device_id=None, expires_in=86400):
        """
        Generate JWT refresh token
        
        Args:
            user_id (int): User ID
            device_id (str, optional): Device identifier
            expires_in (int): Token expiration time in seconds (default 24 hours)
            
        Returns:
            str: JWT refresh token
        """
        try:
            secret = JWTUtils._get_jwt_secret()
            
            payload = {
                'user_id': user_id,
                'exp': datetime.utcnow() + timedelta(seconds=expires_in),
                'iat': datetime.utcnow(),
                'type': 'refresh'
            }
            
            if device_id:
                payload['device_id'] = device_id
            
            token = jwt.encode(payload, secret, algorithm='HS256')
            return token
            
        except Exception as e:
            _logger.error(f"Error generating refresh token: {e}")
            raise
    
    @staticmethod
    def decode_token(token):
        """
        Decode and validate JWT token
        
        Args:
            token (str): JWT token
            
        Returns:
            dict: Token payload
            
        Raises:
            jwt.ExpiredSignatureError: Token has expired
            jwt.InvalidTokenError: Invalid token
        """
        try:
            secret = JWTUtils._get_jwt_secret()
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            return payload
            
        except jwt.ExpiredSignatureError:
            _logger.warning("JWT token has expired")
            raise
        except jwt.InvalidTokenError as e:
            _logger.warning(f"Invalid JWT token: {e}")
            raise
    
    @staticmethod
    def refresh_access_token(refresh_token):
        """
        Generate new access token using refresh token
        
        Args:
            refresh_token (str): Valid refresh token
            
        Returns:
            dict: New tokens (access_token, refresh_token)
        """
        try:
            payload = JWTUtils.decode_token(refresh_token)
            
            if payload.get('type') != 'refresh':
                raise jwt.InvalidTokenError("Invalid token type")
            
            user_id = payload.get('user_id')
            device_id = payload.get('device_id')
            
            # Generate new tokens
            new_access_token = JWTUtils.generate_token(
                user_id=user_id,
                device_id=device_id,
                expires_in=3600
            )
            
            new_refresh_token = JWTUtils.generate_refresh_token(
                user_id=user_id,
                device_id=device_id,
                expires_in=86400
            )
            
            return {
                'access_token': new_access_token,
                'refresh_token': new_refresh_token,
                'expires_in': 3600
            }
            
        except Exception as e:
            _logger.error(f"Error refreshing token: {e}")
            raise
    
    @staticmethod
    def _get_jwt_secret():
        """Get JWT secret from system parameters"""
        from odoo.http import request
        
        if not hasattr(request, 'env'):
            raise Exception("No request environment available")
        
        secret = request.env['ir.config_parameter'].sudo().get_param('pos_api.jwt_secret')
        if not secret:
            # Generate and store a new secret if none exists
            import secrets
            secret = secrets.token_urlsafe(32)
            request.env['ir.config_parameter'].sudo().set_param('pos_api.jwt_secret', secret)
            _logger.info("Generated new JWT secret")
        
        return secret
    
    @staticmethod
    def get_user_permissions(user):
        """
        Get user permissions for POS API
        
        Args:
            user (res.users): User object
            
        Returns:
            list: List of permissions
        """
        permissions = []
        
        # Check POS access
        if user.has_group('point_of_sale.group_pos_user'):
            permissions.extend([
                'pos.order.read',
                'pos.order.create',
                'pos.payment.process'
            ])
        
        # Check POS manager access
        if user.has_group('point_of_sale.group_pos_manager'):
            permissions.extend([
                'pos.order.update',
                'pos.order.delete',
                'pos.session.manage',
                'pos.config.read',
                'pos.reports.read'
            ])
        
        # Check admin access
        if user.has_group('base.group_system'):
            permissions.append('pos.admin')
        
        return list(set(permissions))  # Remove duplicates 