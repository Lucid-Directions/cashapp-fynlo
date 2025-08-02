#\!/usr/bin/env python3
"""
Authentication Security Testing for Fynlo POS
Tests security aspects of the authentication system
"""

import os
import asyncio
import json
import sys
import time
from pathlib import Path
import httpx
import jwt as jwt_lib
from datetime import datetime, timedelta

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.core.config import settings

class AuthenticationSecurityTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        
    async def run_all_tests(self):
        """Run all authentication security tests"""
        print("🔐 Running Authentication Security Tests\n")
        
        tests = [
            self.test_missing_token,
            self.test_invalid_token,
            self.test_expired_token,
            self.test_malformed_token,
            self.test_sql_injection_in_auth,
            self.test_token_tampering,
            self.test_brute_force_protection,
            self.test_authorization_bypass,
            self.test_role_escalation,
            self.test_cross_tenant_access
        ]
        
        for test in tests:
            try:
                await test()
            except Exception as e:
                self.test_results.append({
                    "test": test.__name__,
                    "status": "ERROR",
                    "message": str(e)
                })
        
        self.print_results()
        
    async def test_missing_token(self):
        """Test API behavior when no token is provided"""
        print("Testing missing token...")
        
        endpoints = [
            "/api/v1/menu",
            "/api/v1/orders",
            "/api/v1/users/me",
            "/api/v1/restaurants/current"
        ]
        
        for endpoint in endpoints:
            response = await self.client.get(f"{self.base_url}{endpoint}")
            
            if response.status_code \!= 401:
                self.test_results.append({
                    "test": "Missing Token",
                    "status": "FAIL",
                    "message": f"{endpoint} returned {response.status_code} instead of 401"
                })
            else:
                self.test_results.append({
                    "test": "Missing Token",
                    "status": "PASS",
                    "message": f"{endpoint} correctly rejected request"
                })
                
    async def test_invalid_token(self):
        """Test API behavior with invalid tokens"""
        print("Testing invalid tokens...")
        
        invalid_tokens = [
            "completely_invalid_token",
            "Bearer invalid_token",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.invalid",
            ""
        ]
        
        for token in invalid_tokens:
            headers = {"Authorization": f"Bearer {token}"}
            response = await self.client.get(
                f"{self.base_url}/api/v1/users/me",
                headers=headers
            )
            
            if response.status_code \!= 401:
                self.test_results.append({
                    "test": "Invalid Token",
                    "status": "FAIL",
                    "message": f"Token '{token[:20]}...' returned {response.status_code}"
                })
            else:
                self.test_results.append({
                    "test": "Invalid Token",
                    "status": "PASS",
                    "message": f"Token '{token[:20]}...' correctly rejected"
                })
                
    async def test_expired_token(self):
        """Test API behavior with expired tokens"""
        print("Testing expired tokens...")
        
        # Create an expired token
        expired_payload = {
            "sub": "test_user",
            "exp": datetime.utcnow() - timedelta(hours=1)
        }
        
        # Use the actual secret key from settings
        secret_key = os.environ.get("SECRET_KEY", settings.SECRET_KEY)
        expired_token = jwt_lib.encode(
            expired_payload,
            secret_key,
            algorithm="HS256"
        )
        
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = await self.client.get(
            f"{self.base_url}/api/v1/users/me",
            headers=headers
        )
        
        if response.status_code \!= 401:
            self.test_results.append({
                "test": "Expired Token",
                "status": "FAIL",
                "message": f"Expired token returned {response.status_code}"
            })
        else:
            self.test_results.append({
                "test": "Expired Token",
                "status": "PASS",
                "message": "Expired token correctly rejected"
            })
            
    async def test_malformed_token(self):
        """Test API behavior with malformed tokens"""
        print("Testing malformed tokens...")
        
        malformed_tokens = [
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",  # Missing parts
            "not.a.jwt",  # Wrong format
            "Bearer Bearer token",  # Double Bearer
            "bearer lowercase_token"  # Lowercase bearer
        ]
        
        for token in malformed_tokens:
            headers = {"Authorization": token}
            response = await self.client.get(
                f"{self.base_url}/api/v1/users/me",
                headers=headers
            )
            
            if response.status_code \!= 401:
                self.test_results.append({
                    "test": "Malformed Token",
                    "status": "FAIL",
                    "message": f"Malformed '{token[:30]}...' returned {response.status_code}"
                })
            else:
                self.test_results.append({
                    "test": "Malformed Token",
                    "status": "PASS",
                    "message": f"Malformed '{token[:30]}...' correctly rejected"
                })
                
    async def test_sql_injection_in_auth(self):
        """Test SQL injection attempts in authentication"""
        print("Testing SQL injection in auth...")
        
        sql_payloads = [
            "' OR '1'='1",
            "admin'--",
            "1; DROP TABLE users;--",
            "' UNION SELECT * FROM users--"
        ]
        
        for payload in sql_payloads:
            # Try SQL injection in login
            login_data = {
                "email": payload,
                "password": payload
            }
            
            response = await self.client.post(
                f"{self.base_url}/api/v1/auth/login",
                json=login_data
            )
            
            # We expect 401 for invalid credentials, not 500 (SQL error)
            if response.status_code == 500:
                self.test_results.append({
                    "test": "SQL Injection",
                    "status": "FAIL",
                    "message": f"Payload '{payload}' caused server error"
                })
            else:
                self.test_results.append({
                    "test": "SQL Injection",
                    "status": "PASS",
                    "message": f"Payload '{payload}' handled safely"
                })
                
    async def test_token_tampering(self):
        """Test token tampering detection"""
        print("Testing token tampering...")
        
        # Create a valid token
        valid_payload = {
            "sub": "test_user",
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        
        secret_key = os.environ.get("SECRET_KEY", settings.SECRET_KEY)
        valid_token = jwt_lib.encode(
            valid_payload,
            secret_key,
            algorithm="HS256"
        )
        
        # Tamper with the token
        parts = valid_token.split('.')
        if len(parts) == 3:
            # Modify the payload
            tampered_token = f"{parts[0]}.modified{parts[1]}.{parts[2]}"
            
            headers = {"Authorization": f"Bearer {tampered_token}"}
            response = await self.client.get(
                f"{self.base_url}/api/v1/users/me",
                headers=headers
            )
            
            if response.status_code \!= 401:
                self.test_results.append({
                    "test": "Token Tampering",
                    "status": "FAIL",
                    "message": "Tampered token was accepted"
                })
            else:
                self.test_results.append({
                    "test": "Token Tampering",
                    "status": "PASS",
                    "message": "Tampered token correctly rejected"
                })
                
    async def test_brute_force_protection(self):
        """Test brute force protection on login"""
        print("Testing brute force protection...")
        
        # Attempt multiple failed logins
        failed_attempts = 0
        for i in range(10):
            response = await self.client.post(
                f"{self.base_url}/api/v1/auth/login",
                json={
                    "email": "test@example.com",
                    "password": f"wrong_password_{i}"
                }
            )
            
            if response.status_code == 429:  # Too Many Requests
                self.test_results.append({
                    "test": "Brute Force Protection",
                    "status": "PASS",
                    "message": f"Rate limiting activated after {i+1} attempts"
                })
                return
            
            failed_attempts += 1
            
        self.test_results.append({
            "test": "Brute Force Protection",
            "status": "WARNING",
            "message": f"No rate limiting after {failed_attempts} failed attempts"
        })
        
    async def test_authorization_bypass(self):
        """Test authorization bypass attempts"""
        print("Testing authorization bypass...")
        
        # Try to access admin endpoints without proper role
        admin_endpoints = [
            "/api/v1/platform/users",
            "/api/v1/platform/restaurants",
            "/api/v1/platform/analytics"
        ]
        
        # Create a token for a regular user
        user_payload = {
            "sub": "regular_user",
            "role": "employee",
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        
        secret_key = os.environ.get("SECRET_KEY", settings.SECRET_KEY)
        user_token = jwt_lib.encode(
            user_payload,
            secret_key,
            algorithm="HS256"
        )
        
        headers = {"Authorization": f"Bearer {user_token}"}
        
        for endpoint in admin_endpoints:
            response = await self.client.get(
                f"{self.base_url}{endpoint}",
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                self.test_results.append({
                    "test": "Authorization Bypass",
                    "status": "FAIL",
                    "message": f"Regular user accessed admin endpoint: {endpoint}"
                })
            else:
                self.test_results.append({
                    "test": "Authorization Bypass",
                    "status": "PASS",
                    "message": f"Admin endpoint {endpoint} correctly protected"
                })
                
    async def test_role_escalation(self):
        """Test role escalation attempts"""
        print("Testing role escalation...")
        
        # Try to modify role in token
        escalation_payload = {
            "sub": "test_user",
            "role": "platform_owner",  # Trying to escalate
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        
        # Sign with a different key (simulating attacker)
        fake_token = jwt_lib.encode(
            escalation_payload,
            "attacker_secret_key",
            algorithm="HS256"
        )
        
        headers = {"Authorization": f"Bearer {fake_token}"}
        response = await self.client.get(
            f"{self.base_url}/api/v1/platform/users",
            headers=headers
        )
        
        if response.status_code in [200, 201]:
            self.test_results.append({
                "test": "Role Escalation",
                "status": "FAIL",
                "message": "Role escalation attack succeeded"
            })
        else:
            self.test_results.append({
                "test": "Role Escalation",
                "status": "PASS",
                "message": "Role escalation attempt blocked"
            })
            
    async def test_cross_tenant_access(self):
        """Test cross-tenant data access"""
        print("Testing cross-tenant access...")
        
        # Create token for restaurant A
        tenant_a_payload = {
            "sub": "user_a",
            "restaurant_id": "restaurant_a",
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        
        secret_key = os.environ.get("SECRET_KEY", settings.SECRET_KEY)
        tenant_a_token = jwt_lib.encode(
            tenant_a_payload,
            secret_key,
            algorithm="HS256"
        )
        
        headers = {"Authorization": f"Bearer {tenant_a_token}"}
        
        # Try to access restaurant B's data
        response = await self.client.get(
            f"{self.base_url}/api/v1/restaurants/restaurant_b/orders",
            headers=headers
        )
        
        if response.status_code in [200, 201]:
            self.test_results.append({
                "test": "Cross-Tenant Access",
                "status": "FAIL",
                "message": "User accessed another tenant's data"
            })
        else:
            self.test_results.append({
                "test": "Cross-Tenant Access",
                "status": "PASS",
                "message": "Cross-tenant access correctly blocked"
            })
            
    def print_results(self):
        """Print test results summary"""
        print("\n" + "="*60)
        print("AUTHENTICATION SECURITY TEST RESULTS")
        print("="*60)
        
        passed = sum(1 for r in self.test_results if r["status"] == "PASS")
        failed = sum(1 for r in self.test_results if r["status"] == "FAIL")
        warnings = sum(1 for r in self.test_results if r["status"] == "WARNING")
        errors = sum(1 for r in self.test_results if r["status"] == "ERROR")
        
        print(f"\nTotal Tests: {len(self.test_results)}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️  Warnings: {warnings}")
        print(f"🔥 Errors: {errors}")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    print(f"  - {result['test']}: {result['message']}")
                    
        if warnings > 0:
            print("\n⚠️  WARNINGS:")
            for result in self.test_results:
                if result["status"] == "WARNING":
                    print(f"  - {result['test']}: {result['message']}")
                    
        if errors > 0:
            print("\n🔥 ERRORS:")
            for result in self.test_results:
                if result["status"] == "ERROR":
                    print(f"  - {result['test']}: {result['message']}")
                    
        print("\n" + "="*60)
        
        # Return non-zero exit code if any tests failed
        if failed > 0 or errors > 0:
            return 1
        return 0
        
    async def cleanup(self):
        """Clean up resources"""
        await self.client.aclose()

async def main():
    """Run the authentication security tests"""
    tester = AuthenticationSecurityTester()
    
    try:
        await tester.run_all_tests()
    finally:
        await tester.cleanup()

if __name__ == "__main__":
    # Run the async main function
    exit_code = asyncio.run(main())
    sys.exit(exit_code or 0)
EOF < /dev/null