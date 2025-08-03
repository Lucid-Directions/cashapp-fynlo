"""
Multi-tenant Isolation Test Suite for Fynlo POS
Tests data isolation between restaurants and prevents cross-tenant access
"""

import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.exceptions import FynloException
from app.models import Order, Product, User, Restaurant, Table


class TestMultiTenantIsolation:
    """Comprehensive tests for multi-tenant data isolation"""

    @pytest.fixture
    def test_client(self):
        return TestClient(app)

    @pytest.fixture
    def mock_db_session(self):
        session = MagicMock(spec=Session)
        return session

    @pytest.fixture
    def restaurant_1(self):
        return Restaurant(
            id="restaurant_1",
            name="Restaurant One",
            business_type="restaurant",
            currency="USD"
        )

    @pytest.fixture
    def restaurant_2(self):
        return Restaurant(
            id="restaurant_2",
            name="Restaurant Two",
            business_type="cafe",
            currency="USD"
        )

    @pytest.fixture
    def user_restaurant_1(self, restaurant_1):
        return User(
            id="user_r1",
            email="user@restaurant1.com",
            restaurant_id=restaurant_1.id,
            role="manager"
        )

    @pytest.fixture
    def user_restaurant_2(self, restaurant_2):
        return User(
            id="user_r2",
            email="user@restaurant2.com",
            restaurant_id=restaurant_2.id,
            role="manager"
        )

    def test_cannot_access_other_restaurant_orders(self, test_client, mock_db_session, user_restaurant_1):
        """Test that users cannot access orders from other restaurants"""
        # Mock order from restaurant 2
        other_restaurant_order = Order(
            id="order_123",
            restaurant_id="restaurant_2",
            total=Decimal("100.00")
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = other_restaurant_order

        with patch("app.core.auth.get_current_user", return_value=user_restaurant_1):
            with patch("app.core.database.get_db", return_value=mock_db_session):
                response = test_client.get(
                    "/api/v1/orders/order_123",
                    headers={"Authorization": "Bearer token"}
                )
                
                assert response.status_code == 403
                assert "forbidden" in response.json()["message"].lower()

    def test_cannot_list_other_restaurant_products(self, test_client, mock_db_session, user_restaurant_1):
        """Test that users cannot list products from other restaurants"""
        # Mock products from both restaurants
        products = [
            Product(id="p1", restaurant_id="restaurant_1", name="Pizza"),
            Product(id="p2", restaurant_id="restaurant_2", name="Burger"),  # Should not be visible
        ]
        
        # Mock the query to return only restaurant_1 products
        mock_query = MagicMock()
        mock_query.filter.return_value.all.return_value = [products[0]]
        mock_db_session.query.return_value = mock_query

        with patch("app.core.auth.get_current_user", return_value=user_restaurant_1):
            with patch("app.core.database.get_db", return_value=mock_db_session):
                response = test_client.get(
                    "/api/v1/products",
                    headers={"Authorization": "Bearer token"}
                )
                
                assert response.status_code == 200
                data = response.json()["data"]
                assert len(data) == 1
                assert data[0]["restaurant_id"] == "restaurant_1"
                
                # Verify the filter was applied correctly
                mock_query.filter.assert_called()
                filter_args = str(mock_query.filter.call_args)
                assert "restaurant_id" in filter_args

    def test_cannot_create_order_for_other_restaurant(self, test_client, mock_db_session, user_restaurant_1):
        """Test that users cannot create orders for other restaurants"""
        order_data = {
            "restaurant_id": "restaurant_2",  # Trying to create for another restaurant
            "items": [{"product_id": "p1", "quantity": 1}],
            "total": 50.00
        }

        with patch("app.core.auth.get_current_user", return_value=user_restaurant_1):
            with patch("app.core.database.get_db", return_value=mock_db_session):
                response = test_client.post(
                    "/api/v1/orders",
                    json=order_data,
                    headers={"Authorization": "Bearer token"}
                )
                
                assert response.status_code == 403
                assert "forbidden" in response.json()["message"].lower()

    def test_cannot_update_other_restaurant_settings(self, test_client, mock_db_session, user_restaurant_1, restaurant_2):
        """Test that users cannot update settings for other restaurants"""
        mock_db_session.query.return_value.filter.return_value.first.return_value = restaurant_2

        settings_data = {
            "service_charge": 0.15,
            "tax_rate": 0.08
        }

        with patch("app.core.auth.get_current_user", return_value=user_restaurant_1):
            with patch("app.core.database.get_db", return_value=mock_db_session):
                response = test_client.put(
                    f"/api/v1/restaurants/{restaurant_2.id}/settings",
                    json=settings_data,
                    headers={"Authorization": "Bearer token"}
                )
                
                assert response.status_code == 403

    def test_sql_injection_cannot_bypass_tenant_isolation(self, test_client, mock_db_session, user_restaurant_1):
        """Test that SQL injection cannot bypass tenant isolation"""
        injection_attempts = [
            "' OR restaurant_id='restaurant_2' --",
            "'; DELETE FROM orders WHERE restaurant_id='restaurant_2'; --",
            "' UNION SELECT * FROM orders WHERE restaurant_id='restaurant_2' --",
            "restaurant_1' OR '1'='1",
        ]

        for injection in injection_attempts:
            with patch("app.core.auth.get_current_user", return_value=user_restaurant_1):
                with patch("app.core.database.get_db", return_value=mock_db_session):
                    # Try injection in search parameter
                    response = test_client.get(
                        f"/api/v1/orders?search={injection}",
                        headers={"Authorization": "Bearer token"}
                    )
                    
                    # Should either sanitize or return safe results
                    assert response.status_code in [200, 400]
                    if response.status_code == 200:
                        # Verify no data from other restaurants
                        for order in response.json().get("data", []):
                            assert order["restaurant_id"] == "restaurant_1"

    def test_cannot_access_other_restaurant_reports(self, test_client, mock_db_session, user_restaurant_1):
        """Test that users cannot access reports from other restaurants"""
        with patch("app.core.auth.get_current_user", return_value=user_restaurant_1):
            with patch("app.core.database.get_db", return_value=mock_db_session):
                # Try to access restaurant 2's reports
                response = test_client.get(
                    "/api/v1/reports/sales?restaurant_id=restaurant_2",
                    headers={"Authorization": "Bearer token"}
                )
                
                assert response.status_code == 403

    def test_bulk_operations_respect_tenant_boundaries(self, test_client, mock_db_session, user_restaurant_1):
        """Test that bulk operations only affect the user's restaurant"""
        # Mock mixed products (from both restaurants)
        products = [
            Product(id="p1", restaurant_id="restaurant_1", name="Pizza"),
            Product(id="p2", restaurant_id="restaurant_2", name="Burger"),
            Product(id="p3", restaurant_id="restaurant_1", name="Pasta"),
        ]
        
        mock_db_session.query.return_value.filter.return_value.all.return_value = [products[0], products[2]]

        with patch("app.core.auth.get_current_user", return_value=user_restaurant_1):
            with patch("app.core.database.get_db", return_value=mock_db_session):
                # Bulk update prices
                response = test_client.put(
                    "/api/v1/products/bulk-update",
                    json={
                        "product_ids": ["p1", "p2", "p3"],  # Including p2 from restaurant 2
                        "updates": {"price": 15.99}
                    },
                    headers={"Authorization": "Bearer token"}
                )
                
                assert response.status_code == 200
                # Should only update p1 and p3, not p2
                updated = response.json()["data"]["updated"]
                assert len(updated) == 2
                assert "p2" not in [p["id"] for p in updated]

    def test_cannot_transfer_data_between_restaurants(self, test_client, mock_db_session, user_restaurant_1):
        """Test that data cannot be transferred between restaurants"""
        table = Table(
            id="table_1",
            restaurant_id="restaurant_1",
            number="T1"
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = table

        with patch("app.core.auth.get_current_user", return_value=user_restaurant_1):
            with patch("app.core.database.get_db", return_value=mock_db_session):
                # Try to move table to another restaurant
                response = test_client.put(
                    f"/api/v1/tables/{table.id}",
                    json={"restaurant_id": "restaurant_2"},
                    headers={"Authorization": "Bearer token"}
                )
                
                assert response.status_code in [400, 403]

    def test_platform_owner_can_access_multiple_restaurants(self, test_client, mock_db_session):
        """Test that platform owners have proper access to all restaurants"""
        platform_owner = User(
            id="platform_owner",
            email="owner@fynlo.com",
            role="platform_owner",
            restaurant_id=None  # Platform owners don't belong to specific restaurant
        )

        orders = [
            Order(id="o1", restaurant_id="restaurant_1", total=Decimal("100")),
            Order(id="o2", restaurant_id="restaurant_2", total=Decimal("200")),
        ]
        
        mock_db_session.query.return_value.all.return_value = orders

        with patch("app.core.auth.get_current_user", return_value=platform_owner):
            with patch("app.core.database.get_db", return_value=mock_db_session):
                response = test_client.get(
                    "/api/v1/admin/orders",
                    headers={"Authorization": "Bearer token"}
                )
                
                assert response.status_code == 200
                data = response.json()["data"]
                assert len(data) == 2
                # Can see orders from both restaurants
                restaurant_ids = {order["restaurant_id"] for order in data}
                assert restaurant_ids == {"restaurant_1", "restaurant_2"}

    def test_restaurant_id_consistency_in_nested_data(self, test_client, mock_db_session, user_restaurant_1):
        """Test that nested data maintains restaurant_id consistency"""
        order = Order(
            id="order_1",
            restaurant_id="restaurant_1",
            items=[
                {"product_id": "p1", "restaurant_id": "restaurant_2"},  # Inconsistent!
            ]
        )
        
        with patch("app.core.auth.get_current_user", return_value=user_restaurant_1):
            with patch("app.core.database.get_db", return_value=mock_db_session):
                mock_db_session.add.side_effect = lambda obj: None
                mock_db_session.commit.side_effect = FynloException("Data integrity violation")
                
                response = test_client.post(
                    "/api/v1/orders",
                    json={
                        "items": order.items,
                        "total": 50.00
                    },
                    headers={"Authorization": "Bearer token"}
                )
                
                assert response.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
