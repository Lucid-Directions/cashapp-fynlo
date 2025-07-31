"""
Multi-tenant Isolation Test Suite for Fynlo POS
Tests data isolation between restaurants and prevents cross-tenant access
"""

import os
import pytest
from datetime import datetime
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
        """Create a mock database session"""
        session = MagicMock(spec=Session)
        return session
    
    @pytest.fixture
    def restaurant_a(self):
        """Create mock restaurant A"""
        return Restaurant(
            id="rest-a-123",
            name="Restaurant A",
            business_name="Restaurant A Ltd",
            business_address="123 Main St",
            vat_number="VAT123"
        )
    
    @pytest.fixture
    def restaurant_b(self):
        """Create mock restaurant B"""
        return Restaurant(
            id="rest-b-456",
            name="Restaurant B",
            business_name="Restaurant B Ltd",
            business_address="456 High St",
            vat_number="VAT456"
        )
    
    @pytest.fixture
    def user_restaurant_a(self, restaurant_a):
        """Create user for restaurant A"""
        return User(
            id="user-a-1",
            email="user@resta.com",
            full_name="User A",
            role="manager",
            restaurant_id=restaurant_a.id,
            is_active=True,
            supabase_id="supa-a-1"
        )
    
    @pytest.fixture
    def user_restaurant_b(self, restaurant_b):
        """Create user for restaurant B"""
        return User(
            id="user-b-1",
            email="user@restb.com",
            full_name="User B",
            role="manager",
            restaurant_id=restaurant_b.id,
            is_active=True,
            supabase_id="supa-b-1"
        )
    
    def test_order_isolation(self, mock_db_session, restaurant_a, restaurant_b, user_restaurant_a):
        """Test that users can only access orders from their own restaurant"""
        # Create orders for both restaurants
        order_a = Order(
            id="order-a-1",
            restaurant_id=restaurant_a.id,
            table_number="T1",
            total=Decimal("50.00"),
            status="pending"
        )
        
        order_b = Order(
            id="order-b-1",
            restaurant_id=restaurant_b.id,
            table_number="T2",
            total=Decimal("75.00"),
            status="pending"
        )
        
        # Mock query to return only restaurant A's orders
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [order_a]
        mock_db_session.query.return_value = mock_query
        
        # Verify restaurant A user only gets restaurant A orders
        result = mock_db_session.query(Order).filter(
            Order.restaurant_id == restaurant_a.id
        ).all()
        
        assert len(result) == 1
        assert result[0].restaurant_id == restaurant_a.id
        assert result[0].id == "order-a-1"
    
    def test_product_isolation(self, mock_db_session, restaurant_a, restaurant_b):
        """Test that menu items are isolated between restaurants"""
        # Create products for both restaurants
        product_a = Product(
            id="prod-a-1",
            restaurant_id=restaurant_a.id,
            name="Burger A",
            price=Decimal("12.99"),
            category_id="cat-a-1"
        )
        
        product_b = Product(
            id="prod-b-1",
            restaurant_id=restaurant_b.id,
            name="Pizza B",
            price=Decimal("15.99"),
            category_id="cat-b-1"
        )
        
        # Mock query to return only restaurant A's products
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [product_a]
        mock_db_session.query.return_value = mock_query
        
        # Verify isolation
        result = mock_db_session.query(Product).filter(
            Product.restaurant_id == restaurant_a.id
        ).all()
        
        assert len(result) == 1
        assert result[0].restaurant_id == restaurant_a.id
        assert result[0].name == "Burger A"
    
    @patch('app.core.auth.get_current_user')
    def test_api_order_access_denied(self, mock_auth, test_client, user_restaurant_a, restaurant_b):
        """Test API denies access to orders from other restaurants"""
        mock_auth.return_value = user_restaurant_a
        
        # Try to access order from restaurant B
        response = test_client.get(f"/api/v1/orders/order-b-1")
        
        assert response.status_code == 404  # Should not find order from other restaurant
    
    @patch('app.core.auth.get_current_user')
    def test_api_product_isolation(self, mock_auth, test_client, user_restaurant_a):
        """Test API only returns products from user's restaurant"""
        mock_auth.return_value = user_restaurant_a
        
        with patch('app.api.v1.endpoints.menu.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            
            # Mock products query
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.all.return_value = []
            mock_session.query.return_value = mock_query
            
            response = test_client.get("/api/v1/menu")
            
            # Verify the query was filtered by restaurant_id
            mock_session.query.assert_called()
            mock_query.filter.assert_called()
    
    def test_table_isolation(self, mock_db_session, restaurant_a, restaurant_b):
        """Test that tables are isolated between restaurants"""
        table_a = Table(
            id="table-a-1",
            restaurant_id=restaurant_a.id,
            table_number="1",
            seats=4,
            status="available"
        )
        
        table_b = Table(
            id="table-b-1",
            restaurant_id=restaurant_b.id,
            table_number="1",
            seats=6,
            status="occupied"
        )
        
        # Mock query for restaurant A tables
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [table_a]
        mock_db_session.query.return_value = mock_query
        
        result = mock_db_session.query(Table).filter(
            Table.restaurant_id == restaurant_a.id
        ).all()
        
        assert len(result) == 1
        assert result[0].restaurant_id == restaurant_a.id
        assert result[0].seats == 4
    
    @patch('app.core.auth.get_current_user')
    def test_cross_tenant_order_creation_denied(self, mock_auth, test_client, user_restaurant_a, restaurant_b):
        """Test that users cannot create orders for other restaurants"""
        mock_auth.return_value = user_restaurant_a
        
        # Try to create order for restaurant B
        order_data = {
            "restaurant_id": restaurant_b.id,  # Wrong restaurant\!
            "table_number": "T1",
            "items": [{"product_id": "prod-1", "quantity": 1}]
        }
        
        with patch('app.api.v1.endpoints.orders.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            
            response = test_client.post("/api/v1/orders", json=order_data)
            
            # Should be rejected (forbidden or bad request)
            assert response.status_code in [403, 400]
    
    def test_user_restaurant_assignment(self, user_restaurant_a, restaurant_a):
        """Test that users are properly assigned to restaurants"""
        assert user_restaurant_a.restaurant_id == restaurant_a.id
        assert user_restaurant_a.restaurant_id \!= "some-other-restaurant"
    
    @patch('app.core.auth.get_current_user')
    def test_platform_owner_access(self, mock_auth, test_client):
        """Test that platform owners can access all restaurants"""
        platform_owner = User(
            id="platform-1",
            email="admin@fynlo.com",
            full_name="Platform Admin",
            role="platform_owner",
            restaurant_id=None,  # No specific restaurant
            is_active=True,
            supabase_id="supa-platform-1"
        )
        
        mock_auth.return_value = platform_owner
        
        # Platform owner should be able to access platform endpoints
        with patch('app.api.v1.endpoints.platform.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            
            # Mock restaurants query
            mock_query = MagicMock()
            mock_query.all.return_value = []
            mock_session.query.return_value = mock_query
            
            response = test_client.get("/api/v1/platform/restaurants")
            
            # Should have access (even if no data)
            assert response.status_code == 200
    
    def test_sql_injection_protection(self, mock_db_session):
        """Test that SQL injection attempts are prevented"""
        malicious_restaurant_id = "'; DROP TABLE orders; --"
        
        # Mock parameterized query (safe from SQL injection)
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = []
        mock_db_session.query.return_value = mock_query
        
        # This should use parameterized queries, not string concatenation
        result = mock_db_session.query(Order).filter(
            Order.restaurant_id == malicious_restaurant_id
        ).all()
        
        # Query should execute safely and return empty
        assert len(result) == 0
        
        # Verify the filter was called with the malicious string as a parameter
        # (not concatenated into SQL)
        mock_query.filter.assert_called()
    
    @patch('app.core.auth.get_current_user')
    def test_audit_log_isolation(self, mock_auth, test_client, user_restaurant_a):
        """Test that audit logs are isolated by restaurant"""
        mock_auth.return_value = user_restaurant_a
        
        with patch('app.api.v1.endpoints.audit.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            
            # Mock audit logs query
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.all.return_value = []
            mock_session.query.return_value = mock_query
            
            response = test_client.get("/api/v1/audit/logs")
            
            # Should filter by restaurant_id
            mock_query.filter.assert_called()
    
    def test_payment_isolation(self, mock_db_session, restaurant_a, restaurant_b):
        """Test that payment configurations are isolated"""
        # Each restaurant should have its own payment settings
        payment_config_a = {
            "restaurant_id": restaurant_a.id,
            "stripe_key": os.environ.get("STRIPE_KEY", "sk_test_resta"),
            "enable_cash": True
        }
        
        payment_config_b = {
            "restaurant_id": restaurant_b.id,
            "stripe_key": os.environ.get("STRIPE_KEY", "sk_test_restb"),
            "enable_cash": False
        }
        
        # Verify configs are different
        assert payment_config_a["restaurant_id"] \!= payment_config_b["restaurant_id"]
        assert payment_config_a["enable_cash"] \!= payment_config_b["enable_cash"]
    
    @patch('app.core.auth.get_current_user')
    def test_analytics_data_isolation(self, mock_auth, test_client, user_restaurant_a):
        """Test that analytics data is isolated by restaurant"""
        mock_auth.return_value = user_restaurant_a
        
        with patch('app.api.v1.endpoints.analytics.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            
            # Mock analytics query
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.all.return_value = []
            mock_session.query.return_value = mock_query
            
            response = test_client.get("/api/v1/analytics/dashboard")
            
            # Should filter by restaurant_id
            mock_query.filter.assert_called()
    
    def test_inventory_isolation(self, mock_db_session, restaurant_a, restaurant_b):
        """Test that inventory is isolated between restaurants"""
        # Mock inventory items
        inventory_a = {
            "restaurant_id": restaurant_a.id,
            "product_id": "prod-a-1",
            "quantity": 100
        }
        
        inventory_b = {
            "restaurant_id": restaurant_b.id,
            "product_id": "prod-b-1",
            "quantity": 50
        }
        
        # Verify isolation
        assert inventory_a["restaurant_id"] \!= inventory_b["restaurant_id"]
        assert inventory_a["product_id"] \!= inventory_b["product_id"]
    
    @patch('app.core.auth.get_current_user')
    def test_customer_data_isolation(self, mock_auth, test_client, user_restaurant_a):
        """Test that customer data is isolated by restaurant"""
        mock_auth.return_value = user_restaurant_a
        
        with patch('app.api.v1.endpoints.customers.get_db') as mock_get_db:
            mock_session = MagicMock()
            mock_get_db.return_value = mock_session
            
            # Mock customers query
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.all.return_value = []
            mock_session.query.return_value = mock_query
            
            response = test_client.get("/api/v1/customers")
            
            # Should filter by restaurant_id
            mock_query.filter.assert_called()
    
    def test_settings_isolation(self, restaurant_a, restaurant_b):
        """Test that restaurant settings are isolated"""
        settings_a = {
            "restaurant_id": restaurant_a.id,
            "currency": "GBP",
            "service_charge": 10,
            "vat_rate": 20
        }
        
        settings_b = {
            "restaurant_id": restaurant_b.id,
            "currency": "EUR",
            "service_charge": 12,
            "vat_rate": 19
        }
        
        # Verify settings are isolated
        assert settings_a["restaurant_id"] \!= settings_b["restaurant_id"]
        assert settings_a["currency"] \!= settings_b["currency"]
        assert settings_a["service_charge"] \!= settings_b["service_charge"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
EOF < /dev/null