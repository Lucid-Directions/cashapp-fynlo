from fastapi import APIRouter, Depends, Body, Path
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from app.core.database import get_db
from app.schemas.fee_schemas import PaymentMethodEnum, PaymentMethodFeeSettingSchema
from app.services.payment_config_service import PaymentConfigService
from app.models.payment_config import PaymentMethodSetting
from app.core.exceptions import BusinessLogicException, FynloException, ResourceNotFoundException, ValidationException
router = APIRouter()

def get_payment_config_service_dep(db: Session=Depends(get_db)) -> PaymentConfigService:
    return PaymentConfigService(db=db)

class PaymentMethodSettingCreateInput(BaseModel):
    payment_method: PaymentMethodEnum
    customer_pays_default: bool = True
    allow_toggle_by_merchant: bool = True
    include_processor_fee_in_service_charge: bool = True
    restaurant_id: Optional[str] = None

class PaymentMethodSettingUpdateInput(BaseModel):
    customer_pays_default: Optional[bool] = None
    allow_toggle_by_merchant: Optional[bool] = None
    include_processor_fee_in_service_charge: Optional[bool] = None

def convert_db_model_to_schema(db_setting: PaymentMethodSetting) -> PaymentMethodFeeSettingSchema:
    return PaymentMethodFeeSettingSchema(id=db_setting.id, restaurant_id=db_setting.restaurant_id, payment_method=PaymentMethodEnum(db_setting.payment_method), customer_pays_default=db_setting.customer_pays_default, allow_toggle_by_merchant=db_setting.allow_toggle_by_merchant, include_processor_fee_in_service_charge=db_setting.include_processor_fee_in_service_charge)

@router.get('/settings/platform-defaults', response_model=List[PaymentMethodFeeSettingSchema])
def list_platform_default_settings(service: PaymentConfigService=Depends(get_payment_config_service_dep)):
    """Lists all platform default payment method settings."""
    db_settings = service.get_all_platform_default_settings()
    return [convert_db_model_to_schema(s) for s in db_settings]

@router.post('/settings/platform-defaults', response_model=PaymentMethodFeeSettingSchema, status_code=201)
def create_platform_default_setting(setting_data: PaymentMethodSettingCreateInput, service: PaymentConfigService=Depends(get_payment_config_service_dep)):
    """Creates a new platform default payment method setting."""
    if setting_data.restaurant_id is not None:
        raise BusinessLogicException(message='Platform default settings cannot have a restaurant_id.', code='OPERATION_NOT_ALLOWED')
    typed_dict_data = PaymentMethodFeeSettingSchema(payment_method=setting_data.payment_method, customer_pays_default=setting_data.customer_pays_default, allow_toggle_by_merchant=setting_data.allow_toggle_by_merchant, include_processor_fee_in_service_charge=setting_data.include_processor_fee_in_service_charge)
    try:
        created_setting = service.create_platform_default_setting(typed_dict_data)
        if not created_setting:
            raise FynloException(message='Failed to create platform default setting.', code='INTERNAL_ERROR')
        return convert_db_model_to_schema(created_setting)
    except ValueError as ve:
        raise ValidationException(message='', code='BAD_REQUEST')
    except Exception as e:
        raise FynloException(message="Failed to create setting: {str(e)}")}')

@router.put('/settings/platform-defaults/{payment_method}', response_model=PaymentMethodFeeSettingSchema)
def update_platform_default_setting(payment_method: PaymentMethodEnum=Path(...), updates: PaymentMethodSettingUpdateInput=Body(...), service: PaymentConfigService=Depends(get_payment_config_service_dep)):
    """Updates an existing platform default payment method setting."""
    updated_setting = service.update_platform_default_setting(payment_method, updates.dict(exclude_unset=True))
    if not updated_setting:
        raise ResourceNotFoundException(message="Platform default setting for {payment_method.value} not found.", resource_type="Resource")
    return convert_db_model_to_schema(updated_setting)

@router.get('/settings/restaurants/{restaurant_id}', response_model=List[PaymentMethodFeeSettingSchema])
def list_restaurant_settings(restaurant_id: str=Path(...), service: PaymentConfigService=Depends(get_payment_config_service_dep)):
    """
    Lists all payment method settings for a specific restaurant.
    This will include specific overrides for the restaurant.
    To get effective settings (override + fallback to default), client would call this
    and then call GET /settings/platform-defaults and merge. Or service could do it.
    For now, this just returns overrides.
    The service method get_payment_method_setting handles fallback logic for a single setting.
    """
    db_settings = service.get_all_settings_for_restaurant(restaurant_id)
    return [convert_db_model_to_schema(s) for s in db_settings]

@router.post('/settings/restaurants/{restaurant_id}', response_model=PaymentMethodFeeSettingSchema, status_code=201)
def create_or_update_restaurant_setting(restaurant_id: str=Path(...), setting_data: PaymentMethodSettingCreateInput=Body(...), service: PaymentConfigService=Depends(get_payment_config_service_dep)):
    """Creates or updates a restaurant-specific payment method setting (override)."""
    typed_dict_data = PaymentMethodFeeSettingSchema(restaurant_id=restaurant_id, payment_method=setting_data.payment_method, customer_pays_default=setting_data.customer_pays_default, allow_toggle_by_merchant=setting_data.allow_toggle_by_merchant, include_processor_fee_in_service_charge=setting_data.include_processor_fee_in_service_charge)
    try:
        saved_setting = service.create_or_update_restaurant_setting(restaurant_id, typed_dict_data)
        if not saved_setting:
            raise FynloException(message='Failed to save restaurant setting.', code='INTERNAL_ERROR')
        return convert_db_model_to_schema(saved_setting)
    except ValueError as ve:
        raise ValidationException(message='', code='BAD_REQUEST')
    except Exception as e:
        raise FynloException(message="Failed to save setting for restaurant {restaurant_id}: {str(e)}")}')

@router.delete('/settings/restaurants/{restaurant_id}/{payment_method}', status_code=204)
def delete_restaurant_setting(restaurant_id: str=Path(...), payment_method: PaymentMethodEnum=Path(...), service: PaymentConfigService=Depends(get_payment_config_service_dep)):
    """Deletes a restaurant-specific payment method setting (override)."""
    deleted = service.delete_restaurant_setting(restaurant_id, payment_method)
    if not deleted:
        raise ResourceNotFoundException(message="Setting for restaurant {restaurant_id}, method {payment_method.value} not found.", resource_type="Restaurant")
    return None