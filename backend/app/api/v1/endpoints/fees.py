from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from app.core.database import get_db
from app.schemas.fee_schemas import PaymentMethodEnum, CustomerTotalBreakdown, ServiceChargeBreakdown, PlatformFeeRecordSchema
from app.services.platform_service import PlatformSettingsService
from app.services.payment_fee_calculator import PaymentFeeCalculator
from app.services.platform_fee_service import PlatformFeeService
from app.services.service_charge_calculator import ServiceChargeCalculator
from app.services.payment_config_service import PaymentConfigService
from app.services.financial_records_service import FinancialRecordsService
from pydantic import BaseModel, Field
from app.core.exceptions import FynloException, ResourceNotFoundException, ValidationException
router = APIRouter()

class FeeCalculationRequest(BaseModel):
    subtotal: float = Field(..., gt=0, description='Order subtotal before VAT and any service charges or fees.')
    vat_amount: float = Field(..., ge=0, description='Total VAT amount for the order.')
    service_charge_config_rate: Optional[float] = Field(None, ge=0, le=1, description='Configured service charge rate, e.g., 0.1 for 10%. Null if no SC.')
    payment_method: PaymentMethodEnum
    restaurant_id: Optional[str] = Field(None, description='ID of the restaurant, if applicable.')
    monthly_volume_for_restaurant: Optional[float] = Field(None, description='Estimated monthly transaction volume for the restaurant.')
    force_customer_pays_processor_fees: Optional[bool] = None

class PlatformFeeRecordInput(BaseModel):
    order_id: str = Field(..., description='Client-generated or Odoo order reference.')
    platform_fee_amount: float
    processor_fee_amount: float
    customer_paid_processor: bool
    payment_method: PaymentMethodEnum

def get_platform_settings_service(db: Session=Depends(get_db)) -> PlatformSettingsService:
    return PlatformSettingsService(db=db)

def get_payment_config_service(db: Session=Depends(get_db)) -> PaymentConfigService:
    return PaymentConfigService(db=db)

def get_payment_fee_calculator(pss: PlatformSettingsService=Depends(get_platform_settings_service)) -> PaymentFeeCalculator:
    return PaymentFeeCalculator(platform_settings_service=pss)

def get_service_charge_calculator(pfc: PaymentFeeCalculator=Depends(get_payment_fee_calculator), pss: PlatformSettingsService=Depends(get_platform_settings_service)) -> ServiceChargeCalculator:
    return ServiceChargeCalculator(payment_fee_calculator=pfc, platform_settings_service=pss)

def get_platform_fee_service(pfc: PaymentFeeCalculator=Depends(get_payment_fee_calculator), pss: PlatformSettingsService=Depends(get_platform_settings_service)) -> PlatformFeeService:
    return PlatformFeeService(payment_fee_calculator=pfc, platform_settings_service=pss)

def get_financial_records_service(db: Session=Depends(get_db)) -> FinancialRecordsService:
    return FinancialRecordsService(db=db)

@router.post('/calculate-fees', response_model=CustomerTotalBreakdown)
async def calculate_fees_for_order(request: FeeCalculationRequest, db: Session=Depends(get_db), payment_config_service: PaymentConfigService=Depends(get_payment_config_service), service_charge_calc: ServiceChargeCalculator=Depends(get_service_charge_calculator), platform_fee_service: PlatformFeeService=Depends(get_platform_fee_service)):
    """
    Calculates the detailed fee breakdown for a given order's subtotal and payment method.
    This endpoint determines processor fees, platform fees, and service charges.
    """
    payment_method_setting = payment_config_service.get_payment_method_setting(payment_method=request.payment_method, restaurant_id=request.restaurant_id)
    if not payment_method_setting:
        raise ResourceNotFoundException(resource_type="Resource")
    customer_pays_processor_fees = payment_method_setting.customer_pays_default
    if request.force_customer_pays_processor_fees is not None:
        if payment_method_setting.allow_toggle_by_merchant:
            customer_pays_processor_fees = request.force_customer_pays_processor_fees
        else:
            raise ValidationException(message='', error_code='BAD_REQUEST')
    include_processor_fee_in_sc = payment_method_setting.include_processor_fee_in_service_charge
    final_service_charge_amount = 0.0
    service_charge_breakdown_details: Optional[ServiceChargeBreakdown] = None
    if request.service_charge_config_rate is not None and request.service_charge_config_rate > 0:
        try:
            service_charge_breakdown_details = await service_charge_calc.calculate_service_charge_with_fees(order_subtotal=request.subtotal, service_charge_config_rate=request.service_charge_config_rate, payment_method=request.payment_method, customer_pays_processor_fees=customer_pays_processor_fees, include_processor_fee_in_service_charge=include_processor_fee_in_sc, restaurant_id=request.restaurant_id, monthly_volume_for_restaurant=request.monthly_volume_for_restaurant)
            final_service_charge_amount = service_charge_breakdown_details['final_service_charge_amount']
        except Exception as e:
            raise FynloException(message='', error_code='INTERNAL_ERROR')
    try:
        customer_total_breakdown = await platform_fee_service.calculate_customer_total(subtotal=request.subtotal, vat_amount=request.vat_amount, service_charge_final_amount=final_service_charge_amount, payment_method=request.payment_method, customer_pays_processor_fees=customer_pays_processor_fees, restaurant_id=request.restaurant_id, monthly_volume_for_restaurant=request.monthly_volume_for_restaurant)
        return customer_total_breakdown
    except ValueError as ve:
        raise ValidationException(message='', error_code='BAD_REQUEST')
    except Exception as e:
        raise FynloException(message='', error_code='INTERNAL_ERROR')

@router.post('/platform-fees/record', response_model=PlatformFeeRecordSchema, status_code=201)
async def record_platform_fee(fee_data_input: PlatformFeeRecordInput, financial_records_service: FinancialRecordsService=Depends(get_financial_records_service)):
    """
    Records a platform fee transaction.
    The fee calculation should have been done prior to calling this.
    """
    try:
        fee_data_schema = PlatformFeeRecordSchema(order_id=fee_data_input.order_id, platform_fee_amount=fee_data_input.platform_fee_amount, processor_fee_amount=fee_data_input.processor_fee_amount, customer_paid_processor=fee_data_input.customer_paid_processor, payment_method=fee_data_input.payment_method)
        db_record = financial_records_service.create_platform_fee_record(fee_data_schema)
        return PlatformFeeRecordSchema(id=db_record.id, order_id=db_record.order_reference, platform_fee_amount=float(db_record.platform_fee_amount), processor_fee_amount=float(db_record.processor_fee_amount), customer_paid_processor=db_record.customer_paid_processor_fee, payment_method=PaymentMethodEnum(db_record.payment_method), transaction_timestamp=db_record.transaction_timestamp.isoformat())
    except ValueError as ve:
        raise ValidationException(message='', error_code='BAD_REQUEST')
    except Exception as e:
        raise FynloException(message='', error_code='INTERNAL_ERROR')