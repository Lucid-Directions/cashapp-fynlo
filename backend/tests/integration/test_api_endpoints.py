"""
API Endpoint Integration Tests
"""
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
class TestOrderEndpoints:
    """Test order API endpoints"""
    
    async def test_list_orders(self, test_db, test_restaurant, test_order, auth_headers):
        """Test listing orders endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/orders", headers=auth_headers)
            
            assert response.status_code == 200
            orders = response.json()
            assert isinstance(orders, list)
            assert len(orders) >= 1
            
            # Verify order structure
            order = orders[0]
            assert "id" in order
            assert "status" in order
            assert "total_amount" in order
            assert "created_at" in order
    
    async def test_get_order_by_id(self, test_db, test_order, auth_headers):
        """Test get single order endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(
                f"/api/v1/orders/{test_order.id}",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            order = response.json()
            assert order["id"] == test_order.id
            assert order["status"] == test_order.status
    
    async def test_create_order(self, test_db, test_restaurant, test_product, auth_headers):
        """Test create order endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            order_data = {
                "table_number": "7",
                "order_type": "dine_in",
                "items": [
                    {
                        "product_id": test_product.id,
                        "quantity": 2,
                        "price": float(test_product.price),
                        "notes": "No onions"
                    }
                ]
            }
            
            response = await client.post(
                "/api/v1/orders",
                json=order_data,
                headers=auth_headers
            )
            
            assert response.status_code == 201
            order = response.json()
            assert order["table_number"] == "7"
            assert order["order_type"] == "dine_in"
            assert len(order["items"]) == 1
            assert order["items"][0]["quantity"] == 2
    
    async def test_update_order_status(self, test_db, test_order, auth_headers):
        """Test update order status endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.put(
                f"/api/v1/orders/{test_order.id}/status",
                json={"status": "preparing"},
                headers=auth_headers
            )
            
            assert response.status_code == 200
            order = response.json()
            assert order["status"] == "preparing"
    
    async def test_order_filtering(self, test_db, test_restaurant, auth_headers):
        """Test order filtering parameters"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Test status filter
            response = await client.get(
                "/api/v1/orders?status=pending",
                headers=auth_headers
            )
            assert response.status_code == 200
            orders = response.json()
            for order in orders:
                assert order["status"] == "pending"
            
            # Test date range filter
            response = await client.get(
                "/api/v1/orders?start_date=2024-01-01&end_date=2024-12-31",
                headers=auth_headers
            )
            assert response.status_code == 200
            
            # Test pagination
            response = await client.get(
                "/api/v1/orders?skip=0&limit=10",
                headers=auth_headers
            )
            assert response.status_code == 200
            orders = response.json()
            assert len(orders) <= 10


@pytest.mark.asyncio
class TestProductEndpoints:
    """Test product API endpoints"""
    
    async def test_list_products(self, test_db, test_product, auth_headers):
        """Test listing products endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/products", headers=auth_headers)
            
            assert response.status_code == 200
            products = response.json()
            assert isinstance(products, list)
            assert len(products) >= 1
    
    async def test_create_product(self, test_db, test_category, auth_headers):
        """Test create product endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            product_data = {
                "name": "New Pizza",
                "description": "Delicious new pizza",
                "price": 15.99,
                "category_id": test_category.id,
                "available": True
            }
            
            response = await client.post(
                "/api/v1/products",
                json=product_data,
                headers=auth_headers
            )
            
            assert response.status_code == 201
            product = response.json()
            assert product["name"] == "New Pizza"
            assert product["price"] == 15.99
    
    async def test_update_product(self, test_db, test_product, auth_headers):
        """Test update product endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            update_data = {
                "name": test_product.name,
                "price": 25.00,
                "available": False
            }
            
            response = await client.put(
                f"/api/v1/products/{test_product.id}",
                json=update_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            product = response.json()
            assert product["price"] == 25.00
            assert product["available"] is False
    
    async def test_delete_product(self, test_db, test_product, auth_headers):
        """Test delete product endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.delete(
                f"/api/v1/products/{test_product.id}",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            
            # Verify product is deleted
            response = await client.get(
                f"/api/v1/products/{test_product.id}",
                headers=auth_headers
            )
            assert response.status_code == 404


@pytest.mark.asyncio
class TestReportEndpoints:
    """Test reporting API endpoints"""
    
    async def test_sales_report_access(self, auth_headers, employee_headers):
        """Test sales report access control"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Manager can access reports
            response = await client.get(
                "/api/v1/reports/sales",
                headers=auth_headers
            )
            assert response.status_code == 200
            
            # Employee cannot access reports
            response = await client.get(
                "/api/v1/reports/sales",
                headers=employee_headers
            )
            assert response.status_code == 403
    
    async def test_inventory_report(self, test_db, test_product, auth_headers):
        """Test inventory report endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/reports/inventory",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            report = response.json()
            assert "total_products" in report
            assert "low_stock_items" in report
            assert "out_of_stock_items" in report
    
    async def test_analytics_endpoint(self, auth_headers):
        """Test analytics endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/analytics/dashboard",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            analytics = response.json()
            assert "revenue" in analytics
            assert "orders_count" in analytics
            assert "average_order_value" in analytics


@pytest.mark.asyncio
class TestHealthCheckEndpoints:
    """Test health check endpoints"""
    
    async def test_health_check(self):
        """Test basic health check endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/health")
            
            assert response.status_code == 200
            assert response.json()["status"] == "healthy"
    
    async def test_readiness_check(self):
        """Test readiness check endpoint"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/ready")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ready"
            assert "database" in data
            assert "redis" in data
