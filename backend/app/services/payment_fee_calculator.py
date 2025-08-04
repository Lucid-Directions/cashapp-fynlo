import logging
from typing import Optional, Dict, Any
from decimal import Decimal, ROUND_HALF_UP

from app.services.platform_service import PlatformSettingsService
from app.schemas.fee_schemas import PaymentMethodEnum

logger = logging.getLogger(__name__)


class PaymentFeeCalculator:
    """
    Calculates the actual payment processor fees.
    This fee is what the platform itself is charged by the payment provider (e.g., Stripe, SumUp).
    """

    def __init__(self, platform_settings_service: PlatformSettingsService):
        self.platform_settings_service = platform_settings_service

    async def calculate_processor_fee(
        self,
        transaction_amount: float,
        payment_method: PaymentMethodEnum,
        restaurant_id: Optional[str] = None,
        # monthly_volume could be passed if available and relevant for specific providers like SumUp
        monthly_volume_for_restaurant: Optional[float] = None,
    ) -> float:
        """
        Calculates the actual fee charged by the payment processor to the platform.

        Args:
            transaction_amount: The amount of the transaction.
            payment_method: The payment method used.
            restaurant_id: Optional ID of the restaurant (may affect some specific fee calculations in PlatformSettingsService).
            monthly_volume_for_restaurant: Optional monthly transaction volume for the restaurant, used by some providers.

        Returns:
            The calculated processor fee as a float, rounded to standard currency precision (e.g., 2 decimal places).
        """
        if transaction_amount <= 0:
            return 0.0

        try:
            # PlatformSettingsService.calculate_effective_fee returns a dictionary.
            # The field 'platform_fee' in its returned dict represents the processor's fee to the platform.
            # The field 'effective_fee' includes any restaurant-specific markup ON TOP of the processor's fee.
            # We are interested in the pure processor fee.

            # Convert payment_method Enum to string if needed by underlying service
            payment_method_str = payment_method.value

            fee_details = await self.platform_settings_service.calculate_effective_fee(
                payment_method=payment_method_str,
                amount=transaction_amount,
                restaurant_id=restaurant_id,
                monthly_volume=monthly_volume_for_restaurant,
            )

            # 'platform_fee' in fee_details dict is the actual processor fee before restaurant markup.
            # This was a bit confusingly named in the original PlatformSettingsService.
            processor_fee_value = fee_details.get("platform_fee", 0.0)

            # Ensure the fee is positive
            if processor_fee_value < 0:
                logger.warning(
                    f"Calculated processor fee for {payment_method_str} was negative ({processor_fee_value}). Clamping to 0."
                )
                processor_fee_value = 0.0

            # Standard rounding for currency (e.g., to 2 decimal places)
            # Assuming GBP or USD-like currency, typically 2 decimal places.
            # Using Decimal for precision in financial calculations.
            quantizer = Decimal("0.01")
            rounded_fee = Decimal(str(processor_fee_value)).quantize(
                quantizer, rounding=ROUND_HALF_UP
            )

            return float(rounded_fee)

        except ValueError as ve:
            # This can happen if PlatformSettingsService raises ValueError (e.g., no fee config for payment method)
            logger.error(
                f"ValueError in PaymentFeeCalculator for {payment_method.value}: {ve}"
            )
            # Depending on policy, could re-raise, or return a default/error indicator.
            # For now, let's assume if a fee cannot be calculated, it's 0, but this might need adjustment.
            # Or, more safely, raise an exception to signal a configuration problem.
            raise ve  # Re-raise to make it explicit that fee calculation failed
        except Exception as e:
            logger.error(
                f"Error calculating processor fee for {payment_method.value} on amount {transaction_amount}: {e}",
                exc_info=True,
            )
            # Fallback or re-raise, based on business requirements for error handling.
            # Raising an exception is often safer for financial calculations to prevent silent errors.
            raise Exception(
                f"Failed to calculate processor fee for {payment_method.value}: {e}"
            )

    async def get_payment_method_fee_config(
        self, payment_method: PaymentMethodEnum, restaurant_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieves the fee configuration details for a specific payment method.
        This might include percentage rates, fixed fees, currency, etc.
        It primarily relies on `PlatformSettingsService` to get these details.
        """
        try:
            payment_method_str = payment_method.value
            # The fee config is stored under keys like 'payment.fees.stripe'
            fee_config_key = f"payment.fees.{payment_method_str}"

            # Use PlatformSettingsService to get the setting
            # If restaurant_id is provided, it might fetch an override, but raw fee configs are usually platform-level.
            # For now, let's assume direct fetch of platform setting for the fee structure.
            # If restaurant-specific fee structures (not just markups) exist, this needs more complex logic.

            raw_config = await self.platform_settings_service.get_platform_setting(
                config_key=fee_config_key
            )

            if raw_config and "value" in raw_config:
                return raw_config[
                    "value"
                ]  # This should be the dict like {'percentage': 1.4, 'fixed_fee': 0.20, 'currency': 'GBP'}
            else:
                logger.warning(
                    f"No fee configuration found for payment method '{payment_method_str}' using key '{fee_config_key}'."
                )
                return None
        except Exception as e:
            logger.error(
                f"Error retrieving fee configuration for {payment_method.value}: {e}",
                exc_info=True,
            )
            return None


# Example Usage (conceptual, would be part of another service or API endpoint)
# async def main():
#     from app.core.database import SessionLocal
#     db = SessionLocal()
#     try:
#         pss = PlatformSettingsService(db)
#         pfc = PaymentFeeCalculator(pss)
#
#         # Initialize default settings if not present (example)
#         # await pss.initialize_default_settings()
#
#         fee_stripe = await pfc.calculate_processor_fee(100.0, PaymentMethodEnum.STRIPE)
#         logger.info(f"Stripe processor fee on 100.00: {fee_stripe}")
#
#         fee_sumup = await pfc.calculate_processor_fee(100.0, PaymentMethodEnum.SUMUP, monthly_volume_for_restaurant=3000)
#         logger.info(f"SumUp processor fee on 100.00 (high volume): {fee_sumup}")
#
#         fee_sumup_low = await pfc.calculate_processor_fee(100.0, PaymentMethodEnum.SUMUP, monthly_volume_for_restaurant=1000)
#         logger.info(f"SumUp processor fee on 100.00 (low volume): {fee_sumup_low}")
#
#         stripe_config = await pfc.get_payment_method_fee_config(PaymentMethodEnum.STRIPE)
#         logger.info(f"Stripe fee config: {stripe_config}")
#
#     finally:
#         db.close()

# if __name__ == "__main__":
#     import asyncio
#     # This example setup is minimal and won't run directly without full FastAPI app context / DB setup
#     # You'd typically run this within an async FastAPI context or a dedicated script with proper app initialization.
#     # asyncio.run(main())
