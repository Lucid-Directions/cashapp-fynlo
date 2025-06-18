"""
Payment processing endpoints for Fynlo POS
Supports QR payments (1.2% fees), Stripe, Apple Pay, and cash
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import qrcode
import io
import base64
import stripe
import logging

from app.core.database import get_db, Payment, QRPayment, Order
from app.core.config import settings
from app.api.v1.endpoints.auth import get_current_user, User
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes

router = APIRouter()
logger = logging.getLogger(__name__)

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

# Pydantic models
class QRPaymentRequest(BaseModel):
    order_id: str
    amount: float

class QRPaymentResponse(BaseModel):
    qr_payment_id: str
    qr_code_data: str
    qr_code_image: str  # Base64 encoded QR code
    amount: float
    fee_amount: float
    net_amount: float
    expires_at: datetime
    status: str

class StripePaymentRequest(BaseModel):
    order_id: str
    amount: float
    payment_method_id: str
    currency: str = "gbp"

class PaymentResponse(BaseModel):
    payment_id: str
    status: str
    amount: float
    fee_amount: float
    net_amount: float
    external_id: Optional[str] = None

class CashPaymentRequest(BaseModel):
    order_id: str
    amount: float
    received_amount: float
    change_amount: float = 0.0

def calculate_payment_fee(amount: float, payment_method: str) -> float:
    """Calculate payment processing fees"""
    if payment_method == "qr_code":
        return amount * (settings.QR_PAYMENT_FEE_PERCENTAGE / 100)
    elif payment_method in ["card", "apple_pay", "google_pay"]:
        return amount * (settings.DEFAULT_CARD_FEE_PERCENTAGE / 100)
    else:  # cash, gift_card
        return 0.0

def generate_qr_code(data: str) -> str:
    """Generate QR code and return as base64 encoded image"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='PNG')
    img_str = base64.b64encode(img_buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

@router.post("/qr/generate", response_model=QRPaymentResponse)
async def generate_qr_payment(
    request: QRPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate QR code for payment with 1.2% fee advantage"""
    
    # Verify order exists
    order = db.query(Order).filter(Order.id == request.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Calculate fees
    fee_amount = calculate_payment_fee(request.amount, "qr_code")
    net_amount = request.amount - fee_amount
    
    # Generate unique payment data
    payment_data = {
        "payment_id": str(uuid.uuid4()),
        "order_id": request.order_id,
        "amount": request.amount,
        "merchant": "Fynlo POS",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Create QR payment record
    qr_payment = QRPayment(
        order_id=request.order_id,
        qr_code_data=str(payment_data),
        amount=request.amount,
        fee_amount=fee_amount,
        net_amount=net_amount,
        expires_at=datetime.utcnow() + timedelta(minutes=15)  # 15-minute expiry
    )
    
    db.add(qr_payment)
    db.commit()
    db.refresh(qr_payment)
    
    # Generate QR code image
    qr_code_image = generate_qr_code(str(payment_data))
    
    logger.info(f"QR payment generated: {qr_payment.id} for order {request.order_id}")
    
    return QRPaymentResponse(
        qr_payment_id=str(qr_payment.id),
        qr_code_data=qr_payment.qr_code_data,
        qr_code_image=qr_code_image,
        amount=qr_payment.amount,
        fee_amount=qr_payment.fee_amount,
        net_amount=qr_payment.net_amount,
        expires_at=qr_payment.expires_at,
        status=qr_payment.status
    )

@router.post("/qr/{qr_payment_id}/confirm")
async def confirm_qr_payment(
    qr_payment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Confirm QR payment completion"""
    
    qr_payment = db.query(QRPayment).filter(QRPayment.id == qr_payment_id).first()
    if not qr_payment:
        raise HTTPException(status_code=404, detail="QR payment not found")
    
    if qr_payment.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="QR payment expired")
    
    # Update QR payment status
    qr_payment.status = "completed"
    
    # Create payment record
    payment = Payment(
        order_id=qr_payment.order_id,
        payment_method="qr_code",
        amount=qr_payment.amount,
        fee_amount=qr_payment.fee_amount,
        net_amount=qr_payment.net_amount,
        status="completed",
        processed_at=datetime.utcnow(),
        metadata={"qr_payment_id": str(qr_payment.id)}
    )
    
    db.add(payment)
    
    # Update order payment status
    order = db.query(Order).filter(Order.id == qr_payment.order_id).first()
    if order:
        order.payment_status = "completed"
    
    db.commit()
    
    logger.info(f"QR payment confirmed: {qr_payment_id}")
    
    return {"message": "QR payment confirmed successfully", "payment_id": str(payment.id)}

@router.post("/stripe", response_model=PaymentResponse)
async def process_stripe_payment(
    request: StripePaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Process Stripe payment"""
    
    # Verify order exists
    order = db.query(Order).filter(Order.id == request.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    try:
        # Calculate fees
        fee_amount = calculate_payment_fee(request.amount, "card")
        net_amount = request.amount - fee_amount
        
        # Create Stripe PaymentIntent
        payment_intent = stripe.PaymentIntent.create(
            amount=int(request.amount * 100),  # Stripe uses cents
            currency=request.currency,
            payment_method=request.payment_method_id,
            confirmation_method='manual',
            confirm=True,
            metadata={
                'order_id': request.order_id,
                'restaurant_id': str(order.restaurant_id)
            }
        )
        
        # Create payment record
        payment = Payment(
            order_id=request.order_id,
            payment_method="card",
            amount=request.amount,
            fee_amount=fee_amount,
            net_amount=net_amount,
            status="completed" if payment_intent.status == "succeeded" else "pending",
            external_id=payment_intent.id,
            processed_at=datetime.utcnow() if payment_intent.status == "succeeded" else None,
            metadata={"stripe_payment_intent": payment_intent.id}
        )
        
        db.add(payment)
        
        # Update order if payment successful
        if payment_intent.status == "succeeded":
            order.payment_status = "completed"
        
        db.commit()
        db.refresh(payment)
        
        logger.info(f"Stripe payment processed: {payment.id} for order {request.order_id}")
        
        return PaymentResponse(
            payment_id=str(payment.id),
            status=payment.status,
            amount=payment.amount,
            fee_amount=payment.fee_amount,
            net_amount=payment.net_amount,
            external_id=payment.external_id
        )
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe payment failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Payment failed: {str(e)}")

@router.post("/cash", response_model=PaymentResponse)
async def process_cash_payment(
    request: CashPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Process cash payment"""
    
    # Verify order exists
    order = db.query(Order).filter(Order.id == request.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Calculate change
    if request.received_amount < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient cash received")
    
    change_amount = request.received_amount - request.amount
    
    # Create payment record (no fees for cash)
    payment = Payment(
        order_id=request.order_id,
        payment_method="cash",
        amount=request.amount,
        fee_amount=0.0,
        net_amount=request.amount,
        status="completed",
        processed_at=datetime.utcnow(),
        metadata={
            "received_amount": request.received_amount,
            "change_amount": change_amount
        }
    )
    
    db.add(payment)
    
    # Update order payment status
    order.payment_status = "completed"
    
    db.commit()
    db.refresh(payment)
    
    logger.info(f"Cash payment processed: {payment.id} for order {request.order_id}")
    
    return PaymentResponse(
        payment_id=str(payment.id),
        status=payment.status,
        amount=payment.amount,
        fee_amount=payment.fee_amount,
        net_amount=payment.net_amount
    )

@router.get("/order/{order_id}")
async def get_order_payments(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all payments for an order"""
    
    payments = db.query(Payment).filter(Payment.order_id == order_id).all()
    
    return [
        {
            "payment_id": str(payment.id),
            "payment_method": payment.payment_method,
            "amount": payment.amount,
            "fee_amount": payment.fee_amount,
            "net_amount": payment.net_amount,
            "status": payment.status,
            "processed_at": payment.processed_at,
            "external_id": payment.external_id
        }
        for payment in payments
    ]

@router.get("/qr/{qr_payment_id}/status")
async def check_qr_payment_status(
    qr_payment_id: str,
    db: Session = Depends(get_db)
):
    """Check QR payment status (public endpoint for payment checking)"""
    
    qr_payment = db.query(QRPayment).filter(QRPayment.id == qr_payment_id).first()
    if not qr_payment:
        raise HTTPException(status_code=404, detail="QR payment not found")
    
    return {
        "qr_payment_id": str(qr_payment.id),
        "status": qr_payment.status,
        "amount": qr_payment.amount,
        "expires_at": qr_payment.expires_at,
        "expired": qr_payment.expires_at < datetime.utcnow()
    }