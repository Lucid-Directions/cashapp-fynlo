"""
Secure Payment Processing Service
Handles payment processing with automatic fallback and comprehensive security
"""

from typing import Dict, Any, Optional
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, DECIMAL, Text
import uuid
import logging

from app.core.database import Base
from app.core.exceptions import FynloException
from app.services.secure_payment_config import SecurePaymentConfigService
from app.services.payment_providers import PaymentStatus
from app.services.payment_factory import PaymentProviderFactory


class PaymentProcessingError(FynloException):
    """Payment processing specific exception"""

    def __init__(self, message: str, payment_id: Optional[str] = None, **kwargs):
        super().__init__(message, **kwargs)
        self.payment_id = payment_id


class Payment(Base):
    """Payment transaction record"""

    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, nullable=False)
    restaurant_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)

    amount = Column(DECIMAL(10, 2), nullable=False)
    currency = Column(String(3), default="GBP")
    payment_method = Column(String, nullable=False)

    status = Column(String, default="pending")
    provider = Column(String)  # Which provider processed it
    provider_transaction_id = Column(String)  # Provider's transaction ID

    fee_amount = Column(DECIMAL(10, 2), default=0)
    net_amount = Column(DECIMAL(10, 2))  # Amount after fees

    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    # Store sanitized provider responses
    provider_response = Column(Text)  # JSON
    error_message = Column(Text)

    # Metadata
    payment_metadata = Column(Text)  # JSON

    __table_args__ = ({"extend_existing": True},)


class PaymentAuditLog(Base):
    """Audit trail for all payment actions"""

    __tablename__ = "payment_audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    payment_id = Column(String)
    action = Column(String)  # 'attempt', 'success', 'failure', 'refund'
    provider = Column(String)
    user_id = Column(String)
    ip_address = Column(String)
    user_agent = Column(String)
    request_data = Column(Text)  # JSON - sanitized
    response_data = Column(Text)  # JSON - sanitized
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = ({"extend_existing": True},)


class SecurePaymentProcessor:
    """
    Secure payment processing with automatic fallback

    Features:
    - Multiple provider support with automatic fallback
    - Comprehensive audit logging
    - Fee calculation and transparency
    - Security validation at every step
    - Database transaction management
    """

    def __init__(self, db: Session, request_context: Optional[Dict[str, Any]] = None):
        self.db = db
        self.config_service = SecurePaymentConfigService(db)
        self.provider_factory = PaymentProviderFactory()
        self.request_context = request_context or {}
        self.logger = logging.getLogger(__name__)
        self._initialized = False

    async def process_payment(
        self,
        order_id: str,
        amount: Decimal,
        payment_method: str,
        payment_details: Dict[str, Any],
        user_id: str,
        restaurant_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Process payment with automatic fallback

        Args:
            order_id: Order ID
            amount: Payment amount
            payment_method: Payment method (card, cash, qr_code, etc.)
            payment_details: Method-specific payment details
            user_id: User processing the payment
            restaurant_id: Restaurant ID
            metadata: Optional metadata

        Returns:
            Payment result dict

        Raises:
            PaymentProcessingError: If all payment attempts fail
        """
        # Start database transaction
        payment = None
        try:
            # Validate inputs
            self._validate_payment_request(amount, payment_method)

            # Create payment record
            payment = Payment(
                order_id=order_id,
                amount=amount,
                currency="GBP",
                payment_method=payment_method,
                status="pending",
                user_id=user_id,
                restaurant_id=restaurant_id,
                metadata=str(metadata) if metadata else None,
            )
            self.db.add(payment)
            self.db.commit()

            # Log payment attempt
            self._log_action(
                payment_id=payment.id,
                action="attempt",
                provider="system",
                request_data={
                    "amount": float(amount),
                    "payment_method": payment_method,
                    "order_id": order_id,
                },
            )

            # Initialize providers if not done
            if not self._initialized:
                await self.provider_factory.initialize(restaurant_id)
                self._initialized = True

            # Get providers for fallback processing
            providers = await self.provider_factory.get_providers_for_fallback(
                amount=amount, payment_method=payment_method, currency="GBP"
            )

            if not providers:
                raise PaymentProcessingError(
                    f"No payment providers available for {payment_method}",
                    payment_id=payment.id,
                )

            # Try each provider
            last_error = None
            for provider in providers:
                try:
                    provider_name = provider.provider_name

                    # Log provider attempt
                    self._log_action(
                        payment_id=payment.id,
                        action="provider_attempt",
                        provider=provider_name,
                        request_data={"provider": provider_name},
                    )

                    # Process payment
                    result = await self._process_with_provider(
                        provider=provider,
                        provider_name=provider_name,
                        payment=payment,
                        amount=amount,
                        payment_details=payment_details,
                        order_id=order_id,
                    )

                    # Payment successful
                    return result

                except Exception as e:
                    last_error = e
                    self.logger.error(f"Provider {provider_name} failed: {str(e)}")

                    # Log provider failure
                    self._log_action(
                        payment_id=payment.id,
                        action="provider_failure",
                        provider=provider_name,
                        error_message=str(e),
                    )

                    # Continue to next provider
                    continue

            # All providers failed
            payment.status = "failed"
            payment.error_message = str(last_error)
            self.db.commit()

            # Log complete failure
            self._log_action(
                payment_id=payment.id,
                action="failure",
                provider="all",
                error_message=f"All providers failed. Last error: {str(last_error)}",
            )

            raise PaymentProcessingError(
                f"Payment processing failed: {last_error}", payment_id=payment.id
            )

        except PaymentProcessingError:
            raise
        except Exception as e:
            if payment:
                payment.status = "failed"
                payment.error_message = str(e)
                self.db.commit()
            raise PaymentProcessingError(f"Unexpected error: {str(e)}")

    async def _process_with_provider(
        self,
        provider: "PaymentProvider",
        provider_name: str,
        payment: Payment,
        amount: Decimal,
        payment_details: Dict[str, Any],
        order_id: str,
    ) -> Dict[str, Any]:
        """Process payment with a specific provider"""
        # Process payment
        result = await provider.create_payment(
            amount=amount,
            currency="GBP",
            order_id=order_id,
            customer_info=payment_details.get("customer_info", {}),
            payment_method=payment_details,
            metadata={"payment_id": payment.id, "restaurant_id": payment.restaurant_id},
        )

        # Validate provider response
        if result.get("status") == PaymentStatus.FAILED:
            raise Exception(result.get("error", "Payment failed"))

        # Get fees from provider response
        fee_amount = result.get("fee", Decimal("0"))
        net_amount = result.get("net_amount", amount - fee_amount)

        # Update payment record
        payment.provider = provider_name
        payment.provider_transaction_id = result.get("transaction_id")
        payment.status = result.get("status", PaymentStatus.COMPLETED).value
        payment.completed_at = datetime.utcnow()
        payment.fee_amount = fee_amount
        payment.net_amount = net_amount
        payment.provider_response = str(result)
        self.db.commit()

        # Log success
        self._log_action(
            payment_id=payment.id,
            action="success",
            provider=provider_name,
            response_data=result,
        )

        return {
            "success": True,
            "payment_id": payment.id,
            "transaction_id": result.get("transaction_id"),
            "provider": provider_name,
            "amount": float(amount),
            "currency": "GBP",
            "fees": {
                "total_fee": float(fee_amount),
                "rate_percentage": float(provider.calculate_fee(Decimal("100")) / 100),
            },
            "net_amount": float(payment.net_amount),
            "status": payment.status,
            "completed_at": payment.completed_at.isoformat(),
        }

    def _validate_payment_request(self, amount: Decimal, payment_method: str):
        """Validate payment request with security checks"""
        # Amount validation
        if not isinstance(amount, Decimal):
            raise ValueError("Amount must be a Decimal")

        if amount <= 0:
            raise ValueError("Payment amount must be positive")

        if amount > Decimal("10000"):  # £10,000 limit
            raise ValueError("Payment amount exceeds maximum limit (£10,000)")

        # Payment method validation
        valid_methods = ["card", "cash", "qr_code", "apple_pay", "google_pay"]
        if payment_method not in valid_methods:
            raise ValueError(f"Invalid payment method: {payment_method}")

    def _log_action(
        self,
        payment_id: str,
        action: str,
        provider: str,
        request_data: Optional[Dict[str, Any]] = None,
        response_data: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ):
        """Log payment action for audit trail"""
        try:
            log_entry = PaymentAuditLog(
                payment_id=payment_id,
                action=action,
                provider=provider,
                user_id=self.request_context.get("user_id"),
                ip_address=self.request_context.get("ip_address"),
                user_agent=self.request_context.get("user_agent"),
                request_data=(
                    str(self._sanitize_data(request_data)) if request_data else None
                ),
                response_data=(
                    str(self._sanitize_data(response_data)) if response_data else None
                ),
                error_message=error_message,
            )
            self.db.add(log_entry)
            self.db.commit()
        except Exception as e:
            self.logger.error(f"Failed to log payment action: {str(e)}")

    def _sanitize_data(self, data: Any) -> Any:
        """Remove sensitive information from data before logging"""
        if not data:
            return data

        sensitive_keys = [
            "card_number",
            "cvv",
            "cvc",
            "pin",
            "account_number",
            "routing_number",
            "api_key",
            "secret_key",
            "access_token",
        ]

        if isinstance(data, dict):
            sanitized = {}
            for key, value in data.items():
                if any(sensitive in key.lower() for sensitive in sensitive_keys):
                    sanitized[key] = "[REDACTED]"
                elif isinstance(value, dict):
                    sanitized[key] = self._sanitize_data(value)
                elif isinstance(value, list):
                    sanitized[key] = [self._sanitize_data(item) for item in value]
                else:
                    sanitized[key] = value
            return sanitized

        return data
