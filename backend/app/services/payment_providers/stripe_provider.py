"""
Stripe Payment Provider Implementation
"""

import stripe
from decimal import Decimal
from typing import Dict, Any, Optional
import logging
from datetime import datetime

from .base import PaymentProvider, PaymentStatus

logger = logging.getLogger(__name__)


class StripeProvider(PaymentProvider):
    """Stripe payment provider implementation"""
    
    async def initialize(self) -> bool:
        """Initialize Stripe with API key"""
        try:
            stripe.api_key = self.config.get('secret_key')
            stripe.api_version = '2023-10-16'
            
            # Test the connection
            stripe.Account.retrieve()
            
            self.logger.info("Stripe provider initialized successfully")
            return True
        except Exception as e:
            self.logger.error(f"Failed to initialize Stripe: {str(e)}")
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
        """Create a payment intent with Stripe"""
        try:
            # Format amount for Stripe (in smallest currency unit)
            stripe_amount = self.format_amount(amount, currency)
            
            # Prepare payment intent data
            intent_data = {
                'amount': stripe_amount,
                'currency': currency.lower(),
                'metadata': {
                    'order_id': order_id,
                    'platform': 'fynlo_pos',
                    **(metadata or {})
                },
                'description': f"Order {order_id}",
                'capture_method': 'automatic'
            }
            
            # Add customer if provided
            if customer_info.get('email'):
                intent_data['receipt_email'] = customer_info['email']
            
            # Handle payment method
            if payment_method.get('token'):
                intent_data['payment_method'] = payment_method['token']
                intent_data['confirm'] = True
            elif payment_method.get('payment_method_id'):
                intent_data['payment_method'] = payment_method['payment_method_id']
                intent_data['confirm'] = True
            
            # Create payment intent
            intent = stripe.PaymentIntent.create(**intent_data)
            
            # Calculate fees
            fee = self.calculate_fee(amount)
            net_amount = amount - fee
            
            return {
                'transaction_id': intent.id,
                'status': self._map_stripe_status(intent.status),
                'fee': fee,
                'net_amount': net_amount,
                'client_secret': intent.client_secret,
                'raw_response': intent
            }
            
        except stripe.error.CardError as e:
            self.logger.error(f"Card error: {str(e)}")
            return {
                'transaction_id': None,
                'status': PaymentStatus.FAILED,
                'error': str(e.user_message),
                'error_code': e.code,
                'raw_response': e.json_body
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
        """Capture a previously authorized payment"""
        try:
            capture_data = {}
            if amount:
                capture_data['amount_to_capture'] = self.format_amount(amount, 'gbp')
            
            intent = stripe.PaymentIntent.capture(transaction_id, **capture_data)
            
            return {
                'success': True,
                'transaction_id': intent.id,
                'status': self._map_stripe_status(intent.status),
                'captured_amount': self.parse_amount(intent.amount_received, intent.currency),
                'raw_response': intent
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
            refund_data = {
                'payment_intent': transaction_id,
                'metadata': {
                    'refund_reason': reason or 'customer_request',
                    'refunded_at': datetime.utcnow().isoformat()
                }
            }
            
            if amount:
                # Get the payment intent to know the currency
                intent = stripe.PaymentIntent.retrieve(transaction_id)
                refund_data['amount'] = self.format_amount(amount, intent.currency)
            
            if reason:
                # Map reason to Stripe's expected values
                reason_map = {
                    'duplicate': 'duplicate',
                    'fraudulent': 'fraudulent',
                    'customer_request': 'requested_by_customer'
                }
                refund_data['reason'] = reason_map.get(reason, 'requested_by_customer')
            
            refund = stripe.Refund.create(**refund_data)
            
            return {
                'success': True,
                'refund_id': refund.id,
                'transaction_id': transaction_id,
                'refunded_amount': self.parse_amount(refund.amount, refund.currency),
                'status': PaymentStatus.REFUNDED if refund.status == 'succeeded' else PaymentStatus.FAILED,
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
            intent = stripe.PaymentIntent.retrieve(transaction_id)
            
            return {
                'transaction_id': intent.id,
                'status': self._map_stripe_status(intent.status),
                'amount': self.parse_amount(intent.amount, intent.currency),
                'currency': intent.currency.upper(),
                'created_at': datetime.fromtimestamp(intent.created).isoformat(),
                'metadata': intent.metadata,
                'raw_response': intent
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
        """Validate a webhook from Stripe"""
        try:
            sig_header = headers.get('Stripe-Signature')
            webhook_secret = self.config.get('webhook_secret')
            
            if not sig_header or not webhook_secret:
                return False
            
            stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
            return True
            
        except ValueError:
            # Invalid payload
            return False
        except stripe.error.SignatureVerificationError:
            # Invalid signature
            return False
    
    async def parse_webhook(
        self,
        payload: bytes
    ) -> Dict[str, Any]:
        """Parse webhook payload"""
        try:
            event = stripe.Event.construct_from(
                stripe.util.json.loads(payload.decode('utf-8')),
                stripe.api_key
            )
            
            # Map Stripe events to our internal events
            event_map = {
                'payment_intent.succeeded': 'payment.completed',
                'payment_intent.payment_failed': 'payment.failed',
                'charge.refunded': 'payment.refunded',
                'payment_intent.canceled': 'payment.cancelled'
            }
            
            return {
                'event_type': event_map.get(event.type, event.type),
                'transaction_id': event.data.object.get('id'),
                'data': event.data.object,
                'raw_event': event
            }
            
        except Exception as e:
            self.logger.error(f"Failed to parse webhook: {str(e)}")
            return {
                'event_type': 'unknown',
                'error': str(e),
                'raw_event': None
            }
    
    def _map_stripe_status(self, stripe_status: str) -> PaymentStatus:
        """Map Stripe status to internal PaymentStatus"""
        status_map = {
            'requires_payment_method': PaymentStatus.PENDING,
            'requires_confirmation': PaymentStatus.PENDING,
            'requires_action': PaymentStatus.PENDING,
            'processing': PaymentStatus.PROCESSING,
            'requires_capture': PaymentStatus.PROCESSING,
            'canceled': PaymentStatus.CANCELLED,
            'succeeded': PaymentStatus.COMPLETED,
            'failed': PaymentStatus.FAILED
        }
        return status_map.get(stripe_status, PaymentStatus.FAILED)