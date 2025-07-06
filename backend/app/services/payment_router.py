from typing import Dict, Any, Optional, List
from decimal import Decimal
import logging
from datetime import datetime
from .sumup_provider import SumUpProvider
from .square_provider import SquareProvider
from .stripe_provider import StripeProvider
from .payment_analytics import PaymentAnalyticsService
from .smart_routing import SmartRoutingService
from ..core.config import settings

logger = logging.getLogger(__name__)

class PaymentRouter:
    """
    Main payment routing service that manages provider selection,
    fallback logic, and unified payment processing
    """
    
    def __init__(self):
        self.providers = {}
        self.analytics = PaymentAnalyticsService()
        self.smart_routing = SmartRoutingService()
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize all payment providers with their configurations"""
        
        # Initialize SumUp (Primary)
        if settings.SUMUP_API_KEY:
            try:
                self.providers['sumup'] = SumUpProvider({
                    'api_key': settings.SUMUP_API_KEY,
                    'merchant_code': settings.SUMUP_MERCHANT_CODE,
                    'base_url': settings.SUMUP_BASE_URL or 'https://api.sumup.com/v0.1',
                    'fee_percentage': '0.0069',  # 0.69%
                    'monthly_fee': '19.00',
                    'volume_threshold': '2714.00'
                })
                logger.info("SumUp provider initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize SumUp provider: {e}")
        
        # Initialize Square (Backup 1)
        if settings.SQUARE_ACCESS_TOKEN:
            try:
                self.providers['square'] = SquareProvider({
                    'access_token': settings.SQUARE_ACCESS_TOKEN,
                    'location_id': settings.SQUARE_LOCATION_ID,
                    'environment': settings.SQUARE_ENVIRONMENT or 'sandbox',
                    'fee_percentage': '0.0175',  # 1.75%
                    'auto_complete': True
                })
                logger.info("Square provider initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Square provider: {e}")
        
        # Initialize Stripe (Backup 2)
        if settings.STRIPE_SECRET_KEY:
            try:
                self.providers['stripe'] = StripeProvider({
                    'secret_key': settings.STRIPE_SECRET_KEY,
                    'publishable_key': settings.STRIPE_PUBLISHABLE_KEY,
                    'webhook_secret': settings.STRIPE_WEBHOOK_SECRET,
                    'fee_percentage': '0.014',  # 1.4%
                    'fee_fixed': '0.20'  # 20p
                })
                logger.info("Stripe provider initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Stripe provider: {e}")
    
    async def process_payment(
        self,
        amount: Decimal,
        payment_method: str,
        currency: str = 'GBP',
        order_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Process payment with automatic provider selection and fallback
        """
        
        # Map payment methods to providers
        method_to_provider = {
            'tapToPay': 'sumup',
            'applePaySumUp': 'sumup',
            'cardEntry': 'sumup',
            'square': 'square',
            'stripe': 'stripe',
            'qrCode': 'sumup',  # SumUp QR payments
        }
        
        primary_provider_name = method_to_provider.get(payment_method)
        if not primary_provider_name:
            return {
                'success': False,
                'error': f'Unknown payment method: {payment_method}',
                'provider': 'none'
            }
        
        # Get smart routing recommendation
        routing_decision = await self.smart_routing.get_routing_decision(
            amount=amount,
            payment_method=payment_method,
            merchant_id=metadata.get('merchant_id') if metadata else None
        )
        
        # Try recommended provider first
        if routing_decision.get('recommended_provider'):
            primary_provider_name = routing_decision['recommended_provider']
        
        # Track payment attempt
        await self.analytics.track_payment_attempt(
            provider=primary_provider_name,
            amount=amount,
            payment_method=payment_method,
            metadata=metadata
        )
        
        # Try primary provider
        primary_provider = self.providers.get(primary_provider_name)
        if primary_provider:
            logger.info(f"Attempting payment with primary provider: {primary_provider_name}")
            try:
                result = await self._process_with_provider(
                    provider=primary_provider,
                    provider_name=primary_provider_name,
                    amount=amount,
                    currency=currency,
                    order_id=order_id,
                    customer_id=customer_id,
                    payment_method=payment_method,
                    metadata=metadata,
                    **kwargs
                )
                
                if result['success']:
                    # Track successful payment
                    await self.analytics.track_payment_success(
                        provider=primary_provider_name,
                        amount=amount,
                        transaction_id=result.get('transaction_id'),
                        fees=result.get('fees', {})
                    )
                    return result
                else:
                    logger.warning(f"Primary provider {primary_provider_name} failed: {result.get('error')}")
                    # Track failure
                    await self.analytics.track_payment_failure(
                        provider=primary_provider_name,
                        amount=amount,
                        error=result.get('error'),
                        error_code=result.get('error_code')
                    )
            except Exception as e:
                logger.error(f"Exception with primary provider {primary_provider_name}: {e}")
                await self.analytics.track_payment_failure(
                    provider=primary_provider_name,
                    amount=amount,
                    error=str(e),
                    error_code='PROVIDER_EXCEPTION'
                )
        
        # Fallback logic: Try other providers in order of priority
        fallback_order = ['sumup', 'square', 'stripe']
        fallback_order = [p for p in fallback_order if p != primary_provider_name and p in self.providers]
        
        for fallback_provider_name in fallback_order:
            fallback_provider = self.providers[fallback_provider_name]
            logger.info(f"Attempting fallback with provider: {fallback_provider_name}")
            
            try:
                # Track fallback attempt
                await self.analytics.track_payment_attempt(
                    provider=fallback_provider_name,
                    amount=amount,
                    payment_method=payment_method,
                    metadata={**(metadata or {}), 'is_fallback': True}
                )
                
                result = await self._process_with_provider(
                    provider=fallback_provider,
                    provider_name=fallback_provider_name,
                    amount=amount,
                    currency=currency,
                    order_id=order_id,
                    customer_id=customer_id,
                    payment_method=payment_method,
                    metadata=metadata,
                    **kwargs
                )
                
                if result['success']:
                    # Track successful fallback
                    await self.analytics.track_payment_success(
                        provider=fallback_provider_name,
                        amount=amount,
                        transaction_id=result.get('transaction_id'),
                        fees=result.get('fees', {}),
                        metadata={'was_fallback': True}
                    )
                    result['was_fallback'] = True
                    result['original_provider'] = primary_provider_name
                    return result
                else:
                    logger.warning(f"Fallback provider {fallback_provider_name} failed: {result.get('error')}")
                    await self.analytics.track_payment_failure(
                        provider=fallback_provider_name,
                        amount=amount,
                        error=result.get('error'),
                        error_code=result.get('error_code')
                    )
            except Exception as e:
                logger.error(f"Exception with fallback provider {fallback_provider_name}: {e}")
                await self.analytics.track_payment_failure(
                    provider=fallback_provider_name,
                    amount=amount,
                    error=str(e),
                    error_code='PROVIDER_EXCEPTION'
                )
        
        # All providers failed
        return {
            'success': False,
            'error': 'All payment providers are currently unavailable',
            'provider': 'none',
            'attempted_providers': [primary_provider_name] + fallback_order
        }
    
    async def _process_with_provider(
        self,
        provider,
        provider_name: str,
        amount: Decimal,
        currency: str,
        order_id: Optional[str],
        customer_id: Optional[str],
        payment_method: str,
        metadata: Optional[Dict[str, Any]],
        **kwargs
    ) -> Dict[str, Any]:
        """Process payment with a specific provider"""
        
        try:
            # Different providers have different method signatures
            if provider_name == 'sumup':
                if payment_method in ['tapToPay', 'applePaySumUp', 'cardEntry']:
                    # For tap to pay and mobile payments, create a checkout
                    result = await provider.create_checkout(
                        amount=amount,
                        currency=currency,
                        metadata=metadata
                    )
                else:
                    # For other SumUp payments
                    result = await provider.process_payment(
                        amount=amount,
                        currency=currency,
                        customer_id=customer_id,
                        metadata=metadata
                    )
            
            elif provider_name == 'square':
                # Square requires source_id (card nonce) from frontend
                source_id = kwargs.get('source_id') or metadata.get('source_id') if metadata else None
                result = await provider.process_payment(
                    amount=amount,
                    currency=currency,
                    source_id=source_id,
                    customer_id=customer_id,
                    order_id=order_id,
                    metadata=metadata
                )
            
            elif provider_name == 'stripe':
                # Stripe payment intent flow
                result = await provider.create_payment_intent(
                    amount=amount,
                    currency=currency,
                    customer_id=customer_id,
                    metadata=metadata
                )
            
            else:
                result = await provider.process_payment(
                    amount=amount,
                    currency=currency,
                    customer_id=customer_id,
                    payment_method_id=kwargs.get('payment_method_id'),
                    metadata=metadata
                )
            
            # Standardize response
            if result.get('status') in ['created', 'pending', 'requires_action']:
                return {
                    'success': True,
                    'status': 'pending',
                    'provider': provider_name,
                    'transaction_id': result.get('checkout_id') or result.get('payment_intent_id'),
                    'amount': float(amount),
                    'currency': currency,
                    'checkout_url': result.get('checkout_url'),
                    'client_secret': result.get('client_secret'),
                    'fees': {
                        'processing_fee': float(provider.calculate_fee(amount)),
                        'provider': provider_name
                    },
                    'raw_response': result
                }
            elif result.get('status') == 'failed' or result.get('error'):
                return {
                    'success': False,
                    'provider': provider_name,
                    'error': result.get('error', 'Payment failed'),
                    'error_code': result.get('error_code'),
                    'amount': float(amount),
                    'currency': currency
                }
            else:
                # Success
                return {
                    'success': True,
                    'status': 'completed',
                    'provider': provider_name,
                    'transaction_id': result.get('transaction_id') or result.get('id'),
                    'amount': float(amount),
                    'currency': currency,
                    'fees': {
                        'processing_fee': float(provider.calculate_fee(amount)),
                        'provider': provider_name
                    },
                    'raw_response': result
                }
                
        except Exception as e:
            logger.error(f"Error processing payment with {provider_name}: {e}")
            return {
                'success': False,
                'provider': provider_name,
                'error': str(e),
                'error_code': 'PROVIDER_ERROR',
                'amount': float(amount),
                'currency': currency
            }
    
    async def get_available_payment_methods(
        self,
        amount: Optional[Decimal] = None,
        merchant_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get list of available payment methods with dynamic fee calculation"""
        
        methods = []
        
        # SumUp methods
        if 'sumup' in self.providers:
            sumup_fee = self.providers['sumup'].calculate_fee(amount or Decimal('10'))
            sumup_available = True  # Check actual availability
            
            methods.extend([
                {
                    'id': 'tapToPay',
                    'name': 'Tap to Pay',
                    'provider': 'sumup',
                    'type': 'tap',
                    'icon': 'contactless-payment',
                    'enabled': sumup_available,
                    'fee_info': '0.69% + £19/month',
                    'processing_fee_percentage': 0.69,
                    'is_recommended': True
                },
                {
                    'id': 'applePaySumUp',
                    'name': 'Apple Pay',
                    'provider': 'sumup',
                    'type': 'wallet',
                    'icon': 'apple',
                    'enabled': sumup_available,
                    'fee_info': '0.69% + £19/month',
                    'processing_fee_percentage': 0.69
                },
                {
                    'id': 'cardEntry',
                    'name': 'Manual Card Entry',
                    'provider': 'sumup',
                    'type': 'card',
                    'icon': 'credit-card',
                    'enabled': sumup_available,
                    'fee_info': '0.69% + £19/month',
                    'processing_fee_percentage': 0.69
                }
            ])
        
        # Square (backup)
        if 'square' in self.providers:
            methods.append({
                'id': 'square',
                'name': 'Square (Backup)',
                'provider': 'square',
                'type': 'card',
                'icon': 'credit-card',
                'enabled': False,  # Hidden from UI, used as fallback
                'fee_info': '1.75%',
                'processing_fee_percentage': 1.75
            })
        
        # Stripe (backup)
        if 'stripe' in self.providers:
            methods.append({
                'id': 'stripe',
                'name': 'Stripe (Backup)',
                'provider': 'stripe',
                'type': 'card',
                'icon': 'credit-card',
                'enabled': False,  # Hidden from UI, used as fallback
                'fee_info': '1.4% + 20p',
                'processing_fee_percentage': 1.4,
                'fixed_fee': 0.20
            })
        
        # Always available methods
        methods.extend([
            {
                'id': 'qrCode',
                'name': 'QR Code Payment',
                'provider': 'platform',
                'type': 'qr',
                'icon': 'qr-code-scanner',
                'enabled': True,
                'fee_info': '1.2%',
                'processing_fee_percentage': 1.2
            },
            {
                'id': 'cash',
                'name': 'Cash',
                'provider': 'none',
                'type': 'cash',
                'icon': 'payments',
                'enabled': True,
                'fee_info': 'No fees',
                'processing_fee_percentage': 0
            }
        ])
        
        return methods
    
    async def refund_payment(
        self,
        provider: str,
        transaction_id: str,
        amount: Decimal,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Process a refund through the appropriate provider"""
        
        if provider not in self.providers:
            return {
                'success': False,
                'error': f'Provider {provider} not available',
                'provider': provider
            }
        
        try:
            provider_instance = self.providers[provider]
            result = await provider_instance.refund_payment(
                transaction_id=transaction_id,
                amount_to_refund=amount,
                reason=reason,
                order_id=metadata.get('order_id') if metadata else None
            )
            
            # Track refund
            if result.get('success'):
                await self.analytics.track_refund_success(
                    provider=provider,
                    amount=amount,
                    original_transaction_id=transaction_id,
                    refund_id=result.get('refund_id')
                )
            else:
                await self.analytics.track_refund_failure(
                    provider=provider,
                    amount=amount,
                    error=result.get('error')
                )
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing refund with {provider}: {e}")
            return {
                'success': False,
                'provider': provider,
                'error': str(e),
                'error_code': 'REFUND_ERROR'
            }

# Create singleton instance
payment_router = PaymentRouter()