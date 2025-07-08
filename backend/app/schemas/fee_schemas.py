from typing import TypedDict, Optional, List
from enum import Enum

class PaymentMethodEnum(str, Enum):
    STRIPE = "stripe"
    SUMUP = "sumup"
    CASH = "cash"
    CARD_MANUAL = "card_manual" # A generic card payment
    OTHER = "other"

class CustomerTotalBreakdown(TypedDict):
    subtotal: float
    vat_amount: float # Assuming VAT might be needed explicitly
    service_charge_calculated: float
    platform_fee: float
    processor_fee: float
    customer_pays_processor_fees: bool
    final_total: float
    notes: Optional[str]

class ServiceChargeBreakdown(TypedDict):
    original_service_charge_on_subtotal: float
    processor_fee_added_to_service_charge: float # This is the portion of processor fee covered by SC
    final_service_charge_amount: float
    service_charge_rate_applied: float # The rate used (e.g. 0.10 for 10%)
    include_transaction_fees_in_service_charge: bool

# For StaffTipService later
class StaffMember(TypedDict):
    id: str # Staff ID, likely from Odoo user or hr.employee
    name: str

class StaffTipDistribution(TypedDict):
    staff_member: StaffMember
    tip_amount_allocated: float
    notes: Optional[str]

# For payment_method_fee_settings table later
class PaymentMethodFeeSettingSchema(TypedDict):
    id: Optional[int] # Primary key
    restaurant_id: Optional[str] # For restaurant-specific overrides, null for platform default
    payment_method: PaymentMethodEnum
    customer_pays_default: bool
    allow_toggle_by_merchant: bool # If merchant can switch who pays on POS
    include_processor_fee_in_service_charge: bool # If this payment method's fee contributes to SC

    class Config:
        from_attributes = True # If using Pydantic models with SQLAlchemy

# For platform_fees table later
class PlatformFeeRecordSchema(TypedDict):
    id: Optional[int]
    order_id: str # Link to Odoo pos.order name or ID
    platform_fee_amount: float
    processor_fee_amount: float
    customer_paid_processor: bool
    payment_method: PaymentMethodEnum
    transaction_timestamp: str # ISO format

    class Config:
        from_attributes = True

# For staff_tip_distributions table later
class StaffTipDistributionRecordSchema(TypedDict):
    id: Optional[int]
    order_id: str # Link to Odoo pos.order name or ID
    staff_id: str # Link to StaffMember ID
    tip_amount_gross: float # Tip amount collected for this staff member before any deductions
    service_charge_deduction: float # Portion of tip reduced due to service charge policy
    transaction_fee_impact_on_tip: float # Portion of tip reduced due to transaction fees in SC
    tip_amount_net: float # Actual tip paid to staff
    distribution_timestamp: str # ISO format

    class Config:
        from_attributes = True
