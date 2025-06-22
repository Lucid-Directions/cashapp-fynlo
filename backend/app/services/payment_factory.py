from typing import Dict, Any, Optional, List
from decimal import Decimal
from .payment_providers import PaymentProvider
from .stripe_provider import StripeProvider
from .square_provider import SquareProvider
from .sumup_provider import SumUpProvider
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

class PaymentProviderFactory:
    """Factory for creating and managing payment providers"""
    
    def __init__(self):
        self.providers: Dict[str, PaymentProvider] = {}
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize all configured payment providers"""
        # Initialize Stripe
        if hasattr(settings, 'STRIPE_API_KEY') and settings.STRIPE_API_KEY:
            self.providers["stripe"] = StripeProvider({
                "api_key": settings.STRIPE_API_KEY
            })
        
        # Initialize Square
        if (hasattr(settings, 'SQUARE_ACCESS_TOKEN') and settings.SQUARE_ACCESS_TOKEN and
            hasattr(settings, 'SQUARE_LOCATION_ID') and settings.SQUARE_LOCATION_ID):
            self.providers["square"] = SquareProvider({
                "access_token": settings.SQUARE_ACCESS_TOKEN,
                "location_id": settings.SQUARE_LOCATION_ID,
                "environment": getattr(settings, 'SQUARE_ENVIRONMENT', 'production')
            })
        
        # Initialize SumUp
        if (hasattr(settings, 'SUMUP_API_KEY') and settings.SUMUP_API_KEY and
            hasattr(settings, 'SUMUP_MERCHANT_CODE') and settings.SUMUP_MERCHANT_CODE):
            self.providers["sumup"] = SumUpProvider({
                "api_key": settings.SUMUP_API_KEY,
                "merchant_code": settings.SUMUP_MERCHANT_CODE
            })
    
    def get_provider(self, provider_name: str) -> Optional[PaymentProvider]:
        """Get a specific payment provider by name"""
        return self.providers.get(provider_name.lower())
    
    async def select_optimal_provider(
        self,
        amount: Decimal,
        restaurant_id: str,
        monthly_volume: Optional[Decimal] = None,
        force_provider: Optional[str] = None
    ) -> PaymentProvider:
        """
        Select the most cost-effective payment provider based on:
        - Transaction amount
        - Restaurant's monthly volume
        - Provider availability
        - Cost optimization
        """
        # If a specific provider is requested and available, use it
        if force_provider:
            provider = self.get_provider(force_provider)
            if provider:
                return provider
        
        # Get restaurant's monthly volume from database if not provided
        if monthly_volume is None:
            monthly_volume = await self._get_restaurant_monthly_volume(restaurant_id)
        
        # Calculate costs for each provider
        provider_costs = self._calculate_provider_costs(amount, monthly_volume)
        
        # Sort by cost and select the cheapest available provider
        sorted_providers = sorted(provider_costs.items(), key=lambda x: x[1])
        
        for provider_name, cost in sorted_providers:
            if provider_name in self.providers:
                logger.info(
                    f"Selected {provider_name} for £{amount} transaction "
                    f"(monthly volume: £{monthly_volume}, cost: £{cost:.2f})"
                )
                return self.providers[provider_name]
        
        # Fallback to Stripe if no providers available
        if "stripe" in self.providers:
            return self.providers["stripe"]
        
        raise ValueError("No payment providers available")
    
    def _calculate_provider_costs(
        self,
        amount: Decimal,
        monthly_volume: Decimal
    ) -> Dict[str, Decimal]:
        """Calculate the cost of processing with each provider"""
        costs = {}
        
        # Stripe: 1.4% + 20p
        if "stripe" in self.providers:
            costs["stripe"] = (amount * Decimal("0.014")) + Decimal("0.20")
        
        # Square: 1.75%
        if "square" in self.providers:
            costs["square"] = amount * Decimal("0.0175")
        
        # SumUp: 0.69% if volume > £2,714/month, else 1.69%
        if "sumup" in self.providers:
            if monthly_volume >= Decimal("2714"):
                # Include amortized monthly fee
                transactions_per_month = monthly_volume / Decimal("50")  # Assume avg £50/transaction
                monthly_fee_per_transaction = Decimal("19") / transactions_per_month
                costs["sumup"] = (amount * Decimal("0.0069")) + monthly_fee_per_transaction
            else:
                costs["sumup"] = amount * Decimal("0.0169")
        
        return costs
    
    async def _get_restaurant_monthly_volume(self, restaurant_id: str) -> Decimal:
        """Get restaurant's average monthly transaction volume"""
        # This would query the database for the restaurant's monthly volume
        # For now, return a default value
        # TODO: Implement actual database query
        from ..crud.payments import get_restaurant_monthly_volume
        try:
            return await get_restaurant_monthly_volume(restaurant_id)
        except:
            # Fallback to default volume
            return Decimal("2000")  # Default £2,000/month
    
    def get_available_providers(self) -> List[str]:
        """Get list of all available payment providers"""
        return list(self.providers.keys())
    
    def calculate_savings(
        self,
        amount: Decimal,
        monthly_volume: Decimal,
        current_provider: str,
        optimal_provider: str
    ) -> Decimal:
        """Calculate potential savings by switching providers"""
        costs = self._calculate_provider_costs(amount, monthly_volume)
        current_cost = costs.get(current_provider, Decimal("0"))
        optimal_cost = costs.get(optimal_provider, Decimal("0"))
        return current_cost - optimal_cost

# Global factory instance
payment_factory = PaymentProviderFactory()