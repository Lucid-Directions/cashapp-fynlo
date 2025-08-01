"""
Payment Provider Management Endpoints
Handles configuration and testing of payment providers
"""

from fastapi import APIRouter, Depends, status, Query
from typing import Dict, Any, List, Optional
from decimal import Decimal
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.responses import APIResponseHelper
from app.core.database import User
from app.core.exceptions import AuthorizationException
from app.services.secure_payment_config import SecurePaymentConfigService
from app.services.payment_factory import PaymentProviderFactory
from app.core.tenant_security import TenantSecurity

router = APIRouter()


@router.post("/payment-providers/configure")
async def configure_payment_provider(
    provider: str,
    credentials: Dict[str, Any],
    mode: str = "sandbox",
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Configure a payment provider for the restaurant
    
    Args:
        provider: Provider name (stripe, square, sumup)
        credentials: Provider-specific credentials
        mode: sandbox or production
    """
    try:
        # Validate restaurant access for multi-tenant
        await TenantSecurity.validate_restaurant_access(
            current_user, current_restaurant_id or current_user.restaurant_id, db=db
        )
        restaurant_id = current_restaurant_id or current_user.restaurant_id
        
        # Check user permissions
        if current_user.role not in ['platform_owner', 'restaurant_owner']:
            raise AuthorizationException(message="Only owners can configure payment providers")
        
        # Initialize config service
        config_service = SecurePaymentConfigService(db)
        
        # Store provider configuration
        config_id = config_service.store_provider_config(
            provider=provider,
            restaurant_id=restaurant_id,
            credentials=credentials,
            mode=mode
        )
        
        return APIResponseHelper.success(
            data={
                'config_id': config_id,
                'provider': provider,
                'mode': mode,
                'message': f'{provider.capitalize()} configuration stored securely'
            },
            message="Payment provider configured successfully"
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to configure payment provider: {str(e)}",
            status_code=status.HTTP_400_BAD_REQUEST
        )


@router.get("/payment-providers")
async def list_payment_providers(
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all configured payment providers for the restaurant"""
    try:
        # Validate restaurant access for multi-tenant
        await TenantSecurity.validate_restaurant_access(
            current_user, current_restaurant_id or current_user.restaurant_id, db=db
        )
        restaurant_id = current_restaurant_id or current_user.restaurant_id
        
        config_service = SecurePaymentConfigService(db)
        
        # Get provider configurations
        configs = config_service.list_provider_configs(restaurant_id)
        
        # Initialize provider factory
        factory = PaymentProviderFactory()
        await factory.initialize(restaurant_id)
        
        # Get provider info
        provider_info = factory.get_provider_info()
        
        # Combine configuration and runtime info
        providers = []
        for config in configs:
            info = provider_info.get(config['provider'], {})
            providers.append({
                'provider': config['provider'],
                'enabled': config['enabled'],
                'mode': config['mode'],
                'configured_at': config['configured_at'],
                'available': info.get('available', False),
                'supported_currencies': info.get('supported_currencies', []),
                'supported_methods': info.get('supported_methods', []),
                'fee_structure': _get_fee_structure(config['provider'])
            })
        
        return APIResponseHelper.success(
            data={'providers': providers},
            message="Payment providers retrieved successfully"
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to retrieve payment providers: {str(e)}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@router.post("/payment-providers/{provider}/test")
async def test_payment_provider(
    provider: str,
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test a payment provider connection"""
    try:
        # Validate restaurant access for multi-tenant
        await TenantSecurity.validate_restaurant_access(
            current_user, current_restaurant_id or current_user.restaurant_id, db=db
        )
        restaurant_id = current_restaurant_id or current_user.restaurant_id
        
        # Check permissions
        if current_user.role not in ['platform_owner', 'restaurant_owner', 'manager']:
            raise AuthorizationException(message="Insufficient permissions")
        
        # Initialize provider factory
        factory = PaymentProviderFactory()
        await factory.initialize(restaurant_id)
        
        # Get the specific provider
        provider_instance = await factory.get_provider(provider)
        
        if not provider_instance:
            return APIResponseHelper.error(
                message=f"Provider {provider} not configured",
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        # Test the connection
        test_result = await provider_instance.test_connection()
        
        return APIResponseHelper.success(
            data=test_result,
            message=f"Provider {provider} test completed"
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Provider test failed: {str(e)}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@router.post("/payment-providers/{provider}/calculate-fee")
async def calculate_provider_fee(
    provider: str,
    amount: Decimal,
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculate fees for a specific provider and amount"""
    try:
        # Validate restaurant access for multi-tenant
        await TenantSecurity.validate_restaurant_access(
            current_user, current_restaurant_id or current_user.restaurant_id, db=db
        )
        restaurant_id = current_restaurant_id or current_user.restaurant_id
        
        # Initialize provider factory
        factory = PaymentProviderFactory()
        await factory.initialize(restaurant_id)
        
        # Get the specific provider
        provider_instance = await factory.get_provider(provider)
        
        if not provider_instance:
            return APIResponseHelper.error(
                message=f"Provider {provider} not configured",
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        # Calculate fee
        fee = provider_instance.calculate_fee(amount)
        net_amount = amount - fee
        
        return APIResponseHelper.success(
            data={
                'provider': provider,
                'amount': float(amount),
                'fee': float(fee),
                'net_amount': float(net_amount),
                'fee_percentage': float(fee / amount * 100) if amount > 0 else 0
            },
            message="Fee calculated successfully"
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to calculate fee: {str(e)}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@router.get("/payment-providers/best-provider")
async def get_best_provider(
    amount: Decimal,
    payment_method: str = "card",
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the best provider for a transaction based on fees and performance"""
    try:
        # Validate restaurant access for multi-tenant
        await TenantSecurity.validate_restaurant_access(
            current_user, current_restaurant_id or current_user.restaurant_id, db=db
        )
        restaurant_id = current_restaurant_id or current_user.restaurant_id
        
        # Initialize provider factory
        factory = PaymentProviderFactory()
        await factory.initialize(restaurant_id)
        
        # Get best provider
        best_provider = await factory.get_best_provider(
            amount=amount,
            payment_method=payment_method
        )
        
        if not best_provider:
            return APIResponseHelper.error(
                message="No suitable payment provider found",
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        # Calculate fee for best provider
        fee = best_provider.calculate_fee(amount)
        
        return APIResponseHelper.success(
            data={
                'provider': best_provider.provider_name,
                'amount': float(amount),
                'fee': float(fee),
                'net_amount': float(amount - fee),
                'fee_percentage': float(fee / amount * 100) if amount > 0 else 0,
                'reason': 'Lowest fees with best performance'
            },
            message="Best provider determined successfully"
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to determine best provider: {str(e)}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def _get_fee_structure(provider: str) -> Dict[str, Any]:
    """Get fee structure for a provider"""
    fee_structures = {
        'stripe': {
            'percentage': 1.4,
            'fixed_fee': 0.20,
            'currency': 'GBP',
            'description': '1.4% + £0.20 per transaction'
        },
        'square': {
            'percentage': 1.75,
            'fixed_fee': 0,
            'currency': 'GBP',
            'description': '1.75% per transaction'
        },
        'sumup': {
            'percentage': 1.69,
            'fixed_fee': 0,
            'currency': 'GBP',
            'description': '1.69% per transaction (online)'
        }
    }
    
    return fee_structures.get(provider, {
        'percentage': 2.9,
        'fixed_fee': 0,
        'currency': 'GBP',
        'description': 'Standard rate'
    })