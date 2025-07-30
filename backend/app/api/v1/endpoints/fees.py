from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.core.database import get_db
from app.schemas.fee_schemas import (
    PaymentMethodEnum,
    CustomerTotalBreakdown,
    ServiceChargeBreakdown, # For potential separate return or internal use
    PlatformFeeRecordSchema # For response model
)
from app.services.platform_service import PlatformSettingsService
from app.services.payment_fee_calculator import PaymentFeeCalculator
from app.services.platform_fee_service import PlatformFeeService
from app.services.service_charge_calculator import ServiceChargeCalculator
from app.services.payment_config_service import PaymentConfigService
from app.services.financial_records_service import FinancialRecordsService # New service
from pydantic import BaseModel, Field
from app.core.exceptions import ValidationException, AuthenticationException, FynloException, ResourceNotFoundException, ConflictException

router = APIRouter()

# --- Request Models ---
class FeeCalculationRequest(BaseModel):
    subtotal: float = Field(..., gt=0, description="Order subtotal before VAT and any service charges or fees.")
    vat_amount: float = Field(..., ge=0, description="Total VAT amount for the order.")

    # If service charge is applied, its configured rate (e.g., 0.1 for 10%)
    # This rate is determined by the client based on restaurant/platform settings for service charge.
    service_charge_config_rate: Optional[float] = Field(None, ge=0, le=1, description="Configured service charge rate, e.g., 0.1 for 10%. Null if no SC.")

    payment_method: PaymentMethodEnum
    restaurant_id: Optional[str] = Field(None, description="ID of the restaurant, if applicable.")

    # Optional: For payment providers like SumUp that might have volume-based pricing
    monthly_volume_for_restaurant: Optional[float] = Field(None, description="Estimated monthly transaction volume for the restaurant.")

    # Optional: Client can specify if they want to override the default customer_pays_processor_fees setting.
    # This would only be allowed if `allow_toggle_by_merchant` is true for the payment method.
    force_customer_pays_processor_fees: Optional[bool] = None

class PlatformFeeRecordInput(BaseModel):
    order_id: str = Field(..., description="Client-generated or Odoo order reference.")
    platform_fee_amount: float
    processor_fee_amount: float
    customer_paid_processor: bool
    payment_method: PaymentMethodEnum
    # transaction_timestamp: Optional[str] = None # Optional: client can provide, or server defaults


# --- Dependency Injection for Services ---
# These would typically be more sophisticated in a full app, e.g., using a DI container
# or FastAPI's Depends with classes. For now, direct instantiation in endpoint.

def get_platform_settings_service(db: Session = Depends(get_db)) -> PlatformSettingsService:
    return PlatformSettingsService(db=db)

def get_payment_config_service(db: Session = Depends(get_db)) -> PaymentConfigService:
    return PaymentConfigService(db=db)

def get_payment_fee_calculator(
    pss: PlatformSettingsService = Depends(get_platform_settings_service)
) -> PaymentFeeCalculator:
    return PaymentFeeCalculator(platform_settings_service=pss)

def get_service_charge_calculator(
    pfc: PaymentFeeCalculator = Depends(get_payment_fee_calculator),
    pss: PlatformSettingsService = Depends(get_platform_settings_service)) -> ServiceChargeCalculator:
    return ServiceChargeCalculator(payment_fee_calculator=pfc, platform_settings_service=pss)

def get_platform_fee_service(
    pfc: PaymentFeeCalculator = Depends(get_payment_fee_calculator),
    pss: PlatformSettingsService = Depends(get_platform_settings_service)) -> PlatformFeeService:
    return PlatformFeeService(payment_fee_calculator=pfc, platform_settings_service=pss)

def get_financial_records_service(db: Session = Depends(get_db)) -> FinancialRecordsService:
    return FinancialRecordsService(db=db)


@router.post("/calculate-fees", response_model=CustomerTotalBreakdown)
async def calculate_fees_for_order(
    request: FeeCalculationRequest,
    db: Session = Depends(get_db), # get_db for direct session if needed by services not using DI functions above
    payment_config_service: PaymentConfigService = Depends(get_payment_config_service),
    service_charge_calc: ServiceChargeCalculator = Depends(get_service_charge_calculator),
    platform_fee_service: PlatformFeeService = Depends(get_platform_fee_service)
):
    """
    Calculates the detailed fee breakdown for a given order's subtotal and payment method.
    This endpoint determines processor fees, platform fees, and service charges.
    """

    # 1. Determine fee payment rules (who pays processor fee, is it part of SC)
    payment_method_setting = payment_config_service.get_payment_method_setting(
        payment_method=request.payment_method,
        restaurant_id=request.restaurant_id
    )

    if not payment_method_setting:
        # This should ideally not happen if defaults are seeded for all PaymentMethodEnums
        raise ResourceNotFoundException(detail=f"Fee configuration not found for payment method {request.payment_method.value} for restaurant {request.restaurant_id or 'platform default'}."
        )

    # Determine who pays processor fees
    customer_pays_processor_fees = payment_method_setting.customer_pays_default
    if request.force_customer_pays_processor_fees is not None:
        if payment_method_setting.allow_toggle_by_merchant:
            customer_pays_processor_fees = request.force_customer_pays_processor_fees
        else:
            # Client tried to override but not allowed
            raise ValidationException(detail=f"Toggling who pays processor fee is not allowed for payment method {request.payment_method.value}."
            )

    include_processor_fee_in_sc = payment_method_setting.include_processor_fee_in_service_charge

    # 2. Calculate final Service Charge
    final_service_charge_amount = 0.0
    service_charge_breakdown_details: Optional[ServiceChargeBreakdown] = None

    if request.service_charge_config_rate is not None and request.service_charge_config_rate > 0:
        try:
            service_charge_breakdown_details = await service_charge_calc.calculate_service_charge_with_fees(
                order_subtotal=request.subtotal,
                service_charge_config_rate=request.service_charge_config_rate,
                payment_method=request.payment_method,
                customer_pays_processor_fees=customer_pays_processor_fees, # Crucial: SC structure depends on this
                include_processor_fee_in_service_charge=include_processor_fee_in_sc,
                restaurant_id=request.restaurant_id,
                monthly_volume_for_restaurant=request.monthly_volume_for_restaurant
            )
            final_service_charge_amount = service_charge_breakdown_details['final_service_charge_amount']
        except Exception as e:
            # Log the exception details
            # logger.error(f"Error in ServiceChargeCalculator: {e}", exc_info=True)
            raise FynloException(detail=f"Error calculating service charge: {str(e)}")


    # 3. Calculate final Customer Total Breakdown using PlatformFeeService
    try:
        customer_total_breakdown = await platform_fee_service.calculate_customer_total(
            subtotal=request.subtotal,
            vat_amount=request.vat_amount,
            service_charge_final_amount=final_service_charge_amount,
            payment_method=request.payment_method,
            customer_pays_processor_fees=customer_pays_processor_fees, # This is the effective decision
            restaurant_id=request.restaurant_id,
            monthly_volume_for_restaurant=request.monthly_volume_for_restaurant
        )
        # Could augment with more details if needed
        # customer_total_breakdown['service_charge_details'] = service_charge_breakdown_details
        return customer_total_breakdown

    except ValueError as ve: # From underlying services if config is missing etc.
        raise ValidationException(detail=str(ve))
    except Exception as e:
        # logger.error(f"Error in PlatformFeeService's calculate_customer_total: {e}", exc_info=True)
        raise FynloException(detail=f"Error calculating final customer total: {str(e)}")

# To include this router in the main application:
# In backend/app/api/v1/api.py (or equivalent main router aggregation file):
# from .endpoints import fees
# api_router.include_router(fees.router, prefix="/fees", tags=["Fees & Calculations"])
#
# And ensure models are imported in backend/app/models/__init__.py if using that pattern.
# e.g. from .payment_config import PaymentMethodSetting
#      from .financial_records import PlatformFeeRecord, StaffTipDistributionRecord
#
# And schemas in backend/app/schemas/__init__.py
# e.g. from .fee_schemas import *


@router.post("/platform-fees/record", response_model=PlatformFeeRecordSchema, status_code=201)
async def record_platform_fee(
    fee_data_input: PlatformFeeRecordInput, # Using the Pydantic model for input
    financial_records_service: FinancialRecordsService = Depends(get_financial_records_service)
):
    """
    Records a platform fee transaction.
    The fee calculation should have been done prior to calling this.
    """
    try:
        # Convert Pydantic input model to the TypedDict schema expected by the service
        # This explicit conversion step is good for clarity if schemas differ slightly
        # or if service expects a TypedDict. If service can take Pydantic, it's simpler.
        # For now, assuming PlatformFeeRecordSchema can be constructed from PlatformFeeRecordInput.

        fee_data_schema = PlatformFeeRecordSchema(
            order_id=fee_data_input.order_id,
            platform_fee_amount=fee_data_input.platform_fee_amount,
            processor_fee_amount=fee_data_input.processor_fee_amount,
            customer_paid_processor=fee_data_input.customer_paid_processor,
            payment_method=fee_data_input.payment_method,
            # transaction_timestamp is not in input, will be set by server_default or None
        )

        db_record = financial_records_service.create_platform_fee_record(fee_data_schema)

        # Convert SQLAlchemy model back to Pydantic schema for response
        # (FastAPI does this automatically if response_model is a Pydantic model and ORM mode is enabled)
        # To be absolutely explicit or if ORM mode isn't perfect:
        return PlatformFeeRecordSchema(
            id=db_record.id,
            order_id=db_record.order_reference,
            platform_fee_amount=float(db_record.platform_fee_amount),
            processor_fee_amount=float(db_record.processor_fee_amount),
            customer_paid_processor=db_record.customer_paid_processor_fee,
            payment_method=PaymentMethodEnum(db_record.payment_method), # Ensure enum conversion
            transaction_timestamp=db_record.transaction_timestamp.isoformat()
        )
    except ValueError as ve: # Catch specific errors if service raises them
        raise ValidationException(detail=str(ve))
    except Exception as e:
        # logger.error(f"Error recording platform fee for order {fee_data_input.order_id}: {e}", exc_info=True)
        raise FynloException(detail=f"Failed to record platform fee: {str(e)}")
