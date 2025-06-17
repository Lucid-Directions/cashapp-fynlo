# -*- coding: utf-8 -*-

"""
Payment Integration Tests
Phase 4: Production Readiness - Day 2 Integration Testing

Comprehensive integration tests for payment services including:
- Stripe + Apple Pay + Transaction Manager integration
- End-to-end payment workflows
- Multi-payment processing
- Transaction rollback and error recovery
- Real-time payment notifications
- Cross-service state synchronization
"""

import unittest
import json
import time
import asyncio
from unittest.mock import patch, MagicMock, Mock
from datetime import datetime, timedelta

import odoo
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError, UserError

from .test_config import (
    MOCK_CONFIGS, PERFORMANCE_TARGETS, TEST_FIXTURES,
    initialize_test_environment, setup_test_logging
)


class TestPaymentIntegration(TransactionCase):
    """Integration tests for payment services cross-functionality"""
    
    def setUp(self):
        """Set up integration test environment"""
        super().setUp()
        initialize_test_environment()
        self.logger = setup_test_logging()
        
        # Create integrated test services
        self.stripe_service = self.env['pos.stripe.payment.service'].create({
            'name': 'Integration Test Stripe Service',
            'company_id': self.env.company.id
        })
        
        self.apple_pay_service = self.env['pos.apple.pay.service'].create({
            'name': 'Integration Test Apple Pay Service',
            'company_id': self.env.company.id
        })
        
        self.transaction_manager = self.env['pos.transaction.manager'].create({
            'name': 'Integration Test Transaction Manager',
            'company_id': self.env.company.id
        })
        
        # Create test order for integration testing
        self.test_order = self.env['pos.order'].create({
            'partner_id': self.env['res.partner'].create({
                'name': 'Integration Test Customer',
                'email': 'integration@test.com'
            }).id,
            'lines': [(0, 0, {
                'product_id': self.env['product.product'].create({
                    'name': 'Integration Test Product',
                    'list_price': 29.97
                }).id,
                'qty': 1,
                'price_unit': 29.97
            })],
            'amount_total': 29.97,
            'state': 'draft'
        })
        
        # Mock external services
        self.mock_stripe_responses = MOCK_CONFIGS['stripe']['mock_responses']
        self.mock_apple_pay_responses = MOCK_CONFIGS['apple_pay']
        
    def tearDown(self):
        """Clean up integration test environment"""
        super().tearDown()
        self.logger.info("Integration test completed")
    
    # ==========================================
    # STRIPE + TRANSACTION MANAGER INTEGRATION
    # ==========================================
    
    @patch('stripe.PaymentIntent.create')
    @patch('stripe.PaymentIntent.confirm')
    def test_stripe_transaction_manager_integration(self, mock_stripe_confirm, mock_stripe_create):
        """Test complete Stripe payment workflow through Transaction Manager"""
        # Arrange
        mock_stripe_create.return_value = Mock(**self.mock_stripe_responses['payment_intent_create'])
        mock_stripe_confirm.return_value = Mock(**self.mock_stripe_responses['payment_intent_confirm'])
        
        # Act - Process complete payment through integration
        start_time = time.time()
        
        # Step 1: Create payment intent through transaction manager
        payment_result = self.transaction_manager.process_stripe_payment(
            order_id=self.test_order.id,
            amount=2997,
            currency='usd',
            payment_method='pm_test_card'
        )
        
        # Step 2: Confirm payment through transaction manager
        confirmation_result = self.transaction_manager.confirm_stripe_payment(
            payment_intent_id=payment_result['payment_intent_id'],
            order_id=self.test_order.id
        )
        
        end_time = time.time()
        
        # Assert
        self.assertTrue(payment_result['success'], "Payment creation failed")
        self.assertTrue(confirmation_result['success'], "Payment confirmation failed")
        self.assertEqual(confirmation_result['status'], 'succeeded')
        
        # Verify order state updated
        self.test_order.refresh()
        self.assertEqual(self.test_order.state, 'paid')
        
        # Verify payment record created
        payment_logs = self.env['pos.payment.log'].search([
            ('order_id', '=', self.test_order.id),
            ('payment_method', '=', 'stripe')
        ])
        self.assertTrue(payment_logs, "Payment log not created")
        
        # Performance assertion
        total_time = end_time - start_time
        self.assertLess(total_time, PERFORMANCE_TARGETS['api_response_time'] * 2,
                       f"Integrated payment workflow took {total_time:.3f}s")
        
        self.logger.info(f"Stripe + Transaction Manager integration test passed in {total_time:.3f}s")
    
    # ==========================================
    # APPLE PAY + TRANSACTION MANAGER INTEGRATION
    # ==========================================
    
    @patch('requests.post')  # Mock Apple Pay merchant validation
    def test_apple_pay_transaction_manager_integration(self, mock_apple_pay_request):
        """Test complete Apple Pay workflow through Transaction Manager"""
        # Arrange
        mock_apple_pay_request.return_value.json.return_value = self.mock_apple_pay_responses['mock_validation_response']
        mock_apple_pay_request.return_value.status_code = 200
        
        # Mock Apple Pay payment token
        apple_pay_token = {
            'paymentData': 'encrypted_payment_data',
            'paymentMethod': {
                'displayName': 'Visa ****1234',
                'network': 'Visa'
            },
            'transactionIdentifier': 'apple_pay_test_txn_123'
        }
        
        # Act - Process Apple Pay payment through integration
        start_time = time.time()
        
        # Step 1: Validate merchant through transaction manager
        validation_result = self.transaction_manager.validate_apple_pay_merchant(
            validation_url='https://apple-pay-gateway.apple.com/paymentservices/startSession',
            domain_name='test.fynlo.com'
        )
        
        # Step 2: Process Apple Pay token through transaction manager
        payment_result = self.transaction_manager.process_apple_pay_payment(
            order_id=self.test_order.id,
            payment_token=apple_pay_token,
            amount=2997
        )
        
        end_time = time.time()
        
        # Assert
        self.assertTrue(validation_result['success'], "Apple Pay merchant validation failed")
        self.assertTrue(payment_result['success'], "Apple Pay payment processing failed")
        
        # Verify order state updated
        self.test_order.refresh()
        self.assertEqual(self.test_order.state, 'paid')
        
        # Verify payment record created
        payment_logs = self.env['pos.payment.log'].search([
            ('order_id', '=', self.test_order.id),
            ('payment_method', '=', 'apple_pay')
        ])
        self.assertTrue(payment_logs, "Apple Pay payment log not created")
        
        # Performance assertion
        total_time = end_time - start_time
        self.assertLess(total_time, PERFORMANCE_TARGETS['api_response_time'] * 2,
                       f"Apple Pay integration workflow took {total_time:.3f}s")
        
        self.logger.info(f"Apple Pay + Transaction Manager integration test passed in {total_time:.3f}s")
    
    # ==========================================
    # MULTI-PAYMENT INTEGRATION
    # ==========================================
    
    @patch('stripe.PaymentIntent.create')
    @patch('stripe.PaymentIntent.confirm')
    def test_multi_payment_integration(self, mock_stripe_confirm, mock_stripe_create):
        """Test multi-payment processing with Stripe + Cash integration"""
        # Arrange
        mock_stripe_create.return_value = Mock(**{
            **self.mock_stripe_responses['payment_intent_create'],
            'amount': 1500  # Partial payment
        })
        mock_stripe_confirm.return_value = Mock(**{
            **self.mock_stripe_responses['payment_intent_confirm'],
            'amount': 1500
        })
        
        # Create larger order for multi-payment
        large_order = self.env['pos.order'].create({
            'partner_id': self.test_order.partner_id.id,
            'lines': [(0, 0, {
                'product_id': self.test_order.lines[0].product_id.id,
                'qty': 2,
                'price_unit': 29.97
            })],
            'amount_total': 59.94,
            'state': 'draft'
        })
        
        # Act - Process multi-payment
        start_time = time.time()
        
        # Step 1: Process partial Stripe payment ($15.00)
        stripe_result = self.transaction_manager.process_stripe_payment(
            order_id=large_order.id,
            amount=1500,  # $15.00
            currency='usd',
            payment_method='pm_test_card',
            is_partial_payment=True
        )
        
        # Step 2: Process remaining cash payment ($44.94)
        cash_result = self.transaction_manager.process_cash_payment(
            order_id=large_order.id,
            amount=4494,  # $44.94
            is_partial_payment=True
        )
        
        # Step 3: Finalize multi-payment transaction
        finalization_result = self.transaction_manager.finalize_multi_payment(
            order_id=large_order.id
        )
        
        end_time = time.time()
        
        # Assert
        self.assertTrue(stripe_result['success'], "Stripe partial payment failed")
        self.assertTrue(cash_result['success'], "Cash partial payment failed")
        self.assertTrue(finalization_result['success'], "Multi-payment finalization failed")
        
        # Verify order fully paid
        large_order.refresh()
        self.assertEqual(large_order.state, 'paid')
        self.assertEqual(large_order.amount_paid, 59.94)
        
        # Verify multiple payment logs created
        payment_logs = self.env['pos.payment.log'].search([
            ('order_id', '=', large_order.id)
        ])
        self.assertEqual(len(payment_logs), 2, "Expected 2 payment logs for multi-payment")
        
        # Verify payment methods
        payment_methods = set(payment_logs.mapped('payment_method'))
        self.assertEqual(payment_methods, {'stripe', 'cash'})
        
        # Performance assertion
        total_time = end_time - start_time
        self.assertLess(total_time, PERFORMANCE_TARGETS['api_response_time'] * 3,
                       f"Multi-payment integration took {total_time:.3f}s")
        
        self.logger.info(f"Multi-payment integration test passed in {total_time:.3f}s")
    
    # ==========================================
    # PAYMENT FAILURE AND ROLLBACK INTEGRATION
    # ==========================================
    
    @patch('stripe.PaymentIntent.create')
    @patch('stripe.PaymentIntent.confirm')
    def test_payment_failure_rollback_integration(self, mock_stripe_confirm, mock_stripe_create):
        """Test payment failure handling and transaction rollback"""
        # Arrange
        mock_stripe_create.return_value = Mock(**self.mock_stripe_responses['payment_intent_create'])
        
        # Mock payment failure
        import stripe
        mock_stripe_confirm.side_effect = stripe.error.CardError(
            "Your card was declined.", "card_declined", "card_declined"
        )
        
        original_order_state = self.test_order.state
        
        # Act - Process payment that will fail
        start_time = time.time()
        
        payment_result = self.transaction_manager.process_stripe_payment(
            order_id=self.test_order.id,
            amount=2997,
            currency='usd',
            payment_method='pm_test_card_declined'
        )
        
        end_time = time.time()
        
        # Assert
        self.assertFalse(payment_result['success'], "Payment should have failed")
        self.assertEqual(payment_result['error_type'], 'card_declined')
        
        # Verify order state rolled back
        self.test_order.refresh()
        self.assertEqual(self.test_order.state, original_order_state)
        
        # Verify no payment log created for failed payment
        payment_logs = self.env['pos.payment.log'].search([
            ('order_id', '=', self.test_order.id),
            ('status', '=', 'succeeded')
        ])
        self.assertFalse(payment_logs, "No successful payment log should exist")
        
        # Verify error log created
        error_logs = self.env['pos.payment.log'].search([
            ('order_id', '=', self.test_order.id),
            ('status', '=', 'failed')
        ])
        self.assertTrue(error_logs, "Error log should be created for failed payment")
        
        # Performance assertion - even failures should be fast
        total_time = end_time - start_time
        self.assertLess(total_time, PERFORMANCE_TARGETS['api_response_time'],
                       f"Payment failure handling took {total_time:.3f}s")
        
        self.logger.info(f"Payment failure rollback test passed in {total_time:.3f}s")
    
    # ==========================================
    # WEBSOCKET INTEGRATION FOR REAL-TIME UPDATES
    # ==========================================
    
    @patch('stripe.PaymentIntent.create')
    @patch('stripe.PaymentIntent.confirm')
    def test_websocket_payment_integration(self, mock_stripe_confirm, mock_stripe_create):
        """Test real-time payment updates via WebSocket integration"""
        # Arrange
        mock_stripe_create.return_value = Mock(**self.mock_stripe_responses['payment_intent_create'])
        mock_stripe_confirm.return_value = Mock(**self.mock_stripe_responses['payment_intent_confirm'])
        
        # Mock WebSocket service
        websocket_service = self.env['pos.websocket.service']
        sent_messages = []
        
        def mock_send_message(channel, message, message_type='payment_update'):
            sent_messages.append({
                'channel': channel,
                'message': message,
                'type': message_type,
                'timestamp': time.time()
            })
        
        # Patch WebSocket send method
        with patch.object(websocket_service, 'send_to_channel', side_effect=mock_send_message):
            # Act - Process payment with WebSocket notifications
            start_time = time.time()
            
            payment_result = self.transaction_manager.process_stripe_payment(
                order_id=self.test_order.id,
                amount=2997,
                currency='usd',
                payment_method='pm_test_card',
                enable_websocket_updates=True
            )
            
            end_time = time.time()
        
        # Assert
        self.assertTrue(payment_result['success'], "Payment should succeed")
        
        # Verify WebSocket messages sent
        self.assertGreater(len(sent_messages), 0, "WebSocket messages should be sent")
        
        # Verify payment status messages
        payment_messages = [msg for msg in sent_messages if msg['type'] == 'payment_update']
        self.assertGreater(len(payment_messages), 0, "Payment update messages should be sent")
        
        # Verify message content
        final_message = payment_messages[-1]
        self.assertIn('payment_intent_id', final_message['message'])
        self.assertIn('status', final_message['message'])
        self.assertEqual(final_message['message']['status'], 'succeeded')
        
        # Performance assertion - WebSocket integration shouldn't slow down payments significantly
        total_time = end_time - start_time
        self.assertLess(total_time, PERFORMANCE_TARGETS['api_response_time'] * 1.5,
                       f"WebSocket payment integration took {total_time:.3f}s")
        
        self.logger.info(f"WebSocket payment integration test passed in {total_time:.3f}s")
    
    # ==========================================
    # CONCURRENT PAYMENT PROCESSING INTEGRATION
    # ==========================================
    
    @patch('stripe.PaymentIntent.create')
    @patch('stripe.PaymentIntent.confirm')
    def test_concurrent_payment_processing_integration(self, mock_stripe_confirm, mock_stripe_create):
        """Test concurrent payment processing without conflicts"""
        import threading
        import queue
        
        # Arrange
        mock_stripe_create.return_value = Mock(**self.mock_stripe_responses['payment_intent_create'])
        mock_stripe_confirm.return_value = Mock(**self.mock_stripe_responses['payment_intent_confirm'])
        
        # Create multiple test orders
        test_orders = []
        for i in range(5):
            order = self.env['pos.order'].create({
                'partner_id': self.test_order.partner_id.id,
                'lines': [(0, 0, {
                    'product_id': self.test_order.lines[0].product_id.id,
                    'qty': 1,
                    'price_unit': 19.99 + i  # Vary amounts
                })],
                'amount_total': 19.99 + i,
                'state': 'draft'
            })
            test_orders.append(order)
        
        results_queue = queue.Queue()
        
        def process_concurrent_payment(order):
            """Process payment for a single order"""
            try:
                start_time = time.time()
                result = self.transaction_manager.process_stripe_payment(
                    order_id=order.id,
                    amount=int(order.amount_total * 100),
                    currency='usd',
                    payment_method='pm_test_card'
                )
                end_time = time.time()
                
                results_queue.put({
                    'order_id': order.id,
                    'success': result['success'],
                    'duration': end_time - start_time,
                    'payment_intent_id': result.get('payment_intent_id')
                })
            except Exception as e:
                results_queue.put({
                    'order_id': order.id,
                    'success': False,
                    'error': str(e),
                    'duration': 0
                })
        
        # Act - Process multiple payments concurrently
        threads = []
        start_time = time.time()
        
        for order in test_orders:
            thread = threading.Thread(target=process_concurrent_payment, args=(order,))
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        end_time = time.time()
        
        # Collect results
        results = []
        while not results_queue.empty():
            results.append(results_queue.get())
        
        # Assert
        self.assertEqual(len(results), len(test_orders), "All concurrent payments should complete")
        
        successful_payments = [r for r in results if r['success']]
        self.assertEqual(len(successful_payments), len(test_orders), "All payments should succeed")
        
        # Verify all orders updated
        for order in test_orders:
            order.refresh()
            self.assertEqual(order.state, 'paid', f"Order {order.id} should be paid")
        
        # Verify no data conflicts
        payment_intent_ids = [r['payment_intent_id'] for r in successful_payments]
        self.assertEqual(len(set(payment_intent_ids)), len(payment_intent_ids), 
                        "All payment intent IDs should be unique")
        
        # Performance assertion
        total_time = end_time - start_time
        avg_time = sum(r['duration'] for r in results) / len(results)
        
        self.assertLess(avg_time, PERFORMANCE_TARGETS['api_response_time'],
                       f"Average concurrent payment time {avg_time:.3f}s exceeds target")
        
        self.logger.info(f"Concurrent payment integration test: {len(results)} payments in {total_time:.3f}s")
    
    # ==========================================
    # AUDIT AND COMPLIANCE INTEGRATION
    # ==========================================
    
    @patch('stripe.PaymentIntent.create')
    @patch('stripe.PaymentIntent.confirm')
    def test_audit_compliance_integration(self, mock_stripe_confirm, mock_stripe_create):
        """Test complete audit trail and compliance tracking"""
        # Arrange
        mock_stripe_create.return_value = Mock(**self.mock_stripe_responses['payment_intent_create'])
        mock_stripe_confirm.return_value = Mock(**self.mock_stripe_responses['payment_intent_confirm'])
        
        # Act - Process payment with full audit tracking
        payment_result = self.transaction_manager.process_stripe_payment(
            order_id=self.test_order.id,
            amount=2997,
            currency='usd',
            payment_method='pm_test_card',
            enable_audit_logging=True
        )
        
        # Assert
        self.assertTrue(payment_result['success'], "Payment should succeed")
        
        # Verify comprehensive audit logs created
        audit_logs = self.env['pos.audit.log'].search([
            ('order_id', '=', self.test_order.id)
        ])
        self.assertGreater(len(audit_logs), 0, "Audit logs should be created")
        
        # Verify audit log contains required compliance data
        payment_audit = audit_logs.filtered(lambda l: l.action == 'payment_processed')
        self.assertTrue(payment_audit, "Payment processing audit log should exist")
        
        audit_details = json.loads(payment_audit.details)
        required_fields = ['payment_intent_id', 'amount', 'currency', 'timestamp', 'user_id', 'ip_address']
        
        for field in required_fields:
            self.assertIn(field, audit_details, f"Audit log should contain {field}")
        
        # Verify PCI DSS compliance data masking
        self.assertNotIn('card_number', audit_details, "Card number should not be in audit logs")
        self.assertNotIn('cvv', audit_details, "CVV should not be in audit logs")
        
        # Verify data retention policy applied
        self.assertTrue(payment_audit.retention_date, "Retention date should be set")
        
        self.logger.info("Audit compliance integration test passed")


if __name__ == '__main__':
    unittest.main() 