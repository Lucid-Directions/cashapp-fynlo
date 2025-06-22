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