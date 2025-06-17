import logging
import json
from datetime import datetime
from typing import Dict, Any, List

from odoo import http
from odoo.http import request
from odoo.exceptions import ValidationError, UserError
from odoo.addons.point_of_sale_api.controllers.base import POSAPIController

_logger = logging.getLogger(__name__)


class PaymentAPIController(POSAPIController):
    """Payment Processing API for Phase 2"""

    # ============================================================================
    # STRIPE PAYMENT ENDPOINTS
    # ============================================================================

    @http.route('/api/v1/payments/stripe/create-intent', methods=['POST'], auth='user', csrf=False, cors='*')
    def create_stripe_payment_intent(self):
        """Create Stripe PaymentIntent"""
        try:
            data = self._get_json_data()
            required_fields = ['amount', 'currency']
            
            validation_result = self._validate_required_fields(data, required_fields)
            if not validation_result['success']:
                return self._error_response(validation_result['error'], status=400)
            
            # Get Stripe service
            stripe_service = request.env['pos.stripe.payment.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not stripe_service:
                return self._error_response("Stripe service not configured", status=503)
            
            # Create payment intent
            result = stripe_service.create_payment_intent(
                amount=data['amount'],
                currency=data.get('currency', 'usd'),
                order_data=data.get('order_data', {})
            )
            
            if result['success']:
                return self._json_response({
                    'success': True,
                    'payment_intent': result['payment_intent']
                })
            else:
                return self._error_response(result['error'], status=400)
                
        except Exception as e:
            _logger.error(f"Stripe PaymentIntent creation failed: {e}")
            return self._error_response("Payment intent creation failed", status=500)

    @http.route('/api/v1/payments/stripe/confirm-intent', methods=['POST'], auth='user', csrf=False, cors='*')
    def confirm_stripe_payment_intent(self):
        """Confirm Stripe PaymentIntent"""
        try:
            data = self._get_json_data()
            required_fields = ['payment_intent_id']
            
            validation_result = self._validate_required_fields(data, required_fields)
            if not validation_result['success']:
                return self._error_response(validation_result['error'], status=400)
            
            # Get Stripe service
            stripe_service = request.env['pos.stripe.payment.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not stripe_service:
                return self._error_response("Stripe service not configured", status=503)
            
            # Confirm payment intent
            result = stripe_service.confirm_payment_intent(
                payment_intent_id=data['payment_intent_id'],
                payment_method_id=data.get('payment_method_id')
            )
            
            if result['success']:
                return self._json_response({
                    'success': True,
                    'payment_intent': result['payment_intent']
                })
            else:
                return self._error_response(result['error'], status=400)
                
        except Exception as e:
            _logger.error(f"Stripe PaymentIntent confirmation failed: {e}")
            return self._error_response("Payment confirmation failed", status=500)

    @http.route('/api/v1/payments/stripe/capture', methods=['POST'], auth='user', csrf=False, cors='*')
    def capture_stripe_payment(self):
        """Capture Stripe PaymentIntent"""
        try:
            data = self._get_json_data()
            required_fields = ['payment_intent_id']
            
            validation_result = self._validate_required_fields(data, required_fields)
            if not validation_result['success']:
                return self._error_response(validation_result['error'], status=400)
            
            # Get Stripe service
            stripe_service = request.env['pos.stripe.payment.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not stripe_service:
                return self._error_response("Stripe service not configured", status=503)
            
            # Capture payment
            result = stripe_service.capture_payment_intent(
                payment_intent_id=data['payment_intent_id'],
                amount=data.get('amount')
            )
            
            if result['success']:
                return self._json_response({
                    'success': True,
                    'payment_intent': result['payment_intent']
                })
            else:
                return self._error_response(result['error'], status=400)
                
        except Exception as e:
            _logger.error(f"Stripe payment capture failed: {e}")
            return self._error_response("Payment capture failed", status=500)

    @http.route('/api/v1/payments/stripe/refund', methods=['POST'], auth='user', csrf=False, cors='*')
    def create_stripe_refund(self):
        """Create Stripe refund"""
        try:
            data = self._get_json_data()
            required_fields = ['payment_intent_id']
            
            validation_result = self._validate_required_fields(data, required_fields)
            if not validation_result['success']:
                return self._error_response(validation_result['error'], status=400)
            
            # Get Stripe service
            stripe_service = request.env['pos.stripe.payment.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not stripe_service:
                return self._error_response("Stripe service not configured", status=503)
            
            # Create refund
            result = stripe_service.create_refund(
                payment_intent_id=data['payment_intent_id'],
                amount=data.get('amount'),
                reason=data.get('reason', 'requested_by_customer')
            )
            
            if result['success']:
                return self._json_response({
                    'success': True,
                    'refund': result['refund']
                })
            else:
                return self._error_response(result['error'], status=400)
                
        except Exception as e:
            _logger.error(f"Stripe refund creation failed: {e}")
            return self._error_response("Refund creation failed", status=500)

    @http.route('/api/v1/payments/stripe/status/<string:payment_intent_id>', methods=['GET'], auth='user', csrf=False, cors='*')
    def get_stripe_payment_status(self, payment_intent_id):
        """Get Stripe PaymentIntent status"""
        try:
            # Get Stripe service
            stripe_service = request.env['pos.stripe.payment.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not stripe_service:
                return self._error_response("Stripe service not configured", status=503)
            
            # Get payment status
            result = stripe_service.get_payment_intent(payment_intent_id)
            
            if result['success']:
                return self._json_response({
                    'success': True,
                    'payment_intent': result['payment_intent']
                })
            else:
                return self._error_response(result['error'], status=400)
                
        except Exception as e:
            _logger.error(f"Stripe status check failed: {e}")
            return self._error_response("Status check failed", status=500)

    # ============================================================================
    # APPLE PAY ENDPOINTS
    # ============================================================================

    @http.route('/api/v1/payments/apple-pay/validate-merchant', methods=['POST'], auth='user', csrf=False, cors='*')
    def validate_apple_pay_merchant(self):
        """Validate Apple Pay merchant domain"""
        try:
            data = self._get_json_data()
            required_fields = ['validation_url']
            
            validation_result = self._validate_required_fields(data, required_fields)
            if not validation_result['success']:
                return self._error_response(validation_result['error'], status=400)
            
            # Get Apple Pay service
            apple_pay_service = request.env['pos.apple.pay.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not apple_pay_service:
                return self._error_response("Apple Pay service not configured", status=503)
            
            # Validate merchant domain
            result = apple_pay_service.validate_merchant_domain(data['validation_url'])
            
            if result['success']:
                return self._json_response({
                    'success': True,
                    'merchant_session': result['merchant_session']
                })
            else:
                return self._error_response(result['error'], status=400)
                
        except Exception as e:
            _logger.error(f"Apple Pay merchant validation failed: {e}")
            return self._error_response("Merchant validation failed", status=500)

    @http.route('/api/v1/payments/apple-pay/create-request', methods=['POST'], auth='user', csrf=False, cors='*')
    def create_apple_pay_request(self):
        """Create Apple Pay payment request"""
        try:
            data = self._get_json_data()
            required_fields = ['amount']
            
            validation_result = self._validate_required_fields(data, required_fields)
            if not validation_result['success']:
                return self._error_response(validation_result['error'], status=400)
            
            # Get Apple Pay service
            apple_pay_service = request.env['pos.apple.pay.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not apple_pay_service:
                return self._error_response("Apple Pay service not configured", status=503)
            
            # Create payment request
            result = apple_pay_service.create_payment_request(
                amount=data['amount'],
                currency=data.get('currency', 'USD'),
                order_data=data.get('order_data', {})
            )
            
            if result['success']:
                return self._json_response({
                    'success': True,
                    'payment_request': result['payment_request']
                })
            else:
                return self._error_response(result['error'], status=400)
                
        except Exception as e:
            _logger.error(f"Apple Pay request creation failed: {e}")
            return self._error_response("Payment request creation failed", status=500)

    @http.route('/api/v1/payments/apple-pay/process-token', methods=['POST'], auth='user', csrf=False, cors='*')
    def process_apple_pay_token(self):
        """Process Apple Pay payment token"""
        try:
            data = self._get_json_data()
            required_fields = ['payment_token']
            
            validation_result = self._validate_required_fields(data, required_fields)
            if not validation_result['success']:
                return self._error_response(validation_result['error'], status=400)
            
            # Get Apple Pay service
            apple_pay_service = request.env['pos.apple.pay.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not apple_pay_service:
                return self._error_response("Apple Pay service not configured", status=503)
            
            # Process payment token
            result = apple_pay_service.process_payment_token(
                payment_token=data['payment_token'],
                order_data=data.get('order_data', {})
            )
            
            if result['success']:
                return self._json_response({
                    'success': True,
                    'payment_record': {
                        'id': result['payment_record'].id,
                        'amount': result['payment_record'].amount,
                        'status': result['payment_record'].payment_status
                    },
                    'transaction_id': result.get('transaction_id')
                })
            else:
                return self._error_response(result['error'], status=400)
                
        except Exception as e:
            _logger.error(f"Apple Pay token processing failed: {e}")
            return self._error_response("Token processing failed", status=500)

    # ============================================================================
    # TRANSACTION MANAGEMENT ENDPOINTS
    # ============================================================================

    @http.route('/api/v1/transactions/process', methods=['POST'], auth='user', csrf=False, cors='*')
    def process_transaction(self):
        """Process multi-payment transaction"""
        try:
            data = self._get_json_data()
            required_fields = ['order_id', 'payments']
            
            validation_result = self._validate_required_fields(data, required_fields)
            if not validation_result['success']:
                return self._error_response(validation_result['error'], status=400)
            
            # Validate payments data
            if not isinstance(data['payments'], list) or not data['payments']:
                return self._error_response("Payments must be a non-empty list", status=400)
            
            # Get transaction manager
            transaction_manager = request.env['pos.transaction.manager'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not transaction_manager:
                # Create default transaction manager
                transaction_manager = request.env['pos.transaction.manager'].create({
                    'name': 'Default Transaction Manager',
                    'company_id': request.env.company.id
                })
            
            # Process transaction
            result = transaction_manager.process_transaction(
                order_id=data['order_id'],
                payment_data=data['payments'],
                session_data=data.get('session_data', {})
            )
            
            if result['success']:
                return self._json_response({
                    'success': True,
                    'transaction': {
                        'id': result['transaction_id'],
                        'order_id': result['order_id'],
                        'total_amount': result['total_amount'],
                        'payments': result['payments'],
                        'change_amount': result.get('change_amount', 0.0)
                    }
                })
            else:
                return self._error_response(result['error'], status=400)
                
        except Exception as e:
            _logger.error(f"Transaction processing failed: {e}")
            return self._error_response("Transaction processing failed", status=500)

    @http.route('/api/v1/transactions/<int:transaction_id>/status', methods=['GET'], auth='user', csrf=False, cors='*')
    def get_transaction_status(self, transaction_id):
        """Get transaction status"""
        try:
            transaction_record = request.env['pos.transaction.record'].browse(transaction_id)
            
            if not transaction_record.exists():
                return self._error_response("Transaction not found", status=404)
            
            # Check access rights
            if transaction_record.company_id.id != request.env.company.id:
                return self._error_response("Access denied", status=403)
            
            return self._json_response({
                'success': True,
                'transaction': {
                    'id': transaction_record.id,
                    'order_id': transaction_record.pos_order_id.id,
                    'status': transaction_record.status,
                    'total_amount': transaction_record.total_amount,
                    'payment_count': transaction_record.payment_count,
                    'started_at': transaction_record.started_at.isoformat() if transaction_record.started_at else None,
                    'completed_at': transaction_record.completed_at.isoformat() if transaction_record.completed_at else None
                }
            })
            
        except Exception as e:
            _logger.error(f"Transaction status check failed: {e}")
            return self._error_response("Status check failed", status=500)

    @http.route('/api/v1/refunds/process', methods=['POST'], auth='user', csrf=False, cors='*')
    def process_refund(self):
        """Process payment refund"""
        try:
            data = self._get_json_data()
            required_fields = ['payment_id']
            
            validation_result = self._validate_required_fields(data, required_fields)
            if not validation_result['success']:
                return self._error_response(validation_result['error'], status=400)
            
            # Get transaction manager
            transaction_manager = request.env['pos.transaction.manager'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not transaction_manager:
                return self._error_response("Transaction manager not configured", status=503)
            
            # Process refund
            result = transaction_manager.process_refund(
                payment_id=data['payment_id'],
                refund_amount=data.get('refund_amount'),
                reason=data.get('reason', 'customer_request'),
                manager_approval=data.get('manager_approval', False)
            )
            
            if result['success']:
                response_data = {
                    'success': True,
                    'refund': {
                        'id': result['refund_record'].id,
                        'amount': result['refund_record'].amount,
                        'status': result['refund_record'].status,
                        'reason': result['refund_record'].reason
                    }
                }
                
                # Add additional data based on refund type
                if result.get('stripe_refund_id'):
                    response_data['refund']['stripe_refund_id'] = result['stripe_refund_id']
                
                if result.get('requires_manual_processing'):
                    response_data['requires_manual_processing'] = True
                    response_data['message'] = result.get('message')
                
                return self._json_response(response_data)
            else:
                status_code = 403 if result.get('requires_approval') else 400
                return self._error_response(result['error'], status=status_code)
                
        except Exception as e:
            _logger.error(f"Refund processing failed: {e}")
            return self._error_response("Refund processing failed", status=500)

    @http.route('/api/v1/refunds/<int:refund_id>/status', methods=['GET'], auth='user', csrf=False, cors='*')
    def get_refund_status(self, refund_id):
        """Get refund status"""
        try:
            refund_record = request.env['pos.payment.refund'].browse(refund_id)
            
            if not refund_record.exists():
                return self._error_response("Refund not found", status=404)
            
            # Check access rights
            if refund_record.payment_id.company_id.id != request.env.company.id:
                return self._error_response("Access denied", status=403)
            
            return self._json_response({
                'success': True,
                'refund': {
                    'id': refund_record.id,
                    'payment_id': refund_record.payment_id.id,
                    'amount': refund_record.amount,
                    'status': refund_record.status,
                    'reason': refund_record.reason,
                    'created_date': refund_record.created_date.isoformat() if refund_record.created_date else None,
                    'external_refund_id': refund_record.refund_id,
                    'notes': refund_record.notes
                }
            })
            
        except Exception as e:
            _logger.error(f"Refund status check failed: {e}")
            return self._error_response("Status check failed", status=500)

    # ============================================================================
    # PAYMENT METHOD MANAGEMENT
    # ============================================================================

    @http.route('/api/v1/payment-methods', methods=['GET'], auth='user', csrf=False, cors='*')
    def get_payment_methods(self):
        """Get available payment methods"""
        try:
            payment_methods = request.env['pos.payment.method'].search([
                ('company_id', '=', request.env.company.id)
            ])
            
            methods_data = []
            for method in payment_methods:
                methods_data.append({
                    'id': method.id,
                    'name': method.name,
                    'type': 'cash' if method.is_cash_count else 'electronic',
                    'active': method.active,
                    'journal_id': method.journal_id.id if method.journal_id else None,
                    'use_payment_terminal': method.use_payment_terminal
                })
            
            return self._json_response({
                'success': True,
                'payment_methods': methods_data
            })
            
        except Exception as e:
            _logger.error(f"Payment methods retrieval failed: {e}")
            return self._error_response("Failed to retrieve payment methods", status=500)

    # ============================================================================
    # HEALTH CHECK ENDPOINTS
    # ============================================================================

    @http.route('/api/v1/payments/health/stripe', methods=['GET'], auth='user', csrf=False, cors='*')
    def stripe_health_check(self):
        """Stripe service health check"""
        try:
            stripe_service = request.env['pos.stripe.payment.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not stripe_service:
                return self._json_response({
                    'success': False,
                    'status': 'not_configured',
                    'message': 'Stripe service not configured'
                })
            
            result = stripe_service.health_check()
            return self._json_response(result)
            
        except Exception as e:
            _logger.error(f"Stripe health check failed: {e}")
            return self._error_response("Health check failed", status=500)

    @http.route('/api/v1/payments/health/apple-pay', methods=['GET'], auth='user', csrf=False, cors='*')
    def apple_pay_health_check(self):
        """Apple Pay service health check"""
        try:
            apple_pay_service = request.env['pos.apple.pay.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if not apple_pay_service:
                return self._json_response({
                    'success': False,
                    'status': 'not_configured',
                    'message': 'Apple Pay service not configured'
                })
            
            result = apple_pay_service.health_check()
            return self._json_response(result)
            
        except Exception as e:
            _logger.error(f"Apple Pay health check failed: {e}")
            return self._error_response("Health check failed", status=500)

    @http.route('/api/v1/payments/health/all', methods=['GET'], auth='user', csrf=False, cors='*')
    def payment_services_health_check(self):
        """All payment services health check"""
        try:
            health_status = {
                'stripe': {'configured': False, 'healthy': False},
                'apple_pay': {'configured': False, 'healthy': False},
                'transaction_manager': {'configured': False, 'healthy': False}
            }
            
            # Check Stripe
            stripe_service = request.env['pos.stripe.payment.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if stripe_service:
                health_status['stripe']['configured'] = True
                stripe_health = stripe_service.health_check()
                health_status['stripe']['healthy'] = stripe_health.get('success', False)
                health_status['stripe']['status'] = stripe_health.get('status', 'unknown')
            
            # Check Apple Pay
            apple_pay_service = request.env['pos.apple.pay.service'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if apple_pay_service:
                health_status['apple_pay']['configured'] = True
                apple_pay_health = apple_pay_service.health_check()
                health_status['apple_pay']['healthy'] = apple_pay_health.get('success', False)
                health_status['apple_pay']['status'] = apple_pay_health.get('status', 'unknown')
            
            # Check Transaction Manager
            transaction_manager = request.env['pos.transaction.manager'].search([
                ('active', '=', True),
                ('company_id', '=', request.env.company.id)
            ], limit=1)
            
            if transaction_manager:
                health_status['transaction_manager']['configured'] = True
                health_status['transaction_manager']['healthy'] = True
                health_status['transaction_manager']['status'] = 'healthy'
            
            # Overall health
            all_healthy = all(
                service['healthy'] for service in health_status.values() 
                if service['configured']
            )
            
            return self._json_response({
                'success': True,
                'overall_status': 'healthy' if all_healthy else 'degraded',
                'services': health_status,
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            _logger.error(f"Payment services health check failed: {e}")
            return self._error_response("Health check failed", status=500)

    # ============================================================================
    # UTILITY METHODS
    # ============================================================================

    def _validate_required_fields(self, data: Dict[str, Any], required_fields: List[str]) -> Dict[str, Any]:
        """Validate required fields in request data"""
        missing_fields = [field for field in required_fields if field not in data or data[field] is None]
        
        if missing_fields:
            return {
                'success': False,
                'error': f"Missing required fields: {', '.join(missing_fields)}"
            }
        
        return {'success': True}

    def _get_json_data(self) -> Dict[str, Any]:
        """Get JSON data from request"""
        try:
            return request.get_json_data()
        except Exception as e:
            _logger.error(f"Failed to parse JSON data: {e}")
            raise ValidationError("Invalid JSON data")


# ============================================================================
# WEBHOOK CONTROLLERS (Enhanced from Phase 1)
# ============================================================================

class PaymentWebhooksController(POSAPIController):
    """Enhanced Payment Webhooks for Phase 2"""

    @http.route('/api/v1/webhooks/stripe', methods=['POST'], auth='none', csrf=False, cors='*')
    def stripe_webhook(self):
        """Handle Stripe webhooks with enhanced processing"""
        try:
            # Get raw payload and signature
            payload = request.httprequest.get_data(as_text=True)
            signature = request.httprequest.headers.get('Stripe-Signature')
            
            if not signature:
                return self._error_response("Missing Stripe signature", status=400)
            
            # Get Stripe service
            stripe_service = request.env['pos.stripe.payment.service'].search([
                ('active', '=', True)
            ], limit=1)
            
            if not stripe_service:
                return self._error_response("Stripe service not configured", status=503)
            
            # Process webhook
            result = stripe_service.process_webhook(payload, signature)
            
            if result['success']:
                return self._json_response({
                    'received': True,
                    'event_type': result['event_type'],
                    'processed': result.get('processed', True)
                })
            else:
                status_code = 400 if result.get('error_type') == 'signature_error' else 500
                return self._error_response(result['error'], status=status_code)
                
        except Exception as e:
            _logger.error(f"Stripe webhook processing failed: {e}")
            return self._error_response("Webhook processing failed", status=500) 