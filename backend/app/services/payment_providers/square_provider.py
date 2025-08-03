"""
Square Payment Provider Implementation
"""

from decimal import Decimal
from typing import Dict, Any, Optional
import logging
import uuid

try:
    from square import client as Client
    from square.models import (
        CreatePaymentRequest,
        Money,
        UpdatePaymentRequest,
        RefundPaymentRequest,
    )
except ImportError:
    # For testing - mock the Square imports
    Client = None
    CreatePaymentRequest = None
    Money = None
    UpdatePaymentRequest = None
    RefundPaymentRequest = None

from .base import PaymentProvider, PaymentStatus

logger = logging.getLogger(__name__)


class SquareProvider(PaymentProvider):
    """Square payment provider implementation"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.client = None
        self.location_id = config.get("location_id")

    async def initialize(self) -> bool:
        """Initialize Square client"""
        if Client is None:
            # Square SDK not available (testing mode)
            self.logger.warning("Square SDK not available - using mock mode")
            return True

        try:
            # Initialize Square client
            self.client = Client(
                access_token=self.config.get("access_token"),
                environment=(
                    "production"
                    if self.config.get("mode") == "production"
                    else "sandbox"
                ),
            )

            # Test the connection
            result = self.client.locations.list_locations()

            if result.is_error():
                self.logger.error(f"Failed to initialize Square: {result.errors}")
                return False

            # If no location_id provided, use the first one
            if not self.location_id and result.body.get("locations"):
                self.location_id = result.body["locations"][0]["id"]
                self.config["location_id"] = self.location_id

            self.logger.info("Square provider initialized successfully")
            return True

        except Exception as e:
            self.logger.error(f"Failed to initialize Square: {str(e)}")
            return False

    async def create_payment(
        self,
        amount: Decimal,
        currency: str,
        order_id: str,
        customer_info: Dict[str, Any],
        payment_method: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a payment with Square"""
        try:
            # Create money object
            amount_money = Money(
                amount=self.format_amount(amount, currency), currency=currency.upper()
            )

            # Generate idempotency key
            idempotency_key = str(uuid.uuid4())

            # Build payment request
            request_body = CreatePaymentRequest(
                source_id=payment_method.get("nonce")
                or payment_method.get("source_id"),
                idempotency_key=idempotency_key,
                amount_money=amount_money,
                location_id=self.location_id,
                reference_id=order_id,
                note=f"Order {order_id}",
            )

            # Add customer if provided
            if customer_info.get("email"):
                request_body.buyer_email_address = customer_info["email"]

            # Create payment
            result = self.client.payments.create_payment(request_body)

            if result.is_error():
                self.logger.error(f"Payment creation failed: {result.errors}")
                return {
                    "transaction_id": None,
                    "status": PaymentStatus.FAILED,
                    "error": str(result.errors),
                    "raw_response": result.errors,
                }

            payment = result.body["payment"]

            # Calculate fees
            fee = self.calculate_fee(amount)
            net_amount = amount - fee

            return {
                "transaction_id": payment["id"],
                "status": self._map_square_status(payment["status"]),
                "fee": fee,
                "net_amount": net_amount,
                "receipt_url": payment.get("receipt_url"),
                "raw_response": payment,
            }

        except Exception as e:
            self.logger.error(f"Payment creation failed: {str(e)}")
            return {
                "transaction_id": None,
                "status": PaymentStatus.FAILED,
                "error": str(e),
                "raw_response": None,
            }

    async def capture_payment(
        self, transaction_id: str, amount: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """Square captures payments automatically"""
        # Square doesn't support separate auth/capture flow for most payment types
        # Payments are captured automatically
        try:
            result = self.client.payments.get_payment(transaction_id)

            if result.is_error():
                return {
                    "success": False,
                    "error": str(result.errors),
                    "raw_response": result.errors,
                }

            payment = result.body["payment"]

            return {
                "success": True,
                "transaction_id": payment["id"],
                "status": self._map_square_status(payment["status"]),
                "captured_amount": self.parse_amount(
                    payment["amount_money"]["amount"],
                    payment["amount_money"]["currency"],
                ),
                "raw_response": payment,
            }

        except Exception as e:
            self.logger.error(f"Payment capture failed: {str(e)}")
            return {"success": False, "error": str(e), "raw_response": None}

    async def refund_payment(
        self,
        transaction_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Refund a payment"""
        try:
            # Get the original payment
            payment_result = self.client.payments.get_payment(transaction_id)

            if payment_result.is_error():
                return {
                    "success": False,
                    "error": str(payment_result.errors),
                    "raw_response": payment_result.errors,
                }

            payment = payment_result.body["payment"]
            currency = payment["amount_money"]["currency"]

            # Prepare refund amount
            if amount:
                refund_money = Money(
                    amount=self.format_amount(amount, currency), currency=currency
                )
            else:
                refund_money = payment["amount_money"]

            # Create refund request
            request_body = RefundPaymentRequest(
                idempotency_key=str(uuid.uuid4()),
                amount_money=refund_money,
                payment_id=transaction_id,
                reason=reason or "Customer requested refund",
            )

            result = self.client.refunds.refund_payment(request_body)

            if result.is_error():
                return {
                    "success": False,
                    "error": str(result.errors),
                    "raw_response": result.errors,
                }

            refund = result.body["refund"]

            return {
                "success": True,
                "refund_id": refund["id"],
                "transaction_id": transaction_id,
                "refunded_amount": self.parse_amount(
                    refund["amount_money"]["amount"], refund["amount_money"]["currency"]
                ),
                "status": self._map_square_refund_status(refund["status"]),
                "raw_response": refund,
            }

        except Exception as e:
            self.logger.error(f"Refund failed: {str(e)}")
            return {"success": False, "error": str(e), "raw_response": None}

    async def get_transaction_status(self, transaction_id: str) -> Dict[str, Any]:
        """Get current status of a transaction"""
        try:
            result = self.client.payments.get_payment(transaction_id)

            if result.is_error():
                return {
                    "transaction_id": transaction_id,
                    "status": PaymentStatus.FAILED,
                    "error": str(result.errors),
                    "raw_response": result.errors,
                }

            payment = result.body["payment"]

            return {
                "transaction_id": payment["id"],
                "status": self._map_square_status(payment["status"]),
                "amount": self.parse_amount(
                    payment["amount_money"]["amount"],
                    payment["amount_money"]["currency"],
                ),
                "currency": payment["amount_money"]["currency"],
                "created_at": payment["created_at"],
                "receipt_url": payment.get("receipt_url"),
                "raw_response": payment,
            }

        except Exception as e:
            self.logger.error(f"Failed to get transaction status: {str(e)}")
            return {
                "transaction_id": transaction_id,
                "status": PaymentStatus.FAILED,
                "error": str(e),
                "raw_response": None,
            }

    async def validate_webhook(self, payload: bytes, headers: Dict[str, str]) -> bool:
        """Validate a webhook from Square"""
        try:
            # Square webhook validation
            signature = headers.get("X-Square-Hmacsha256-Signature")
            webhook_signature_key = self.config.get("webhook_signature_key")

            if not signature or not webhook_signature_key:
                return False

            # Validate the webhook signature
            is_valid = self.client.webhooks.verify_signature(
                body=payload.decode("utf-8"),
                signature=signature,
                signature_key=webhook_signature_key,
                notification_url=self.config.get("webhook_url", ""),
            )

            return is_valid

        except Exception as e:
            self.logger.error(f"Webhook validation failed: {str(e)}")
            return False

    async def parse_webhook(self, payload: bytes) -> Dict[str, Any]:
        """Parse webhook payload"""
        try:
            import json

            data = json.loads(payload.decode("utf-8"))

            # Map Square events to our internal events
            event_map = {
                "payment.created": "payment.created",
                "payment.updated": "payment.updated",
                "refund.created": "payment.refunded",
                "refund.updated": "payment.refund_updated",
            }

            event_type = data.get("type", "unknown")

            return {
                "event_type": event_map.get(event_type, event_type),
                "transaction_id": data.get("data", {})
                .get("object", {})
                .get("payment", {})
                .get("id"),
                "data": data.get("data", {}),
                "raw_event": data,
            }

        except Exception as e:
            self.logger.error(f"Failed to parse webhook: {str(e)}")
            return {"event_type": "unknown", "error": str(e), "raw_event": None}

    def _map_square_status(self, square_status: str) -> PaymentStatus:
        """Map Square status to internal PaymentStatus"""
        status_map = {
            "PENDING": PaymentStatus.PENDING,
            "APPROVED": PaymentStatus.PROCESSING,
            "COMPLETED": PaymentStatus.COMPLETED,
            "CANCELED": PaymentStatus.CANCELLED,
            "FAILED": PaymentStatus.FAILED,
        }
        return status_map.get(square_status, PaymentStatus.FAILED)

    def _map_square_refund_status(self, square_status: str) -> PaymentStatus:
        """Map Square refund status to internal PaymentStatus"""
        status_map = {
            "PENDING": PaymentStatus.PROCESSING,
            "APPROVED": PaymentStatus.REFUNDED,
            "REJECTED": PaymentStatus.FAILED,
            "FAILED": PaymentStatus.FAILED,
            "COMPLETED": PaymentStatus.REFUNDED,
        }
        return status_map.get(square_status, PaymentStatus.FAILED)
