from typing import Dict, Optional, List
from decimal import Decimal
from .payment_providers.base_provider import BasePaymentProvider, IGatewayRefund
from .payment_providers.stripe_provider import StripeProvider
from .payment_providers.sumup_provider import SumUpProvider
from .payment_providers.cash_provider import CashProvider
from .smart_routing import SmartRoutingService, RoutingStrategy
from .payment_analytics import PaymentAnalyticsService
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

class PaymentProviderFactory:
    """Factory for creating and managing payment providers with smart routing"""
    
    def __init__(self):
        self.providers: Dict[str, BasePaymentProvider] = {} # Changed type hint
        self.smart_router = None
        self.analytics_service = None
        self._initialize_providers()

    def _initialize_smart_routing(self, db_session):
        """Initialize smart routing service with database session"""
        if not self.analytics_service:
            self.analytics_service = PaymentAnalyticsService(db_session)
        if not self.smart_router:
            self.smart_router = SmartRoutingService(self.analytics_service)
    
    def _initialize_providers(self):
        """Initialize all configured payment providers"""
        # Initialize Stripe
        if hasattr(settings, 'STRIPE_API_KEY') and settings.STRIPE_API_KEY:
            self.providers["stripe"] = StripeProvider({
                "api_key": settings.STRIPE_API_KEY
            })
        
        # Initialize Square (temporarily disabled for testing)
        # if (hasattr(settings, 'SQUARE_ACCESS_TOKEN') and settings.SQUARE_ACCESS_TOKEN and
        #     hasattr(settings, 'SQUARE_LOCATION_ID') and settings.SQUARE_LOCATION_ID):
        #     self.providers["square"] = SquareProvider({
        #         "access_token": settings.SQUARE_ACCESS_TOKEN,
        #         "location_id": settings.SQUARE_LOCATION_ID,
        #         "environment": getattr(settings, 'SQUARE_ENVIRONMENT', 'production')
        #     })
        
        # Initialize SumUp
        if (hasattr(settings, 'SUMUP_API_KEY') and settings.SUMUP_API_KEY and
            hasattr(settings, 'SUMUP_MERCHANT_CODE') and settings.SUMUP_MERCHANT_CODE):
            self.providers["sumup"] = SumUpProvider({
                "api_key": settings.SUMUP_API_KEY,
                "merchant_code": settings.SUMUP_MERCHANT_CODE
            })

        # Initialize CashProvider (does not require settings typically)
        self.providers["cash"] = CashProvider()
        logger.info("Cash provider initialized.")

    def get_provider(self, provider_name: str) -> Optional[BasePaymentProvider]: # Changed return type hint
        """Get a specific payment provider by name"""
        provider = self.providers.get(provider_name.lower())
        if not provider:
            logger.warning(f"Payment provider '{provider_name}' not found or not configured.")
        return provider

    def get_refund_provider(self, provider_name: str) -> Optional[IGatewayRefund]:
        """Get a specific payment provider that implements IGatewayRefund."""
        provider = self.get_provider(provider_name)
        if isinstance(provider, IGatewayRefund):
            return provider
        logger.warning(f"Provider '{provider_name}' does not support refunds or is not correctly configured.")
        return None

    async def select_optimal_provider(
        self,
        amount: Decimal,
        restaurant_id: str,
        monthly_volume: Optional[Decimal] = None,
        force_provider: Optional[str] = None,
        strategy: RoutingStrategy = RoutingStrategy.BALANCED,
        db_session = None
    ) -> BasePaymentProvider: # Changed return type hint
        """
        Select the optimal payment provider using smart routing based on:
        - Transaction amount and restaurant volume
        - Provider performance and reliability
        - Cost optimization and routing strategy
        - Real-time provider health scores
        """
        # If a specific provider is requested and available, use it
        if force_provider:
            provider = self.get_provider(force_provider)
            if provider:
                logger.info(f"Using forced provider: {force_provider}")
                return provider
        
        # Initialize smart routing if database session is available
        if db_session and not self.smart_router:
            self._initialize_smart_routing(db_session)
        
        # Use smart routing if available
        if self.smart_router:
            try:
                routing_decision = await self.smart_router.route_payment(
                    amount=amount,
                    restaurant_id=restaurant_id,
                    strategy=strategy,
                    force_provider=force_provider
                )
                
                provider = self.get_provider(routing_decision.selected_provider)
                if provider:
                    logger.info(
                        f"Smart routing selected {routing_decision.selected_provider} "
                        f"(confidence: {routing_decision.confidence:.2f}, "
                        f"reasoning: {', '.join(routing_decision.reasoning)})"
                    )
                    return provider
            except Exception as e:
                logger.warning(f"Smart routing failed, falling back to simple selection: {e}")
        
        # Fallback to simple cost-based selection
        return await self._select_provider_simple(amount, restaurant_id, monthly_volume)
    
    async def _select_provider_simple(
        self,
        amount: Decimal,
        restaurant_id: str,
        monthly_volume: Optional[Decimal] = None
    ) -> BasePaymentProvider:
        """Simple cost-based provider selection (fallback)"""
        
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
    
    async def get_routing_recommendations(
        self,
        restaurant_id: str,
        db_session = None
    ) -> Dict:
        """Get smart routing recommendations for a restaurant"""
        if db_session:
            self._initialize_smart_routing(db_session)
        
        if self.smart_router:
            return await self.smart_router.get_routing_recommendations(restaurant_id)
        else:
            return {"error": "Smart routing not available"}
    
    async def simulate_routing_impact(
        self,
        restaurant_id: str,
        strategy: RoutingStrategy,
        db_session = None
    ) -> Dict:
        """Simulate the impact of changing routing strategy"""
        if db_session:
            self._initialize_smart_routing(db_session)
        
        if self.smart_router:
            return await self.smart_router.simulate_routing_impact(
                restaurant_id, strategy
            )
        else:
            return {"error": "Smart routing not available"}
    
    async def get_provider_analytics(
        self,
        restaurant_id: str,
        db_session = None
    ) -> Dict:
        """Get comprehensive provider analytics"""
        if db_session:
            self._initialize_smart_routing(db_session)
        
        if self.analytics_service:
            return await self.analytics_service.get_provider_performance_summary(restaurant_id)
        else:
            return {"error": "Analytics service not available"}
    
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

# Convenience function for backwards compatibility
def get_payment_provider(provider_name: str):
    """Get payment provider by name"""
    return payment_factory.get_provider(provider_name)