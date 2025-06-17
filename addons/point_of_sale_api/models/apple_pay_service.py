import logging
import json
import base64
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import OpenSSL.crypto
import requests

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError

_logger = logging.getLogger(__name__)


class ApplePayService(models.Model):
    """Apple Pay Integration Service for iOS POS"""
    _name = 'pos.apple.pay.service'
    _description = 'Apple Pay Service'
    
    # Configuration fields
    name = fields.Char('Service Name', default='Apple Pay Service')
    merchant_id = fields.Char('Apple Merchant ID', required=True)
    merchant_domain = fields.Char('Merchant Domain', required=True)
    
    # Certificate management
    merchant_certificate = fields.Text('Merchant Identity Certificate (PEM)', required=True)
    merchant_private_key = fields.Text('Merchant Private Key (PEM)', required=True)
    payment_processing_certificate = fields.Text('Payment Processing Certificate (PEM)')
    
    # Environment settings
    environment = fields.Selection([
        ('sandbox', 'Sandbox'),
        ('production', 'Production')
    ], string='Environment', default='sandbox', required=True)
    
    # Business settings
    company_id = fields.Many2one('res.company', 'Company', default=lambda self: self.env.company)
    currency_id = fields.Many2one('res.currency', 'Default Currency', default=lambda self: self.env.company.currency_id)
    country_code = fields.Char('Country Code', default='US', size=2)
    
    # Feature settings
    supported_networks = fields.Char('Supported Networks', default='visa,masterCard,amex,discover')
    merchant_capabilities = fields.Char('Merchant Capabilities', default='supports3DS,supportsEMV,supportsCredit,supportsDebit')
    require_billing_contact = fields.Boolean('Require Billing Contact', default=False)
    require_shipping_contact = fields.Boolean('Require Shipping Contact', default=False)
    
    # Status
    active = fields.Boolean('Active', default=True)
    last_validation = fields.Datetime('Last Domain Validation')
    validation_status = fields.Selection([
        ('valid', 'Valid'),
        ('invalid', 'Invalid'),
        ('pending', 'Pending Validation')
    ], string='Validation Status', default='pending')
    
    def _get_apple_pay_urls(self):
        """Get Apple Pay API URLs based on environment"""
        if self.environment == 'production':
            return {
                'session_url': 'https://apple-pay-gateway.apple.com/paymentservices/startSession',
                'validation_url': 'https://apple-pay-gateway-cert.apple.com/paymentservices/paymentSession'
            }
        else:
            return {
                'session_url': 'https://apple-pay-gateway-cert.apple.com/paymentservices/startSession',
                'validation_url': 'https://apple-pay-gateway-cert.apple.com/paymentservices/paymentSession'
            }
    
    def validate_merchant_domain(self, domain_validation_url: str) -> Dict[str, Any]:
        """Validate merchant domain with Apple Pay"""
        try:
            urls = self._get_apple_pay_urls()
            
            # Prepare validation request
            validation_data = {
                'merchantIdentifier': self.merchant_id,
                'domainName': self.merchant_domain,
                'displayName': self.company_id.name or 'POS System'
            }
            
            # Load merchant certificate and key
            cert_data = self._load_merchant_certificate()
            
            # Make validation request to Apple
            response = requests.post(
                domain_validation_url,
                json=validation_data,
                cert=(cert_data['cert_file'], cert_data['key_file']),
                timeout=30,
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            )
            
            if response.status_code == 200:
                merchant_session = response.json()
                
                # Update validation status
                self.write({
                    'last_validation': fields.Datetime.now(),
                    'validation_status': 'valid'
                })
                
                # Log successful validation
                self._log_apple_pay_event('domain_validation_success', {
                    'domain': self.merchant_domain,
                    'merchant_id': self.merchant_id,
                    'session_data': merchant_session
                })
                
                return {
                    'success': True,
                    'merchant_session': merchant_session
                }
            else:
                error_msg = f"Domain validation failed: {response.status_code} - {response.text}"
                _logger.error(error_msg)
                
                self.write({'validation_status': 'invalid'})
                
                return {
                    'success': False,
                    'error': error_msg,
                    'status_code': response.status_code
                }
                
        except Exception as e:
            _logger.error(f"Apple Pay domain validation error: {e}")
            self.write({'validation_status': 'invalid'})
            
            return {
                'success': False,
                'error': str(e),
                'error_type': 'validation_error'
            }
    
    def create_payment_request(self, amount: float, currency: str = None, 
                              order_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create Apple Pay payment request configuration"""
        try:
            currency = currency or self.currency_id.name or 'USD'
            
            # Prepare line items
            line_items = []
            total_amount = amount
            
            if order_data and order_data.get('line_items'):
                for item in order_data['line_items']:
                    line_items.append({
                        'label': item.get('name', 'Item'),
                        'amount': str(item.get('price', 0)),
                        'type': 'final'
                    })
            
            # Add tax if specified
            if order_data and order_data.get('tax_amount'):
                line_items.append({
                    'label': 'Tax',
                    'amount': str(order_data['tax_amount']),
                    'type': 'final'
                })
                total_amount += order_data['tax_amount']
            
            # Create payment request
            payment_request = {
                'countryCode': self.country_code,
                'currencyCode': currency,
                'merchantCapabilities': self.merchant_capabilities.split(','),
                'supportedNetworks': self.supported_networks.split(','),
                'total': {
                    'label': self.company_id.name or 'Total',
                    'amount': str(total_amount),
                    'type': 'final'
                },
                'lineItems': line_items
            }
            
            # Add contact requirements
            if self.require_billing_contact:
                payment_request['requiredBillingContactFields'] = ['postalAddress', 'name']
            
            if self.require_shipping_contact:
                payment_request['requiredShippingContactFields'] = ['postalAddress', 'name', 'phoneNumber']
            
            # Add application data for tracking
            application_data = {
                'pos_order_id': order_data.get('order_id') if order_data else None,
                'pos_session_id': order_data.get('session_id') if order_data else None,
                'table_id': order_data.get('table_id') if order_data else None,
                'created_by': self.env.user.name,
                'timestamp': fields.Datetime.now().isoformat()
            }
            
            payment_request['applicationData'] = base64.b64encode(
                json.dumps(application_data).encode()
            ).decode()
            
            self._log_apple_pay_event('payment_request_created', {
                'amount': total_amount,
                'currency': currency,
                'line_items_count': len(line_items)
            })
            
            return {
                'success': True,
                'payment_request': payment_request
            }
            
        except Exception as e:
            _logger.error(f"Apple Pay payment request creation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'payment_request_error'
            }
    
    def process_payment_token(self, payment_token: Dict[str, Any], 
                             order_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process Apple Pay payment token"""
        try:
            # Extract payment data
            payment_data = payment_token.get('paymentData', {})
            payment_method = payment_token.get('paymentMethod', {})
            
            # Decrypt payment token (simplified - in production, use proper decryption)
            decrypted_data = self._decrypt_payment_token(payment_data)
            
            if not decrypted_data.get('success'):
                return decrypted_data
            
            # Extract card information
            card_info = {
                'type': payment_method.get('type', 'unknown'),
                'network': payment_method.get('network', 'unknown'),
                'display_name': payment_method.get('displayName', 'Apple Pay'),
                'last_four': decrypted_data.get('card_last_four', '****')
            }
            
            # Create payment record
            payment_result = self._create_payment_record(
                payment_token, card_info, order_data
            )
            
            if payment_result.get('success'):
                # Trigger WebSocket notification
                self._notify_apple_pay_success(payment_result['payment_record'])
                
                self._log_apple_pay_event('payment_processed', {
                    'payment_id': payment_result['payment_record'].id,
                    'amount': payment_result['payment_record'].amount,
                    'card_network': card_info['network']
                })
            
            return payment_result
            
        except Exception as e:
            _logger.error(f"Apple Pay token processing failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'token_processing_error'
            }
    
    def _decrypt_payment_token(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Decrypt Apple Pay payment token (simplified implementation)"""
        try:
            # In production, implement proper PKCS#7 decryption
            # This is a simplified version for demonstration
            
            encrypted_data = payment_data.get('data')
            if not encrypted_data:
                return {
                    'success': False,
                    'error': 'No encrypted payment data'
                }
            
            # Mock decryption result (in production, decrypt with merchant private key)
            decrypted_result = {
                'applicationPrimaryAccountNumber': '4111111111111111',
                'applicationExpirationDate': '251231',
                'currencyCode': '840',
                'transactionAmount': 1000,
                'cardholderName': 'John Doe',
                'deviceManufacturerIdentifier': '040010030273',
                'paymentDataType': '3DSecure',
                'paymentData': {
                    'onlinePaymentCryptogram': 'Af9x/QwAA/DjmU65oyc1MAABAAA=',
                    'eciIndicator': '7'
                }
            }
            
            return {
                'success': True,
                'decrypted_data': decrypted_result,
                'card_last_four': decrypted_result['applicationPrimaryAccountNumber'][-4:]
            }
            
        except Exception as e:
            _logger.error(f"Payment token decryption failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'decryption_error'
            }
    
    def _create_payment_record(self, payment_token: Dict[str, Any], 
                              card_info: Dict[str, Any], 
                              order_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create payment record for Apple Pay transaction"""
        try:
            # Extract transaction details
            transaction_id = payment_token.get('transactionIdentifier')
            amount = order_data.get('amount', 0) if order_data else 0
            
            # Create payment record
            payment_vals = {
                'name': f'Apple Pay - {card_info["display_name"]}',
                'amount': amount,
                'payment_method_id': self._get_apple_pay_method().id,
                'apple_pay_transaction_id': transaction_id,
                'card_network': card_info['network'],
                'card_last_four': card_info['last_four'],
                'payment_date': fields.Datetime.now(),
                'payment_status': 'paid',
                'payment_token_data': json.dumps(payment_token),
                'company_id': self.company_id.id
            }
            
            # Link to POS order if provided
            if order_data and order_data.get('order_id'):
                pos_order = self.env['pos.order'].browse(order_data['order_id'])
                if pos_order.exists():
                    payment_vals['pos_order_id'] = pos_order.id
            
            payment_record = self.env['pos.payment'].create(payment_vals)
            
            return {
                'success': True,
                'payment_record': payment_record,
                'transaction_id': transaction_id
            }
            
        except Exception as e:
            _logger.error(f"Payment record creation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': 'record_creation_error'
            }
    
    def _get_apple_pay_method(self):
        """Get or create Apple Pay payment method"""
        apple_pay_method = self.env['pos.payment.method'].search([
            ('name', '=', 'Apple Pay'),
            ('company_id', '=', self.company_id.id)
        ], limit=1)
        
        if not apple_pay_method:
            # Create Apple Pay payment method
            journal = self.env['account.journal'].search([
                ('type', '=', 'bank'),
                ('company_id', '=', self.company_id.id)
            ], limit=1)
            
            if not journal:
                journal = self.env['account.journal'].create({
                    'name': 'Apple Pay',
                    'type': 'bank',
                    'code': 'APPLEPAY',
                    'company_id': self.company_id.id
                })
            
            apple_pay_method = self.env['pos.payment.method'].create({
                'name': 'Apple Pay',
                'journal_id': journal.id,
                'company_id': self.company_id.id,
                'use_payment_terminal': False
            })
        
        return apple_pay_method
    
    def _load_merchant_certificate(self):
        """Load merchant certificate for Apple Pay validation"""
        try:
            # In production, store certificates securely
            # This is a simplified version
            import tempfile
            import os
            
            # Create temporary files for certificate and key
            cert_fd, cert_file = tempfile.mkstemp(suffix='.pem')
            key_fd, key_file = tempfile.mkstemp(suffix='.pem')
            
            try:
                # Write certificate
                with os.fdopen(cert_fd, 'w') as f:
                    f.write(self.merchant_certificate)
                
                # Write private key
                with os.fdopen(key_fd, 'w') as f:
                    f.write(self.merchant_private_key)
                
                return {
                    'cert_file': cert_file,
                    'key_file': key_file
                }
                
            except Exception:
                # Clean up on error
                os.unlink(cert_file)
                os.unlink(key_file)
                raise
                
        except Exception as e:
            _logger.error(f"Certificate loading failed: {e}")
            raise UserError(f"Failed to load merchant certificate: {e}")
    
    def _notify_apple_pay_success(self, payment_record):
        """Send WebSocket notification for successful Apple Pay payment"""
        try:
            websocket_service = self.env['pos.websocket.service']
            websocket_service.broadcast_event('apple_pay.processed', {
                'payment_id': payment_record.id,
                'order_id': payment_record.pos_order_id.id if payment_record.pos_order_id else None,
                'amount': payment_record.amount,
                'card_network': payment_record.card_network,
                'card_last_four': payment_record.card_last_four,
                'timestamp': fields.Datetime.now().isoformat()
            })
        except Exception as e:
            _logger.error(f"Failed to send Apple Pay success notification: {e}")
    
    def _log_apple_pay_event(self, event_type: str, data: Dict[str, Any]):
        """Log Apple Pay events for monitoring"""
        try:
            self.env['pos.apple.pay.log'].create({
                'service_id': self.id,
                'event_type': event_type,
                'event_data': json.dumps(data, default=str),
                'timestamp': fields.Datetime.now(),
                'user_id': self.env.user.id
            })
        except Exception as e:
            _logger.error(f"Failed to log Apple Pay event: {e}")
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check on Apple Pay service"""
        try:
            # Check certificate validity
            cert_valid = self._validate_certificate()
            
            # Check domain validation status
            domain_valid = self.validation_status == 'valid'
            
            # Update health status
            if cert_valid and domain_valid:
                status = 'healthy'
            elif cert_valid or domain_valid:
                status = 'warning'
            else:
                status = 'error'
            
            return {
                'success': True,
                'status': status,
                'certificate_valid': cert_valid,
                'domain_validated': domain_valid,
                'last_validation': self.last_validation.isoformat() if self.last_validation else None,
                'timestamp': fields.Datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'success': False,
                'status': 'error',
                'error': str(e)
            }
    
    def _validate_certificate(self) -> bool:
        """Validate merchant certificate"""
        try:
            if not self.merchant_certificate:
                return False
            
            # Load and validate certificate
            cert = OpenSSL.crypto.load_certificate(
                OpenSSL.crypto.FILETYPE_PEM, 
                self.merchant_certificate
            )
            
            # Check if certificate is expired
            not_after = datetime.strptime(
                cert.get_notAfter().decode(), 
                '%Y%m%d%H%M%SZ'
            )
            
            return not_after > datetime.now()
            
        except Exception as e:
            _logger.error(f"Certificate validation failed: {e}")
            return False


class ApplePayLog(models.Model):
    """Apple Pay event logging"""
    _name = 'pos.apple.pay.log'
    _description = 'Apple Pay Event Log'
    _order = 'timestamp desc'
    
    service_id = fields.Many2one('pos.apple.pay.service', 'Apple Pay Service', required=True)
    event_type = fields.Char('Event Type', required=True)
    event_data = fields.Text('Event Data')
    timestamp = fields.Datetime('Timestamp', required=True)
    user_id = fields.Many2one('res.users', 'User')
    
    def cleanup_old_logs(self, days_to_keep: int = 30):
        """Clean up old event logs"""
        cutoff_date = fields.Datetime.now() - timedelta(days=days_to_keep)
        old_logs = self.search([('timestamp', '<', cutoff_date)])
        old_logs.unlink()
        
        return len(old_logs) 