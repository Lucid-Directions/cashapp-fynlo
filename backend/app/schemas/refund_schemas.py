from typing import List, Optional
from pydantic import BaseModel, UUID4
from decimal import Decimal


class RefundItemSchema(BaseModel):
    line_id: str  # Assuming line_id is a string, adjust if it's an int or other type
    qty: int


class RefundRequestSchema(BaseModel):
    items: Optional[
        List[RefundItemSchema]
    ] = None  # Null or empty for full order refund
    reason: Optional[str] = None
    # For full order refund, amount might be passed or calculated based on order total
    amount: Optional[Decimal] = None  # Explicit amount for full refund, if provided


class RefundResponseSchema(BaseModel):
    id: UUID4
    order_id: str  # Assuming order_id is a string from POS
    amount: Decimal
    reason: Optional[str] = None
    status: str  # e.g., "processed", "pending", "failed"
    gateway_refund_id: Optional[str] = None
    created_at: str  # ISO format datetime string

    class Config:
        from_attributes = True  # Pydantic V1 style, or from_attributes = True for V2
        # For Pydantic V2, ensure orm_mode is correctly handled.
        # If using Pydantic V2, it would be:
        # model_config = {"from_attributes": True}


class RefundLedgerEntrySchema(BaseModel):
    id: UUID4
    refund_id: UUID4
    user_id: Optional[str] = None  # Assuming user_id is a string
    device_id: Optional[str] = None
    action: str
    timestamp: str  # ISO format datetime string

    class Config:
        from_attributes = True
        # model_config = {"from_attributes": True} # For Pydantic V2
