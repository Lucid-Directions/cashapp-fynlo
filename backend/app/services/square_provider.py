try:
    import squareup
except ImportError:
    squareup = None
    
from decimal import Decimal
from typing import Dict, Any, Optional, List
import uuid
from datetime import datetime
from .payment_providers.base_provider import BasePaymentProvider, PaymentStatus, RefundItemDetail
import logging

logger = logging.getLogger(__name__)

class SquareProvider(BasePaymentProvider): # Inherit from BasePaymentProvider
    """Square payment provider implementation"""

    def __init__(self, config: Dict[str, Any]):
        # Assuming BasePaymentProvider's __init__ takes api_key, api_secret, config
        # We need to map Square's config to these.
        # Square uses access_token primarily.
        super().__init__(
            api_key=config.get("access_token"), # Use access_token as api_key
            config=config
        )
        self.client = squareup.Client(
            access_token=self.api_key, # Use the stored api_key
            environment=config.get("environment", "sandbox")
        )
        self.location_id = config.get("location_id")
        self.auto_complete = config.get("custom_settings", {}).get("auto_complete", True)
        self.fee_percentage = Decimal(config.get("fee_percentage", "0.0175"))
        self.fee_fixed = Decimal(config.get("fee_fixed", "0.00"))
        self.provider_name = "square"

    async def process_payment( # Renamed from create_payment to match BasePaymentProvider
        self,
        amount: Decimal,
        currency: str = "GBP",
        source_id: Optional[str] = None, # e.g., card nonce from Square Web Payments SDK
        customer_id: Optional[str] = None,
        order_id: Optional[str] = None,
        note: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None # Additional metadata
    ) -> Dict[str, Any]:
        """
        Creates a payment with Square.
        If self.auto_complete is true (default), this will attempt to complete the payment.
        If self.auto_complete is false, this creates the payment and it needs to be completed later.
        """
        try:
            if not source_id:
                # TODO: Handle scenarios where source_id might not be immediately available
                # This might involve returning data for client-side confirmation or alternative flows
                # For now, assume source_id is required for direct payment creation.
                # Or, this method could be used to create an order first, then pay for it.
                # The current implementation focuses on direct payment with a source_id.
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": "source_id is required to create a Square payment."
                }

            payment_body = {
                "source_id": source_id,
                "idempotency_key": str(uuid.uuid4()),
                "amount_money": {
                    "amount": int(amount * 100),  # Amount in cents
                    "currency": currency.upper()
                },
                "location_id": self.location_id,
                "autocomplete": self.auto_complete
            }

            if customer_id:
                payment_body["customer_id"] = customer_id
            if order_id:
                payment_body["order_id"] = order_id # Associate with a Square Order if one exists
            if note:
                payment_body["note"] = note
            if metadata:
                # Square's CreatePayment `metadata` field is key-value (string:string)
                # For simplicity, we'll pass it if provided, but may need transformation
                # if our internal metadata is complex. For now, let's assume it's simple.
                # payment_body["metadata"] = metadata # This is not directly available in CreatePayment
                # Using reference_id for simple string metadata, or note.
                # For richer metadata, one would typically link to an Order.
                if "reference_id" in metadata: # Example, could be order_id or custom ref
                    payment_body["reference_id"] = str(metadata["reference_id"])


            result = self.client.payments.create_payment(body=payment_body)

            if result.is_success():
                payment = result.body.get('payment', {})
                # Determine status based on Square's payment status and our autocomplete setting
                square_status = payment.get('status')
                current_status = PaymentStatus.UNKNOWN

                if square_status == 'COMPLETED':
                    current_status = PaymentStatus.SUCCESS
                elif square_status == 'APPROVED': # Payment approved, needs capture if autocomplete=false
                    current_status = PaymentStatus.PENDING if not self.auto_complete else PaymentStatus.SUCCESS
                elif square_status == 'PENDING': # Payment is in progress (e.g. awaiting confirmation)
                    current_status = PaymentStatus.PENDING
                elif square_status == 'CANCELED':
                    current_status = PaymentStatus.CANCELLED
                elif square_status == 'FAILED':
                    current_status = PaymentStatus.FAILED
                
                return self.standardize_response(
                    provider_response=payment,
                    status=current_status,
                    amount=Decimal(payment['amount_money']['amount']) / 100,
                    transaction_id=payment.get('id'),
                    raw_response=result.body # Include full raw response
                )
            else:
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": str(result.errors),
                    "raw_response": result.body if result.body else result.errors
                }
        except Exception as e:
            # Log exception e
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e)
            }

    async def process_payment(self, payment_id: str, order_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Processes (completes) an existing Square payment that was created with autocomplete=false.
        If the payment is already completed or cannot be completed, returns its current status.
        `payment_id` is the Square Payment ID.
        `order_id` (optional) is the ID of the order to complete, if the payment is part of an order.
        """
        try:
            # First, get the payment to check its status
            get_payment_result = self.client.payments.get_payment(payment_id=payment_id)
            if get_payment_result.is_error():
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": f"Failed to retrieve payment {payment_id}: {get_payment_result.errors}",
                    "raw_response": get_payment_result.body
                }

            payment_data = get_payment_result.body.get('payment', {})
            square_status = payment_data.get('status')

            if square_status == 'COMPLETED':
                return self.standardize_response(
                    provider_response=payment_data,
                    status=PaymentStatus.SUCCESS,
                    amount=Decimal(payment_data['amount_money']['amount']) / 100,
                    transaction_id=payment_data.get('id'),
                    message="Payment is already completed.",
                    raw_response=get_payment_result.body
                )

            if square_status != 'APPROVED': # Can only complete 'APPROVED' payments
                return self.standardize_response(
                    provider_response=payment_data,
                    status=PaymentStatus.FAILED, # Or a more specific status based on square_status
                    amount=Decimal(payment_data['amount_money']['amount']) / 100,
                    transaction_id=payment_data.get('id'),
                    error=f"Payment is not in an APPROVED state for completion. Current status: {square_status}",
                    raw_response=get_payment_result.body
                )

            # If payment is APPROVED and autocomplete was false, attempt to complete it
            complete_payment_body = {}
            if order_id: # If completing a payment for a specific order.
                # The CompletePayment endpoint does not take order_id.
                # Completion is for the payment itself.
                pass

            result = self.client.payments.complete_payment(payment_id=payment_id, body=complete_payment_body)

            if result.is_success():
                completed_payment = result.body.get('payment', {})
                return self.standardize_response(
                    provider_response=completed_payment,
                    status=PaymentStatus.SUCCESS,
                    amount=Decimal(completed_payment['amount_money']['amount']) / 100,
                    transaction_id=completed_payment.get('id'),
                    raw_response=result.body
                )
            else:
                # Attempt to get updated payment status even if complete failed
                get_payment_result_after_fail = self.client.payments.get_payment(payment_id=payment_id)
                payment_after_fail = get_payment_result_after_fail.body.get('payment', {}) if get_payment_result_after_fail.is_success() else payment_data

                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": f"Failed to complete payment {payment_id}: {result.errors}",
                    "current_square_status": payment_after_fail.get('status'),
                    "transaction_id": payment_id,
                    "raw_response": result.body if result.body else result.errors
                }
        except Exception as e:
            # Log exception e
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e),
                "transaction_id": payment_id
            }

    async def get_payment_status(self, payment_id: str) -> Dict[str, Any]:
        """Gets the status of a specific payment by its Square Payment ID."""
        try:
            result = self.client.payments.get_payment(payment_id=payment_id)
            if result.is_success():
                payment = result.body.get('payment', {})
                square_status = payment.get('status')
                current_status = PaymentStatus.UNKNOWN

                if square_status == 'COMPLETED':
                    current_status = PaymentStatus.SUCCESS
                elif square_status == 'APPROVED':
                    current_status = PaymentStatus.PENDING # Needs capture or will auto-void
                elif square_status == 'PENDING':
                     current_status = PaymentStatus.PENDING
                elif square_status == 'CANCELED':
                    current_status = PaymentStatus.CANCELLED
                elif square_status == 'FAILED':
                    current_status = PaymentStatus.FAILED

                return self.standardize_response(
                    provider_response=payment,
                    status=current_status,
                    amount=Decimal(payment['amount_money']['amount']) / 100,
                    transaction_id=payment.get('id'),
                    raw_response=result.body
                )
            else:
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": f"Failed to retrieve payment status for {payment_id}: {result.errors}",
                    "transaction_id": payment_id,
                    "raw_response": result.body if result.body else result.errors
                }
        except Exception as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e),
                "transaction_id": payment_id
            }

    async def refund_payment(
        self,
        transaction_id: str, # This is Square's payment_id
        amount_to_refund: Decimal,
        reason: Optional[str] = None,
        items_to_refund: Optional[List[RefundItemDetail]] = None, # Square API supports line item refunds on an Order
        order_id: Optional[str] = None, # Fynlo's order ID, for logging/reference
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Processes a refund with Square.
        If items_to_refund are provided and a Square order_id (from original payment) is available,
        it can attempt an itemized refund. Otherwise, it's an general amount-based refund against the payment.
        """
        try:
            # Square's refund API primarily works on a payment_id.
            # For itemized refunds, it's more complex and usually tied to a Square Order object.
            # We'll focus on refunding a payment by its ID and amount.
            # If `items_to_refund` is provided, it's mostly for our internal logging or if a
            # more advanced Square Order refund is implemented later.

            # Ensure amount is positive for the request
            if amount_to_refund <= 0:
                logger.error(f"Square refund_payment error: Refund amount must be positive. Received: {amount_to_refund}")
                return {"success": False, "error": "Refund amount must be positive.", "status": "failed"}

            # Get the original payment to confirm currency and check total amount if not partial
            # This is also good for verifying the payment_id exists before attempting refund.
            original_payment_response = self.client.payments.get_payment(payment_id=transaction_id)
            if original_payment_response.is_error():
                logger.error(f"Square: Failed to retrieve original payment {transaction_id} for refund: {original_payment_response.errors}")
                return {
                    "success": False,
                    "error": f"Original payment {transaction_id} not found or error fetching it.",
                    "status": "failed",
                    "raw_response": original_payment_response.body if hasattr(original_payment_response, 'body') else original_payment_response.errors
                }
            
            original_payment = original_payment_response.body.get('payment', {})
            original_amount_money = original_payment.get('amount_money', {})
            currency = original_amount_money.get('currency', 'GBP') # Default to GBP if not found

            refund_amount_cents = int(amount_to_refund * 100)

            refund_body: Dict[str, Any] = {
                "idempotency_key": str(uuid.uuid4()),
                "payment_id": transaction_id, # This is the Square payment ID to refund
                "amount_money": {
                    "amount": refund_amount_cents,
                    "currency": currency
                }
            }

            if reason:
                refund_body["reason"] = reason
            
            # If a Square order_id was associated with the original payment, it might be useful for context
            # or more advanced refund types (e.g., itemized against a Square Order).
            square_order_id_from_payment = original_payment.get('order_id')
            if square_order_id_from_payment and items_to_refund:
              # This would require using client.refunds.create_refund() and potentially different body structure
              # For now, we use client.payments.refund_payment() which is amount-based on a payment_id.
              # Square's CreateRefund endpoint on the RefundsApi is more flexible for itemized.
              # Let's stick to refunding the payment for now as per existing structure.
              logger.info(f"Square: Itemized refund info provided for Fynlo order {order_id}, but applying amount-based refund to payment {transaction_id}. Square Order ID was {square_order_id_from_payment}.")


            logger.info(f"Attempting Square refund for payment_id: {transaction_id}, amount: {amount_to_refund} {currency}")
            # Using the PaymentRefundsApi's refund_payment method
            result = self.client.refunds.refund_payment(body=refund_body)


            if result.is_success():
                refund = result.body.get('refund', {})
                logger.info(f"Square refund successful: {refund.get('id')} for payment {transaction_id}")
                return {
                    "success": True,
                    "refund_id": refund.get('id'),
                    "gateway_transaction_id": transaction_id, # Original payment ID
                    "status": refund.get('status', 'COMPLETED').lower(), # Square status: PENDING, COMPLETED, REJECTED, FAILED
                    "amount_refunded": Decimal(str(refund.get('amount_money', {}).get('amount', 0))) / 100,
                    "currency": refund.get('amount_money', {}).get('currency'),
                    "reason": refund.get('reason'),
                    "created_at": refund.get('created_at'),
                    "raw_response": result.body
                }
            else:
                logger.error(f"Square refund failed for payment {transaction_id}: {result.errors}")
                return {
                    "success": False,
                    "error": str(result.errors),
                    "status": "failed",
                    "raw_response": result.body if result.body else result.errors
                }
        except Exception as e:
            logger.exception(f"Square refund_payment unexpected error for transaction {transaction_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "status": "failed"
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