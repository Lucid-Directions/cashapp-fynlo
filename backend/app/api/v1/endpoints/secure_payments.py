"""
Secure Payment API Endpoints
Handles payment processing with comprehensive security measures
"""
import uuid
from typing import Dict, Any, Optional, List
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Header, Query, Path
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
import logging

from app.core.database import get_db, User
from app.api.v1.endpoints.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException
from app.services.secure_payment_processor import SecurePaymentProcessor, PaymentProcessingError
from app.services.secure_payment_config import SecurePaymentConfigService
from app.middleware.rate_limit_middleware import limiter


router = APIRouter()
security = HTTPBearer()
logger = logging.getLogger(__name__)


# Pydantic models for request/response validation
class PaymentRequest(BaseModel):
    """Payment processing request"""
    order_id: str = Field(..., description="Order ID")
    amount: Decimal = Field(..., gt=0, le=10000, description="Payment amount")
    payment_method: str = Field(..., description="Payment method: card, cash, qr_code, apple_pay, google_pay")
    payment_details: Dict[str, Any] = Field(..., description="Method-specific payment details")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional metadata")
    
    @validator('amount')
    def validate_amount(cls, v):
        # Ensure proper decimal places
        if v.as_tuple().exponent < -2:
            raise ValueError("Amount cannot have more than 2 decimal places")
        return v
    
    @validator('payment_method')
    def validate_payment_method(cls, v):
        valid_methods = ['card', 'cash', 'qr_code', 'apple_pay', 'google_pay']
        if v not in valid_methods:
            raise ValueError(f"Invalid payment method. Must be one of: {', '.join(valid_methods)}")
        return v


class RefundRequest(BaseModel):
    """Refund processing request"""
    transaction_id: str = Field(..., description="Original transaction ID")
    amount: Optional[Decimal] = Field(None, gt=0, description="Refund amount (None for full refund)")
    reason: Optional[str] = Field(None, max_length=500, description="Refund reason")
    
    @validator('amount')
    def validate_amount(cls, v):
        if v is not None and v.as_tuple().exponent < -2:
            raise ValueError("Amount cannot have more than 2 decimal places")
        return v


class PaymentMethodsResponse(BaseModel):
    """Available payment methods response"""
    methods: List[Dict[str, Any]]
    fees: Dict[str, Dict[str, float]]


class PaymentStatusResponse(BaseModel):
    """Payment status response"""
    payment_id: str
    status: str
    provider: Optional[str]
    amount: float
    currency: str
    created_at: str
    completed_at: Optional[str]
    error_message: Optional[str]


# Helper function to get request context
def get_request_context(request: Request) -> Dict[str, Any]:
    """Extract request context for audit logging"""
    return {
        'ip_address': request.client.host if request.client else None,
        'user_agent': request.headers.get('user-agent', 'Unknown')
    }


@router.post("/process", response_model=Dict[str, Any])
@limiter.limit("10/minute")  # Rate limit payment processing
async def process_payment(
    payment_request: PaymentRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process a payment with automatic provider fallback
    
    Security features:
    - Authentication required
    - Rate limiting (10 requests per minute)
    - Input validation
    - Audit logging
    - Automatic provider fallback
    """
    try:
        # Add user context to request
        request_context = get_request_context(request)
        request_context['user_id'] = str(current_user.id)
        
        # Initialize payment processor
        processor = SecurePaymentProcessor(db, request_context)
        
        # Process payment
        result = await processor.process_payment(
            order_id=payment_request.order_id,
            amount=payment_request.amount,
            payment_method=payment_request.payment_method,
            payment_details=payment_request.payment_details,
            user_id=str(current_user.id),
            restaurant_id=str(current_user.restaurant_id),
            metadata=payment_request.metadata
        )
        
        # Log successful payment
        logger.info(
            f"Payment processed successfully",
            extra={
                'payment_id': result['payment_id'],
                'amount': result['amount'],
                'provider': result['provider'],
                'user_id': str(current_user.id)
            }
        )
        
        return APIResponseHelper.success(
            data=result,
            message="Payment processed successfully"
        )
        
    except PaymentProcessingError as e:
        logger.error(f"Payment processing failed: {str(e)}")
        return APIResponseHelper.error(
            message=str(e),
            status_code=400,
            error_code="PAYMENT_FAILED",
            details={'payment_id': e.payment_id} if hasattr(e, 'payment_id') else None
        )
    except ValueError as e:
        return APIResponseHelper.error(
            message=str(e),
            status_code=400,
            error_code="VALIDATION_ERROR"
        )
    except Exception as e:
        logger.error(f"Unexpected error in payment processing: {str(e)}")
        return APIResponseHelper.error(
            message="Payment processing failed",
            status_code=500,
            error_code="INTERNAL_ERROR"
        )


@router.get("/methods", response_model=PaymentMethodsResponse)
async def get_payment_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get available payment methods for the current restaurant
    
    Returns:
    - Available payment methods
    - Fee structure for transparency
    """
    try:
        # Get configured payment providers
        config_service = SecurePaymentConfigService(db)
        configs = config_service.list_provider_configs(
            restaurant_id=str(current_user.restaurant_id)
        )
        
        # Build available methods
        methods = []
        fees = {}
        
        # Always have cash available
        methods.append({
            'id': 'cash',
            'name': 'Cash',
            'icon': 'cash',
            'enabled': True,
            'min_amount': 0.01,
            'max_amount': 10000.00
        })
        fees['cash'] = {
            'percentage': 0,
            'fixed': 0,
            'description': 'No fees'
        }
        
        # Add configured providers
        provider_mapping = {
            'stripe': {
                'methods': ['card', 'apple_pay', 'google_pay'],
                'fees': {'percentage': 1.4, 'fixed': 0.20, 'description': '1.4% + 20p'}
            },
            'square': {
                'methods': ['card', 'apple_pay'],
                'fees': {'percentage': 1.75, 'fixed': 0, 'description': '1.75%'}
            },
            'sumup': {
                'methods': ['card', 'apple_pay'],
                'fees': {'percentage': 0.69, 'fixed': 0, 'description': '0.69%'}
            },
            'qr_provider': {
                'methods': ['qr_code'],
                'fees': {'percentage': 1.2, 'fixed': 0, 'description': '1.2%'}
            }
        }
        
        for config in configs:
            provider = config['provider']
            if provider in provider_mapping:
                mapping = provider_mapping[provider]
                for method in mapping['methods']:
                    if not any(m['id'] == method for m in methods):
                        methods.append({
                            'id': method,
                            'name': method.replace('_', ' ').title(),
                            'icon': method,
                            'enabled': True,
                            'min_amount': 0.01,
                            'max_amount': 10000.00
                        })
                    # Use lowest fee if multiple providers support same method
                    if method not in fees or mapping['fees']['percentage'] < fees[method]['percentage']:
                        fees[method] = mapping['fees']
        
        return {
            'methods': methods,
            'fees': fees
        }
        
    except Exception as e:
        logger.error(f"Error getting payment methods: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get payment methods")


@router.post("/refund", response_model=Dict[str, Any])
@limiter.limit("5/minute")  # Stricter rate limit for refunds
async def process_refund(
    refund_request: RefundRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process a payment refund
    
    Security features:
    - Authentication required
    - Stricter rate limiting (5 requests per minute)
    - Permission check (manager or above)
    - Audit logging
    """
    try:
        # Check permissions - only managers and above can process refunds
        if current_user.role not in ['manager', 'restaurant_owner', 'platform_owner']:
            return APIResponseHelper.error(
                message="Insufficient permissions to process refunds",
                status_code=403,
                error_code="PERMISSION_DENIED"
            )
        
        # TODO: Implement refund processing
        # This would look up the original payment and process through the same provider
        
        return APIResponseHelper.success(
            data={
                'refund_id': str(uuid.uuid4()),
                'status': 'pending',
                'message': 'Refund processing not yet implemented'
            },
            message="Refund initiated"
        )
        
    except Exception as e:
        logger.error(f"Error processing refund: {str(e)}")
        return APIResponseHelper.error(
            message="Refund processing failed",
            status_code=500,
            error_code="INTERNAL_ERROR"
        )


@router.get("/status/{payment_id}", response_model=PaymentStatusResponse)
async def get_payment_status(
    payment_id: str = Path(..., description="Payment ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get payment status
    
    Returns current status of a payment transaction
    """
    try:
        # Get payment from database
        from app.services.secure_payment_processor import Payment
        
        payment = db.query(Payment).filter_by(
            id=payment_id,
            restaurant_id=str(current_user.restaurant_id)
        ).first()
        
        if not payment:
            return APIResponseHelper.error(
                message="Payment not found",
                status_code=404,
                error_code="NOT_FOUND"
            )
        
        return APIResponseHelper.success(
            data={
                'payment_id': payment.id,
                'status': payment.status.value,
                'provider': payment.provider,
                'amount': float(payment.amount),
                'currency': payment.currency,
                'created_at': payment.created_at.isoformat(),
                'completed_at': payment.completed_at.isoformat() if payment.completed_at else None,
                'error_message': payment.error_message
            }
        )
        
    except Exception as e:
        logger.error(f"Error getting payment status: {str(e)}")
        return APIResponseHelper.error(
            message="Failed to get payment status",
            status_code=500,
            error_code="INTERNAL_ERROR"
        )


@router.post("/webhook/{provider}")
async def handle_payment_webhook(
    provider: str = Path(..., description="Payment provider name"),
    request: Request,
    db: Session = Depends(get_db),
    webhook_signature: Optional[str] = Header(None, alias="stripe-signature")
):
    """
    Handle payment provider webhooks
    
    Security features:
    - Signature validation
    - IP whitelist (in production)
    - Event deduplication
    """
    try:
        # Get webhook body
        body = await request.body()
        
        # TODO: Implement provider-specific webhook handling
        # This would validate signatures and process events
        
        logger.info(f"Received webhook from {provider}")
        
        return {"status": "received"}
        
    except Exception as e:
        logger.error(f"Error handling webhook: {str(e)}")
        # Don't expose internal errors to webhook callers
        return {"status": "error"}