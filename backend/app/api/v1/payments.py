from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field

from ...core.deps import get_db, get_current_user
from ...services.payment_router import payment_router
from ...models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Request/Response models
class ProcessPaymentRequest(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Payment amount")
    payment_method: str = Field(..., description="Payment method ID")
    currency: str = Field(default="GBP", description="Currency code")
    order_id: Optional[str] = Field(None, description="Order ID")
    customer_id: Optional[str] = Field(None, description="Customer ID")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    source_id: Optional[str] = Field(None, description="Payment source ID (for Square)")
    payment_method_id: Optional[str] = Field(None, description="Payment method ID (for Stripe)")

class RefundPaymentRequest(BaseModel):
    provider: str = Field(..., description="Payment provider name")
    transaction_id: str = Field(..., description="Original transaction ID")
    amount: Decimal = Field(..., gt=0, description="Refund amount")
    reason: Optional[str] = Field(None, description="Refund reason")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class PaymentMethodResponse(BaseModel):
    id: str
    name: str
    provider: str
    type: str
    icon: str
    enabled: bool
    fee_info: str
    processing_fee_percentage: float
    fixed_fee: Optional[float] = None
    is_recommended: Optional[bool] = False

@router.post("/process")
async def process_payment(
    request: ProcessPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Process a payment through the payment router with automatic fallback
    """
    try:
        logger.info(f"Processing payment request: {request.payment_method} for £{request.amount}")
        
        # Add user/merchant context to metadata
        if not request.metadata:
            request.metadata = {}
        request.metadata['user_id'] = current_user.id
        request.metadata['merchant_id'] = getattr(current_user, 'merchant_id', None)
        
        # Process payment through router
        result = await payment_router.process_payment(
            amount=request.amount,
            payment_method=request.payment_method,
            currency=request.currency,
            order_id=request.order_id,
            customer_id=request.customer_id,
            metadata=request.metadata,
            source_id=request.source_id,
            payment_method_id=request.payment_method_id
        )
        
        # Log result
        if result.get('success'):
            logger.info(f"Payment successful: {result.get('transaction_id')} via {result.get('provider')}")
        else:
            logger.warning(f"Payment failed: {result.get('error')} via {result.get('provider')}")
        
        return result
        
    except Exception as e:
        logger.error(f"Payment processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment processing failed: {str(e)}"
        )

@router.get("/methods")
async def get_payment_methods(
    amount: Optional[Decimal] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[PaymentMethodResponse]:
    """
    Get available payment methods with dynamic fee calculation
    """
    try:
        merchant_id = getattr(current_user, 'merchant_id', None)
        methods = await payment_router.get_available_payment_methods(
            amount=amount,
            merchant_id=merchant_id
        )
        
        # Convert to response model
        response = []
        for method in methods:
            response.append(PaymentMethodResponse(
                id=method['id'],
                name=method['name'],
                provider=method['provider'],
                type=method['type'],
                icon=method['icon'],
                enabled=method['enabled'],
                fee_info=method['fee_info'],
                processing_fee_percentage=method['processing_fee_percentage'],
                fixed_fee=method.get('fixed_fee'),
                is_recommended=method.get('is_recommended', False)
            ))
        
        return response
        
    except Exception as e:
        logger.error(f"Error fetching payment methods: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch payment methods: {str(e)}"
        )

@router.post("/refund")
async def refund_payment(
    request: RefundPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Process a refund through the appropriate payment provider
    """
    try:
        logger.info(f"Processing refund request: {request.transaction_id} for £{request.amount} via {request.provider}")
        
        # Add user context to metadata
        if not request.metadata:
            request.metadata = {}
        request.metadata['user_id'] = current_user.id
        request.metadata['refunded_by'] = current_user.email
        
        # Process refund through router
        result = await payment_router.refund_payment(
            provider=request.provider,
            transaction_id=request.transaction_id,
            amount=request.amount,
            reason=request.reason,
            metadata=request.metadata
        )
        
        # Log result
        if result.get('success'):
            logger.info(f"Refund successful: {result.get('refund_id')}")
        else:
            logger.warning(f"Refund failed: {result.get('error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"Refund processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Refund processing failed: {str(e)}"
        )

@router.get("/status/{transaction_id}")
async def get_payment_status(
    transaction_id: str,
    provider: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get the status of a payment transaction
    """
    try:
        # Get provider instance
        provider_instance = payment_router.providers.get(provider)
        if not provider_instance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Provider {provider} not available"
            )
        
        # Get payment status based on provider
        if provider == 'stripe':
            result = await provider_instance.get_payment_intent_status(transaction_id)
        elif provider == 'square':
            result = await provider_instance.get_payment_status(transaction_id)
        else:
            # Generic status check
            result = {
                'provider': provider,
                'transaction_id': transaction_id,
                'status': 'unknown',
                'message': f"Status check not implemented for {provider}"
            }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking payment status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check payment status: {str(e)}"
        )

@router.post("/webhook/{provider}")
async def payment_webhook(
    provider: str,
    webhook_data: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Handle payment provider webhooks
    """
    try:
        logger.info(f"Received webhook from {provider}")
        
        # Route to appropriate provider webhook handler
        provider_instance = payment_router.providers.get(provider)
        if not provider_instance:
            logger.warning(f"Webhook received for unknown provider: {provider}")
            return {"status": "ignored", "reason": "Unknown provider"}
        
        # Each provider should implement webhook handling
        # For now, just log and acknowledge
        logger.info(f"Webhook data from {provider}: {webhook_data}")
        
        return {"status": "acknowledged"}
        
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        # Don't raise exception for webhooks - acknowledge receipt
        return {"status": "error", "message": str(e)}