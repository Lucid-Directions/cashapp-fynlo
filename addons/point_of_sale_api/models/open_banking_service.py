# -*- coding: utf-8 -*-

import logging
import qrcode
import base64
import uuid
import json
from io import BytesIO
from datetime import datetime, timedelta
from odoo import models, fields, api, tools
from odoo.exceptions import UserError
import requests

_logger = logging.getLogger(__name__)


class OpenBankingPaymentService(models.Model):
    """
    Open Banking Payment Service for Fynlo POS
    
    Provides the cheapest payment method via QR code open banking:
    - Generate unique QR codes for each transaction
    - Handle open banking payment flow
    - Fallback to Stripe for non-banking customers
    - Manage fee structure and transaction costs
    - 1% Fynlo fee on all transactions
    """
    _name = 'pos.open.banking.service'
    _description = 'Open Banking Payment Service'
    
    # Fee Structure Constants
    FYNLO_FEE_PERCENTAGE = 1.0  # 1% Fynlo fee on all transactions
    OPEN_BANKING_FEE_PERCENTAGE = 0.2  # Typical open banking fee (0.2%)
    STRIPE_FEE_PERCENTAGE = 2.9  # Stripe fee (2.9% + $0.30)
    STRIPE_FIXED_FEE = 0.30  # Stripe fixed fee
    
    def create_open_banking_payment(self, order_data, customer_preferences=None):
        """
        Create open banking payment with QR code
        
        Args:
            order_data: Dictionary containing order information
            customer_preferences: Customer payment preferences
            
        Returns:
            dict: Payment creation response with QR code and payment options
        """
        try:
            # Extract order details
            order_amount = order_data.get('total_amount', 0.0)
            order_id = order_data.get('order_id')
            customer_id = order_data.get('customer_id')
            
            # Apply gratuity if enabled
            gratuity_settings = customer_preferences.get('gratuity', {}) if customer_preferences else {}
            final_amount = self._calculate_total_with_gratuity(order_amount, gratuity_settings)
            
            # Calculate fees for different payment methods
            fee_breakdown = self._calculate_fee_breakdown(final_amount)
            
            # Generate unique payment reference
            payment_reference = f"FYNLO_{uuid.uuid4().hex[:12].upper()}"
            
            # Create QR code for open banking
            qr_code_data = self._generate_qr_code(payment_reference, final_amount, order_data)
            
            # Store payment request
            payment_request = self.env['pos.open.banking.request'].create({
                'payment_reference': payment_reference,
                'order_id': order_id,
                'original_amount': order_amount,
                'final_amount': final_amount,
                'fee_breakdown': json.dumps(fee_breakdown),
                'qr_code_data': qr_code_data['qr_code_base64'],
                'status': 'pending',
                'expires_at': datetime.now() + timedelta(minutes=15),  # 15-minute expiry
                'customer_preferences': json.dumps(customer_preferences or {})
            })
            
            return {
                'success': True,
                'payment_reference': payment_reference,
                'payment_options': {
                    'open_banking': {
                        'enabled': True,
                        'qr_code': qr_code_data['qr_code_base64'],
                        'amount': final_amount,
                        'fee_to_customer': fee_breakdown['open_banking']['customer_pays'],
                        'estimated_fee': fee_breakdown['open_banking']['total_fee'],
                        'savings_vs_card': fee_breakdown['savings_comparison']
                    },
                    'stripe_fallback': {
                        'enabled': True,
                        'amount': final_amount,
                        'fee_to_customer': fee_breakdown['stripe']['customer_pays'],
                        'estimated_fee': fee_breakdown['stripe']['total_fee'],
                        'fee_toggle_enabled': customer_preferences.get('fee_toggle', True) if customer_preferences else True
                    }
                },
                'gratuity_options': self._get_gratuity_options(order_amount),
                'fee_breakdown': fee_breakdown,
                'expires_in': 900  # 15 minutes in seconds
            }
            
        except Exception as e:
            _logger.error(f"Open banking payment creation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'fallback_to_stripe': True
            }
    
    def _calculate_total_with_gratuity(self, base_amount, gratuity_settings):
        """Calculate total amount including gratuity"""
        if not gratuity_settings.get('enabled', False):
            return base_amount
            
        gratuity_percentage = gratuity_settings.get('percentage', 0)
        gratuity_amount = base_amount * (gratuity_percentage / 100)
        
        return base_amount + gratuity_amount
    
    def _calculate_fee_breakdown(self, amount):
        """
        Calculate comprehensive fee breakdown for different payment methods
        
        Returns detailed fee structure showing costs to customer vs restaurant
        """
        # Open Banking Fees
        open_banking_transaction_fee = amount * (self.OPEN_BANKING_FEE_PERCENTAGE / 100)
        fynlo_fee_open_banking = amount * (self.FYNLO_FEE_PERCENTAGE / 100)
        open_banking_total_fee = open_banking_transaction_fee + fynlo_fee_open_banking
        
        # Stripe Fees
        stripe_transaction_fee = (amount * (self.STRIPE_FEE_PERCENTAGE / 100)) + self.STRIPE_FIXED_FEE
        fynlo_fee_stripe = amount * (self.FYNLO_FEE_PERCENTAGE / 100)
        stripe_total_fee = stripe_transaction_fee + fynlo_fee_stripe
        
        # Savings comparison
        savings_amount = stripe_total_fee - open_banking_total_fee
        savings_percentage = (savings_amount / stripe_total_fee) * 100 if stripe_total_fee > 0 else 0
        
        return {
            'order_amount': amount,
            'open_banking': {
                'transaction_fee': open_banking_transaction_fee,
                'fynlo_fee': fynlo_fee_open_banking,
                'total_fee': open_banking_total_fee,
                'customer_pays': open_banking_total_fee,  # Customer pays all fees for open banking
                'restaurant_net': amount  # Restaurant gets full amount
            },
            'stripe': {
                'transaction_fee': stripe_transaction_fee,
                'fynlo_fee': fynlo_fee_stripe,
                'total_fee': stripe_total_fee,
                'customer_pays': stripe_total_fee,  # Customer pays all fees (if toggle enabled)
                'restaurant_net': amount  # Restaurant gets full amount
            },
            'savings_comparison': {
                'amount_saved': savings_amount,
                'percentage_saved': round(savings_percentage, 1),
                'message': f"Save ${savings_amount:.2f} ({savings_percentage:.1f}%) with Open Banking"
            }
        }
    
    def _generate_qr_code(self, payment_reference, amount, order_data):
        """Generate QR code for open banking payment"""
        try:
            # Create payment URL for open banking
            base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
            payment_url = f"{base_url}/pay/openbanking/{payment_reference}"
            
            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(payment_url)
            qr.make(fit=True)
            
            # Create QR code image
            qr_image = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = BytesIO()
            qr_image.save(buffer, format='PNG')
            qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            return {
                'qr_code_base64': qr_code_base64,
                'payment_url': payment_url,
                'payment_reference': payment_reference
            }
            
        except Exception as e:
            _logger.error(f"QR code generation failed: {str(e)}")
            raise UserError(f"Failed to generate QR code: {str(e)}")
    
    def _get_gratuity_options(self, base_amount):
        """Get gratuity options with calculated amounts"""
        gratuity_percentages = [5, 10, 20]
        options = []
        
        for percentage in gratuity_percentages:
            gratuity_amount = base_amount * (percentage / 100)
            total_with_tip = base_amount + gratuity_amount
            
            options.append({
                'percentage': percentage,
                'gratuity_amount': round(gratuity_amount, 2),
                'total_amount': round(total_with_tip, 2),
                'display_text': f"{percentage}% (${gratuity_amount:.2f})"
            })
        
        # Add custom amount option
        options.append({
            'percentage': 'custom',
            'gratuity_amount': 0,
            'total_amount': base_amount,
            'display_text': 'Custom Amount'
        })
        
        # Add no tip option
        options.append({
            'percentage': 0,
            'gratuity_amount': 0,
            'total_amount': base_amount,
            'display_text': 'No Tip'
        })
        
        return options
    
    def process_open_banking_callback(self, payment_reference, bank_response):
        """Process callback from open banking provider"""
        try:
            payment_request = self.env['pos.open.banking.request'].search([
                ('payment_reference', '=', payment_reference),
                ('status', '=', 'pending')
            ], limit=1)
            
            if not payment_request:
                raise UserError(f"Payment request {payment_reference} not found or already processed")
            
            # Check if payment is expired
            if payment_request.expires_at < datetime.now():
                payment_request.status = 'expired'
                raise UserError("Payment request has expired")
            
            # Process bank response
            if bank_response.get('status') == 'completed':
                payment_request.write({
                    'status': 'completed',
                    'bank_transaction_id': bank_response.get('transaction_id'),
                    'completed_at': datetime.now(),
                    'bank_response': json.dumps(bank_response)
                })
                
                # Create POS payment record
                self._create_pos_payment_record(payment_request, 'open_banking')
                
                return {
                    'success': True,
                    'status': 'completed',
                    'payment_reference': payment_reference,
                    'transaction_id': bank_response.get('transaction_id')
                }
            else:
                payment_request.write({
                    'status': 'failed',
                    'bank_response': json.dumps(bank_response),
                    'failed_at': datetime.now()
                })
                
                return {
                    'success': False,
                    'status': 'failed',
                    'error': bank_response.get('error_message', 'Payment failed'),
                    'fallback_to_stripe': True
                }
                
        except Exception as e:
            _logger.error(f"Open banking callback processing failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'fallback_to_stripe': True
            }
    
    def process_stripe_fallback(self, payment_reference, stripe_payment_data, customer_pays_fees=True):
        """Process Stripe fallback payment"""
        try:
            payment_request = self.env['pos.open.banking.request'].search([
                ('payment_reference', '=', payment_reference)
            ], limit=1)
            
            if not payment_request:
                raise UserError(f"Payment request {payment_reference} not found")
            
            # Calculate final amount based on fee toggle
            fee_breakdown = json.loads(payment_request.fee_breakdown)
            base_amount = payment_request.final_amount
            
            if customer_pays_fees:
                final_charge_amount = base_amount + fee_breakdown['stripe']['total_fee']
            else:
                final_charge_amount = base_amount
            
            # Process Stripe payment
            stripe_service = self.env['pos.stripe.payment.service']
            stripe_result = stripe_service.process_payment(
                amount=final_charge_amount,
                payment_data=stripe_payment_data,
                order_reference=payment_reference
            )
            
            if stripe_result.get('success'):
                payment_request.write({
                    'status': 'completed_stripe',
                    'stripe_payment_id': stripe_result.get('payment_id'),
                    'completed_at': datetime.now(),
                    'customer_paid_fees': customer_pays_fees,
                    'final_charge_amount': final_charge_amount
                })
                
                # Create POS payment record
                self._create_pos_payment_record(payment_request, 'stripe')
                
                return {
                    'success': True,
                    'status': 'completed',
                    'payment_method': 'stripe',
                    'payment_reference': payment_reference,
                    'stripe_payment_id': stripe_result.get('payment_id'),
                    'charged_amount': final_charge_amount,
                    'customer_paid_fees': customer_pays_fees
                }
            else:
                return {
                    'success': False,
                    'error': stripe_result.get('error'),
                    'payment_method': 'stripe'
                }
                
        except Exception as e:
            _logger.error(f"Stripe fallback processing failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'payment_method': 'stripe'
            }
    
    def _create_pos_payment_record(self, payment_request, payment_method):
        """Create POS payment record for completed transaction"""
        try:
            order = self.env['pos.order'].browse(payment_request.order_id)
            
            # Determine payment method details
            if payment_method == 'open_banking':
                method_name = 'Open Banking'
                reference = payment_request.bank_transaction_id
            else:
                method_name = 'Credit/Debit Card'
                reference = payment_request.stripe_payment_id
            
            # Create payment record
            payment_method_obj = self.env['pos.payment.method'].search([
                ('name', '=', method_name)
            ], limit=1)
            
            if not payment_method_obj:
                payment_method_obj = self.env['pos.payment.method'].create({
                    'name': method_name,
                    'use_payment_terminal': 'none',
                    'active': True
                })
            
            payment = self.env['pos.payment'].create({
                'order_id': order.id,
                'amount': payment_request.final_amount,
                'payment_method_id': payment_method_obj.id,
                'payment_reference': reference,
                'payment_status': 'done',
                'card_type': payment_method,
                'transaction_id': reference
            })
            
            return payment
            
        except Exception as e:
            _logger.error(f"POS payment record creation failed: {str(e)}")
            raise


class PosOpenBankingRequest(models.Model):
    """Model to track open banking payment requests"""
    _name = 'pos.open.banking.request'
    _description = 'Open Banking Payment Request'
    
    payment_reference = fields.Char('Payment Reference', required=True, index=True)
    order_id = fields.Integer('Order ID', required=True)
    original_amount = fields.Float('Original Amount', required=True)
    final_amount = fields.Float('Final Amount (with gratuity)', required=True)
    fee_breakdown = fields.Text('Fee Breakdown (JSON)', required=True)
    qr_code_data = fields.Text('QR Code Data (Base64)')
    status = fields.Selection([
        ('pending', 'Pending'),
        ('completed', 'Completed (Open Banking)'),
        ('completed_stripe', 'Completed (Stripe)'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled')
    ], string='Status', default='pending', required=True)
    
    # Open Banking specific fields
    bank_transaction_id = fields.Char('Bank Transaction ID')
    bank_response = fields.Text('Bank Response (JSON)')
    
    # Stripe specific fields
    stripe_payment_id = fields.Char('Stripe Payment ID')
    customer_paid_fees = fields.Boolean('Customer Paid Fees', default=True)
    final_charge_amount = fields.Float('Final Charge Amount')
    
    # Timestamps
    created_at = fields.Datetime('Created At', default=fields.Datetime.now, required=True)
    expires_at = fields.Datetime('Expires At', required=True)
    completed_at = fields.Datetime('Completed At')
    failed_at = fields.Datetime('Failed At')
    
    # Customer preferences
    customer_preferences = fields.Text('Customer Preferences (JSON)')


class PosPaymentUIConfig(models.Model):
    """Configuration for payment UI toggles and settings"""
    _name = 'pos.payment.ui.config'
    _description = 'Payment UI Configuration'
    
    name = fields.Char('Configuration Name', required=True)
    
    # Toggle settings
    gratuity_enabled = fields.Boolean('Enable Gratuity', default=True)
    gratuity_percentages = fields.Char('Gratuity Percentages', default='5,10,20',
                                      help='Comma-separated list of percentages')
    fee_toggle_enabled = fields.Boolean('Enable Fee Toggle', default=True,
                                       help='Allow customers to refuse paying fees')
    
    # Open banking settings
    open_banking_enabled = fields.Boolean('Enable Open Banking', default=True)
    open_banking_priority = fields.Boolean('Prioritize Open Banking', default=True,
                                          help='Show open banking as primary option')
    
    # Display settings
    show_fee_comparison = fields.Boolean('Show Fee Comparison', default=True,
                                        help='Show savings comparison between payment methods')
    show_fee_breakdown = fields.Boolean('Show Fee Breakdown', default=True,
                                       help='Show detailed fee breakdown to customers')
    
    # Business settings
    restaurant_absorbs_fees = fields.Boolean('Restaurant Absorbs Fees', default=False,
                                            help='Restaurant pays all fees (not recommended)')
    
    active = fields.Boolean('Active', default=True)