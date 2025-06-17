import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from decimal import Decimal, ROUND_HALF_UP

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError
from odoo.tools import float_compare, float_round

_logger = logging.getLogger(__name__)


class TransactionManager(models.Model):
    """Comprehensive Transaction Management System for Phase 2"""
    _name = 'pos.transaction.manager'
    _description = 'Transaction Manager'
    
    # Configuration
    name = fields.Char('Manager Name', default='Transaction Manager')
    company_id = fields.Many2one('res.company', 'Company', default=lambda self: self.env.company)
    currency_id = fields.Many2one('res.currency', 'Currency', default=lambda self: self.env.company.currency_id)
    
    # Settings
    allow_partial_payments = fields.Boolean('Allow Partial Payments', default=True)
    allow_overpayment = fields.Boolean('Allow Overpayment', default=True)
    max_overpayment_percent = fields.Float('Max Overpayment %', default=5.0)
    require_manager_approval = fields.Boolean('Require Manager Approval for Refunds', default=True)
    auto_reconcile_cash = fields.Boolean('Auto Reconcile Cash Drawer', default=True)
    
    # Cash drawer settings
    cash_drawer_enabled = fields.Boolean('Cash Drawer Enabled', default=True)
    opening_balance_required = fields.Boolean('Require Opening Balance', default=True)
    closing_balance_required = fields.Boolean('Require Closing Balance', default=True)
    
    # Status
    active = fields.Boolean('Active', default=True)
    
    @api.model
    def process_transaction(self, order_id: int, payment_data: List[Dict[str, Any]], 
                           session_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process complete transaction with multiple payment methods"""
        try:
            # Validate order
            pos_order = self.env['pos.order'].browse(order_id)
            if not pos_order.exists():
                return {
                    'success': False,
                    'error': 'Order not found',
                    'error_type': 'order_not_found'
                }
            
            # Validate payment data
            validation_result = self._validate_payment_data(pos_order, payment_data)
            if not validation_result['success']:
                return validation_result
            
            # Start transaction
            transaction_record = self._create_transaction_record(pos_order, payment_data, session_data)
            
            # Process each payment method
            processed_payments = []
            total_processed = 0.0
            
            for payment_info in payment_data:
                payment_result = self._process_single_payment(
                    pos_order, payment_info, transaction_record
                )
                
                if payment_result['success']:
                    processed_payments.append(payment_result['payment_record'])
                    total_processed += payment_result['amount']
                else:
                    # Rollback previous payments on failure
                    self._rollback_payments(processed_payments)
                    return {
                        'success': False,
                        'error': payment_result['error'],
                        'error_type': 'payment_processing_failed',
                        'failed_payment': payment_info
                    }
            
            # Validate total payment amount
            amount_validation = self._validate_payment_total(pos_order, total_processed)
            if not amount_validation['success']:
                self._rollback_payments(processed_payments)
                return amount_validation
            
            # Update order status
            self._finalize_order(pos_order, processed_payments, total_processed)
            
            # Update transaction record
            transaction_record.write({
                'status': 'completed',
                'total_amount': total_processed,
                'completed_at': fields.Datetime.now()
            })
            
            # Handle cash drawer operations
            if self.cash_drawer_enabled:
                self._update_cash_drawer(processed_payments, session_data)
            
            # Send WebSocket notifications
            self._notify_transaction_completed(pos_order, processed_payments, total_processed)
            
            # Log successful transaction
            self._log_transaction('transaction_completed', {
                'order_id': pos_order.id,
                'transaction_id': transaction_record.id,
                'total_amount': total_processed,
                'payment_methods': [p.payment_method_id.name for p in processed_payments],
                'payment_count': len(processed_payments)
            })
            
            return {
                'success': True,
                'transaction_id': transaction_record.id,
                'order_id': pos_order.id,
                'total_amount': total_processed,
                'payments': [self._serialize_payment(p) for p in processed_payments],
                'change_amount': amount_validation.get('change_amount', 0.0)
            }
            
        except Exception as e:
            _logger.error(f"Transaction processing failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'system_error'
            }
    
    def _validate_payment_data(self, pos_order, payment_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate payment data before processing"""
        try:
            if not payment_data:
                return {
                    'success': False,
                    'error': 'No payment data provided'
                }
            
            total_payment_amount = sum(p.get('amount', 0) for p in payment_data)
            order_total = pos_order.amount_total
            
            # Check minimum payment
            if total_payment_amount <= 0:
                return {
                    'success': False,
                    'error': 'Payment amount must be greater than zero'
                }
            
            # Check partial payment allowance
            if not self.allow_partial_payments and total_payment_amount < order_total:
                return {
                    'success': False,
                    'error': 'Partial payments not allowed'
                }
            
            # Check overpayment allowance
            if not self.allow_overpayment and total_payment_amount > order_total:
                return {
                    'success': False,
                    'error': 'Overpayment not allowed'
                }
            
            # Check maximum overpayment
            overpayment_percent = ((total_payment_amount - order_total) / order_total) * 100
            if overpayment_percent > self.max_overpayment_percent:
                return {
                    'success': False,
                    'error': f'Overpayment exceeds maximum allowed ({self.max_overpayment_percent}%)'
                }
            
            # Validate individual payment methods
            for payment_info in payment_data:
                method_validation = self._validate_payment_method(payment_info)
                if not method_validation['success']:
                    return method_validation
            
            return {'success': True}
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'validation_error'
            }
    
    def _validate_payment_method(self, payment_info: Dict[str, Any]) -> Dict[str, Any]:
        """Validate individual payment method"""
        try:
            required_fields = ['method', 'amount']
            for field in required_fields:
                if field not in payment_info:
                    return {
                        'success': False,
                        'error': f'Missing required field: {field}'
                    }
            
            # Validate payment method exists
            method_name = payment_info['method']
            payment_method = self.env['pos.payment.method'].search([
                ('name', '=', method_name),
                ('company_id', '=', self.company_id.id)
            ], limit=1)
            
            if not payment_method:
                return {
                    'success': False,
                    'error': f'Payment method not found: {method_name}'
                }
            
            # Validate amount
            amount = payment_info['amount']
            if not isinstance(amount, (int, float)) or amount <= 0:
                return {
                    'success': False,
                    'error': 'Invalid payment amount'
                }
            
            return {'success': True, 'payment_method': payment_method}
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'method_validation_error'
            }
    
    def _create_transaction_record(self, pos_order, payment_data: List[Dict[str, Any]], 
                                  session_data: Dict[str, Any] = None) -> 'pos.transaction.record':
        """Create transaction record for tracking"""
        try:
            total_amount = sum(p.get('amount', 0) for p in payment_data)
            
            transaction_vals = {
                'pos_order_id': pos_order.id,
                'manager_id': self.id,
                'total_amount': total_amount,
                'payment_count': len(payment_data),
                'status': 'processing',
                'started_at': fields.Datetime.now(),
                'session_data': json.dumps(session_data or {}),
                'user_id': self.env.user.id,
                'company_id': self.company_id.id
            }
            
            return self.env['pos.transaction.record'].create(transaction_vals)
            
        except Exception as e:
            _logger.error(f"Transaction record creation failed: {e}")
            raise UserError(f"Failed to create transaction record: {e}")
    
    def _process_single_payment(self, pos_order, payment_info: Dict[str, Any], 
                               transaction_record) -> Dict[str, Any]:
        """Process individual payment method"""
        try:
            method_name = payment_info['method']
            amount = payment_info['amount']
            
            # Get payment method
            payment_method = self.env['pos.payment.method'].search([
                ('name', '=', method_name),
                ('company_id', '=', self.company_id.id)
            ], limit=1)
            
            # Route to appropriate payment processor
            if method_name.lower() == 'cash':
                return self._process_cash_payment(pos_order, amount, payment_method, transaction_record)
            elif method_name.lower() in ['stripe', 'card', 'credit card']:
                return self._process_stripe_payment(pos_order, amount, payment_info, payment_method, transaction_record)
            elif method_name.lower() == 'apple pay':
                return self._process_apple_pay_payment(pos_order, amount, payment_info, payment_method, transaction_record)
            else:
                return self._process_generic_payment(pos_order, amount, payment_info, payment_method, transaction_record)
                
        except Exception as e:
            _logger.error(f"Single payment processing failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'payment_processing_error'
            }
    
    def _process_cash_payment(self, pos_order, amount: float, payment_method, transaction_record) -> Dict[str, Any]:
        """Process cash payment"""
        try:
            # Create payment record
            payment_vals = {
                'pos_order_id': pos_order.id,
                'payment_method_id': payment_method.id,
                'amount': amount,
                'payment_date': fields.Datetime.now(),
                'payment_status': 'paid',
                'transaction_record_id': transaction_record.id,
                'company_id': self.company_id.id,
                'name': f'Cash Payment - {amount}'
            }
            
            payment_record = self.env['pos.payment'].create(payment_vals)
            
            # Log cash payment
            self._log_transaction('cash_payment_processed', {
                'payment_id': payment_record.id,
                'amount': amount,
                'order_id': pos_order.id
            })
            
            return {
                'success': True,
                'payment_record': payment_record,
                'amount': amount,
                'method': 'cash'
            }
            
        except Exception as e:
            _logger.error(f"Cash payment processing failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'cash_payment_error'
            }
    
    def _process_stripe_payment(self, pos_order, amount: float, payment_info: Dict[str, Any], 
                               payment_method, transaction_record) -> Dict[str, Any]:
        """Process Stripe payment"""
        try:
            # Get Stripe service
            stripe_service = self.env['pos.stripe.payment.service'].search([
                ('active', '=', True),
                ('company_id', '=', self.company_id.id)
            ], limit=1)
            
            if not stripe_service:
                return {
                    'success': False,
                    'error': 'Stripe service not configured'
                }
            
            # Create or confirm payment intent
            if payment_info.get('payment_intent_id'):
                # Confirm existing payment intent
                result = stripe_service.confirm_payment_intent(
                    payment_info['payment_intent_id'],
                    payment_info.get('payment_method_id')
                )
            else:
                # Create new payment intent
                order_data = {
                    'order_id': pos_order.id,
                    'session_id': pos_order.session_id.id if pos_order.session_id else None,
                    'customer_name': payment_info.get('customer_name'),
                    'customer_email': payment_info.get('customer_email')
                }
                
                result = stripe_service.create_payment_intent(
                    amount, 
                    self.currency_id.name.lower(),
                    order_data
                )
            
            if result['success']:
                # Create payment record
                payment_vals = {
                    'pos_order_id': pos_order.id,
                    'payment_method_id': payment_method.id,
                    'amount': amount,
                    'payment_date': fields.Datetime.now(),
                    'payment_status': 'paid',
                    'transaction_record_id': transaction_record.id,
                    'stripe_payment_intent_id': result['payment_intent']['id'],
                    'company_id': self.company_id.id,
                    'name': f'Stripe Payment - {amount}'
                }
                
                payment_record = self.env['pos.payment'].create(payment_vals)
                
                return {
                    'success': True,
                    'payment_record': payment_record,
                    'amount': amount,
                    'method': 'stripe',
                    'stripe_data': result['payment_intent']
                }
            else:
                return result
                
        except Exception as e:
            _logger.error(f"Stripe payment processing failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'stripe_payment_error'
            }
    
    def _process_apple_pay_payment(self, pos_order, amount: float, payment_info: Dict[str, Any], 
                                  payment_method, transaction_record) -> Dict[str, Any]:
        """Process Apple Pay payment"""
        try:
            # Get Apple Pay service
            apple_pay_service = self.env['pos.apple.pay.service'].search([
                ('active', '=', True),
                ('company_id', '=', self.company_id.id)
            ], limit=1)
            
            if not apple_pay_service:
                return {
                    'success': False,
                    'error': 'Apple Pay service not configured'
                }
            
            # Process payment token
            order_data = {
                'order_id': pos_order.id,
                'session_id': pos_order.session_id.id if pos_order.session_id else None,
                'amount': amount
            }
            
            result = apple_pay_service.process_payment_token(
                payment_info.get('payment_token', {}),
                order_data
            )
            
            if result['success']:
                # Update payment record with transaction details
                payment_record = result['payment_record']
                payment_record.write({
                    'transaction_record_id': transaction_record.id
                })
                
                return {
                    'success': True,
                    'payment_record': payment_record,
                    'amount': amount,
                    'method': 'apple_pay'
                }
            else:
                return result
                
        except Exception as e:
            _logger.error(f"Apple Pay payment processing failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'apple_pay_error'
            }
    
    def _process_generic_payment(self, pos_order, amount: float, payment_info: Dict[str, Any], 
                                payment_method, transaction_record) -> Dict[str, Any]:
        """Process generic payment method"""
        try:
            # Create payment record
            payment_vals = {
                'pos_order_id': pos_order.id,
                'payment_method_id': payment_method.id,
                'amount': amount,
                'payment_date': fields.Datetime.now(),
                'payment_status': 'paid',
                'transaction_record_id': transaction_record.id,
                'company_id': self.company_id.id,
                'name': f'{payment_method.name} Payment - {amount}',
                'reference': payment_info.get('reference', '')
            }
            
            payment_record = self.env['pos.payment'].create(payment_vals)
            
            return {
                'success': True,
                'payment_record': payment_record,
                'amount': amount,
                'method': payment_method.name.lower()
            }
            
        except Exception as e:
            _logger.error(f"Generic payment processing failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'generic_payment_error'
            }
    
    def _validate_payment_total(self, pos_order, total_processed: float) -> Dict[str, Any]:
        """Validate total payment amount"""
        try:
            order_total = pos_order.amount_total
            precision = self.currency_id.decimal_places or 2
            
            # Round amounts for comparison
            total_processed = float_round(total_processed, precision_digits=precision)
            order_total = float_round(order_total, precision_digits=precision)
            
            # Calculate difference
            difference = total_processed - order_total
            
            if float_compare(total_processed, order_total, precision_digits=precision) == 0:
                # Exact payment
                return {
                    'success': True,
                    'payment_type': 'exact',
                    'change_amount': 0.0
                }
            elif difference > 0:
                # Overpayment - calculate change
                return {
                    'success': True,
                    'payment_type': 'overpayment',
                    'change_amount': difference
                }
            else:
                # Underpayment
                if self.allow_partial_payments:
                    return {
                        'success': True,
                        'payment_type': 'partial',
                        'remaining_amount': abs(difference)
                    }
                else:
                    return {
                        'success': False,
                        'error': f'Insufficient payment. Missing: {abs(difference)}'
                    }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'validation_error'
            }
    
    def _finalize_order(self, pos_order, processed_payments: List, total_processed: float):
        """Finalize order after successful payment"""
        try:
            # Update order status
            pos_order.write({
                'state': 'paid' if total_processed >= pos_order.amount_total else 'partial',
                'amount_paid': total_processed,
                'payment_ids': [(6, 0, [p.id for p in processed_payments])]
            })
            
            # Update order state machine if available
            try:
                state_machine = self.env['pos.order.state.machine']
                if total_processed >= pos_order.amount_total:
                    state_machine.transition_to_paid(pos_order.id)
                else:
                    state_machine.transition_to_partial_payment(pos_order.id)
            except Exception as e:
                _logger.warning(f"State machine update failed: {e}")
            
        except Exception as e:
            _logger.error(f"Order finalization failed: {e}")
            raise
    
    def _update_cash_drawer(self, processed_payments: List, session_data: Dict[str, Any] = None):
        """Update cash drawer with cash payments"""
        try:
            if not self.cash_drawer_enabled:
                return
            
            # Find cash payments
            cash_payments = [p for p in processed_payments if p.payment_method_id.is_cash_count]
            
            if not cash_payments:
                return
            
            # Get current session
            session_id = session_data.get('session_id') if session_data else None
            if not session_id:
                return
            
            pos_session = self.env['pos.session'].browse(session_id)
            if not pos_session.exists():
                return
            
            # Update cash register
            total_cash = sum(p.amount for p in cash_payments)
            
            # Create cash register entry
            self.env['pos.cash.register'].create({
                'session_id': pos_session.id,
                'amount': total_cash,
                'type': 'in',
                'description': f'Cash sales - {len(cash_payments)} transactions',
                'timestamp': fields.Datetime.now()
            })
            
            # Update session cash total
            pos_session.write({
                'cash_register_total_entry_encoding': pos_session.cash_register_total_entry_encoding + total_cash
            })
            
        except Exception as e:
            _logger.error(f"Cash drawer update failed: {e}")
    
    def _rollback_payments(self, processed_payments: List):
        """Rollback processed payments on transaction failure"""
        try:
            for payment in processed_payments:
                # Cancel Stripe payments
                if payment.stripe_payment_intent_id:
                    try:
                        stripe_service = self.env['pos.stripe.payment.service'].search([
                            ('active', '=', True),
                            ('company_id', '=', self.company_id.id)
                        ], limit=1)
                        
                        if stripe_service:
                            stripe_service.cancel_payment_intent(payment.stripe_payment_intent_id)
                    except Exception as e:
                        _logger.error(f"Stripe payment rollback failed: {e}")
                
                # Mark payment as cancelled
                payment.write({
                    'payment_status': 'cancelled',
                    'error_message': 'Transaction rolled back due to failure'
                })
            
            _logger.info(f"Rolled back {len(processed_payments)} payments")
            
        except Exception as e:
            _logger.error(f"Payment rollback failed: {e}")
    
    def _notify_transaction_completed(self, pos_order, processed_payments: List, total_amount: float):
        """Send WebSocket notification for completed transaction"""
        try:
            websocket_service = self.env['pos.websocket.service']
            websocket_service.broadcast_event('transaction.completed', {
                'order_id': pos_order.id,
                'total_amount': total_amount,
                'payment_methods': [p.payment_method_id.name for p in processed_payments],
                'payment_count': len(processed_payments),
                'timestamp': fields.Datetime.now().isoformat()
            })
        except Exception as e:
            _logger.error(f"Failed to send transaction notification: {e}")
    
    def _serialize_payment(self, payment_record) -> Dict[str, Any]:
        """Serialize payment record for API response"""
        return {
            'id': payment_record.id,
            'method': payment_record.payment_method_id.name,
            'amount': payment_record.amount,
            'status': payment_record.payment_status,
            'date': payment_record.payment_date.isoformat() if payment_record.payment_date else None,
            'reference': payment_record.name
        }
    
    def _log_transaction(self, event_type: str, data: Dict[str, Any]):
        """Log transaction events"""
        try:
            self.env['pos.transaction.log'].create({
                'manager_id': self.id,
                'event_type': event_type,
                'event_data': json.dumps(data, default=str),
                'timestamp': fields.Datetime.now(),
                'user_id': self.env.user.id
            })
        except Exception as e:
            _logger.error(f"Failed to log transaction event: {e}")
    
    @api.model
    def process_refund(self, payment_id: int, refund_amount: float = None, 
                      reason: str = 'customer_request', manager_approval: bool = False) -> Dict[str, Any]:
        """Process refund for payment"""
        try:
            # Validate payment
            payment = self.env['pos.payment'].browse(payment_id)
            if not payment.exists():
                return {
                    'success': False,
                    'error': 'Payment not found'
                }
            
            # Check manager approval requirement
            if self.require_manager_approval and not manager_approval:
                return {
                    'success': False,
                    'error': 'Manager approval required for refunds',
                    'requires_approval': True
                }
            
            # Validate refund amount
            max_refund = payment.amount
            refund_amount = refund_amount or max_refund
            
            if refund_amount > max_refund:
                return {
                    'success': False,
                    'error': f'Refund amount cannot exceed payment amount ({max_refund})'
                }
            
            # Process refund based on payment method
            if payment.stripe_payment_intent_id:
                return self._process_stripe_refund(payment, refund_amount, reason)
            elif payment.apple_pay_transaction_id:
                return self._process_apple_pay_refund(payment, refund_amount, reason)
            else:
                return self._process_cash_refund(payment, refund_amount, reason)
                
        except Exception as e:
            _logger.error(f"Refund processing failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'refund_error'
            }
    
    def _process_stripe_refund(self, payment, refund_amount: float, reason: str) -> Dict[str, Any]:
        """Process Stripe refund"""
        try:
            stripe_service = self.env['pos.stripe.payment.service'].search([
                ('active', '=', True),
                ('company_id', '=', self.company_id.id)
            ], limit=1)
            
            if not stripe_service:
                return {
                    'success': False,
                    'error': 'Stripe service not available'
                }
            
            result = stripe_service.create_refund(
                payment.stripe_payment_intent_id,
                refund_amount,
                reason
            )
            
            if result['success']:
                # Create refund record
                refund_record = self.env['pos.payment.refund'].create({
                    'payment_id': payment.id,
                    'refund_id': result['refund']['id'],
                    'amount': refund_amount,
                    'status': result['refund']['status'],
                    'reason': reason,
                    'created_date': fields.Datetime.now(),
                    'processed_by': self.env.user.id
                })
                
                return {
                    'success': True,
                    'refund_record': refund_record,
                    'stripe_refund_id': result['refund']['id']
                }
            else:
                return result
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'stripe_refund_error'
            }
    
    def _process_apple_pay_refund(self, payment, refund_amount: float, reason: str) -> Dict[str, Any]:
        """Process Apple Pay refund (requires manual processing)"""
        try:
            # Apple Pay refunds typically require manual processing
            # Create pending refund record
            refund_record = self.env['pos.payment.refund'].create({
                'payment_id': payment.id,
                'amount': refund_amount,
                'status': 'pending_manual',
                'reason': reason,
                'created_date': fields.Datetime.now(),
                'processed_by': self.env.user.id,
                'notes': 'Apple Pay refund requires manual processing'
            })
            
            return {
                'success': True,
                'refund_record': refund_record,
                'requires_manual_processing': True,
                'message': 'Apple Pay refund created - requires manual processing'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'apple_pay_refund_error'
            }
    
    def _process_cash_refund(self, payment, refund_amount: float, reason: str) -> Dict[str, Any]:
        """Process cash refund"""
        try:
            # Create refund record
            refund_record = self.env['pos.payment.refund'].create({
                'payment_id': payment.id,
                'amount': refund_amount,
                'status': 'completed',
                'reason': reason,
                'created_date': fields.Datetime.now(),
                'processed_by': self.env.user.id
            })
            
            # Update cash drawer if enabled
            if self.cash_drawer_enabled and payment.pos_order_id.session_id:
                self.env['pos.cash.register'].create({
                    'session_id': payment.pos_order_id.session_id.id,
                    'amount': -refund_amount,
                    'type': 'out',
                    'description': f'Cash refund - Order {payment.pos_order_id.name}',
                    'timestamp': fields.Datetime.now()
                })
            
            return {
                'success': True,
                'refund_record': refund_record,
                'cash_refund': True
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': 'cash_refund_error'
            }


class TransactionRecord(models.Model):
    """Transaction record for tracking multi-payment transactions"""
    _name = 'pos.transaction.record'
    _description = 'Transaction Record'
    _order = 'started_at desc'
    
    pos_order_id = fields.Many2one('pos.order', 'POS Order', required=True, ondelete='cascade')
    manager_id = fields.Many2one('pos.transaction.manager', 'Transaction Manager', required=True)
    
    # Transaction details
    total_amount = fields.Monetary('Total Amount', currency_field='currency_id')
    payment_count = fields.Integer('Payment Count')
    status = fields.Selection([
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled')
    ], string='Status', default='processing')
    
    # Timestamps
    started_at = fields.Datetime('Started At', required=True)
    completed_at = fields.Datetime('Completed At')
    
    # Additional data
    session_data = fields.Text('Session Data')
    error_message = fields.Text('Error Message')
    
    # Relations
    user_id = fields.Many2one('res.users', 'Processed By', required=True)
    company_id = fields.Many2one('res.company', 'Company', required=True)
    currency_id = fields.Many2one('res.currency', 'Currency', related='company_id.currency_id')


class TransactionLog(models.Model):
    """Transaction event logging"""
    _name = 'pos.transaction.log'
    _description = 'Transaction Log'
    _order = 'timestamp desc'
    
    manager_id = fields.Many2one('pos.transaction.manager', 'Transaction Manager', required=True)
    event_type = fields.Char('Event Type', required=True)
    event_data = fields.Text('Event Data')
    timestamp = fields.Datetime('Timestamp', required=True)
    user_id = fields.Many2one('res.users', 'User')
    
    def cleanup_old_logs(self, days_to_keep: int = 30):
        """Clean up old transaction logs"""
        cutoff_date = fields.Datetime.now() - timedelta(days=days_to_keep)
        old_logs = self.search([('timestamp', '<', cutoff_date)])
        old_logs.unlink()
        
        return len(old_logs)


class PaymentRefund(models.Model):
    """Payment refund tracking"""
    _name = 'pos.payment.refund'
    _description = 'Payment Refund'
    _order = 'created_date desc'
    
    payment_id = fields.Many2one('pos.payment', 'Original Payment', required=True, ondelete='cascade')
    refund_id = fields.Char('External Refund ID')
    
    # Refund details
    amount = fields.Monetary('Refund Amount', currency_field='currency_id')
    status = fields.Selection([
        ('pending', 'Pending'),
        ('pending_manual', 'Pending Manual Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled')
    ], string='Status', default='pending')
    
    reason = fields.Selection([
        ('customer_request', 'Customer Request'),
        ('duplicate_charge', 'Duplicate Charge'),
        ('fraudulent', 'Fraudulent'),
        ('product_issue', 'Product Issue'),
        ('other', 'Other')
    ], string='Reason', default='customer_request')
    
    # Metadata
    created_date = fields.Datetime('Created Date', required=True)
    processed_by = fields.Many2one('res.users', 'Processed By')
    notes = fields.Text('Notes')
    
    # Relations
    currency_id = fields.Many2one('res.currency', 'Currency', related='payment_id.currency_id') 