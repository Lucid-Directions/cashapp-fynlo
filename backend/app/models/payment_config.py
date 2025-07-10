from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship, Session
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base # Assuming Base is correctly defined in app.core.database
from app.schemas.fee_schemas import PaymentMethodEnum # Reusing the enum

class PaymentMethodSetting(Base):
    __tablename__ = "payment_method_settings"

    id = Column(Integer, primary_key=True, index=True)

    # restaurant_id can be nullable if this setting can be a global platform default
    # If always restaurant-specific, it should not be nullable and have a ForeignKey
    # For now, let's assume there are platform-level defaults (restaurant_id IS NULL)
    # and restaurant-specific overrides (restaurant_id IS NOT NULL).
    # However, the issue schema implies restaurant_id is part of PK with payment_method,
    # suggesting settings are always per restaurant or per payment_method at platform level.
    # Let's adjust: a composite unique constraint for (restaurant_id, payment_method)
    # and another for (payment_method) where restaurant_id is NULL for platform defaults.

    restaurant_id = Column(String, index=True, nullable=True) # Assuming restaurant_id is a string. Adjust if it's UUID.
    # If restaurant_id links to an actual restaurants table:
    # restaurant_id = Column(UUID(as_uuid=True), ForeignKey('restaurants.id'), nullable=True, index=True)

    payment_method = Column(String, nullable=False, index=True) # Store enum value e.g., "stripe"

    # Defines if, by default, the customer pays the processor fee for this payment_method.
    customer_pays_default = Column(Boolean, default=True, nullable=False)

    # Defines if the merchant is allowed to toggle who pays the fee at the POS.
    allow_toggle_by_merchant = Column(Boolean, default=True, nullable=False)

    # Defines if the processor fee (when paid by customer) should be part of the service charge amount.
    include_processor_fee_in_service_charge = Column(Boolean, default=True, nullable=False)

    # Unique constraints and indexes
    __table_args__ = (
        # Unique constraint for restaurant-specific settings
        UniqueConstraint('restaurant_id', 'payment_method', name='uq_restaurant_payment_method_setting'),
        # Partial unique index for platform-level settings (restaurant_id is NULL)
        Index('idx_platform_payment_method_unique', 'payment_method', 
              unique=True, postgresql_where=restaurant_id.is_(None)),
        # Regular index for performance
        Index('idx_payment_method_settings_restaurant_method', 'restaurant_id', 'payment_method'),
    )

    def __repr__(self):
        return (
            f"<PaymentMethodSetting(id={self.id}, restaurant_id='{self.restaurant_id}', "
            f"payment_method='{self.payment_method}', customer_pays_default={self.customer_pays_default})>"
        )

# Example of how PlatformSettingsService might be extended or a new service created:
# class PaymentConfigurationService:
#     def __init__(self, db: Session):
#         self.db = db

#     def get_setting(self, payment_method: PaymentMethodEnum, restaurant_id: Optional[str]) -> Optional[PaymentMethodSetting]:
#         # First, try to get restaurant-specific setting
#         if restaurant_id:
#             setting = self.db.query(PaymentMethodSetting).filter(
#                 PaymentMethodSetting.restaurant_id == restaurant_id,
#                 PaymentMethodSetting.payment_method == payment_method.value
#             ).first()
#             if setting:
#                 return setting

#         # If no restaurant-specific, get platform default (restaurant_id is NULL)
#         setting = self.db.query(PaymentMethodSetting).filter(
#             PaymentMethodSetting.restaurant_id.is_(None),
#             PaymentMethodSetting.payment_method == payment_method.value
#         ).first()
#         return setting

#     def create_or_update_setting(self, data: PaymentMethodFeeSettingSchema, user_id: str):
#         # ... logic to create or update, with audit ...
#         pass
