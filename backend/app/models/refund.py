import uuid
from sqlalchemy import Column, String, Numeric, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base

class Refund(Base):
    __tablename__ = "refunds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Corrected ForeignKey to "orders.id" and ensured order_id is String to match UUID type
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    reason = Column(Text)
    state = Column(String(50), nullable=False, default="done", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    ledger_entries = relationship("RefundLedger", back_populates="refund", cascade="all, delete-orphan")
    # If 'Order' is also a SQLAlchemy model in this context and a relationship is desired:
    # order = relationship("Order", backref="refund_entries")

class RefundLedger(Base):
    __tablename__ = "refunds_ledger"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    refund_id = Column(UUID(as_uuid=True), ForeignKey("refunds.id", ondelete="CASCADE"), nullable=False, index=True)
    # Assuming res_users.id is also a UUID string in your FastAPI context, if not, adjust type.
    # If res_users.id is Integer (Odoo default), then this should be Integer.
    # For consistency with other UUIDs, let's assume it's String(36) if it's a FastAPI managed user table.
    # However, 'res_users' implies an Odoo table. Odoo 'res_users.id' is Integer.
    # This highlights a potential type mismatch if FastAPI user IDs are UUIDs and Odoo's are Integers.
    # For now, assuming the FK is to an Odoo res_users table, so Integer is more appropriate for user_id.
    user_id = Column(Integer, ForeignKey("res_users.id"), nullable=True, index=True)
    device_id = Column(Text)
    action = Column(Text, nullable=False) # E.g., "created", "processed_gateway", "failed_gateway"
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    refund = relationship("Refund", back_populates="ledger_entries")
    # user = relationship("ResUsers") # Assuming a ResUsers model exists and is mapped in SQLAlchemy
    # If ResUsers is an Odoo model, this direct SQLAlchemy relationship might not be straightforward
    # unless there's a corresponding SQLAlchemy model for res_users.
    user = relationship("ResUsers") # Assuming a ResUsers model exists

# In your PosOrder model (e.g., addons/point_of_sale/models/pos_order.py), you would add:
# refunds = relationship("Refund", back_populates="order")

# In your ResUsers model (e.g., addons/base/models/res_users.py or a custom user model), you might add:
# refund_ledger_entries = relationship("RefundLedger", back_populates="user")
