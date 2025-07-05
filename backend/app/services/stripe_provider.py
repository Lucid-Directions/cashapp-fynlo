import stripe
from decimal import Decimal
from typing import Dict, Any, Optional
from datetime import datetime
from .payment_providers.base_provider import BasePaymentProvider, PaymentStatus

class StripeProvider(BasePaymentProvider):
    """Stripe payment provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        stripe.api_key = config.get("secret_key") # Correct key name from settings
        self.publishable_key = config.get("publishable_key")
        # Fee configuration should also come from config if possible, or have sane defaults
        self.fee_percentage = Decimal(config.get("fee_percentage", "0.014"))  # e.g., 1.4%
        self.fee_fixed = Decimal(config.get("fee_fixed", "0.20"))      # e.g., 20p
        self.provider_name = "stripe"
        # Custom settings from payment_config_*.json
        self.capture_method = config.get("custom_settings", {}).get("capture_method", "automatic")
        self.confirmation_method = config.get("custom_settings", {}).get("confirmation_method", "automatic")


    def _map_stripe_status(self, stripe_pi_status: str) -> PaymentStatus:
        status_mapping = {
            "succeeded": PaymentStatus.SUCCESS,
            "requires_payment_method": PaymentStatus.FAILED,
            "requires_confirmation": PaymentStatus.PENDING, # Or a more specific "ACTION_REQUIRED"
            "requires_action": PaymentStatus.PENDING, # Or "ACTION_REQUIRED"
            "processing": PaymentStatus.PENDING,
            "canceled": PaymentStatus.CANCELLED,
            # "requires_capture": PaymentStatus.AUTHORIZED, # If using manual capture
        }
        # If manual capture is used, 'requires_capture' means authorized.
        if stripe_pi_status == "requires_capture" and self.capture_method == "manual":
             return PaymentStatus.AUTHORIZED # Custom status if you have one, else PENDING
        return status_mapping.get(stripe_pi_status, PaymentStatus.UNKNOWN)

    async def create_payment_intent(
        self,
        amount: Decimal,
        currency: str = "GBP",
        customer_id: Optional[str] = None,
        payment_method_types: Optional[list[str]] = None, # e.g., ['card', 'klarna']
        payment_method_id: Optional[str] = None, # If payment_method_id is provided, can confirm directly
        confirm: Optional[bool] = None, # Explicitly control confirmation
        metadata: Optional[Dict[str, Any]] = None,
        setup_future_usage: Optional[str] = None # e.g., 'off_session' or 'on_session'
    ) -> Dict[str, Any]:
        try:
            intent_params = {
                "amount": int(amount * 100),  # Amount in pence/cents
                "currency": currency.lower(),
                "metadata": metadata or {},
                "capture_method": self.capture_method # 'automatic' or 'manual'
            }
            if customer_id:
                intent_params["customer"] = customer_id
            if payment_method_types:
                intent_params["payment_method_types"] = payment_method_types
            else: # Default if not provided
                intent_params["payment_method_types"] = ['card']

            if payment_method_id:
                intent_params["payment_method"] = payment_method_id
                # Determine confirmation based on explicit param or default behavior
                if confirm is None: # If confirm flag not explicitly passed
                    intent_params["confirm"] = True # Default to confirm if payment_method_id is present
                else:
                    intent_params["confirm"] = confirm
            elif confirm is True: # If trying to confirm without a payment method
                 return {
                    "provider": self.provider_name, "status": PaymentStatus.FAILED.value,
                    "error": "Cannot confirm PaymentIntent without a payment_method_id.",
                    "error_code": "parameter_missing"
                }


            if setup_future_usage and customer_id: # setup_future_usage requires customer
                intent_params["setup_future_usage"] = setup_future_usage
            
            intent = await stripe.PaymentIntent.acreate(**intent_params) # Use async version
            
            mapped_status = self._map_stripe_status(intent.status)

            response_data = {
                "provider": self.provider_name,
                "transaction_id": intent.id,
                "status": mapped_status.value,
                "client_secret": intent.client_secret if intent.client_secret else None,
                "amount": Decimal(intent.amount) / 100,
                "currency": intent.currency.upper(),
                "raw_response": intent.to_dict_recursive(),
            }
            if mapped_status == PaymentStatus.FAILED:
                response_data["error"] = intent.last_payment_error.message if intent.last_payment_error else "Payment failed without specific error message."
                response_data["error_code"] = intent.last_payment_error.code if intent.last_payment_error else "payment_failed"

            return response_data

        except stripe.error.StripeError as e:
            # Log e
            return {
                "provider": self.provider_name,
                "status": PaymentStatus.FAILED.value,
                "error": str(e.user_message or e.args[0]), # Prefer user_message
                "error_code": e.code,
                "raw_response": e.json_body
            }
        except Exception as e:
            # Log e
            return {"provider": self.provider_name, "status": PaymentStatus.FAILED.value, "error": str(e)}

    async def confirm_payment(
        self,
        payment_intent_id: str,
        payment_method_id: Optional[str] = None, # Can be a new PM or one from PI
        return_url: Optional[str] = None # For off-session confirmation or 3DS
    ) -> Dict[str, Any]:
        try:
            confirm_params = {}
            if payment_method_id:
                confirm_params["payment_method"] = payment_method_id
            if return_url: # Required for some payment methods that require redirection
                confirm_params["return_url"] = return_url

            intent = await stripe.PaymentIntent.aconfirm(payment_intent_id, **confirm_params) # Use async

            mapped_status = self._map_stripe_status(intent.status)
            response_data = {
                "provider": self.provider_name,
                "transaction_id": intent.id,
                "status": mapped_status.value,
                "client_secret": intent.client_secret if intent.client_secret else None,
                "amount": Decimal(intent.amount) / 100,
                "currency": intent.currency.upper(),
                "raw_response": intent.to_dict_recursive(),
            }
            if mapped_status == PaymentStatus.FAILED:
                response_data["error"] = intent.last_payment_error.message if intent.last_payment_error else "Payment failed during confirmation."
                response_data["error_code"] = intent.last_payment_error.code if intent.last_payment_error else "payment_confirmation_failed"

            return response_data

        except stripe.error.StripeError as e:
            return {
                "provider": self.provider_name, "status": PaymentStatus.FAILED.value,
                "error": str(e.user_message or e.args[0]), "error_code": e.code,
                "transaction_id": payment_intent_id, "raw_response": e.json_body
            }
        except Exception as e:
            return {"provider": self.provider_name, "status": PaymentStatus.FAILED.value, "error": str(e), "transaction_id": payment_intent_id}

    async def capture_payment(self, payment_intent_id: str, amount_to_capture: Optional[Decimal] = None) -> Dict[str, Any]:
        """Captures a previously authorized PaymentIntent."""
        try:
            capture_params = {}
            if amount_to_capture:
                capture_params["amount_to_capture"] = int(amount_to_capture * 100)

            intent = await stripe.PaymentIntent.acapture(payment_intent_id, **capture_params) # Use async
            mapped_status = self._map_stripe_status(intent.status)
            return {
                "provider": self.provider_name, "transaction_id": intent.id,
                "status": mapped_status.value, "amount": Decimal(intent.amount_received)/100, # amount_received after capture
                "currency": intent.currency.upper(), "raw_response": intent.to_dict_recursive()
            }
        except stripe.error.StripeError as e:
             return {
                "provider": self.provider_name, "status": PaymentStatus.FAILED.value,
                "error": str(e.user_message or e.args[0]), "error_code": e.code,
                "transaction_id": payment_intent_id, "raw_response": e.json_body
            }
        except Exception as e:
            return {"provider": self.provider_name, "status": PaymentStatus.FAILED.value, "error": str(e), "transaction_id": payment_intent_id}


    async def get_payment_intent_status(self, payment_intent_id: str) -> Dict[str, Any]:
        try:
            intent = await stripe.PaymentIntent.aretrieve(payment_intent_id) # Use async
            mapped_status = self._map_stripe_status(intent.status)
            response_data = {
                "provider": self.provider_name,
                "transaction_id": intent.id,
                "status": mapped_status.value,
                "amount": Decimal(intent.amount) / 100,
                "currency": intent.currency.upper(),
                "raw_response": intent.to_dict_recursive(),
            }
            if intent.last_payment_error:
                 response_data["last_payment_error"] = {
                     "code": intent.last_payment_error.code,
                     "message": intent.last_payment_error.message,
                     "type": intent.last_payment_error.type
                 }
            return response_data
        except stripe.error.StripeError as e:
            return {
                "provider": self.provider_name, "status": PaymentStatus.FAILED.value, # Or UNKNOWN if PI not found
                "error": str(e.user_message or e.args[0]), "error_code": e.code,
                "transaction_id": payment_intent_id, "raw_response": e.json_body
            }
        except Exception as e:
            return {"provider": self.provider_name, "status": PaymentStatus.FAILED.value, "error": str(e), "transaction_id": payment_intent_id}

    # process_payment is deprecated in favor of create_payment_intent and confirm_payment
    async def process_payment(
        self,
        amount: Decimal,
        currency: str = "GBP",
        customer_id: Optional[str] = None,
        payment_method_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        # This method should ideally be phased out or map to the new flow.
        # For now, it can call create_payment_intent with confirm=True if payment_method_id is present.
        return await self.create_payment_intent(
            amount=amount,
            currency=currency,
            customer_id=customer_id,
            payment_method_id=payment_method_id,
            confirm=True if payment_method_id else False, # Auto-confirm if PM is provided
            metadata=metadata
        )

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