"""
SumUp Payment Provider Implementation
"""

from decimal import Decimal
from typing import Dict, Any, Optional
import logging
from  import 
import httpx

from .base import PaymentProvider, PaymentStatus

logger = logging.getLogger(__name__)


class SumUpProvider(PaymentProvider):
    """SumUp payment provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.base_url = "https://api.sumup.com/v0.1" if config.get('mode') == 'production' else "https://api.sumup.com/v0.1"
        self.access_token = config.get('access_token')
        self.merchant_code = config.get('merchant_code')
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }
        )
    
    async def initialize(self) -> bool:
        """Initialize SumUp connection"""
        try:
            # Test the connection by getting merchant info
            response = await self.client.get('/me')
            
            if response.status_code != 200:
                self.logger.error(f"Failed to initialize SumUp: {response.text}")
                return False
            
            merchant_info = response.json()
            self.merchant_code = merchant_info.get('merchant_profile', {}).get('merchant_code', self.merchant_code)
            
            self.logger.info("SumUp provider initialized successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to initialize SumUp: {str(e)}")
            return False
    
    async def create_payment(
        self, 
        amount: Decimal, 
        currency: str,
        order_id: str,
        customer_info: Dict[str, Any],
        payment_method: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a checkout for payment"""
        try:
            # SumUp uses checkout API for online payments
            checkout_data = {
                'checkout_reference': order_id,
                'amount': float(amount),
                'currency': currency.upper(),
                'merchant_code': self.merchant_code,
                'description': f"Order {order_id}",
                'return_url': self.config.get('return_url', 'https://app.fynlo.com/payment/return'),
                'redirect_url': self.config.get('redirect_url', 'https://app.fynlo.com/payment/complete')
            }
            
            # Add customer email if provided
            if customer_info.get('email'):
                checkout_data['customer_email'] = customer_info['email']
            
            # Create checkout
            response = await self.client.post('/checkouts', json=checkout_data)
            
            if response.status_code not in [200, 201]:
                self.logger.error(f"Payment creation failed: {response.text}")
                return {
                    'transaction_id': None,
                    'status': PaymentStatus.FAILED,
                    'error': response.text,
                    'raw_response': response.json() if response.headers.get('content-type') == 'application/json' else None
                }
            
            checkout = response.json()
            
            # Calculate fees (SumUp typically charges 1.69% for online payments)
            fee = self.calculate_fee(amount)
            net_amount = amount - fee
            
            return {
                'transaction_id': checkout['id'],
                'status': PaymentStatus.PENDING,  # Checkout created, awaiting payment
                'fee': fee,
                'net_amount': net_amount,
                'checkout_url': checkout.get('checkout_url'),
                'raw_response': checkout
            }
            
        except Exception as e:
            self.logger.error(f"Payment creation failed: {str(e)}")
            return {
                'transaction_id': None,
                'status': PaymentStatus.FAILED,
                'error': str(e),
                'raw_response': None
            }
    
    async def capture_payment(
        self, 
        transaction_id: str,
        amount: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """SumUp captures payments automatically"""
        # SumUp doesn't support separate auth/capture flow
        # Payments are captured automatically when completed
        try:
            # Get checkout status
            response = await self.client.get(f'/checkouts/{transaction_id}')
            
            if response.status_code != 200:
                return {
                    'success': False,
                    'error': response.text,
                    'raw_response': None
                }
            
            checkout = response.json()
            
            # Get transaction details if checkout is complete
            if checkout['status'] == 'PAID':
                transactions = checkout.get('transactions', [])
                if transactions:
                    transaction = transactions[0]
                    return {
                        'success': True,
                        'transaction_id': transaction['id'],
                        'status': self._map_sumup_status(transaction['status']),
                        'captured_amount': Decimal(str(transaction['amount'])),
                        'raw_response': transaction
                    }
            
            return {
                'success': False,
                'error': f"Checkout not in capturable state: {checkout['status']}",
                'raw_response': checkout
            }
            
        except Exception as e:
            self.logger.error(f"Payment capture failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'raw_response': None
            }
    
    async def refund_payment(
        self,
        transaction_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Refund a payment"""
        try:
            # For SumUp, we need the transaction ID, not checkout ID
            # First, try to get transaction details
            response = await self.client.get(f'/me/transactions/{transaction_id}')
            
            if response.status_code != 200:
                # Try getting from checkout
                checkout_response = await self.client.get(f'/checkouts/{transaction_id}')
                if checkout_response.status_code == 200:
                    checkout = checkout_response.json()
                    if checkout.get('transactions'):
                        transaction_id = checkout['transactions'][0]['id']
                    else:
                        return {
                            'success': False,
                            'error': 'No completed transaction found for refund',
                            'raw_response': checkout
                        }
                else:
                    return {
                        'success': False,
                        'error': 'Transaction not found',
                        'raw_response': None
                    }
            
            # Create refund
            refund_data = {}
            if amount:
                refund_data['amount'] = float(amount)
            
            response = await self.client.post(
                f'/me/refund/{transaction_id}',
                json=refund_data
            )
            
            if response.status_code not in [200, 201]:
                return {
                    'success': False,
                    'error': response.text,
                    'raw_response': response.json() if response.headers.get('content-type') == 'application/json' else None
                }
            
            refund = response.json()
            
            return {
                'success': True,
                'refund_id': refund.get('id', transaction_id),
                'transaction_id': transaction_id,
                'refunded_amount': Decimal(str(refund.get('amount', amount or 0))),
                'status': PaymentStatus.REFUNDED,
                'raw_response': refund
            }
            
        except Exception as e:
            self.logger.error(f"Refund failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'raw_response': None
            }
    
    async def get_transaction_status(
        self,
        transaction_id: str
    ) -> Dict[str, Any]:
        """Get current status of a transaction"""
        try:
            # Try as transaction ID first
            response = await self.client.get(f'/me/transactions/{transaction_id}')
            
            if response.status_code == 200:
                transaction = response.json()
                return {
                    'transaction_id': transaction['id'],
                    'status': self._map_sumup_status(transaction['status']),
                    'amount': Decimal(str(transaction['amount'])),
                    'currency': transaction['currency'],
                    'created_at': transaction.get('timestamp'),
                    'raw_response': transaction
                }
            
            # Try as checkout ID
            response = await self.client.get(f'/checkouts/{transaction_id}')
            
            if response.status_code == 200:
                checkout = response.json()
                
                # Get transaction from checkout if available
                if checkout.get('transactions'):
                    transaction = checkout['transactions'][0]
                    return {
                        'transaction_id': transaction['id'],
                        'status': self._map_sumup_status(transaction['status']),
                        'amount': Decimal(str(transaction['amount'])),
                        'currency': transaction['currency'],
                        'created_at': transaction.get('timestamp'),
                        'checkout_id': checkout['id'],
                        'raw_response': checkout
                    }
                else:
                    return {
                        'transaction_id': checkout['id'],
                        'status': self._map_sumup_checkout_status(checkout['status']),
                        'amount': Decimal(str(checkout['amount'])),
                        'currency': checkout['currency'],
                        'created_at': checkout.get('date'),
                        'raw_response': checkout
                    }
            
            return {
                'transaction_id': transaction_id,
                'status': PaymentStatus.FAILED,
                'error': 'Transaction not found',
                'raw_response': None
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get transaction status: {str(e)}")
            return {
                'transaction_id': transaction_id,
                'status': PaymentStatus.FAILED,
                'error': str(e),
                'raw_response': None
            }
    
    async def validate_webhook(
        self,
        payload: bytes,
        headers: Dict[str, str]
    ) -> bool:
        """Validate a webhook from SumUp"""
        try:
            # SumUp webhook validation
            signature = headers.get('X-Sumup-Signature')
            webhook_secret = self.config.get('webhook_secret')
            
            if not signature or not webhook_secret:
                return False
            
            # Calculate expected signature
            import hmac
            import hashlib
            
            expected_signature = hmac.new(
                webhook_secret.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected_signature)
            
        except Exception as e:
            self.logger.error(f"Webhook validation failed: {str(e)}")
            return False
    
    async def parse_webhook(
        self,
        payload: bytes
    ) -> Dict[str, Any]:
        """Parse webhook payload"""
        try:
            import json
            data = json.loads(payload.decode('utf-8'))
            
            # Map SumUp events to our internal events
            event_map = {
                'checkout.completed': 'payment.completed',
                'transaction.successful': 'payment.completed',
                'transaction.failed': 'payment.failed',
                'refund.successful': 'payment.refunded',
                'refund.failed': 'payment.refund_failed'
            }
            
            event_type = data.get('event_type', 'unknown')
            
            return {
                'event_type': event_map.get(event_type, event_type),
                'transaction_id': data.get('id') or data.get('transaction_id'),
                'data': data,
                'raw_event': data
            }
            
        except Exception as e:
            self.logger.error(f"Failed to parse webhook: {str(e)}")
            return {
                'event_type': 'unknown',
                'error': str(e),
                'raw_event': None
            }
    
    def calculate_fee(self, amount: Decimal) -> Decimal:
        """Calculate SumUp fee (1.69% for online payments)"""
        fee_rate = Decimal('0.0169')  # 1.69%
        return (amount * fee_rate).quantize(Decimal('0.01'))
    
    def _map_sumup_status(self, sumup_status: str) -> PaymentStatus:
        """Map SumUp transaction status to internal PaymentStatus"""
        status_map = {
            'PENDING': PaymentStatus.PENDING,
            'SUCCESSFUL': PaymentStatus.COMPLETED,
            'FAILED': PaymentStatus.FAILED,
            'CANCELLED': PaymentStatus.CANCELLED,
            'REFUNDED': PaymentStatus.REFUNDED
        }
        return status_map.get(sumup_status, PaymentStatus.FAILED)
    
    def _map_sumup_checkout_status(self, checkout_status: str) -> PaymentStatus:
        """Map SumUp checkout status to internal PaymentStatus"""
        status_map = {
            'PENDING': PaymentStatus.PENDING,
            'PAID': PaymentStatus.COMPLETED,
            'UNPAID': PaymentStatus.PENDING,
            'FAILED': PaymentStatus.FAILED,
            'EXPIRED': PaymentStatus.CANCELLED
        }
        return status_map.get(checkout_status, PaymentStatus.FAILED)
    
    async def __aenter__(self):
        """Async context manager entry"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - close HTTP client"""
        await self.client.aclose()