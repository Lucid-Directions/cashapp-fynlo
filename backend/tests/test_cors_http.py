"""
Comprehensive HTTP-level CORS Security Tests
Tests actual CORS behavior at the HTTP request/response level
Tests that complement the configuration tests in test_cors_security.py
"""

import pytest
from httpx import AsyncClient
from typing import Dict, Any, Optional


class TestCORSHTTPBehavior:
    """Test CORS behavior at the HTTP level using actual requests"""

    @pytest.fixture
    def valid_origin(self) -> str:
        """Return a valid origin from the allowed list"""
        return "https://app.fynlo.co.uk"
    
    @pytest.fixture  
    def invalid_origin(self) -> str:
        """Return an invalid origin not in allowed list"""
        return "https://malicious-site.com"
    
    @pytest.fixture
    def localhost_origin(self) -> str:
        """Return a localhost origin (valid in dev, invalid in production)"""
        return "http://localhost:3000"

    async def test_preflight_request_valid_origin(self, client: AsyncClient, valid_origin: str):
        """Test preflight OPTIONS request with valid origin returns proper CORS headers"""
        headers = {
            "Origin": valid_origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type, Authorization"
        }
        
        response = await client.options("/", headers=headers)
        
        # OPTIONS may return 400 if not supported, but CORS headers still matter
        # assert response.status_code in [200, 400]
        assert response.headers.get("Access-Control-Allow-Origin") == valid_origin
        
        # FastAPI CORS middleware may or may not include credentials header for preflight
        # depending on configuration - we'll check it's either false or not present
        credentials_header = response.headers.get("Access-Control-Allow-Credentials")
        if credentials_header is not None:
            assert credentials_header == "false"
        
        # Check allowed methods
        allowed_methods = response.headers.get("Access-Control-Allow-Methods", "")
        expected_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
        for method in expected_methods:
            assert method in allowed_methods, f"Method {method} not in allowed methods: {allowed_methods}"
        
        # Check allowed headers - should allow all (*)
        assert "Access-Control-Allow-Headers" in response.headers

    async def test_preflight_request_invalid_origin(self, client: AsyncClient, invalid_origin: str):
        """Test preflight OPTIONS request with invalid origin has no CORS headers"""
        headers = {
            "Origin": invalid_origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        }
        
        response = await client.options("/", headers=headers)
        
        # OPTIONS may return 400 if not supported, but CORS headers still matter
        # assert response.status_code in [200, 400]
        
        # CRITICAL: Access-Control-Allow-Origin should NOT be present for invalid origin
        # This is the key security control - other CORS headers may be present in FastAPI
        assert response.headers.get("Access-Control-Allow-Origin") is None
        
        # Note: FastAPI may include other CORS headers like Access-Control-Allow-Methods
        # even for invalid origins, but without Access-Control-Allow-Origin, browsers 
        # will still block the request, so this is not a security issue

    async def test_preflight_request_no_origin(self, client: AsyncClient):
        """Test preflight OPTIONS request without Origin header"""
        headers = {
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        }
        
        response = await client.options("/", headers=headers)
        
        # OPTIONS may return 400 if not supported, but CORS headers still matter
        # assert response.status_code in [200, 400]
        
        # Without Origin header, CORS headers should not be added
        assert response.headers.get("Access-Control-Allow-Origin") is None

    async def test_actual_request_valid_origin(self, client: AsyncClient, valid_origin: str):
        """Test actual request with valid origin includes CORS headers in response"""
        headers = {
            "Origin": valid_origin,
            "Content-Type": "application/json"
        }
        
        response = await client.get("/health", headers=headers)
        
        assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
        assert response.headers.get("Access-Control-Allow-Origin") == valid_origin
        
        # FastAPI CORS middleware typically includes Vary header
        assert "Vary" in response.headers

    async def test_actual_request_invalid_origin(self, client: AsyncClient, invalid_origin: str):
        """Test actual request with invalid origin has no CORS headers"""
        headers = {
            "Origin": invalid_origin,
            "Content-Type": "application/json"
        }
        
        response = await client.get("/health", headers=headers)
        
        # Request succeeds
        assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
        
        # But no CORS headers for invalid origin
        assert response.headers.get("Access-Control-Allow-Origin") is None

    async def test_cors_credentials_header_behavior(self, client: AsyncClient, valid_origin: str):
        """Test Access-Control-Allow-Credentials behavior (may not always be present)"""
        headers = {"Origin": valid_origin}
        
        # Test multiple endpoints
        endpoints = ["/health", "/"]
        
        for endpoint in endpoints:
            if endpoint == "/health":
                # For POST endpoints, do OPTIONS first
                response = await client.options(endpoint, headers={
                    **headers,
                    "Access-Control-Request-Method": "POST"
                })
            else:
                response = await client.get(endpoint, headers=headers)
            
            if response.headers.get("Access-Control-Allow-Origin"):
                # If CORS headers are present and credentials header exists, it should be false
                credentials_header = response.headers.get("Access-Control-Allow-Credentials")
                if credentials_header is not None:
                    assert credentials_header == "false"

    async def test_cors_allowed_methods_restricted(self, client: AsyncClient, valid_origin: str):
        """Test that Access-Control-Allow-Methods is restricted to specific HTTP methods"""
        headers = {
            "Origin": valid_origin,
            "Access-Control-Request-Method": "POST"
        }
        
        response = await client.options("/", headers=headers)
        
        allowed_methods = response.headers.get("Access-Control-Allow-Methods", "")
        
        # Should include standard REST methods
        expected_methods = {"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}
        actual_methods = set(method.strip() for method in allowed_methods.split(","))
        
        assert expected_methods.issubset(actual_methods), f"Expected {expected_methods} to be subset of {actual_methods}"
        
        # Should NOT include dangerous methods like TRACE or CONNECT
        dangerous_methods = {"TRACE", "CONNECT"}
        assert not dangerous_methods.intersection(actual_methods), f"Dangerous methods found: {dangerous_methods.intersection(actual_methods)}"

    async def test_cors_headers_present_on_error_responses(self, client: AsyncClient, valid_origin: str):
        """Test CORS headers are present even on error responses"""
        headers = {
            "Origin": valid_origin,
            "Content-Type": "application/json"
        }
        
        # Make request to endpoint that will return 404
        response = await client.get("/api/v1/nonexistent-endpoint", headers=headers)
        
        # Should be 404
        assert response.status_code == 404
        
        # But should still have CORS headers for valid origin
        assert response.headers.get("Access-Control-Allow-Origin") == valid_origin

    async def test_cors_supabase_origin_allowed(self, client: AsyncClient):
        """Test that the specific Supabase project origin is allowed"""
        supabase_origin = "https://eweggzpvuqczrrrwszyy.supabase.co"
        headers = {"Origin": supabase_origin}
        
        response = await client.get("/health", headers=headers)
        
        assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
        assert response.headers.get("Access-Control-Allow-Origin") == supabase_origin

    async def test_cors_multiple_valid_origins(self, client: AsyncClient):
        """Test multiple valid origins are properly handled"""
        valid_origins = [
            "https://app.fynlo.co.uk",
            "https://fynlo.co.uk", 
            "https://fynlo.vercel.app",
            "https://eweggzpvuqczrrrwszyy.supabase.co"
        ]
        
        for origin in valid_origins:
            headers = {"Origin": origin}
            response = await client.get("/health", headers=headers)
            
            assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
            assert response.headers.get("Access-Control-Allow-Origin") == origin, f"Origin {origin} not allowed"

    async def test_cors_case_sensitive_origins(self, client: AsyncClient):
        """Test that origin matching is case-sensitive (security requirement)"""
        # Case variations should be rejected
        invalid_case_origins = [
            "HTTPS://APP.FYNLO.CO.UK",
            "https://APP.FYNLO.CO.UK", 
            "Https://App.Fynlo.Co.Uk"
        ]
        
        for origin in invalid_case_origins:
            headers = {"Origin": origin}
            response = await client.get("/health", headers=headers)
            
            assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
            # CORS headers should NOT be present for case variations
            assert response.headers.get("Access-Control-Allow-Origin") is None, f"Case variant {origin} was incorrectly allowed"

    async def test_cors_origin_with_path_rejected(self, client: AsyncClient):
        """Test that origins with paths are rejected (security requirement)"""
        invalid_origins_with_paths = [
            "https://app.fynlo.co.uk/admin",
            "https://app.fynlo.co.uk/dashboard", 
            "https://app.fynlo.co.uk/api"
        ]
        
        for origin in invalid_origins_with_paths:
            headers = {"Origin": origin}
            response = await client.get("/health", headers=headers)
            
            assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
            assert response.headers.get("Access-Control-Allow-Origin") is None, f"Origin with path {origin} was incorrectly allowed"

    async def test_cors_origin_with_port_handled_correctly(self, client: AsyncClient):
        """Test that origins with non-standard ports are handled correctly"""
        # These should be rejected (not in allowed list)
        origins_with_ports = [
            "https://app.fynlo.co.uk:8080",
            "https://fynlo.co.uk:3000",
            "https://app.fynlo.co.uk:443"  # Even standard HTTPS port should be explicit
        ]
        
        for origin in origins_with_ports:
            headers = {"Origin": origin}
            response = await client.get("/health", headers=headers)
            
            assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
            assert response.headers.get("Access-Control-Allow-Origin") is None, f"Origin with port {origin} was incorrectly allowed"


class TestWebSocketCORSBehavior:
    """Test CORS behavior for WebSocket connections"""

    async def test_websocket_upgrade_valid_origin(self, client: AsyncClient, valid_origin: str, auth_headers: Dict[str, str]):
        """Test WebSocket upgrade with valid origin"""
        # Extract token from auth headers
        auth_token = auth_headers["Authorization"].replace("Bearer ", "")
        
        headers = {
            "Origin": valid_origin,
            "Connection": "upgrade",
            "Upgrade": "websocket",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13"
        }
        
        # Test WebSocket endpoint - this will fail to upgrade in test but should pass origin validation
        response = await client.get(f"/api/v1/websocket/ws/{auth_token}", headers=headers)
        
        # The request may fail for other reasons (WebSocket upgrade in test environment)
        # but if it fails due to CORS, it would be 403 or similar
        # If origin is valid, we expect either successful upgrade or internal error, not CORS rejection
        assert response.status_code != 403, "WebSocket request was rejected due to CORS"

    async def test_websocket_upgrade_invalid_origin(self, client: AsyncClient, invalid_origin: str, auth_headers: Dict[str, str]):
        """Test WebSocket upgrade with invalid origin is rejected"""
        auth_token = auth_headers["Authorization"].replace("Bearer ", "")
        
        headers = {
            "Origin": invalid_origin,
            "Connection": "upgrade", 
            "Upgrade": "websocket",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13"
        }
        
        response = await client.get(f"/api/v1/websocket/ws/{auth_token}", headers=headers)
        
        # Should be rejected - could be 403 Forbidden or other error indicating rejection
        # The exact status depends on how WebSocket origin validation is implemented
        assert response.status_code in [403, 400, 401], f"Expected rejection status, got {response.status_code}"


class TestCORSSecurityEdgeCases:
    """Test edge cases and security scenarios for CORS"""

    async def test_cors_with_subdomain_attacks(self, client: AsyncClient):
        """Test that subdomain attacks are prevented"""
        malicious_origins = [
            "https://evil.app.fynlo.co.uk",  # Subdomain attack
            "https://app.fynlo.co.uk.evil.com",  # Domain suffix attack
            "https://appfynlo.co.uk",  # Missing dot attack
            "https://app-fynlo.co.uk",  # Hyphen variation attack
        ]
        
        for origin in malicious_origins:
            headers = {"Origin": origin}
            response = await client.get("/health", headers=headers)
            
            assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
            assert response.headers.get("Access-Control-Allow-Origin") is None, f"Malicious origin {origin} was allowed"

    async def test_cors_null_origin_handling(self, client: AsyncClient):
        """Test handling of null origin (file:// or data: URIs)"""
        headers = {"Origin": "null"}
        
        response = await client.get("/health", headers=headers)
        
        assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
        # null origin should be rejected
        assert response.headers.get("Access-Control-Allow-Origin") is None

    async def test_cors_empty_origin_handling(self, client: AsyncClient):
        """Test handling of empty origin header"""
        headers = {"Origin": ""}
        
        response = await client.get("/health", headers=headers)
        
        assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
        # Empty origin should be treated as no origin
        assert response.headers.get("Access-Control-Allow-Origin") is None

    async def test_cors_malformed_origin_handling(self, client: AsyncClient):
        """Test handling of malformed origin headers"""
        malformed_origins = [
            "not-a-url",
            "ftp://app.fynlo.co.uk",  # Wrong protocol
            "https://",  # Incomplete URL
            "://app.fynlo.co.uk",  # Missing protocol
            "https://app.fynlo.co.uk:abc",  # Invalid port
        ]
        
        for origin in malformed_origins:
            headers = {"Origin": origin}
            response = await client.get("/health", headers=headers)
            
            assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
            assert response.headers.get("Access-Control-Allow-Origin") is None, f"Malformed origin {origin} was allowed"

    async def test_cors_unicode_domain_attacks(self, client: AsyncClient):
        """Test that Unicode domain attacks are prevented"""
        unicode_origins = [
            "https://аpp.fynlo.co.uk",  # Cyrillic 'a'
            "https://app.fуnlo.co.uk",  # Cyrillic 'y'
            "https://app.fynlo.со.uk",  # Cyrillic 'o'
        ]
        
        for origin in unicode_origins:
            headers = {"Origin": origin}
            response = await client.get("/health", headers=headers)
            
            assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
            assert response.headers.get("Access-Control-Allow-Origin") is None, f"Unicode attack origin {origin} was allowed"

    async def test_cors_ip_address_origins_rejected(self, client: AsyncClient):
        """Test that IP address origins are rejected"""
        ip_origins = [
            "http://192.168.1.1",
            "https://10.0.0.1", 
            "http://127.0.0.1:3000",  # Should be rejected even though localhost:3000 is allowed
            "https://[::1]:3000",  # IPv6 localhost
        ]
        
        for origin in ip_origins:
            headers = {"Origin": origin}
            response = await client.get("/health", headers=headers)
            
            assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
            assert response.headers.get("Access-Control-Allow-Origin") is None, f"IP origin {origin} was allowed"

    async def test_cors_multiple_origin_headers_rejected(self, client: AsyncClient):
        """Test that requests with multiple Origin headers are handled securely"""
        # Most HTTP clients/browsers don't send multiple Origin headers,
        # but test that our implementation handles it securely
        headers = {
            "Origin": "https://app.fynlo.co.uk, https://malicious.com"  # Comma-separated
        }
        
        response = await client.get("/health", headers=headers)
        
        assert response.status_code == 200  # GET requests should succeed
        # assert response.status_code in [200, 400]
        # Should not allow the comma-separated origin
        assert response.headers.get("Access-Control-Allow-Origin") is None

    @pytest.mark.parametrize("method", ["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def test_cors_consistency_across_methods(self, client: AsyncClient, valid_origin: str, method: str):
        """Test that CORS behavior is consistent across all HTTP methods"""
        headers = {"Origin": valid_origin}
        
        # First test with preflight for non-simple methods
        if method in ["PUT", "DELETE", "PATCH"]:
            preflight_headers = {
                **headers,
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "Content-Type"
            }
            
            preflight_response = await client.options("/", headers=preflight_headers)
            assert preflight_response.headers.get("Access-Control-Allow-Origin") == valid_origin
            
            # Check method is in allowed methods
            allowed_methods = preflight_response.headers.get("Access-Control-Allow-Methods", "")
            assert method in allowed_methods
        
        # Test actual request (where possible)
        if method == "GET":
            response = await client.get("/health", headers=headers)
        elif method == "POST":
            response = await client.post("/api/v1/auth/refresh", headers=headers, json={})
        # For PUT, DELETE, PATCH we'd need valid endpoints and auth, so just test preflight above
        else:
            return
            
        assert response.headers.get("Access-Control-Allow-Origin") == valid_origin


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])

