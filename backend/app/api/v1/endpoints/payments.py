"""
Payment processing endpoints for Fynlo POS
Supports multi-provider payments (Stripe, Square, SumUp), QR payments, and cash
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
@transactional(max_retries=3, retry_delay=0.1)
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
    
    # Validate QR payment hasn't been processed already (prevent double processing)
    if qr_payment.status == "completed":
        raise HTTPException(status_code=400, detail="QR payment already processed")
    
    if qr_payment.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot confirm QR payment with status: {qr_payment.status}")
    
    # Get order for validation
    order = db.query(Order).filter(Order.id == qr_payment.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Associated order not found")
    
    if order.payment_status == "completed":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    try:
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
            payment_metadata={"qr_payment_id": str(qr_payment.id)}
        )
        
        db.add(payment)
        
        # Update order payment status
        order.payment_status = "completed"
        order.status = "confirmed" if order.status == "pending" else order.status
        
        # Transaction will auto-commit due to @transactional decorator
        
    except Exception as e:
        logger.error(f"QR payment confirmation failed for {qr_payment_id}: {e}")
        raise HTTPException(status_code=500, detail="Payment confirmation failed")
    
    logger.info(f"QR payment confirmed: {qr_payment_id}")
    
    return APIResponseHelper.success(
        message="QR payment confirmed successfully",
        data={"payment_id": str(payment.id)}
    )

@router.post("/stripe", response_model=PaymentResponse)
@transactional(max_retries=2, retry_delay=0.2)
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
    
    # Validate order payment status
    if order.payment_status == "completed":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    # Calculate fees
    fee_amount = calculate_payment_fee(request.amount, "card")
    net_amount = request.amount - fee_amount
    
    # Create payment record first (with pending status)
    payment = Payment(
        order_id=request.order_id,
        payment_method="stripe",
        amount=request.amount,
        fee_amount=fee_amount,
        net_amount=net_amount,
        status="pending",
        payment_metadata={"stripe_payment_method_id": request.payment_method_id}
    )
    
    db.add(payment)
    db.flush()  # Get payment ID before external API call
    
    try:
        # Create Stripe PaymentIntent
        payment_intent = stripe.PaymentIntent.create(
            amount=int(request.amount * 100),  # Stripe uses cents
            currency=request.currency,
            payment_method=request.payment_method_id,
            metadata={
                "order_id": str(request.order_id),
                "payment_id": str(payment.id),
                "restaurant_id": str(order.restaurant_id)
            },
            confirmation_method='manual',
            confirm=True,
        )
        
        # Update payment record based on Stripe response
        payment.status = "completed" if payment_intent.status == "succeeded" else "failed"
        payment.external_id = payment_intent.id
        payment.processed_at = datetime.utcnow() if payment_intent.status == "succeeded" else None
        payment.payment_metadata.update({"stripe_payment_intent": payment_intent.id})
        
        # Update order if payment successful
        if payment_intent.status == "succeeded":
            order.payment_status = "completed"
            order.status = "confirmed" if order.status == "pending" else order.status
        else:
            # Payment failed, don't update order
            logger.warning(f"Stripe payment failed for order {request.order_id}: {payment_intent.status}")
        
        # Transaction auto-commits on success
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
        # Update payment record to failed status
        payment.status = "failed"
        payment.payment_metadata.update({"stripe_error": str(e)})
        logger.error(f"Stripe payment failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Payment failed: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during Stripe payment: {e}")
        raise HTTPException(status_code=500, detail="Payment processing failed")
    
    

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
    payment_data: PaymentRequest,
    provider: Optional[str] = Query(None, description="Force specific provider"),
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
    try:
        # Verify order exists
        order = db.query(Order).filter(Order.id == payment_data.order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if order.payment_status == "completed":
            raise HTTPException(status_code=400, detail="Order already paid")
        
        # Get restaurant's monthly volume (mock for now)
        monthly_volume = Decimal("2000")  # Default £2,000/month
        
        # Select optimal provider using smart routing
        provider_instance = await payment_factory.select_optimal_provider(
            amount=Decimal(str(payment_data.amount)),
            restaurant_id=str(order.restaurant_id) if hasattr(order, 'restaurant_id') else "default",
            monthly_volume=monthly_volume,
            force_provider=provider,
            db_session=db
        )
        
        # Process payment
        result = await provider_instance.process_payment(
            amount=Decimal(str(payment_data.amount)),
            customer_id=payment_data.customer_id,
            payment_method_id=payment_data.payment_method_id,
            metadata={
                "order_id": payment_data.order_id,
                "restaurant_id": str(order.restaurant_id) if hasattr(order, 'restaurant_id') else "default",
                **(payment_data.metadata or {})
            }
        )
        
        # Save to database if successful
        if result["status"] in ["success", "pending"]:
            payment = Payment(
                order_id=payment_data.order_id,
                payment_method=f"{result['provider']}_payment",  # e.g., "stripe_payment"
                provider=result["provider"],  # New field
                amount=payment_data.amount,
                fee_amount=result["fee"] / 100,  # Convert from pence
                provider_fee=result["fee"] / 100,  # New provider-specific fee field
                net_amount=result["net_amount"] / 100,
                status=result["status"],
                external_id=result["transaction_id"],  # Existing field
                processed_at=datetime.utcnow() if result["status"] == "success" else None,
                payment_metadata={
                    "provider": result["provider"],
                    "transaction_id": result["transaction_id"],
                    "raw_response": result.get("raw_response", {}),
                    **(payment_data.metadata or {})
                }
            )
            
            db.add(payment)
            
            # Update order if payment successful
            if result["status"] == "success":
                order.payment_status = "completed"
                order.status = "confirmed" if order.status == "pending" else order.status
            
            db.commit()
            db.refresh(payment)
            
            return APIResponseHelper.success(
                message=f"Payment processed successfully with {result['provider']}",
                data={
                    "payment_id": str(payment.id),
                    "provider": result["provider"],
                    "transaction_id": result["transaction_id"],
                    "amount": payment_data.amount,
                    "fee": result["fee"] / 100,
                    "net_amount": result["net_amount"] / 100,
                    "status": result["status"]
                }
            )
        else:
            return APIResponseHelper.error(
                message=result.get("error", "Payment failed"),
                error_code="PAYMENT_FAILED",
                data={"provider": result["provider"]}
            )
            
    except Exception as e:
        logger.error(f"Payment processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refund/{transaction_id}")
async def refund_payment(
    transaction_id: str,
    refund_data: RefundRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Refund a payment"""
    # Get the original payment
    payment = db.query(Payment).filter(Payment.external_id == transaction_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Get the provider that was used
    provider_name = payment.payment_metadata.get("provider", payment.payment_method).lower()
    provider = payment_factory.get_provider(provider_name)
    if not provider:
        raise HTTPException(
            status_code=400, 
            detail=f"Provider {provider_name} not available"
        )
    
    # Process refund
    result = await provider.refund_payment(
        transaction_id=payment.external_id,
        amount=Decimal(str(refund_data.amount)) if refund_data.amount else None,
        reason=refund_data.reason
    )
    
    if result["status"] == "refunded":
        # Update payment status
        payment.status = "refunded"
        payment.payment_metadata.update({
            "refund_id": result.get("refund_id"),
            "refunded_amount": result.get("amount", 0) / 100,
            "refund_reason": refund_data.reason
        })
        
        db.commit()
        
        return APIResponseHelper.success(
            message="Refund processed successfully",
            data={
                "refund_id": result.get("refund_id"),
                "amount": result.get("amount", 0) / 100,
                "status": "refunded"
            }
        )
    else:
        return APIResponseHelper.error(
            message=result.get("error", "Refund failed"),
            error_code="REFUND_FAILED"
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