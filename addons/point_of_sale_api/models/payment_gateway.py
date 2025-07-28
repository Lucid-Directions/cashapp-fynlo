import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, Any, Optional, List
import hashlib
import hmac
import json

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError

_logger = logging.getLogger(__name__)


class PaymentGatewayInterface(ABC):
    """Abstract payment gateway interface"""
    
    @abstractmethod
    def authorize(self, amount: float, payment_method: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Authorize a payment"""
        pass
    
    @abstractmethod
    def capture(self, transaction_id: str, amount: Optional[float] = None) -> Dict[str, Any]:
        """Capture an authorized payment"""
        pass
    
    @abstractmethod
    def refund(self, transaction_id: str, amount: float, reason: str = None) -> Dict[str, Any]:
        """Refund a payment"""
        pass
    
    @abstractmethod
    def void(self, transaction_id: str, reason: str = None) -> Dict[str, Any]:
        """Void an authorized payment"""
        pass
    
    @abstractmethod
    def get_status(self, transaction_id: str) -> Dict[str, Any]:
        """Get payment status"""
        pass
    
    @abstractmethod
    def process_webhook(self, payload: str, signature: str) -> Dict[str, Any]:
        """Process webhook from payment provider"""
        pass


class StripeGateway(PaymentGatewayInterface):
    """Stripe payment gateway implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        self.api_key = config.get('api_key')
        self.webhook_secret = config.get('webhook_secret')
        self.publishable_key = config.get('publishable_key')
        
    def authorize(self, amount: float, payment_method: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Authorize payment with Stripe"""
        try:
            # Convert to cents for Stripe
            amount_cents = int(amount * 100)
            
            # Mock Stripe API call
            response = {
                'id': f'pi_{hashlib.md5(str(datetime.now()).encode()).hexdigest()[:12]}',
                'status': 'requires_capture',
                'amount': amount_cents,
                'currency': kwargs.get('currency', 'usd'),
                'payment_method': payment_method.get('id'),
                'created': int(datetime.now().timestamp())
            }
            
            return {
                'success': True,
                'transaction_id': response['id'],
                'status': 'authorized',
                'amount': amount,
                'response': response
            }
            
        except Exception as e:
            _logger.error(f"Stripe authorize error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def capture(self, transaction_id: str, amount: Optional[float] = None) -> Dict[str, Any]:
        """Capture Stripe payment"""
        try:
            # Mock Stripe capture
            response = {
                'id': transaction_id,
                'status': 'succeeded',
                'amount_received': int((amount or 0) * 100)
            }
            
            return {
                'success': True,
                'transaction_id': transaction_id,
                'status': 'captured',
                'response': response
            }
            
        except Exception as e:
            _logger.error(f"Stripe capture error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def refund(self, transaction_id: str, amount: float, reason: str = None) -> Dict[str, Any]:
        """Refund Stripe payment"""
        try:
            refund_id = f're_{hashlib.md5(f"{transaction_id}{amount}".encode()).hexdigest()[:12]}'
            
            response = {
                'id': refund_id,
                'payment_intent': transaction_id,
                'amount': int(amount * 100),
                'status': 'succeeded',
                'reason': reason or 'requested_by_customer'
            }
            
            return {
                'success': True,
                'refund_id': refund_id,
                'status': 'refunded',
                'amount': amount,
                'response': response
            }
            
        except Exception as e:
            _logger.error(f"Stripe refund error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def void(self, transaction_id: str, reason: str = None) -> Dict[str, Any]:
        """Void Stripe payment"""
        try:
            response = {
                'id': transaction_id,
                'status': 'canceled',
                'cancellation_reason': reason or 'requested_by_customer'
            }
            
            return {
                'success': True,
                'transaction_id': transaction_id,
                'status': 'voided',
                'response': response
            }
            
        except Exception as e:
            _logger.error(f"Stripe void error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_status(self, transaction_id: str) -> Dict[str, Any]:
        """Get Stripe payment status"""
        try:
            # Mock status check
            response = {
                'id': transaction_id,
                'status': 'succeeded',
                'amount': 1000,
                'currency': 'usd'
            }
            
            return {
                'success': True,
                'status': 'completed',
                'response': response
            }
            
        except Exception as e:
            _logger.error(f"Stripe status error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def process_webhook(self, payload: str, signature: str) -> Dict[str, Any]:
        """Process Stripe webhook"""
        try:
            # Verify webhook signature
            expected_sig = hmac.new(
                self.webhook_secret.encode(),
                payload.encode(),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(f'sha256={expected_sig}', signature):
                raise ValidationError("Invalid webhook signature")
            
            event_data = json.loads(payload)
            
            return {
                'success': True,
                'event_type': event_data.get('type'),
                'data': event_data.get('data', {})
            }
            
        except Exception as e:
            _logger.error(f"Stripe webhook error: {e}")
            return {
                'success': False,
                'error': str(e)
            }


class SquareGateway(PaymentGatewayInterface):
    """Square payment gateway implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        self.access_token = config.get('access_token')
        self.application_id = config.get('application_id')
        self.location_id = config.get('location_id')
        self.webhook_signature_key = config.get('webhook_signature_key')
    
    def authorize(self, amount: float, payment_method: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Authorize payment with Square"""
        try:
            # Convert to cents for Square
            amount_cents = int(amount * 100)
            
            response = {
                'payment': {
                    'id': f'sq_{hashlib.md5(str(datetime.now()).encode()).hexdigest()[:12]}',
                    'status': 'APPROVED',
                    'amount_money': {
                        'amount': amount_cents,
                        'currency': kwargs.get('currency', 'USD').upper()
                    },
                    'source_type': 'CARD',
                    'created_at': datetime.now().isoformat()
                }
            }
            
            return {
                'success': True,
                'transaction_id': response['payment']['id'],
                'status': 'authorized',
                'amount': amount,
                'response': response
            }
            
        except Exception as e:
            _logger.error(f"Square authorize error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def capture(self, transaction_id: str, amount: Optional[float] = None) -> Dict[str, Any]:
        """Square payments are automatically captured"""
        return {
            'success': True,
            'transaction_id': transaction_id,
            'status': 'captured'
        }
    
    def refund(self, transaction_id: str, amount: float, reason: str = None) -> Dict[str, Any]:
        """Refund Square payment"""
        try:
            refund_id = f'sqrf_{hashlib.md5(f"{transaction_id}{amount}".encode()).hexdigest()[:12]}'
            
            response = {
                'refund': {
                    'id': refund_id,
                    'status': 'COMPLETED',
                    'amount_money': {
                        'amount': int(amount * 100),
                        'currency': 'USD'
                    },
                    'payment_id': transaction_id,
                    'reason': reason or 'Customer request'
                }
            }
            
            return {
                'success': True,
                'refund_id': refund_id,
                'status': 'refunded',
                'amount': amount,
                'response': response
            }
            
        except Exception as e:
            _logger.error(f"Square refund error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def void(self, transaction_id: str, reason: str = None) -> Dict[str, Any]:
        """Square doesn't support void - use refund instead"""
        return {
            'success': False,
            'error': 'Square does not support void operations - use refund instead'
        }
    
    def get_status(self, transaction_id: str) -> Dict[str, Any]:
        """Get Square payment status"""
        try:
            response = {
                'payment': {
                    'id': transaction_id,
                    'status': 'COMPLETED',
                    'amount_money': {
                        'amount': 1000,
                        'currency': 'USD'
                    }
                }
            }
            
            return {
                'success': True,
                'status': 'completed',
                'response': response
            }
            
        except Exception as e:
            _logger.error(f"Square status error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def process_webhook(self, payload: str, signature: str) -> Dict[str, Any]:
        """Process Square webhook"""
        try:
            # Verify webhook signature
            notification_url = ''  # Would be set from request
            expected_sig = hmac.new(
                self.webhook_signature_key.encode(),
                (notification_url + payload).encode(),
                hashlib.sha256
            ).digest().hex()
            
            if not hmac.compare_digest(expected_sig, signature):
                raise ValidationError("Invalid webhook signature")
            
            event_data = json.loads(payload)
            
            return {
                'success': True,
                'event_type': event_data.get('type'),
                'data': event_data.get('data', {})
            }
            
        except Exception as e:
            _logger.error(f"Square webhook error: {e}")
            return {
                'success': False,
                'error': str(e)
            }


class PaymentGatewayConfig(models.Model):
    """Payment gateway configuration"""
    _name = 'pos.payment.gateway.config'
    _description = 'Payment Gateway Configuration'
    
    name = fields.Char('Name', required=True)
    provider = fields.Selection([
        ('stripe', 'Stripe'),
        ('square', 'Square'),
        ('adyen', 'Adyen')
    ], string='Provider', required=True)
    
    # Configuration fields
    api_key = fields.Char('API Key')
    secret_key = fields.Char('Secret Key')
    publishable_key = fields.Char('Publishable Key')
    webhook_secret = fields.Char('Webhook Secret')
    
    # Environment
    environment = fields.Selection([
        ('sandbox', 'Sandbox'),
        ('production', 'Production')
    ], string='Environment', default='sandbox')
    
    # Status
    active = fields.Boolean('Active', default=True)
    is_primary = fields.Boolean('Primary Gateway', default=False)
    
    # Settings
    auto_capture = fields.Boolean('Auto Capture', default=True)
    supports_refunds = fields.Boolean('Supports Refunds', default=True)
    supports_voids = fields.Boolean('Supports Voids', default=True)
    
    # Additional provider-specific settings
    config_json = fields.Text('Additional Configuration (JSON)')
    
    @api.model
    def get_gateway_instance(self, provider: str = None) -> PaymentGatewayInterface:
        """Get gateway instance"""
        if not provider:
            # Get primary gateway
            config = self.search([('is_primary', '=', True), ('active', '=', True)], limit=1)
        else:
            config = self.search([('provider', '=', provider), ('active', '=', True)], limit=1)
        
        if not config:
            raise UserError("No active payment gateway configuration found")
        
        gateway_config = {
            'api_key': config.api_key,
            'secret_key': config.secret_key,
            'publishable_key': config.publishable_key,
            'webhook_secret': config.webhook_secret,
        }
        
        # Add additional config from JSON
        if config.config_json:
            try:
                additional_config = json.loads(config.config_json)
                gateway_config.update(additional_config)
            except json.JSONDecodeError:
                pass
        
        # Return appropriate gateway instance
        if config.provider == 'stripe':
            return StripeGateway(gateway_config)
        elif config.provider == 'square':
            return SquareGateway(gateway_config)
        else:
            raise UserError(f"Unsupported payment provider: {config.provider}")


class PaymentGatewayTransaction(models.Model):
    """Payment gateway transaction log"""
    _name = 'pos.payment.gateway.transaction'
    _description = 'Payment Gateway Transaction'
    _order = 'create_date desc'
    
    payment_id = fields.Many2one('pos.payment', 'POS Payment', required=True, ondelete='cascade')
    gateway_config_id = fields.Many2one('pos.payment.gateway.config', 'Gateway Config', required=True)
    
    # Transaction details
    transaction_id = fields.Char('Transaction ID', required=True)
    transaction_type = fields.Selection([
        ('authorize', 'Authorize'),
        ('capture', 'Capture'),
        ('refund', 'Refund'),
        ('void', 'Void')
    ], string='Type', required=True)
    
    # Amounts
    amount = fields.Monetary('Amount', currency_field='currency_id')
    currency_id = fields.Many2one('res.currency', 'Currency', default=lambda self: self.env.company.currency_id)
    
    # Status
    status = fields.Selection([
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('canceled', 'Canceled')
    ], string='Status', default='pending')
    
    # Gateway response
    gateway_response = fields.Text('Gateway Response')
    error_message = fields.Text('Error Message')
    
    # Timestamps
    processed_at = fields.Datetime('Processed At')
    
    def _serialize_for_api(self):
        """Serialize transaction for API response"""
        return {
            'id': self.id,
            'transaction_id': self.transaction_id,
            'type': self.transaction_type,
            'amount': self.amount,
            'currency': self.currency_id.name,
            'status': self.status,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'error_message': self.error_message
        } 