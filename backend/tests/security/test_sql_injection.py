"""
SQL Injection Protection Tests
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from app.main import app
from tests.fixtures.database import test_db, test_restaurant, test_user
from tests.fixtures.auth import auth_headers


@pytest.mark.asyncio
class TestSQLInjectionProtection:
    """Test SQL injection protection across all endpoints"""
    
    async def test_search_sql_injection(self, test_db, test_restaurant, auth_headers):
        """Test SQL injection in search parameters"""
        malicious_inputs = [
            "'; DROP TABLE orders; --",
            "1' OR '1'='1",
            "1'; DELETE FROM restaurants WHERE '1'='1",
            "' UNION SELECT * FROM users --",
            "'; UPDATE orders SET total_amount=0 WHERE '1'='1",
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for malicious_input in malicious_inputs:
                # Test various search endpoints
                endpoints = [
                    f"/api/v1/orders?search={malicious_input}",
                    f"/api/v1/products?search={malicious_input}",
                    f"/api/v1/customers?search={malicious_input}",
                ]
                
                for endpoint in endpoints:
                    response = await client.get(endpoint, headers=auth_headers)
                    # Should not cause server error
                    assert response.status_code in [200, 404]
                    
                    # Verify tables still exist
                    assert (await test_db.execute(text("SELECT COUNT(*) FROM orders"))).scalar() >= 0
                    assert (await test_db.execute(text("SELECT COUNT(*) FROM restaurants"))).scalar() >= 0
    
    async def test_id_parameter_injection(self, test_db, auth_headers):
        """Test SQL injection in ID parameters"""
        malicious_ids = [
            "1' OR '1'='1",
            "1'; DROP TABLE orders; --",
            "1 UNION SELECT password FROM users",
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for malicious_id in malicious_ids:
                response = await client.get(
                    f"/api/v1/orders/{malicious_id}",
                    headers=auth_headers
                )
                # Should return 404 or 400, not 500
                assert response.status_code in [400, 404]
    
    async def test_create_order_injection(self, test_db, test_restaurant, auth_headers):
        """Test SQL injection in POST data"""
        malicious_data = {
            "restaurant_id": test_restaurant.id,
            "table_number": "1'; DROP TABLE orders; --",
            "customer_name": "Robert'); DROP TABLE students;--",
            "notes": "' OR '1'='1"
        }
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/orders",
                json=malicious_data,
                headers=auth_headers
            )
            
            # Should create order safely
            assert response.status_code in [200, 201]
            
            # Verify no damage done
            assert (await test_db.execute(text("SELECT COUNT(*) FROM orders"))).scalar() >= 0
    
    async def test_filter_parameter_injection(self, test_db, auth_headers):
        """Test SQL injection in filter parameters"""
        malicious_filters = [
            {"status": "pending' OR '1'='1"},
            {"restaurant_id": "'; DELETE FROM orders; --"},
            {"created_by": "1 UNION SELECT * FROM users"},
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for filters in malicious_filters:
                response = await client.get(
                    "/api/v1/orders",
                    params=filters,
                    headers=auth_headers
                )
                
                # Should handle safely
                assert response.status_code in [200, 400]
                
                # Verify database integrity
                assert (await test_db.execute(text("SELECT COUNT(*) FROM orders"))).scalar() >= 0