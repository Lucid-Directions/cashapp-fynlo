"""
Order Processing Business Logic Tests
"""
import pytest
from httpx import AsyncClient
from decimal import Decimal
import uuid
from app.main import app
from tests.fixtures.database import test_db, test_restaurant, test_product, test_user
from tests.fixtures.auth import auth_headers
from app.models import Order, OrderItem


@pytest.mark.asyncio
class TestOrderProcessing:
    """Test order processing business logic"""
    
    async def test_complete_order_flow(
        self, test_db, test_restaurant, test_product, test_user, auth_headers
    ):
        """Test complete order lifecycle"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # 1. Create order
            create_response = await client.post(
                "/api/v1/orders",
                json={
                    "table_number": "5",
                    "order_type": "dine_in",
                    "items": [
                        {
                            "product_id": test_product.id,
                            "quantity": 2,
                            "price": float(test_product.price)
                        }
                    ]
                },
                headers=auth_headers
            )
            
            assert create_response.status_code == 201
            order = create_response.json()
            order_id = order["id"]
            
            # Verify calculations
            expected_subtotal = test_product.price * 2
            expected_tax = expected_subtotal * Decimal(str(test_restaurant.tax_rate / 100))
            expected_total = expected_subtotal + expected_tax
            
            assert Decimal(str(order["subtotal"])) == expected_subtotal
            assert abs(Decimal(str(order["tax_amount"])) - expected_tax) < Decimal("0.01")
            assert abs(Decimal(str(order["total_amount"])) - expected_total) < Decimal("0.01")
            
            # 2. Update order status to preparing
            status_response = await client.put(
                f"/api/v1/orders/{order_id}/status",
                json={"status": "preparing"},
                headers=auth_headers
            )
            
            assert status_response.status_code == 200
            
            # 3. Process payment
            payment_response = await client.post(
                f"/api/v1/orders/{order_id}/payment",
                json={
                    "payment_method": "cash",
                    "amount": float(order["total_amount"])
                },
                headers=auth_headers
            )
            
            assert payment_response.status_code == 200
            
            # 4. Complete order
            complete_response = await client.put(
                f"/api/v1/orders/{order_id}/status",
                json={"status": "completed"},
                headers=auth_headers
            )
            
            assert complete_response.status_code == 200
            
            # Verify final state
            final_order = await client.get(
                f"/api/v1/orders/{order_id}",
                headers=auth_headers
            )
            
            assert final_order.status_code == 200
            order_data = final_order.json()
            assert order_data["status"] == "completed"
            assert order_data["payment_status"] == "completed"
    
    async def test_order_modification_rules(
        self, test_db, test_restaurant, test_product, auth_headers
    ):
        """Test order modification business rules"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create order
            response = await client.post(
                "/api/v1/orders",
                json={
                    "table_number": "3",
                    "items": [
                        {
                            "product_id": test_product.id,
                            "quantity": 1,
                            "price": float(test_product.price)
                        }
                    ]
                },
                headers=auth_headers
            )
            
            order_id = response.json()["id"]
            
            # Can modify pending order
            modify_response = await client.put(
                f"/api/v1/orders/{order_id}/items",
                json={
                    "items": [
                        {
                            "product_id": test_product.id,
                            "quantity": 2,
                            "price": float(test_product.price)
                        }
                    ]
                },
                headers=auth_headers
            )
            
            assert modify_response.status_code == 200
            
            # Change status to preparing
            await client.put(
                f"/api/v1/orders/{order_id}/status",
                json={"status": "preparing"},
                headers=auth_headers
            )
            
            # Cannot modify order in preparation
            modify_response = await client.put(
                f"/api/v1/orders/{order_id}/items",
                json={
                    "items": [
                        {
                            "product_id": test_product.id,
                            "quantity": 3,
                            "price": float(test_product.price)
                        }
                    ]
                },
                headers=auth_headers
            )
            
            assert modify_response.status_code == 400
    
    async def test_tax_calculation_accuracy(
        self, test_db, test_restaurant, test_product, auth_headers
    ):
        """Test tax calculation for various amounts"""
        test_amounts = [
            (Decimal("10.00"), Decimal("20.0")),  # £10 at 20% = £2.00
            (Decimal("99.99"), Decimal("20.0")),  # £99.99 at 20% = £20.00
            (Decimal("0.01"), Decimal("20.0")),   # £0.01 at 20% = £0.00
            (Decimal("33.33"), Decimal("20.0")),  # £33.33 at 20% = £6.67
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for amount, tax_rate in test_amounts:
                # Update restaurant tax rate
                test_restaurant.tax_rate = float(tax_rate)
                await test_db.commit()
                
                # Update product price
                test_product.price = amount
                await test_db.commit()
                
                # Create order
                response = await client.post(
                    "/api/v1/orders",
                    json={
                        "items": [
                            {
                                "product_id": test_product.id,
                                "quantity": 1,
                                "price": float(amount)
                            }
                        ]
                    },
                    headers=auth_headers
                )
                
                assert response.status_code == 201
                order = response.json()
                
                # Calculate expected tax
                expected_tax = (amount * tax_rate / 100).quantize(Decimal("0.01"))
                actual_tax = Decimal(str(order["tax_amount"]))
                
                # Allow for rounding differences
                assert abs(actual_tax - expected_tax) <= Decimal("0.01")
    
    async def test_inventory_deduction(
        self, test_db, test_restaurant, test_product, auth_headers
    ):
        """Test inventory deduction on order"""
        initial_stock = 10
        test_product.stock_quantity = initial_stock
        test_product.track_inventory = True
        await test_db.commit()
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create order for 3 items
            response = await client.post(
                "/api/v1/orders",
                json={
                    "items": [
                        {
                            "product_id": test_product.id,
                            "quantity": 3,
                            "price": float(test_product.price)
                        }
                    ]
                },
                headers=auth_headers
            )
            
            assert response.status_code == 201
            
            # Check inventory was deducted
            await test_db.refresh(test_product)
            assert test_product.stock_quantity == initial_stock - 3
            
            # Try to order more than available
            response = await client.post(
                "/api/v1/orders",
                json={
                    "items": [
                        {
                            "product_id": test_product.id,
                            "quantity": 10,  # More than remaining stock
                            "price": float(test_product.price)
                        }
                    ]
                },
                headers=auth_headers
            )
            
            # Should fail due to insufficient stock
            assert response.status_code == 400
            assert "stock" in response.json().get("detail", "").lower()