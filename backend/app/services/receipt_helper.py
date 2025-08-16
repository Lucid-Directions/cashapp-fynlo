"""
Helper functions for receipt sending with proper database session handling
"""

import logging
from typing import Any
from app.core.database import SessionLocal, ReceiptLog
from app.services.email_service import EmailService
from sqlalchemy.orm import Session
from datetime import datetime

logger = logging.getLogger(__name__)


def send_receipt_with_logging(order_dict: dict, type_: str, amount: float) -> None:
    """
    Send receipt email with proper database logging.
    This function creates its own database session for use in background tasks.
    
    Args:
        order_dict: Dictionary containing order data (serialized from Order model)
        type_: Receipt type ('sale' or 'refund')
        amount: Payment amount
    """
    email_service = EmailService()
    
    # Create a new database session for this background task
    # Using SessionLocal directly to ensure proper cleanup
    db: Session = SessionLocal()
    
    try:
        # Create a mock order object with required attributes for email template
        class OrderMock:
            def __init__(self, data):
                for key, value in data.items():
                    setattr(self, key, value)
        
        order = OrderMock(order_dict)
        
        # Send the receipt email
        success = email_service.send_receipt(
            order=order,
            type_=type_,
            amount=amount
        )
        
        # Log the receipt delivery attempt
        if success:
            try:
                receipt_log = ReceiptLog(
                    order_id=order.id,
                    restaurant_id=order.restaurant_id,
                    receipt_type=type_,
                    delivery_method="email",
                    recipient=order.customer_email,
                    sent_at=datetime.utcnow(),
                    delivered=True,
                    delivery_status="sent",
                    metadata={
                        "amount": amount,
                        "order_number": order.order_number
                    }
                )
                db.add(receipt_log)
                db.commit()
                logger.info(f"Receipt logged in database for order {order.id}")
            except Exception as log_error:
                logger.error(f"Failed to log receipt in database: {log_error}")
                db.rollback()
        else:
            # Log failed attempt
            try:
                receipt_log = ReceiptLog(
                    order_id=order.id,
                    restaurant_id=order.restaurant_id,
                    receipt_type=type_,
                    delivery_method="email",
                    recipient=order.customer_email,
                    sent_at=datetime.utcnow(),
                    delivered=False,
                    delivery_status="failed",
                    error_message="Email send failed",
                    metadata={
                        "amount": amount,
                        "order_number": order.order_number
                    }
                )
                db.add(receipt_log)
                db.commit()
                logger.error(f"Receipt send failed for order {order.id}")
            except Exception as log_error:
                logger.error(f"Failed to log failed receipt attempt: {log_error}")
                db.rollback()
                
    except Exception as e:
        logger.error(f"Error in send_receipt_with_logging: {str(e)}")
    finally:
        # Always close the database session
        db.close()


def serialize_order_for_background(order: Any) -> dict:
    """
    Serialize an Order model instance to a dictionary for passing to background tasks.
    
    Args:
        order: Order model instance
        
    Returns:
        Dictionary with order data
    """
    return {
        "id": str(order.id),
        "restaurant_id": str(order.restaurant_id),
        "customer_id": str(order.customer_id) if order.customer_id else None,
        "customer_email": order.customer_email,
        "order_number": order.order_number,
        "table_number": order.table_number,
        "order_type": order.order_type,
        "status": order.status,
        "items": order.items,  # Already JSONB
        "subtotal": float(order.subtotal),
        "tax_amount": float(order.tax_amount),
        "service_charge": float(order.service_charge),
        "discount_amount": float(order.discount_amount),
        "total_amount": float(order.total_amount),
        "payment_status": order.payment_status,
        "special_instructions": order.special_instructions,
        "created_by": str(order.created_by),
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
    }