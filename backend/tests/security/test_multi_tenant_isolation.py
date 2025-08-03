"""
Multi-tenant Isolation Security Tests
"""
import pytest
from httpx import AsyncClient
import uuid
from app.main import app
from app.models import Restaurant, Order, Product


@pytest.mark.asyncio
class TestMultiTenantIsolation:
    """Test multi-tenant data isolation"""
    
    @pytest.fixture
    async def second_restaurant(self, test_db):
        """Create a second restaurant for isolation testing"""
        restaurant = Restaurant(
            id=str(uuid.uuid4()),
            name="Second Restaurant",
            address="456 Other St",
            phone="+9876543210",
            email="second@restaurant.com",
            business_type="restaurant",
            subscription_plan="beta"
        )
        test_db.add(restaurant)
        await test_db.commit()
        await test_db.refresh(restaurant)
        return restaurant
    
    @pytest.fixture
    async def second_restaurant_headers(self, second_restaurant):
        """Auth headers for second restaurant"""
        import jwt
        from datetime import datetime, timedelta
        
        token = jwt.encode(
            {
                "sub": str(uuid.uuid4()),
                "email": "owner2@restaurant.com",
                "role": "restaurant_owner",
                "restaurant_id": second_restaurant.id,
                "exp": datetime.utcnow() + timedelta(hours=1)
            },
            "test_secret",
            algorithm="HS256"
        )
        return {"Authorization": f"Bearer {token}"}
    
    async def test_cannot_access_other_restaurant_orders(
        self, test_db, test_restaurant, second_restaurant,
        restaurant_owner_headers, second_restaurant_headers
    ):
        """Test that restaurant cannot access another restaurant's orders"""
        # Create order for first restaurant
        order = Order(
            id=str(uuid.uuid4()),
            restaurant_id=test_restaurant.id,
            created_by="user1",
            status="pending",
            total_amount=100.00
        )
        test_db.add(order)
        await test_db.commit()
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Try to access with second restaurant's token
            response = await client.get(
                f"/api/v1/orders/{order.id}",
                headers=second_restaurant_headers
            )
            
            # Should be forbidden or not found
            assert response.status_code in [403, 404]
    
    async def test_cannot_list_other_restaurant_data(
        self, test_db, test_restaurant, second_restaurant,
        restaurant_owner_headers, second_restaurant_headers
    ):
        """Test that listing endpoints only show own restaurant's data"""
        # Create data for both restaurants
        for i in range(3):
            order1 = Order(
                id=str(uuid.uuid4()),
                restaurant_id=test_restaurant.id,
                created_by="user1",
                status="pending",
                total_amount=50.00
            )
            order2 = Order(
                id=str(uuid.uuid4()),
                restaurant_id=second_restaurant.id,
                created_by="user2",
                status="pending",
                total_amount=75.00
            )
            test_db.add_all([order1, order2])
            await test_db.commit()
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Get orders for first restaurant
            response = await client.get(
                "/api/v1/orders",
                headers=restaurant_owner_headers
            )
            
            assert response.status_code == 200
            orders = response.json()
            
            # Should only see own orders
            for order in orders:
                assert order["restaurant_id"] == test_restaurant.id
    
    async def test_cannot_create_data_for_other_restaurant(
        self, test_db, test_restaurant, second_restaurant,
        restaurant_owner_headers
    ):
        """Test that cannot create data for another restaurant"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Try to create order for second restaurant with first restaurant's token
            response = await client.post(
                "/api/v1/orders",
                json={
                    "restaurant_id": second_restaurant.id,  # Different restaurant!
                    "table_number": "1",
                    "items": []
                },
                headers=restaurant_owner_headers
            )
            
            # Should be forbidden
            assert response.status_code in [403, 400]
    
    async def test_cannot_update_other_restaurant_data(
        self, test_db, test_restaurant, second_restaurant,
        restaurant_owner_headers, second_restaurant_headers
    ):
        """Test that cannot update another restaurant's data"""
        # Create product for second restaurant
        product = Product(
            id=str(uuid.uuid4()),
            name="Other Product",
            restaurant_id=second_restaurant.id,
            price=20.00
        )
        test_db.add(product)
        await test_db.commit()
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Try to update with first restaurant's token
            response = await client.put(
                f"/api/v1/products/{product.id}",
                json={"price": 0.01},
                headers=restaurant_owner_headers
            )
            
            # Should be forbidden
            assert response.status_code in [403, 404]
            
            # Verify price unchanged
            await test_db.refresh(product)
            assert product.price == 20.00
    
    async def test_platform_owner_can_access_all(
        self, test_db, test_restaurant, second_restaurant,
        platform_owner_headers
    ):
        """Test that platform owner can access all restaurants"""
        # Create orders for both restaurants
        order1 = Order(
            id=str(uuid.uuid4()),
            restaurant_id=test_restaurant.id,
            created_by="user1",
            total_amount=100.00
        )
        order2 = Order(
            id=str(uuid.uuid4()),
            restaurant_id=second_restaurant.id,
            created_by="user2",
            total_amount=200.00
        )
        test_db.add_all([order1, order2])
        await test_db.commit()
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Platform owner should see all orders
            response = await client.get(
                "/api/v1/platform/orders",
                headers=platform_owner_headers
            )
            
            assert response.status_code == 200
            orders = response.json()
            
            # Should see orders from both restaurants
            restaurant_ids = {order["restaurant_id"] for order in orders}
            assert test_restaurant.id in restaurant_ids
            assert second_restaurant.id in restaurant_ids
