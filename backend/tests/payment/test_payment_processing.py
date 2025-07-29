"""
Payment Processing Tests - Real Integration
No mocks - uses actual payment services in test mode
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal
import uuid
import os
from datetime import datetime

from app.models import Order, Payment


@pytest.mark.asyncio
class TestPaymentProcessing:
    """Test payment processing flows with real services"""
    
    async def test_payment_amount_validation(
        self, 
        client: AsyncClient,
        db_session: AsyncSession,
        test_order,
        auth_headers
    ):
        """Test that payment amounts cannot be tampered with"""
        # Try to pay with incorrect amount
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/payment",
            json={
                "payment_method": "card",
                "amount": 0.01,  # Much less than order total
                "provider": "stripe",
                "test_mode": True
            },
            headers=auth_headers
        )
        
        # Should reject incorrect amount
        assert response.status_code == 400
        assert "amount" in response.json().get("detail", "").lower()
    
    async def test_payment_idempotency(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_order,
        auth_headers,
        redis_client
    ):
        """Test that payments are idempotent using Redis"""
        idempotency_key = str(uuid.uuid4())
        
        # First payment attempt
        response1 = await client.post(
            f"/api/v1/orders/{test_order.id}/payment",
            json={
                "payment_method": "cash",
                "amount": float(test_order.total_amount),
            },
            headers={**auth_headers, "Idempotency-Key": idempotency_key}
        )
        
        assert response1.status_code == 200
        payment1 = response1.json()
        
        # Verify idempotency key stored in Redis
        cached_result = await redis_client.get(f"idempotency:{idempotency_key}")
        assert cached_result is not None
        
        # Second payment with same idempotency key
        response2 = await client.post(
            f"/api/v1/orders/{test_order.id}/payment",
            json={
                "payment_method": "cash",
                "amount": float(test_order.total_amount),
            },
            headers={**auth_headers, "Idempotency-Key": idempotency_key}
        )
        
        assert response2.status_code == 200
        payment2 = response2.json()
        
        # Should return same payment
        assert payment1["id"] == payment2["id"]
        
        # Verify only one payment in database
        payments = await db_session.execute(
            "SELECT COUNT(*) FROM payments WHERE order_id = :order_id",
            {"order_id": test_order.id}
        )
        assert payments.scalar() == 1
    
    @pytest.mark.skipif(
        not all([os.getenv("STRIPE_TEST_SECRET_KEY"), os.getenv("SQUARE_SANDBOX_ACCESS_TOKEN")]),
        reason="Multiple payment providers not configured"
    )
    async def test_real_payment_provider_fallback(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_order,
        auth_headers
    ):
        """Test real payment provider fallback mechanism"""
        # Configure to use Square first, then Stripe as fallback
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/payment",
            json={
                "payment_method": "card",
                "amount": float(test_order.total_amount),
                "providers": ["square", "stripe"],  # Order of preference
                "card_details": {
                    "number": "4000000000000069",  # Card that fails on Square
                    "exp_month": 12,
                    "exp_year": 2025,
                    "cvc": "123"
                },
                "enable_fallback": True
            },
            headers=auth_headers
        )
        
        # Should succeed with fallback to Stripe
        assert response.status_code == 200
        result = response.json()
        assert result["provider_used"] == "stripe"  # Fallback provider
        assert result["status"] == "completed"
    
    async def test_fee_calculation(
        self,
        client: AsyncClient,
        test_restaurant,
        auth_headers
    ):
        """Test payment fee calculation with real configuration"""
        test_cases = [
            ("cash", 0.0),  # No fee for cash
            ("qr_code", 0.012),  # 1.2% for QR
            ("card", 0.029),  # 2.9% for card
            ("apple_pay", 0.029),  # 2.9% for Apple Pay
        ]
        
        for payment_method, expected_fee_rate in test_cases:
            response = await client.post(
                "/api/v1/orders/calculate-fees",
                json={
                    "amount": 100.00,
                    "payment_method": payment_method,
                    "restaurant_id": test_restaurant.id
                },
                headers=auth_headers
            )
            
            assert response.status_code == 200
            result = response.json()
            
            expected_fee = 100.00 * expected_fee_rate
            assert abs(result["fee_amount"] - expected_fee) < 0.01
            assert result["net_amount"] == 100.00 - expected_fee
    
    async def test_refund_authorization(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_order,
        test_user,
        test_restaurant,
        auth_headers
    ):
        """Test refund authorization with real role checks"""
        # Create payment record
        payment = Payment(
            id=str(uuid.uuid4()),
            order_id=test_order.id,
            amount=test_order.total_amount,
            payment_method="cash",
            status="completed",
            created_at=datetime.utcnow()
        )
        db_session.add(payment)
        
        # Update order status
        test_order.payment_status = "paid"
        await db_session.commit()
        
        # Create employee user
        from app.models import User
        employee = User(
            id=str(uuid.uuid4()),
            email="employee@test.com",
            full_name="Test Employee",
            role="employee",  # Lower privilege
            restaurant_id=test_restaurant.id,
            is_active=True
        )
        db_session.add(employee)
        await db_session.commit()
        
        # Create employee auth headers
        from app.core.auth import create_access_token
        from datetime import timedelta
        employee_token = create_access_token(
            data={
                "sub": employee.email,
                "user_id": employee.id,
                "restaurant_id": employee.restaurant_id,
                "role": employee.role
            },
            expires_delta=timedelta(minutes=30)
        )
        employee_headers = {"Authorization": f"Bearer {employee_token}"}
        
        # Employee should not be able to refund
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/refund",
            json={
                "amount": float(test_order.total_amount),
                "reason": "Customer request"
            },
            headers=employee_headers
        )
        
        assert response.status_code == 403
        
        # Manager should be able to refund
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/refund",
            json={
                "amount": float(test_order.total_amount),
                "reason": "Customer request"
            },
            headers=auth_headers  # Manager headers
        )
        
        assert response.status_code in [200, 201]
    
    async def test_partial_refund(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_order,
        auth_headers
    ):
        """Test partial refund functionality with real payment records"""
        # Create payment
        payment = Payment(
            id=str(uuid.uuid4()),
            order_id=test_order.id,
            amount=test_order.total_amount,
            payment_method="card",
            provider="stripe",
            status="completed",
            provider_payment_id="pi_test_123"
        )
        db_session.add(payment)
        test_order.payment_status = "paid"
        await db_session.commit()
        
        # Request partial refund
        refund_amount = float(test_order.total_amount) / 2
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/refund",
            json={
                "amount": refund_amount,
                "reason": "Partial refund - item returned"
            },
            headers=auth_headers
        )
        
        assert response.status_code in [200, 201]
        refund = response.json()
        
        assert refund["amount"] == refund_amount
        assert refund["type"] == "partial"
        
        # Verify refund in database
        refunds = await db_session.execute(
            "SELECT * FROM refunds WHERE order_id = :order_id",
            {"order_id": test_order.id}
        )
        refund_record = refunds.first()
        assert refund_record is not None
        assert float(refund_record.amount) == refund_amount
    
    @pytest.mark.skipif(
        not os.getenv("STRIPE_TEST_WEBHOOK_SECRET"),
        reason="Stripe webhook secret not configured"
    )
    async def test_real_webhook_validation(
        self,
        client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test real Stripe webhook validation"""
        import stripe
        import time
        
        # Create real Stripe webhook event
        timestamp = int(time.time())
        payload = {
            "id": "evt_test_webhook",
            "object": "event",
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": "pi_test_123",
                    "amount": 10000,  # $100.00
                    "currency": "usd",
                    "status": "succeeded"
                }
            }
        }
        
        # Generate real Stripe signature
        import json
        payload_string = json.dumps(payload)
        secret = os.getenv("STRIPE_TEST_WEBHOOK_SECRET")
        
        signature_payload = f"{timestamp}.{payload_string}"
        import hmac
        import hashlib
        expected_sig = hmac.new(
            secret.encode('utf-8'),
            signature_payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        signature = f"t={timestamp},v1={expected_sig}"
        
        # Test webhook endpoint
        response = await client.post(
            "/api/v1/webhooks/stripe",
            content=payload_string,
            headers={
                "Stripe-Signature": signature,
                "Content-Type": "application/json"
            }
        )
        
        # Should accept valid webhook
        assert response.status_code == 200
        
        # Test with invalid signature
        response = await client.post(
            "/api/v1/webhooks/stripe",
            json=payload,
            headers={
                "Stripe-Signature": "invalid_signature",
                "Content-Type": "application/json"
            }
        )
        
        # Should reject invalid signature
        assert response.status_code in [400, 401, 403]