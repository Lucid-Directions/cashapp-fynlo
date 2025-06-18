import logging
import stripe
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import hashlib
import hmac

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError
from odoo.tools import config

_logger = logging.getLogger(__name__)


class StripePaymentService(models.Model):
    """Production-ready Stripe Payment Service for Phase 2"""
    _name = 'pos.stripe.payment.service'
    _description = 'Stripe Payment Service'
    
    # Configuration fields
    name = fields.Char('Service Name', default='Production Stripe Service')
    api_key = fields.Char('Stripe Secret Key', required=True)
    publishable_key = fields.Char('Stripe Publishable Key', required=True)
    webhook_secret = fields.Char('Webhook Endpoint Secret', required=True)
    
    # Environment settings
    environment = fields.Selection([
        ('test', 'Test Mode'),
        ('live', 'Live Mode')
    ], string='Environment', default='test', required=True)
    
    # Feature flags
    enable_apple_pay = fields.Boolean('Enable Apple Pay', default=True)
    enable_google_pay = fields.Boolean('Enable Google Pay', default=True)
    enable_3d_secure = fields.Boolean('Enable 3D Secure', default=True)
    auto_capture = fields.Boolean('Auto Capture Payments', default=True)
    
    # Business settings
    company_id = fields.Many2one('res.company', 'Company', default=lambda self: self.env.company)
    currency_id = fields.Many2one('res.currency', 'Default Currency', default=lambda self: self.env.company.currency_id)
    
    # Status
    active = fields.Boolean('Active', default=True)
    last_health_check = fields.Datetime('Last Health Check')
    health_status = fields.Selection([
        ('healthy', 'Healthy'),
        ('warning', 'Warning'),
        ('error', 'Error')
    ], string='Health Status', default='healthy')
    
    def _get_stripe_instance(self):
        """Get configured Stripe instance"""
        if not self.api_key:
            raise UserError("Stripe API key not configured")
        
        stripe.api_key = self.api_key
        stripe.api_version = "2023-10-16"  # Latest stable version
        
        return stripe
    
    @api.model
    def create_payment_intent(self, amount: float, currency: str = 'usd', 
                            order_data: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """Create Stripe PaymentIntent"""
        try:
            stripe_client = self._get_stripe_instance()
            
            # Convert amount to cents
            amount_cents = int(amount * 100)
            
            # Prepare metadata
            metadata = {
                'pos_order_id': order_data.get('order_id') if order_data else None,
                'pos_session_id': order_data.get('session_id') if order_data else None,
                'table_id': order_data.get('table_id') if order_data else None,
                'customer_name': order_data.get('customer_name') if order_data else None,
                'created_by': self.env.user.name,
                'environment': self.environment
            }
            
            # Remove None values
            metadata = {k: v for k, v in metadata.items() if v is not None}
            
            # Payment methods configuration
            payment_method_types = ['card']
            if self.enable_apple_pay:
                payment_method_types.extend(['apple_pay', 'google_pay'])
            
            # Create PaymentIntent
            intent_data = {
                'amount': amount_cents,
                'currency': currency.lower(),
                'payment_method_types': payment_method_types,
                'capture_method': 'automatic' if self.auto_capture else 'manual',
                'confirmation_method': 'automatic',
                'metadata': metadata,
                'description': f"POS Order {order_data.get('order_id', 'N/A')}" if order_data else "POS Payment"
            }
            
            # Add 3D Secure if enabled
            if self.enable_3d_secure:
                intent_data['payment_method_options'] = {
                    'card': {
                        'request_three_d_secure': 'automatic'
                    }
                }
            
            # Add customer if provided
            if order_data and order_data.get('customer_email'):
                intent_data['receipt_email'] = order_data['customer_email']
            
            payment_intent = stripe_client.PaymentIntent.create(**intent_data)
            
            # Log successful creation
            self._log_transaction('payment_intent_created', {
                'intent_id': payment_intent.id,
                'amount': amount,
                'currency': currency,
                'status': payment_intent.status
            })
            
            return {
                'success': True,
                'payment_intent': {
                    'id': payment_intent.id,
                    'client_secret': payment_intent.client_secret,
                    'status': payment_intent.status,
                    'amount': amount,
                    'currency': currency
                }
            }
            
        except stripe.error.StripeError as e:
            _logger.error(f"Stripe PaymentIntent creation failed: {e}")
            self._log_transaction('payment_intent_failed', {
                'error': str(e),
                'amount': amount,
                'currency': currency
            })
            return {
                'success': False,
                'error': str(e),
                'error_type': 'stripe_error'
            }
        except Exception as e:
            _logger.error(f"PaymentIntent creation error: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'system_error'
            }
    
    def confirm_payment_intent(self, payment_intent_id: str, payment_method_id: str = None) -> Dict[str, Any]:
        """Confirm PaymentIntent with payment method"""
        try:
            stripe_client = self._get_stripe_instance()
            
            confirm_data = {}
            if payment_method_id:
                confirm_data['payment_method'] = payment_method_id
            
            payment_intent = stripe_client.PaymentIntent.confirm(
                payment_intent_id,
                **confirm_data
            )
            
            self._log_transaction('payment_confirmed', {
                'intent_id': payment_intent.id,
                'status': payment_intent.status,
                'payment_method': payment_method_id
            })
            
            return {
                'success': True,
                'payment_intent': {
                    'id': payment_intent.id,
                    'status': payment_intent.status,
                    'amount': payment_intent.amount / 100,
                    'currency': payment_intent.currency
                }
            }
            
        except stripe.error.StripeError as e:
            _logger.error(f"Payment confirmation failed: {e}")
            self._log_transaction('payment_confirmation_failed', {
                'intent_id': payment_intent_id,
                'error': str(e)
            })
            return {
                'success': False,
                'error': str(e),
                'error_type': 'stripe_error'
            }
    
    def capture_payment_intent(self, payment_intent_id: str, amount: float = None) -> Dict[str, Any]:
        """Capture authorized PaymentIntent"""
        try:
            stripe_client = self._get_stripe_instance()
            
            capture_data = {}
            if amount is not None:
                capture_data['amount_to_capture'] = int(amount * 100)
            
            payment_intent = stripe_client.PaymentIntent.capture(
                payment_intent_id,
                **capture_data
            )
            
            self._log_transaction('payment_captured', {
                'intent_id': payment_intent.id,
                'amount': payment_intent.amount / 100,
                'status': payment_intent.status
            })
            
            return {
                'success': True,
                'payment_intent': {
                    'id': payment_intent.id,
                    'status': payment_intent.status,
                    'amount_captured': payment_intent.amount / 100
                }
            }
            
        except stripe.error.StripeError as e:
            _logger.error(f"Payment capture failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'stripe_error'
            }
    
    def create_refund(self, payment_intent_id: str, amount: float = None, 
                     reason: str = 'requested_by_customer') -> Dict[str, Any]:
        """Create refund for PaymentIntent"""
        try:
            stripe_client = self._get_stripe_instance()
            
            refund_data = {
                'payment_intent': payment_intent_id,
                'reason': reason
            }
            
            if amount is not None:
                refund_data['amount'] = int(amount * 100)
            
            refund = stripe_client.Refund.create(**refund_data)
            
            self._log_transaction('refund_created', {
                'refund_id': refund.id,
                'payment_intent_id': payment_intent_id,
                'amount': refund.amount / 100,
                'status': refund.status
            })
            
            return {
                'success': True,
                'refund': {
                    'id': refund.id,
                    'status': refund.status,
                    'amount': refund.amount / 100,
                    'payment_intent': payment_intent_id
                }
            }
            
        except stripe.error.StripeError as e:
            _logger.error(f"Refund creation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'stripe_error'
            }
    
    def cancel_payment_intent(self, payment_intent_id: str, reason: str = 'requested_by_customer') -> Dict[str, Any]:
        """Cancel PaymentIntent"""
        try:
            stripe_client = self._get_stripe_instance()
            
            payment_intent = stripe_client.PaymentIntent.cancel(
                payment_intent_id,
                cancellation_reason=reason
            )
            
            self._log_transaction('payment_canceled', {
                'intent_id': payment_intent.id,
                'status': payment_intent.status,
                'reason': reason
            })
            
            return {
                'success': True,
                'payment_intent': {
                    'id': payment_intent.id,
                    'status': payment_intent.status
                }
            }
            
        except stripe.error.StripeError as e:
            _logger.error(f"Payment cancellation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'stripe_error'
            }
    
    def get_payment_intent(self, payment_intent_id: str) -> Dict[str, Any]:
        """Retrieve PaymentIntent details"""
        try:
            stripe_client = self._get_stripe_instance()
            
            payment_intent = stripe_client.PaymentIntent.retrieve(payment_intent_id)
            
            return {
                'success': True,
                'payment_intent': {
                    'id': payment_intent.id,
                    'status': payment_intent.status,
                    'amount': payment_intent.amount / 100,
                    'currency': payment_intent.currency,
                    'payment_method': payment_intent.payment_method,
                    'created': payment_intent.created,
                    'metadata': payment_intent.metadata
                }
            }
            
        except stripe.error.StripeError as e:
            _logger.error(f"PaymentIntent retrieval failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'stripe_error'
            }
    
    def process_webhook(self, payload: str, signature: str) -> Dict[str, Any]:
        """Process Stripe webhook with signature verification"""
        try:
            # Verify webhook signature
            event = stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )
            
            event_type = event['type']
            event_data = event['data']['object']
            
            # Log webhook received
            self._log_transaction('webhook_received', {
                'event_type': event_type,
                'event_id': event.get('id'),
                'object_id': event_data.get('id')
            })
            
            # Process different event types
            if event_type == 'payment_intent.succeeded':
                self._handle_payment_success(event_data)
            elif event_type == 'payment_intent.payment_failed':
                self._handle_payment_failure(event_data)
            elif event_type == 'payment_intent.canceled':
                self._handle_payment_canceled(event_data)
            elif event_type == 'refund.created':
                self._handle_refund_created(event_data)
            elif event_type == 'charge.dispute.created':
                self._handle_dispute_created(event_data)
            else:
                _logger.info(f"Unhandled webhook event type: {event_type}")
            
            return {
                'success': True,
                'event_type': event_type,
                'processed': True
            }
            
        except stripe.error.SignatureVerificationError as e:
            _logger.error(f"Webhook signature verification failed: {e}")
            return {
                'success': False,
                'error': 'Invalid signature',
                'error_type': 'signature_error'
            }
        except Exception as e:
            _logger.error(f"Webhook processing error: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'processing_error'
            }
    
    def _handle_payment_success(self, payment_intent_data: Dict[str, Any]):
        """Handle successful payment webhook"""
        try:
            intent_id = payment_intent_data.get('id')
            amount = payment_intent_data.get('amount', 0) / 100
            
            # Find related POS order
            pos_payment = self.env['pos.payment'].search([
                ('stripe_payment_intent_id', '=', intent_id)
            ], limit=1)
            
            if pos_payment:
                # Update payment status
                pos_payment.write({
                    'payment_status': 'paid',
                    'payment_date': fields.Datetime.now()
                })
                
                # Trigger WebSocket notification
                self._notify_payment_success(pos_payment)
                
            self._log_transaction('webhook_payment_success', {
                'intent_id': intent_id,
                'amount': amount,
                'pos_payment_found': bool(pos_payment)
            })
            
        except Exception as e:
            _logger.error(f"Error handling payment success webhook: {e}")
    
    def _handle_payment_failure(self, payment_intent_data: Dict[str, Any]):
        """Handle failed payment webhook"""
        try:
            intent_id = payment_intent_data.get('id')
            error = payment_intent_data.get('last_payment_error', {})
            
            # Find related POS order
            pos_payment = self.env['pos.payment'].search([
                ('stripe_payment_intent_id', '=', intent_id)
            ], limit=1)
            
            if pos_payment:
                pos_payment.write({
                    'payment_status': 'failed',
                    'error_message': error.get('message', 'Payment failed')
                })
                
                # Trigger WebSocket notification
                self._notify_payment_failure(pos_payment, error.get('message', 'Payment failed'))
            
            self._log_transaction('webhook_payment_failure', {
                'intent_id': intent_id,
                'error': error.get('message'),
                'pos_payment_found': bool(pos_payment)
            })
            
        except Exception as e:
            _logger.error(f"Error handling payment failure webhook: {e}")
    
    def _handle_refund_created(self, refund_data: Dict[str, Any]):
        """Handle refund created webhook"""
        try:
            refund_id = refund_data.get('id')
            payment_intent_id = refund_data.get('payment_intent')
            amount = refund_data.get('amount', 0) / 100
            
            # Find related payment
            pos_payment = self.env['pos.payment'].search([
                ('stripe_payment_intent_id', '=', payment_intent_id)
            ], limit=1)
            
            if pos_payment:
                # Create refund record
                self.env['pos.payment.refund'].create({
                    'payment_id': pos_payment.id,
                    'refund_id': refund_id,
                    'amount': amount,
                    'status': refund_data.get('status', 'pending'),
                    'created_date': fields.Datetime.now()
                })
                
                # Trigger WebSocket notification
                self._notify_refund_processed(pos_payment, amount)
            
            self._log_transaction('webhook_refund_created', {
                'refund_id': refund_id,
                'payment_intent_id': payment_intent_id,
                'amount': amount
            })
            
        except Exception as e:
            _logger.error(f"Error handling refund webhook: {e}")
    
    def _notify_payment_success(self, pos_payment):
        """Send WebSocket notification for successful payment"""
        try:
            websocket_service = self.env['pos.websocket.service']
            websocket_service.broadcast_event('payment.processed', {
                'payment_id': pos_payment.id,
                'order_id': pos_payment.pos_order_id.id if pos_payment.pos_order_id else None,
                'amount': pos_payment.amount,
                'status': 'success',
                'timestamp': fields.Datetime.now().isoformat()
            })
        except Exception as e:
            _logger.error(f"Failed to send payment success notification: {e}")
    
    def _notify_payment_failure(self, pos_payment, error_message):
        """Send WebSocket notification for failed payment"""
        try:
            websocket_service = self.env['pos.websocket.service']
            websocket_service.broadcast_event('payment.failed', {
                'payment_id': pos_payment.id,
                'order_id': pos_payment.pos_order_id.id if pos_payment.pos_order_id else None,
                'amount': pos_payment.amount,
                'error': error_message,
                'timestamp': fields.Datetime.now().isoformat()
            })
        except Exception as e:
            _logger.error(f"Failed to send payment failure notification: {e}")
    
    def _notify_refund_processed(self, pos_payment, refund_amount):
        """Send WebSocket notification for processed refund"""
        try:
            websocket_service = self.env['pos.websocket.service']
            websocket_service.broadcast_event('refund.processed', {
                'payment_id': pos_payment.id,
                'order_id': pos_payment.pos_order_id.id if pos_payment.pos_order_id else None,
                'refund_amount': refund_amount,
                'timestamp': fields.Datetime.now().isoformat()
            })
        except Exception as e:
            _logger.error(f"Failed to send refund notification: {e}")
    
    def _log_transaction(self, transaction_type: str, data: Dict[str, Any]):
        """Log transaction for monitoring and debugging"""
        try:
            self.env['pos.stripe.transaction.log'].create({
                'service_id': self.id,
                'transaction_type': transaction_type,
                'transaction_data': json.dumps(data, default=str),
                'timestamp': fields.Datetime.now(),
                'user_id': self.env.user.id
            })
        except Exception as e:
            _logger.error(f"Failed to log transaction: {e}")
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check on Stripe service"""
        try:
            stripe_client = self._get_stripe_instance()
            
            # Test API connection
            stripe_client.Account.retrieve()
            
            # Update health status
            self.write({
                'last_health_check': fields.Datetime.now(),
                'health_status': 'healthy'
            })
            
            return {
                'success': True,
                'status': 'healthy',
                'timestamp': fields.Datetime.now().isoformat()
            }
            
        except stripe.error.AuthenticationError:
            self.write({'health_status': 'error'})
            return {
                'success': False,
                'status': 'error',
                'error': 'Authentication failed - check API keys'
            }
        except Exception as e:
            self.write({'health_status': 'warning'})
            return {
                'success': False,
                'status': 'warning',
                'error': str(e)
            }


class StripeTransactionLog(models.Model):
    """Stripe transaction logging for monitoring"""
    _name = 'pos.stripe.transaction.log'
    _description = 'Stripe Transaction Log'
    _order = 'timestamp desc'
    
    service_id = fields.Many2one('pos.stripe.payment.service', 'Stripe Service', required=True)
    transaction_type = fields.Char('Transaction Type', required=True)
    transaction_data = fields.Text('Transaction Data')
    timestamp = fields.Datetime('Timestamp', required=True)
    user_id = fields.Many2one('res.users', 'User')
    
    def cleanup_old_logs(self, days_to_keep: int = 30):
        """Clean up old transaction logs"""
        cutoff_date = fields.Datetime.now() - timedelta(days=days_to_keep)
        old_logs = self.search([('timestamp', '<', cutoff_date)])
        old_logs.unlink()
        
        return len(old_logs) 