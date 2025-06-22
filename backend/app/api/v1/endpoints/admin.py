"""
Admin endpoints for payment provider management and analytics
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from decimal import Decimal
from sqlalchemy.orm import Session
from ...services.payment_factory import payment_factory
from ...core.database import get_db
from ...api.v1.endpoints.auth import get_current_user, User
from ...crud.payments import get_provider_analytics, create_payment_analytics_report
from ...core.responses import APIResponseHelper

router = APIRouter()

@router.get("/providers/status")
async def get_providers_status(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get status of all payment providers"""
    providers = payment_factory.get_available_providers()
    status = {}
    
    for provider_name in providers:
        provider = payment_factory.get_provider(provider_name)
        status[provider_name] = {
            "available": True,
            "display_name": provider_name.title(),
            "configuration": {
                "has_api_key": bool(
                    getattr(provider, 'api_key', None) or 
                    getattr(provider, 'access_token', None) or
                    getattr(provider.config, 'get', lambda x: None)('api_key')
                )
            }
        }
    
    return APIResponseHelper.success(
        data={"providers": status},
        message="Retrieved provider status"
    )

@router.post("/providers/test/{provider_name}")
async def test_provider(
    provider_name: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Test a payment provider configuration"""
    provider = payment_factory.get_provider(provider_name)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    try:
        # Test with small amount
        result = await provider.create_checkout(
            amount=Decimal("1.00"),
            currency="GBP",
            return_url="https://fynlo.com/test/success",
            cancel_url="https://fynlo.com/test/cancel"
        )
        
        return APIResponseHelper.success(
            data={
                "provider": provider_name,
                "test_result": "Provider configured correctly",
                "checkout_created": "checkout_url" in result
            },
            message=f"{provider_name} test successful"
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"{provider_name} test failed: {str(e)}",
            error_code="PROVIDER_TEST_FAILED"
        )

@router.get("/providers/analytics")
async def get_provider_analytics_endpoint(
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get payment provider analytics and cost analysis"""
    try:
        analytics = await get_provider_analytics(start_date, end_date, db)
        
        return APIResponseHelper.success(
            data={
                "period": {
                    "start": start_date,
                    "end": end_date
                },
                **analytics
            },
            message="Retrieved provider analytics"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics error: {str(e)}")

@router.get("/providers/cost-comparison")
async def get_cost_comparison(
    amount: float,
    monthly_volume: float = 5000,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Compare costs across all providers for given amount and volume"""
    amount_decimal = Decimal(str(amount))
    monthly_volume_decimal = Decimal(str(monthly_volume))
    
    comparison = []
    
    for provider_name in payment_factory.get_available_providers():
        provider = payment_factory.get_provider(provider_name)
        fee = provider.calculate_fee(amount_decimal)
        
        comparison.append({
            "provider": provider_name,
            "transaction_fee": float(fee),
            "effective_rate": float(fee / amount_decimal * 100),
            "monthly_cost": _calculate_monthly_cost(provider_name, monthly_volume_decimal),
            "annual_savings": _calculate_annual_savings(
                provider_name, 
                monthly_volume_decimal, 
                "stripe"  # Compare to Stripe as baseline
            )
        })
    
    # Sort by transaction fee
    comparison.sort(key=lambda x: x["transaction_fee"])
    
    return APIResponseHelper.success(
        data={
            "amount": amount,
            "monthly_volume": monthly_volume,
            "comparison": comparison,
            "optimal_provider": comparison[0]["provider"] if comparison else None
        },
        message="Generated cost comparison"
    )

@router.get("/restaurants/{restaurant_id}/analytics")
async def get_restaurant_analytics(
    restaurant_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get comprehensive payment analytics for a restaurant"""
    try:
        report = await create_payment_analytics_report(restaurant_id, db)
        
        return APIResponseHelper.success(
            data=report,
            message="Generated restaurant payment analytics"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics error: {str(e)}")

def _calculate_monthly_cost(provider_name: str, monthly_volume: Decimal) -> float:
    """Calculate total monthly cost for a provider"""
    if provider_name == "sumup" and monthly_volume >= Decimal("2714"):
        # 0.69% + £19/month
        return float((monthly_volume * Decimal("0.0069")) + Decimal("19"))
    elif provider_name == "sumup":
        # 1.69% for low volume
        return float(monthly_volume * Decimal("0.0169"))
    elif provider_name == "stripe":
        # 1.4% + 20p per transaction (assume £50 avg transaction)
        num_transactions = monthly_volume / Decimal("50")
        return float((monthly_volume * Decimal("0.014")) + (num_transactions * Decimal("0.20")))
    elif provider_name == "square":
        # 1.75%
        return float(monthly_volume * Decimal("0.0175"))
    return 0.0

def _calculate_annual_savings(
    provider_name: str, 
    monthly_volume: Decimal,
    baseline_provider: str
) -> float:
    """Calculate annual savings compared to baseline provider"""
    provider_cost = _calculate_monthly_cost(provider_name, monthly_volume)
    baseline_cost = _calculate_monthly_cost(baseline_provider, monthly_volume)
    monthly_savings = baseline_cost - provider_cost
    return float(monthly_savings * 12)