import squareup
from decimal import Decimal
from typing import Dict, Any, Optional
import uuid
from datetime import datetime
from .payment_providers import PaymentProvider, PaymentStatus

class SquareProvider(PaymentProvider):
    """Square payment provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.client = squareup.Client(
            access_token=config.get("access_token"),
            environment=config.get("environment", "production")
        )
        self.location_id = config.get("location_id")
        self.fee_percentage = Decimal("0.0175")  # 1.75%
        self.fee_fixed = Decimal("0.00")  # No fixed fee
    
    async def process_payment(
        self,
        amount: Decimal,
        currency: str = "GBP",
        customer_id: Optional[str] = None,
        payment_method_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        try:
            # Create payment request
            create_payment_request = {
                "source_id": payment_method_id,  # Square calls it source_id
                "idempotency_key": str(uuid.uuid4()),
                "amount_money": {
                    "amount": int(amount * 100),
                    "currency": currency
                },
                "location_id": self.location_id
            }
            
            if customer_id:
                create_payment_request["customer_id"] = customer_id
            
            if metadata:
                create_payment_request["reference_id"] = metadata.get("order_id", "")
                create_payment_request["note"] = metadata.get("note", "")
            
            result = self.client.payments.create_payment(
                body=create_payment_request
            )
            
            if result.is_success():
                payment = result.body.get('payment', {})
                status = PaymentStatus.SUCCESS if payment.get('status') == 'COMPLETED' else PaymentStatus.PENDING
                
                return self.standardize_response(
                    provider_response=payment,
                    status=status,
                    amount=amount,
                    transaction_id=payment.get('id')
                )
            else:
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": str(result.errors)
                }
        except Exception as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e)
            }
    
    async def refund_payment(
        self,
        transaction_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            # Get the original payment to determine amount
            payment_result = self.client.payments.get_payment(payment_id=transaction_id)
            
            if not payment_result.is_success():
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": "Payment not found"
                }
            
            payment = payment_result.body.get('payment', {})
            refund_amount = int(amount * 100) if amount else payment['amount_money']['amount']
            
            refund_request = {
                "idempotency_key": str(uuid.uuid4()),
                "payment_id": transaction_id,
                "amount_money": {
                    "amount": refund_amount,
                    "currency": payment['amount_money']['currency']
                }
            }
            
            if reason:
                refund_request["reason"] = reason
            
            result = self.client.refunds.refund_payment(body=refund_request)
            
            if result.is_success():
                refund = result.body.get('refund', {})
                return {
                    "provider": self.provider_name,
                    "refund_id": refund.get('id'),
                    "transaction_id": transaction_id,
                    "status": PaymentStatus.REFUNDED.value,
                    "amount": refund['amount_money']['amount'],
                    "created_at": refund.get('created_at')
                }
            else:
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": str(result.errors)
                }
        except Exception as e:
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
            checkout_request = {
                "idempotency_key": str(uuid.uuid4()),
                "order": {
                    "idempotency_key": str(uuid.uuid4()),
                    "order": {
                        "location_id": self.location_id,
                        "line_items": [{
                            "name": "Payment",
                            "quantity": "1",
                            "base_price_money": {
                                "amount": int(amount * 100),
                                "currency": currency
                            }
                        }]
                    }
                },
                "redirect_url": return_url
            }
            
            result = self.client.checkout.create_checkout_link(
                location_id=self.location_id,
                body=checkout_request
            )
            
            if result.is_success():
                checkout = result.body.get('checkout', {})
                return {
                    "provider": self.provider_name,
                    "checkout_url": checkout.get('checkout_page_url'),
                    "checkout_id": checkout.get('id'),
                    "order_id": checkout.get('order_id')
                }
            else:
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": str(result.errors)
                }
        except Exception as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e)
            }
    
    def calculate_fee(self, amount: Decimal) -> Decimal:
        """Square UK: 1.75% for online payments"""
        return amount * self.fee_percentage