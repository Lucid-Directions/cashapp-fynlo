import json
import logging
from datetime import datetime, timedelta

from odoo import http, fields
from odoo.http import request
from odoo.exceptions import ValidationError, AccessDenied, UserError
from odoo.addons.point_of_sale_api.controllers.base import POSAPIController, api_route

_logger = logging.getLogger(__name__)


class PaymentsController(POSAPIController):
    """Payment processing endpoints for POS API"""

    @api_route('/api/v1/payments', methods=['POST'], auth=True, permissions=['pos.payment.process'])
    def create_payment(self, auth_info=None):
        """
        Create a new payment
        
        POST /api/v1/payments
        {
            "order_id": 123,
            "payment_method_id": 1,
            "amount": 34.38,
            "reference": "TXN_123456",
            "card_type": "visa",
            "cardholder_name": "John Doe"
        }
        """
        try:
            # Validate request data
            data = self._validate_json(['order_id', 'payment_method_id', 'amount'])
            
            order_id = data.get('order_id')
            payment_method_id = data.get('payment_method_id')
            amount = float(data.get('amount'))
            
            # Validate order
            order = request.env['pos.order'].browse(order_id)
            if not order.exists():
                raise ValidationError("Invalid order")
            
            # Check order access
            if not self._can_access_order(order, auth_info):
                raise AccessDenied("Access denied to this order")
            
            # Validate payment method
            payment_method = request.env['pos.payment.method'].browse(payment_method_id)
            if not payment_method.exists():
                raise ValidationError("Invalid payment method")
            
            # Validate amount
            if amount <= 0:
                raise ValidationError("Payment amount must be positive")
            
            # Create payment
            payment_vals = {
                'pos_order_id': order_id,
                'payment_method_id': payment_method_id,
                'amount': amount,
                'session_id': order.session_id.id,
                'payment_date': fields.Datetime.now(),
                'card_type': data.get('card_type'),
                'cardholder_name': data.get('cardholder_name'),
                'transaction_id': data.get('reference'),
            }
            
            payment = request.env['pos.payment'].create(payment_vals)
            
            # Process payment based on method type
            if payment_method.is_cash_count:
                # Cash payment - mark as done immediately
                payment.write({'payment_status': 'done'})
            elif payment_method.use_payment_terminal:
                # Terminal payment - would integrate with payment terminal
                payment.write({'payment_status': 'pending'})
                # Here you would integrate with payment terminal API
                self._process_terminal_payment(payment, data)
            else:
                # Other payment methods
                payment.write({'payment_status': 'done'})
            
            response_data = self._serialize_payment(payment)
            
            return self._json_response(response_data, message="Payment created successfully")
            
        except (ValidationError, AccessDenied) as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Error creating payment: {e}")
            return self._error_response("Failed to create payment", status=500)

    @api_route('/api/v1/payments/<int:payment_id>', methods=['GET'], auth=True, permissions=['pos.payment.process'])
    def get_payment(self, payment_id, auth_info=None):
        """
        Get specific payment by ID
        
        GET /api/v1/payments/123
        """
        try:
            payment = request.env['pos.payment'].browse(payment_id)
            if not payment.exists():
                return self._error_response("Payment not found", status=404)
            
            # Check access
            if not self._can_access_order(payment.pos_order_id, auth_info):
                raise AccessDenied("Access denied to this payment")
            
            payment_data = self._serialize_payment(payment)
            
            return self._json_response(payment_data)
            
        except AccessDenied as e:
            return self._error_response(str(e), status=403)
        except Exception as e:
            _logger.error(f"Error fetching payment {payment_id}: {e}")
            return self._error_response("Failed to fetch payment", status=500)

    @api_route('/api/v1/payments/<int:payment_id>/capture', methods=['POST'], auth=True, permissions=['pos.payment.process'])
    def capture_payment(self, payment_id, auth_info=None):
        """
        Capture a pending payment
        
        POST /api/v1/payments/123/capture
        {
            "amount": 34.38,
            "reference": "CAPTURE_123456"
        }
        """
        try:
            payment = request.env['pos.payment'].browse(payment_id)
            if not payment.exists():
                return self._error_response("Payment not found", status=404)
            
            # Check access
            if not self._can_access_order(payment.pos_order_id, auth_info):
                raise AccessDenied("Access denied to this payment")
            
            # Check payment status
            if payment.payment_status != 'pending':
                raise ValidationError("Payment is not in pending status")
            
            # Validate request data
            data = self._validate_json()
            capture_amount = data.get('amount', payment.amount)
            
            if capture_amount > payment.amount:
                raise ValidationError("Capture amount cannot exceed original payment amount")
            
            # Process capture
            self._process_payment_capture(payment, capture_amount, data.get('reference'))
            
            payment.write({
                'payment_status': 'done',
                'amount': capture_amount
            })
            
            response_data = self._serialize_payment(payment)
            
            return self._json_response(response_data, message="Payment captured successfully")
            
        except (ValidationError, AccessDenied) as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Error capturing payment {payment_id}: {e}")
            return self._error_response("Failed to capture payment", status=500)

    @api_route('/api/v1/payments/<int:payment_id>/refund', methods=['POST'], auth=True, permissions=['pos.payment.process'])
    def refund_payment(self, payment_id, auth_info=None):
        """
        Refund a payment
        
        POST /api/v1/payments/123/refund
        {
            "amount": 15.99,
            "reason": "Customer request"
        }
        """
        try:
            payment = request.env['pos.payment'].browse(payment_id)
            if not payment.exists():
                return self._error_response("Payment not found", status=404)
            
            # Check access
            if not self._can_access_order(payment.pos_order_id, auth_info):
                raise AccessDenied("Access denied to this payment")
            
            # Check payment status
            if payment.payment_status != 'done':
                raise ValidationError("Can only refund completed payments")
            
            # Validate request data
            data = self._validate_json(['amount'])
            refund_amount = float(data.get('amount'))
            reason = data.get('reason', 'API refund')
            
            if refund_amount <= 0:
                raise ValidationError("Refund amount must be positive")
            
            if refund_amount > payment.amount:
                raise ValidationError("Refund amount cannot exceed original payment amount")
            
            # Create refund payment
            refund_vals = {
                'pos_order_id': payment.pos_order_id.id,
                'payment_method_id': payment.payment_method_id.id,
                'amount': -refund_amount,  # Negative amount for refund
                'session_id': payment.session_id.id,
                'payment_date': fields.Datetime.now(),
                'payment_status': 'done',
                'card_type': payment.card_type,
                'cardholder_name': payment.cardholder_name,
                'transaction_id': f"REFUND_{payment.transaction_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            }
            
            refund_payment = request.env['pos.payment'].create(refund_vals)
            
            # Process refund through payment gateway if needed
            self._process_payment_refund(payment, refund_payment, refund_amount, reason)
            
            response_data = self._serialize_payment(refund_payment)
            
            return self._json_response(response_data, message="Payment refunded successfully")
            
        except (ValidationError, AccessDenied) as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Error refunding payment {payment_id}: {e}")
            return self._error_response("Failed to refund payment", status=500)

    @api_route('/api/v1/payments/<int:payment_id>/void', methods=['POST'], auth=True, permissions=['pos.payment.process'])
    def void_payment(self, payment_id, auth_info=None):
        """
        Void a payment
        
        POST /api/v1/payments/123/void
        {
            "reason": "Order cancelled"
        }
        """
        try:
            payment = request.env['pos.payment'].browse(payment_id)
            if not payment.exists():
                return self._error_response("Payment not found", status=404)
            
            # Check access
            if not self._can_access_order(payment.pos_order_id, auth_info):
                raise AccessDenied("Access denied to this payment")
            
            # Check payment status
            if payment.payment_status not in ['pending', 'done']:
                raise ValidationError("Payment cannot be voided in current status")
            
            # Validate request data
            data = self._validate_json()
            reason = data.get('reason', 'API void')
            
            # Process void through payment gateway if needed
            self._process_payment_void(payment, reason)
            
            payment.write({
                'payment_status': 'cancelled',
                'transaction_id': f"VOID_{payment.transaction_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            })
            
            response_data = self._serialize_payment(payment)
            
            return self._json_response(response_data, message="Payment voided successfully")
            
        except (ValidationError, AccessDenied) as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Error voiding payment {payment_id}: {e}")
            return self._error_response("Failed to void payment", status=500)

    @api_route('/api/v1/payment-methods', methods=['GET'], auth=True, permissions=['pos.order.read'])
    def get_payment_methods(self, auth_info=None):
        """
        Get available payment methods
        
        GET /api/v1/payment-methods?config_id=123
        """
        try:
            config_id = request.httprequest.args.get('config_id')
            
            # Build domain
            domain = [('active', '=', True)]
            
            if config_id:
                # Get methods for specific config
                config = request.env['pos.config'].browse(int(config_id))
                if not config.exists():
                    raise ValidationError("Invalid POS config")
                domain.append(('id', 'in', config.payment_method_ids.ids))
            
            # Get payment methods
            payment_methods = request.env['pos.payment.method'].search(domain)
            
            # Serialize payment methods
            methods_data = []
            for method in payment_methods:
                methods_data.append(self._serialize_payment_method(method))
            
            return self._json_response({'payment_methods': methods_data})
            
        except Exception as e:
            _logger.error(f"Error fetching payment methods: {e}")
            return self._error_response("Failed to fetch payment methods", status=500)

    @api_route('/api/v1/payments/apple-pay/session', methods=['POST'], auth=True, permissions=['pos.payment.process'])
    def create_apple_pay_session(self, auth_info=None):
        """
        Create Apple Pay session
        
        POST /api/v1/payments/apple-pay/session
        {
            "validation_url": "https://apple-pay-gateway.apple.com/paymentservices/startSession",
            "domain_name": "example.com"
        }
        """
        try:
            # Validate request data
            data = self._validate_json(['validation_url', 'domain_name'])
            
            validation_url = data.get('validation_url')
            domain_name = data.get('domain_name')
            
            # Create Apple Pay session (simplified implementation)
            # In production, this would validate with Apple's servers
            session_data = {
                'session_id': f"applepay_session_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                'merchant_identifier': 'merchant.com.fynlo.pos',
                'domain_name': domain_name,
                'display_name': 'Fynlo POS',
                'expires_at': (datetime.now() + timedelta(hours=1)).isoformat(),
                'validation_url': validation_url
            }
            
            return self._json_response(session_data, message="Apple Pay session created")
            
        except (ValidationError, AccessDenied) as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Error creating Apple Pay session: {e}")
            return self._error_response("Failed to create Apple Pay session", status=500)

    @api_route('/api/v1/payments/apple-pay/process', methods=['POST'], auth=True, permissions=['pos.payment.process'])
    def process_apple_pay_payment(self, auth_info=None):
        """
        Process Apple Pay payment
        
        POST /api/v1/payments/apple-pay/process
        {
            "order_id": 123,
            "payment_token": "encrypted_apple_pay_token",
            "amount": 34.38
        }
        """
        try:
            # Validate request data
            data = self._validate_json(['order_id', 'payment_token', 'amount'])
            
            order_id = data.get('order_id')
            payment_token = data.get('payment_token')
            amount = float(data.get('amount'))
            
            # Validate order
            order = request.env['pos.order'].browse(order_id)
            if not order.exists():
                raise ValidationError("Invalid order")
            
            # Check order access
            if not self._can_access_order(order, auth_info):
                raise AccessDenied("Access denied to this order")
            
            # Find Apple Pay payment method
            apple_pay_method = request.env['pos.payment.method'].search([
                ('name', 'ilike', 'apple pay'),
                ('active', '=', True)
            ], limit=1)
            
            if not apple_pay_method:
                # Create default Apple Pay method if it doesn't exist
                apple_pay_method = request.env['pos.payment.method'].create({
                    'name': 'Apple Pay',
                    'is_cash_count': False,
                    'use_payment_terminal': True,
                    'active': True
                })
            
            # Process Apple Pay payment
            payment_result = self._process_apple_pay_payment(payment_token, amount, order)
            
            # Create payment record
            payment_vals = {
                'pos_order_id': order_id,
                'payment_method_id': apple_pay_method.id,
                'amount': amount,
                'session_id': order.session_id.id,
                'payment_date': fields.Datetime.now(),
                'payment_status': payment_result.get('status', 'done'),
                'transaction_id': payment_result.get('transaction_id'),
                'card_type': payment_result.get('card_type', 'apple_pay'),
                'cardholder_name': payment_result.get('cardholder_name', 'Apple Pay User'),
            }
            
            payment = request.env['pos.payment'].create(payment_vals)
            
            response_data = self._serialize_payment(payment)
            response_data.update({
                'apple_pay_result': payment_result
            })
            
            return self._json_response(response_data, message="Apple Pay payment processed successfully")
            
        except (ValidationError, AccessDenied) as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Error processing Apple Pay payment: {e}")
            return self._error_response("Failed to process Apple Pay payment", status=500)

    def _serialize_payment(self, payment):
        """Serialize payment for API response"""
        return {
            'id': payment.id,
            'order_id': payment.pos_order_id.id,
            'payment_method_id': payment.payment_method_id.id,
            'payment_method_name': payment.payment_method_id.name,
            'amount': float(payment.amount),
            'payment_date': payment.payment_date.isoformat() if payment.payment_date else None,
            'payment_status': getattr(payment, 'payment_status', 'done'),
            'transaction_id': payment.transaction_id,
            'card_type': payment.card_type,
            'cardholder_name': payment.cardholder_name,
            'session_id': payment.session_id.id,
        }

    def _serialize_payment_method(self, method):
        """Serialize payment method for API response"""
        return {
            'id': method.id,
            'name': method.name,
            'is_cash_count': method.is_cash_count,
            'use_payment_terminal': method.use_payment_terminal,
            'active': method.active,
            'company_id': method.company_id.id if method.company_id else None,
        }

    def _can_access_order(self, order, auth_info):
        """Check if user can access the order"""
        user_id = auth_info.get('user_id')
        
        # Managers can access all orders
        user = request.env['res.users'].browse(user_id)
        if user.has_group('point_of_sale.group_pos_manager'):
            return True
        
        # Users can access their own orders
        if order.user_id.id == user_id:
            return True
        
        # Users can access orders from their sessions
        if order.session_id.user_id.id == user_id:
            return True
        
        return False

    def _process_terminal_payment(self, payment, data):
        """Process payment through terminal (stub implementation)"""
        # This would integrate with actual payment terminal API
        _logger.info(f"Processing terminal payment: {payment.id}")
        
        # Simulate terminal processing
        payment.write({
            'payment_status': 'done',
            'transaction_id': f"TERM_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        })

    def _process_payment_capture(self, payment, amount, reference):
        """Process payment capture (stub implementation)"""
        _logger.info(f"Capturing payment: {payment.id}, amount: {amount}")
        
        # This would integrate with payment gateway API for capture
        if reference:
            payment.transaction_id = reference

    def _process_payment_refund(self, original_payment, refund_payment, amount, reason):
        """Process payment refund (stub implementation)"""
        _logger.info(f"Processing refund: {original_payment.id}, amount: {amount}, reason: {reason}")
        
        # This would integrate with payment gateway API for refund

    def _process_payment_void(self, payment, reason):
        """Process payment void (stub implementation)"""
        _logger.info(f"Voiding payment: {payment.id}, reason: {reason}")
        
        # This would integrate with payment gateway API for void

    def _process_apple_pay_payment(self, payment_token, amount, order):
        """Process Apple Pay payment (stub implementation)"""
        _logger.info(f"Processing Apple Pay payment: amount: {amount}, order: {order.id}")
        
        # This would decrypt and process the Apple Pay token
        # For now, return a successful result
        return {
            'status': 'done',
            'transaction_id': f"APPLEPAY_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            'card_type': 'apple_pay',
            'cardholder_name': 'Apple Pay User',
            'success': True
        } 