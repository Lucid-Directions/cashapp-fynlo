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
from app.core.database import get_db, Payment, QRPayment, Order, User
from app.core.config import settings
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import ErrorCodes, FynloException, ResourceNotFoundException
from app.core.transaction_manager import transactional, transaction_manager
from app.services.payment_factory import payment_factory
from app.services.audit_logger import AuditLoggerService
from app.models.audit_log import AuditEventType, AuditEventStatus
from app.middleware.rate_limit_middleware import limiter, PAYMENT_RATE
from app.core.exceptions import FynloException, ResourceNotFoundException, ValidationException
router = APIRouter()
logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_SECRET_KEY

class QRPaymentRequest(BaseModel):
    order_id: str
    amount: float

class QRPaymentResponse(BaseModel):
    qr_payment_id: str
    qr_code_data: str
    qr_code_image: str
    amount: float
    fee_amount: float
    net_amount: float
    expires_at: datetime
    status: str

class StripePaymentRequest(BaseModel):
    order_id: str
    amount: float
    payment_method_id: str
    currency: str = 'gbp'

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

class PaymentRequest(BaseModel):
    order_id: str
    amount: float
    customer_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    currency: str = 'GBP'
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
    if payment_method == 'qr_code':
        return amount * (settings.QR_PAYMENT_FEE_PERCENTAGE / 100)
    elif payment_method in ['card', 'apple_pay', 'google_pay']:
        return amount * (settings.DEFAULT_CARD_FEE_PERCENTAGE / 100)
    else:
        return 0.0

def generate_qr_code(data: str) -> str:
    """Generate QR code and return as base64 encoded image"""
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='PNG')
    img_str = base64.b64encode(img_buffer.getvalue()).decode()
    return f'data:image/png;base64,{img_str}'

@router.post('/qr/generate', response_model=QRPaymentResponse)
@limiter.limit(PAYMENT_RATE)
async def generate_qr_payment(payment_request: QRPaymentRequest, request: Request, db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """Generate QR code for payment with 1.2% fee advantage"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else 'unknown'
    user_agent = request.headers.get('user-agent', 'unknown')
    order = db.query(Order).filter(Order.id == payment_request.order_id).first()
    if not order:
        raise ResourceNotFoundException(message='Order not found', code='NOT_FOUND', resource_type='order')
    fee_amount = calculate_payment_fee(payment_request.amount, 'qr_code')
    net_amount = payment_request.amount - fee_amount
    internal_qr_payment_id = str(uuid.uuid4())
    payment_data_for_qr = {'payment_id': internal_qr_payment_id, 'order_id': payment_request.order_id, 'amount': payment_request.amount, 'merchant': 'Fynlo POS', 'timestamp': datetime.utcnow().isoformat()}
    qr_payment_db_record = QRPayment(order_id=payment_request.order_id, qr_code_data=str(payment_data_for_qr), amount=payment_request.amount, fee_amount=fee_amount, net_amount=net_amount, expires_at=datetime.utcnow() + timedelta(minutes=15))
    db.add(qr_payment_db_record)
    await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_INITIATED, event_status=AuditEventStatus.SUCCESS, action_performed='QR payment initiated by generating QR code.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='QRPayment', resource_id=str(qr_payment_db_record.id), details={'order_id': payment_request.order_id, 'amount': payment_request.amount, 'payment_method': 'qr_code', 'qr_internal_id': internal_qr_payment_id}, commit=False)
    db.commit()
    db.refresh(qr_payment_db_record)
    qr_code_image = generate_qr_code(str(payment_data_for_qr))
    logger.info(f'QR payment generated: {qr_payment_db_record.id} for order {payment_request.order_id}')
    return QRPaymentResponse(qr_payment_id=str(qr_payment_db_record.id), qr_code_data=qr_payment_db_record.qr_code_data, qr_code_image=qr_code_image, amount=qr_payment_db_record.amount, fee_amount=qr_payment_db_record.fee_amount, net_amount=qr_payment_db_record.net_amount, expires_at=qr_payment_db_record.expires_at, status=qr_payment_db_record.status)

@router.post('/qr/{qr_payment_id}/confirm')
@transactional(max_retries=3, retry_delay=0.1)
async def confirm_qr_payment(request: Request, qr_payment_id: str, db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """Confirm QR payment completion"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else 'unknown'
    user_agent = request.headers.get('user-agent', 'unknown')
    qr_payment_db_record = db.query(QRPayment).filter(QRPayment.id == qr_payment_id).first()
    if not qr_payment_db_record:
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='QR payment confirmation failed: QR payment record not found.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='QRPayment', resource_id=qr_payment_id, details={'reason': 'QR payment record not found.'}, commit=True)
        raise ResourceNotFoundException(message='QR payment not found', code='NOT_FOUND', resource_type='payment')
    if qr_payment_db_record.expires_at < datetime.utcnow():
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='QR payment confirmation failed: QR payment expired.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='QRPayment', resource_id=qr_payment_id, details={'order_id': str(qr_payment_db_record.order_id), 'amount': qr_payment_db_record.amount, 'reason': 'QR payment expired.'}, commit=True)
        raise ValidationException(message='QR payment expired', code='BAD_REQUEST')
    if qr_payment_db_record.status == 'completed':
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO, action_performed='QR payment confirmation attempt: Already processed.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='QRPayment', resource_id=qr_payment_id, details={'order_id': str(qr_payment_db_record.order_id), 'amount': qr_payment_db_record.amount, 'reason': 'QR payment already processed.'}, commit=True)
        raise ValidationException(message='QR payment already processed', code='BAD_REQUEST')
    if qr_payment_db_record.status != 'pending':
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed=f"QR payment confirmation failed: Invalid status '{qr_payment_db_record.status}'.", user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='QRPayment', resource_id=qr_payment_id, details={'order_id': str(qr_payment_db_record.order_id), 'amount': qr_payment_db_record.amount, 'reason': f'Cannot confirm QR payment with status: {qr_payment_db_record.status}'}, commit=True)
        raise ValidationException(message='', code='BAD_REQUEST')
    order = db.query(Order).filter(Order.id == qr_payment_db_record.order_id).first()
    if not order:
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='QR payment confirmation failed: Associated order not found.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='QRPayment', resource_id=qr_payment_id, details={'order_id': str(qr_payment_db_record.order_id), 'reason': 'Associated order not found internally.'}, commit=True)
        raise ResourceNotFoundException(message='Associated order not found', code='NOT_FOUND', resource_type='order')
    if order.payment_status == 'completed':
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO, action_performed='QR payment confirmation failed: Order already paid.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Order', resource_id=str(order.id), details={'qr_payment_id': qr_payment_id, 'reason': 'Order already marked as paid.'}, commit=True)
        raise ValidationException(message='Order already paid', code='BAD_REQUEST')
    payment_record = None
    try:
        qr_payment_db_record.status = 'completed'
        payment_record = Payment(order_id=qr_payment_db_record.order_id, payment_method='qr_code', amount=qr_payment_db_record.amount, fee_amount=qr_payment_db_record.fee_amount, net_amount=qr_payment_db_record.net_amount, status='completed', processed_at=datetime.utcnow(), payment_metadata={'qr_payment_id': str(qr_payment_db_record.id)})
        db.add(payment_record)
        order.payment_status = 'completed'
        order.status = 'confirmed' if order.status == 'pending' else order.status
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_SUCCESS, event_status=AuditEventStatus.SUCCESS, action_performed='QR payment confirmed successfully.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_record.id), details={'order_id': str(order.id), 'qr_payment_id': qr_payment_id, 'amount': payment_record.amount}, commit=False)
    except Exception as e:
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='QR payment confirmation failed during processing.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='QRPayment', resource_id=qr_payment_id, details={'order_id': str(qr_payment_db_record.order_id), 'error': str(e)}, commit=False)
        logger.error(f'QR payment confirmation failed for {qr_payment_id}: {e}')
        raise FynloException(message='Payment confirmation failed', code='INTERNAL_ERROR')
    logger.info(f'QR payment confirmed: {qr_payment_id}')
    return APIResponseHelper.success(message='QR payment confirmed successfully', data={'payment_id': str(payment_record.id) if payment_record and payment_record.id else None})

@router.post('/stripe', response_model=PaymentResponse)
@limiter.limit(PAYMENT_RATE)
@transactional(max_retries=2, retry_delay=0.2)
async def process_stripe_payment(payment_request_data: StripePaymentRequest, request: Request, db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """Process Stripe payment"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else 'unknown'
    user_agent = request.headers.get('user-agent', 'unknown')
    order = db.query(Order).filter(Order.id == payment_request_data.order_id).first()
    if not order:
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Stripe payment failed: Order not found.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, details={'order_id': payment_request_data.order_id, 'amount': payment_request_data.amount, 'reason': 'Order not found'}, commit=True)
        raise ResourceNotFoundException(message='Order not found', code='NOT_FOUND', resource_type='order')
    if order.payment_status == 'completed':
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO, action_performed='Stripe payment attempt failed: Order already paid.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Order', resource_id=str(order.id), details={'reason': 'Order already marked as paid.'}, commit=True)
        raise ValidationException(message='Order already paid', code='BAD_REQUEST')
    fee_amount = calculate_payment_fee(payment_request_data.amount, 'card')
    net_amount = payment_request_data.amount - fee_amount
    payment_db_record = Payment(order_id=payment_request_data.order_id, payment_method='stripe', amount=payment_request_data.amount, fee_amount=fee_amount, net_amount=net_amount, status='pending', payment_metadata={'stripe_payment_method_id': payment_request_data.payment_method_id})
    db.add(payment_db_record)
    db.flush()
    await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_INITIATED, event_status=AuditEventStatus.PENDING, action_performed='Stripe payment initiated.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'order_id': payment_request_data.order_id, 'amount': payment_request_data.amount, 'payment_method_id': payment_request_data.payment_method_id}, commit=False)
    try:
        payment_intent = stripe.PaymentIntent.create(amount=int(payment_request_data.amount * 100), currency=payment_request_data.currency, payment_method=payment_request_data.payment_method_id, metadata={'order_id': str(payment_request_data.order_id), 'payment_id': str(payment_db_record.id), 'restaurant_id': str(order.restaurant_id)}, confirmation_method='manual', confirm=True)
        payment_db_record.external_id = payment_intent.id
        payment_db_record.payment_metadata.update({'stripe_payment_intent': payment_intent.id})
        if payment_intent.status == 'succeeded':
            payment_db_record.status = 'completed'
            payment_db_record.processed_at = datetime.utcnow()
            order.payment_status = 'completed'
            order.status = 'confirmed' if order.status == 'pending' else order.status
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_SUCCESS, event_status=AuditEventStatus.SUCCESS, action_performed='Stripe payment succeeded.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'order_id': payment_request_data.order_id, 'stripe_payment_intent_id': payment_intent.id, 'amount': payment_db_record.amount}, commit=False)
        else:
            payment_db_record.status = 'failed'
            logger.warning(f'Stripe payment failed for order {payment_request_data.order_id}: {payment_intent.status}')
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Stripe payment failed by provider.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'order_id': payment_request_data.order_id, 'stripe_payment_intent_id': payment_intent.id, 'stripe_status': payment_intent.status, 'reason': 'Stripe processing resulted in failure.'}, commit=False)
        db.refresh(payment_db_record)
        logger.info(f'Stripe payment processed: {payment_db_record.id} for order {payment_request_data.order_id}')
        return PaymentResponse(payment_id=str(payment_db_record.id), status=payment_db_record.status, amount=payment_db_record.amount, fee_amount=payment_db_record.fee_amount, net_amount=payment_db_record.net_amount, external_id=payment_db_record.external_id)
    except stripe.error.StripeError as e:
        payment_db_record.status = 'failed'
        payment_db_record.payment_metadata.update({'stripe_error': str(e)})
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Stripe payment failed due to Stripe API error.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'order_id': payment_request_data.order_id, 'error': str(e), 'error_type': e.__class__.__name__}, commit=False)
        logger.error(f'Stripe payment failed: {str(e)}')
        raise ValidationException(message='', code='BAD_REQUEST')
    except Exception as e:
        payment_db_record.status = 'failed'
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Stripe payment failed due to unexpected server error.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'order_id': payment_request_data.order_id, 'error': str(e)}, commit=False)
        logger.error(f'Unexpected error during Stripe payment: {e}')
        raise FynloException(message='Payment processing failed', code='INTERNAL_ERROR')

@router.post('/cash', response_model=PaymentResponse)
async def process_cash_payment(payment_request_data: CashPaymentRequest, request: Request, db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """Process cash payment"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else 'unknown'
    user_agent = request.headers.get('user-agent', 'unknown')
    order = db.query(Order).filter(Order.id == payment_request_data.order_id).first()
    if not order:
        raise ResourceNotFoundException(message='Order not found', code='NOT_FOUND', resource_type='order')
    if order.payment_status == 'completed':
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO, action_performed='Cash payment attempt failed: Order already paid.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Order', resource_id=str(order.id), details={'reason': 'Order already marked as paid.'}, commit=True)
        raise ValidationException(message='Order already paid', code='BAD_REQUEST')
    if payment_request_data.received_amount < payment_request_data.amount:
        raise ValidationException(message='Insufficient cash received', code='BAD_REQUEST')
    change_amount = payment_request_data.received_amount - payment_request_data.amount
    payment_db_record = Payment(order_id=payment_request_data.order_id, payment_method='cash', amount=payment_request_data.amount, fee_amount=0.0, net_amount=payment_request_data.amount, status='completed', processed_at=datetime.utcnow(), payment_metadata={'received_amount': payment_request_data.received_amount, 'change_amount': change_amount})
    db.add(payment_db_record)
    order.payment_status = 'completed'
    await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_SUCCESS, event_status=AuditEventStatus.SUCCESS, action_performed='Cash payment processed successfully.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'order_id': payment_request_data.order_id, 'amount': payment_request_data.amount, 'received_amount': payment_request_data.received_amount, 'change_amount': change_amount}, commit=False)
    db.commit()
    db.refresh(payment_db_record)
    db.refresh(order)
    logger.info(f'Cash payment processed: {payment_db_record.id} for order {payment_request_data.order_id}')
    return PaymentResponse(payment_id=str(payment_db_record.id), status=payment_db_record.status, amount=payment_db_record.amount, fee_amount=payment_db_record.fee_amount, net_amount=payment_db_record.net_amount)

@router.get('/order/{order_id}')
async def get_order_payments(order_id: str, db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """Get all payments for an order"""
    payments = db.query(Payment).filter(Payment.order_id == order_id).all()
    payment_data = [{'payment_id': str(payment.id), 'payment_method': payment.payment_method, 'amount': payment.amount, 'fee_amount': payment.fee_amount, 'net_amount': payment.net_amount, 'status': payment.status, 'processed_at': payment.processed_at, 'external_id': payment.external_id} for payment in payments]
    return APIResponseHelper.success(data=payment_data, message=f'Retrieved {len(payment_data)} payments for order')

@router.get('/qr/{qr_payment_id}/status')
async def check_qr_payment_status(qr_payment_id: str, db: Session=Depends(get_db)):
    """Check QR payment status (public endpoint for payment checking)"""
    qr_payment = db.query(QRPayment).filter(QRPayment.id == qr_payment_id).first()
    if not qr_payment:
        raise ResourceNotFoundException(message='QR payment not found', code='NOT_FOUND', resource_type='payment')
    data = {'qr_payment_id': str(qr_payment.id), 'status': qr_payment.status, 'amount': qr_payment.amount, 'expires_at': qr_payment.expires_at, 'expired': qr_payment.expires_at < datetime.utcnow()}
    return APIResponseHelper.success(data=data, message='QR payment status retrieved')

@router.post('/process')
async def process_payment(payment_data_req: PaymentRequest, request: Request, provider_query: Optional[str]=Query(None, alias='provider', description='Force specific provider'), db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
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
    ip_address = request.client.host if request.client else 'unknown'
    user_agent = request.headers.get('user-agent', 'unknown')
    payment_db_record = None
    try:
        order = db.query(Order).filter(Order.id == payment_data_req.order_id).first()
        if not order:
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Payment processing failed: Order not found.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, details={'order_id': payment_data_req.order_id, 'amount': payment_data_req.amount, 'reason': 'Order not found'}, commit=True)
            raise ResourceNotFoundException(message='Order not found', code='NOT_FOUND', resource_type='order')
        if order.payment_status == 'completed':
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO, action_performed='Payment processing attempt failed: Order already paid.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Order', resource_id=str(order.id), details={'reason': 'Order already marked as paid.'}, commit=True)
            raise ValidationException(message='Order already paid', code='BAD_REQUEST')
        monthly_volume = Decimal('2000')
        provider_instance = await payment_factory.select_optimal_provider(amount=Decimal(str(payment_data_req.amount)), restaurant_id=str(order.restaurant_id) if hasattr(order, 'restaurant_id') else 'default', monthly_volume=monthly_volume, force_provider=provider_query, db_session=db)
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_INITIATED, event_status=AuditEventStatus.PENDING, action_performed=f"Payment processing initiated with provider: {(provider_instance.name if provider_instance else 'N/A')}.", user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Order', resource_id=str(order.id), details={'order_id': payment_data_req.order_id, 'amount': payment_data_req.amount, 'currency': payment_data_req.currency, 'provider_selected': provider_instance.name if provider_instance else 'N/A', 'customer_id': payment_data_req.customer_id}, commit=False)
        result = await provider_instance.process_payment(amount=Decimal(str(payment_data_req.amount)), customer_id=payment_data_req.customer_id, payment_method_id=payment_data_req.payment_method_id, metadata={'order_id': payment_data_req.order_id, 'restaurant_id': str(order.restaurant_id) if hasattr(order, 'restaurant_id') else 'default', **(payment_data_req.metadata or {})})
        event_status_for_log = AuditEventStatus.SUCCESS if result['status'] == 'success' else AuditEventStatus.PENDING if result['status'] == 'pending' else AuditEventStatus.FAILURE
        audit_event_type = AuditEventType.PAYMENT_SUCCESS if result['status'] in ['success', 'pending'] else AuditEventType.PAYMENT_FAILURE
        if result['status'] in ['success', 'pending']:
            payment_db_record = Payment(order_id=payment_data_req.order_id, payment_method=f"{result['provider']}_payment", provider=result['provider'], amount=payment_data_req.amount, fee_amount=result['fee'] / 100, provider_fee=result['fee'] / 100, net_amount=result['net_amount'] / 100, status=result['status'], external_id=result['transaction_id'], processed_at=datetime.utcnow() if result['status'] == 'success' else None, payment_metadata={'provider': result['provider'], 'transaction_id': result['transaction_id'], 'raw_response': result.get('raw_response', {}), **(payment_data_req.metadata or {})})
            db.add(payment_db_record)
            if result['status'] == 'success':
                order.payment_status = 'completed'
                order.status = 'confirmed' if order.status == 'pending' else order.status
            await audit_service.create_audit_log(event_type=audit_event_type, event_status=event_status_for_log, action_performed=f"Payment processing by {result['provider']} completed with status: {result['status']}.", user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'order_id': payment_data_req.order_id, 'provider': result['provider'], 'transaction_id': result['transaction_id'], 'amount': payment_data_req.amount, 'provider_status': result['status']}, commit=False)
            db.commit()
            db.refresh(payment_db_record)
            if result['status'] == 'success':
                db.refresh(order)
            return APIResponseHelper.success(message=f"Payment processed successfully with {result['provider']}", data={'payment_id': str(payment_db_record.id), 'provider': result['provider'], 'transaction_id': result['transaction_id'], 'amount': payment_data_req.amount, 'fee': result['fee'] / 100, 'net_amount': result['net_amount'] / 100, 'status': result['status']})
        else:
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed=f"Payment processing failed by provider: {result.get('provider', 'N/A')}.", user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Order', resource_id=str(order.id), details={'order_id': payment_data_req.order_id, 'provider': result.get('provider', 'N/A'), 'error': result.get('error', 'Unknown provider error'), 'amount': payment_data_req.amount}, commit=True)
            return APIResponseHelper.error(message=result.get('error', 'Payment failed'), error_code='PAYMENT_FAILED', data={'provider': result['provider']})
    except Exception as e:
        logger.error(f'Payment processing error: {str(e)}', exc_info=True)
        details_for_error_log = {'order_id': payment_data_req.order_id, 'amount': payment_data_req.amount, 'error': str(e), 'error_type': e.__class__.__name__}
        if payment_db_record and payment_db_record.id:
            details_for_error_log['payment_id_attempted'] = str(payment_db_record.id)
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Payment processing failed due to server error.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Order', resource_id=str(payment_data_req.order_id), details=details_for_error_log, commit=True)
        raise FynloException(message='', code='INTERNAL_ERROR')

@router.post('/refund/{transaction_id}')
async def refund_payment(transaction_id: str, refund_data_req: RefundRequest, request: Request, db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """Refund a payment"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else 'unknown'
    user_agent = request.headers.get('user-agent', 'unknown')
    payment_db_record = db.query(Payment).filter(Payment.external_id == transaction_id).first()
    if not payment_db_record:
        await audit_service.create_audit_log(event_type=AuditEventType.REFUND_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Refund attempt failed: Original payment not found.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, details={'external_transaction_id': transaction_id, 'reason': 'Payment not found'}, commit=True)
        raise ResourceNotFoundException(message='Payment not found', code='NOT_FOUND', resource_type='payment')
    provider_name_from_meta = payment_db_record.payment_metadata.get('provider', payment_db_record.payment_method)
    provider_name = provider_name_from_meta.lower().replace('_payment', '') if isinstance(provider_name_from_meta, str) else 'unknown'
    provider_instance = payment_factory.get_provider(provider_name)
    if not provider_instance:
        await audit_service.create_audit_log(event_type=AuditEventType.REFUND_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed=f"Refund attempt failed: Provider '{provider_name}' not available/found.", user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'external_transaction_id': transaction_id, 'provider_name_attempted': provider_name}, commit=True)
        raise ValidationException(message='', code='BAD_REQUEST')
    await audit_service.create_audit_log(event_type=AuditEventType.REFUND_INITIATED, event_status=AuditEventStatus.PENDING, action_performed=f'Refund initiated with provider: {provider_instance.name}.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'external_transaction_id': transaction_id, 'amount_requested': refund_data_req.amount, 'reason': refund_data_req.reason, 'provider': provider_instance.name}, commit=False)
    try:
        result = await provider_instance.refund_payment(transaction_id=payment_db_record.external_id, amount=Decimal(str(refund_data_req.amount)) if refund_data_req.amount is not None else None, reason=refund_data_req.reason)
    except Exception as e:
        await audit_service.create_audit_log(event_type=AuditEventType.REFUND_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed=f'Refund processing by {provider_instance.name} failed with exception.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'external_transaction_id': transaction_id, 'error': str(e)}, commit=True)
        raise FynloException(message='', code='INTERNAL_ERROR')
    if result['status'] == 'refunded':
        payment_db_record.status = 'refunded'
        payment_db_record.payment_metadata.update({'refund_id': result.get('refund_id'), 'refunded_amount': result.get('amount', 0) / 100, 'refund_reason': refund_data_req.reason, 'refunded_at': datetime.utcnow().isoformat()})
        await audit_service.create_audit_log(event_type=AuditEventType.REFUND_SUCCESS, event_status=AuditEventStatus.SUCCESS, action_performed=f'Refund by {provider_instance.name} succeeded.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'external_transaction_id': transaction_id, 'refund_id': result.get('refund_id'), 'amount_refunded': result.get('amount', 0) / 100}, commit=False)
        db.commit()
        db.refresh(payment_db_record)
        return APIResponseHelper.success(message='Refund processed successfully', data={'refund_id': result.get('refund_id'), 'amount': result.get('amount', 0) / 100, 'status': 'refunded'})
    else:
        await audit_service.create_audit_log(event_type=AuditEventType.REFUND_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed=f'Refund by {provider_instance.name} failed.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db_record.id), details={'external_transaction_id': transaction_id, 'error': result.get('error', 'Unknown provider error'), 'provider_status': result.get('status')}, commit=True)
        return APIResponseHelper.error(message=result.get('error', 'Refund failed'), error_code='REFUND_FAILED', data={'provider_refund_status': result.get('status')})

@router.get('/providers')
async def get_available_providers(current_user: User=Depends(get_current_user)):
    """Get list of available payment providers and their costs"""
    providers = payment_factory.get_available_providers()
    sample_amounts = [Decimal('10'), Decimal('50'), Decimal('100')]
    monthly_volume = Decimal('2000')
    provider_info_list = []
    for provider_name in providers:
        provider = payment_factory.get_provider(provider_name)
        info = {'name': provider_name, 'display_name': provider_name.title(), 'sample_fees': {}, 'recommended': False}
        for amount in sample_amounts:
            fee = provider.calculate_fee(amount)
            info['sample_fees'][f'£{amount}'] = f'£{fee:.2f}'
        if provider_name == 'sumup':
            info['rate'] = '1.69% (standard)'
        elif provider_name == 'stripe':
            info['rate'] = '1.4% + 20p (UK cards)'
        elif provider_name == 'square':
            info['rate'] = '1.75%'
        provider_info_list.append(info)
    if provider_info_list:
        provider_info_list[0]['recommended'] = True
    return APIResponseHelper.success(data={'providers': provider_info_list, 'monthly_volume_assumption': float(monthly_volume), 'optimal_provider_example': provider_info_list[0]['name'] if provider_info_list else None}, message='Retrieved available payment providers.')

class SquareCreatePaymentRequest(BaseModel):
    amount: float
    currency: str = 'GBP'
    source_id: str
    order_id: Optional[str] = None
    customer_id: Optional[str] = None
    note: Optional[str] = None
    metadata: Optional[dict] = None

class SquareProcessPaymentRequest(BaseModel):
    payment_id: str
    order_id: Optional[str] = None

class SquarePaymentResponseData(BaseModel):
    payment_id: Optional[str] = None
    provider: str
    transaction_id: Optional[str] = None
    status: str
    amount: Optional[float] = None
    currency: Optional[str] = None
    fee: Optional[float] = None
    net_amount: Optional[float] = None
    message: Optional[str] = None
    raw_response: Optional[dict] = None

@router.post('/square/create', response_model=SquarePaymentResponseData, tags=['Payments - Square'])
async def square_create_payment_endpoint(http_request: Request, payment_create_req: SquareCreatePaymentRequest, db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """Create a Square payment. If auto_complete is true, this attempts to finalize the payment."""
    audit_service = AuditLoggerService(db)
    ip_address = http_request.client.host if http_request.client else 'unknown'
    user_agent = http_request.headers.get('user-agent', 'unknown')
    try:
        square_provider = await payment_factory.get_provider_instance('square', db_session=db)
        if not square_provider:
            raise FynloException(message="Square provider not available.")
        order = None
        if payment_create_req.order_id:
            order = db.query(Order).filter(Order.id == payment_create_req.order_id).first()
            if not order:
                await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Square payment creation failed: Order not found.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, details={'order_id': payment_create_req.order_id, 'reason': 'Order not found'}, commit=True)
                raise ResourceNotFoundException(message="Order {payment_create_req.order_id} not found.", resource_type="Order")
            if order.payment_status == 'completed':
                await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.INFO, action_performed='Square payment creation attempt: Order already paid.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Order', resource_id=str(order.id), details={'reason': 'Order already marked as paid.'}, commit=True)
                raise ValidationException(message='Order already paid.', code='BAD_REQUEST')
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_INITIATED, event_status=AuditEventStatus.PENDING, action_performed='Square payment creation initiated.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, details={**payment_create_req.model_dump(), 'provider': 'square'}, commit=False)
        provider_response = await square_provider.create_payment(amount=Decimal(str(payment_create_req.amount)), currency=payment_create_req.currency, source_id=payment_create_req.source_id, customer_id=payment_create_req.customer_id, order_id=payment_create_req.order_id, note=payment_create_req.note, metadata=payment_create_req.metadata)
        internal_payment_id = None
        if provider_response.get('status') in [PaymentStatus.SUCCESS.value, PaymentStatus.PENDING.value] and provider_response.get('transaction_id'):
            payment_db = Payment(order_id=payment_create_req.order_id if order else None, payment_method='square_card', provider='square', amount=Decimal(str(payment_create_req.amount)), fee_amount=Decimal(str(provider_response.get('fee', 0))) / 100 if provider_response.get('fee') is not None else square_provider.calculate_fee(Decimal(str(payment_create_req.amount))), provider_fee=Decimal(str(provider_response.get('fee', 0))) / 100 if provider_response.get('fee') is not None else square_provider.calculate_fee(Decimal(str(payment_create_req.amount))), net_amount=Decimal(str(provider_response.get('net_amount', 0))) / 100 if provider_response.get('net_amount') is not None else Decimal(str(payment_create_req.amount)) - square_provider.calculate_fee(Decimal(str(payment_create_req.amount))), status=provider_response['status'], external_id=provider_response['transaction_id'], processed_at=datetime.utcnow() if provider_response['status'] == PaymentStatus.SUCCESS.value else None, payment_metadata={'provider_response': provider_response.get('raw_response', {}), 'source_id': payment_create_req.source_id, 'customer_id': payment_create_req.customer_id, **(payment_create_req.metadata or {})})
            db.add(payment_db)
            if order and provider_response['status'] == PaymentStatus.SUCCESS.value:
                order.payment_status = 'completed'
                order.status = 'confirmed' if order.status == 'pending' else order.status
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_SUCCESS if provider_response['status'] == PaymentStatus.SUCCESS.value else AuditEventType.PAYMENT_PENDING, event_status=AuditEventStatus.SUCCESS if provider_response['status'] == PaymentStatus.SUCCESS.value else AuditEventStatus.PENDING, action_performed=f"Square payment status: {provider_response['status']}.", user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db.id), details={'external_id': provider_response['transaction_id'], 'provider_status': provider_response.get('raw_response', {}).get('payment', {}).get('status')}, commit=True)
            db.commit()
            db.refresh(payment_db)
            internal_payment_id = str(payment_db.id)
        else:
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Square payment creation failed by provider.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, details={'error': provider_response.get('error', 'Unknown'), 'provider_response': provider_response.get('raw_response')}, commit=True)
            raise ValidationException(message='', code='BAD_REQUEST')
        return SquarePaymentResponseData(payment_id=internal_payment_id, provider='square', transaction_id=provider_response.get('transaction_id'), status=provider_response['status'], amount=float(provider_response.get('amount', payment_create_req.amount)), currency=provider_response.get('currency', payment_create_req.currency), fee=float(Decimal(str(provider_response.get('fee', 0))) / 100) if provider_response.get('fee') is not None else None, net_amount=float(Decimal(str(provider_response.get('net_amount', 0))) / 100) if provider_response.get('net_amount') is not None else None, message=provider_response.get('message', 'Payment processed by Square.'), raw_response=provider_response.get('raw_response'))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Square payment creation error: {str(e)}', exc_info=True)
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Square payment creation failed due to server error.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, details={'error': str(e)}, commit=True)
        raise FynloException(message='', code='INTERNAL_ERROR')

@router.post('/square/process', response_model=SquarePaymentResponseData, tags=['Payments - Square'])
async def square_process_payment_endpoint(http_request: Request, payment_process_req: SquareProcessPaymentRequest, db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """Process (complete) a Square payment that was created with auto_complete=false."""
    audit_service = AuditLoggerService(db)
    ip_address = http_request.client.host if http_request.client else 'unknown'
    user_agent = http_request.headers.get('user-agent', 'unknown')
    try:
        square_provider = await payment_factory.get_provider_instance('square', db_session=db)
        if not square_provider:
            raise FynloException(message="Square provider not available.")
        payment_db = db.query(Payment).filter(Payment.external_id == payment_process_req.payment_id, Payment.provider == 'square').first()
        if not payment_db:
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Square payment process failed: Original payment record not found.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, details={'external_payment_id': payment_process_req.payment_id}, commit=True)
            raise ResourceNotFoundException(message="Payment with Square ID {payment_process_req.payment_id} not found in local records.", resource_type="Resource")
        if payment_db.status == PaymentStatus.SUCCESS.value:
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_INFO, event_status=AuditEventStatus.INFO, action_performed='Square payment process attempt: Payment already completed.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db.id), details={'external_id': payment_process_req.payment_id}, commit=True)
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_PROCESSING, event_status=AuditEventStatus.PENDING, action_performed='Square payment completion (process) initiated.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db.id), details={'external_payment_id': payment_process_req.payment_id, 'order_id_param': payment_process_req.order_id}, commit=False)
        provider_response = await square_provider.process_payment(payment_id=payment_process_req.payment_id, order_id=payment_process_req.order_id)
        current_provider_status = provider_response.get('status')
        payment_db.status = current_provider_status
        payment_db.payment_metadata = {**payment_db.payment_metadata, 'process_response': provider_response.get('raw_response')}
        if current_provider_status == PaymentStatus.SUCCESS.value:
            payment_db.processed_at = datetime.utcnow()
            if payment_db.order_id:
                order = db.query(Order).filter(Order.id == payment_db.order_id).first()
                if order:
                    order.payment_status = 'completed'
                    order.status = 'confirmed' if order.status == 'pending' else order.status
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_SUCCESS, event_status=AuditEventStatus.SUCCESS, action_performed='Square payment processed/completed successfully.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db.id), details={'external_id': payment_process_req.payment_id, 'final_status': current_provider_status}, commit=True)
        else:
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed=f'Square payment process resulted in status: {current_provider_status}.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, resource_type='Payment', resource_id=str(payment_db.id), details={'external_id': payment_process_req.payment_id, 'error': provider_response.get('error'), 'final_status': current_provider_status}, commit=True)
        db.commit()
        db.refresh(payment_db)
        return SquarePaymentResponseData(payment_id=str(payment_db.id), provider='square', transaction_id=provider_response.get('transaction_id', payment_process_req.payment_id), status=current_provider_status, amount=float(provider_response.get('amount', payment_db.amount)), currency=provider_response.get('currency', payment_db.payment_metadata.get('currency', 'GBP')), fee=float(Decimal(str(provider_response.get('fee', 0))) / 100) if provider_response.get('fee') is not None else None, net_amount=float(Decimal(str(provider_response.get('net_amount', 0))) / 100) if provider_response.get('net_amount') is not None else None, message=provider_response.get('message', f'Square payment processed. Status: {current_provider_status}'), raw_response=provider_response.get('raw_response'))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Square payment processing error: {str(e)}', exc_info=True)
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Square payment processing failed due to server error.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, details={'external_payment_id': payment_process_req.payment_id, 'error': str(e)}, commit=True)
        raise FynloException(message='', code='INTERNAL_ERROR')

@router.get('/square/status/{payment_id}', response_model=SquarePaymentResponseData, tags=['Payments - Square'])
async def square_get_payment_status_endpoint(http_request: Request, payment_id: str, db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """Get the status of a Square payment by its Square Payment ID."""
    audit_service = AuditLoggerService(db)
    ip_address = http_request.client.host if http_request.client else 'unknown'
    user_agent = http_request.headers.get('user-agent', 'unknown')
    try:
        square_provider = await payment_factory.get_provider_instance('square', db_session=db)
        if not square_provider:
            raise FynloException(message="Square provider not available.")
        provider_response = await square_provider.get_payment_status(payment_id=payment_id)
        if provider_response.get('status') == PaymentStatus.FAILED.value and 'Failed to retrieve payment status' in provider_response.get('error', ''):
            await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_INFO, event_status=AuditEventStatus.FAILURE, action_performed='Square payment status check: Payment not found by provider.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, details={'external_payment_id': payment_id, 'error': provider_response.get('error')}, commit=True)
            raise ResourceNotFoundException(message="Square payment with ID {payment_id} not found by provider.", resource_type="Resource")
        return SquarePaymentResponseData(provider='square', transaction_id=provider_response.get('transaction_id', payment_id), status=provider_response['status'], amount=float(provider_response.get('amount', 0)), currency=provider_response.get('currency', 'GBP'), fee=float(Decimal(str(provider_response.get('fee', 0))) / 100) if provider_response.get('fee') is not None else None, net_amount=float(Decimal(str(provider_response.get('net_amount', 0))) / 100) if provider_response.get('net_amount') is not None else None, message=provider_response.get('message', f"Square payment status: {provider_response['status']}"), raw_response=provider_response.get('raw_response'))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Square payment status retrieval error: {str(e)}', exc_info=True)
        await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Square payment status retrieval failed due to server error.', user_id=current_user.id, username_or_email=current_user.email, ip_address=ip_address, user_agent=user_agent, details={'external_payment_id': payment_id, 'error': str(e)}, commit=True)
        raise FynloException(message='', code='INTERNAL_ERROR')

@router.post('/webhooks/stripe', include_in_schema=False)
async def stripe_webhook_endpoint(http_request: Request, db: Session=Depends(get_db)):
    """Handle incoming webhooks from Stripe."""
    payload = await http_request.body()
    sig_header = http_request.headers.get('stripe-signature')
    audit_service = AuditLoggerService(db)
    ip_address = http_request.client.host if http_request.client else 'unknown'
    user_agent = http_request.headers.get('user-agent', 'unknown')
    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.error('Stripe webhook secret is not configured.')
        await audit_service.create_audit_log(event_type=AuditEventType.SYSTEM_ERROR, event_status=AuditEventStatus.FAILURE, action_performed='Stripe webhook processing failed: Missing webhook secret.', user_id='SYSTEM', username_or_email='system@fynlo.com', ip_address=ip_address, user_agent='Stripe Webhook', details={'reason': 'STRIPE_WEBHOOK_SECRET not set in environment.'}, commit=True)
        raise FynloException(message='Webhook secret not configured.', code='INTERNAL_ERROR')
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except ValueError as e:
        logger.error(f'Stripe webhook error: Invalid payload. {str(e)}')
        await audit_service.create_audit_log(event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.FAILURE, action_performed='Stripe webhook processing failed: Invalid payload.', user_id='SYSTEM', username_or_email='system@fynlo.com', ip_address=ip_address, details={'error': str(e), 'payload_start': payload[:200].decode('utf-8', errors='replace')}, commit=True)
        raise ValidationException(message='Invalid payload', code='BAD_REQUEST')
    except stripe.error.SignatureVerificationError as e:
        logger.error(f'Stripe webhook error: Invalid signature. {str(e)}')
        await audit_service.create_audit_log(event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.FAILURE, action_performed='Stripe webhook processing failed: Invalid signature.', user_id='SYSTEM', username_or_email='system@fynlo.com', ip_address=ip_address, details={'error': str(e), 'signature_header': sig_header}, commit=True)
        raise ValidationException(message='Invalid signature', code='BAD_REQUEST')
    except Exception as e:
        logger.error(f'Stripe webhook event construction error: {str(e)}')
        await audit_service.create_audit_log(event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.FAILURE, action_performed='Stripe webhook processing failed: Event construction error.', user_id='SYSTEM', username_or_email='system@fynlo.com', ip_address=ip_address, details={'error': str(e)}, commit=True)
        raise FynloException(message='Webhook event construction error', code='INTERNAL_ERROR')
    logger.info(f'Received Stripe event: id={event.id}, type={event.type}')
    await audit_service.create_audit_log(event_type=AuditEventType.WEBHOOK_RECEIVED, event_status=AuditEventStatus.SUCCESS, action_performed=f'Stripe webhook event received: {event.type}', user_id='SYSTEM', username_or_email='stripe_webhook@fynlo.com', ip_address=ip_address, resource_type='StripeEvent', resource_id=event.id, details={'event_type': event.type, 'event_id': event.id, 'livemode': event.livemode}, commit=True)
    try:
        if event.type == 'payment_intent.succeeded':
            payment_intent = event.data.object
            logger.info(f'PaymentIntent {payment_intent.id} succeeded.')
            payment = db.query(Payment).filter(Payment.external_id == payment_intent.id, Payment.provider == 'stripe').first()
            if payment:
                if payment.status != PaymentStatus.SUCCESS.value:
                    payment.status = PaymentStatus.SUCCESS.value
                    payment.processed_at = datetime.utcnow()
                    payment.payment_metadata = {**payment.payment_metadata, 'webhook_succeeded_event': event.to_dict_recursive()}
                    if payment.order_id:
                        order = db.query(Order).filter(Order.id == payment.order_id).first()
                        if order:
                            order.payment_status = 'completed'
                            order.status = 'confirmed' if order.status == 'pending' else order.status
                    await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_SUCCESS, event_status=AuditEventStatus.SUCCESS, action_performed='Stripe PaymentIntent succeeded (webhook).', resource_type='Payment', resource_id=str(payment.id), details={'external_id': payment_intent.id, 'amount': payment_intent.amount / 100}, commit=True)
                    db.commit()
                else:
                    logger.info(f'PaymentIntent {payment_intent.id} already marked as SUCCESS in DB. Webhook ignored for idempotency.')
            else:
                logger.warning(f'Received {event.type} for unknown PaymentIntent {payment_intent.id}')
                await audit_service.create_audit_log(event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.WARNING, action_performed=f'Stripe event {event.type} for unknown PaymentIntent.', details={'external_id': payment_intent.id, 'event_id': event.id}, commit=True)
        elif event.type == 'payment_intent.payment_failed':
            payment_intent = event.data.object
            logger.info(f'PaymentIntent {payment_intent.id} failed.')
            payment = db.query(Payment).filter(Payment.external_id == payment_intent.id, Payment.provider == 'stripe').first()
            if payment:
                if payment.status != PaymentStatus.FAILED.value:
                    payment.status = PaymentStatus.FAILED.value
                    error_details = payment_intent.last_payment_error
                    payment.payment_metadata = {**payment.payment_metadata, 'webhook_failed_event': event.to_dict_recursive(), 'failure_reason': error_details.message if error_details else 'Unknown', 'failure_code': error_details.code if error_details else 'Unknown'}
                    await audit_service.create_audit_log(event_type=AuditEventType.PAYMENT_FAILURE, event_status=AuditEventStatus.FAILURE, action_performed='Stripe PaymentIntent failed (webhook).', resource_type='Payment', resource_id=str(payment.id), details={'external_id': payment_intent.id, 'error_message': error_details.message if error_details else 'N/A', 'error_code': error_details.code if error_details else 'N/A'}, commit=True)
                    db.commit()
                else:
                    logger.info(f'PaymentIntent {payment_intent.id} already marked as FAILED in DB. Webhook ignored for idempotency.')
            else:
                logger.warning(f'Received {event.type} for unknown PaymentIntent {payment_intent.id}')
                await audit_service.create_audit_log(event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.WARNING, action_performed=f'Stripe event {event.type} for unknown PaymentIntent.', details={'external_id': payment_intent.id, 'event_id': event.id}, commit=True)
        elif event.type == 'charge.refunded':
            charge = event.data.object
            payment_intent_id = charge.payment_intent
            logger.info(f'Charge {charge.id} (for PI {payment_intent_id}) refunded.')
            payment = db.query(Payment).filter(Payment.external_id == payment_intent_id, Payment.provider == 'stripe').first()
            if payment:
                if payment.status != PaymentStatus.REFUNDED.value:
                    payment.status = PaymentStatus.REFUNDED.value
                    payment.payment_metadata = {**payment.payment_metadata, f'webhook_charge_refunded_{charge.id}': event.to_dict_recursive(), 'refunded_amount_from_charge': charge.amount_refunded / 100}
                    await audit_service.create_audit_log(event_type=AuditEventType.REFUND_SUCCESS, event_status=AuditEventStatus.SUCCESS, action_performed='Stripe charge refunded (webhook).', resource_type='Payment', resource_id=str(payment.id), details={'external_id': payment_intent_id, 'charge_id': charge.id, 'refunded_amount': charge.amount_refunded / 100}, commit=True)
                    db.commit()
                else:
                    logger.info(f'PaymentIntent {payment_intent_id} already marked as REFUNDED. Refund event for charge {charge.id} noted.')
            else:
                logger.warning(f'Received {event.type} for charge {charge.id} linked to unknown PaymentIntent {payment_intent_id}')
                await audit_service.create_audit_log(event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.WARNING, action_performed=f'Stripe event {event.type} for charge on unknown PI.', details={'charge_id': charge.id, 'payment_intent_id': payment_intent_id, 'event_id': event.id}, commit=True)
        else:
            logger.info(f'Received unhandled Stripe event type: {event.type}')
            await audit_service.create_audit_log(event_type=AuditEventType.WEBHOOK_UNHANDLED, event_status=AuditEventStatus.INFO, action_performed=f'Stripe webhook event type {event.type} received but not handled.', details={'event_id': event.id, 'event_type': event.type}, commit=True)
    except Exception as e:
        logger.error(f"Error processing Stripe webhook event {(event.id if 'event' in locals() else 'UNKNOWN_EVENT_ID')}: {str(e)}", exc_info=True)
        await audit_service.create_audit_log(event_type=AuditEventType.WEBHOOK_PROCESSING_ERROR, event_status=AuditEventStatus.FAILURE, action_performed='Stripe webhook event processing failed with exception.', details={'event_id': event.id if 'event' in locals() else 'N/A', 'event_type': event.type if 'event' in locals() else 'N/A', 'error': str(e)}, commit=True)
    return {'status': 'success', 'message': 'Webhook received'}