from fastapi import APIRouter, Depends, HTTPException, Body, Path
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.schemas.fee_schemas import PaymentMethodEnum, PaymentMethodFeeSettingSchema
from app.services.payment_config_service import PaymentConfigService
from app.models.payment_config import PaymentMethodSetting # For ORM response

router = APIRouter()

# --- Dependency for Service ---
def get_payment_config_service_dep(db: Session = Depends(get_db)) -> PaymentConfigService:
    return PaymentConfigService(db=db)

# --- Pydantic Models for Input/Output ---
# Using PaymentMethodFeeSettingSchema from fee_schemas.py for both input and output.
# For input, we might want a slightly different model if `id` is not allowed.
class PaymentMethodSettingCreateInput(BaseModel):
    payment_method: PaymentMethodEnum
    customer_pays_default: bool = True
    allow_toggle_by_merchant: bool = True
    include_processor_fee_in_service_charge: bool = True
    restaurant_id: Optional[str] = None # Null for platform default

class PaymentMethodSettingUpdateInput(BaseModel):
    customer_pays_default: Optional[bool] = None
    allow_toggle_by_merchant: Optional[bool] = None
    include_processor_fee_in_service_charge: Optional[bool] = None

# Helper to convert SQLAlchemy model to Pydantic schema for response
def convert_db_model_to_schema(db_setting: PaymentMethodSetting) -> PaymentMethodFeeSettingSchema:
    return PaymentMethodFeeSettingSchema(
        id=db_setting.id,
        restaurant_id=db_setting.restaurant_id,
        payment_method=PaymentMethodEnum(db_setting.payment_method), # Ensure enum conversion
        customer_pays_default=db_setting.customer_pays_default,
        allow_toggle_by_merchant=db_setting.allow_toggle_by_merchant,
        include_processor_fee_in_service_charge=db_setting.include_processor_fee_in_service_charge
    )

# --- API Endpoints ---

@router.get("/settings/platform-defaults", response_model=List[PaymentMethodFeeSettingSchema])
def list_platform_default_settings(
    service: PaymentConfigService = Depends(get_payment_config_service_dep)
):
    """Lists all platform default payment method settings."""
    db_settings = service.get_all_platform_default_settings()
    return [convert_db_model_to_schema(s) for s in db_settings]

@router.post("/settings/platform-defaults", response_model=PaymentMethodFeeSettingSchema, status_code=201)
def create_platform_default_setting(
    setting_data: PaymentMethodSettingCreateInput,
    service: PaymentConfigService = Depends(get_payment_config_service_dep)
):
    """Creates a new platform default payment method setting."""
    if setting_data.restaurant_id is not None:
        raise HTTPException(status_code=400, detail="Platform default settings cannot have a restaurant_id.")

    # Convert Pydantic input to the TypedDict schema service might expect
    # (If service directly uses Pydantic, this conversion might be simpler)
    typed_dict_data = PaymentMethodFeeSettingSchema(
        payment_method=setting_data.payment_method,
        customer_pays_default=setting_data.customer_pays_default,
        allow_toggle_by_merchant=setting_data.allow_toggle_by_merchant,
        include_processor_fee_in_service_charge=setting_data.include_processor_fee_in_service_charge,
        # id and restaurant_id are not part of create for platform default via this input model
    )
    try:
        created_setting = service.create_platform_default_setting(typed_dict_data)
        if not created_setting: # Should not happen if service raises error on failure
            raise HTTPException(status_code=500, detail="Failed to create platform default setting.")
        return convert_db_model_to_schema(created_setting)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e: # Catches IntegrityError from service if duplicate
        raise HTTPException(status_code=409, detail=f"Failed to create setting: {str(e)}")


@router.put("/settings/platform-defaults/{payment_method}", response_model=PaymentMethodFeeSettingSchema)
def update_platform_default_setting(
    payment_method: PaymentMethodEnum = Path(...),
    updates: PaymentMethodSettingUpdateInput = Body(...),
    service: PaymentConfigService = Depends(get_payment_config_service_dep)
):
    """Updates an existing platform default payment method setting."""
    updated_setting = service.update_platform_default_setting(payment_method, updates.dict(exclude_unset=True))
    if not updated_setting:
        raise HTTPException(status_code=404, detail=f"Platform default setting for {payment_method.value} not found.")
    return convert_db_model_to_schema(updated_setting)


@router.get("/settings/restaurants/{restaurant_id}", response_model=List[PaymentMethodFeeSettingSchema])
def list_restaurant_settings(
    restaurant_id: str = Path(...),
    service: PaymentConfigService = Depends(get_payment_config_service_dep)
):
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


@router.post("/settings/restaurants/{restaurant_id}", response_model=PaymentMethodFeeSettingSchema, status_code=201)
def create_or_update_restaurant_setting(
    restaurant_id: str = Path(...),
    setting_data: PaymentMethodSettingCreateInput = Body(...), # Uses same create input, restaurant_id from path
    service: PaymentConfigService = Depends(get_payment_config_service_dep)
):
    """Creates or updates a restaurant-specific payment method setting (override)."""

    # Use the restaurant_id from the path
    typed_dict_data = PaymentMethodFeeSettingSchema(
        restaurant_id=restaurant_id, # Set from path
        payment_method=setting_data.payment_method,
        customer_pays_default=setting_data.customer_pays_default,
        allow_toggle_by_merchant=setting_data.allow_toggle_by_merchant,
        include_processor_fee_in_service_charge=setting_data.include_processor_fee_in_service_charge
    )
    try:
        saved_setting = service.create_or_update_restaurant_setting(restaurant_id, typed_dict_data)
        if not saved_setting: # Should not happen if service raises specific errors
            raise HTTPException(status_code=500, detail="Failed to save restaurant setting.")
        return convert_db_model_to_schema(saved_setting)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e: # Catches IntegrityError from service
        raise HTTPException(status_code=409, detail=f"Failed to save setting for restaurant {restaurant_id}: {str(e)}")


@router.delete("/settings/restaurants/{restaurant_id}/{payment_method}", status_code=204)
def delete_restaurant_setting(
    restaurant_id: str = Path(...),
    payment_method: PaymentMethodEnum = Path(...),
    service: PaymentConfigService = Depends(get_payment_config_service_dep)
):
    """Deletes a restaurant-specific payment method setting (override)."""
    deleted = service.delete_restaurant_setting(restaurant_id, payment_method)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Setting for restaurant {restaurant_id}, method {payment_method.value} not found.")
    return None # No content for 204


# To include this router in the main application:
# In backend/app/api/v1/api.py (or equivalent):
# from .endpoints import payment_configurations
# api_router.include_router(payment_configurations.router, prefix="/payment-configs", tags=["Payment Configurations"])
