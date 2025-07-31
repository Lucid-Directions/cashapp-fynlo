"""
Comprehensive tests for multi-tenant role-based access control
Tests the implementation of GitHub issue #391: Multi-restaurant management for Omega plan users
"""
import pytest
import uuid
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import User, Restaurant, UserRestaurant, Product, Customer
from app.core.auth import create_access_token


class TestMultiTenantRoleBasedAccess:
    """Test multi-tenant isolation and role-based access control"""

    @pytest.fixture
    async def omega_restaurant_owner(self, db_session: AsyncSession) -> tuple[User, list[Restaurant]]:
        """Create an Omega plan restaurant owner with multiple restaurants"""
        # Create 3 restaurants for the owner
        restaurants = []
        for i in range(3):
            restaurant = Restaurant(
                id=str(uuid.uuid4()),
                name=f"Omega Restaurant {i+1}",
                email=f"omega{i+1}@restaurant.com",
                phone=f"+4471234567{i}0",
                address=f"{i+1} Omega Street",
                city="London",
                postal_code=f"SW{i+1}A 1AA",
                country="UK",
                currency="GBP",
                timezone="Europe/London",
                subscription_plan="omega",  # Omega plan
                is_active=True,
                created_at=datetime.utcnow()
            )
            db_session.add(restaurant)
            restaurants.append(restaurant)
        
        # Create restaurant owner
        owner = User(
            id=str(uuid.uuid4()),
            email="omega.owner@fynlo.co.uk",
            full_name="Omega Restaurant Owner",
            role="restaurant_owner",
            restaurant_id=restaurants[0].id,  # Primary restaurant
            current_restaurant_id=restaurants[0].id,  # Currently selected
            is_active=True,
            is_platform_owner=False,
            subscription_plan="omega",
            created_at=datetime.utcnow()
        )
        db_session.add(owner)
        await db_session.commit()
        
        # Create UserRestaurant entries for multi-restaurant access
        for i, restaurant in enumerate(restaurants):
            user_restaurant = UserRestaurant(
                id=str(uuid.uuid4()),
                user_id=owner.id,
                restaurant_id=restaurant.id,
                role="restaurant_owner",
                is_primary=(i == 0),
                assigned_at=datetime.utcnow()
            )
            db_session.add(user_restaurant)
        
        await db_session.commit()
        await db_session.refresh(owner)
        
        return owner, restaurants

    @pytest.fixture
    async def beta_restaurant_owner(self, db_session: AsyncSession) -> tuple[User, Restaurant]:
        """Create a Beta plan restaurant owner with single restaurant"""
        restaurant = Restaurant(
            id=str(uuid.uuid4()),
            name="Beta Restaurant",
            email="beta@restaurant.com",
            phone="+447123456799",
            address="1 Beta Street",
            city="Manchester",
            postal_code="M1 1AA",
            country="UK",
            currency="GBP",
            timezone="Europe/London",
            subscription_plan="beta",
            is_active=True,
            created_at=datetime.utcnow()
        )
        db_session.add(restaurant)
        
        owner = User(
            id=str(uuid.uuid4()),
            email="beta.owner@fynlo.co.uk",
            full_name="Beta Restaurant Owner",
            role="restaurant_owner",
            restaurant_id=restaurant.id,
            current_restaurant_id=restaurant.id,
            is_active=True,
            is_platform_owner=False,
            subscription_plan="beta",
            created_at=datetime.utcnow()
        )
        db_session.add(owner)
        await db_session.commit()
        
        # Single restaurant access
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
        
        return owner, restaurant

    @pytest.fixture
    async def restaurant_manager(self, db_session: AsyncSession, omega_restaurant_owner) -> User:
        """Create a manager for one of the Omega restaurants"""
        owner, restaurants = omega_restaurant_owner
        
        manager = User(
            id=str(uuid.uuid4()),
            email="manager@fynlo.co.uk",
            full_name="Restaurant Manager",
            role="manager",
            restaurant_id=restaurants[0].id,
            current_restaurant_id=restaurants[0].id,
            is_active=True,
            is_platform_owner=False,
            created_at=datetime.utcnow()
        )
        db_session.add(manager)
        await db_session.commit()
        
        # Manager has access to only one restaurant
        user_restaurant = UserRestaurant(
            id=str(uuid.uuid4()),
            user_id=manager.id,
            restaurant_id=restaurants[0].id,
            role="manager",
            is_primary=True,
            assigned_at=datetime.utcnow(),
            assigned_by=owner.id
        )
        db_session.add(user_restaurant)
        await db_session.commit()
        
        return manager

    @pytest.fixture
    async def restaurant_employee(self, db_session: AsyncSession, omega_restaurant_owner) -> User:
        """Create an employee for one of the Omega restaurants"""
        owner, restaurants = omega_restaurant_owner
        
        employee = User(
            id=str(uuid.uuid4()),
            email="employee@fynlo.co.uk",
            full_name="Restaurant Employee",
            role="employee",
            restaurant_id=restaurants[0].id,
            current_restaurant_id=restaurants[0].id,
            is_active=True,
            is_platform_owner=False,
            created_at=datetime.utcnow()
        )
        db_session.add(employee)
        await db_session.commit()
        
        # Employee has access to only one restaurant
        user_restaurant = UserRestaurant(
            id=str(uuid.uuid4()),
            user_id=employee.id,
            restaurant_id=restaurants[0].id,
            role="employee",
            is_primary=True,
            assigned_at=datetime.utcnow(),
            assigned_by=owner.id
        )
        db_session.add(user_restaurant)
        await db_session.commit()
        
        return employee

    def get_auth_headers(self, user: User) -> dict:
        """Generate auth headers for a user"""
        access_token = create_access_token(
            data={
                "sub": user.email,
                "user_id": user.id,
                "restaurant_id": user.restaurant_id,
                "current_restaurant_id": user.current_restaurant_id,
                "role": user.role,
                "subscription_plan": getattr(user, 'subscription_plan', 'alpha')
            },
            expires_delta=timedelta(minutes=30)
        )
        return {"Authorization": f"Bearer {access_token}"}

    async def test_omega_owner_can_switch_restaurants(self, client: AsyncClient, omega_restaurant_owner):
        """Test that Omega plan owners can switch between their restaurants"""
        owner, restaurants = omega_restaurant_owner
        headers = self.get_auth_headers(owner)
        
        # Switch to second restaurant
        response = await client.post(
            "/api/v1/users/switch-restaurant",
            headers=headers,
            json={"restaurant_id": str(restaurants[1].id)}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["current_restaurant"]["id"] == str(restaurants[1].id)
        
        # Switch to third restaurant
        response = await client.post(
            "/api/v1/users/switch-restaurant",
            headers=headers,
            json={"restaurant_id": str(restaurants[2].id)}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["current_restaurant"]["id"] == str(restaurants[2].id)

    async def test_beta_owner_cannot_switch_restaurants(self, client: AsyncClient, beta_restaurant_owner):
        """Test that Beta plan owners cannot use restaurant switching"""
        owner, restaurant = beta_restaurant_owner
        headers = self.get_auth_headers(owner)
        
        # Try to switch (should fail)
        response = await client.post(
            "/api/v1/users/switch-restaurant",
            headers=headers,
            json={"restaurant_id": str(uuid.uuid4())}
        )
        assert response.status_code == 403
        data = response.json()
        assert "Multi-restaurant management requires Omega plan" in data["detail"]

    async def test_manager_cannot_switch_restaurants(self, client: AsyncClient, restaurant_manager):
        """Test that managers cannot switch restaurants"""
        headers = self.get_auth_headers(restaurant_manager)
        
        response = await client.post(
            "/api/v1/users/switch-restaurant",
            headers=headers,
            json={"restaurant_id": str(uuid.uuid4())}
        )
        assert response.status_code == 403
        data = response.json()
        assert "Only restaurant owners can switch restaurants" in data["detail"]

    async def test_omega_owner_access_across_restaurants(self, client: AsyncClient, db_session: AsyncSession, omega_restaurant_owner):
        """Test that Omega owners can access data from all their restaurants"""
        owner, restaurants = omega_restaurant_owner
        headers = self.get_auth_headers(owner)
        
        # Create products in each restaurant
        products = []
        for restaurant in restaurants:
            product = Product(
                id=str(uuid.uuid4()),
                restaurant_id=restaurant.id,
                name=f"Product for {restaurant.name}",
                price=10.00,
                is_available=True,
                created_at=datetime.utcnow()
            )
            db_session.add(product)
            products.append(product)
        await db_session.commit()
        
        # Access products from different restaurants
        for i, restaurant in enumerate(restaurants):
            response = await client.get(
                f"/api/v1/products/?current_restaurant_id={restaurant.id}",
                headers=headers
            )
            assert response.status_code == 200
            data = response.json()
            assert len(data["data"]) == 1
            assert data["data"][0]["name"] == f"Product for {restaurant.name}"

    async def test_cross_restaurant_isolation(self, client: AsyncClient, db_session: AsyncSession, omega_restaurant_owner, beta_restaurant_owner):
        """Test that users cannot access data from restaurants they don't own"""
        omega_owner, omega_restaurants = omega_restaurant_owner
        beta_owner, beta_restaurant = beta_restaurant_owner
        
        # Create product in beta restaurant
        beta_product = Product(
            id=str(uuid.uuid4()),
            restaurant_id=beta_restaurant.id,
            name="Beta Product",
            price=15.00,
            is_available=True,
            created_at=datetime.utcnow()
        )
        db_session.add(beta_product)
        await db_session.commit()
        
        # Omega owner tries to access beta restaurant's products
        omega_headers = self.get_auth_headers(omega_owner)
        response = await client.get(
            f"/api/v1/products/?current_restaurant_id={beta_restaurant.id}",
            headers=omega_headers
        )
        assert response.status_code == 403
        assert "Access denied to restaurant" in response.json()["detail"]
        
        # Beta owner tries to access omega restaurant's products
        beta_headers = self.get_auth_headers(beta_owner)
        response = await client.get(
            f"/api/v1/products/?current_restaurant_id={omega_restaurants[0].id}",
            headers=beta_headers
        )
        assert response.status_code == 403

    async def test_role_based_endpoint_access(self, client: AsyncClient, omega_restaurant_owner, restaurant_manager, restaurant_employee):
        """Test role-based access to different endpoints"""
        owner, restaurants = omega_restaurant_owner
        
        # Platform dashboard - only platform owners
        for user in [owner, restaurant_manager, restaurant_employee]:
            headers = self.get_auth_headers(user)
            response = await client.get("/api/v1/analytics/platform-dashboard", headers=headers)
            assert response.status_code == 403
        
        # Restaurant settings - only restaurant owners
        owner_headers = self.get_auth_headers(owner)
        manager_headers = self.get_auth_headers(restaurant_manager)
        employee_headers = self.get_auth_headers(restaurant_employee)
        
        # Owner can update restaurant
        response = await client.put(
            f"/api/v1/restaurants/{restaurants[0].id}",
            headers=owner_headers,
            json={"name": "Updated Restaurant Name"}
        )
        assert response.status_code == 200
        
        # Manager cannot update restaurant
        response = await client.put(
            f"/api/v1/restaurants/{restaurants[0].id}",
            headers=manager_headers,
            json={"name": "Manager Update"}
        )
        assert response.status_code == 403
        
        # Employee cannot update restaurant
        response = await client.put(
            f"/api/v1/restaurants/{restaurants[0].id}",
            headers=employee_headers,
            json={"name": "Employee Update"}
        )
        assert response.status_code == 403

    async def test_data_creation_with_restaurant_context(self, client: AsyncClient, db_session: AsyncSession, omega_restaurant_owner):
        """Test that data is created in the correct restaurant context"""
        owner, restaurants = omega_restaurant_owner
        headers = self.get_auth_headers(owner)
        
        # Create customer in restaurant 1
        response = await client.post(
            "/api/v1/customers/",
            headers=headers,
            params={"restaurant_id": str(restaurants[0].id)},
            json={
                "first_name": "Test",
                "last_name": "Customer",
                "email": "test@customer.com"
            }
        )
        assert response.status_code == 200
        customer_data = response.json()["data"]
        
        # Verify customer was created in correct restaurant
        customer = await db_session.get(Customer, customer_data["id"])
        assert str(customer.restaurant_id) == str(restaurants[0].id)
        
        # Create customer in restaurant 2
        response = await client.post(
            "/api/v1/customers/",
            headers=headers,
            params={"restaurant_id": str(restaurants[1].id)},
            json={
                "first_name": "Another",
                "last_name": "Customer",
                "email": "another@customer.com"
            }
        )
        assert response.status_code == 200
        customer2_data = response.json()["data"]
        
        # Verify isolation - each restaurant has its own customers
        customer2 = await db_session.get(Customer, customer2_data["id"])
        assert str(customer2.restaurant_id) == str(restaurants[1].id)
        assert customer.restaurant_id != customer2.restaurant_id

    async def test_employee_limited_access(self, client: AsyncClient, db_session: AsyncSession, restaurant_employee, omega_restaurant_owner):
        """Test that employees have limited access to management features"""
        employee = restaurant_employee
        owner, restaurants = omega_restaurant_owner
        headers = self.get_auth_headers(employee)
        
        # Employee can view products
        response = await client.get("/api/v1/products/", headers=headers)
        assert response.status_code == 200
        
        # Employee cannot create products
        response = await client.post(
            "/api/v1/products/",
            headers=headers,
            json={
                "name": "Employee Product",
                "price": 10.00,
                "is_available": True
            }
        )
        assert response.status_code == 403
        
        # Employee cannot access analytics
        response = await client.get(
            f"/api/v1/analytics/dashboard/{restaurants[0].id}",
            headers=headers
        )
        assert response.status_code == 403
        
        # Employee can create orders (POS access)
        response = await client.post(
            "/api/v1/orders/",
            headers=headers,
            json={
                "items": [],
                "total_amount": 0,
                "status": "pending"
            }
        )
        assert response.status_code in [200, 201]  # Should be allowed

    async def test_subscription_plan_feature_gating(self, client: AsyncClient, omega_restaurant_owner, beta_restaurant_owner):
        """Test that features are properly gated by subscription plan"""
        omega_owner, omega_restaurants = omega_restaurant_owner
        beta_owner, beta_restaurant = beta_restaurant_owner
        
        # Test multi-location feature (Omega only)
        omega_headers = self.get_auth_headers(omega_owner)
        response = await client.get("/api/v1/users/me", headers=omega_headers)
        assert response.status_code == 200
        user_data = response.json()["data"]
        assert len(user_data.get("assigned_restaurants", [])) == 3
        
        # Beta user should only have one restaurant
        beta_headers = self.get_auth_headers(beta_owner)
        response = await client.get("/api/v1/users/me", headers=beta_headers)
        assert response.status_code == 200
        user_data = response.json()["data"]
        assert len(user_data.get("assigned_restaurants", [])) == 1

    async def test_cascade_permissions(self, client: AsyncClient, db_session: AsyncSession, omega_restaurant_owner, restaurant_manager):
        """Test that permissions cascade correctly through ownership hierarchy"""
        owner, restaurants = omega_restaurant_owner
        manager = restaurant_manager
        
        # Create order as owner
        owner_headers = self.get_auth_headers(owner)
        response = await client.post(
            "/api/v1/orders/",
            headers=owner_headers,
            params={"current_restaurant_id": str(restaurants[0].id)},
            json={
                "items": [],
                "total_amount": 50.00,
                "status": "pending"
            }
        )
        assert response.status_code in [200, 201]
        order_data = response.json()["data"]
        order_id = order_data["id"]
        
        # Manager can view the order
        manager_headers = self.get_auth_headers(manager)
        response = await client.get(
            f"/api/v1/orders/{order_id}",
            headers=manager_headers
        )
        assert response.status_code == 200
        
        # Manager can update order status
        response = await client.put(
            f"/api/v1/orders/{order_id}",
            headers=manager_headers,
            json={"status": "preparing"}
        )
        assert response.status_code == 200

    async def test_audit_trail_multi_restaurant(self, client: AsyncClient, db_session: AsyncSession, omega_restaurant_owner):
        """Test that audit trail correctly tracks restaurant context"""
        owner, restaurants = omega_restaurant_owner
        headers = self.get_auth_headers(owner)
        
        # Perform actions in different restaurant contexts
        for i, restaurant in enumerate(restaurants[:2]):
            # Switch context
            response = await client.post(
                "/api/v1/users/switch-restaurant",
                headers=headers,
                json={"restaurant_id": str(restaurant.id)}
            )
            assert response.status_code == 200
            
            # Create product in this context
            response = await client.post(
                "/api/v1/products/",
                headers=headers,
                params={"current_restaurant_id": str(restaurant.id)},
                json={
                    "name": f"Audit Test Product {i}",
                    "price": 20.00,
                    "is_available": True
                }
            )
            assert response.status_code in [200, 201]
            
            # Verify product was created in correct restaurant
            product_data = response.json()["data"]
            product = await db_session.get(Product, product_data["id"])
            assert str(product.restaurant_id) == str(restaurant.id)