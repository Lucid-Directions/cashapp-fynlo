"""
Payment Provider Factory with Smart Routing
"""

from typing import Dict, Any, List, Optional
from decimal import Decimal
import logging
from datetime import datetime, timedelta

from .base import PaymentProvider, PaymentStatus
from .stripe_provider import StripeProvider
from .square_provider import SquareProvider
from .sumup_provider import SumUpProvider
from ..secure_payment_config import SecurePaymentConfigService
from ...core.database import get_db
from ..secure_payment_config import PaymentProviderConfig

logger = logging.getLogger(__name__)


class PaymentProviderFactory:
    """Factory for creating and managing payment providers with smart routing"""
    
    def __init__(self):
        self.providers: Dict[str, PaymentProvider] = {}
        self.config_service = SecurePaymentConfig()
        self._initialized = False
    
    async def initialize(self, restaurant_id: str):
        """Initialize all configured payment providers for a restaurant"""
        if self._initialized:
            return
        
        try:
            # Get all provider configurations for the restaurant
            configs = await self._get_provider_configs(restaurant_id)
            
            for config in configs:
                if config.is_active:
                    provider = await self._create_provider(
                        config.provider_name,
                        config.config_data,
                        restaurant_id
                    )
                    if provider:
                        self.providers[config.provider_name] = provider
            
            self._initialized = True
            logger.info(f"Initialized {len(self.providers)} payment providers for restaurant {restaurant_id}")
            
        except Exception as e:
            logger.error(f"Failed to initialize payment providers: {str(e)}")
            raise
    
    async def get_provider(self, provider_name: str) -> Optional[PaymentProvider]:
        """Get a specific payment provider"""
        return self.providers.get(provider_name)
    
    async def get_best_provider(
        self,
        amount: Decimal,
        payment_method: str,
        currency: str = 'GBP'
    ) -> Optional[PaymentProvider]:
        """
        Get the best provider based on fees, availability, and performance
        
        Selection criteria:
        1. Provider must be available and support the payment method
        2. Lowest fee for the transaction amount
        3. Best performance metrics (success rate, response time)
        """
        available_providers = []
        
        for name, provider in self.providers.items():
            if (provider.is_available() and 
                payment_method in provider.get_supported_payment_methods() and
                currency in provider.get_supported_currencies()):
                
                # Calculate fee for this provider
                fee = provider.calculate_fee(amount)
                
                # Get performance metrics
                metrics = await self._get_provider_metrics(name)
                
                available_providers.append({
                    'provider': provider,
                    'name': name,
                    'fee': fee,
                    'success_rate': metrics.get('success_rate', 0.95),
                    'avg_response_time': metrics.get('avg_response_time', 1.0)
                })
        
        if not available_providers:
            logger.warning("No available providers found")
            return None
        
        # Sort by fee (ascending) and success rate (descending)
        available_providers.sort(
            key=lambda x: (x['fee'], -x['success_rate'], x['avg_response_time'])
        )
        
        best = available_providers[0]
        logger.info(f"Selected {best['name']} provider with fee {best['fee']} for amount {amount}")
        
        return best['provider']
    
    async def get_providers_for_fallback(
        self,
        amount: Decimal,
        payment_method: str,
        currency: str = 'GBP'
    ) -> List[PaymentProvider]:
        """
        Get ordered list of providers for fallback processing
        
        Returns providers ordered by preference for automatic fallback
        """
        available_providers = []
        
        for name, provider in self.providers.items():
            if (provider.is_available() and 
                payment_method in provider.get_supported_payment_methods() and
                currency in provider.get_supported_currencies()):
                
                fee = provider.calculate_fee(amount)
                metrics = await self._get_provider_metrics(name)
                
                available_providers.append({
                    'provider': provider,
                    'name': name,
                    'fee': fee,
                    'success_rate': metrics.get('success_rate', 0.95),
                    'avg_response_time': metrics.get('avg_response_time', 1.0)
                })
        
        # Sort by fee and performance
        available_providers.sort(
            key=lambda x: (x['fee'], -x['success_rate'], x['avg_response_time'])
        )
        
        return [p['provider'] for p in available_providers]
    
    async def _create_provider(
        self,
        provider_name: str,
        encrypted_config: str,
        restaurant_id: str
    ) -> Optional[PaymentProvider]:
        """Create a payment provider instance"""
        try:
            # Decrypt configuration
            decrypted_config = self.config_service.get_provider_config(
                provider_name,
                restaurant_id
            )
            
            if not decrypted_config:
                logger.warning(f"No configuration found for {provider_name}")
                return None
            
            # Create provider instance
            provider_class = {
                'stripe': StripeProvider,
                'square': SquareProvider,
                'sumup': SumUpProvider
            }.get(provider_name.lower())
            
            if not provider_class:
                logger.error(f"Unknown provider: {provider_name}")
                return None
            
            provider = provider_class(decrypted_config)
            
            # Initialize the provider
            if await provider.initialize():
                logger.info(f"Successfully initialized {provider_name} provider")
                return provider
            else:
                logger.error(f"Failed to initialize {provider_name} provider")
                return None
                
        except Exception as e:
            logger.error(f"Failed to create {provider_name} provider: {str(e)}")
            return None
    
    async def _get_provider_configs(self, restaurant_id: str) -> List[PaymentProviderConfig]:
        """Get all provider configurations for a restaurant"""
        from sqlalchemy.orm import Session
        from sqlalchemy import select
        
        async with get_db() as db:
            result = await db.execute(
                select(PaymentProviderConfig)
                .filter(
                    PaymentProviderConfig.restaurant_id == restaurant_id,
                    PaymentProviderConfig.is_active == True
                )
            )
            return result.scalars().all()
    
    async def _get_provider_metrics(self, provider_name: str) -> Dict[str, Any]:
        """Get performance metrics for a provider"""
        from sqlalchemy import select, func
        from sqlalchemy.orm import Session
        
        # Calculate metrics for last 30 days
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        
        async with get_db() as db:
            # Get success rate
            result = await db.execute(
                select(
                    func.count(PaymentTransaction.id).label('total'),
                    func.sum(
                        func.case(
                            (PaymentTransaction.status == PaymentStatus.COMPLETED.value, 1),
                            else_=0
                        )
                    ).label('successful')
                )
                .filter(
                    PaymentTransaction.provider == provider_name,
                    PaymentTransaction.created_at >= cutoff_date
                )
            )
            
            metrics = result.first()
            
            if metrics and metrics.total > 0:
                success_rate = float(metrics.successful or 0) / float(metrics.total)
            else:
                success_rate = 0.95  # Default success rate for new providers
            
            # Get average response time (if tracked)
            # For now, return default values
            return {
                'success_rate': success_rate,
                'avg_response_time': 1.0,  # seconds
                'total_transactions': metrics.total if metrics else 0
            }
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get information about all configured providers"""
        info = {}
        
        for name, provider in self.providers.items():
            info[name] = {
                'available': provider.is_available(),
                'supported_currencies': provider.get_supported_currencies(),
                'supported_methods': provider.get_supported_payment_methods(),
                'supports_recurring': provider.supports_recurring(),
                'supports_refunds': provider.supports_refunds(),
                'minimum_amount': str(provider.get_minimum_amount()),
                'maximum_amount': str(provider.get_maximum_amount())
            }
        
        return info