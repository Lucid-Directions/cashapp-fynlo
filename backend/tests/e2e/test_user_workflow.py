"""
End-to-End User Workflow Tests
Tests real user journeys without mocks
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import uuid

from app.models import Order, OrderItem, Payment


@pytest.mark.asyncio
class TestCompleteOrderWorkflow:
    """Test the complete order workflow as a real user would experience it"""
    
    async def test_restaurant_staff_order_flow(
        self, 
        client: AsyncClient,
        db_session: AsyncSession,
        test_restaurant,
        test_user,
        test_category,
        test_product,
        auth_headers,
        redis_client
    ):
        """Test complete order flow: create order → add items → process payment → complete"""
        
        # Step 1: Staff logs in (already have auth_headers)
        # Verify authentication works
        response = await client.get("/api/v1/users/me", headers=auth_headers)
        assert response.status_code == 200
        user_data = response.json()
        assert user_data["email"] == test_user.email
        
        # Step 2: Get menu to show customer
        response = await client.get(
            f"/api/v1/restaurants/{test_restaurant.id}/menu",
            headers=auth_headers
        )
        assert response.status_code == 200
        menu_data = response.json()
        assert len(menu_data["categories"]) > 0
        assert menu_data["categories"][0]["products"][0]["id"] == test_product.id
        
        # Step 3: Create new order for table
        order_data = {
            "table_number": "5",
            "order_type": "dine_in",
            "notes": "No onions please"
        }
        response = await client.post(
            "/api/v1/orders",
            json=order_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        order = response.json()
        order_id = order["id"]
        assert order["status"] == "pending"
        assert order["table_number"] == "5"
        
        # Step 4: Add items to order
        order_items = [
            {
                "product_id": test_product.id,
                "quantity": 2,
                "notes": "Extra cheese"
            }
        ]
        response = await client.post(
            f"/api/v1/orders/{order_id}/items",
            json={"items": order_items},
            headers=auth_headers
        )
        assert response.status_code == 200
        updated_order = response.json()
        assert len(updated_order["items"]) == 1
        assert updated_order["items"][0]["quantity"] == 2
        assert updated_order["total_amount"] == test_product.price * 2
        
        # Step 5: Process payment (cash)
        payment_data = {
            "payment_method": "cash",
            "amount": updated_order["total_amount"],
            "cash_received": 30.00,
            "change_given": 30.00 - updated_order["total_amount"]
        }
        response = await client.post(
            f"/api/v1/orders/{order_id}/payment",
            json=payment_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        payment_result = response.json()
        assert payment_result["status"] == "completed"
        assert payment_result["order"]["payment_status"] == "paid"
        
        # Step 6: Complete order
        response = await client.put(
            f"/api/v1/orders/{order_id}/status",
            json={"status": "completed"},
            headers=auth_headers
        )
        assert response.status_code == 200
        completed_order = response.json()
        assert completed_order["status"] == "completed"
        
        # Verify order in database
        db_order = await db_session.get(Order, order_id)
        assert db_order is not None
        assert db_order.status == "completed"
        assert db_order.payment_status == "paid"
        assert db_order.total_amount == test_product.price * 2
        
        # Verify Redis cache was updated
        cached_order = await redis_client.get(f"order:{order_id}")
        assert cached_order is not None


@pytest.mark.asyncio
class TestCardPaymentWorkflow:
    """Test card payment processing with real payment provider in test mode"""
    
    async def test_card_payment_flow(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_restaurant,
        test_user,
        test_product,
        auth_headers
    ):
        """Test card payment flow using Stripe test mode"""
        
        # Create order
        order_data = {
            "table_number": "3",
            "order_type": "dine_in"
        }
        response = await client.post(
            "/api/v1/orders",
            json=order_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        order = response.json()
        order_id = order["id"]
        
        # Add items
        order_items = [{"product_id": test_product.id, "quantity": 1}]
        response = await client.post(
            f"/api/v1/orders/{order_id}/items",
            json={"items": order_items},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Process card payment (using test card)
        payment_data = {
            "payment_method": "card",
            "amount": test_product.price,
            "provider": "stripe",
            "test_mode": True,  # Use test card
            "card_details": {
                "number": "4242424242424242",  # Stripe test card
                "exp_month": 12,
                "exp_year": 2025,
                "cvc": "123"
            }
        }
        response = await client.post(
            f"/api/v1/orders/{order_id}/payment",
            json=payment_data,
            headers=auth_headers
        )
        
        # Payment should succeed with test card
        assert response.status_code == 200
        payment_result = response.json()
        assert payment_result["status"] in ["completed", "processing"]
        assert "payment_id" in payment_result
        
        # Verify payment record in database
        payments = await db_session.execute(
            "SELECT * FROM payments WHERE order_id = :order_id",
            {"order_id": order_id}
        )
        payment_record = payments.first()
        assert payment_record is not None


@pytest.mark.asyncio 
class TestMultiTenantWorkflow:
    """Test multi-tenant isolation in real scenarios"""
    
    async def test_restaurant_isolation(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_restaurant,
        auth_headers
    ):
        """Test that restaurants cannot access each other's data"""
        
        # Create a second restaurant
        restaurant2 = Restaurant(
            id=str(uuid.uuid4()),
            name="Competitor Restaurant",
            email="competitor@restaurant.com",
            # ... other required fields
        )
        db_session.add(restaurant2)
        await db_session.commit()
        
        # Create user for second restaurant
        user2 = User(
            id=str(uuid.uuid4()),
            email="competitor@user.com",
            restaurant_id=restaurant2.id,
            role="manager"
        )
        db_session.add(user2)
        await db_session.commit()
        
        # Try to access restaurant2's data with restaurant1's auth
        response = await client.get(
            f"/api/v1/restaurants/{restaurant2.id}",
            headers=auth_headers
        )
        assert response.status_code == 403  # Forbidden
        
        # Verify can still access own restaurant
        response = await client.get(
            f"/api/v1/restaurants/{test_restaurant.id}",
            headers=auth_headers
        )
        assert response.status_code == 200


@pytest.mark.asyncio
class TestRealTimeUpdates:
    """Test WebSocket real-time updates"""
    
    async def test_order_status_websocket(
        self,
        client: AsyncClient,
        test_restaurant,
        auth_headers
    ):
        """Test real-time order status updates via WebSocket"""
        # This would require WebSocket client setup
        # For now, we'll test the REST endpoints that trigger WS events
        
        # Create order
        response = await client.post(
            "/api/v1/orders",
            json={"table_number": "1", "order_type": "dine_in"},
            headers=auth_headers
        )
        order = response.json()
        order_id = order["id"]
        
        # Update status (this should trigger WebSocket event)
        response = await client.put(
            f"/api/v1/orders/{order_id}/status",
            json={"status": "preparing"},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # In real test, we'd connect WebSocket client and verify event received