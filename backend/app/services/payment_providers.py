from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from enum import Enum
from datetime import datetime
from decimal import Decimal

class PaymentStatus(Enum):
    SUCCESS = "success"
    PENDING = "pending"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class PaymentProvider(ABC):
    """Abstract base class for all payment providers"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.provider_name = self.__class__.__name__.replace('Provider', '')
    
    @abstractmethod
    async def process_payment(
        self,
        amount: Decimal,
        currency: str = "GBP",
        customer_id: Optional[str] = None,
        payment_method_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a payment through the provider
        
        Returns standardized response:
        {
            "provider": "Stripe",
            "transaction_id": "pi_1234567890",
            "status": "success",
            "amount": 1000,  # in pence
            "currency": "GBP",
            "fee": 29,  # provider fee in pence
            "net_amount": 971,
            "created_at": "2024-01-20T10:30:00Z",
            "metadata": {...}
        }
        """
        pass
    
    @abstractmethod
    async def refund_payment(
        self,
        transaction_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process a refund for a previous payment"""
        pass
    
    @abstractmethod
    async def create_checkout(
        self,
        amount: Decimal,
        currency: str = "GBP",
        return_url: str = None,
        cancel_url: str = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a checkout session for web/mobile payments"""
        pass
    
    @abstractmethod
    def calculate_fee(self, amount: Decimal) -> Decimal:
        """Calculate the provider fee for a given amount"""
        pass
    
    def standardize_response(
        self,
        provider_response: Dict[str, Any],
        status: PaymentStatus,
        amount: Decimal,
        transaction_id: str
    ) -> Dict[str, Any]:
        """Convert provider-specific response to standard format"""
        fee = self.calculate_fee(amount)
        return {
            "provider": self.provider_name,
            "transaction_id": transaction_id,
            "status": status.value,
            "amount": int(amount * 100),  # Convert to pence
            "currency": "GBP",
            "fee": int(fee * 100),
            "net_amount": int((amount - fee) * 100),
            "created_at": datetime.utcnow().isoformat() + "Z",
            "raw_response": provider_response,
            "metadata": provider_response.get("metadata", {})
        }