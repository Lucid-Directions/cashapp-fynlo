import json
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

from odoo.tests.common import TransactionCase
from odoo.exceptions import AccessDenied, ValidationError
from odoo.addons.point_of_sale_api.controllers.auth import AuthController
from odoo.addons.point_of_sale_api.utils.jwt_utils import JWTUtils


class TestAuthController(TransactionCase):
    """Test cases for AuthController endpoints"""

    def setUp(self):
        super().setUp()
        self.controller = AuthController()
        
        # Create test user
        self.test_user = self.env['res.users'].create({
            'name': 'Test POS User',
            'login': 'test_pos_user',
            'email': 'test@example.com',
            'password': 'testpassword123',
            'groups_id': [(6, 0, [self.env.ref('point_of_sale.group_pos_user').id])]
        })
        
        # Create POS config and session
        self.pos_config = self.env['pos.config'].create({
            'name': 'Test POS Config',
            'active': True,
        })
        
        self.pos_session = self.env['pos.session'].create({
            'config_id': self.pos_config.id,
            'user_id': self.test_user.id,
            'state': 'opened'
        })

    @patch('odoo.http.request')
    def test_login_success(self, mock_request):
        """Test successful login"""
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'username': 'test_pos_user',
            'password': 'testpassword123',
            'device_id': 'test_device_123'
        }
        mock_request.httprequest.is_json = True
        mock_request.httprequest.remote_addr = '127.0.0.1'
        mock_request.env = self.env
        
        # Mock user authentication
        with patch.object(self.test_user, '_check_credentials') as mock_check:
            mock_check.return_value = True
            
            # Call login endpoint
            response = self.controller.login()
            
            # Parse response
            response_data = json.loads(response.data.decode())
            
            # Assertions
            self.assertTrue(response_data['success'])
            self.assertIn('access_token', response_data['data'])
            self.assertIn('refresh_token', response_data['data'])
            self.assertEqual(response_data['data']['user']['login'], 'test_pos_user')
            self.assertEqual(response.status_code, 200)

    @patch('odoo.http.request')
    def test_login_invalid_credentials(self, mock_request):
        """Test login with invalid credentials"""
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'username': 'test_pos_user',
            'password': 'wrongpassword'
        }
        mock_request.httprequest.is_json = True
        mock_request.httprequest.remote_addr = '127.0.0.1'
        mock_request.env = self.env
        
        # Mock user authentication failure
        with patch.object(self.test_user, '_check_credentials') as mock_check:
            mock_check.side_effect = AccessDenied("Invalid credentials")
            
            # Call login endpoint
            response = self.controller.login()
            
            # Parse response
            response_data = json.loads(response.data.decode())
            
            # Assertions
            self.assertFalse(response_data['success'])
            self.assertEqual(response.status_code, 401)

    @patch('odoo.http.request')
    def test_login_missing_fields(self, mock_request):
        """Test login with missing required fields"""
        # Mock request data with missing password
        mock_request.httprequest.get_json.return_value = {
            'username': 'test_pos_user'
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Call login endpoint
        response = self.controller.login()
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertFalse(response_data['success'])
        self.assertEqual(response.status_code, 400)

    @patch('odoo.http.request')
    def test_login_inactive_user(self, mock_request):
        """Test login with inactive user"""
        # Make user inactive
        self.test_user.active = False
        
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'username': 'test_pos_user',
            'password': 'testpassword123'
        }
        mock_request.httprequest.is_json = True
        mock_request.httprequest.remote_addr = '127.0.0.1'
        mock_request.env = self.env
        
        # Call login endpoint
        response = self.controller.login()
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertFalse(response_data['success'])
        self.assertEqual(response.status_code, 401)

    @patch('odoo.http.request')
    def test_logout_success(self, mock_request):
        """Test successful logout"""
        mock_request.httprequest.remote_addr = '127.0.0.1'
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'device_id': 'test_device_123'
        }
        
        # Call logout endpoint
        response = self.controller.logout(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertEqual(response.status_code, 200)

    @patch('odoo.http.request')
    def test_refresh_token_success(self, mock_request):
        """Test successful token refresh"""
        # Generate a refresh token
        refresh_token = JWTUtils.generate_refresh_token(
            user_id=self.test_user.id,
            device_id='test_device_123'
        )
        
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'refresh_token': refresh_token
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock JWT secret
        with patch('odoo.addons.point_of_sale_api.utils.jwt_utils.JWTUtils._get_jwt_secret') as mock_secret:
            mock_secret.return_value = 'test_secret_key'
            
            # Call refresh endpoint
            response = self.controller.refresh_token()
            
            # Parse response
            response_data = json.loads(response.data.decode())
            
            # Assertions
            self.assertTrue(response_data['success'])
            self.assertIn('access_token', response_data['data'])
            self.assertIn('refresh_token', response_data['data'])
            self.assertEqual(response.status_code, 200)

    @patch('odoo.http.request')
    def test_validate_token_success(self, mock_request):
        """Test successful token validation"""
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user': self.test_user,
            'user_id': self.test_user.id,
            'session_id': self.pos_session.id,
            'permissions': ['pos.order.read', 'pos.order.create']
        }
        
        # Call validate endpoint
        response = self.controller.validate_token(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertTrue(response_data['data']['valid'])
        self.assertEqual(response_data['data']['user']['id'], self.test_user.id)
        self.assertIn('session', response_data['data'])
        self.assertEqual(response.status_code, 200)

    @patch('odoo.http.request')
    def test_forgot_password_success(self, mock_request):
        """Test forgot password request"""
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'email': 'test@example.com'
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Call forgot password endpoint
        response = self.controller.forgot_password()
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertEqual(response.status_code, 200)

    @patch('odoo.http.request')
    def test_forgot_password_nonexistent_email(self, mock_request):
        """Test forgot password with non-existent email"""
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'email': 'nonexistent@example.com'
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Call forgot password endpoint
        response = self.controller.forgot_password()
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Should still return success to prevent email enumeration
        self.assertTrue(response_data['success'])
        self.assertEqual(response.status_code, 200)

    def test_get_user_role(self):
        """Test user role determination"""
        # Test regular POS user
        role = self.controller._get_user_role(self.test_user)
        self.assertEqual(role, 'user')
        
        # Test manager user
        manager_user = self.env['res.users'].create({
            'name': 'Test Manager',
            'login': 'test_manager',
            'email': 'manager@example.com',
            'groups_id': [(6, 0, [self.env.ref('point_of_sale.group_pos_manager').id])]
        })
        role = self.controller._get_user_role(manager_user)
        self.assertEqual(role, 'manager')

    def test_json_validation(self):
        """Test JSON validation utility"""
        # Test valid JSON validation
        with patch('odoo.http.request') as mock_request:
            mock_request.httprequest.is_json = True
            mock_request.httprequest.get_json.return_value = {
                'username': 'test',
                'password': 'test123'
            }
            
            result = self.controller._validate_json(['username', 'password'])
            self.assertEqual(result['username'], 'test')
            self.assertEqual(result['password'], 'test123')

    def test_json_validation_missing_fields(self):
        """Test JSON validation with missing fields"""
        with patch('odoo.http.request') as mock_request:
            mock_request.httprequest.is_json = True
            mock_request.httprequest.get_json.return_value = {
                'username': 'test'
            }
            
            with self.assertRaises(ValidationError):
                self.controller._validate_json(['username', 'password'])

    def test_json_validation_invalid_content_type(self):
        """Test JSON validation with invalid content type"""
        with patch('odoo.http.request') as mock_request:
            mock_request.httprequest.is_json = False
            
            with self.assertRaises(ValidationError):
                self.controller._validate_json(['username', 'password'])

    def tearDown(self):
        """Clean up test data"""
        super().tearDown()
        self.test_user.unlink()
        self.pos_session.unlink()
        self.pos_config.unlink() 