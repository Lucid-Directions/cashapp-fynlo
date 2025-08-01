import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.payment_config import PaymentMethodSetting
from app.schemas.fee_schemas import PaymentMethodEnum, PaymentMethodFeeSettingSchema # Reusing for input/output validation

logger = logging.getLogger(__name__)

class PaymentConfigService:
    """
    Service for managing payment method fee configurations.
    These settings determine how processor fees are handled (e.g., who pays, toggling).
<<<<<<< HEAD
    
=======
    """
>>>>>>> parent of af057592 (fix: docstring syntax and formatting issues across backend)

    def __init__(self, db: Session):
        self.db = db

    def get_payment_method_setting(
        self,
        payment_method: PaymentMethodEnum,
        restaurant_id: Optional[str] = None
    ) -> Optional[PaymentMethodSetting]:
        """
        Retrieves the effective payment method setting.
        It first looks for a restaurant-specific override, then falls back to the platform default.
        """
        payment_method_value = payment_method.value

        # Try to get restaurant-specific setting
        if restaurant_id:
            setting = self.db.query(PaymentMethodSetting).filter(
                PaymentMethodSetting.restaurant_id == restaurant_id,
                PaymentMethodSetting.payment_method == payment_method_value
            ).first()
            if setting:
                logger.debug(f"Found restaurant-specific setting for {payment_method_value} at {restaurant_id}")
                return setting

        # If no restaurant-specific setting or no restaurant_id provided, get platform default
        platform_setting = self.db.query(PaymentMethodSetting).filter(
            PaymentMethodSetting.restaurant_id.is_(None), # Platform default has NULL restaurant_id
            PaymentMethodSetting.payment_method == payment_method_value
        ).first()

        if platform_setting:
            logger.debug(f"Found platform default setting for {payment_method_value}")
        else:
            logger.warning(f"No platform default setting found for payment_method: {payment_method_value}")
        return platform_setting

    def get_all_platform_default_settings(self) -> List[PaymentMethodSetting]:
        """Retrieves all platform-level default payment method settings."""
        return self.db.query(PaymentMethodSetting).filter(
            PaymentMethodSetting.restaurant_id.is_(None)
        ).order_by(PaymentMethodSetting.payment_method).all()

    def get_all_settings_for_restaurant(self, restaurant_id: str) -> List[PaymentMethodSetting]:
        """Retrieves all specific settings for a given restaurant."""
        return self.db.query(PaymentMethodSetting).filter(
            PaymentMethodSetting.restaurant_id == restaurant_id
        ).order_by(PaymentMethodSetting.payment_method).all()

    def create_platform_default_setting(self, setting_data: PaymentMethodFeeSettingSchema) -> Optional[PaymentMethodSetting]:
        """
        Creates a new platform-default payment method setting.
        `restaurant_id` in `setting_data` should be None or not provided.
        """
        logger.info(f"Attempting to create platform default setting for: {setting_data.get('payment_method')}")
        if setting_data.get('restaurant_id') is not None:
            logger.error("Cannot create platform default with a restaurant_id.")
            raise ValueError("Platform default settings must not have a restaurant_id.")

        existing_default = self.db.query(PaymentMethodSetting).filter(
            PaymentMethodSetting.restaurant_id.is_(None),
            PaymentMethodSetting.payment_method == setting_data['payment_method'].value
        ).first()

        if existing_default:
            logger.warning(f"Platform default for {setting_data['payment_method'].value} already exists. Use update.")
            raise IntegrityError(f"Platform default for {setting_data['payment_method'].value} already exists.", params={}, orig=None)

        db_setting = PaymentMethodSetting(
            payment_method=setting_data['payment_method'].value,
            customer_pays_default=setting_data.get('customer_pays_default', True),
            allow_toggle_by_merchant=setting_data.get('allow_toggle_by_merchant', True),
            include_processor_fee_in_service_charge=setting_data.get('include_processor_fee_in_service_charge', True),
            restaurant_id=None
        )
        try:
            self.db.add(db_setting)
            self.db.commit()
            self.db.refresh(db_setting)
            logger.info(f"Created platform default setting for {db_setting.payment_method}, ID: {db_setting.id}")
            return db_setting
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Integrity error creating platform default setting for {setting_data['payment_method'].value}: {e}")
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Unexpected error creating platform default setting: {e}", exc_info=True)
            raise

    def update_platform_default_setting(self, payment_method: PaymentMethodEnum, updates: Dict[str, Any]) -> Optional[PaymentMethodSetting]:
        """Updates an existing platform-default payment method setting."""
        logger.info(f"Attempting to update platform default setting for: {payment_method.value} with data: {updates}")
        db_setting = self.db.query(PaymentMethodSetting).filter(
            PaymentMethodSetting.restaurant_id.is_(None),
            PaymentMethodSetting.payment_method == payment_method.value
        ).first()

        if not db_setting:
            logger.warning(f"No platform default setting found for {payment_method.value} to update.")
            return None

        for key, value in updates.items():
            if hasattr(db_setting, key) and key not in ['id', 'payment_method', 'restaurant_id']:
                setattr(db_setting, key, value)

        try:
            self.db.commit()
            self.db.refresh(db_setting)
            logger.info(f"Updated platform default setting for {db_setting.payment_method}")
            return db_setting
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating platform default setting for {payment_method.value}: {e}", exc_info=True)
            raise

    def create_or_update_restaurant_setting(self, restaurant_id: str, setting_data: PaymentMethodFeeSettingSchema) -> Optional[PaymentMethodSetting]:
        """
        Creates or updates a restaurant-specific payment method setting.
        """
        logger.info(f"Attempting to create/update restaurant setting for: {restaurant_id}, method: {setting_data.get('payment_method')}")
        if not restaurant_id:
            raise ValueError("restaurant_id is required for restaurant-specific settings.")

        payment_method_value = setting_data['payment_method'].value

        db_setting = self.db.query(PaymentMethodSetting).filter(
            PaymentMethodSetting.restaurant_id == restaurant_id,
            PaymentMethodSetting.payment_method == payment_method_value
        ).first()

        if db_setting: # Update existing
            logger.debug(f"Updating existing setting for {restaurant_id}, method {payment_method_value}")
            if 'customer_pays_default' in setting_data:
                db_setting.customer_pays_default = setting_data['customer_pays_default']
            if 'allow_toggle_by_merchant' in setting_data:
                db_setting.allow_toggle_by_merchant = setting_data['allow_toggle_by_merchant']
            if 'include_processor_fee_in_service_charge' in setting_data:
                db_setting.include_processor_fee_in_service_charge = setting_data['include_processor_fee_in_service_charge']
        else: # Create new
            logger.debug(f"Creating new setting for {restaurant_id}, method {payment_method_value}")
            db_setting = PaymentMethodSetting(
                restaurant_id=restaurant_id,
                payment_method=payment_method_value,
                customer_pays_default=setting_data.get('customer_pays_default', True),
                allow_toggle_by_merchant=setting_data.get('allow_toggle_by_merchant', True),
                include_processor_fee_in_service_charge=setting_data.get('include_processor_fee_in_service_charge', True)
            )
            self.db.add(db_setting)

        try:
            self.db.commit()
            self.db.refresh(db_setting)
            logger.info(f"Saved restaurant setting for {restaurant_id}, method {payment_method_value}, ID: {db_setting.id}")
            return db_setting
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Integrity error for restaurant {restaurant_id}, method {payment_method_value}: {e}")
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Unexpected error for restaurant {restaurant_id}, method {payment_method_value}: {e}", exc_info=True)
            raise

    def delete_restaurant_setting(self, restaurant_id: str, payment_method: PaymentMethodEnum) -> bool:
        """Deletes a restaurant-specific setting. Platform defaults cannot be deleted via this method."""
        logger.info(f"Attempting to delete restaurant setting for: {restaurant_id}, method: {payment_method.value}")
        if not restaurant_id:
            logger.error("Cannot delete setting: restaurant_id is required.")
            return False # Or raise error

        db_setting = self.db.query(PaymentMethodSetting).filter(
            PaymentMethodSetting.restaurant_id == restaurant_id,
            PaymentMethodSetting.payment_method == payment_method.value
        ).first()

        if db_setting:
            self.db.delete(db_setting)
            self.db.commit()
            logger.info(f"Deleted restaurant setting for {restaurant_id}, method {payment_method.value}")
            return True
        logger.warning(f"No setting found to delete for restaurant {restaurant_id}, method {payment_method.value}")
        return False
