from abc import ABC, abstractmethod
from decimal import Decimal
from typing import List, Dict, Any, Optional

class RefundItemDetail(Dict[str, Any]):
    line_id: str
    quantity: int
    amount: Optional[Decimal] # Optional: some gateways might take item amount for partial item refund

class IGatewayRefund(ABC):
    @abstractmethod
    async def refund_payment(
        self,
        transaction_id: str, # The original payment transaction ID from the gateway
        amount_to_refund: Decimal,
        reason: Optional[str] = None,
        items_to_refund: Optional[List[RefundItemDetail]] = None,
        order_id: Optional[str] = None, # Fynlo's internal order ID, for logging/reference
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Processes a refund through the payment gateway.

        Args:
            transaction_id: The gateway's ID for the original payment.
            amount_to_refund: The total amount to be refunded.
            reason: Optional reason for the refund.
            items_to_refund: Optional list of items for partial refunds, if supported by the gateway.
            order_id: Fynlo's internal order ID for which this refund is being processed.
            **kwargs: Additional gateway-specific parameters.

        Returns:
            A dictionary containing the refund transaction details from the gateway,
            including at least 'success' (bool), 'refund_id' (str, gateway's refund ID),
            'status' (str, e.g., 'succeeded', 'pending', 'failed'), and optionally 'error' (str).
        """
        pass

class BasePaymentProvider(IGatewayRefund, ABC): # Make it inherit IGatewayRefund
    def __init__(self, api_key: str, api_secret: Optional[str] = None, config: Optional[Dict[str, Any]] = None):
        self.api_key = api_key
        self.api_secret = api_secret
        self.config = config or {}

    @abstractmethod
    async def process_payment(self, amount: Decimal, currency: str, **kwargs) -> Dict[str, Any]:
        pass

    # Other common payment methods (charge, authorize, etc.) would go here.
    # For now, focusing on refund.
    async def refund_payment(
        self,
        transaction_id: str,
        amount_to_refund: Decimal,
        reason: Optional[str] = None,
        items_to_refund: Optional[List[RefundItemDetail]] = None,
        order_id: Optional[str] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        # Default implementation or raise NotImplementedError if all providers must implement it fully
        raise NotImplementedError("Refund functionality is not implemented for this provider.")

    async def get_transaction_details(self, transaction_id: str) -> Dict[str, Any]:
        raise NotImplementedError("Get transaction details is not implemented for this provider.")

    async def void_payment(self, transaction_id: str, **kwargs) -> Dict[str, Any]:
        raise NotImplementedError("Void payment is not implemented for this provider.")

    # Add other common interface methods as needed
    async def check_credentials(self) -> bool:
        """Checks if the provided credentials are valid."""
        return True # Placeholder
