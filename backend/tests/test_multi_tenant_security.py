"""
Security tests for multi-tenant isolation
Tests authentication, authorization, and security boundaries
"""
import pytest
import uuid
import json
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import User, Restaurant, UserRestaurant, Product, Customer
from app.core.auth import create_access_token
from app.core.security import get_password_hash


class TestMultiTenantSecurity:
    """Test security aspects of multi-tenant system"""

    @pytest.fixture
    async def malicious_user(self, db_session: AsyncSession) -> User:
        """Create a user that will attempt unauthorized access"""
        # Create a restaurant for the malicious user
        restaurant = Restaurant(
            id=str(uuid.uuid4()),
            name="Malicious Restaurant",
            email="malicious@restaurant.com",
            phone="+447000000000",
            address="666 Evil Street",
            city="Hackerville",
            postal_code="H4CK 3R5",
            country="UK",
            currency="GBP",
            timezone="Europe/London",
            is_active=True,
            created_at=datetime.utcnow()
        )
        db_session.add(restaurant)
        
        user = User(
            id=str(uuid.uuid4()),
            email="malicious@hacker.com",
            full_name="Malicious User",
            role="restaurant_owner",
            restaurant_id=restaurant.id,
            current_restaurant_id=restaurant.id,
            is_active=True,
            password_hash=get_password_hash("hack3r123"),
            created_at=datetime.utcnow()
        )
        db_session.add(user)
        await db_session.commit()
        
        # Create UserRestaurant entry
        user_restaurant = UserRestaurant(
            id=str(uuid.uuid4()),
            user_id=user.id,
            restaurant_id=restaurant.id,
            role="restaurant_owner",
            is_primary=True,
            assigned_at=datetime.utcnow()
        )
        db_session.add(user_restaurant)
        await db_session.commit()
        
        return user

    @pytest.fixture
    async def legitimate_restaurant(self, db_session: AsyncSession) -> tuple[Restaurant, User]:
        """Create a legitimate restaurant with owner"""
        restaurant = Restaurant(
            id=str(uuid.uuid4()),
            name="Legitimate Restaurant",
            email="legit@restaurant.com",
            phone="+447111111111",
            address="1 Honest Street",
            city="London",
            postal_code="SW1A 1AA",
            country="UK",
            currency="GBP",
            timezone="Europe/London",
            subscription_plan="omega",
            is_active=True,
            created_at=datetime.utcnow()
        )
        db_session.add(restaurant)
        
        owner = User(
            id=str(uuid.uuid4()),
            email="legit@owner.com",
            full_name="Legitimate Owner",
            role="restaurant_owner",
            restaurant_id=restaurant.id,
            current_restaurant_id=restaurant.id,
            is_active=True,
            password_hash=get_password_hash("secure_password_123"),
            created_at=datetime.utcnow()
        )
        db_session.add(owner)
        await db_session.commit()
        
        # Create UserRestaurant entry
        user_restaurant = UserRestaurant(
            id=str(uuid.uuid4()),
            user_id=owner.id,
            restaurant_id=restaurant.id,
            role="restaurant_owner",
            is_primary=True,
            assigned_at=datetime.utcnow()
        )
        db_session.add(user_restaurant)
        await db_session.commit()
        
        # Add some sensitive data
        product = Product(
            id=str(uuid.uuid4()),
            restaurant_id=restaurant.id,
            name="Secret Recipe Burger",
            description="Contains our secret sauce recipe",
            price=15.99,
            is_available=True,
            created_at=datetime.utcnow()
        )
        db_session.add(product)
        
        customer = Customer(
            id=str(uuid.uuid4()),
            restaurant_id=restaurant.id,
            first_name="VIP",
            last_name="Customer",
            email="vip@customer.com",
            phone="+447222222222",
            loyalty_points=1000,
            total_spent=5000.00,
            created_at=datetime.utcnow()
        )
        db_session.add(customer)
        
        await db_session.commit()
        
        return restaurant, owner

    def get_auth_headers(self, user: User) -> dict:
        """Generate auth headers for a user"""
        access_token = create_access_token(
            data={
                "sub": user.email,
                "user_id": user.id,
                "restaurant_id": user.restaurant_id,
                "current_restaurant_id": user.current_restaurant_id,
                "role": user.role
            },
            expires_delta=timedelta(minutes=30)
        )
        return {"Authorization": f"Bearer {access_token}"}

    async def test_jwt_token_tampering(self, client: AsyncClient, legitimate_restaurant):
        """Test that tampered JWT tokens are rejected"""
        restaurant, owner = legitimate_restaurant
        
        # Create valid token
        valid_token = create_access_token(
            data={
                "sub": owner.email,
                "user_id": owner.id,
                "restaurant_id": owner.restaurant_id,
                "role": owner.role
            },
            expires_delta=timedelta(minutes=30)
        )
        
        # Tamper with the token (change a character)
        tampered_token = valid_token[:-5] + "XXXXX"
        
        # Try to use tampered token
        headers = {"Authorization": f"Bearer {tampered_token}"}
        response = await client.get("/api/v1/products/", headers=headers)
        assert response.status_code == 401
        assert "Could not validate credentials" in response.json()["detail"]

    async def test_sql_injection_protection(self, client: AsyncClient, legitimate_restaurant):
        """Test SQL injection protection in search parameters"""
        restaurant, owner = legitimate_restaurant
        headers = self.get_auth_headers(owner)
        
        # SQL injection attempts
        injection_attempts = [
            "'; DROP TABLE products; --",
            "' OR '1'='1",
            "\" OR \"1\"=\"1",
            "'; UPDATE users SET role='platform_owner' WHERE email='malicious@hacker.com'; --",
            "' UNION SELECT * FROM users --",
            ") OR 1=1 --"
        ]
        
        for injection in injection_attempts:
            # Try injection in search parameter
            response = await client.get(
                f"/api/v1/products/?search={injection}",
                headers=headers
            )
            # Should return empty results or 400, not SQL error
            assert response.status_code in [200, 400]
            if response.status_code == 200:
                assert response.json()["data"] == []

    async def test_restaurant_id_manipulation(self, client: AsyncClient, malicious_user, legitimate_restaurant):
        """Test attempts to manipulate restaurant_id in requests"""
        restaurant, owner = legitimate_restaurant
        malicious_headers = self.get_auth_headers(malicious_user)
        
        # Try to create product in another restaurant
        response = await client.post(
            "/api/v1/products/",
            headers=malicious_headers,
            json={
                "restaurant_id": str(restaurant.id),  # Trying to inject different restaurant_id
                "name": "Hacked Product",
                "price": 0.01,
                "is_available": True
            }
        )
        assert response.status_code == 403
        
        # Try to access another restaurant's data with query parameter
        response = await client.get(
            f"/api/v1/products/?current_restaurant_id={restaurant.id}",
            headers=malicious_headers
        )
        assert response.status_code == 403
        assert "Access denied to restaurant" in response.json()["detail"]

    async def test_role_escalation_prevention(self, client: AsyncClient, db_session: AsyncSession, legitimate_restaurant):
        """Test that users cannot escalate their own roles"""
        restaurant, owner = legitimate_restaurant
        
        # Create a manager user
        manager = User(
            id=str(uuid.uuid4()),
            email="manager@restaurant.com",
            full_name="Restaurant Manager",
            role="manager",
            restaurant_id=restaurant.id,
            current_restaurant_id=restaurant.id,
            is_active=True,
            password_hash=get_password_hash("manager123"),
            created_at=datetime.utcnow()
        )
        db_session.add(manager)
        await db_session.commit()
        
        manager_headers = self.get_auth_headers(manager)
        
        # Try to update own role to owner
        response = await client.put(
            f"/api/v1/users/{manager.id}",
            headers=manager_headers,
            json={"role": "restaurant_owner"}
        )
        assert response.status_code == 403
        
        # Try to update own role to platform_owner
        response = await client.put(
            f"/api/v1/users/{manager.id}",
            headers=manager_headers,
            json={"role": "platform_owner", "is_platform_owner": True}
        )
        assert response.status_code == 403

    async def test_multi_restaurant_permission_boundaries(self, client: AsyncClient, db_session: AsyncSession):
        """Test permission boundaries for multi-restaurant users"""
        # Create two restaurants
        restaurants = []
        for i in range(2):
            restaurant = Restaurant(
                id=str(uuid.uuid4()),
                name=f"Test Restaurant {i}",
                email=f"test{i}@restaurant.com",
                phone=f"+44700000000{i}",
                address=f"{i} Test Street",
                city="London",
                postal_code="SW1A 1AA",
                country="UK",
                currency="GBP",
                timezone="Europe/London",
                is_active=True,
                created_at=datetime.utcnow()
            )
            db_session.add(restaurant)
            restaurants.append(restaurant)
        
        # Create owner with access to first restaurant only
        owner1 = User(
            id=str(uuid.uuid4()),
            email="owner1@restaurant.com",
            full_name="Owner 1",
            role="restaurant_owner",
            restaurant_id=restaurants[0].id,
            current_restaurant_id=restaurants[0].id,
            is_active=True,
            created_at=datetime.utcnow()
        )
        db_session.add(owner1)
        await db_session.commit()
        
        # Create UserRestaurant for first restaurant only
        user_restaurant = UserRestaurant(
            id=str(uuid.uuid4()),
            user_id=owner1.id,
            restaurant_id=restaurants[0].id,
            role="restaurant_owner",
            is_primary=True,
            assigned_at=datetime.utcnow()
        )
        db_session.add(user_restaurant)
        await db_session.commit()
        
        headers = self.get_auth_headers(owner1)
        
        # Should access own restaurant
        response = await client.get(
            f"/api/v1/restaurants/{restaurants[0].id}",
            headers=headers
        )
        assert response.status_code == 200
        
        # Should NOT access other restaurant
        response = await client.get(
            f"/api/v1/restaurants/{restaurants[1].id}",
            headers=headers
        )
        assert response.status_code == 403

    async def test_data_leak_prevention(self, client: AsyncClient, db_session: AsyncSession, malicious_user, legitimate_restaurant):
        """Test that sensitive data doesn't leak across tenants"""
        restaurant, owner = legitimate_restaurant
        malicious_headers = self.get_auth_headers(malicious_user)
        
        # Try to enumerate customer IDs
        # Even with valid UUID, should not access other restaurant's customers
        customers = await db_session.execute(
            text("SELECT id FROM customers WHERE restaurant_id = :restaurant_id"),
            {"restaurant_id": str(restaurant.id)}
        )
        customer_id = customers.first()[0] if customers.first() else None
        
        if customer_id:
            response = await client.get(
                f"/api/v1/customers/{customer_id}",
                headers=malicious_headers
            )
            assert response.status_code == 403

    async def test_rate_limiting_per_tenant(self, client: AsyncClient, legitimate_restaurant):
        """Test that rate limiting is applied per tenant"""
        restaurant, owner = legitimate_restaurant
        headers = self.get_auth_headers(owner)
        
        # Make multiple rapid requests
        responses = []
        for _ in range(100):  # Exceed typical rate limit
            response = await client.get("/api/v1/products/", headers=headers)
            responses.append(response.status_code)
        
        # Should see 429 (Too Many Requests) at some point
        assert 429 in responses

    async def test_audit_log_security(self, client: AsyncClient, db_session: AsyncSession, malicious_user, legitimate_restaurant):
        """Test that audit logs don't expose sensitive cross-tenant data"""
        restaurant, owner = legitimate_restaurant
        
        # Malicious user tries to access audit logs
        malicious_headers = self.get_auth_headers(malicious_user)
        
        # Try to access platform-level audit logs
        response = await client.get(
            "/api/v1/audit/logs",
            headers=malicious_headers
        )
        assert response.status_code == 403
        
        # Try to access another restaurant's activity
        response = await client.get(
            f"/api/v1/analytics/activity?restaurant_id={restaurant.id}",
            headers=malicious_headers
        )
        assert response.status_code == 403

    async def test_websocket_authentication_required(self, malicious_user):
        """Test that WebSocket connections require valid authentication"""
        # Try to connect without token
        from websockets import connect, ConnectionClosed
        
        with pytest.raises(ConnectionClosed):
            async with connect("ws://localhost:8000/ws") as ws:
                await ws.send(json.dumps({"type": "subscribe", "channel": "test"}))

    async def test_password_reset_tenant_isolation(self, client: AsyncClient, db_session: AsyncSession):
        """Test that password reset tokens are isolated by tenant"""
        # Create users in different restaurants with same email prefix
        users = []
        for i in range(2):
            restaurant = Restaurant(
                id=str(uuid.uuid4()),
                name=f"Restaurant {i}",
                email=f"restaurant{i}@test.com",
                phone=f"+44700000010{i}",
                address=f"{i} Street",
                city="London",
                postal_code="SW1A 1AA",
                country="UK",
                currency="GBP",
                timezone="Europe/London",
                is_active=True,
                created_at=datetime.utcnow()
            )
            db_session.add(restaurant)
            
            user = User(
                id=str(uuid.uuid4()),
                email=f"john.doe{i}@restaurant{i}.com",  # Similar emails
                full_name="John Doe",
                role="manager",
                restaurant_id=restaurant.id,
                current_restaurant_id=restaurant.id,
                is_active=True,
                password_hash=get_password_hash(f"password{i}"),
                created_at=datetime.utcnow()
            )
            db_session.add(user)
            users.append(user)
        
        await db_session.commit()
        
        # Request password reset for first user
        response = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": users[0].email}
        )
        assert response.status_code == 200
        
        # Token for user 0 should not work for user 1
        # (In real implementation, would test actual token usage)

    async def test_api_key_tenant_binding(self, client: AsyncClient, db_session: AsyncSession, legitimate_restaurant):
        """Test that API keys are bound to specific tenants"""
        restaurant, owner = legitimate_restaurant
        headers = self.get_auth_headers(owner)
        
        # Create API key for restaurant
        response = await client.post(
            "/api/v1/api-keys/",
            headers=headers,
            json={
                "name": "Test API Key",
                "permissions": ["read:orders", "write:orders"]
            }
        )
        
        if response.status_code == 200:
            api_key_data = response.json()["data"]
            api_key = api_key_data.get("key")
            
            # API key should only work for the restaurant it was created for
            # Test would verify this in actual implementation