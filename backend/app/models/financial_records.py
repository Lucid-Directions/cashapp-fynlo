from sqlalchemy import Column, String, Boolean, Integer, DateTime, Numeric, Index
from sqlalchemy.sql import func  # For server-side default timestamps


from app.core.database import Base  # Assuming Base is correctly defined

# from app.schemas.fee_schemas import PaymentMethodEnum # Not strictly needed for model def, but for context


class PlatformFeeRecord(Base):
    __tablename__ = "platform_fees"

    id = Column(Integer, primary_key=True, index=True)  # Auto-incrementing integer PK

    # Assuming order_id from Odoo might be a string (e.g., 'Order 00001-001-0001') or an integer/UUID if synced differently.
    # Using String for flexibility, but this needs to match how Odoo order identifiers are referenced.
    order_reference = Column(String, nullable=False, index=True)

    platform_fee_amount = Column(
        Numeric(10, 2), nullable=False
    )  # Store as Numeric for precision
    processor_fee_amount = Column(Numeric(10, 2), nullable=False)
    customer_paid_processor_fee = Column(
        Boolean, nullable=False
    )  # Clarified name from schema

    payment_method = Column(
        String, nullable=False
    )  # Stores PaymentMethodEnum.value, e.g., "stripe"

    transaction_timestamp = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # If you want client-settable timestamp, then nullable=False, default=None, and set it in service.
    # server_default=func.now() is generally good for record creation time.

    # Additional fields that might be useful:
    # restaurant_id = Column(String, index=True)
    # transaction_id_external = Column(String, index=True, nullable=True) # e.g., Stripe charge ID

    def __repr__(self):
        return (
            f"<PlatformFeeRecord(id={self.id}, order_reference='{self.order_reference}', "
            f"platform_fee={self.platform_fee_amount}, processor_fee={self.processor_fee_amount})>"
        )


class StaffTipDistributionRecord(Base):
    __tablename__ = "staff_tip_distributions"

    id = Column(Integer, primary_key=True, index=True)

    order_reference = Column(
        String, nullable=False, index=True
    )  # Links to Odoo pos.order

    # staff_id would ideally link to a users or hr_employee table if those are synced/available.
    # Using String for now.
    staff_id = Column(String, nullable=False, index=True)

    tip_amount_gross = Column(Numeric(10, 2), nullable=False)
    service_charge_deduction = Column(Numeric(10, 2), nullable=False, default=0.0)
    transaction_fee_impact_on_tip = Column(
        Numeric(10, 2), nullable=False, default=0.0
    )  # Renamed from schema for clarity
    tip_amount_net = Column(Numeric(10, 2), nullable=False)  # Gross - deductions

    distribution_timestamp = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Additional fields:
    # payment_id_external = Column(String) # If tips are paid out via a system that provides IDs
    # week_number = Column(Integer, index=True) # For easier weekly reporting

    __table_args__ = (
        Index("idx_staff_tip_order_staff", "order_reference", "staff_id"),
    )

    def __repr__(self):
        return (
            f"<StaffTipDistributionRecord(id={self.id}, order_reference='{self.order_reference}', "
            f"staff_id='{self.staff_id}', net_tip={self.tip_amount_net})>"
        )
