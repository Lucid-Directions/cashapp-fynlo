import json
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError, AccessDenied
from odoo.addons.point_of_sale_api.controllers.payments import PaymentsController


class TestPaymentsController(TransactionCase):
    """Test cases for PaymentsController endpoints"""

    def setUp(self):
        super().setUp()
        self.controller = PaymentsController()
        
        # Create test user with POS access
        self.test_user = self.env['res.users'].create({
            'name': 'Test POS User',
            'login': 'test_pos_user',
            'email': 'test@example.com',
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
        
        # Create test payment method
        self.payment_method_cash = self.env['pos.payment.method'].create({
            'name': 'Cash',
            'is_cash_count': True,
            'active': True,
        })
        
        self.payment_method_card = self.env['pos.payment.method'].create({
            'name': 'Credit Card',
            'is_cash_count': False,
            'use_payment_terminal': True,
            'active': True,
        })
        
        # Create test order
        self.test_order = self.env['pos.order'].create({
            'session_id': self.pos_session.id,
            'user_id': self.test_user.id,
            'config_id': self.pos_config.id,
            'company_id': self.pos_config.company_id.id,
            'state': 'draft',
            'amount_total': 100.00,
        })

    @patch('odoo.http.request')
    def test_create_payment_success(self, mock_request):
        """Test successful payment creation"""
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'order_id': self.test_order.id,
            'payment_method_id': self.payment_method_cash.id,
            'amount': 100.00,
            'reference': 'TXN_123456'
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.payment.process']
        }
        
        # Call endpoint
        response = self.controller.create_payment(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertIn('id', response_data['data'])
        self.assertEqual(response_data['data']['amount'], 100.00)
        self.assertEqual(response_data['data']['payment_method_name'], 'Cash')

    @patch('odoo.http.request')
    def test_create_payment_invalid_order(self, mock_request):
        """Test payment creation with invalid order"""
        # Mock request data with invalid order ID
        mock_request.httprequest.get_json.return_value = {
            'order_id': 99999,
            'payment_method_id': self.payment_method_cash.id,
            'amount': 100.00
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.payment.process']
        }
        
        # Call endpoint
        response = self.controller.create_payment(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertFalse(response_data['success'])
        self.assertEqual(response.status_code, 400)

    @patch('odoo.http.request')
    def test_create_payment_invalid_amount(self, mock_request):
        """Test payment creation with invalid amount"""
        # Mock request data with negative amount
        mock_request.httprequest.get_json.return_value = {
            'order_id': self.test_order.id,
            'payment_method_id': self.payment_method_cash.id,
            'amount': -50.00
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.payment.process']
        }
        
        # Call endpoint
        response = self.controller.create_payment(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertFalse(response_data['success'])
        self.assertEqual(response.status_code, 400)

    @patch('odoo.http.request')
    def test_get_payment_success(self, mock_request):
        """Test successful payment retrieval"""
        # Create a test payment
        payment = self.env['pos.payment'].create({
            'pos_order_id': self.test_order.id,
            'payment_method_id': self.payment_method_cash.id,
            'amount': 50.00,
            'session_id': self.pos_session.id,
        })
        
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.payment.process']
        }
        
        # Call endpoint
        response = self.controller.get_payment(payment.id, auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['data']['id'], payment.id)
        self.assertEqual(response_data['data']['amount'], 50.00)

    @patch('odoo.http.request')
    def test_get_payment_not_found(self, mock_request):
        """Test payment retrieval with non-existent ID"""
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.payment.process']
        }
        
        # Call endpoint with non-existent ID
        response = self.controller.get_payment(99999, auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertFalse(response_data['success'])
        self.assertEqual(response.status_code, 404)

    @patch('odoo.http.request')
    def test_capture_payment_success(self, mock_request):
        """Test successful payment capture"""
        # Create a pending payment
        payment = self.env['pos.payment'].create({
            'pos_order_id': self.test_order.id,
            'payment_method_id': self.payment_method_card.id,
            'amount': 100.00,
            'session_id': self.pos_session.id,
        })
        # Set payment status to pending (would normally be set by payment processor)
        payment.write({'payment_status': 'pending'})
        
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'amount': 100.00,
            'reference': 'CAPTURE_123456'
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.payment.process']
        }
        
        # Call endpoint
        response = self.controller.capture_payment(payment.id, auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['message'], "Payment captured successfully")

    @patch('odoo.http.request')
    def test_refund_payment_success(self, mock_request):
        """Test successful payment refund"""
        # Create a completed payment
        payment = self.env['pos.payment'].create({
            'pos_order_id': self.test_order.id,
            'payment_method_id': self.payment_method_card.id,
            'amount': 100.00,
            'session_id': self.pos_session.id,
        })
        payment.write({'payment_status': 'done'})
        
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'amount': 30.00,
            'reason': 'Customer return'
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.payment.process']
        }
        
        # Call endpoint
        response = self.controller.refund_payment(payment.id, auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['data']['amount'], -30.00)  # Negative for refund

    @patch('odoo.http.request')
    def test_refund_payment_invalid_amount(self, mock_request):
        """Test payment refund with invalid amount"""
        # Create a completed payment
        payment = self.env['pos.payment'].create({
            'pos_order_id': self.test_order.id,
            'payment_method_id': self.payment_method_card.id,
            'amount': 100.00,
            'session_id': self.pos_session.id,
        })
        payment.write({'payment_status': 'done'})
        
        # Mock request data with amount exceeding original payment
        mock_request.httprequest.get_json.return_value = {
            'amount': 150.00,
            'reason': 'Customer return'
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.payment.process']
        }
        
        # Call endpoint
        response = self.controller.refund_payment(payment.id, auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertFalse(response_data['success'])
        self.assertEqual(response.status_code, 400)

    @patch('odoo.http.request')
    def test_void_payment_success(self, mock_request):
        """Test successful payment void"""
        # Create a pending payment
        payment = self.env['pos.payment'].create({
            'pos_order_id': self.test_order.id,
            'payment_method_id': self.payment_method_card.id,
            'amount': 100.00,
            'session_id': self.pos_session.id,
        })
        payment.write({'payment_status': 'pending'})
        
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'reason': 'Order cancelled'
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.payment.process']
        }
        
        # Call endpoint
        response = self.controller.void_payment(payment.id, auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['message'], "Payment voided successfully")

    @patch('odoo.http.request')
    def test_get_payment_methods_success(self, mock_request):
        """Test successful payment methods retrieval"""
        # Mock request parameters
        mock_request.httprequest.args.get.return_value = None
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint
        response = self.controller.get_payment_methods(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertIn('payment_methods', response_data['data'])
        
        # Should find our test payment methods
        method_names = [method['name'] for method in response_data['data']['payment_methods']]
        self.assertIn('Cash', method_names)
        self.assertIn('Credit Card', method_names)

    @patch('odoo.http.request')
    def test_create_apple_pay_session_success(self, mock_request):
        """Test successful Apple Pay session creation"""
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'validation_url': 'https://apple-pay-gateway.apple.com/paymentservices/startSession',
            'domain_name': 'example.com'
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.payment.process']
        }
        
        # Call endpoint
        response = self.controller.create_apple_pay_session(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertIn('session_id', response_data['data'])
        self.assertIn('merchant_identifier', response_data['data'])
        self.assertEqual(response_data['data']['domain_name'], 'example.com')

    @patch('odoo.http.request')
    def test_process_apple_pay_payment_success(self, mock_request):
        """Test successful Apple Pay payment processing"""
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'order_id': self.test_order.id,
            'payment_token': 'encrypted_apple_pay_token_data',
            'amount': 100.00
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.payment.process']
        }
        
        # Call endpoint
        response = self.controller.process_apple_pay_payment(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['data']['amount'], 100.00)
        self.assertEqual(response_data['data']['card_type'], 'apple_pay')
        self.assertIn('apple_pay_result', response_data['data'])

    def test_serialize_payment(self):
        """Test payment serialization"""
        # Create a test payment
        payment = self.env['pos.payment'].create({
            'pos_order_id': self.test_order.id,
            'payment_method_id': self.payment_method_cash.id,
            'amount': 75.50,
            'session_id': self.pos_session.id,
            'transaction_id': 'TXN_TEST_123',
            'card_type': 'visa',
            'cardholder_name': 'John Doe',
        })
        
        # Serialize payment
        serialized = self.controller._serialize_payment(payment)
        
        # Check required fields
        self.assertEqual(serialized['id'], payment.id)
        self.assertEqual(serialized['amount'], 75.50)
        self.assertEqual(serialized['payment_method_name'], 'Cash')
        self.assertEqual(serialized['transaction_id'], 'TXN_TEST_123')
        self.assertEqual(serialized['card_type'], 'visa')
        self.assertEqual(serialized['cardholder_name'], 'John Doe')

    def test_serialize_payment_method(self):
        """Test payment method serialization"""
        # Serialize payment method
        serialized = self.controller._serialize_payment_method(self.payment_method_cash)
        
        # Check required fields
        self.assertEqual(serialized['id'], self.payment_method_cash.id)
        self.assertEqual(serialized['name'], 'Cash')
        self.assertTrue(serialized['is_cash_count'])
        self.assertFalse(serialized['use_payment_terminal'])

    def test_can_access_order(self):
        """Test order access control"""
        auth_info = {
            'user_id': self.test_user.id
        }
        
        # User should be able to access their own order
        can_access = self.controller._can_access_order(self.test_order, auth_info)
        self.assertTrue(can_access)
        
        # Create another user and order
        other_user = self.env['res.users'].create({
            'name': 'Other User',
            'login': 'other_user',
            'email': 'other@example.com',
        })
        
        other_session = self.env['pos.session'].create({
            'config_id': self.pos_config.id,
            'user_id': other_user.id,
            'state': 'opened'
        })
        
        other_order = self.env['pos.order'].create({
            'session_id': other_session.id,
            'user_id': other_user.id,
            'config_id': self.pos_config.id,
            'company_id': self.pos_config.company_id.id,
            'state': 'draft',
        })
        
        # User should not be able to access other user's order
        can_access = self.controller._can_access_order(other_order, auth_info)
        self.assertFalse(can_access)

    def tearDown(self):
        """Clean up test data"""
        super().tearDown()
        self.test_order.unlink()
        self.pos_session.unlink()
        self.pos_config.unlink()
        self.payment_method_cash.unlink()
        self.payment_method_card.unlink()
        self.test_user.unlink() 