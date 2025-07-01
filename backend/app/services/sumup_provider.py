import aiohttp
from decimal import Decimal
from typing import Dict, Any, Optional
import uuid
from datetime import datetime
from .payment_providers import PaymentStatus # Keep PaymentStatus if it's a shared enum
from .payment_providers.base_provider import BasePaymentProvider, RefundItemDetail # Import new base
import logging

logger = logging.getLogger(__name__)

class SumUpProvider(BasePaymentProvider): # Inherit from BasePaymentProvider
    """SumUp payment provider implementation"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(
            api_key=config.get("api_key"), # SumUp uses API key (bearer token)
            config=config
        )
        # self.api_key is now set in BasePaymentProvider
        self.merchant_code = config.get("merchant_code")
        self.base_url = config.get("base_url", "https://api.sumup.com/v0.1") # Allow override from config

        # Fee structure might be better managed via config or a dedicated fee service
        self.fee_percentage = Decimal(config.get("fee_percentage", "0.0069"))  # Default to Payments Plus
        self.fee_fixed = Decimal(config.get("fee_fixed", "0.00"))
        self.monthly_fee = Decimal(config.get("monthly_fee", "19.00"))
        self.volume_threshold = Decimal(config.get("volume_threshold", "2714.00"))
        self.provider_name = "sumup"

    async def process_payment( # This is for creating a payment/checkout
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
        transaction_id: str, # SumUp's transaction ID (e.g., "tx_...")
        amount_to_refund: Decimal,
        reason: Optional[str] = None,
        items_to_refund: Optional[List[RefundItemDetail]] = None, # SumUp API might not support itemized refunds directly on this endpoint
        order_id: Optional[str] = None, # Fynlo's order ID
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Processes a refund with SumUp.
        SumUp's /me/refund/{transaction_id} endpoint refunds the specified amount of the original transaction.
        It doesn't directly support itemized refunds via this specific endpoint; the amount is key.
        """
        if not self.api_key:
            logger.error("SumUp API key is not configured.")
            return {"success": False, "error": "SumUp provider not configured.", "status": "failed"}

        if amount_to_refund <= 0:
            logger.error(f"SumUp refund_payment error: Refund amount must be positive. Received: {amount_to_refund}")
            return {"success": False, "error": "Refund amount must be positive.", "status": "failed"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # SumUp's refund endpoint is POST /me/refund/{transaction_id}
        # The body should contain the amount to refund.
        # Note: SumUp docs mention this refunds the *full* transaction if amount is not specified or if it matches total.
        # If a partial amount is specified, it processes a partial refund.
        url = f"{self.base_url}/me/refund/{transaction_id}"

        payload: Dict[str, Any] = {
            "amount": float(amount_to_refund) # SumUp API expects float for amount
        }
        # SumUp's refund endpoint does not seem to take a 'reason' or 'items' directly in the payload.
        # The reason might be logged internally or handled differently if their API evolves.
        if reason:
            logger.info(f"SumUp refund for {transaction_id}: Reason '{reason}' noted (not sent to SumUp API directly).")
        if items_to_refund:
            logger.info(f"SumUp refund for {transaction_id}: Item details provided (not sent to SumUp API directly for this endpoint).")

        async with aiohttp.ClientSession() as session:
            try:
                logger.info(f"Attempting SumUp refund for transaction: {transaction_id}, amount: {amount_to_refund}, URL: {url}, Payload: {payload}")
                async with session.post(url, headers=headers, json=payload) as response:
                    response_text = await response.text()
                    logger.debug(f"SumUp refund response status: {response.status}, body: {response_text}")

                    if response.status == 201 or response.status == 200: # SumUp might return 201 Created or 200 OK for success
                        data = await response.json()
                        # SumUp refund response typically includes: id (refund_id), transaction_id (original), amount, currency, status, date
                        refund_status = data.get('status', 'SUCCESSFUL').upper() # Example, adapt based on actual SumUp response

                        # Map SumUp status to our internal PaymentStatus or a more generic success/pending/failed
                        current_internal_status = "processed" # Default to processed on success
                        if refund_status == "PENDING":
                            current_internal_status = "pending"
                        elif refund_status in ["FAILED", "REJECTED"]:
                             current_internal_status = "failed"


                        logger.info(f"SumUp refund successful: {data.get('id')} for transaction {transaction_id}")
                        return {
                            "success": True,
                            "refund_id": data.get("id"), # This is SumUp's refund transaction ID
                            "gateway_transaction_id": data.get("transaction_id", transaction_id), # Original payment transaction ID
                            "status": current_internal_status,
                            "amount_refunded": Decimal(str(data.get("amount"))), # Ensure it's Decimal
                            "currency": data.get("currency"),
                            "created_at": data.get("date", datetime.utcnow().isoformat() + "Z"), # SumUp calls it 'date'
                            "raw_response": data
                        }
                    else:
                        error_data = {}
                        try:
                            error_data = await response.json()
                        except Exception: # Not JSON
                            error_data = {"message": response_text, "error_code": "unknown_format"}

                        logger.error(f"SumUp refund failed for transaction {transaction_id}: Status {response.status}, Error: {error_data}")
                        return {
                            "success": False,
                            "error": error_data.get("message", f"Refund failed with status {response.status}"),
                            "status": "failed",
                            "error_details": error_data.get("error_code") or error_data.get("developer_message"),
                            "raw_response": error_data
                        }
            except aiohttp.ClientError as e:
                logger.exception(f"SumUp refund_payment aiohttp.ClientError for transaction {transaction_id}: {e}")
                return {"success": False, "error": f"HTTP client error: {str(e)}", "status": "failed"}
            except Exception as e:
                logger.exception(f"SumUp refund_payment unexpected error for transaction {transaction_id}: {e}")
                return {"success": False, "error": f"Unexpected error: {str(e)}", "status": "failed"}

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