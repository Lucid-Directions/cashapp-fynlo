import logging
import json
import base64
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError

_logger = logging.getLogger(__name__)


class ApplePayMerchantConfig(models.Model):
    """Apple Pay Merchant Configuration"""
    _name = 'pos.applepay.merchant.config'
    _description = 'Apple Pay Merchant Configuration'
    
    name = fields.Char('Configuration Name', required=True)
    merchant_identifier = fields.Char('Merchant Identifier', required=True,
                                     help='e.g., merchant.com.fynlo.pos')
    
    # Certificates and Keys
    merchant_cert = fields.Binary('Merchant Identity Certificate', 
                                 help='The merchant identity certificate (.p12 file)')
    merchant_cert_password = fields.Char('Certificate Password')
    payment_processing_cert = fields.Binary('Payment Processing Certificate',
                                           help='Certificate for decrypting payment tokens')
    payment_processing_key = fields.Binary('Payment Processing Private Key')
    
    # Apple Pay Configuration
    supported_networks = fields.Selection([
        ('visa,mastercard,amex', 'Visa, MasterCard, Amex'),
        ('visa,mastercard,amex,discover', 'Visa, MasterCard, Amex, Discover'),
        ('all', 'All Supported Networks')
    ], string='Supported Networks', default='visa,mastercard,amex')
    
    merchant_capabilities = fields.Selection([
        ('3DS', '3D Secure'),
        ('EMV', 'EMV'),
        ('3DS,EMV', '3D Secure + EMV')
    ], string='Merchant Capabilities', default='3DS')
    
    country_code = fields.Char('Country Code', default='US', size=2)
    currency_code = fields.Char('Currency Code', default='USD', size=3)
    
    # Domain Verification
    domain_name = fields.Char('Domain Name', help='Domain for Apple Pay verification')
    
    # Environment
    environment = fields.Selection([
        ('sandbox', 'Sandbox'),
        ('production', 'Production')
    ], string='Environment', default='sandbox')
    
    active = fields.Boolean('Active', default=True)
    
    @api.model
    def get_active_config(self):
        """Get active Apple Pay configuration"""
        config = self.search([('active', '=', True)], limit=1)
        if not config:
            raise UserError("No active Apple Pay configuration found")
        return config
    
    def get_supported_networks_list(self):
        """Get supported networks as a list"""
        if self.supported_networks == 'all':
            return ['visa', 'masterCard', 'amex', 'discover', 'maestro', 'jcb']
        return self.supported_networks.split(',')
    
    def get_merchant_capabilities_list(self):
        """Get merchant capabilities as a list"""
        return [f'capability{cap}' for cap in self.merchant_capabilities.split(',')]


class ApplePaySession(models.Model):
    """Apple Pay Session Management"""
    _name = 'pos.applepay.session'
    _description = 'Apple Pay Session'
    _order = 'create_date desc'
    
    session_id = fields.Char('Session ID', required=True, index=True)
    validation_url = fields.Char('Validation URL', required=True)
    domain_name = fields.Char('Domain Name', required=True)
    display_name = fields.Char('Display Name', required=True)
    
    # Session data
    merchant_session = fields.Text('Merchant Session Data')
    expires_at = fields.Datetime('Expires At')
    
    # Status
    status = fields.Selection([
        ('pending', 'Pending'),
        ('validated', 'Validated'),
        ('expired', 'Expired'),
        ('failed', 'Failed')
    ], string='Status', default='pending')
    
    # Relations
    merchant_config_id = fields.Many2one('pos.applepay.merchant.config', 'Merchant Config', required=True)
    pos_order_id = fields.Many2one('pos.order', 'POS Order')
    
    @api.model
    def create_session(self, validation_url: str, domain_name: str) -> Dict[str, Any]:
        """Create Apple Pay session"""
        try:
            config = self.env['pos.applepay.merchant.config'].get_active_config()
            
            # Generate session ID
            session_id = f"applepay_{hashlib.md5(f'{datetime.now()}{validation_url}'.encode()).hexdigest()}"
            
            # Create session record
            session = self.create({
                'session_id': session_id,
                'validation_url': validation_url,
                'domain_name': domain_name,
                'display_name': 'Fynlo POS',
                'merchant_config_id': config.id,
                'expires_at': datetime.now() + timedelta(minutes=10)
            })
            
            # Validate with Apple (mock implementation)
            merchant_session_data = session._validate_with_apple()
            
            if merchant_session_data:
                session.write({
                    'merchant_session': json.dumps(merchant_session_data),
                    'status': 'validated'
                })
                
                return {
                    'success': True,
                    'session_id': session_id,
                    'merchant_session': merchant_session_data
                }
            else:
                session.write({'status': 'failed'})
                return {
                    'success': False,
                    'error': 'Failed to validate merchant session'
                }
                
        except Exception as e:
            _logger.error(f"Apple Pay session creation error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _validate_with_apple(self) -> Optional[Dict[str, Any]]:
        """Validate merchant session with Apple (mock implementation)"""
        try:
            # In real implementation, this would:
            # 1. Load merchant certificate and key
            # 2. Create TLS client certificate connection to Apple
            # 3. Send validation request with merchant data
            # 4. Return Apple's merchant session response
            
            # Mock response for development
            mock_response = {
                'epochTimestamp': int(datetime.now().timestamp()),
                'expiresAt': int((datetime.now() + timedelta(minutes=10)).timestamp()),
                'merchantSessionIdentifier': self.session_id,
                'nonce': base64.b64encode(f'nonce_{self.session_id}'.encode()).decode(),
                'merchantIdentifier': self.merchant_config_id.merchant_identifier,
                'domainName': self.domain_name,
                'displayName': self.display_name,
                'signature': base64.b64encode(f'signature_{self.session_id}'.encode()).decode()
            }
            
            return mock_response
            
        except Exception as e:
            _logger.error(f"Apple Pay validation error: {e}")
            return None


class ApplePayPayment(models.Model):
    """Apple Pay Payment Processing"""
    _name = 'pos.applepay.payment'
    _description = 'Apple Pay Payment'
    _order = 'create_date desc'
    
    payment_id = fields.Many2one('pos.payment', 'POS Payment', required=True, ondelete='cascade')
    session_id = fields.Many2one('pos.applepay.session', 'Apple Pay Session')
    
    # Payment Token Data
    payment_token = fields.Text('Payment Token', required=True)
    payment_data = fields.Text('Decrypted Payment Data')
    
    # Transaction details
    transaction_id = fields.Char('Transaction ID')
    amount = fields.Monetary('Amount', currency_field='currency_id')
    currency_id = fields.Many2one('res.currency', 'Currency', default=lambda self: self.env.company.currency_id)
    
    # Card details (from decrypted token)
    card_holder_name = fields.Char('Cardholder Name')
    card_number_masked = fields.Char('Card Number (Masked)')
    card_type = fields.Char('Card Type')
    
    # Processing status
    status = fields.Selection([
        ('pending', 'Pending'),
        ('authorized', 'Authorized'),
        ('captured', 'Captured'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded')
    ], string='Status', default='pending')
    
    # Timestamps
    authorized_at = fields.Datetime('Authorized At')
    captured_at = fields.Datetime('Captured At')
    failed_at = fields.Datetime('Failed At')
    
    # Error handling
    error_code = fields.Char('Error Code')
    error_message = fields.Text('Error Message')
    
    @api.model
    def process_payment_token(self, payment_token: str, amount: float, order_id: int) -> Dict[str, Any]:
        """Process Apple Pay payment token"""
        try:
            # Create Apple Pay payment record
            apple_pay_payment = self.create({
                'payment_token': payment_token,
                'amount': amount
            })
            
            # Decrypt payment token
            decrypted_data = apple_pay_payment._decrypt_payment_token(payment_token)
            
            if not decrypted_data:
                apple_pay_payment.write({
                    'status': 'failed',
                    'error_message': 'Failed to decrypt payment token',
                    'failed_at': fields.Datetime.now()
                })
                return {
                    'success': False,
                    'error': 'Failed to decrypt payment token'
                }
            
            # Update payment with decrypted data
            apple_pay_payment.write({
                'payment_data': json.dumps(decrypted_data),
                'card_holder_name': decrypted_data.get('cardholderName'),
                'card_number_masked': decrypted_data.get('primaryAccountNumberSuffix'),
                'card_type': decrypted_data.get('paymentMethodDisplayName')
            })
            
            # Process with payment gateway
            gateway_result = apple_pay_payment._process_with_gateway(decrypted_data, amount)
            
            if gateway_result.get('success'):
                apple_pay_payment.write({
                    'status': 'authorized',
                    'transaction_id': gateway_result.get('transaction_id'),
                    'authorized_at': fields.Datetime.now()
                })
                
                # Create POS payment record
                pos_payment = self.env['pos.payment'].create({
                    'pos_order_id': order_id,
                    'payment_method_id': self._get_apple_pay_method_id(),
                    'amount': amount,
                    'payment_date': fields.Datetime.now(),
                    'transaction_id': gateway_result.get('transaction_id'),
                    'payment_status': 'done'
                })
                
                apple_pay_payment.write({'payment_id': pos_payment.id})
                
                return {
                    'success': True,
                    'payment_id': pos_payment.id,
                    'transaction_id': gateway_result.get('transaction_id'),
                    'apple_pay_payment_id': apple_pay_payment.id
                }
            else:
                apple_pay_payment.write({
                    'status': 'failed',
                    'error_message': gateway_result.get('error'),
                    'failed_at': fields.Datetime.now()
                })
                return {
                    'success': False,
                    'error': gateway_result.get('error')
                }
                
        except Exception as e:
            _logger.error(f"Apple Pay payment processing error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _decrypt_payment_token(self, payment_token: str) -> Optional[Dict[str, Any]]:
        """Decrypt Apple Pay payment token"""
        try:
            # In real implementation, this would:
            # 1. Parse the payment token JSON
            # 2. Use the payment processing certificate to decrypt
            # 3. Verify signatures and certificates
            # 4. Return decrypted payment data
            
            # Mock decrypted data for development
            token_data = json.loads(payment_token)
            
            mock_decrypted_data = {
                'applicationPrimaryAccountNumber': '4111111111111111',
                'applicationExpirationDate': '251231',
                'currencyCode': '840',
                'transactionAmount': int(self.amount * 100),
                'cardholderName': 'John Doe',
                'paymentMethodDisplayName': 'Visa 1111',
                'primaryAccountNumberSuffix': '1111',
                'deviceManufacturerIdentifier': 'Apple',
                'paymentDataType': '3DSecure',
                'onlinePaymentCryptogram': base64.b64encode(b'mock_cryptogram').decode()
            }
            
            return mock_decrypted_data
            
        except Exception as e:
            _logger.error(f"Apple Pay token decryption error: {e}")
            return None
    
    def _process_with_gateway(self, payment_data: Dict[str, Any], amount: float) -> Dict[str, Any]:
        """Process decrypted payment data with payment gateway"""
        try:
            # Get payment gateway
            gateway_config = self.env['pos.payment.gateway.config']
            gateway = gateway_config.get_gateway_instance()
            
            # Prepare payment method data
            payment_method = {
                'type': 'apple_pay',
                'card_number': payment_data.get('applicationPrimaryAccountNumber'),
                'expiry_date': payment_data.get('applicationExpirationDate'),
                'cryptogram': payment_data.get('onlinePaymentCryptogram'),
                'cardholder_name': payment_data.get('cardholderName')
            }
            
            # Authorize payment
            result = gateway.authorize(amount, payment_method, currency='USD')
            
            return result
            
        except Exception as e:
            _logger.error(f"Gateway processing error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _get_apple_pay_method_id(self):
        """Get Apple Pay payment method ID"""
        apple_pay_method = self.env['pos.payment.method'].search([
            ('name', 'ilike', 'apple pay')
        ], limit=1)
        
        if not apple_pay_method:
            # Create Apple Pay payment method if it doesn't exist
            apple_pay_method = self.env['pos.payment.method'].create({
                'name': 'Apple Pay',
                'use_payment_terminal': True,
                'journal_id': self.env['account.journal'].search([('type', '=', 'bank')], limit=1).id
            })
        
        return apple_pay_method.id
    
    def _serialize_for_api(self):
        """Serialize for API response"""
        return {
            'id': self.id,
            'payment_id': self.payment_id.id if self.payment_id else None,
            'transaction_id': self.transaction_id,
            'amount': self.amount,
            'currency': self.currency_id.name,
            'status': self.status,
            'card_type': self.card_type,
            'card_holder_name': self.card_holder_name,
            'card_number_masked': self.card_number_masked,
            'authorized_at': self.authorized_at.isoformat() if self.authorized_at else None,
            'captured_at': self.captured_at.isoformat() if self.captured_at else None,
            'error_message': self.error_message
        } 