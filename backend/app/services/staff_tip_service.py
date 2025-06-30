"""
Staff Tip Distribution Service - Manages tip distribution from service charges
Implements fair tip distribution considering transaction fees and service charge policies
"""

import logging
from typing import List, Optional, Dict, Any
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime

from app.services.platform_service import PlatformSettingsService
from app.schemas.fee_schemas import (
    StaffMember, 
    StaffTipDistribution, 
    StaffTipDistributionRecordSchema,
    ServiceChargeBreakdown
)

logger = logging.getLogger(__name__)

class StaffTipService:
    """
    Manages tip distribution from service charges to staff members.
    Handles transaction fee impact on tips and service charge policies.
    """

    def __init__(self, platform_settings_service: PlatformSettingsService):
        self.platform_settings_service = platform_settings_service

    def _round_currency(self, amount: Decimal) -> float:
        """Rounds a Decimal amount to 2 decimal places for currency representation."""
        quantizer = Decimal("0.01")
        return float(amount.quantize(quantizer, rounding=ROUND_HALF_UP))

    async def get_tip_distribution_percentage(self, restaurant_id: Optional[str] = None) -> Decimal:
        """
        Gets the percentage of service charge that goes to staff as tips.
        
        Args:
            restaurant_id: Optional restaurant ID for restaurant-specific settings
            
        Returns:
            Tip distribution percentage as decimal (e.g., 0.8 for 80%)
        """
        try:
            # Try restaurant-specific setting first
            if restaurant_id:
                restaurant_setting = await self.platform_settings_service.get_platform_setting(
                    f"restaurant.{restaurant_id}.tips.distribution_percentage"
                )
                if restaurant_setting:
                    return Decimal(str(restaurant_setting['value']['value']))
            
            # Fallback to platform default
            platform_setting = await self.platform_settings_service.get_platform_setting(
                "platform.tips.distribution_percentage"
            )
            if platform_setting:
                return Decimal(str(platform_setting['value']['value']))
            
            # Default to 80% of service charge goes to staff
            logger.warning("No tip distribution percentage found, using default 80%")
            return Decimal("0.80")
            
        except Exception as e:
            logger.error(f"Error getting tip distribution percentage: {e}")
            return Decimal("0.80")

    async def calculate_tip_distributions(
        self,
        service_charge_breakdown: ServiceChargeBreakdown,
        restaurant_id: str,
        order_id: str,
        staff_members: Optional[List[StaffMember]] = None,
    ) -> List[StaffTipDistribution]:
        """
        Calculates tip distributions from service charge breakdown.
        
        Args:
            service_charge_breakdown: Service charge calculation details
            restaurant_id: Restaurant ID
            order_id: Order ID for tracking
            staff_members: Optional list of staff members
            
        Returns:
            List of tip distributions
        """
        logger.info(f"Calculating tip distributions for order {order_id}")
        
        # Mock staff if not provided
        if not staff_members:
            staff_members = [
                StaffMember(id=f"staff_{restaurant_id}_1", name="Alice Johnson"),
                StaffMember(id=f"staff_{restaurant_id}_2", name="Bob Smith"),
            ]
        
        if not staff_members:
            return []
        
        # Get tip distribution percentage
        tip_percentage = await self.get_tip_distribution_percentage(restaurant_id)
        
        # Calculate tip amount from service charge
        dec_service_charge = Decimal(str(service_charge_breakdown['final_service_charge_amount']))
        total_tip_amount = dec_service_charge * tip_percentage
        
        # Distribute equally among staff
        tip_per_person = total_tip_amount / len(staff_members)
        distributions = []
        
        for staff_member in staff_members:
            distributions.append(StaffTipDistribution(
                staff_member=staff_member,
                tip_amount_allocated=self._round_currency(tip_per_person),
                notes=f"Service charge distribution ({len(staff_members)} staff)"
            ))
        
        return distributions