"""
Payment processing endpoints for Fynlo POS
Supports multi-provider payments (Stripe, Square, SumUp), QR payments, and cash
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
import qrcode
import io
import base64
import stripe
import logging

from app.core.database import get_db, Payment, QRPayment, Order, User
from app.core.config import settings
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, InventoryException, PaymentException, ResourceNotFoundException, ValidationException, BusinessLogicException
from app.core.transaction_manager import transactional
from app.core.tenant_security import TenantSecurity
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
        border=4)
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='PNG')
    img_str = base64.b64encode(img_buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

# Rate limited: 5 requests per minute per IP
@router.post("/qr/generate", response_model=QRPaymentResponse)
@limiter.limit(PAYMENT_RATE)
async def generate_qr_payment(
    payment_request: QRPaymentRequest, # Renamed from 'request' to avoid conflict
    request: Request, # Added for rate limiter
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate QR code for payment with 1.2% fee advantage"""
    # Validate restaurant access for multi-tenant
    await TenantSecurity.validate_restaurant_access(
        current_user, current_restaurant_id or current_user.restaurant_id, db=db
    )
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    # Verify order exists and belongs to the restaurant
    order = db.query(Order).filter(
        Order.id == payment_request.order_id,
        Order.restaurant_id == restaurant_id
    ).first()
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
        raise ResourceNotFoundException(resource="Order", resource_id=payment_request_data.order_id)    
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
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Confirm QR payment completion"""
    # Validate restaurant access for multi-tenant
    await TenantSecurity.validate_restaurant_access(
        current_user, current_restaurant_id or current_user.restaurant_id, db=db
    )
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
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
        raise ResourceNotFoundException(resource="QR payment", resource_id=qr_payment_id)    
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
        raise ValidationException(message="QR payment expired", field="qr_payment_id")    
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
        raise ValidationException(message="QR payment already processed")    
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
        raise ValidationException(message=f"Cannot confirm QR payment with status: {qr_payment_db_record.status}")
    
    # Get order for validation and ensure it belongs to the restaurant
    order = db.query(Order).filter(
        Order.id == qr_payment_db_record.order_id,
        Order.restaurant_id == restaurant_id
    ).first()
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
        raise ResourceNotFoundException(resource="Associated order", resource_id=qr_payment_db_record.order_id)    
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
        raise ValidationException(message="Order already paid")
    
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
        raise FynloException(message="Payment confirmation failed")    
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
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Process Stripe payment"""
    # Validate restaurant access for multi-tenant
    await TenantSecurity.validate_restaurant_access(
        current_user, current_restaurant_id or current_user.restaurant_id, db=db
    )
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    # Verify order exists and belongs to the restaurant
    order = db.query(Order).filter(
        Order.id == payment_request_data.order_id,
        Order.restaurant_id == restaurant_id
    ).first()
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
        raise ResourceNotFoundException(resource="Order", resource_id=payment_request_data.order_id)
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
        raise ValidationException(message="Order already paid")

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
                "restaurant_id": str(restaurant_id)
            },
            confirmation_method='manual',
            confirm=True)

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
        raise ValidationException(message="An error occurred processing the request")
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
        raise FynloException(message="Payment processing failed")
@router.post("/cash", response_model=PaymentResponse)
async def process_cash_payment(
    payment_request_data: CashPaymentRequest, # Renamed from 'request'
    request: Request,
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Process cash payment"""
    # Validate restaurant access for multi-tenant
    await TenantSecurity.validate_restaurant_access(
        current_user, current_restaurant_id or current_user.restaurant_id, db=db
    )
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    order = db.query(Order).filter(
        Order.id == payment_request_data.order_id,
        Order.restaurant_id == restaurant_id
    ).first()
    if not order:
        # No audit log here as it's a basic validation, not a payment process failure yet.
        raise ResourceNotFoundException(resource="Order", resource_id=payment_request_data.order_id)
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
         raise ValidationException(message="Order already paid")

    if payment_request_data.received_amount < payment_request_data.amount:
        # Log this specific failure if desired, though it's a validation error.
        # For now, let the HTTP exception handle it.
        raise ValidationException(message="Insufficient cash received")    
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
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all payments for an order"""
    # Validate restaurant access for multi-tenant
    await TenantSecurity.validate_restaurant_access(
        current_user, current_restaurant_id or current_user.restaurant_id, db=db
    )
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    # Verify order belongs to the restaurant
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.restaurant_id == restaurant_id
    ).first()
    if not order:
        raise ResourceNotFoundException(resource="Order", resource_id=order_id)    
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
        raise ResourceNotFoundException(resource="QR payment", resource_id=qr_payment_id)    
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
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
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
        # Validate restaurant access for multi-tenant
        await TenantSecurity.validate_restaurant_access(
            current_user, current_restaurant_id or current_user.restaurant_id, db=db
        )
        restaurant_id = current_restaurant_id or current_user.restaurant_id
        
        order = db.query(Order).filter(
            Order.id == payment_data_req.order_id,
            Order.restaurant_id == restaurant_id
        ).first()
        if not order:
            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
                action_performed="Payment processing failed: Order not found.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                details={"order_id": payment_data_req.order_id, "amount": payment_data_req.amount, "reason": "Order not found"},
                commit=True
            )
            raise ResourceNotFoundException(resource="Order", resource_id=payment_data_req.order_id)
        if order.payment_status == "completed":
            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO,
                action_performed="Payment processing attempt failed: Order already paid.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                resource_type="Order", resource_id=str(order.id), details={"reason": "Order already marked as paid."},
                commit=True
            )
            raise ValidationException(message="Order already paid")

        monthly_volume = Decimal("2000")
        provider_instance = await payment_factory.select_optimal_provider(
            amount=Decimal(str(payment_data_req.amount)),
            restaurant_id=str(restaurant_id),
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
                "restaurant_id": str(restaurant_id),
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
        raise FynloException(message="An error occurred processing the request", status_code=500)

@router.post("/refund/{transaction_id}")
async def refund_payment(
    transaction_id: str,
    refund_data_req: RefundRequest, # Renamed from refund_data
    request: Request,
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Refund a payment"""
    # Validate restaurant access for multi-tenant
    await TenantSecurity.validate_restaurant_access(
        current_user, current_restaurant_id or current_user.restaurant_id, db=db
    )
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    # Ensure payment belongs to the restaurant
    payment_db_record = db.query(Payment).join(Order).filter(
        Payment.external_id == transaction_id,
        Order.restaurant_id == restaurant_id
    ).first()
    if not payment_db_record:
        await audit_service.create_audit_log(
            event_type=AuditEventType.REFUND_FAILURE, event_status=AuditEventStatus.FAILURE,
            action_performed="Refund attempt failed: Original payment not found.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            details={"external_transaction_id": transaction_id, "reason": "Payment not found"},
            commit=True
        )
        raise ResourceNotFoundException(resource="Payment", resource_id=payment_id)
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
        raise ValidationException(message=f"Provider {provider_name} not available for refund")

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
        raise FynloException(message="An error occurred processing the request", status_code=500)


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
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of available payment providers and their costs"""
    # Validate restaurant access for multi-tenant
    await TenantSecurity.validate_restaurant_access(
        current_user, current_restaurant_id or current_user.restaurant_id, db=db
    )
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    providers = payment_factory.get_available_providers()
    
    # Calculate sample costs for common amounts
    sample_amounts = [Decimal("10"), Decimal("50"), Decimal("100")]
    monthly_volume = Decimal("2000")  # Default monthly volume
    # Assuming db is available in this scope, if not, it needs to be passed or accessed.
    # For get_available_providers, db might not be directly needed unless provider loading itself needs it.
    # restaurant_id is also not defined in this scope. This was likely from a previous version.
    # I will remove the restaurant_id specific logic for now from this generic endpoint.
    
    provider_info_list = []
    for provider_name in providers:
        provider = payment_factory.get_provider(provider_name) # This might need to be async if provider init is async
        info = {
            "name": provider_name,
            "display_name": provider_name.title(),
            "sample_fees": {},
            "recommended": False # Simplified recommendation logic
        }
        
        for amount in sample_amounts:
            # Assuming calculate_fee is synchronous. If it's async, this loop needs `await`.
            fee = provider.calculate_fee(amount)
            info["sample_fees"][f"£{amount}"] = f"£{fee:.2f}"
        
        # Simplified provider-specific information
        if provider_name == "sumup": info["rate"] = "1.69% (standard)" # Example rate
        elif provider_name == "stripe": info["rate"] = "1.4% + 20p (UK cards)" # Example rate
        elif provider_name == "square": info["rate"] = "1.75%" # Example rate
        
        provider_info_list.append(info)
    
    # Simplified sorting or recommendation
    # For example, recommend the first one or based on a simple metric if available
    if provider_info_list:
        provider_info_list[0]["recommended"] = True # Example: recommend the first listed
    
    return APIResponseHelper.success(
        data={
            "providers": provider_info_list,
            "monthly_volume_assumption": float(monthly_volume), # Clarify this is an assumption
            "optimal_provider_example": provider_info_list[0]["name"] if provider_info_list else None,
        },
        message="Retrieved available payment providers."
    )

# --- Square Specific Endpoints ---

class SquareCreatePaymentRequest(BaseModel):
    amount: float # Amount in major currency unit (e.g., GBP)
    currency: str = "GBP"
    source_id: str # The Square payment source ID (e.g., card nonce)
    order_id: Optional[str] = None
    customer_id: Optional[str] = None
    note: Optional[str] = None
    metadata: Optional[dict] = None

class SquareProcessPaymentRequest(BaseModel):
    payment_id: str # The Square Payment ID from the create_payment step
    order_id: Optional[str] = None # Optional: if completing a payment for a specific order

class SquarePaymentResponseData(BaseModel):
    payment_id: Optional[str] = None # Our internal DB payment ID
    provider: str
    transaction_id: Optional[str] = None # Square's transaction ID
    status: str # e.g., SUCCESS, PENDING, FAILED (from PaymentStatus enum)
    amount: Optional[float] = None
    currency: Optional[str] = None
    fee: Optional[float] = None
    net_amount: Optional[float] = None
    message: Optional[str] = None
    raw_response: Optional[dict] = None # Full provider response

@router.post("/square/create", response_model=SquarePaymentResponseData, tags=["Payments - Square"])
async def square_create_payment_endpoint(
    http_request: Request,
    payment_create_req: SquareCreatePaymentRequest,
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a Square payment. If auto_complete is true, this attempts to finalize the payment."""
    # Validate restaurant access for multi-tenant
    await TenantSecurity.validate_restaurant_access(
        current_user, current_restaurant_id or current_user.restaurant_id, db=db
    )
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    audit_service = AuditLoggerService(db)
    ip_address = http_request.client.host if http_request.client else "unknown"
    user_agent = http_request.headers.get("user-agent", "unknown")

    try:
        square_provider = await payment_factory.get_provider_instance("square", db_session=db)
        if not square_provider:
            raise ServiceUnavailableError(message="Square provider not available.")

        # Validate order if order_id is provided
        order = None
        if payment_create_req.order_id:
            order = db.query(Order).filter(
                Order.id == payment_create_req.order_id,
                Order.restaurant_id == restaurant_id
            ).first()
            if not order:
                # Log and raise error if order_id is given but order not found
                await audit_service.create_audit_log(
                    event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
                    action_performed="Square payment creation failed: Order not found.",
                    user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                    details={"order_id": payment_create_req.order_id, "reason": "Order not found"}, commit=True)
                raise ResourceNotFoundException(message=f"Order {payment_create_req.order_id} not found.")
            if order.payment_status == "completed":
                await audit_service.create_audit_log(
                    event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO,
                    action_performed="Square payment creation attempt: Order already paid.",
                    user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                    resource_type="Order", resource_id=str(order.id), details={"reason": "Order already marked as paid."}, commit=True)
                raise ValidationException(message="Order already paid.")

        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_INITIATED, event_status=AuditEventStatus.PENDING,
            action_performed="Square payment creation initiated.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            details={**payment_create_req.model_dump(), "provider": "square"}, commit=False) # Commit with payment record

        provider_response = await square_provider.create_payment(
            amount=Decimal(str(payment_create_req.amount)),
            currency=payment_create_req.currency,
            source_id=payment_create_req.source_id,
            customer_id=payment_create_req.customer_id,
            order_id=payment_create_req.order_id, # Pass our order_id to be Square's order_id if applicable
            note=payment_create_req.note,
            metadata=payment_create_req.metadata
        )

        internal_payment_id = None
        if provider_response.get("status") in [PaymentStatus.SUCCESS.value, PaymentStatus.PENDING.value] and provider_response.get("transaction_id"):
            # Create Payment record in our DB
            payment_db = Payment(
                order_id=payment_create_req.order_id if order else None,
                payment_method="square_card", # Or more specific if known
                provider="square",
                amount=Decimal(str(payment_create_req.amount)),
                # Assuming provider_response.fee is in minor units (cents/pence)
                fee_amount= (Decimal(str(provider_response.get("fee", 0))) / 100) if provider_response.get("fee") is not None else square_provider.calculate_fee(Decimal(str(payment_create_req.amount))),
                provider_fee= (Decimal(str(provider_response.get("fee", 0))) / 100) if provider_response.get("fee") is not None else square_provider.calculate_fee(Decimal(str(payment_create_req.amount))),
                # Assuming provider_response.net_amount is in minor units
                net_amount= (Decimal(str(provider_response.get("net_amount", 0))) / 100) if provider_response.get("net_amount") is not None else (Decimal(str(payment_create_req.amount)) - square_provider.calculate_fee(Decimal(str(payment_create_req.amount)))),
                status=provider_response["status"],
                external_id=provider_response["transaction_id"],
                processed_at=datetime.utcnow() if provider_response["status"] == PaymentStatus.SUCCESS.value else None,
                payment_metadata={
                    "provider_response": provider_response.get("raw_response", {}),
                    "source_id": payment_create_req.source_id,
                    "customer_id": payment_create_req.customer_id,
                    **(payment_create_req.metadata or {})
                }
            )
            db.add(payment_db)
            if order and provider_response["status"] == PaymentStatus.SUCCESS.value:
                order.payment_status = "completed"
                order.status = "confirmed" if order.status == "pending" else order.status

            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_SUCCESS if provider_response["status"] == PaymentStatus.SUCCESS.value else AuditEventType.PAYMENT_PENDING,
                event_status=AuditEventStatus.SUCCESS if provider_response["status"] == PaymentStatus.SUCCESS.value else AuditEventStatus.PENDING,
                action_performed=f"Square payment status: {provider_response['status']}.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                resource_type="Payment", resource_id=str(payment_db.id), # ID after flush
                details={"external_id": provider_response["transaction_id"], "provider_status": provider_response.get("raw_response", {}).get("payment", {}).get("status")},
                commit=True) # Commit audit and payment together
            db.commit()
            db.refresh(payment_db)
            internal_payment_id = str(payment_db.id)
        else: # Payment failed at provider level
            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
                action_performed="Square payment creation failed by provider.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                details={"error": provider_response.get("error", "Unknown"), "provider_response": provider_response.get("raw_response")}, commit=True)
            # db.commit() # Commit only audit log for failure
            raise BusinessLogicException(message=provider_response.get("error", "Square payment creation failed"))

        return SquarePaymentResponseData(
            payment_id=internal_payment_id,
            provider="square",
            transaction_id=provider_response.get("transaction_id"),
            status=provider_response["status"],
            amount=float(provider_response.get("amount", payment_create_req.amount)), # Amount in major units
            currency=provider_response.get("currency", payment_create_req.currency),
            fee=float(Decimal(str(provider_response.get("fee", 0))) / 100) if provider_response.get("fee") is not None else None,
            net_amount=float(Decimal(str(provider_response.get("net_amount", 0))) / 100) if provider_response.get("net_amount") is not None else None,
            message=provider_response.get("message", "Payment processed by Square."),
            raw_response=provider_response.get("raw_response")
        )

    except FynloException:
        raise # Re-raise FynloException to preserve status code and detail
    except Exception as e:
        logger.error(f"Square payment creation error: {str(e)}", exc_info=True)
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
            action_performed="Square payment creation failed due to server error.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            details={"error": str(e)}, commit=True)
        # db.commit() # Commit audit log
        raise PaymentException(message=str(e))


@router.post("/square/process", response_model=SquarePaymentResponseData, tags=["Payments - Square"])
async def square_process_payment_endpoint(
    http_request: Request,
    payment_process_req: SquareProcessPaymentRequest,
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Process (complete) a Square payment that was created with auto_complete=false."""
    # Validate restaurant access for multi-tenant
    await TenantSecurity.validate_restaurant_access(
        current_user, current_restaurant_id or current_user.restaurant_id, db=db
    )
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    audit_service = AuditLoggerService(db)
    ip_address = http_request.client.host if http_request.client else "unknown"
    user_agent = http_request.headers.get("user-agent", "unknown")

    try:
        square_provider = await payment_factory.get_provider_instance("square", db_session=db)
        if not square_provider:
            raise ServiceUnavailableError(message="Square provider not available.")

        # Find the original payment record in our DB by external_id (Square Payment ID)
        # Ensure it belongs to the restaurant
        payment_db = db.query(Payment).join(Order).filter(
            Payment.external_id == payment_process_req.payment_id,
            Payment.provider == "square",
            Order.restaurant_id == restaurant_id
        ).first()
        if not payment_db:
            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
                action_performed="Square payment process failed: Original payment record not found.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                details={"external_payment_id": payment_process_req.payment_id}, commit=True)
            raise ResourceNotFoundException(message=f"Payment with Square ID {payment_process_req.payment_id} not found in local records.")

        if payment_db.status == PaymentStatus.SUCCESS.value: # Already completed
             await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_INFO, event_status=AuditEventStatus.INFO,
                action_performed="Square payment process attempt: Payment already completed.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                resource_type="Payment", resource_id=str(payment_db.id), details={"external_id": payment_process_req.payment_id}, commit=True)
             # Still, let's fetch the latest status from Square and return it.
             # This path could be enhanced to just call get_payment_status.

        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_PROCESSING, event_status=AuditEventStatus.PENDING, # Using a distinct type
            action_performed="Square payment completion (process) initiated.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            resource_type="Payment", resource_id=str(payment_db.id),
            details={"external_payment_id": payment_process_req.payment_id, "order_id_param": payment_process_req.order_id},
            commit=False) # Commit with payment update

        provider_response = await square_provider.process_payment(
            payment_id=payment_process_req.payment_id,
            order_id=payment_process_req.order_id # Pass along if provider uses it
        )

        current_provider_status = provider_response.get("status")
        payment_db.status = current_provider_status
        payment_db.payment_metadata = {**payment_db.payment_metadata, "process_response": provider_response.get("raw_response")}

        if current_provider_status == PaymentStatus.SUCCESS.value:
            payment_db.processed_at = datetime.utcnow()
            if payment_db.order_id:
                order = db.query(Order).filter(Order.id == payment_db.order_id).first()
                if order:
                    order.payment_status = "completed"
                    order.status = "confirmed" if order.status == "pending" else order.status

            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_SUCCESS, event_status=AuditEventStatus.SUCCESS,
                action_performed="Square payment processed/completed successfully.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                resource_type="Payment", resource_id=str(payment_db.id),
                details={"external_id": payment_process_req.payment_id, "final_status": current_provider_status}, commit=True)
        else: # Failed or still pending
            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
                action_performed=f"Square payment process resulted in status: {current_provider_status}.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                resource_type="Payment", resource_id=str(payment_db.id),
                details={"external_id": payment_process_req.payment_id, "error": provider_response.get("error"), "final_status": current_provider_status}, commit=True)

        db.commit()
        db.refresh(payment_db)

        return SquarePaymentResponseData(
            payment_id=str(payment_db.id),
            provider="square",
            transaction_id=provider_response.get("transaction_id", payment_process_req.payment_id),
            status=current_provider_status,
            amount=float(provider_response.get("amount", payment_db.amount)),
            currency=provider_response.get("currency", payment_db.payment_metadata.get("currency", "GBP")),
            fee=float(Decimal(str(provider_response.get("fee", 0))) / 100) if provider_response.get("fee") is not None else None,
            net_amount=float(Decimal(str(provider_response.get("net_amount", 0))) / 100) if provider_response.get("net_amount") is not None else None,
            message=provider_response.get("message", f"Square payment processed. Status: {current_provider_status}"),
            raw_response=provider_response.get("raw_response")
        )

    except FynloException:
        raise
    except Exception as e:
        logger.error(f"Square payment processing error: {str(e)}", exc_info=True)
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
            action_performed="Square payment processing failed due to server error.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            details={"external_payment_id": payment_process_req.payment_id, "error": str(e)}, commit=True)
        raise PaymentException(message=str(e))


@router.get("/square/status/{payment_id}", response_model=SquarePaymentResponseData, tags=["Payments - Square"])
async def square_get_payment_status_endpoint(
    http_request: Request,
    payment_id: str, # This is the Square Payment ID (external_id)
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the status of a Square payment by its Square Payment ID."""
    # Validate restaurant access for multi-tenant
    await TenantSecurity.validate_restaurant_access(
        current_user, current_restaurant_id or current_user.restaurant_id, db=db
    )
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    audit_service = AuditLoggerService(db)
    ip_address = http_request.client.host if http_request.client else "unknown"
    user_agent = http_request.headers.get("user-agent", "unknown")

    try:
        square_provider = await payment_factory.get_provider_instance("square", db_session=db)
        if not square_provider:
            raise ServiceUnavailableError(message="Square provider not available.")

        # Optional: Log audit for status check initiation
        # await audit_service.create_audit_log(...)

        provider_response = await square_provider.get_payment_status(payment_id=payment_id)

        # Optional: Update local DB record if status has changed and we want to sync
        # payment_db = db.query(Payment).filter(Payment.external_id == payment_id, Payment.provider == "square").first()
        # if payment_db and payment_db.status != provider_response.get("status"):
        #     payment_db.status = provider_response.get("status")
        #     payment_db.payment_metadata = {**payment_db.payment_metadata, "status_check_response": provider_response.get("raw_response")}
        #     db.commit()
        #     db.refresh(payment_db)
        #     internal_payment_id = str(payment_db.id)
        # else:
        #     internal_payment_id = str(payment_db.id) if payment_db else None


        if provider_response.get("status") == PaymentStatus.FAILED.value and "Failed to retrieve payment status" in provider_response.get("error",""):
             # This specific error from provider.get_payment_status implies the ID might not exist with Square
            await audit_service.create_audit_log(
                event_type=AuditEventType.PAYMENT_INFO, event_status=AuditEventStatus.FAILURE, # Using INFO as it's a status check
                action_performed="Square payment status check: Payment not found by provider.",
                user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
                details={"external_payment_id": payment_id, "error": provider_response.get("error")}, commit=True)
            raise ResourceNotFoundException(message=f"Square payment with ID {payment_id} not found by provider.")

        return SquarePaymentResponseData(
            # payment_id=internal_payment_id, # Our internal ID, if fetched
            provider="square",
            transaction_id=provider_response.get("transaction_id", payment_id),
            status=provider_response["status"],
            amount=float(provider_response.get("amount", 0)), # Amount in major units
            currency=provider_response.get("currency", "GBP"),
            fee=float(Decimal(str(provider_response.get("fee", 0))) / 100) if provider_response.get("fee") is not None else None,
            net_amount=float(Decimal(str(provider_response.get("net_amount", 0))) / 100) if provider_response.get("net_amount") is not None else None,
            message=provider_response.get("message", f"Square payment status: {provider_response['status']}"),
            raw_response=provider_response.get("raw_response")
        )
    except FynloException:
        raise
    except Exception as e:
        logger.error(f"Square payment status retrieval error: {str(e)}", exc_info=True)
        await audit_service.create_audit_log(
            event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
            action_performed="Square payment status retrieval failed due to server error.",
            user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent,
            details={"external_payment_id": payment_id, "error": str(e)}, commit=True)
        raise PaymentException(message=str(e))

# --- Stripe Webhook Endpoint ---

@router.post("/webhooks/stripe", include_in_schema=False) # include_in_schema=False as it's not for direct client calls
async def stripe_webhook_endpoint(
    http_request: Request, # Renamed from request to avoid conflict with fastapi.Request
    db: Session = Depends(get_db) # Added db session dependency
):
    """Handle incoming webhooks from Stripe."""
    payload = await http_request.body()
    sig_header = http_request.headers.get('stripe-signature')
    audit_service = AuditLoggerService(db) # Initialize AuditLoggerService
    ip_address = http_request.client.host if http_request.client else "unknown"
    user_agent = http_request.headers.get("user-agent", "unknown") # Though less relevant for webhooks

    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.error("Stripe webhook secret is not configured.")
        # Audit this critical configuration error
        # Using a generic user_id/email for system-level audit if no specific user context
        await audit_service.create_audit_log(
            event_type=AuditEventType.SYSTEM_ERROR, event_status=AuditEventStatus.FAILURE,
            action_performed="Stripe webhook processing failed: Missing webhook secret.",
            user_id="SYSTEM", username_or_email="system@fynlo.com",
            ip_address=ip_address, user_agent="Stripe Webhook",
            details={"reason": "STRIPE_WEBHOOK_SECRET not set in environment."},
            commit=True
        )
        raise FynloException(message="Webhook secret not configured.")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e: # Invalid payload
        logger.error(f"Stripe webhook error: Invalid payload. {str(e)}")
        await audit_service.create_audit_log(
            event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.FAILURE,
            action_performed="Stripe webhook processing failed: Invalid payload.",
            user_id="SYSTEM", username_or_email="system@fynlo.com", ip_address=ip_address,
            details={"error": str(e), "payload_start": payload[:200].decode('utf-8', errors='replace')}, commit=True
        )
        raise ValidationException(message="Invalid payload")
    except stripe.error.SignatureVerificationError as e: # Invalid signature
        logger.error(f"Stripe webhook error: Invalid signature. {str(e)}")
        await audit_service.create_audit_log(
            event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.FAILURE,
            action_performed="Stripe webhook processing failed: Invalid signature.",
            user_id="SYSTEM", username_or_email="system@fynlo.com", ip_address=ip_address,
            details={"error": str(e), "signature_header": sig_header}, commit=True
        )
        raise ValidationException(message="Invalid signature")
    except Exception as e: # Other construction errors
        logger.error(f"Stripe webhook event construction error: {str(e)}")
        await audit_service.create_audit_log(
            event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.FAILURE,
            action_performed="Stripe webhook processing failed: Event construction error.",
            user_id="SYSTEM", username_or_email="system@fynlo.com", ip_address=ip_address,
            details={"error": str(e)}, commit=True
        )
        raise FynloException(message="Webhook event construction error")

    # At this point, event is trusted.
    logger.info(f"Received Stripe event: id={event.id}, type={event.type}")
    await audit_service.create_audit_log(
        event_type=AuditEventType.WEBHOOK_RECEIVED, event_status=AuditEventStatus.SUCCESS,
        action_performed=f"Stripe webhook event received: {event.type}",
        user_id="SYSTEM", username_or_email="stripe_webhook@fynlo.com", ip_address=ip_address,
        resource_type="StripeEvent", resource_id=event.id,
        details={"event_type": event.type, "event_id": event.id, "livemode": event.livemode},
        commit=True # Commit this log immediately
    )

    # Handle the event
        # For example:
    # processed_event = db.query(ProcessedWebhookEvent).filter(ProcessedWebhookEvent.event_id == event.id).first()
    # if processed_event:
    #     logger.info(f"Stripe event {event.id} already processed.")
    #     return {"status": "event already processed"}
    # else:
    #     db.add(ProcessedWebhookEvent(event_id=event.id, processed_at=datetime.utcnow()))
    #     # db.commit() // Commit within the specific handler or at the end

    try:
        if event.type == 'payment_intent.succeeded':
            payment_intent = event.data.object
            logger.info(f"PaymentIntent {payment_intent.id} succeeded.")
            payment = db.query(Payment).filter(Payment.external_id == payment_intent.id, Payment.provider == "stripe").first()
            if payment:
                if payment.status != PaymentStatus.SUCCESS.value: # Avoid reprocessing if already success
                    payment.status = PaymentStatus.SUCCESS.value
                    payment.processed_at = datetime.utcnow()
                    payment.payment_metadata = {**payment.payment_metadata, "webhook_succeeded_event": event.to_dict_recursive()}

                    if payment.order_id:
                        order = db.query(Order).filter(Order.id == payment.order_id).first()
                        if order:
                            order.payment_status = "completed"
                            order.status = "confirmed" if order.status == "pending" else order.status

                    await audit_service.create_audit_log(
                        event_type=AuditEventType.PAYMENT_SUCCESS, event_status=AuditEventStatus.SUCCESS,
                        action_performed="Stripe PaymentIntent succeeded (webhook).",
                        resource_type="Payment", resource_id=str(payment.id),
                        details={"external_id": payment_intent.id, "amount": payment_intent.amount / 100}, commit=True)
                    db.commit()
                else:
                    logger.info(f"PaymentIntent {payment_intent.id} already marked as SUCCESS in DB. Webhook ignored for idempotency.")
            else:
                logger.warning(f"Received {event.type} for unknown PaymentIntent {payment_intent.id}")
                await audit_service.create_audit_log(
                    event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.WARNING,
                    action_performed=f"Stripe event {event.type} for unknown PaymentIntent.",
                    details={"external_id": payment_intent.id, "event_id": event.id}, commit=True)

        elif event.type == 'payment_intent.payment_failed':
            payment_intent = event.data.object
            logger.info(f"PaymentIntent {payment_intent.id} failed.")
            payment = db.query(Payment).filter(Payment.external_id == payment_intent.id, Payment.provider == "stripe").first()
            if payment:
                if payment.status != PaymentStatus.FAILED.value:
                    payment.status = PaymentStatus.FAILED.value
                    error_details = payment_intent.last_payment_error
                    payment.payment_metadata = {
                        **payment.payment_metadata,
                        "webhook_failed_event": event.to_dict_recursive(),
                        "failure_reason": error_details.message if error_details else "Unknown",
                        "failure_code": error_details.code if error_details else "Unknown"
                    }
                    await audit_service.create_audit_log(
                        event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE,
                        action_performed="Stripe PaymentIntent failed (webhook).",
                        resource_type="Payment", resource_id=str(payment.id),
                        details={
                            "external_id": payment_intent.id,
                            "error_message": error_details.message if error_details else "N/A",
                            "error_code": error_details.code if error_details else "N/A"
                        }, commit=True)
                    db.commit()
                else:
                    logger.info(f"PaymentIntent {payment_intent.id} already marked as FAILED in DB. Webhook ignored for idempotency.")
            else:
                logger.warning(f"Received {event.type} for unknown PaymentIntent {payment_intent.id}")
                await audit_service.create_audit_log(
                    event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.WARNING,
                    action_performed=f"Stripe event {event.type} for unknown PaymentIntent.",
                    details={"external_id": payment_intent.id, "event_id": event.id}, commit=True)

        elif event.type == 'charge.refunded':
            charge = event.data.object # This is a Charge object
            payment_intent_id = charge.payment_intent
            logger.info(f"Charge {charge.id} (for PI {payment_intent_id}) refunded.")
            payment = db.query(Payment).filter(Payment.external_id == payment_intent_id, Payment.provider == "stripe").first()
            if payment:
                # Stripe sends charge.refunded for each refund.
                # If partial refunds, amount_refunded in PI might be sum.
                # Here we mark the payment as 'refunded' or 'partially_refunded'
                # This logic might need refinement based on full vs partial refund handling strategy.
                # For simplicity, if any refund occurs, mark as 'refunded'.
                # More complex logic would check payment.amount vs charge.amount_refunded / 100
                if payment.status != PaymentStatus.REFUNDED.value: # Basic idempotency
                    payment.status = PaymentStatus.REFUNDED.value # Or a new PARTIALLY_REFUNDED status
                    payment.payment_metadata = {
                        **payment.payment_metadata,
                        f"webhook_charge_refunded_{charge.id}": event.to_dict_recursive(),
                        "refunded_amount_from_charge": charge.amount_refunded / 100
                    }
                    await audit_service.create_audit_log(
                        event_type=AuditEventType.REFUND_SUCCESS, event_status=AuditEventStatus.SUCCESS,
                        action_performed="Stripe charge refunded (webhook).",
                        resource_type="Payment", resource_id=str(payment.id),
                        details={
                            "external_id": payment_intent_id,
                            "charge_id": charge.id,
                            "refunded_amount": charge.amount_refunded / 100
                        }, commit=True)
                    db.commit()
                else:
                     logger.info(f"PaymentIntent {payment_intent_id} already marked as REFUNDED. Refund event for charge {charge.id} noted.")

            else:
                logger.warning(f"Received {event.type} for charge {charge.id} linked to unknown PaymentIntent {payment_intent_id}")
                await audit_service.create_audit_log(
                    event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.WARNING,
                    action_performed=f"Stripe event {event.type} for charge on unknown PI.",
                    details={"charge_id": charge.id, "payment_intent_id": payment_intent_id, "event_id": event.id}, commit=True)

        # Add more event handlers here as needed:
        # elif event.type == 'payment_intent.requires_action':
        # elif event.type == 'customer.subscription.deleted':
        # etc.

        else:
            logger.info(f"Received unhandled Stripe event type: {event.type}")
            await audit_service.create_audit_log(
                event_type=AuditEventType.WEBHOOK_UNHANDLED, event_status=AuditEventStatus.INFO,
                action_performed=f"Stripe webhook event type {event.type} received but not handled.",
                details={"event_id": event.id, "event_type": event.type}, commit=True)

    except Exception as e:
        logger.error(f"Error processing Stripe webhook event {event.id if 'event' in locals() else 'UNKNOWN_EVENT_ID'}: {str(e)}", exc_info=True)
        await audit_service.create_audit_log(
            event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.FAILURE,
            action_performed="Stripe webhook event processing failed with exception.",
            details={"event_id": event.id if 'event' in locals() else 'N/A', "event_type": event.type if 'event' in locals() else 'N/A', "error": str(e)},
            commit=True
        )
        # It's generally recommended to return 200 to Stripe to prevent retries for errors
        # that are unlikely to be resolved by retrying the same event (e.g., bugs in handler).
        # For transient errors (DB down), a 5xx might be appropriate to trigger retries.
        # For now, let's return 200 to acknowledge receipt and avoid excessive retries for handler bugs.
        # If a specific error should trigger retries, raise FynloException(message="An error occurred processing the request", status_code=500) here.

    return {"status": "success", "message": "Webhook received"}