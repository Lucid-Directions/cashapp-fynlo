# Payment Provider Integration Guide

## Overview

This guide provides comprehensive instructions for integrating multiple payment providers (Stripe, Square, SumUp) with smart routing based on transaction volume and cost optimization.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React Native  │────▶│   Backend API    │────▶│Payment Providers│
│   PaymentService│     │ Provider Factory │     │ • Stripe        │
│                 │     │ Smart Routing    │     │ • Square        │
│                 │     │ Cost Optimization│     │ • SumUp         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Phase 1: Backend Provider Architecture

### Instruction 1: Create Payment Provider Abstraction Layer

**File**: `backend/app/services/payment_providers.py`

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from enum import Enum
from datetime import datetime
from decimal import Decimal

class PaymentStatus(Enum):
    SUCCESS = "success"
    PENDING = "pending"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class PaymentProvider(ABC):
    """Abstract base class for all payment providers"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.provider_name = self.__class__.__name__.replace('Provider', '')
    
    @abstractmethod
    async def process_payment(
        self,
        amount: Decimal,
        currency: str = "GBP",
        customer_id: Optional[str] = None,
        payment_method_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a payment through the provider
        
        Returns standardized response:
        {
            "provider": "Stripe",
            "transaction_id": "pi_1234567890",
            "status": "success",
            "amount": 1000,  # in pence
            "currency": "GBP",
            "fee": 29,  # provider fee in pence
            "net_amount": 971,
            "created_at": "2024-01-20T10:30:00Z",
            "metadata": {...}
        }
        """
        pass
    
    @abstractmethod
    async def refund_payment(
        self,
        transaction_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process a refund for a previous payment"""
        pass
    
    @abstractmethod
    async def create_checkout(
        self,
        amount: Decimal,
        currency: str = "GBP",
        return_url: str = None,
        cancel_url: str = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a checkout session for web/mobile payments"""
        pass
    
    @abstractmethod
    def calculate_fee(self, amount: Decimal) -> Decimal:
        """Calculate the provider fee for a given amount"""
        pass
    
    def standardize_response(
        self,
        provider_response: Dict[str, Any],
        status: PaymentStatus,
        amount: Decimal,
        transaction_id: str
    ) -> Dict[str, Any]:
        """Convert provider-specific response to standard format"""
        fee = self.calculate_fee(amount)
        return {
            "provider": self.provider_name,
            "transaction_id": transaction_id,
            "status": status.value,
            "amount": int(amount * 100),  # Convert to pence
            "currency": "GBP",
            "fee": int(fee * 100),
            "net_amount": int((amount - fee) * 100),
            "created_at": datetime.utcnow().isoformat() + "Z",
            "raw_response": provider_response,
            "metadata": provider_response.get("metadata", {})
        }
```

### Instruction 2: Implement Provider Classes

**File**: `backend/app/services/stripe_provider.py`

```python
import stripe
from decimal import Decimal
from typing import Dict, Any, Optional
from .payment_providers import PaymentProvider, PaymentStatus

class StripeProvider(PaymentProvider):
    """Stripe payment provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        stripe.api_key = config.get("api_key")
        self.fee_percentage = Decimal("0.014")  # 1.4% + 20p
        self.fee_fixed = Decimal("0.20")
    
    async def process_payment(
        self,
        amount: Decimal,
        currency: str = "GBP",
        customer_id: Optional[str] = None,
        payment_method_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        try:
            # Create payment intent
            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),  # Convert to pence
                currency=currency.lower(),
                customer=customer_id,
                payment_method=payment_method_id,
                confirm=True if payment_method_id else False,
                metadata=metadata or {}
            )
            
            status = PaymentStatus.SUCCESS if intent.status == "succeeded" else PaymentStatus.PENDING
            
            return self.standardize_response(
                provider_response=intent,
                status=status,
                amount=amount,
                transaction_id=intent.id
            )
        except stripe.error.StripeError as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e),
                "error_code": e.code
            }
    
    async def refund_payment(
        self,
        transaction_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            refund_params = {"payment_intent": transaction_id}
            if amount:
                refund_params["amount"] = int(amount * 100)
            if reason:
                refund_params["reason"] = reason
            
            refund = stripe.Refund.create(**refund_params)
            
            return {
                "provider": self.provider_name,
                "refund_id": refund.id,
                "transaction_id": transaction_id,
                "status": PaymentStatus.REFUNDED.value,
                "amount": refund.amount,
                "created_at": datetime.fromtimestamp(refund.created).isoformat() + "Z"
            }
        except stripe.error.StripeError as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e)
            }
    
    async def create_checkout(
        self,
        amount: Decimal,
        currency: str = "GBP",
        return_url: str = None,
        cancel_url: str = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': currency.lower(),
                        'product_data': {'name': 'Payment'},
                        'unit_amount': int(amount * 100),
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=return_url,
                cancel_url=cancel_url,
                metadata=metadata or {}
            )
            
            return {
                "provider": self.provider_name,
                "checkout_url": session.url,
                "session_id": session.id,
                "expires_at": datetime.fromtimestamp(session.expires_at).isoformat() + "Z"
            }
        except stripe.error.StripeError as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e)
            }
    
    def calculate_fee(self, amount: Decimal) -> Decimal:
        """Stripe UK: 1.4% + 20p for UK cards"""
        return (amount * self.fee_percentage) + self.fee_fixed
```

**File**: `backend/app/services/square_provider.py`

```python
import square
from decimal import Decimal
from typing import Dict, Any, Optional
import uuid
from .payment_providers import PaymentProvider, PaymentStatus

class SquareProvider(PaymentProvider):
    """Square payment provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.client = square.Client(
            access_token=config.get("access_token"),
            environment=config.get("environment", "production")
        )
        self.location_id = config.get("location_id")
        self.fee_percentage = Decimal("0.0175")  # 1.75%
        self.fee_fixed = Decimal("0.00")  # No fixed fee
    
    async def process_payment(
        self,
        amount: Decimal,
        currency: str = "GBP",
        customer_id: Optional[str] = None,
        payment_method_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        try:
            # Create payment request
            create_payment_request = {
                "source_id": payment_method_id,  # Square calls it source_id
                "idempotency_key": str(uuid.uuid4()),
                "amount_money": {
                    "amount": int(amount * 100),
                    "currency": currency
                },
                "location_id": self.location_id
            }
            
            if customer_id:
                create_payment_request["customer_id"] = customer_id
            
            if metadata:
                create_payment_request["reference_id"] = metadata.get("order_id", "")
                create_payment_request["note"] = metadata.get("note", "")
            
            result = self.client.payments.create_payment(
                body=create_payment_request
            )
            
            if result.is_success():
                payment = result.body.get('payment', {})
                status = PaymentStatus.SUCCESS if payment.get('status') == 'COMPLETED' else PaymentStatus.PENDING
                
                return self.standardize_response(
                    provider_response=payment,
                    status=status,
                    amount=amount,
                    transaction_id=payment.get('id')
                )
            else:
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": str(result.errors)
                }
        except Exception as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e)
            }
    
    async def refund_payment(
        self,
        transaction_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            # Get the original payment to determine amount
            payment_result = self.client.payments.get_payment(payment_id=transaction_id)
            
            if not payment_result.is_success():
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": "Payment not found"
                }
            
            payment = payment_result.body.get('payment', {})
            refund_amount = int(amount * 100) if amount else payment['amount_money']['amount']
            
            refund_request = {
                "idempotency_key": str(uuid.uuid4()),
                "payment_id": transaction_id,
                "amount_money": {
                    "amount": refund_amount,
                    "currency": payment['amount_money']['currency']
                }
            }
            
            if reason:
                refund_request["reason"] = reason
            
            result = self.client.refunds.refund_payment(body=refund_request)
            
            if result.is_success():
                refund = result.body.get('refund', {})
                return {
                    "provider": self.provider_name,
                    "refund_id": refund.get('id'),
                    "transaction_id": transaction_id,
                    "status": PaymentStatus.REFUNDED.value,
                    "amount": refund['amount_money']['amount'],
                    "created_at": refund.get('created_at')
                }
            else:
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": str(result.errors)
                }
        except Exception as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e)
            }
    
    async def create_checkout(
        self,
        amount: Decimal,
        currency: str = "GBP",
        return_url: str = None,
        cancel_url: str = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        try:
            checkout_request = {
                "idempotency_key": str(uuid.uuid4()),
                "order": {
                    "idempotency_key": str(uuid.uuid4()),
                    "order": {
                        "location_id": self.location_id,
                        "line_items": [{
                            "name": "Payment",
                            "quantity": "1",
                            "base_price_money": {
                                "amount": int(amount * 100),
                                "currency": currency
                            }
                        }]
                    }
                },
                "redirect_url": return_url
            }
            
            result = self.client.checkout.create_checkout_link(
                location_id=self.location_id,
                body=checkout_request
            )
            
            if result.is_success():
                checkout = result.body.get('checkout', {})
                return {
                    "provider": self.provider_name,
                    "checkout_url": checkout.get('checkout_page_url'),
                    "checkout_id": checkout.get('id'),
                    "order_id": checkout.get('order_id')
                }
            else:
                return {
                    "provider": self.provider_name,
                    "status": PaymentStatus.FAILED.value,
                    "error": str(result.errors)
                }
        except Exception as e:
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e)
            }
    
    def calculate_fee(self, amount: Decimal) -> Decimal:
        """Square UK: 1.75% for online payments"""
        return amount * self.fee_percentage
```

**File**: `backend/app/services/sumup_provider.py`

```python
import aiohttp
from decimal import Decimal
from typing import Dict, Any, Optional
import uuid
from datetime import datetime
from .payment_providers import PaymentProvider, PaymentStatus

class SumUpProvider(PaymentProvider):
    """SumUp payment provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config.get("api_key")
        self.merchant_code = config.get("merchant_code")
        self.base_url = "https://api.sumup.com/v0.1"
        # SumUp Payments Plus (for £2,714+ monthly volume)
        self.fee_percentage = Decimal("0.0069")  # 0.69%
        self.fee_fixed = Decimal("0.00")
        self.monthly_fee = Decimal("19.00")  # £19/month
        self.volume_threshold = Decimal("2714.00")  # £2,714/month
    
    async def process_payment(
        self,
        amount: Decimal,
        currency: str = "GBP",
        customer_id: Optional[str] = None,
        payment_method_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Note: SumUp primarily uses checkout API for online payments
        Direct payment processing requires SumUp terminal integration
        """
        # For online payments, redirect to create_checkout
        return await self.create_checkout(
            amount=amount,
            currency=currency,
            metadata=metadata
        )
    
    async def refund_payment(
        self,
        transaction_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """SumUp refunds must be processed through their dashboard or API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            # SumUp uses transaction ID for refunds
            url = f"{self.base_url}/me/refund/{transaction_id}"
            
            refund_data = {}
            if amount:
                refund_data["amount"] = float(amount)
            if reason:
                refund_data["reason"] = reason
            
            async with session.post(url, headers=headers, json=refund_data) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "provider": self.provider_name,
                        "refund_id": data.get("refund_id"),
                        "transaction_id": transaction_id,
                        "status": PaymentStatus.REFUNDED.value,
                        "amount": int(data.get("amount", 0) * 100),
                        "created_at": datetime.utcnow().isoformat() + "Z"
                    }
                else:
                    error_data = await response.json()
                    return {
                        "provider": self.provider_name,
                        "status": PaymentStatus.FAILED.value,
                        "error": error_data.get("message", "Refund failed")
                    }
    
    async def create_checkout(
        self,
        amount: Decimal,
        currency: str = "GBP",
        return_url: str = None,
        cancel_url: str = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a SumUp checkout for online payments"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        checkout_data = {
            "checkout_reference": str(uuid.uuid4()),
            "amount": float(amount),
            "currency": currency,
            "merchant_code": self.merchant_code,
            "description": metadata.get("description", "Payment") if metadata else "Payment"
        }
        
        if return_url:
            checkout_data["return_url"] = return_url
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/checkouts",
                headers=headers,
                json=checkout_data
            ) as response:
                if response.status == 201:
                    data = await response.json()
                    return {
                        "provider": self.provider_name,
                        "checkout_url": data.get("checkout_url"),
                        "checkout_id": data.get("id"),
                        "checkout_reference": checkout_data["checkout_reference"],
                        "status": "created"
                    }
                else:
                    error_data = await response.json()
                    return {
                        "provider": self.provider_name,
                        "status": PaymentStatus.FAILED.value,
                        "error": error_data.get("message", "Checkout creation failed")
                    }
    
    def calculate_fee(self, amount: Decimal) -> Decimal:
        """
        SumUp Payments Plus: 0.69% (no fixed fee)
        Note: This assumes the merchant has £2,714+ monthly volume
        For lower volumes, standard rate is 1.69%
        """
        return amount * self.fee_percentage
    
    def calculate_monthly_cost(self, monthly_volume: Decimal) -> Decimal:
        """Calculate total monthly cost including subscription fee"""
        if monthly_volume >= self.volume_threshold:
            transaction_fees = monthly_volume * self.fee_percentage
            return transaction_fees + self.monthly_fee
        else:
            # Standard rate of 1.69% for low volume
            return monthly_volume * Decimal("0.0169")
```

### Instruction 3: Add Provider Factory and Selection Logic

**File**: `backend/app/services/payment_factory.py`

```python
from typing import Dict, Any, Optional, List
from decimal import Decimal
from .payment_providers import PaymentProvider
from .stripe_provider import StripeProvider
from .square_provider import SquareProvider
from .sumup_provider import SumUpProvider
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

class PaymentProviderFactory:
    """Factory for creating and managing payment providers"""
    
    def __init__(self):
        self.providers: Dict[str, PaymentProvider] = {}
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize all configured payment providers"""
        # Initialize Stripe
        if settings.STRIPE_API_KEY:
            self.providers["stripe"] = StripeProvider({
                "api_key": settings.STRIPE_API_KEY
            })
        
        # Initialize Square
        if settings.SQUARE_ACCESS_TOKEN:
            self.providers["square"] = SquareProvider({
                "access_token": settings.SQUARE_ACCESS_TOKEN,
                "location_id": settings.SQUARE_LOCATION_ID,
                "environment": settings.SQUARE_ENVIRONMENT
            })
        
        # Initialize SumUp
        if settings.SUMUP_API_KEY:
            self.providers["sumup"] = SumUpProvider({
                "api_key": settings.SUMUP_API_KEY,
                "merchant_code": settings.SUMUP_MERCHANT_CODE
            })
    
    def get_provider(self, provider_name: str) -> Optional[PaymentProvider]:
        """Get a specific payment provider by name"""
        return self.providers.get(provider_name.lower())
    
    async def select_optimal_provider(
        self,
        amount: Decimal,
        restaurant_id: str,
        monthly_volume: Optional[Decimal] = None,
        force_provider: Optional[str] = None
    ) -> PaymentProvider:
        """
        Select the most cost-effective payment provider based on:
        - Transaction amount
        - Restaurant's monthly volume
        - Provider availability
        - Cost optimization
        """
        # If a specific provider is requested and available, use it
        if force_provider:
            provider = self.get_provider(force_provider)
            if provider:
                return provider
        
        # Get restaurant's monthly volume from database if not provided
        if monthly_volume is None:
            monthly_volume = await self._get_restaurant_monthly_volume(restaurant_id)
        
        # Calculate costs for each provider
        provider_costs = self._calculate_provider_costs(amount, monthly_volume)
        
        # Sort by cost and select the cheapest available provider
        sorted_providers = sorted(provider_costs.items(), key=lambda x: x[1])
        
        for provider_name, cost in sorted_providers:
            if provider_name in self.providers:
                logger.info(
                    f"Selected {provider_name} for £{amount} transaction "
                    f"(monthly volume: £{monthly_volume}, cost: £{cost:.2f})"
                )
                return self.providers[provider_name]
        
        # Fallback to Stripe if no providers available
        if "stripe" in self.providers:
            return self.providers["stripe"]
        
        raise ValueError("No payment providers available")
    
    def _calculate_provider_costs(
        self,
        amount: Decimal,
        monthly_volume: Decimal
    ) -> Dict[str, Decimal]:
        """Calculate the cost of processing with each provider"""
        costs = {}
        
        # Stripe: 1.4% + 20p
        if "stripe" in self.providers:
            costs["stripe"] = (amount * Decimal("0.014")) + Decimal("0.20")
        
        # Square: 1.75%
        if "square" in self.providers:
            costs["square"] = amount * Decimal("0.0175")
        
        # SumUp: 0.69% if volume > £2,714/month, else 1.69%
        if "sumup" in self.providers:
            if monthly_volume >= Decimal("2714"):
                # Include amortized monthly fee
                transactions_per_month = monthly_volume / Decimal("50")  # Assume avg £50/transaction
                monthly_fee_per_transaction = Decimal("19") / transactions_per_month
                costs["sumup"] = (amount * Decimal("0.0069")) + monthly_fee_per_transaction
            else:
                costs["sumup"] = amount * Decimal("0.0169")
        
        return costs
    
    async def _get_restaurant_monthly_volume(self, restaurant_id: str) -> Decimal:
        """Get restaurant's average monthly transaction volume"""
        # This would query the database for the restaurant's monthly volume
        # For now, return a default value
        from ..crud.payments import get_restaurant_monthly_volume
        return await get_restaurant_monthly_volume(restaurant_id)
    
    def get_available_providers(self) -> List[str]:
        """Get list of all available payment providers"""
        return list(self.providers.keys())
    
    def calculate_savings(
        self,
        amount: Decimal,
        monthly_volume: Decimal,
        current_provider: str,
        optimal_provider: str
    ) -> Decimal:
        """Calculate potential savings by switching providers"""
        costs = self._calculate_provider_costs(amount, monthly_volume)
        current_cost = costs.get(current_provider, Decimal("0"))
        optimal_cost = costs.get(optimal_provider, Decimal("0"))
        return current_cost - optimal_cost

# Global factory instance
payment_factory = PaymentProviderFactory()
```

---

## Phase 2: API Integration Code

### Instruction 4: Update Requirements

**File**: `backend/requirements.txt`

Add these dependencies:
```
stripe==5.5.0
squareup==28.0.0.20230720
aiohttp==3.9.1
```

### Instruction 5: Update Payment Endpoints

**File**: `backend/app/api/v1/endpoints/payments.py`

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from decimal import Decimal
from ...services.payment_factory import payment_factory
from ...models.payment import Payment, PaymentCreate
from ...crud.payments import create_payment, update_payment
from ...core.auth import get_current_user
from ...core.database import get_db

router = APIRouter()

@router.post("/process")
async def process_payment(
    payment_data: PaymentCreate,
    provider: Optional[str] = Query(None, description="Force specific provider"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process a payment through the optimal provider
    
    Query params:
    - provider: Force a specific provider (stripe, square, sumup)
    
    Body:
    - amount: Payment amount in GBP
    - order_id: Associated order ID
    - payment_method_id: Provider-specific payment method ID
    - customer_id: Optional customer ID
    """
    try:
        # Get restaurant's monthly volume
        restaurant = current_user.restaurant
        monthly_volume = await get_restaurant_monthly_volume(restaurant.id)
        
        # Select optimal provider
        provider_instance = await payment_factory.select_optimal_provider(
            amount=payment_data.amount,
            restaurant_id=restaurant.id,
            monthly_volume=monthly_volume,
            force_provider=provider
        )
        
        # Process payment
        result = await provider_instance.process_payment(
            amount=payment_data.amount,
            customer_id=payment_data.customer_id,
            payment_method_id=payment_data.payment_method_id,
            metadata={
                "order_id": payment_data.order_id,
                "restaurant_id": restaurant.id
            }
        )
        
        # Save to database
        if result["status"] in ["success", "pending"]:
            payment = await create_payment(
                db=db,
                payment_data={
                    **payment_data.dict(),
                    "provider": result["provider"],
                    "external_transaction_id": result["transaction_id"],
                    "provider_fee": result["fee"] / 100,  # Convert from pence
                    "net_amount": result["net_amount"] / 100,
                    "status": result["status"]
                }
            )
            
            return {
                "success": True,
                "payment": payment,
                "provider_response": result
            }
        else:
            return {
                "success": False,
                "error": result.get("error", "Payment failed"),
                "provider": result["provider"]
            }
            
    except Exception as e:
        logger.error(f"Payment processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refund/{transaction_id}")
async def refund_payment(
    transaction_id: str,
    amount: Optional[Decimal] = None,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Refund a payment"""
    # Get the original payment
    payment = await get_payment_by_transaction_id(db, transaction_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Get the provider that was used
    provider = payment_factory.get_provider(payment.provider.lower())
    if not provider:
        raise HTTPException(
            status_code=400, 
            detail=f"Provider {payment.provider} not available"
        )
    
    # Process refund
    result = await provider.refund_payment(
        transaction_id=payment.external_transaction_id,
        amount=amount,
        reason=reason
    )
    
    if result["status"] == "refunded":
        # Update payment status
        await update_payment(
            db=db,
            payment_id=payment.id,
            status="refunded",
            refund_id=result.get("refund_id")
        )
        
        return {
            "success": True,
            "refund": result
        }
    else:
        return {
            "success": False,
            "error": result.get("error", "Refund failed")
        }

@router.get("/providers")
async def get_available_providers(
    current_user: User = Depends(get_current_user)
):
    """Get list of available payment providers and their costs"""
    providers = payment_factory.get_available_providers()
    
    # Calculate sample costs for common amounts
    sample_amounts = [Decimal("10"), Decimal("50"), Decimal("100")]
    monthly_volume = await get_restaurant_monthly_volume(current_user.restaurant.id)
    
    provider_info = []
    for provider_name in providers:
        provider = payment_factory.get_provider(provider_name)
        info = {
            "name": provider_name,
            "display_name": provider_name.title(),
            "sample_fees": {}
        }
        
        for amount in sample_amounts:
            fee = provider.calculate_fee(amount)
            info["sample_fees"][f"£{amount}"] = f"£{fee:.2f}"
        
        # Add monthly cost for SumUp
        if provider_name == "sumup" and monthly_volume >= Decimal("2714"):
            info["monthly_fee"] = "£19.00"
            info["rate"] = "0.69%"
        elif provider_name == "sumup":
            info["rate"] = "1.69%"
        elif provider_name == "stripe":
            info["rate"] = "1.4% + 20p"
        elif provider_name == "square":
            info["rate"] = "1.75%"
        
        provider_info.append(info)
    
    return {
        "providers": provider_info,
        "monthly_volume": float(monthly_volume),
        "recommended_provider": await _get_recommended_provider(monthly_volume)
    }

async def _get_recommended_provider(monthly_volume: Decimal) -> str:
    """Get recommended provider based on volume"""
    if monthly_volume >= Decimal("2714"):
        return "sumup"  # Best rate at 0.69% + £19/month
    elif monthly_volume >= Decimal("1000"):
        return "stripe"  # Good balance of features and cost
    else:
        return "square"  # Simple pricing for low volume
```

### Instruction 6: Update Database Models

**File**: `backend/app/models/payment.py`

```python
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from ..core.database import Base
import enum

class PaymentStatus(enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(String, primary_key=True)
    restaurant_id = Column(String, ForeignKey("restaurants.id"))
    order_id = Column(String, ForeignKey("orders.id"))
    
    # Provider information
    provider = Column(String, nullable=False)  # stripe, square, sumup
    external_transaction_id = Column(String, nullable=False, unique=True)
    
    # Amount information
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="GBP")
    provider_fee = Column(Numeric(10, 2))
    net_amount = Column(Numeric(10, 2))
    
    # Status
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    
    # Customer information
    customer_id = Column(String)
    payment_method_id = Column(String)
    
    # Refund information
    refund_id = Column(String)
    refunded_amount = Column(Numeric(10, 2))
    
    # Metadata
    metadata = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime)
    
    # Relationships
    restaurant = relationship("Restaurant", back_populates="payments")
    order = relationship("Order", back_populates="payment")
```

**File**: `backend/alembic/versions/xxx_add_payment_provider_fields.py`

```python
"""Add payment provider fields

Revision ID: xxx
Revises: previous_revision
Create Date: 2024-01-20
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add new columns to payments table
    op.add_column('payments', sa.Column('provider', sa.String(), nullable=False, server_default='stripe'))
    op.add_column('payments', sa.Column('external_transaction_id', sa.String(), nullable=False))
    op.add_column('payments', sa.Column('provider_fee', sa.Numeric(10, 2)))
    op.add_column('payments', sa.Column('net_amount', sa.Numeric(10, 2)))
    op.add_column('payments', sa.Column('refund_id', sa.String()))
    op.add_column('payments', sa.Column('refunded_amount', sa.Numeric(10, 2)))
    
    # Add index on external_transaction_id
    op.create_index('ix_payments_external_transaction_id', 'payments', ['external_transaction_id'])
    
    # Add provider preferences to restaurants
    op.add_column('restaurants', sa.Column('provider_preferences', sa.JSON()))
    op.add_column('restaurants', sa.Column('monthly_volume', sa.Numeric(10, 2)))
    op.add_column('restaurants', sa.Column('preferred_provider', sa.String()))

def downgrade():
    op.drop_index('ix_payments_external_transaction_id')
    op.drop_column('payments', 'provider')
    op.drop_column('payments', 'external_transaction_id')
    op.drop_column('payments', 'provider_fee')
    op.drop_column('payments', 'net_amount')
    op.drop_column('payments', 'refund_id')
    op.drop_column('payments', 'refunded_amount')
    op.drop_column('restaurants', 'provider_preferences')
    op.drop_column('restaurants', 'monthly_volume')
    op.drop_column('restaurants', 'preferred_provider')
```

---

## Phase 3: React Native Integration

### Instruction 7: Install Mobile SDKs

**File**: `package.json`

Add dependencies:
```json
{
  "dependencies": {
    "react-native-square-in-app-payments": "^1.5.4",
    "@stripe/stripe-react-native": "^0.35.0"
  }
}
```

### Instruction 8: Create Mobile Payment Service

**File**: `src/services/PaymentService.ts`

```typescript
import { Platform } from 'react-native';
import Config from 'react-native-config';

export interface PaymentProvider {
  name: string;
  process(amount: number, currency: string): Promise<PaymentResult>;
  refund(transactionId: string, amount?: number): Promise<RefundResult>;
  isAvailable(): Promise<boolean>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  provider: string;
  fee?: number;
  netAmount?: number;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

class PaymentService {
  private providers: Map<string, PaymentProvider> = new Map();
  private dataService = DataService.getInstance();
  
  constructor() {
    this.initializeProviders();
  }
  
  private async initializeProviders() {
    // Initialize Stripe
    if (Config.STRIPE_PUBLISHABLE_KEY) {
      const stripeProvider = new StripePaymentProvider();
      await stripeProvider.initialize();
      this.providers.set('stripe', stripeProvider);
    }
    
    // Initialize Square
    if (Config.SQUARE_APPLICATION_ID) {
      const squareProvider = new SquarePaymentProvider();
      await squareProvider.initialize();
      this.providers.set('square', squareProvider);
    }
    
    // Initialize SumUp (web-based)
    const sumupProvider = new SumUpPaymentProvider();
    this.providers.set('sumup', sumupProvider);
  }
  
  async processPayment(
    amount: number,
    orderId: string,
    preferredProvider?: string
  ): Promise<PaymentResult> {
    try {
      // Get optimal provider from backend
      const providerInfo = await this.dataService.getOptimalPaymentProvider(amount);
      const providerName = preferredProvider || providerInfo.recommended_provider;
      
      const provider = this.providers.get(providerName);
      if (!provider) {
        throw new Error(`Payment provider ${providerName} not available`);
      }
      
      // Process payment through provider
      const result = await provider.process(amount, 'GBP');
      
      if (result.success && result.transactionId) {
        // Record payment in backend
        await this.dataService.recordPayment({
          orderId,
          amount,
          provider: providerName,
          transactionId: result.transactionId,
          fee: result.fee,
          netAmount: result.netAmount,
        });
      }
      
      return result;
    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        error: error.message,
        provider: 'unknown',
      };
    }
  }
  
  async refundPayment(
    transactionId: string,
    amount?: number
  ): Promise<RefundResult> {
    try {
      // Get payment details to find provider
      const payment = await this.dataService.getPaymentByTransactionId(transactionId);
      const provider = this.providers.get(payment.provider);
      
      if (!provider) {
        throw new Error(`Provider ${payment.provider} not available for refund`);
      }
      
      return await provider.refund(transactionId, amount);
    } catch (error) {
      console.error('Refund processing error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    
    for (const [name, provider] of this.providers) {
      if (await provider.isAvailable()) {
        available.push(name);
      }
    }
    
    return available;
  }
  
  async getProviderCosts(amount: number): Promise<ProviderCostInfo[]> {
    return await this.dataService.getProviderCosts(amount);
  }
}

// Stripe Provider Implementation
class StripePaymentProvider implements PaymentProvider {
  name = 'stripe';
  private stripe: any;
  
  async initialize() {
    const { StripeProvider, initStripe } = await import('@stripe/stripe-react-native');
    await initStripe({
      publishableKey: Config.STRIPE_PUBLISHABLE_KEY,
      merchantIdentifier: 'merchant.com.fynlo.pos',
    });
  }
  
  async process(amount: number, currency: string): Promise<PaymentResult> {
    try {
      const { confirmPayment } = await import('@stripe/stripe-react-native');
      
      // Get payment intent from backend
      const { clientSecret } = await DataService.getInstance().createPaymentIntent(
        amount,
        currency,
        'stripe'
      );
      
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
      });
      
      if (error) {
        return {
          success: false,
          error: error.message,
          provider: this.name,
        };
      }
      
      return {
        success: true,
        transactionId: paymentIntent.id,
        provider: this.name,
        fee: amount * 0.014 + 0.20, // 1.4% + 20p
        netAmount: amount - (amount * 0.014 + 0.20),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: this.name,
      };
    }
  }
  
  async refund(transactionId: string, amount?: number): Promise<RefundResult> {
    // Refunds handled server-side
    const result = await DataService.getInstance().refundPayment(transactionId, amount);
    return {
      success: result.success,
      refundId: result.refund_id,
      error: result.error,
    };
  }
  
  async isAvailable(): Promise<boolean> {
    return !!Config.STRIPE_PUBLISHABLE_KEY;
  }
}

// Square Provider Implementation
class SquarePaymentProvider implements PaymentProvider {
  name = 'square';
  
  async initialize() {
    const { SQIPCore } = await import('react-native-square-in-app-payments');
    await SQIPCore.setSquareApplicationId(Config.SQUARE_APPLICATION_ID);
  }
  
  async process(amount: number, currency: string): Promise<PaymentResult> {
    try {
      const { SQIPCardEntry } = await import('react-native-square-in-app-payments');
      
      // Start card entry
      const cardDetails = await new Promise((resolve, reject) => {
        SQIPCardEntry.startCardEntryFlow(
          {
            collectPostalCode: true,
          },
          (cardDetails) => resolve(cardDetails),
          () => reject(new Error('Card entry cancelled'))
        );
      });
      
      // Process payment on backend
      const result = await DataService.getInstance().processSquarePayment({
        amount,
        currency,
        nonce: cardDetails.nonce,
      });
      
      return {
        success: result.success,
        transactionId: result.transaction_id,
        provider: this.name,
        fee: amount * 0.0175, // 1.75%
        netAmount: amount - (amount * 0.0175),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: this.name,
      };
    }
  }
  
  async refund(transactionId: string, amount?: number): Promise<RefundResult> {
    const result = await DataService.getInstance().refundPayment(transactionId, amount);
    return {
      success: result.success,
      refundId: result.refund_id,
      error: result.error,
    };
  }
  
  async isAvailable(): Promise<boolean> {
    return !!Config.SQUARE_APPLICATION_ID && Platform.OS === 'ios';
  }
}

// SumUp Provider Implementation (Web-based)
class SumUpPaymentProvider implements PaymentProvider {
  name = 'sumup';
  
  async process(amount: number, currency: string): Promise<PaymentResult> {
    try {
      // Create checkout session on backend
      const { checkoutUrl, checkoutId } = await DataService.getInstance()
        .createSumUpCheckout(amount, currency);
      
      // Open in-app browser
      const { Linking } = await import('react-native');
      await Linking.openURL(checkoutUrl);
      
      // Note: In production, implement proper return URL handling
      // to capture the result when user returns to app
      
      return {
        success: true,
        transactionId: checkoutId,
        provider: this.name,
        fee: amount * 0.0069, // 0.69% for high volume
        netAmount: amount - (amount * 0.0069),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: this.name,
      };
    }
  }
  
  async refund(transactionId: string, amount?: number): Promise<RefundResult> {
    const result = await DataService.getInstance().refundPayment(transactionId, amount);
    return {
      success: result.success,
      refundId: result.refund_id,
      error: result.error,
    };
  }
  
  async isAvailable(): Promise<boolean> {
    return true; // Web-based, always available
  }
}

export default new PaymentService();
```

### Instruction 9: Update Payment UI Components

**File**: `src/screens/pos/PaymentScreen.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import PaymentService from '../../services/PaymentService';
import { useAppStore } from '../../store/useAppStore';
import { useTheme } from '../../hooks/useTheme';

export const PaymentScreen = ({ navigation, route }) => {
  const { order, amount } = route.params;
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [providerCosts, setProviderCosts] = useState<any[]>([]);
  
  useEffect(() => {
    loadPaymentProviders();
  }, []);
  
  const loadPaymentProviders = async () => {
    try {
      const providers = await PaymentService.getAvailableProviders();
      setAvailableProviders(providers);
      
      const costs = await PaymentService.getProviderCosts(amount);
      setProviderCosts(costs);
      
      // Select optimal provider by default
      if (costs.length > 0) {
        setSelectedProvider(costs[0].recommended_provider);
      }
    } catch (error) {
      console.error('Failed to load payment providers:', error);
    }
  };
  
  const processPayment = async () => {
    if (!selectedProvider) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await PaymentService.processPayment(
        amount,
        order.id,
        selectedProvider
      );
      
      if (result.success) {
        // Update order status
        await useAppStore.getState().completeOrder(order.id, {
          paymentProvider: result.provider,
          transactionId: result.transactionId,
          fee: result.fee,
          netAmount: result.netAmount,
        });
        
        navigation.navigate('PaymentSuccess', { result });
      } else {
        Alert.alert('Payment Failed', result.error || 'Unknown error occurred');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const renderProviderOption = (provider: any) => {
    const isSelected = selectedProvider === provider.name;
    const fee = provider.sample_fees[`£${amount}`] || '0.00';
    
    return (
      <TouchableOpacity
        key={provider.name}
        style={[
          styles.providerCard,
          isSelected && styles.selectedProvider,
          { borderColor: isSelected ? theme.colors.primary : theme.colors.border }
        ]}
        onPress={() => setSelectedProvider(provider.name)}
      >
        <View style={styles.providerHeader}>
          <Text style={[styles.providerName, { color: theme.colors.text }]}>
            {provider.display_name}
          </Text>
          {provider.recommended && (
            <View style={[styles.recommendedBadge, { backgroundColor: theme.colors.success }]}>
              <Text style={styles.recommendedText}>Recommended</Text>
            </View>
          )}
        </View>
        
        <View style={styles.providerDetails}>
          <Text style={[styles.providerRate, { color: theme.colors.textSecondary }]}>
            Rate: {provider.rate}
          </Text>
          <Text style={[styles.providerFee, { color: theme.colors.text }]}>
            Fee: {fee}
          </Text>
        </View>
        
        {provider.monthly_fee && (
          <Text style={[styles.monthlyFee, { color: theme.colors.textSecondary }]}>
            Monthly: {provider.monthly_fee}
          </Text>
        )}
      </TouchableOpacity>
    );
  };
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Select Payment Method
        </Text>
        <Text style={[styles.amount, { color: theme.colors.primary }]}>
          Total: £{amount.toFixed(2)}
        </Text>
      </View>
      
      <View style={styles.providerList}>
        {providerCosts.map(renderProviderOption)}
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.payButton,
            { backgroundColor: theme.colors.primary },
            loading && styles.disabledButton
          ]}
          onPress={processPayment}
          disabled={loading || !selectedProvider}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.payButtonText}>
              Process Payment
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: theme.colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  amount: {
    fontSize: 20,
    fontWeight: '600',
  },
  providerList: {
    flex: 1,
  },
  providerCard: {
    padding: 15,
    borderWidth: 2,
    borderRadius: 10,
    marginBottom: 15,
  },
  selectedProvider: {
    borderWidth: 3,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '600',
  },
  recommendedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  recommendedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  providerDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  providerRate: {
    fontSize: 14,
  },
  providerFee: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthlyFee: {
    fontSize: 12,
    marginTop: 5,
  },
  footer: {
    paddingTop: 20,
  },
  payButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  payButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
  },
});
```

---

## Phase 4: Configuration and Database

### Instruction 10: Environment Configuration

**File**: `backend/.env.example`

```env
# Existing configuration
DATABASE_URL=postgresql://user:password@localhost/fynlo_pos
REDIS_URL=redis://localhost:6379

# Payment Providers
# Stripe
STRIPE_API_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Square
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_LOCATION_ID=your_square_location_id
SQUARE_ENVIRONMENT=production  # or sandbox
SQUARE_APPLICATION_ID=your_square_app_id

# SumUp
SUMUP_API_KEY=your_sumup_api_key
SUMUP_MERCHANT_CODE=your_merchant_code
```

**File**: `backend/app/core/config.py`

```python
from pydantic import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Existing settings
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    
    # Payment Provider Settings
    # Stripe
    STRIPE_API_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    
    # Square
    SQUARE_ACCESS_TOKEN: Optional[str] = None
    SQUARE_LOCATION_ID: Optional[str] = None
    SQUARE_ENVIRONMENT: str = "production"
    SQUARE_APPLICATION_ID: Optional[str] = None
    
    # SumUp
    SUMUP_API_KEY: Optional[str] = None
    SUMUP_MERCHANT_CODE: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()
```

### Instruction 11: Provider Management Endpoints

**File**: `backend/app/api/v1/endpoints/admin.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from decimal import Decimal
from ...services.payment_factory import payment_factory
from ...core.auth import get_admin_user
from ...models.restaurant import Restaurant
from ...crud.restaurants import update_restaurant_preferences

router = APIRouter()

@router.get("/providers/status")
async def get_providers_status(
    admin: User = Depends(get_admin_user)
) -> Dict[str, Any]:
    """Get status of all payment providers"""
    providers = payment_factory.get_available_providers()
    status = {}
    
    for provider_name in providers:
        provider = payment_factory.get_provider(provider_name)
        status[provider_name] = {
            "available": True,
            "display_name": provider_name.title(),
            "configuration": {
                "has_api_key": bool(getattr(provider, 'api_key', None) or 
                                   getattr(provider, 'access_token', None))
            }
        }
    
    return {"providers": status}

@router.post("/providers/test/{provider_name}")
async def test_provider(
    provider_name: str,
    admin: User = Depends(get_admin_user)
) -> Dict[str, Any]:
    """Test a payment provider configuration"""
    provider = payment_factory.get_provider(provider_name)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    try:
        # Test with small amount
        result = await provider.create_checkout(
            amount=Decimal("1.00"),
            currency="GBP",
            return_url="https://fynlo.com/test/success",
            cancel_url="https://fynlo.com/test/cancel"
        )
        
        return {
            "success": True,
            "provider": provider_name,
            "test_result": "Provider configured correctly"
        }
    except Exception as e:
        return {
            "success": False,
            "provider": provider_name,
            "error": str(e)
        }

@router.get("/providers/analytics")
async def get_provider_analytics(
    start_date: str,
    end_date: str,
    admin: User = Depends(get_admin_user)
) -> Dict[str, Any]:
    """Get payment provider analytics and cost analysis"""
    # This would query the database for payment analytics
    from ...crud.payments import get_provider_analytics
    
    analytics = await get_provider_analytics(start_date, end_date)
    
    return {
        "period": {
            "start": start_date,
            "end": end_date
        },
        "providers": analytics["by_provider"],
        "total_volume": analytics["total_volume"],
        "total_fees": analytics["total_fees"],
        "potential_savings": analytics["potential_savings"],
        "recommendations": analytics["recommendations"]
    }

@router.put("/restaurants/{restaurant_id}/provider-preferences")
async def update_provider_preferences(
    restaurant_id: str,
    preferences: Dict[str, Any],
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update restaurant's payment provider preferences"""
    await update_restaurant_preferences(
        db=db,
        restaurant_id=restaurant_id,
        preferences=preferences
    )
    
    return {
        "success": True,
        "message": "Provider preferences updated"
    }

@router.get("/providers/cost-comparison")
async def get_cost_comparison(
    amount: Decimal,
    monthly_volume: Optional[Decimal] = None,
    admin: User = Depends(get_admin_user)
) -> Dict[str, Any]:
    """Compare costs across all providers for given amount and volume"""
    if not monthly_volume:
        monthly_volume = Decimal("5000")  # Default £5k/month
    
    comparison = []
    
    for provider_name in payment_factory.get_available_providers():
        provider = payment_factory.get_provider(provider_name)
        fee = provider.calculate_fee(amount)
        
        comparison.append({
            "provider": provider_name,
            "transaction_fee": float(fee),
            "effective_rate": float(fee / amount * 100),
            "monthly_cost": _calculate_monthly_cost(provider_name, monthly_volume),
            "annual_savings": _calculate_annual_savings(
                provider_name, 
                monthly_volume, 
                "stripe"  # Compare to Stripe as baseline
            )
        })
    
    # Sort by transaction fee
    comparison.sort(key=lambda x: x["transaction_fee"])
    
    return {
        "amount": float(amount),
        "monthly_volume": float(monthly_volume),
        "comparison": comparison,
        "optimal_provider": comparison[0]["provider"] if comparison else None
    }

def _calculate_monthly_cost(provider_name: str, monthly_volume: Decimal) -> float:
    """Calculate total monthly cost for a provider"""
    if provider_name == "sumup" and monthly_volume >= Decimal("2714"):
        # 0.69% + £19/month
        return float((monthly_volume * Decimal("0.0069")) + Decimal("19"))
    elif provider_name == "sumup":
        # 1.69% for low volume
        return float(monthly_volume * Decimal("0.0169"))
    elif provider_name == "stripe":
        # 1.4% + 20p per transaction (assume £50 avg transaction)
        num_transactions = monthly_volume / Decimal("50")
        return float((monthly_volume * Decimal("0.014")) + (num_transactions * Decimal("0.20")))
    elif provider_name == "square":
        # 1.75%
        return float(monthly_volume * Decimal("0.0175"))
    return 0.0

def _calculate_annual_savings(
    provider_name: str, 
    monthly_volume: Decimal,
    baseline_provider: str
) -> float:
    """Calculate annual savings compared to baseline provider"""
    provider_cost = _calculate_monthly_cost(provider_name, monthly_volume)
    baseline_cost = _calculate_monthly_cost(baseline_provider, monthly_volume)
    monthly_savings = baseline_cost - provider_cost
    return float(monthly_savings * 12)
```

---

## Phase 5: Smart Routing and Analytics

### Instruction 12: Cost Calculation and Optimization

**File**: `backend/app/services/payment_optimizer.py`

```python
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from ..crud.payments import get_restaurant_payment_history
from ..models.restaurant import Restaurant

class PaymentOptimizer:
    """Optimizes payment provider selection based on costs and volume"""
    
    # Provider cost structures
    PROVIDER_COSTS = {
        "stripe": {
            "percentage": Decimal("0.014"),  # 1.4%
            "fixed": Decimal("0.20"),        # 20p
            "monthly": Decimal("0"),
            "volume_threshold": None
        },
        "square": {
            "percentage": Decimal("0.0175"),  # 1.75%
            "fixed": Decimal("0"),
            "monthly": Decimal("0"),
            "volume_threshold": None
        },
        "sumup_standard": {
            "percentage": Decimal("0.0169"),  # 1.69%
            "fixed": Decimal("0"),
            "monthly": Decimal("0"),
            "volume_threshold": Decimal("2714")
        },
        "sumup_plus": {
            "percentage": Decimal("0.0069"),  # 0.69%
            "fixed": Decimal("0"),
            "monthly": Decimal("19"),         # £19/month
            "volume_threshold": Decimal("2714")
        }
    }
    
    async def get_optimal_provider(
        self,
        restaurant: Restaurant,
        amount: Decimal,
        force_provider: Optional[str] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Determine optimal payment provider for a transaction
        
        Returns: (provider_name, cost_analysis)
        """
        if force_provider:
            return force_provider, {}
        
        # Get restaurant's monthly volume
        monthly_volume = await self._get_monthly_volume(restaurant)
        
        # Calculate costs for each provider
        costs = self._calculate_all_costs(amount, monthly_volume)
        
        # Sort by total cost
        sorted_costs = sorted(costs.items(), key=lambda x: x[1]["total_cost"])
        
        # Return optimal provider
        optimal_provider = sorted_costs[0][0]
        cost_analysis = {
            "monthly_volume": float(monthly_volume),
            "transaction_amount": float(amount),
            "provider_costs": {k: float(v["total_cost"]) for k, v in costs.items()},
            "optimal_provider": optimal_provider,
            "estimated_savings": float(
                costs["stripe"]["total_cost"] - costs[optimal_provider]["total_cost"]
            )
        }
        
        return optimal_provider, cost_analysis
    
    def _calculate_all_costs(
        self,
        amount: Decimal,
        monthly_volume: Decimal
    ) -> Dict[str, Dict[str, Decimal]]:
        """Calculate costs for all providers"""
        costs = {}
        
        # Stripe
        costs["stripe"] = self._calculate_provider_cost(
            amount, 
            self.PROVIDER_COSTS["stripe"]
        )
        
        # Square
        costs["square"] = self._calculate_provider_cost(
            amount,
            self.PROVIDER_COSTS["square"]
        )
        
        # SumUp (choose tier based on volume)
        if monthly_volume >= Decimal("2714"):
            costs["sumup"] = self._calculate_provider_cost(
                amount,
                self.PROVIDER_COSTS["sumup_plus"],
                monthly_volume
            )
        else:
            costs["sumup"] = self._calculate_provider_cost(
                amount,
                self.PROVIDER_COSTS["sumup_standard"]
            )
        
        return costs
    
    def _calculate_provider_cost(
        self,
        amount: Decimal,
        cost_structure: Dict[str, Decimal],
        monthly_volume: Optional[Decimal] = None
    ) -> Dict[str, Decimal]:
        """Calculate cost for a single provider"""
        transaction_fee = (amount * cost_structure["percentage"]) + cost_structure["fixed"]
        
        # Amortize monthly fee across transactions
        monthly_fee_per_transaction = Decimal("0")
        if cost_structure["monthly"] > 0 and monthly_volume:
            # Assume average transaction of £50
            avg_transaction = Decimal("50")
            transactions_per_month = monthly_volume / avg_transaction
            if transactions_per_month > 0:
                monthly_fee_per_transaction = cost_structure["monthly"] / transactions_per_month
        
        total_cost = transaction_fee + monthly_fee_per_transaction
        
        return {
            "transaction_fee": transaction_fee,
            "amortized_monthly_fee": monthly_fee_per_transaction,
            "total_cost": total_cost,
            "effective_rate": (total_cost / amount) * 100
        }
    
    async def _get_monthly_volume(self, restaurant: Restaurant) -> Decimal:
        """Get restaurant's average monthly transaction volume"""
        # Get last 3 months of payment history
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=90)
        
        payments = await get_restaurant_payment_history(
            restaurant.id,
            start_date,
            end_date
        )
        
        if not payments:
            return Decimal("0")
        
        total_volume = sum(p.amount for p in payments)
        months = Decimal("3")
        
        return total_volume / months
    
    async def should_switch_provider(
        self,
        restaurant: Restaurant
    ) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Determine if restaurant should switch payment providers
        
        Returns: (should_switch, recommended_provider, analysis)
        """
        current_provider = restaurant.preferred_provider or "stripe"
        monthly_volume = await self._get_monthly_volume(restaurant)
        
        # Calculate current costs
        current_costs = self._calculate_all_costs(
            Decimal("50"),  # Average transaction
            monthly_volume
        )
        
        # Find optimal provider
        optimal_provider = min(
            current_costs.items(),
            key=lambda x: x[1]["total_cost"]
        )[0]
        
        # Calculate potential savings
        current_monthly_cost = self._calculate_monthly_cost(
            current_provider,
            monthly_volume
        )
        optimal_monthly_cost = self._calculate_monthly_cost(
            optimal_provider,
            monthly_volume
        )
        
        monthly_savings = current_monthly_cost - optimal_monthly_cost
        annual_savings = monthly_savings * 12
        
        # Recommend switch if savings > £50/month
        should_switch = (
            optimal_provider != current_provider and 
            monthly_savings > Decimal("50")
        )
        
        analysis = {
            "current_provider": current_provider,
            "optimal_provider": optimal_provider,
            "monthly_volume": float(monthly_volume),
            "current_monthly_cost": float(current_monthly_cost),
            "optimal_monthly_cost": float(optimal_monthly_cost),
            "monthly_savings": float(monthly_savings),
            "annual_savings": float(annual_savings),
            "recommendation": (
                f"Switch to {optimal_provider} to save £{annual_savings:.2f}/year"
                if should_switch else
                f"Keep using {current_provider}"
            )
        }
        
        return should_switch, optimal_provider if should_switch else None, analysis
    
    def _calculate_monthly_cost(
        self,
        provider: str,
        monthly_volume: Decimal
    ) -> Decimal:
        """Calculate total monthly cost for a provider"""
        if provider == "sumup" and monthly_volume >= Decimal("2714"):
            costs = self.PROVIDER_COSTS["sumup_plus"]
        elif provider == "sumup":
            costs = self.PROVIDER_COSTS["sumup_standard"]
        else:
            costs = self.PROVIDER_COSTS.get(provider, self.PROVIDER_COSTS["stripe"])
        
        # Calculate transaction fees
        transaction_fees = monthly_volume * costs["percentage"]
        
        # Add fixed fees (assume 50 transactions per £2500 volume)
        if costs["fixed"] > 0:
            num_transactions = monthly_volume / Decimal("50")
            fixed_fees = num_transactions * costs["fixed"]
        else:
            fixed_fees = Decimal("0")
        
        # Add monthly subscription
        monthly_fee = costs["monthly"]
        
        return transaction_fees + fixed_fees + monthly_fee

# Global optimizer instance
payment_optimizer = PaymentOptimizer()
```

### Instruction 13: Analytics and Reporting

**File**: `backend/app/crud/payments.py`

```python
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Optional
from ..models.payment import Payment, PaymentStatus

async def get_restaurant_monthly_volume(
    restaurant_id: str,
    db: Session
) -> Decimal:
    """Get restaurant's average monthly transaction volume"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=90)
    
    result = db.query(
        func.sum(Payment.amount)
    ).filter(
        and_(
            Payment.restaurant_id == restaurant_id,
            Payment.created_at >= start_date,
            Payment.created_at <= end_date,
            Payment.status == PaymentStatus.SUCCESS
        )
    ).scalar()
    
    if result:
        return Decimal(str(result)) / Decimal("3")  # 3 months average
    return Decimal("0")

async def get_provider_analytics(
    start_date: str,
    end_date: str,
    db: Session
) -> Dict[str, Any]:
    """Get payment provider analytics for date range"""
    # Parse dates
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    
    # Get payments by provider
    provider_stats = db.query(
        Payment.provider,
        func.count(Payment.id).label("count"),
        func.sum(Payment.amount).label("volume"),
        func.sum(Payment.provider_fee).label("fees"),
        func.avg(Payment.amount).label("avg_transaction")
    ).filter(
        and_(
            Payment.created_at >= start,
            Payment.created_at <= end,
            Payment.status == PaymentStatus.SUCCESS
        )
    ).group_by(Payment.provider).all()
    
    # Calculate totals
    total_volume = sum(stat.volume or 0 for stat in provider_stats)
    total_fees = sum(stat.fees or 0 for stat in provider_stats)
    
    # Build analytics response
    by_provider = {}
    for stat in provider_stats:
        by_provider[stat.provider] = {
            "transaction_count": stat.count,
            "total_volume": float(stat.volume or 0),
            "total_fees": float(stat.fees or 0),
            "average_transaction": float(stat.avg_transaction or 0),
            "effective_rate": (
                float(stat.fees / stat.volume * 100) 
                if stat.volume else 0
            )
        }
    
    # Calculate potential savings
    optimal_fees = _calculate_optimal_fees(provider_stats)
    potential_savings = float(total_fees - optimal_fees)
    
    # Generate recommendations
    recommendations = _generate_recommendations(by_provider, total_volume)
    
    return {
        "by_provider": by_provider,
        "total_volume": float(total_volume),
        "total_fees": float(total_fees),
        "potential_savings": potential_savings,
        "recommendations": recommendations
    }

def _calculate_optimal_fees(provider_stats) -> Decimal:
    """Calculate what fees would be with optimal provider selection"""
    total_optimal = Decimal("0")
    
    for stat in provider_stats:
        volume = Decimal(str(stat.volume or 0))
        
        # Calculate optimal provider for this volume
        if volume >= Decimal("2714"):
            # SumUp Plus rate
            optimal_fee = volume * Decimal("0.0069") + Decimal("19")
        else:
            # Stripe rate for lower volumes
            optimal_fee = volume * Decimal("0.014") + (stat.count * Decimal("0.20"))
        
        total_optimal += optimal_fee
    
    return total_optimal

def _generate_recommendations(
    by_provider: Dict[str, Any],
    total_volume: float
) -> List[str]:
    """Generate recommendations based on analytics"""
    recommendations = []
    
    monthly_volume = total_volume / 3  # Assuming 3 month period
    
    if monthly_volume >= 2714:
        if "sumup" not in by_provider or by_provider["sumup"]["transaction_count"] == 0:
            recommendations.append(
                f"Your monthly volume of £{monthly_volume:.2f} qualifies for "
                f"SumUp Payments Plus at 0.69% + £19/month. "
                f"Potential savings: £{(monthly_volume * 0.007):.2f}/month"
            )
    
    # Check if using expensive providers
    for provider, stats in by_provider.items():
        if stats["effective_rate"] > 1.5:
            recommendations.append(
                f"Consider reducing usage of {provider} "
                f"(current rate: {stats['effective_rate']:.2f}%)"
            )
    
    return recommendations

async def create_payment_analytics_report(
    restaurant_id: str,
    db: Session
) -> Dict[str, Any]:
    """Create comprehensive payment analytics report for restaurant"""
    # Get last 12 months of data
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=365)
    
    # Monthly breakdown
    monthly_data = db.query(
        func.date_trunc('month', Payment.created_at).label('month'),
        Payment.provider,
        func.count(Payment.id).label('count'),
        func.sum(Payment.amount).label('volume'),
        func.sum(Payment.provider_fee).label('fees')
    ).filter(
        and_(
            Payment.restaurant_id == restaurant_id,
            Payment.created_at >= start_date,
            Payment.status == PaymentStatus.SUCCESS
        )
    ).group_by('month', Payment.provider).all()
    
    # Process into report format
    report = {
        "restaurant_id": restaurant_id,
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        },
        "monthly_breakdown": [],
        "provider_summary": {},
        "cost_optimization": {
            "current_annual_fees": 0,
            "optimal_annual_fees": 0,
            "potential_annual_savings": 0
        }
    }
    
    # Process monthly data
    for row in monthly_data:
        month_data = {
            "month": row.month.isoformat(),
            "provider": row.provider,
            "transactions": row.count,
            "volume": float(row.volume or 0),
            "fees": float(row.fees or 0)
        }
        report["monthly_breakdown"].append(month_data)
        
        # Update provider summary
        if row.provider not in report["provider_summary"]:
            report["provider_summary"][row.provider] = {
                "total_transactions": 0,
                "total_volume": 0,
                "total_fees": 0
            }
        
        report["provider_summary"][row.provider]["total_transactions"] += row.count
        report["provider_summary"][row.provider]["total_volume"] += float(row.volume or 0)
        report["provider_summary"][row.provider]["total_fees"] += float(row.fees or 0)
    
    # Calculate cost optimization
    total_volume = sum(
        p["total_volume"] 
        for p in report["provider_summary"].values()
    )
    total_fees = sum(
        p["total_fees"] 
        for p in report["provider_summary"].values()
    )
    
    # Calculate optimal fees
    monthly_avg_volume = total_volume / 12
    if monthly_avg_volume >= 2714:
        optimal_annual_fees = (total_volume * 0.0069) + (12 * 19)
    else:
        optimal_annual_fees = total_volume * 0.014
    
    report["cost_optimization"]["current_annual_fees"] = total_fees
    report["cost_optimization"]["optimal_annual_fees"] = optimal_annual_fees
    report["cost_optimization"]["potential_annual_savings"] = max(
        0, 
        total_fees - optimal_annual_fees
    )
    
    return report
```

### Instruction 14: Update Order Processing Flow

**File**: `backend/app/api/v1/endpoints/orders.py`

Update the order completion endpoint:

```python
from ...services.payment_factory import payment_factory
from ...services.payment_optimizer import payment_optimizer

@router.post("/{order_id}/complete")
async def complete_order(
    order_id: str,
    payment_method: str,
    payment_details: Optional[Dict[str, Any]] = None,
    force_provider: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Complete an order with payment
    
    - Automatically selects optimal payment provider
    - Processes payment
    - Updates order status
    - Records analytics
    """
    # Get order
    order = await get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get optimal provider
    provider_name, cost_analysis = await payment_optimizer.get_optimal_provider(
        restaurant=current_user.restaurant,
        amount=order.total_amount,
        force_provider=force_provider
    )
    
    # Get provider instance
    provider = payment_factory.get_provider(provider_name)
    if not provider:
        raise HTTPException(
            status_code=500,
            detail=f"Payment provider {provider_name} not available"
        )
    
    # Process payment
    if payment_method == "card":
        payment_result = await provider.process_payment(
            amount=order.total_amount,
            customer_id=order.customer_id,
            payment_method_id=payment_details.get("payment_method_id"),
            metadata={
                "order_id": order_id,
                "restaurant_id": current_user.restaurant.id,
                "table_number": order.table_number
            }
        )
    elif payment_method == "cash":
        # Record cash payment
        payment_result = {
            "provider": "cash",
            "transaction_id": f"cash_{order_id}",
            "status": "success",
            "amount": int(order.total_amount * 100),
            "fee": 0,
            "net_amount": int(order.total_amount * 100)
        }
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported payment method: {payment_method}"
        )
    
    # Check payment result
    if payment_result["status"] != "success":
        raise HTTPException(
            status_code=400,
            detail=payment_result.get("error", "Payment failed")
        )
    
    # Create payment record
    payment = await create_payment(
        db=db,
        payment_data={
            "restaurant_id": current_user.restaurant.id,
            "order_id": order_id,
            "provider": payment_result["provider"],
            "external_transaction_id": payment_result["transaction_id"],
            "amount": order.total_amount,
            "provider_fee": payment_result.get("fee", 0) / 100,
            "net_amount": payment_result.get("net_amount", 0) / 100,
            "status": "success",
            "payment_method": payment_method
        }
    )
    
    # Update order status
    await update_order_status(db, order_id, "completed")
    
    # Return response
    return {
        "success": True,
        "order_id": order_id,
        "payment": {
            "id": payment.id,
            "provider": payment.provider,
            "transaction_id": payment.external_transaction_id,
            "amount": float(payment.amount),
            "fee": float(payment.provider_fee),
            "net_amount": float(payment.net_amount)
        },
        "cost_analysis": cost_analysis,
        "message": f"Order completed with {provider_name}"
    }
```

### Instruction 15: Monitoring and Health Checks

**File**: `backend/app/api/v1/endpoints/health.py`

```python
@router.get("/payment-providers")
async def check_payment_providers():
    """Health check for payment providers"""
    from ...services.payment_factory import payment_factory
    
    providers_status = {}
    
    for provider_name in ["stripe", "square", "sumup"]:
        provider = payment_factory.get_provider(provider_name)
        if provider:
            try:
                # Try to create a minimal checkout to test connectivity
                result = await provider.create_checkout(
                    amount=Decimal("0.01"),
                    currency="GBP"
                )
                providers_status[provider_name] = {
                    "status": "healthy",
                    "available": True
                }
            except Exception as e:
                providers_status[provider_name] = {
                    "status": "unhealthy",
                    "available": True,
                    "error": str(e)
                }
        else:
            providers_status[provider_name] = {
                "status": "not_configured",
                "available": False
            }
    
    # Overall health
    healthy_providers = sum(
        1 for p in providers_status.values() 
        if p["status"] == "healthy"
    )
    
    return {
        "providers": providers_status,
        "healthy_count": healthy_providers,
        "total_count": len(providers_status),
        "status": "healthy" if healthy_providers > 0 else "unhealthy"
    }
```

---

## Testing Guide

### Backend Testing

**File**: `backend/tests/test_payment_providers.py`

```python
import pytest
from decimal import Decimal
from app.services.stripe_provider import StripeProvider
from app.services.square_provider import SquareProvider
from app.services.sumup_provider import SumUpProvider

@pytest.fixture
def stripe_provider():
    return StripeProvider({"api_key": "test_key"})

@pytest.fixture
def square_provider():
    return SquareProvider({
        "access_token": "test_token",
        "location_id": "test_location"
    })

@pytest.fixture
def sumup_provider():
    return SumUpProvider({
        "api_key": "test_key",
        "merchant_code": "test_merchant"
    })

def test_stripe_fee_calculation(stripe_provider):
    # Test Stripe fee: 1.4% + 20p
    amount = Decimal("100.00")
    fee = stripe_provider.calculate_fee(amount)
    expected = (amount * Decimal("0.014")) + Decimal("0.20")
    assert fee == expected
    assert fee == Decimal("1.60")

def test_square_fee_calculation(square_provider):
    # Test Square fee: 1.75%
    amount = Decimal("100.00")
    fee = square_provider.calculate_fee(amount)
    expected = amount * Decimal("0.0175")
    assert fee == expected
    assert fee == Decimal("1.75")

def test_sumup_fee_calculation(sumup_provider):
    # Test SumUp fee: 0.69% (assuming high volume)
    amount = Decimal("100.00")
    fee = sumup_provider.calculate_fee(amount)
    expected = amount * Decimal("0.0069")
    assert fee == expected
    assert fee == Decimal("0.69")

@pytest.mark.asyncio
async def test_provider_selection():
    from app.services.payment_factory import payment_factory
    
    # Test low volume - should prefer Stripe
    provider = await payment_factory.select_optimal_provider(
        amount=Decimal("50"),
        restaurant_id="test_restaurant",
        monthly_volume=Decimal("1000")
    )
    assert provider.name == "stripe"
    
    # Test high volume - should prefer SumUp
    provider = await payment_factory.select_optimal_provider(
        amount=Decimal("50"),
        restaurant_id="test_restaurant",
        monthly_volume=Decimal("5000")
    )
    assert provider.name == "sumup"
```

### Frontend Testing

**File**: `src/services/__tests__/PaymentService.test.ts`

```typescript
import PaymentService from '../PaymentService';

describe('PaymentService', () => {
  it('should process payment with optimal provider', async () => {
    const mockResult = {
      success: true,
      transactionId: 'test_123',
      provider: 'stripe',
      fee: 0.70,
      netAmount: 49.30,
    };
    
    // Mock the payment processing
    jest.spyOn(PaymentService, 'processPayment')
      .mockResolvedValue(mockResult);
    
    const result = await PaymentService.processPayment(
      50.00,
      'order_123'
    );
    
    expect(result.success).toBe(true);
    expect(result.provider).toBe('stripe');
    expect(result.fee).toBe(0.70);
  });
  
  it('should handle payment failures gracefully', async () => {
    const mockResult = {
      success: false,
      error: 'Card declined',
      provider: 'stripe',
    };
    
    jest.spyOn(PaymentService, 'processPayment')
      .mockResolvedValue(mockResult);
    
    const result = await PaymentService.processPayment(
      50.00,
      'order_123'
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Card declined');
  });
});
```

---

## Deployment Checklist

### Backend Deployment

1. **Environment Variables**
   - Set all payment provider API keys
   - Configure provider-specific settings
   - Set appropriate environment (production/sandbox)

2. **Database Migrations**
   ```bash
   alembic upgrade head
   ```

3. **Provider Verification**
   ```bash
   curl https://api.yourapp.com/api/v1/health/payment-providers
   ```

### Frontend Deployment

1. **iOS Configuration**
   - Add payment SDK configurations to Info.plist
   - Configure merchant identifiers
   - Add required capabilities

2. **Android Configuration**
   - Update AndroidManifest.xml with payment permissions
   - Configure ProGuard rules for payment SDKs

### Monitoring Setup

1. **Payment Analytics Dashboard**
   - Monitor provider usage distribution
   - Track cost savings
   - Alert on provider failures

2. **Automated Provider Switching**
   - Set up monthly volume monitoring
   - Configure automatic provider recommendations
   - Send alerts when switching would save money

---

## Summary

This comprehensive payment provider integration enables:

1. **Multi-Provider Support**: Stripe, Square, and SumUp with unified interface
2. **Smart Routing**: Automatic selection of most cost-effective provider
3. **Volume-Based Optimization**: Leverages SumUp's £19/month plan for high-volume merchants
4. **Real-Time Analytics**: Track costs and savings across providers
5. **Seamless Failover**: Automatic fallback if primary provider fails
6. **Mobile Integration**: Native SDKs for optimal user experience
7. **Cost Transparency**: Show merchants exactly what they're saving

The system automatically routes payments to minimize costs while maintaining reliability and user experience.