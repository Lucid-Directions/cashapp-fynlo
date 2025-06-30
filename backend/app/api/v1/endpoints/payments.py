"""
Payment processing endpoints for Fynlo POS
Supports multi-provider payments (Stripe, Square, SumUp), QR payments, and cash
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
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
from app.core.transaction_manager import transactional, transaction_manager
from app.services.payment_factory import payment_factory
from app.services.audit_logger import AuditLoggerService
from app.models.audit_log import AuditEventType, AuditEventStatus
from app.middleware.rate_limit_middleware import limiter, PAYMENT_RATE

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

# New multi-provider payment models
class PaymentRequest(BaseModel):
    order_id: str
    amount: float
    customer_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    currency: str = "GBP"
    metadata: Optional[dict] = None

class RefundRequest(BaseModel):
    transaction_id: str
    amount: Optional[float] = None
    reason: Optional[str] = None

class ProviderInfo(BaseModel):
    name: str
    display_name: str
    sample_fees: dict
    rate: str
    monthly_fee: Optional[str] = None
    recommended: bool = False

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
@limiter.limit(PAYMENT_RATE)
async def generate_qr_payment(
    payment_request: QRPaymentRequest, # Renamed from 'request' to avoid conflict
    request: Request, # Added for rate limiter
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate QR code for payment with 1.2% fee advantage"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    # Verify order exists
    order = db.query(Order).filter(Order.id == payment_request.order_id).first()
    if not order:
        # Log attempt to generate QR for non-existent order?
        # This might be more of a validation error than a payment initiation failure.
        # For now, let's assume this is handled by exception handler.
        # If we wanted to log it:
        # await audit_service.create_audit_log(
        #     event_type=AuditEventType.PAYMENT_INITIATED, # Or a more specific event
        #     event_status=AuditEventStatus.FAILURE,
        #     action_performed="QR payment generation failed: Order not found.",
        #     user_id=current_user.id,
        #     username_or_email=current_user.email,
        #     ip_address=ip_address,
        #     user_agent=user_agent,
        #     details={"order_id": payment_request.order_id, "amount": payment_request.amount, "reason": "Order not found"},
        #     commit=True
        # )
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Calculate fees
    fee_amount = calculate_payment_fee(payment_request.amount, "qr_code")
    net_amount = payment_request.amount - fee_amount
    
    # Generate unique payment data
    # This payment_id is for the QR data, not the final Payment record
    internal_qr_payment_id = str(uuid.uuid4())
    payment_data_for_qr = {
        "payment_id": internal_qr_payment_id, # This ID is embedded in the QR
        "order_id": payment_request.order_id,
        "amount": payment_request.amount,
        "merchant": "Fynlo POS", # Consider making this dynamic if needed
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Create QR payment record in DB (tracks the QR code itself)
    qr_payment_db_record = QRPayment(
        order_id=payment_request.order_id,
        qr_code_data=str(payment_data_for_qr), # Storing the data that went into QR
        amount=payment_request.amount,
        fee_amount=fee_amount,
        net_amount=net_amount,
        expires_at=datetime.utcnow() + timedelta(minutes=15)  # 15-minute expiry
    )
    
    db.add(qr_payment_db_record)

    await audit_service.create_audit_log(
        event_type=AuditEventType.PAYMENT_INITIATED,
        event_status=AuditEventStatus.SUCCESS, # Successfully initiated by generating QR
        action_performed="QR payment initiated by generating QR code.",
        user_id=current_user.id,
        username_or_email=current_user.email,
        ip_address=ip_address,
        user_agent=user_agent,
        resource_type="QRPayment",
        resource_id=str(qr_payment_db_record.id), # ID of the QRPayment table entry
        details={
            "order_id": payment_request.order_id,
            "amount": payment_request.amount,
            "payment_method": "qr_code",
            "qr_internal_id": internal_qr_payment_id # The ID embedded in QR
        },
        commit=False # Will be committed with qr_payment_db_record
    )

    db.commit()
    db.refresh(qr_payment_db_record)
    
    # Generate QR code image using the data that includes the internal_qr_payment_id
    qr_code_image = generate_qr_code(str(payment_data_for_qr))
    
    logger.info(f"QR payment generated: {qr_payment_db_record.id} for order {payment_request.order_id}")
    
    return QRPaymentResponse(
        qr_payment_id=str(qr_payment_db_record.id),
        qr_code_data=qr_payment_db_record.qr_code_data,
        qr_code_image=qr_code_image,
        amount=qr_payment_db_record.amount,
        fee_amount=qr_payment_db_record.fee_amount,
        net_amount=qr_payment_db_record.net_amount,
        expires_at=qr_payment_db_record.expires_at,
        status=qr_payment_db_record.status
    )

@router.post("/qr/{qr_payment_id}/confirm")
@transactional(max_retries=3, retry_delay=0.1)
async def confirm_qr_payment(
    request: Request,
    qr_payment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Confirm QR payment completion"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    qr_payment_db_record = db.query(QRPayment).filter(QRPayment.id == qr_payment_id).first()
    if not qr_payment_db_record:
        # Log this attempt, then raise
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE,
            event_status=AuditEventStatus.FAILURE,
            action_performed="QR payment confirmation failed: QR payment record not found.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="QRPayment", resource_id=qr_payment_id,
            details={"reason": "QR payment record not found."},
            commit=True
        )
        raise HTTPException(status_code=404, detail="QR payment not found")
    
    if qr_payment_db_record.expires_at < datetime.utcnow():
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE,
            event_status=AuditEventStatus.FAILURE,
            action_performed="QR payment confirmation failed: QR payment expired.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="QRPayment", resource_id=qr_payment_id,
            details={"order_id": str(qr_payment_db_record.order_id), "amount": qr_payment_db_record.amount, "reason": "QR payment expired."},
            commit=True
        )
        raise HTTPException(status_code=400, detail="QR payment expired")
    
    if qr_payment_db_record.status == "completed":
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE, # Or INFO, as it's not a new failure
            event_status=AuditEventStatus.INFO,
            action_performed="QR payment confirmation attempt: Already processed.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="QRPayment", resource_id=qr_payment_id,
            details={"order_id": str(qr_payment_db_record.order_id), "amount": qr_payment_db_record.amount, "reason": "QR payment already processed."},
            commit=True
        )
        raise HTTPException(status_code=400, detail="QR payment already processed")
    
    if qr_payment_db_record.status != "pending":
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE,
            event_status=AuditEventStatus.FAILURE,
            action_performed=f"QR payment confirmation failed: Invalid status '{qr_payment_db_record.status}'.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="QRPayment", resource_id=qr_payment_id,
            details={"order_id": str(qr_payment_db_record.order_id), "amount": qr_payment_db_record.amount, "reason": f"Cannot confirm QR payment with status: {qr_payment_db_record.status}"},
            commit=True
        )
        raise HTTPException(status_code=400, detail=f"Cannot confirm QR payment with status: {qr_payment_db_record.status}")
    
    # Get order for validation
    order = db.query(Order).filter(Order.id == qr_payment_db_record.order_id).first()
    if not order:
        # This case should ideally not be reached if DB integrity is maintained
        # but log it defensively if it does.
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
            action_performed="QR payment confirmation failed: Associated order not found.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="QRPayment", resource_id=qr_payment_id,
            details={"order_id": str(qr_payment_db_record.order_id), "reason": "Associated order not found internally."},
            commit=True
        )
        raise HTTPException(status_code=404, detail="Associated order not found")
    
    if order.payment_status == "completed":
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO, # Info, as order already paid
            action_performed="QR payment confirmation failed: Order already paid.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="Order", resource_id=str(order.id),
            details={"qr_payment_id": qr_payment_id, "reason": "Order already marked as paid."},
            commit=True
        )
        raise HTTPException(status_code=400, detail="Order already paid")
    
    payment_record = None # To store the created Payment object
    try:
        # Update QR payment status
        qr_payment_db_record.status = "completed"
        
        # Create payment record
        payment_record = Payment(
            order_id=qr_payment_db_record.order_id,
            payment_method="qr_code",
            amount=qr_payment_db_record.amount,
            fee_amount=qr_payment_db_record.fee_amount,
            net_amount=qr_payment_db_record.net_amount,
            status="completed",
            processed_at=datetime.utcnow(),
            payment_metadata={"qr_payment_id": str(qr_payment_db_record.id)}
        )
        
        db.add(payment_record)
        
        # Update order payment status
        order.payment_status = "completed"
        order.status = "confirmed" if order.status == "pending" else order.status
        
        # Log success (commit=False due to @transactional)
        # The flush() within create_audit_log will assign an ID to payment_record
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_SUCCESS,
            event_status=AuditEventStatus.SUCCESS,
            action_performed="QR payment confirmed successfully.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="Payment", # The main Payment record
            resource_id=str(payment_record.id), # Will be set after flush
            details={
                "order_id": str(order.id),
                "qr_payment_id": qr_payment_id,
                "amount": payment_record.amount
            },
            commit=False
        )
        # Transaction will auto-commit due to @transactional decorator
        
    except Exception as e:
        # Log failure (commit=False, as @transactional will rollback)
        # If create_audit_log itself fails, it won't affect the rollback of the main transaction.
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE,
            event_status=AuditEventStatus.FAILURE,
            action_performed="QR payment confirmation failed during processing.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="QRPayment", resource_id=qr_payment_id,
            details={"order_id": str(qr_payment_db_record.order_id), "error": str(e)},
            commit=False # Will be rolled back by @transactional
        )
        logger.error(f"QR payment confirmation failed for {qr_payment_id}: {e}")
        raise HTTPException(status_code=500, detail="Payment confirmation failed")
    
    logger.info(f"QR payment confirmed: {qr_payment_id}")
    
    # The payment_record might not have its ID fully populated here if there was an error
    # before the flush inside create_audit_log, or if create_audit_log itself failed.
    # However, the happy path should have it.
    return APIResponseHelper.success(
        message="QR payment confirmed successfully",
        data={"payment_id": str(payment_record.id) if payment_record and payment_record.id else None}
    )

@router.post("/stripe", response_model=PaymentResponse)
@limiter.limit(PAYMENT_RATE)
@transactional(max_retries=2, retry_delay=0.2)
async def process_stripe_payment(
    payment_request_data: StripePaymentRequest, # Renamed from 'request'
    request: Request, # Added for rate limiter
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Process Stripe payment"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    # Verify order exists
    order = db.query(Order).filter(Order.id == payment_request_data.order_id).first()
    if not order:
        # Log attempt for non-existent order
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
            action_performed="Stripe payment failed: Order not found.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            details={"order_id": payment_request_data.order_id, "amount": payment_request_data.amount, "reason": "Order not found"},
            commit=True
        )
        raise HTTPException(status_code=404, detail="Order not found")

    if order.payment_status == "completed":
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO,
            action_performed="Stripe payment attempt failed: Order already paid.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="Order", resource_id=str(order.id),
            details={"reason": "Order already marked as paid."},
            commit=True
        )
        raise HTTPException(status_code=400, detail="Order already paid")

    # Calculate fees
    fee_amount = calculate_payment_fee(payment_request_data.amount, "card")
    net_amount = payment_request_data.amount - fee_amount

    # Create payment record first (with pending status)
    payment_db_record = Payment(
        order_id=payment_request_data.order_id,
        payment_method="stripe",
        amount=payment_request_data.amount,
        fee_amount=fee_amount,
        net_amount=net_amount,
        status="pending", # Initial status
        payment_metadata={"stripe_payment_method_id": payment_request_data.payment_method_id}
    )
    db.add(payment_db_record)
    db.flush() # Get payment_db_record.id before external API call & audit log

    await audit_service.create_audit_log(
        event_type=AuditEventType.PAYMENT_INITIATED,
        event_status=AuditEventStatus.PENDING, # Status is pending as we are about to call Stripe
        action_performed="Stripe payment initiated.",
        user_id=current_user.id, username_or_email=current_user.email,
        ip_address=ip_address, user_agent=user_agent,
        resource_type="Payment", resource_id=str(payment_db_record.id),
        details={
            "order_id": payment_request_data.order_id,
            "amount": payment_request_data.amount,
            "payment_method_id": payment_request_data.payment_method_id
        },
        commit=False # Part of the larger transaction
    )

    try:
        payment_intent = stripe.PaymentIntent.create(
            amount=int(payment_request_data.amount * 100),  # Stripe uses cents
            currency=payment_request_data.currency,
            payment_method=payment_request_data.payment_method_id,
            metadata={
                "order_id": str(payment_request_data.order_id),
                "payment_id": str(payment_db_record.id),
                "restaurant_id": str(order.restaurant_id)
            },
            confirmation_method='manual',
            confirm=True,
        )

        payment_db_record.external_id = payment_intent.id
        payment_db_record.payment_metadata.update({"stripe_payment_intent": payment_intent.id})

        if payment_intent.status == "succeeded":
            payment_db_record.status = "completed"
            payment_db_record.processed_at = datetime.utcnow()
            order.payment_status = "completed"
            order.status = "confirmed" if order.status == "pending" else order.status

            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_SUCCESS,
                event_status=AuditEventStatus.SUCCESS,
                action_performed="Stripe payment succeeded.",
                user_id=current_user.id, username_or_email=current_user.email,
                ip_address=ip_address, user_agent=user_agent,
                resource_type="Payment", resource_id=str(payment_db_record.id),
                details={
                    "order_id": payment_request_data.order_id,
                    "stripe_payment_intent_id": payment_intent.id,
                    "amount": payment_db_record.amount
                },
                commit=False
            )
        else:
            payment_db_record.status = "failed"
            logger.warning(f"Stripe payment failed for order {payment_request_data.order_id}: {payment_intent.status}")
            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_FAILURE,
                event_status=AuditEventStatus.FAILURE,
                action_performed="Stripe payment failed by provider.",
                user_id=current_user.id, username_or_email=current_user.email,
                ip_address=ip_address, user_agent=user_agent,
                resource_type="Payment", resource_id=str(payment_db_record.id),
                details={
                    "order_id": payment_request_data.order_id,
                    "stripe_payment_intent_id": payment_intent.id,
                    "stripe_status": payment_intent.status,
                    "reason": "Stripe processing resulted in failure."
                },
                commit=False
            )
        
        # Transaction auto-commits on success
        db.refresh(payment_db_record) # Refresh before returning
        
        logger.info(f"Stripe payment processed: {payment_db_record.id} for order {payment_request_data.order_id}")
        
        return PaymentResponse(
            payment_id=str(payment_db_record.id),
            status=payment_db_record.status,
            amount=payment_db_record.amount,
            fee_amount=payment_db_record.fee_amount,
            net_amount=payment_db_record.net_amount,
            external_id=payment_db_record.external_id
        )

    except stripe.error.StripeError as e:
        payment_db_record.status = "failed"
        payment_db_record.payment_metadata.update({"stripe_error": str(e)})
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE,
            event_status=AuditEventStatus.FAILURE,
            action_performed="Stripe payment failed due to Stripe API error.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="Payment", resource_id=str(payment_db_record.id),
            details={"order_id": payment_request_data.order_id, "error": str(e), "error_type": e.__class__.__name__},
            commit=False
        )
        logger.error(f"Stripe payment failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Payment failed: {str(e)}")
    except Exception as e:
        payment_db_record.status = "failed" # Ensure status is marked failed
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE,
            event_status=AuditEventStatus.FAILURE,
            action_performed="Stripe payment failed due to unexpected server error.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="Payment", resource_id=str(payment_db_record.id),
            details={"order_id": payment_request_data.order_id, "error": str(e)},
            commit=False
        )
        logger.error(f"Unexpected error during Stripe payment: {e}")
        raise HTTPException(status_code=500, detail="Payment processing failed")

@router.post("/cash", response_model=PaymentResponse)
async def process_cash_payment(
    payment_request_data: CashPaymentRequest, # Renamed from 'request'
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Process cash payment"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    order = db.query(Order).filter(Order.id == payment_request_data.order_id).first()
    if not order:
        # No audit log here as it's a basic validation, not a payment process failure yet.
        raise HTTPException(status_code=404, detail="Order not found")

    if order.payment_status == "completed":
         await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO,
            action_performed="Cash payment attempt failed: Order already paid.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="Order", resource_id=str(order.id),
            details={"reason": "Order already marked as paid."},
            commit=True
        )
         raise HTTPException(status_code=400, detail="Order already paid")

    if payment_request_data.received_amount < payment_request_data.amount:
        # Log this specific failure if desired, though it's a validation error.
        # For now, let the HTTP exception handle it.
        raise HTTPException(status_code=400, detail="Insufficient cash received")
    
    change_amount = payment_request_data.received_amount - payment_request_data.amount
    
    payment_db_record = Payment(
        order_id=payment_request_data.order_id,
        payment_method="cash",
        amount=payment_request_data.amount,
        fee_amount=0.0,
        net_amount=payment_request_data.amount,
        status="completed", # Cash is typically completed immediately
        processed_at=datetime.utcnow(),
        payment_metadata={
            "received_amount": payment_request_data.received_amount,
            "change_amount": change_amount
        }
    )
    db.add(payment_db_record)
    order.payment_status = "completed"

    await audit_service.create_audit_log(
        event_type=AuditEventType.PAYMENT_SUCCESS, # Cash payments are direct success
        event_status=AuditEventStatus.SUCCESS,
        action_performed="Cash payment processed successfully.",
        user_id=current_user.id, username_or_email=current_user.email,
        ip_address=ip_address, user_agent=user_agent,
        resource_type="Payment", resource_id=str(payment_db_record.id), # ID after flush
        details={
            "order_id": payment_request_data.order_id,
            "amount": payment_request_data.amount,
            "received_amount": payment_request_data.received_amount,
            "change_amount": change_amount
        },
        commit=False # Commit with payment and order update
    )
    
    db.commit()
    db.refresh(payment_db_record)
    db.refresh(order) # Potentially refresh order if its status changed and is used
    
    logger.info(f"Cash payment processed: {payment_db_record.id} for order {payment_request_data.order_id}")
    
    return PaymentResponse(
        payment_id=str(payment_db_record.id),
        status=payment_db_record.status,
        amount=payment_db_record.amount,
        fee_amount=payment_db_record.fee_amount,
        net_amount=payment_db_record.net_amount
    )

@router.get("/order/{order_id}")
async def get_order_payments(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all payments for an order"""
    
    payments = db.query(Payment).filter(Payment.order_id == order_id).all()
    
    payment_data = [
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
    
    return APIResponseHelper.success(
        data=payment_data,
        message=f"Retrieved {len(payment_data)} payments for order"
    )

@router.get("/qr/{qr_payment_id}/status")
async def check_qr_payment_status(
    qr_payment_id: str,
    db: Session = Depends(get_db)
):
    """Check QR payment status (public endpoint for payment checking)"""
    
    qr_payment = db.query(QRPayment).filter(QRPayment.id == qr_payment_id).first()
    if not qr_payment:
        raise HTTPException(status_code=404, detail="QR payment not found")
    
    data = {
        "qr_payment_id": str(qr_payment.id),
        "status": qr_payment.status,
        "amount": qr_payment.amount,
        "expires_at": qr_payment.expires_at,
        "expired": qr_payment.expires_at < datetime.utcnow()
    }
    
    return APIResponseHelper.success(
        data=data,
        message="QR payment status retrieved"
    )

# New multi-provider payment endpoints

@router.post("/process")
async def process_payment(
    payment_data_req: PaymentRequest, # Renamed from payment_data to avoid confusion
    request: Request,
    provider_query: Optional[str] = Query(None, alias="provider", description="Force specific provider"), # Renamed provider
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process a payment through the optimal provider
    
    Query params:
    - provider: Force a specific provider (stripe, square, sumup)
    
    Body:
    - order_id: Associated order ID
    - amount: Payment amount in GBP
    - payment_method_id: Provider-specific payment method ID
    - customer_id: Optional customer ID
    """
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    payment_db_record = None # Initialize

    try:
        order = db.query(Order).filter(Order.id == payment_data_req.order_id).first()
        if not order:
            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
                action_performed="Payment processing failed: Order not found.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                details={"order_id": payment_data_req.order_id, "amount": payment_data_req.amount, "reason": "Order not found"},
                commit=True
            )
            raise HTTPException(status_code=404, detail="Order not found")

        if order.payment_status == "completed":
            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO,
                action_performed="Payment processing attempt failed: Order already paid.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                resource_type="Order", resource_id=str(order.id), details={"reason": "Order already marked as paid."},
                commit=True
            )
            raise HTTPException(status_code=400, detail="Order already paid")

        monthly_volume = Decimal("2000")
        provider_instance = await payment_factory.select_optimal_provider(
            amount=Decimal(str(payment_data_req.amount)),
            restaurant_id=str(order.restaurant_id) if hasattr(order, 'restaurant_id') else "default",
            monthly_volume=monthly_volume,
            force_provider=provider_query,
            db_session=db
        )
        
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_INITIATED,
            event_status=AuditEventStatus.PENDING,
            action_performed=f"Payment processing initiated with provider: {provider_instance.name if provider_instance else 'N/A'}.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            resource_type="Order", resource_id=str(order.id),
            details={
                "order_id": payment_data_req.order_id, "amount": payment_data_req.amount,
                "currency": payment_data_req.currency, "provider_selected": provider_instance.name if provider_instance else 'N/A',
                "customer_id": payment_data_req.customer_id
            },
            commit=False # Will be committed with payment record or if error occurs before that
        )

        result = await provider_instance.process_payment(
            amount=Decimal(str(payment_data_req.amount)),
            customer_id=payment_data_req.customer_id,
            payment_method_id=payment_data_req.payment_method_id,
            metadata={
                "order_id": payment_data_req.order_id,
                "restaurant_id": str(order.restaurant_id) if hasattr(order, 'restaurant_id') else "default",
                **(payment_data_req.metadata or {})
            }
        )
        
        event_status_for_log = AuditEventStatus.SUCCESS if result["status"] == "success" else \
                               AuditEventStatus.PENDING if result["status"] == "pending" else AuditEventStatus.FAILURE
        audit_event_type = AuditEventType.PAYMENT_SUCCESS if result["status"] in ["success", "pending"] else AuditEventType.PAYMENT_FAILURE

        if result["status"] in ["success", "pending"]:
            payment_db_record = Payment(
                order_id=payment_data_req.order_id,
                payment_method=f"{result['provider']}_payment",
                provider=result["provider"],
                amount=payment_data_req.amount,
                fee_amount=result["fee"] / 100,
                provider_fee=result["fee"] / 100,
                net_amount=result["net_amount"] / 100,
                status=result["status"], # This is "success" or "pending"
                external_id=result["transaction_id"],
                processed_at=datetime.utcnow() if result["status"] == "success" else None,
                payment_metadata={
                    "provider": result["provider"], "transaction_id": result["transaction_id"],
                    "raw_response": result.get("raw_response", {}), **(payment_data_req.metadata or {})
                }
            )
            db.add(payment_db_record)
            if result["status"] == "success":
                order.payment_status = "completed"
                order.status = "confirmed" if order.status == "pending" else order.status
            
            await audit_service.create_audit_log(
                event_type=audit_event_type, event_status=event_status_for_log,
                action_performed=f"Payment processing by {result['provider']} completed with status: {result['status']}.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                resource_type="Payment", resource_id=str(payment_db_record.id), # ID after flush
                details={
                    "order_id": payment_data_req.order_id, "provider": result["provider"],
                    "transaction_id": result["transaction_id"], "amount": payment_data_req.amount,
                    "provider_status": result["status"]
                },
                commit=False
            )
            db.commit()
            db.refresh(payment_db_record)
            if result["status"] == "success": db.refresh(order)

            return APIResponseHelper.success(
                message=f"Payment processed successfully with {result['provider']}",
                data={
                    "payment_id": str(payment_db_record.id), "provider": result["provider"],
                    "transaction_id": result["transaction_id"], "amount": payment_data_req.amount,
                    "fee": result["fee"] / 100, "net_amount": result["net_amount"] / 100,
                    "status": result["status"]
                }
            )
        else: # Payment failed as per provider result
            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
                action_performed=f"Payment processing failed by provider: {result.get('provider', 'N/A')}.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                resource_type="Order", resource_id=str(order.id),
                details={
                    "order_id": payment_data_req.order_id, "provider": result.get('provider', 'N/A'),
                    "error": result.get("error", "Unknown provider error"), "amount": payment_data_req.amount
                },
                commit=True # Commit this failure log as main transaction won't proceed
            )
            return APIResponseHelper.error(
                message=result.get("error", "Payment failed"),
                error_code="PAYMENT_FAILED",
                data={"provider": result["provider"]}
            )

    except Exception as e:
        logger.error(f"Payment processing error: {str(e)}", exc_info=True)
        # General exception, payment_db_record might not exist or be in session
        # Log this as a failure. If part of a transaction that rolls back, this log might too unless committed.
        # For robustness, attempt to log critical failures independently if possible.
        details_for_error_log = {
            "order_id": payment_data_req.order_id, "amount": payment_data_req.amount,
            "error": str(e), "error_type": e.__class__.__name__
        }
        if payment_db_record and payment_db_record.id: # If payment record was created and flushed
            details_for_error_log["payment_id_attempted"] = str(payment_db_record.id)

        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE,
            event_status=AuditEventStatus.FAILURE,
            action_performed="Payment processing failed due to server error.",
            user_id=current_user.id, username_or_email=current_user.email,
            ip_address=ip_address, user_agent=user_agent,
            resource_type="Order", resource_id=str(payment_data_req.order_id),
            details=details_for_error_log,
            commit=True # Attempt to commit this log even if outer transaction (if any) rolls back
        )
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refund/{transaction_id}")
async def refund_payment(
    transaction_id: str,
    refund_data_req: RefundRequest, # Renamed from refund_data
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Refund a payment"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    payment_db_record = db.query(Payment).filter(Payment.external_id == transaction_id).first()
    if not payment_db_record:
        await audit_service.create_audit_log(
            event_type=AuditEventType.REFUND_FAILURE, event_status=AuditEventStatus.FAILURE,
            action_performed="Refund attempt failed: Original payment not found.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            details={"external_transaction_id": transaction_id, "reason": "Payment not found"},
            commit=True
        )
        raise HTTPException(status_code=404, detail="Payment not found")

    provider_name_from_meta = payment_db_record.payment_metadata.get("provider", payment_db_record.payment_method)
    # Ensure provider_name is a string, e.g. if payment_method was 'stripe_payment'
    provider_name = provider_name_from_meta.lower().replace("_payment","") if isinstance(provider_name_from_meta, str) else "unknown"

    provider_instance = payment_factory.get_provider(provider_name)
    if not provider_instance:
        await audit_service.create_audit_log(
            event_type=AuditEventType.REFUND_FAILURE, event_status=AuditEventStatus.FAILURE,
            action_performed=f"Refund attempt failed: Provider '{provider_name}' not available/found.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            resource_type="Payment", resource_id=str(payment_db_record.id),
            details={"external_transaction_id": transaction_id, "provider_name_attempted": provider_name},
            commit=True
        )
        raise HTTPException(status_code=400, detail=f"Provider {provider_name} not available for refund")

    await audit_service.create_audit_log(
        event_type=AuditEventType.REFUND_INITIATED,
        event_status=AuditEventStatus.PENDING,
        action_performed=f"Refund initiated with provider: {provider_instance.name}.",
        user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
        resource_type="Payment", resource_id=str(payment_db_record.id),
        details={
            "external_transaction_id": transaction_id,
            "amount_requested": refund_data_req.amount,
            "reason": refund_data_req.reason,
            "provider": provider_instance.name
        },
        commit=False # Commit with refund update or if error
    )
    
    try:
        result = await provider_instance.refund_payment(
            transaction_id=payment_db_record.external_id, # Use external_id from the fetched payment
            amount=Decimal(str(refund_data_req.amount)) if refund_data_req.amount is not None else None,
            reason=refund_data_req.reason
        )
    except Exception as e: # Catch errors from provider refund call
        await audit_service.create_audit_log(
            event_type=AuditEventType.REFUND_FAILURE, event_status=AuditEventStatus.FAILURE,
            action_performed=f"Refund processing by {provider_instance.name} failed with exception.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            resource_type="Payment", resource_id=str(payment_db_record.id),
            details={"external_transaction_id": transaction_id, "error": str(e)},
            commit=True # Commit this failure log
        )
        raise HTTPException(status_code=500, detail=f"Refund processing error: {str(e)}")


    if result["status"] == "refunded":
        payment_db_record.status = "refunded" # Update local payment status
        payment_db_record.payment_metadata.update({
            "refund_id": result.get("refund_id"),
            "refunded_amount": result.get("amount", 0) / 100, # Assuming result amount is in pence/cents
            "refund_reason": refund_data_req.reason,
            "refunded_at": datetime.utcnow().isoformat()
        })
        
        await audit_service.create_audit_log(
            event_type=AuditEventType.REFUND_SUCCESS, event_status=AuditEventStatus.SUCCESS,
            action_performed=f"Refund by {provider_instance.name} succeeded.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            resource_type="Payment", resource_id=str(payment_db_record.id),
            details={
                "external_transaction_id": transaction_id, "refund_id": result.get("refund_id"),
                "amount_refunded": result.get("amount", 0) / 100
            },
            commit=False
        )
        db.commit() # Commit payment status update and audit log
        db.refresh(payment_db_record)
        
        return APIResponseHelper.success(
            message="Refund processed successfully",
            data={
                "refund_id": result.get("refund_id"),
                "amount": result.get("amount", 0) / 100,
                "status": "refunded"
            }
        )
    else: # Refund failed as per provider result
        await audit_service.create_audit_log(
            event_type=AuditEventType.REFUND_FAILURE, event_status=AuditEventStatus.FAILURE,
            action_performed=f"Refund by {provider_instance.name} failed.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            resource_type="Payment", resource_id=str(payment_db_record.id),
            details={
                "external_transaction_id": transaction_id,
                "error": result.get("error", "Unknown provider error"),
                "provider_status": result.get("status")
            },
            commit=True
        )
        return APIResponseHelper.error(
            message=result.get("error", "Refund failed"),
            error_code="REFUND_FAILED",
            data={"provider_refund_status": result.get("status")}
        )

@router.get("/providers")
async def get_available_providers(
    current_user: User = Depends(get_current_user)
):
    """Get list of available payment providers and their costs"""
    providers = payment_factory.get_available_providers()
    
    # Calculate sample costs for common amounts
    sample_amounts = [Decimal("10"), Decimal("50"), Decimal("100")]
    monthly_volume = Decimal("2000")  # Default monthly volume
    
    provider_info = []
    for provider_name in providers:
        provider = payment_factory.get_provider(provider_name)
        info = {
            "name": provider_name,
            "display_name": provider_name.title(),
            "sample_fees": {},
            "recommended": False
        }
        
        for amount in sample_amounts:
            fee = provider.calculate_fee(amount)
            info["sample_fees"][f"£{amount}"] = f"£{fee:.2f}"
        
        # Add provider-specific information
        if provider_name == "sumup" and monthly_volume >= Decimal("2714"):
            info["monthly_fee"] = "£19.00"
            info["rate"] = "0.69%"
            info["recommended"] = True
        elif provider_name == "sumup":
            info["rate"] = "1.69%"
        elif provider_name == "stripe":
            info["rate"] = "1.4% + 20p"
            if monthly_volume < Decimal("2714") and monthly_volume >= Decimal("1000"):
                info["recommended"] = True
        elif provider_name == "square":
            info["rate"] = "1.75%"
            if monthly_volume < Decimal("1000"):
                info["recommended"] = True
        
        provider_info.append(info)
    
    # Sort by recommended first
    provider_info.sort(key=lambda x: not x["recommended"])
    
    # Get smart routing recommendations if restaurant provided
    routing_recommendations = []
    if restaurant_id:
        try:
            recommendations = await payment_factory.get_routing_recommendations(
                restaurant_id=restaurant_id,
                db_session=db
            )
            if recommendations and 'routing_recommendations' in recommendations:
                routing_recommendations = recommendations['routing_recommendations']
        except Exception as e:
            logger.warning(f"Failed to get routing recommendations: {e}")
    
    # Sort by recommended first
    provider_info.sort(key=lambda x: not x["recommended"])
    
    return APIResponseHelper.success(
        data={
            "providers": provider_info,
            "monthly_volume": float(monthly_volume),
            "optimal_provider": provider_info[0]["name"] if provider_info else None,
            "smart_recommendations": routing_recommendations
        },
        message="Retrieved available payment providers with smart recommendations"
    )