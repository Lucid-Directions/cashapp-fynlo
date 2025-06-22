import stripe
from decimal import Decimal
from typing import Dict, Any, Optional
from datetime import datetime
from .payment_providers import PaymentProvider, PaymentStatus

class StripeProvider(PaymentProvider):
    """Stripe payment provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        stripe.api_key = config.get("api_key")
        self.fee_percentage = Decimal("0.014")  # 1.4% + 20p
        self.fee_fixed = Decimal("0.20")
    
    async def process_payment(
        self,
        amount: Decimal,
        currency: str = "GBP",
        customer_id: Optional[str] = None,
        payment_method_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        try:
            # Create payment intent
            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),  # Convert to pence
                currency=currency.lower(),
                customer=customer_id,
                payment_method=payment_method_id,
                confirm=True if payment_method_id else False,
                metadata=metadata or {}
            )
            
            status = PaymentStatus.SUCCESS if intent.status == "succeeded" else PaymentStatus.PENDING
            
            return self.standardize_response(
                provider_response=intent,
                status=status,
                amount=amount,
                transaction_id=intent.id
            )
        except stripe.error.StripeError as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e),
                "error_code": e.code
            }
    
    async def refund_payment(
        self,
        transaction_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            refund_params = {"payment_intent": transaction_id}
            if amount:
                refund_params["amount"] = int(amount * 100)
            if reason:
                refund_params["reason"] = reason
            
            refund = stripe.Refund.create(**refund_params)
            
            return {
                "provider": self.provider_name,
                "refund_id": refund.id,
                "transaction_id": transaction_id,
                "status": PaymentStatus.REFUNDED.value,
                "amount": refund.amount,
                "created_at": datetime.fromtimestamp(refund.created).isoformat() + "Z"
            }
        except stripe.error.StripeError as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e)
            }
    
    async def create_checkout(
        self,
        amount: Decimal,
        currency: str = "GBP",
        return_url: str = None,
        cancel_url: str = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': currency.lower(),
                        'product_data': {'name': 'Payment'},
                        'unit_amount': int(amount * 100),
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=return_url,
                cancel_url=cancel_url,
                metadata=metadata or {}
            )
            
            return {
                "provider": self.provider_name,
                "checkout_url": session.url,
                "session_id": session.id,
                "expires_at": datetime.fromtimestamp(session.expires_at).isoformat() + "Z"
            }
        except stripe.error.StripeError as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e)
            }
    
    def calculate_fee(self, amount: Decimal) -> Decimal:
        """Stripe UK: 1.4% + 20p for UK cards"""
        return (amount * self.fee_percentage) + self.fee_fixed