"""
Base Payment Provider Abstract Class
"""

from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Dict, Any, Optional, List
from enum import Enum
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class PaymentStatus(Enum):
    """Payment status enum"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    PARTIAL_REFUND = "partial_refund"


class PaymentProvider(ABC):
    """Abstract base class for payment providers"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize payment provider with configuration
        
        Args:
            config: Provider-specific configuration including credentials
        """
        self.config = config
        self.provider_name = self.__class__.__name__.replace('Provider', '').lower()
        self.logger = logging.getLogger(f"{__name__}.{self.provider_name}")
    
    @abstractmethod
    async def initialize(self) -> bool:
        """
        Initialize the payment provider connection
        
        Returns:
            bool: True if initialization successful
        """
    
    @abstractmethod
    async def create_payment(
        self, 
        amount: Decimal, 
        currency: str,
        order_id: str,
        customer_info: Dict[str, Any],
        payment_method: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a payment with the provider
        
        Args:
            amount: Payment amount
            currency: Currency code (e.g., 'GBP')
            order_id: Internal order reference
            customer_info: Customer details
            payment_method: Payment method details
            metadata: Additional metadata
            
        Returns:
            Dict containing:
                - transaction_id: Provider's transaction ID
                - status: Payment status
                - fee: Provider fee
                - net_amount: Amount after fees
                - raw_response: Full provider response
        """
    
    @abstractmethod
    async def capture_payment(
        self, 
        transaction_id: str,
        amount: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """
        Capture a previously authorized payment
        
        Args:
            transaction_id: Provider's transaction ID
            amount: Amount to capture (None for full amount)
            
        Returns:
            Dict with capture details
        """
    
    @abstractmethod
    async def refund_payment(
        self,
        transaction_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Refund a payment
        
        Args:
            transaction_id: Provider's transaction ID
            amount: Amount to refund (None for full refund)
            reason: Refund reason
            
        Returns:
            Dict with refund details
        """
    
    @abstractmethod
    async def get_transaction_status(
        self,
        transaction_id: str
    ) -> Dict[str, Any]:
        """
        Get current status of a transaction
        
        Args:
            transaction_id: Provider's transaction ID
            
        Returns:
            Dict with transaction status and details
        """
    
    @abstractmethod
    async def validate_webhook(
        self,
        payload: bytes,
        headers: Dict[str, str]
    ) -> bool:
        """
        Validate a webhook from the provider
        
        Args:
            payload: Raw webhook payload
            headers: Webhook headers
            
        Returns:
            bool: True if webhook is valid
        """
    
    @abstractmethod
    async def parse_webhook(
        self,
        payload: bytes
    ) -> Dict[str, Any]:
        """
        Parse webhook payload
        
        Args:
            payload: Raw webhook payload
            
        Returns:
            Dict with parsed webhook data
        """
    
    def calculate_fee(self, amount: Decimal) -> Decimal:
        """
        Calculate provider fee for amount
        
        Args:
            amount: Transaction amount
            
        Returns:
            Fee amount
        """
        fee_rate = Decimal(str(self.config.get('fee_rate', 0.029)))
        fixed_fee = Decimal(str(self.config.get('fixed_fee', 0.30)))
        return (amount * fee_rate + fixed_fee).quantize(Decimal('0.01'))
    
    def get_supported_currencies(self) -> List[str]:
        """Get list of supported currencies"""
        return self.config.get('supported_currencies', ['GBP', 'EUR', 'USD'])
    
    def get_supported_payment_methods(self) -> List[str]:
        """Get list of supported payment methods"""
        return self.config.get('supported_methods', ['card'])
    
    def is_available(self) -> bool:
        """Check if provider is currently available"""
        return self.config.get('enabled', True)
    
    def supports_recurring(self) -> bool:
        """Check if provider supports recurring payments"""
        return self.config.get('supports_recurring', False)
    
    def supports_refunds(self) -> bool:
        """Check if provider supports refunds"""
        return self.config.get('supports_refunds', True)
    
    def get_minimum_amount(self) -> Decimal:
        """Get minimum transaction amount"""
        return Decimal(str(self.config.get('minimum_amount', 0.50)))
    
    def get_maximum_amount(self) -> Decimal:
        """Get maximum transaction amount"""
        return Decimal(str(self.config.get('maximum_amount', 999999.99)))
    
    def format_amount(self, amount: Decimal, currency: str) -> int:
        """
        Format amount for provider API (usually in smallest currency unit)
        
        Args:
            amount: Decimal amount
            currency: Currency code
            
        Returns:
            Amount in smallest unit (e.g., pence for GBP)
        """
        # Most providers expect amounts in smallest currency unit
        return int(amount * 100)
    
    def parse_amount(self, amount: int, currency: str) -> Decimal:
        """
        Parse amount from provider format to Decimal
        
        Args:
            amount: Amount in smallest unit
            currency: Currency code
            
        Returns:
            Decimal amount
        """
        return Decimal(amount) / 100
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test provider connection and credentials
        
        Returns:
            Dict with test results
        """
        try:
            initialized = await self.initialize()
            return {
                'success': initialized,
                'provider': self.provider_name,
                'timestamp': datetime.utcnow().isoformat(),
                'message': 'Connection successful' if initialized else 'Connection failed'
            }
        except Exception as e:
            self.logger.error(f"Connection test failed: {str(e)}")
            return {
                'success': False,
                'provider': self.provider_name,
                'timestamp': datetime.utcnow().isoformat(),
                'message': str(e)
            }