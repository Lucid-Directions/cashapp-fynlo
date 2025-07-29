"""
Real Payment Provider Integration Tests
Uses sandbox/test modes of actual payment providers
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
import os
from decimal import Decimal

from app.services.payment_service import PaymentService
from app.models import Order, Payment


@pytest.mark.asyncio
class TestStripeIntegration:
    """Test real Stripe integration in test mode"""
    
    @pytest.mark.skipif(
        not os.getenv("STRIPE_TEST_SECRET_KEY"),
        reason="Stripe test credentials not configured"
    )
    async def test_stripe_payment_intent(
        self,
        db_session: AsyncSession,
        test_order
    ):
        """Test creating payment intent with Stripe"""
        payment_service = PaymentService(db_session)
        
        # Create payment intent
        result = await payment_service.create_payment_intent(
            order=test_order,
            provider="stripe",
            test_mode=True
        )
        
        assert result["status"] == "success"
        assert "client_secret" in result
        assert result["amount"] == int(test_order.total_amount * 100)  # Stripe uses cents
        
    @pytest.mark.skipif(
        not os.getenv("STRIPE_TEST_SECRET_KEY"),
        reason="Stripe test credentials not configured"
    )
    async def test_stripe_payment_confirmation(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_order,
        auth_headers
    ):
        """Test confirming a Stripe payment"""
        # First create payment intent
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/payment/intent",
            json={"provider": "stripe"},
            headers=auth_headers
        )
        assert response.status_code == 200
        intent_data = response.json()
        
        # Simulate payment confirmation (in real scenario, this comes from frontend)
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/payment/confirm",
            json={
                "provider": "stripe",
                "payment_intent_id": intent_data["payment_intent_id"],
                "status": "succeeded"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Verify payment recorded
        from sqlalchemy import select
        result = await db_session.execute(
            select(Payment).where(Payment.order_id == test_order.id)
        )
        payment = result.scalar_one_or_none()
        assert payment is not None
        assert payment.status == "completed"
        assert payment.provider == "stripe"


@pytest.mark.asyncio
class TestSquareIntegration:
    """Test real Square integration in sandbox mode"""
    
    @pytest.mark.skipif(
        not os.getenv("SQUARE_SANDBOX_ACCESS_TOKEN"),
        reason="Square sandbox credentials not configured"
    )
    async def test_square_payment(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_order,
        auth_headers
    ):
        """Test Square payment in sandbox"""
        payment_data = {
            "payment_method": "card",
            "provider": "square",
            "amount": float(test_order.total_amount),
            "source_id": "cnon:card-nonce-ok",  # Square sandbox test nonce
            "location_id": os.getenv("SQUARE_SANDBOX_LOCATION_ID")
        }
        
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/payment",
            json=payment_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "completed"
        assert "square_payment_id" in result
        
    @pytest.mark.skipif(
        not os.getenv("SQUARE_SANDBOX_ACCESS_TOKEN"),
        reason="Square sandbox credentials not configured"
    )
    async def test_square_refund(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_order,
        auth_headers
    ):
        """Test Square refund in sandbox"""
        # First create a payment
        payment = Payment(
            order_id=test_order.id,
            provider="square",
            amount=test_order.total_amount,
            status="completed",
            provider_payment_id="test-square-payment-id"
        )
        db_session.add(payment)
        await db_session.commit()
        
        # Request refund
        response = await client.post(
            f"/api/v1/payments/{payment.id}/refund",
            json={
                "amount": float(payment.amount),
                "reason": "Customer request"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "refunded"


@pytest.mark.asyncio
class TestSumUpIntegration:
    """Test real SumUp integration in test mode"""
    
    @pytest.mark.skipif(
        not os.getenv("SUMUP_SANDBOX_API_KEY"),
        reason="SumUp sandbox credentials not configured"
    )
    async def test_sumup_checkout(
        self,
        client: AsyncClient,
        test_order,
        auth_headers
    ):
        """Test SumUp checkout creation"""
        checkout_data = {
            "payment_method": "card",
            "provider": "sumup",
            "amount": float(test_order.total_amount),
            "currency": "GBP",
            "checkout_reference": f"ORDER-{test_order.order_number}",
            "return_url": "http://localhost:3000/payment/success"
        }
        
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/checkout",
            json=checkout_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.json()
        assert "checkout_id" in result
        assert "checkout_url" in result  # URL for customer to complete payment


@pytest.mark.asyncio
class TestPaymentFailureScenarios:
    """Test handling of payment failures"""
    
    async def test_insufficient_funds(
        self,
        client: AsyncClient,
        test_order,
        auth_headers
    ):
        """Test handling of insufficient funds"""
        payment_data = {
            "payment_method": "card",
            "provider": "stripe",
            "amount": float(test_order.total_amount),
            "test_scenario": "insufficient_funds"  # Special test flag
        }
        
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/payment",
            json=payment_data,
            headers=auth_headers
        )
        
        assert response.status_code == 400
        error = response.json()
        assert "insufficient_funds" in error["detail"].lower()
        
    async def test_payment_timeout(
        self,
        client: AsyncClient,
        test_order,
        auth_headers
    ):
        """Test handling of payment timeout"""
        payment_data = {
            "payment_method": "card",
            "provider": "square",
            "amount": float(test_order.total_amount),
            "test_scenario": "timeout"
        }
        
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/payment",
            json=payment_data,
            headers=auth_headers
        )
        
        assert response.status_code == 504
        error = response.json()
        assert "timeout" in error["detail"].lower()


@pytest.mark.asyncio
class TestPaymentProviderFallback:
    """Test fallback between payment providers"""
    
    async def test_automatic_fallback(
        self,
        client: AsyncClient,
        test_order,
        auth_headers
    ):
        """Test automatic fallback when primary provider fails"""
        payment_data = {
            "payment_method": "card",
            "amount": float(test_order.total_amount),
            "enable_fallback": True,
            "providers": ["square", "stripe", "sumup"]  # Order of preference
        }
        
        response = await client.post(
            f"/api/v1/orders/{test_order.id}/payment",
            json=payment_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "completed"
        assert "provider_used" in result  # Should indicate which provider succeeded