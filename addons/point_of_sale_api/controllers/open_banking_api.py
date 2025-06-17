# -*- coding: utf-8 -*-

import json
import logging
from datetime import datetime
from odoo import http, fields
from odoo.exceptions import UserError
from odoo.http import request

_logger = logging.getLogger(__name__)


class OpenBankingAPIController(http.Controller):
    """
    API Controller for Open Banking Payment Processing
    
    Provides endpoints for:
    - Creating QR code payments
    - Processing payment callbacks
    - Handling Stripe fallback
    - Managing fee toggles and gratuity
    """
    
    @http.route('/api/v1/payments/openbanking/create', type='json', auth='user', methods=['POST'], csrf=False)
    def create_open_banking_payment(self):
        """
        Create open banking payment with QR code
        
        Expected JSON payload:
        {
            "order_id": 123,
            "total_amount": 45.67,
            "customer_id": 456,
            "preferences": {
                "gratuity": {"enabled": true, "percentage": 15},
                "fee_toggle": true
            }
        }
        """
        try:
            data = request.jsonrequest
            
            # Validate required fields
            required_fields = ['order_id', 'total_amount']
            for field in required_fields:
                if field not in data:
                    return {
                        'success': False,
                        'error': f'Missing required field: {field}',
                        'error_code': 'MISSING_FIELD'
                    }
            
            # Get open banking service
            open_banking_service = request.env['pos.open.banking.service']
            
            # Create payment
            result = open_banking_service.create_open_banking_payment(
                order_data=data,
                customer_preferences=data.get('preferences', {})
            )
            
            return result
            
        except Exception as e:
            _logger.error(f"Open banking payment creation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'CREATION_FAILED',
                'fallback_to_stripe': True
            }
    
    @http.route('/api/v1/payments/openbanking/callback', type='json', auth='public', methods=['POST'], csrf=False)
    def open_banking_callback(self):
        """
        Handle callback from open banking provider
        
        Expected JSON payload:
        {
            "payment_reference": "FYNLO_ABC123DEF456",
            "status": "completed|failed",
            "transaction_id": "BANK_TXN_789",
            "amount": 45.67,
            "timestamp": "2024-12-01T15:30:00Z",
            "error_message": "Optional error message"
        }
        """
        try:
            data = request.jsonrequest
            
            # Validate callback data
            if 'payment_reference' not in data:
                return {
                    'success': False,
                    'error': 'Missing payment reference',
                    'error_code': 'INVALID_CALLBACK'
                }
            
            # Get open banking service
            open_banking_service = request.env['pos.open.banking.service'].sudo()
            
            # Process callback
            result = open_banking_service.process_open_banking_callback(
                payment_reference=data['payment_reference'],
                bank_response=data
            )
            
            return result
            
        except Exception as e:
            _logger.error(f"Open banking callback processing failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'CALLBACK_FAILED'
            }
    
    @http.route('/api/v1/payments/stripe/fallback', type='json', auth='user', methods=['POST'], csrf=False)
    def stripe_fallback_payment(self):
        """
        Process Stripe fallback payment
        
        Expected JSON payload:
        {
            "payment_reference": "FYNLO_ABC123DEF456",
            "stripe_payment_data": {
                "payment_method_id": "pm_123456789",
                "customer_id": "cus_123456789"
            },
            "customer_pays_fees": true
        }
        """
        try:
            data = request.jsonrequest
            
            # Validate required fields
            if 'payment_reference' not in data:
                return {
                    'success': False,
                    'error': 'Missing payment reference',
                    'error_code': 'MISSING_REFERENCE'
                }
            
            if 'stripe_payment_data' not in data:
                return {
                    'success': False,
                    'error': 'Missing Stripe payment data',
                    'error_code': 'MISSING_STRIPE_DATA'
                }
            
            # Get open banking service
            open_banking_service = request.env['pos.open.banking.service']
            
            # Process Stripe fallback
            result = open_banking_service.process_stripe_fallback(
                payment_reference=data['payment_reference'],
                stripe_payment_data=data['stripe_payment_data'],
                customer_pays_fees=data.get('customer_pays_fees', True)
            )
            
            return result
            
        except Exception as e:
            _logger.error(f"Stripe fallback processing failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'STRIPE_FALLBACK_FAILED'
            }
    
    @http.route('/api/v1/payments/fee-calculator', type='json', auth='user', methods=['POST'], csrf=False)
    def calculate_payment_fees(self):
        """
        Calculate fees for different payment methods
        
        Expected JSON payload:
        {
            "amount": 45.67,
            "gratuity_percentage": 15
        }
        """
        try:
            data = request.jsonrequest
            
            if 'amount' not in data:
                return {
                    'success': False,
                    'error': 'Missing amount',
                    'error_code': 'MISSING_AMOUNT'
                }
            
            base_amount = data['amount']
            gratuity_percentage = data.get('gratuity_percentage', 0)
            
            # Apply gratuity
            gratuity_amount = base_amount * (gratuity_percentage / 100)
            total_amount = base_amount + gratuity_amount
            
            # Get open banking service
            open_banking_service = request.env['pos.open.banking.service']
            
            # Calculate fee breakdown
            fee_breakdown = open_banking_service._calculate_fee_breakdown(total_amount)
            
            return {
                'success': True,
                'base_amount': base_amount,
                'gratuity_amount': gratuity_amount,
                'total_amount': total_amount,
                'fee_breakdown': fee_breakdown
            }
            
        except Exception as e:
            _logger.error(f"Fee calculation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'CALCULATION_FAILED'
            }
    
    @http.route('/api/v1/payments/gratuity-options', type='json', auth='user', methods=['POST'], csrf=False)
    def get_gratuity_options(self):
        """
        Get available gratuity options
        
        Expected JSON payload:
        {
            "amount": 45.67
        }
        """
        try:
            data = request.jsonrequest
            
            if 'amount' not in data:
                return {
                    'success': False,
                    'error': 'Missing amount',
                    'error_code': 'MISSING_AMOUNT'
                }
            
            # Get open banking service
            open_banking_service = request.env['pos.open.banking.service']
            
            # Get gratuity options
            gratuity_options = open_banking_service._get_gratuity_options(data['amount'])
            
            return {
                'success': True,
                'base_amount': data['amount'],
                'gratuity_options': gratuity_options
            }
            
        except Exception as e:
            _logger.error(f"Gratuity options retrieval failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'GRATUITY_OPTIONS_FAILED'
            }
    
    @http.route('/api/v1/payments/status/<string:payment_reference>', type='json', auth='user', methods=['GET'], csrf=False)
    def get_payment_status(self, payment_reference):
        """Get payment status by reference"""
        try:
            payment_request = request.env['pos.open.banking.request'].search([
                ('payment_reference', '=', payment_reference)
            ], limit=1)
            
            if not payment_request:
                return {
                    'success': False,
                    'error': 'Payment request not found',
                    'error_code': 'NOT_FOUND'
                }
            
            # Check if expired
            is_expired = payment_request.expires_at < datetime.now()
            if is_expired and payment_request.status == 'pending':
                payment_request.status = 'expired'
            
            return {
                'success': True,
                'payment_reference': payment_reference,
                'status': payment_request.status,
                'original_amount': payment_request.original_amount,
                'final_amount': payment_request.final_amount,
                'created_at': payment_request.created_at.isoformat(),
                'expires_at': payment_request.expires_at.isoformat(),
                'completed_at': payment_request.completed_at.isoformat() if payment_request.completed_at else None,
                'is_expired': is_expired
            }
            
        except Exception as e:
            _logger.error(f"Payment status retrieval failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'STATUS_RETRIEVAL_FAILED'
            }
    
    @http.route('/pay/openbanking/<string:payment_reference>', type='http', auth='public', methods=['GET'])
    def open_banking_payment_page(self, payment_reference):
        """
        Public payment page for QR code access
        This is where customers are redirected when scanning the QR code
        """
        try:
            payment_request = request.env['pos.open.banking.request'].sudo().search([
                ('payment_reference', '=', payment_reference),
                ('status', '=', 'pending')
            ], limit=1)
            
            if not payment_request:
                return request.render('point_of_sale_api.payment_not_found', {
                    'error_message': 'Payment request not found or already processed'
                })
            
            # Check if expired
            if payment_request.expires_at < datetime.now():
                payment_request.status = 'expired'
                return request.render('point_of_sale_api.payment_expired', {
                    'payment_reference': payment_reference
                })
            
            # Parse fee breakdown
            fee_breakdown = json.loads(payment_request.fee_breakdown)
            
            # Render payment page
            return request.render('point_of_sale_api.open_banking_payment_page', {
                'payment_request': payment_request,
                'fee_breakdown': fee_breakdown,
                'expires_in_minutes': int((payment_request.expires_at - datetime.now()).total_seconds() / 60)
            })
            
        except Exception as e:
            _logger.error(f"Payment page rendering failed: {str(e)}")
            return request.render('point_of_sale_api.payment_error', {
                'error_message': 'Unable to load payment page'
            })
    
    @http.route('/api/v1/payments/ui-config', type='json', auth='user', methods=['GET'], csrf=False)
    def get_payment_ui_config(self):
        """Get payment UI configuration settings"""
        try:
            ui_config = request.env['pos.payment.ui.config'].search([
                ('active', '=', True)
            ], limit=1)
            
            if not ui_config:
                # Return default configuration
                return {
                    'success': True,
                    'config': {
                        'gratuity_enabled': True,
                        'gratuity_percentages': [5, 10, 20],
                        'fee_toggle_enabled': True,
                        'open_banking_enabled': True,
                        'open_banking_priority': True,
                        'show_fee_comparison': True,
                        'show_fee_breakdown': True,
                        'restaurant_absorbs_fees': False
                    }
                }
            
            # Parse gratuity percentages
            percentages = [int(p.strip()) for p in ui_config.gratuity_percentages.split(',') if p.strip().isdigit()]
            
            return {
                'success': True,
                'config': {
                    'gratuity_enabled': ui_config.gratuity_enabled,
                    'gratuity_percentages': percentages,
                    'fee_toggle_enabled': ui_config.fee_toggle_enabled,
                    'open_banking_enabled': ui_config.open_banking_enabled,
                    'open_banking_priority': ui_config.open_banking_priority,
                    'show_fee_comparison': ui_config.show_fee_comparison,
                    'show_fee_breakdown': ui_config.show_fee_breakdown,
                    'restaurant_absorbs_fees': ui_config.restaurant_absorbs_fees
                }
            }
            
        except Exception as e:
            _logger.error(f"UI config retrieval failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'CONFIG_RETRIEVAL_FAILED'
            }