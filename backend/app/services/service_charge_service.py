"""
Service Charge Service - Comprehensive service charge calculation with transaction fee integration
Implements the customer-pays-fees business model where service charges can include processor fees
"""

import logging
from typing import Optional, Dict, Any
from decimal import Decimal, ROUND_HALF_UP

from app.services.platform_service import PlatformSettingsService
from app.services.payment_fee_calculator import PaymentFeeCalculator
from app.schemas.fee_schemas import PaymentMethodEnum, ServiceChargeBreakdown

logger = logging.getLogger(__name__)

class ServiceChargeService:
    """
    Calculates service charges with optional transaction fee inclusion.
    Supports the customer-pays-fees business model where processor fees
    can be included in the service charge instead of being added separately.
    """

    def __init__(
        self,
        platform_settings_service: PlatformSettingsService,
        payment_fee_calculator: PaymentFeeCalculator,
    ):
        self.platform_settings_service = platform_settings_service
        self.payment_fee_calculator = payment_fee_calculator

    def _round_currency(self, amount: Decimal) -> float:
        """Rounds a Decimal amount to 2 decimal places for currency representation."""
        quantizer = Decimal("0.01")
        return float(amount.quantize(quantizer, rounding=ROUND_HALF_UP))

    async def get_service_charge_rate(self, restaurant_id: Optional[str] = None) -> Decimal:
        """
        Gets the service charge rate from platform settings.
        
        Args:
            restaurant_id: Optional restaurant ID for restaurant-specific rates
            
        Returns:
            Service charge rate as a decimal (e.g., 0.125 for 12.5%)
        """
        try:
            # Try to get restaurant-specific rate first
            if restaurant_id:
                restaurant_rate = await self.platform_settings_service.get_platform_setting(
                    f"restaurant.{restaurant_id}.service_charge.rate"
                )
                if restaurant_rate:
                    return Decimal(str(restaurant_rate['value']['value']))
            
            # Fallback to platform default
            platform_rate = await self.platform_settings_service.get_platform_setting(
                "platform.service_charge.rate"
            )
            if platform_rate:
                return Decimal(str(platform_rate['value']['value']))
            
            # Ultimate fallback to 12.5%
            logger.warning("No service charge rate found in settings, using default 12.5%")
            return Decimal("0.125")
            
        except Exception as e:
            logger.error(f"Error getting service charge rate: {e}")
            return Decimal("0.125")  # Safe default

    async def is_service_charge_enabled(self, restaurant_id: Optional[str] = None) -> bool:
        """
        Checks if service charge is enabled for the restaurant or platform.
        
        Args:
            restaurant_id: Optional restaurant ID
            
        Returns:
            True if service charge is enabled
        """
        try:
            # Check restaurant-specific setting first
            if restaurant_id:
                restaurant_enabled = await self.platform_settings_service.get_platform_setting(
                    f"restaurant.{restaurant_id}.service_charge.enabled"
                )
                if restaurant_enabled is not None:
                    return bool(restaurant_enabled['value']['value'])
            
            # Fallback to platform setting
            platform_enabled = await self.platform_settings_service.get_platform_setting(
                "platform.service_charge.enabled"
            )
            if platform_enabled:
                return bool(platform_enabled['value']['value'])
            
            # Default to enabled
            return True
            
        except Exception as e:
            logger.error(f"Error checking service charge enabled status: {e}")
            return True  # Safe default

    async def should_include_transaction_fees_in_service_charge(
        self, 
        payment_method: PaymentMethodEnum, 
        restaurant_id: Optional[str] = None
    ) -> bool:
        """
        Determines if transaction fees should be included in service charge
        for the given payment method.
        
        Args:
            payment_method: The payment method being used
            restaurant_id: Optional restaurant ID
            
        Returns:
            True if transaction fees should be included in service charge
        """
        try:
            # Check payment method specific setting
            setting_key = f"payment_method.{payment_method.value}.include_fee_in_service_charge"
            
            # Restaurant-specific setting
            if restaurant_id:
                restaurant_setting = await self.platform_settings_service.get_platform_setting(
                    f"restaurant.{restaurant_id}.{setting_key}"
                )
                if restaurant_setting is not None:
                    return bool(restaurant_setting['value']['value'])
            
            # Platform default setting
            platform_setting = await self.platform_settings_service.get_platform_setting(
                f"platform.{setting_key}"
            )
            if platform_setting:
                return bool(platform_setting['value']['value'])
            
            # Default logic: include fees for card payments, not for cash
            return payment_method != PaymentMethodEnum.CASH
            
        except Exception as e:
            logger.error(f"Error checking transaction fee inclusion setting: {e}")
            return payment_method != PaymentMethodEnum.CASH

    async def calculate_service_charge_with_fees(
        self,
        subtotal: float,
        vat_amount: float,
        payment_method: PaymentMethodEnum,
        restaurant_id: Optional[str] = None,
        monthly_volume_for_restaurant: Optional[float] = None,
    ) -> ServiceChargeBreakdown:
        """
        Calculates service charge with optional transaction fee inclusion.
        
        Args:
            subtotal: Order subtotal before tax and service charge
            vat_amount: VAT amount for the order
            payment_method: Payment method being used
            restaurant_id: Optional restaurant ID
            monthly_volume_for_restaurant: Optional monthly volume for fee calculation
            
        Returns:
            ServiceChargeBreakdown with detailed calculation
        """
        logger.info(f"Calculating service charge for payment method: {payment_method}")
        
        # Check if service charge is enabled
        if not await self.is_service_charge_enabled(restaurant_id):
            return ServiceChargeBreakdown(
                original_service_charge_on_subtotal=0.0,
                processor_fee_added_to_service_charge=0.0,
                final_service_charge_amount=0.0,
                service_charge_rate_applied=0.0,
                include_transaction_fees_in_service_charge=False
            )
        
        dec_subtotal = Decimal(str(subtotal))
        dec_vat_amount = Decimal(str(vat_amount))
        
        # Get service charge rate
        service_charge_rate = await self.get_service_charge_rate(restaurant_id)
        
        # Calculate base service charge on subtotal only (before VAT)
        original_service_charge = dec_subtotal * service_charge_rate
        
        # Check if we should include transaction fees in service charge
        include_fees_in_sc = await self.should_include_transaction_fees_in_service_charge(
            payment_method, restaurant_id
        )
        
        processor_fee_added = Decimal("0.00")
        
        if include_fees_in_sc and payment_method != PaymentMethodEnum.CASH:
            # Calculate processor fee on the total amount that would be processed
            # This includes subtotal + VAT + the original service charge
            amount_for_processor_fee = dec_subtotal + dec_vat_amount + original_service_charge
            
            try:
                raw_processor_fee = await self.payment_fee_calculator.calculate_processor_fee(
                    transaction_amount=float(amount_for_processor_fee),
                    payment_method=payment_method,
                    restaurant_id=restaurant_id,
                    monthly_volume_for_restaurant=monthly_volume_for_restaurant,
                )
                processor_fee_added = Decimal(str(raw_processor_fee))
                logger.info(f"Processor fee added to service charge: {processor_fee_added}")
                
            except Exception as e:
                logger.error(f"Error calculating processor fee: {e}")
                processor_fee_added = Decimal("0.00")
        
        # Final service charge includes the original charge plus processor fee (if applicable)
        final_service_charge = original_service_charge + processor_fee_added
        
        logger.info(f"Service charge calculation complete: original={original_service_charge}, "
                   f"processor_fee_added={processor_fee_added}, final={final_service_charge}")
        
        return ServiceChargeBreakdown(
            original_service_charge_on_subtotal=self._round_currency(original_service_charge),
            processor_fee_added_to_service_charge=self._round_currency(processor_fee_added),
            final_service_charge_amount=self._round_currency(final_service_charge),
            service_charge_rate_applied=float(service_charge_rate),
            include_transaction_fees_in_service_charge=include_fees_in_sc
        )

    async def update_service_charge_settings(
        self,
        enabled: bool,
        rate: float,
        restaurant_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> bool:
        """
        Updates service charge settings for platform or restaurant.
        
        Args:
            enabled: Whether service charge is enabled
            rate: Service charge rate (e.g., 0.125 for 12.5%)
            restaurant_id: Optional restaurant ID (None for platform-wide)
            user_id: User making the change (for audit trail)
            
        Returns:
            True if update was successful
        """
        try:
            prefix = f"restaurant.{restaurant_id}" if restaurant_id else "platform"
            
            # Update enabled status
            enabled_success = await self.platform_settings_service.update_platform_setting(
                config_key=f"{prefix}.service_charge.enabled",
                config_value={"value": enabled},
                change_reason=f"Service charge enabled status updated by user {user_id}"
            )
            
            # Update rate
            rate_success = await self.platform_settings_service.update_platform_setting(
                config_key=f"{prefix}.service_charge.rate",
                config_value={"value": rate},
                change_reason=f"Service charge rate updated by user {user_id}"
            )
            
            if enabled_success and rate_success:
                logger.info(f"Service charge settings updated successfully: "
                           f"enabled={enabled}, rate={rate}, restaurant_id={restaurant_id}")
                return True
            else:
                logger.error("Failed to update some service charge settings")
                return False
                
        except Exception as e:
            logger.error(f"Error updating service charge settings: {e}")
            return False

    async def update_payment_method_fee_inclusion(
        self,
        payment_method: PaymentMethodEnum,
        include_in_service_charge: bool,
        restaurant_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> bool:
        """
        Updates whether transaction fees for a payment method should be included in service charge.
        
        Args:
            payment_method: The payment method to configure
            include_in_service_charge: Whether to include fees in service charge
            restaurant_id: Optional restaurant ID (None for platform-wide)
            user_id: User making the change (for audit trail)
            
        Returns:
            True if update was successful
        """
        try:
            prefix = f"restaurant.{restaurant_id}" if restaurant_id else "platform"
            setting_key = f"{prefix}.payment_method.{payment_method.value}.include_fee_in_service_charge"
            
            success = await self.platform_settings_service.update_platform_setting(
                config_key=setting_key,
                config_value={"value": include_in_service_charge},
                change_reason=f"Payment method fee inclusion updated by user {user_id}"
            )
            
            if success:
                logger.info(f"Payment method fee inclusion updated: "
                           f"{payment_method}={include_in_service_charge}, restaurant_id={restaurant_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error updating payment method fee inclusion: {e}")
            return False