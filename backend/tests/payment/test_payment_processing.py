"""
Payment Processing Tests
"""
import pytest
from httpx import AsyncClient
from decimal import Decimal
import uuid
from unittest.mock import Mock, patch
from app.main import app
from tests.fixtures.database import test_db, test_restaurant, test_order
from tests.fixtures.auth import auth_headers
from app.services.payment_providers import PaymentStatus


@pytest.mark.asyncio
class TestPaymentProcessing:
    """Test payment processing flows"""
    
    async def test_payment_amount_validation(self, test_db, test_order, auth_headers):
        """Test that payment amounts cannot be tampered with"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Try to pay with incorrect amount
            response = await client.post(
                f"/api/v1/orders/{test_order.id}/payment",
                json={
                    "payment_method": "card",
                    "amount": 0.01,  # Much less than order total
                },
                headers=auth_headers
            )
            
            # Should reject incorrect amount
            assert response.status_code == 400
            assert "amount" in response.json().get("detail", "").lower()
    
    async def test_payment_idempotency(self, test_db, test_order, auth_headers):
        """Test that payments are idempotent"""
        idempotency_key = str(uuid.uuid4())
        
        async with AsyncClient(app=app, base_url="http://test") as client:
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
    
    @patch('app.services.payment_factory.PaymentProviderFactory.get_provider')
    async def test_payment_provider_fallback(self, mock_get_provider, test_db, test_order, auth_headers):
        """Test payment provider fallback mechanism"""
        # Mock primary provider failure
        primary_provider = Mock()
        primary_provider.process_payment.side_effect = Exception("Provider unavailable")
        
        # Mock fallback provider success
        fallback_provider = Mock()
        fallback_provider.process_payment.return_value = {
            "status": PaymentStatus.COMPLETED,
            "transaction_id": "fallback_tx_123",
            "amount": test_order.total_amount
        }
        
        mock_get_provider.side_effect = [primary_provider, fallback_provider]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                f"/api/v1/orders/{test_order.id}/payment",
                json={
                    "payment_method": "card",
                    "amount": float(test_order.total_amount),
                },
                headers=auth_headers
            )
            
            # Should succeed with fallback
            assert response.status_code == 200
            assert mock_get_provider.call_count >= 2  # Called for fallback
    
    async def test_fee_calculation(self, test_db, test_order, auth_headers):
        """Test payment fee calculation"""
        test_cases = [
            ("cash", 0.0),  # No fee for cash
            ("qr_code", 0.012),  # 1.2% for QR
            ("card", 0.029),  # 2.9% for card
            ("apple_pay", 0.029),  # 2.9% for Apple Pay
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for payment_method, expected_fee_rate in test_cases:
                response = await client.post(
                    "/api/v1/orders/calculate-fees",
                    json={
                        "amount": 100.00,
                        "payment_method": payment_method,
                    },
                    headers=auth_headers
                )
                
                assert response.status_code == 200
                result = response.json()
                
                expected_fee = 100.00 * expected_fee_rate
                assert abs(result["fee_amount"] - expected_fee) < 0.01
                assert result["net_amount"] == 100.00 - expected_fee
    
    async def test_refund_authorization(self, test_db, test_order, auth_headers, employee_headers):
        """Test refund authorization"""
        # First, mark order as paid
        test_order.payment_status = "completed"
        test_db.commit()
        
        async with AsyncClient(app=app, base_url="http://test") as client:
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
    
    async def test_partial_refund(self, test_db, test_order, auth_headers):
        """Test partial refund functionality"""
        # Mark order as paid
        test_order.payment_status = "completed"
        test_db.commit()
        
        async with AsyncClient(app=app, base_url="http://test") as client:
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
    
    async def test_webhook_validation(self, test_db, auth_headers):
        """Test payment webhook validation"""
        webhook_data = {
            "event_type": "payment.completed",
            "payment_id": "test_payment_123",
            "amount": 100.00,
            "timestamp": "2024-01-01T00:00:00Z"
        }
        
        # Test with valid signature
        import hmac
        import hashlib
        import json
        
        webhook_secret = "test_webhook_secret"
        payload = json.dumps(webhook_data, sort_keys=True)
        signature = hmac.new(
            webhook_secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/webhooks/payment",
                json=webhook_data,
                headers={
                    "X-Webhook-Signature": signature,
                    "Content-Type": "application/json"
                }
            )
            
            # Should accept valid webhook
            assert response.status_code == 200
            
            # Test with invalid signature
            response = await client.post(
                "/api/v1/webhooks/payment",
                json=webhook_data,
                headers={
                    "X-Webhook-Signature": "invalid_signature",
                    "Content-Type": "application/json"
                }
            )
            
            # Should reject invalid signature
            assert response.status_code in [401, 403]