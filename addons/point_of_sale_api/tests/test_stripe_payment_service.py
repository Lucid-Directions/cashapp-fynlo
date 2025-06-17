# -*- coding: utf-8 -*-

"""
Unit Tests for Stripe Payment Service
Phase 4: Production Readiness - Comprehensive Testing

Tests all functionality of the Stripe payment service including:
- Payment intent creation and management
- 3D Secure authentication flow
- Webhook processing and verification
- Error handling and edge cases
- Performance and security validation
"""

import unittest
import json
import time
from unittest.mock import patch, MagicMock, Mock
from datetime import datetime, timedelta

import odoo
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError, UserError

from .test_config import (
    MOCK_CONFIGS, PERFORMANCE_TARGETS, SECURITY_CONFIG,
    initialize_test_environment, setup_test_logging
)


class TestStripePaymentService(TransactionCase):
    """Comprehensive unit tests for Stripe Payment Service"""
    
    def setUp(self):
        """Set up test environment and fixtures"""
        super().setUp()
        initialize_test_environment()
        self.logger = setup_test_logging()
        
        # Create test environment
        self.stripe_service = self.env['pos.stripe.payment.service'].create({
            'name': 'Test Stripe Service',
            'company_id': self.env.company.id
        })
        
        # Test data fixtures
        self.test_payment_data = {
            'amount': 2997,  # $29.97
            'currency': 'usd',
            'description': 'Test payment for unit testing',
            'metadata': {
                'order_id': 'test_order_123',
                'customer_id': 'test_customer_456'
            }
        }
        
        self.test_customer_data = {
            'name': 'Test Customer',
            'email': 'test@example.com',
            'phone': '+1234567890'
        }
        
        # Mock Stripe responses
        self.mock_stripe_responses = MOCK_CONFIGS['stripe']['mock_responses']
        
    def tearDown(self):
        """Clean up test environment"""
        super().tearDown()
        self.logger.info("Test completed")
    
    # ==========================================
    # PAYMENT INTENT CREATION TESTS
    # ==========================================
    
    @patch('stripe.PaymentIntent.create')
    def test_create_payment_intent_success(self, mock_stripe_create):
        """Test successful payment intent creation"""
        # Arrange
        mock_stripe_create.return_value = Mock(**self.mock_stripe_responses['payment_intent_create'])
        
        # Act
        start_time = time.time()
        result = self.stripe_service.create_payment_intent(
            amount=self.test_payment_data['amount'],
            currency=self.test_payment_data['currency'],
            description=self.test_payment_data['description'],
            metadata=self.test_payment_data['metadata']
        )
        end_time = time.time()
        
        # Assert
        self.assertTrue(result['success'])
        self.assertEqual(result['payment_intent_id'], 'pi_test_1234567890')
        self.assertEqual(result['status'], 'requires_payment_method')
        self.assertEqual(result['amount'], 2997)
        
        # Performance assertion
        response_time = end_time - start_time
        self.assertLess(response_time, PERFORMANCE_TARGETS['api_response_time'],
                       f"Payment intent creation took {response_time:.3f}s, target: {PERFORMANCE_TARGETS['api_response_time']}s")
        
        # Verify Stripe API was called correctly
        mock_stripe_create.assert_called_once()
        call_args = mock_stripe_create.call_args[1]
        self.assertEqual(call_args['amount'], 2997)
        self.assertEqual(call_args['currency'], 'usd')
        
        self.logger.info(f"Payment intent creation test passed in {response_time:.3f}s")
    
    @patch('stripe.PaymentIntent.create')
    def test_create_payment_intent_invalid_amount(self, mock_stripe_create):
        """Test payment intent creation with invalid amount"""
        # Arrange - Invalid amounts
        invalid_amounts = [-100, 0, None, 'invalid', 50.50]  # Stripe expects integers
        
        for invalid_amount in invalid_amounts:
            with self.subTest(amount=invalid_amount):
                # Act & Assert
                result = self.stripe_service.create_payment_intent(
                    amount=invalid_amount,
                    currency='usd'
                )
                
                self.assertFalse(result['success'])
                self.assertIn('error', result)
                self.assertIn('amount', result['error'].lower())
        
        # Verify Stripe API was not called for invalid inputs
        mock_stripe_create.assert_not_called()
    
    @patch('stripe.PaymentIntent.create')
    def test_create_payment_intent_stripe_error(self, mock_stripe_create):
        """Test payment intent creation with Stripe API error"""
        # Arrange
        import stripe
        mock_stripe_create.side_effect = stripe.error.StripeError("Test Stripe error")
        
        # Act
        result = self.stripe_service.create_payment_intent(
            amount=2997,
            currency='usd'
        )
        
        # Assert
        self.assertFalse(result['success'])
        self.assertIn('error', result)
        self.assertEqual(result['error_type'], 'stripe_error')
        self.assertIn('Test Stripe error', result['error'])
    
    # ==========================================
    # PAYMENT CONFIRMATION TESTS
    # ==========================================
    
    @patch('stripe.PaymentIntent.confirm')
    @patch('stripe.PaymentIntent.retrieve')
    def test_confirm_payment_intent_success(self, mock_stripe_retrieve, mock_stripe_confirm):
        """Test successful payment intent confirmation"""
        # Arrange
        payment_intent_id = 'pi_test_1234567890'
        mock_stripe_retrieve.return_value = Mock(**self.mock_stripe_responses['payment_intent_create'])
        mock_stripe_confirm.return_value = Mock(**self.mock_stripe_responses['payment_intent_confirm'])
        
        # Act
        start_time = time.time()
        result = self.stripe_service.confirm_payment_intent(
            payment_intent_id=payment_intent_id,
            payment_method='pm_test_card'
        )
        end_time = time.time()
        
        # Assert
        self.assertTrue(result['success'])
        self.assertEqual(result['payment_intent_id'], payment_intent_id)
        self.assertEqual(result['status'], 'succeeded')
        
        # Performance assertion
        response_time = end_time - start_time
        self.assertLess(response_time, PERFORMANCE_TARGETS['api_response_time'],
                       f"Payment confirmation took {response_time:.3f}s")
        
        # Verify Stripe API calls
        mock_stripe_retrieve.assert_called_once_with(payment_intent_id)
        mock_stripe_confirm.assert_called_once()
        
        self.logger.info(f"Payment confirmation test passed in {response_time:.3f}s")
    
    @patch('stripe.PaymentIntent.retrieve')
    def test_confirm_payment_intent_not_found(self, mock_stripe_retrieve):
        """Test payment intent confirmation with non-existent intent"""
        # Arrange
        import stripe
        mock_stripe_retrieve.side_effect = stripe.error.InvalidRequestError(
            "No such payment_intent", "payment_intent"
        )
        
        # Act
        result = self.stripe_service.confirm_payment_intent(
            payment_intent_id='pi_nonexistent',
            payment_method='pm_test_card'
        )
        
        # Assert
        self.assertFalse(result['success'])
        self.assertEqual(result['error_type'], 'payment_intent_not_found')
        self.assertIn('No such payment_intent', result['error'])
    
    # ==========================================
    # 3D SECURE AUTHENTICATION TESTS
    # ==========================================
    
    @patch('stripe.PaymentIntent.confirm')
    def test_3d_secure_authentication_required(self, mock_stripe_confirm):
        """Test 3D Secure authentication flow"""
        # Arrange
        mock_3ds_response = Mock()
        mock_3ds_response.status = 'requires_action'
        mock_3ds_response.next_action = {
            'type': 'use_stripe_sdk',
            'use_stripe_sdk': {
                'type': 'three_d_secure_redirect',
                'stripe_js': 'https://js.stripe.com/...'
            }
        }
        mock_stripe_confirm.return_value = mock_3ds_response
        
        # Act
        result = self.stripe_service.confirm_payment_intent(
            payment_intent_id='pi_test_3ds',
            payment_method='pm_test_3ds_card'
        )
        
        # Assert
        self.assertTrue(result['success'])
        self.assertEqual(result['status'], 'requires_action')
        self.assertIn('next_action', result)
        self.assertEqual(result['next_action']['type'], 'use_stripe_sdk')
        
        self.logger.info("3D Secure authentication test passed")
    
    # ==========================================
    # WEBHOOK PROCESSING TESTS
    # ==========================================
    
    def test_process_webhook_valid_signature(self):
        """Test webhook processing with valid signature"""
        # Arrange
        webhook_payload = json.dumps({
            'id': 'evt_test_webhook',
            'type': 'payment_intent.succeeded',
            'data': {
                'object': {
                    'id': 'pi_test_1234567890',
                    'status': 'succeeded',
                    'amount': 2997
                }
            }
        })
        
        # Mock valid signature
        with patch('stripe.Webhook.construct_event') as mock_construct:
            mock_construct.return_value = json.loads(webhook_payload)
            
            # Act
            result = self.stripe_service.process_webhook(
                payload=webhook_payload,
                signature='test_signature'
            )
            
            # Assert
            self.assertTrue(result['success'])
            self.assertEqual(result['event_type'], 'payment_intent.succeeded')
            self.assertEqual(result['payment_intent_id'], 'pi_test_1234567890')
    
    def test_process_webhook_invalid_signature(self):
        """Test webhook processing with invalid signature"""
        # Arrange
        webhook_payload = json.dumps({'test': 'data'})
        
        # Mock invalid signature
        with patch('stripe.Webhook.construct_event') as mock_construct:
            import stripe
            mock_construct.side_effect = stripe.error.SignatureVerificationError(
                "Invalid signature", "test_signature"
            )
            
            # Act
            result = self.stripe_service.process_webhook(
                payload=webhook_payload,
                signature='invalid_signature'
            )
            
            # Assert
            self.assertFalse(result['success'])
            self.assertEqual(result['error_type'], 'invalid_signature')
    
    # ==========================================
    # REFUND PROCESSING TESTS
    # ==========================================
    
    @patch('stripe.Refund.create')
    def test_create_refund_success(self, mock_stripe_refund):
        """Test successful refund creation"""
        # Arrange
        mock_refund_response = Mock()
        mock_refund_response.id = 're_test_refund_123'
        mock_refund_response.status = 'succeeded'
        mock_refund_response.amount = 1500  # Partial refund
        mock_stripe_refund.return_value = mock_refund_response
        
        # Act
        start_time = time.time()
        result = self.stripe_service.create_refund(
            payment_intent_id='pi_test_1234567890',
            amount=1500,  # $15.00 partial refund
            reason='requested_by_customer'
        )
        end_time = time.time()
        
        # Assert
        self.assertTrue(result['success'])
        self.assertEqual(result['refund_id'], 're_test_refund_123')
        self.assertEqual(result['status'], 'succeeded')
        self.assertEqual(result['amount'], 1500)
        
        # Performance assertion
        response_time = end_time - start_time
        self.assertLess(response_time, PERFORMANCE_TARGETS['api_response_time'])
        
        # Verify Stripe API call
        mock_stripe_refund.assert_called_once()
        call_args = mock_stripe_refund.call_args[1]
        self.assertEqual(call_args['payment_intent'], 'pi_test_1234567890')
        self.assertEqual(call_args['amount'], 1500)
    
    # ==========================================
    # ERROR HANDLING TESTS
    # ==========================================
    
    def test_error_handling_network_error(self):
        """Test error handling for network connectivity issues"""
        # Arrange
        with patch('stripe.PaymentIntent.create') as mock_stripe_create:
            import requests
            mock_stripe_create.side_effect = requests.exceptions.ConnectionError("Network error")
            
            # Act
            result = self.stripe_service.create_payment_intent(
                amount=2997,
                currency='usd'
            )
            
            # Assert
            self.assertFalse(result['success'])
            self.assertEqual(result['error_type'], 'network_error')
            self.assertIn('connectivity', result['error'].lower())
    
    def test_error_handling_rate_limit(self):
        """Test error handling for rate limiting"""
        # Arrange
        with patch('stripe.PaymentIntent.create') as mock_stripe_create:
            import stripe
            mock_stripe_create.side_effect = stripe.error.RateLimitError("Rate limit exceeded")
            
            # Act
            result = self.stripe_service.create_payment_intent(
                amount=2997,
                currency='usd'
            )
            
            # Assert
            self.assertFalse(result['success'])
            self.assertEqual(result['error_type'], 'rate_limit_error')
            self.assertIn('rate limit', result['error'].lower())
    
    # ==========================================
    # SECURITY TESTS
    # ==========================================
    
    def test_security_api_key_validation(self):
        """Test API key validation and security"""
        # Test with invalid API key format
        invalid_keys = ['', 'invalid_key', 'pk_test_invalid', None]
        
        for invalid_key in invalid_keys:
            with self.subTest(api_key=invalid_key):
                # Create service with invalid key
                service = self.env['pos.stripe.payment.service'].create({
                    'name': 'Test Invalid Key Service',
                    'stripe_api_key': invalid_key,
                    'company_id': self.env.company.id
                })
                
                # Test operation with invalid key
                result = service.create_payment_intent(amount=2997, currency='usd')
                
                self.assertFalse(result['success'])
                self.assertIn('api_key', result['error'].lower())
    
    def test_security_input_sanitization(self):
        """Test input sanitization against injection attacks"""
        # Test SQL injection patterns
        malicious_inputs = SECURITY_CONFIG['vulnerability_scan']['sql_injection_payloads']
        
        for malicious_input in malicious_inputs:
            with self.subTest(input=malicious_input):
                # Test with malicious description
                result = self.stripe_service.create_payment_intent(
                    amount=2997,
                    currency='usd',
                    description=malicious_input
                )
                
                # Should either sanitize input or reject it
                if result['success']:
                    # If accepted, ensure it's sanitized
                    self.assertNotIn('DROP TABLE', str(result))
                    self.assertNotIn('UNION SELECT', str(result))
                else:
                    # If rejected, should have appropriate error
                    self.assertIn('input', result['error'].lower())
    
    # ==========================================
    # PERFORMANCE TESTS
    # ==========================================
    
    @patch('stripe.PaymentIntent.create')
    def test_performance_concurrent_requests(self, mock_stripe_create):
        """Test performance under concurrent request load"""
        import threading
        import queue
        
        # Arrange
        mock_stripe_create.return_value = Mock(**self.mock_stripe_responses['payment_intent_create'])
        
        # Performance test parameters
        num_threads = 50
        requests_per_thread = 20
        results_queue = queue.Queue()
        
        def make_requests():
            """Make multiple payment intent requests"""
            thread_results = []
            for i in range(requests_per_thread):
                start_time = time.time()
                result = self.stripe_service.create_payment_intent(
                    amount=2997 + i,  # Vary amount slightly
                    currency='usd'
                )
                end_time = time.time()
                
                thread_results.append({
                    'success': result['success'],
                    'response_time': end_time - start_time
                })
            
            results_queue.put(thread_results)
        
        # Act
        threads = []
        start_time = time.time()
        
        for _ in range(num_threads):
            thread = threading.Thread(target=make_requests)
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        end_time = time.time()
        
        # Collect results
        all_results = []
        while not results_queue.empty():
            all_results.extend(results_queue.get())
        
        # Assert
        total_requests = len(all_results)
        successful_requests = sum(1 for r in all_results if r['success'])
        total_time = end_time - start_time
        requests_per_second = total_requests / total_time
        
        # Performance assertions
        success_rate = successful_requests / total_requests
        self.assertGreater(success_rate, 0.95, f"Success rate {success_rate:.2%} below 95%")
        
        avg_response_time = sum(r['response_time'] for r in all_results) / total_requests
        self.assertLess(avg_response_time, PERFORMANCE_TARGETS['api_response_time'],
                       f"Average response time {avg_response_time:.3f}s exceeds target")
        
        self.logger.info(f"Performance test: {total_requests} requests in {total_time:.2f}s "
                        f"({requests_per_second:.1f} req/s), {success_rate:.2%} success rate")
    
    # ==========================================
    # INTEGRATION HELPER TESTS
    # ==========================================
    
    def test_health_check(self):
        """Test service health check functionality"""
        # Act
        health_status = self.stripe_service.get_health_status()
        
        # Assert
        self.assertIn('healthy', health_status)
        self.assertIn('api_connectivity', health_status)
        self.assertIn('configuration_valid', health_status)
        self.assertIn('last_check', health_status)
        
        # Health check should be fast
        start_time = time.time()
        self.stripe_service.get_health_status()
        end_time = time.time()
        
        self.assertLess(end_time - start_time, 0.1,  # 100ms for health check
                       "Health check took too long")
    
    def test_audit_logging(self):
        """Test that all operations are properly logged for audit purposes"""
        # Act - Perform operation that should be logged
        with patch('stripe.PaymentIntent.create') as mock_stripe_create:
            mock_stripe_create.return_value = Mock(**self.mock_stripe_responses['payment_intent_create'])
            
            result = self.stripe_service.create_payment_intent(
                amount=2997,
                currency='usd',
                description='Audit test payment'
            )
        
        # Assert - Check that audit log was created
        audit_logs = self.env['pos.audit.log'].search([
            ('action', '=', 'stripe_payment_intent_create'),
            ('entity_id', '=', result.get('payment_intent_id'))
        ])
        
        self.assertTrue(audit_logs, "Audit log not created for payment intent creation")
        
        audit_log = audit_logs[0]
        self.assertEqual(audit_log.user_id, self.env.user)
        self.assertIn('amount', audit_log.details)
        self.assertIn('2997', audit_log.details)


if __name__ == '__main__':
    unittest.main() 