"""
Admin endpoints for payment provider management and analytics


"""
from fastapi import APIRouter, Depends, Query, Request
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime, timedelta
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.services.payment_factory import payment_factory
from app.core.exceptions import AuthorizationException, FynloException, ResourceNotFoundException
from app.services.payment_analytics import PaymentAnalyticsService
from app.services.smart_routing import RoutingStrategy
from app.core.database import get_db, User
from app.core.auth import get_current_user # get_current_user already has Request
from app.crud.payments import get_provider_analytics, create_payment_analytics_report
from app.core.responses import APIResponseHelper
from app.services.audit_logger import AuditLoggerService
from app.models.audit_log import AuditEventType, AuditEventStatus
from app.core.exceptions import ValidationException, AuthenticationException, FynloException, ResourceNotFoundException, ConflictException

router = APIRouter()

# Define required admin roles (assuming these roles exist or will be created)
# TODO: Confirm with user if "admin" and "platform_owner" are the correct privileged roles.
ADMIN_ROLES = ["admin", "platform_owner"]

@router.get("/providers/status")
async def get_providers_status(
    request: Request,
    db: Session = Depends(get_db), # Added db for AuditLoggerService
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get status of all payment providers"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    action_description = "Get payment providers status"

    if current_user.role not in ADMIN_ROLES:
        await audit_service.create_audit_log(
            event_type=AuditEventType.ACCESS_DENIED,
            event_status=AuditEventStatus.FAILURE,
            action_performed=action_description,
            user_id=current_user.id,
            username_or_email=current_user.email,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"required_roles": ADMIN_ROLES, "reason": f"User role '{current_user.role}' not authorized."},
            commit=True
        )
        raise AuthorizationException(message="Forbidden: Insufficient privileges.", details={"required_roles": ADMIN_ROLES})
    await audit_service.create_audit_log(
        event_type=AuditEventType.ACCESS_GRANTED,
        event_status=AuditEventStatus.SUCCESS,
        action_performed=action_description,
        user_id=current_user.id,
        username_or_email=current_user.email,
        ip_address=ip_address,
        user_agent=user_agent,
        commit=True
    )
    # Proceed with endpoint logic
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
    request: Request,
    provider_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Test a payment provider configuration"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    action_description = f"Test payment provider: {provider_name}"

    if current_user.role not in ADMIN_ROLES:
        await audit_service.create_audit_log(
            event_type=AuditEventType.ACCESS_DENIED, event_status=AuditEventStatus.FAILURE,
            action_performed=action_description, user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            details={"required_roles": ADMIN_ROLES, "reason": f"User role '{current_user.role}' not authorized."}, commit=True
        )
        raise AuthorizationException(message="Forbidden: Insufficient privileges.", details={"required_roles": ADMIN_ROLES})
    await audit_service.create_audit_log(
        event_type=AuditEventType.ACCESS_GRANTED, event_status=AuditEventStatus.SUCCESS,
        action_performed=action_description, user_id=current_user.id, username_or_email=current_user.email,
        ip_address=ip_address, user_agent=user_agent, commit=True
    )

    provider = payment_factory.get_provider(provider_name)
    if not provider:
        # Log this attempt to test non-existent provider as a form of admin action failure?
        # For now, let the HTTP exception suffice.
        raise ResourceNotFoundException(resource="Payment provider", resource_id=provider_name)    
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
    request: Request,
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get payment provider analytics and cost analysis"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    action_description = "Get payment provider analytics"

    if current_user.role not in ADMIN_ROLES:
        await audit_service.create_audit_log(
            event_type=AuditEventType.ACCESS_DENIED, event_status=AuditEventStatus.FAILURE,
            action_performed=action_description, user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            details={"required_roles": ADMIN_ROLES, "reason": f"User role '{current_user.role}' not authorized."}, commit=True
        )
        raise AuthorizationException(message="Forbidden: Insufficient privileges.", details={"required_roles": ADMIN_ROLES})
    await audit_service.create_audit_log(
        event_type=AuditEventType.ACCESS_GRANTED, event_status=AuditEventStatus.SUCCESS,
        action_performed=action_description, user_id=current_user.id, username_or_email=current_user.email,
        ip_address=ip_address, user_agent=user_agent, commit=True
    )

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
        raise FynloException(message=f"Analytics error: {str(e)}")
@router.get("/providers/cost-comparison")
async def get_cost_comparison(
    request: Request,
    amount: float,
    monthly_volume: float = 5000,
    db: Session = Depends(get_db), # Added for audit
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Compare costs across all providers for given amount and volume"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    action_description = "Get provider cost comparison"

    if current_user.role not in ADMIN_ROLES:
        await audit_service.create_audit_log(
            event_type=AuditEventType.ACCESS_DENIED, event_status=AuditEventStatus.FAILURE,
            action_performed=action_description, user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            details={"required_roles": ADMIN_ROLES, "reason": f"User role '{current_user.role}' not authorized."}, commit=True
        )
        raise AuthorizationException(message="Forbidden: Insufficient privileges.", details={"required_roles": ADMIN_ROLES})
    await audit_service.create_audit_log(
        event_type=AuditEventType.ACCESS_GRANTED, event_status=AuditEventStatus.SUCCESS,
        action_performed=action_description, user_id=current_user.id, username_or_email=current_user.email,
        ip_address=ip_address, user_agent=user_agent, commit=True
    )

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

@router.get("/analytics/provider-performance")
async def get_provider_performance(
    request: Request,
    restaurant_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive provider performance analytics"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    action_description = "Get provider performance analytics"

    if current_user.role not in ADMIN_ROLES:
        await audit_service.create_audit_log(
            event_type=AuditEventType.ACCESS_DENIED, event_status=AuditEventStatus.FAILURE,
            action_performed=action_description, user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            details={"required_roles": ADMIN_ROLES, "reason": f"User role '{current_user.role}' not authorized."}, commit=True
        )
        raise AuthorizationException(message="Forbidden: Insufficient privileges.", details={"required_roles": ADMIN_ROLES})
    await audit_service.create_audit_log(
        event_type=AuditEventType.ACCESS_GRANTED, event_status=AuditEventStatus.SUCCESS,
        action_performed=action_description, user_id=current_user.id, username_or_email=current_user.email,
        ip_address=ip_address, user_agent=user_agent, commit=True
    )
    
    analytics_service = PaymentAnalyticsService(db)
    
    performance_data = await analytics_service.get_provider_performance_summary(
        restaurant_id=restaurant_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return APIResponseHelper.success(
        data=performance_data,
        message="Provider performance analytics retrieved successfully"
    )

@router.get("/analytics/cost-optimization")
async def get_cost_optimization(
    request: Request,
    restaurant_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed cost optimization report"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    action_description = "Get cost optimization report"

    if current_user.role not in ADMIN_ROLES:
        await audit_service.create_audit_log(
            event_type=AuditEventType.ACCESS_DENIED, event_status=AuditEventStatus.FAILURE,
            action_performed=action_description, user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            details={"required_roles": ADMIN_ROLES, "reason": f"User role '{current_user.role}' not authorized."}, commit=True
        )
        raise AuthorizationException(message="Forbidden: Insufficient privileges.", details={"required_roles": ADMIN_ROLES})
    await audit_service.create_audit_log(
        event_type=AuditEventType.ACCESS_GRANTED, event_status=AuditEventStatus.SUCCESS,
        action_performed=action_description, user_id=current_user.id, username_or_email=current_user.email,
        ip_address=ip_address, user_agent=user_agent, commit=True
    )
    
    analytics_service = PaymentAnalyticsService(db)
    
    optimization_report = await analytics_service.get_cost_optimization_report(
        restaurant_id=restaurant_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return APIResponseHelper.success(
        data=optimization_report,
        message="Cost optimization report generated successfully"
    )

@router.get("/analytics/volume-trends")
async def get_volume_trends(
    restaurant_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get transaction volume trends over time"""
    
    analytics_service = PaymentAnalyticsService(db)
    
    trends_data = await analytics_service.get_transaction_volume_trends(
        restaurant_id=restaurant_id,
        days=days
    )
    
    return APIResponseHelper.success(
        data=trends_data,
        message="Volume trends retrieved successfully"
    )

@router.get("/analytics/provider-health")
async def get_provider_health(
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get provider health scores and status"""
    
    analytics_service = PaymentAnalyticsService(db)
    
    health_scores = await analytics_service.get_provider_health_scores(
        restaurant_id=restaurant_id
    )
    
    return APIResponseHelper.success(
        data=health_scores,
        message="Provider health scores retrieved successfully"
    )

@router.get("/routing/recommendations")
async def get_routing_recommendations(
    restaurant_id: str = Query(..., description="Restaurant ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get smart routing recommendations for a restaurant"""
    
    recommendations = await payment_factory.get_routing_recommendations(
        restaurant_id=restaurant_id,
        db_session=db
    )
    
    return APIResponseHelper.success(
        data=recommendations,
        message="Routing recommendations retrieved successfully"
    )

@router.post("/routing/simulate")
async def simulate_routing_strategy(
    restaurant_id: str,
    strategy: RoutingStrategy,
    simulation_days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Simulate the impact of changing routing strategy"""
    
    simulation_result = await payment_factory.simulate_routing_impact(
        restaurant_id=restaurant_id,
        strategy=strategy,
        db_session=db
    )
    
    return APIResponseHelper.success(
        data=simulation_result,
        message="Routing strategy simulation completed"
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
        raise FynloException(message=f"Analytics error: {str(e)}")
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

class ProviderStatusUpdate(BaseModel):
    provider: str
    enabled: bool
    maintenance_mode: Optional[bool] = False
    reason: Optional[str] = None

class RoutingStrategyUpdate(BaseModel):
    restaurant_id: str
    strategy: RoutingStrategy
    auto_switch: bool = True