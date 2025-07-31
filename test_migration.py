#!/usr/bin/env python3
"""
Simple test to verify HTTPException to FynloException migration
"""
import sys
import os
import traceback

# Add the app to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_exception_imports():
    """Test that all exception classes can be imported correctly"""
    try:
        from app.core.exceptions import (
            FynloException,
            AuthenticationException,
            AuthorizationException,
            ValidationException,
            ResourceNotFoundException,
            ConflictException,
            BusinessLogicException,
            PaymentException,
            ServiceUnavailableError,
            InventoryException
        )
        print("✅ All exception classes imported successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to import exception classes: {e}")
        traceback.print_exc()
        return False

def test_exception_instantiation():
    """Test that exceptions can be created with new message parameter"""
    try:
        from app.core.exceptions import (
            AuthenticationException,
            AuthorizationException,
            ResourceNotFoundException
        )
        
        # Test AuthenticationException
        auth_ex = AuthenticationException(message="Test auth message")
        assert auth_ex.message == "Test auth message"
        assert auth_ex.status_code == 401
        print("✅ AuthenticationException works correctly")
        
        # Test AuthorizationException  
        authz_ex = AuthorizationException(message="Test authz message")
        assert authz_ex.message == "Test authz message"
        assert authz_ex.status_code == 403
        print("✅ AuthorizationException works correctly")
        
        # Test ResourceNotFoundException
        not_found_ex = ResourceNotFoundException(resource="User", resource_id="123")
        assert "User not found" in not_found_ex.message
        assert not_found_ex.status_code == 404
        print("✅ ResourceNotFoundException works correctly")
        
        return True
    except Exception as e:
        print(f"❌ Failed to instantiate exceptions: {e}")
        traceback.print_exc()
        return False

def test_key_imports():
    """Test that key modules can be imported without HTTPException errors"""
    try:
        from app.core.dependencies import get_current_user_with_tenant_validation
        print("✅ Dependencies module imports successfully")
        
        from app.core.auth import get_current_user
        print("✅ Auth module imports successfully")
        
        from app.api.v1.endpoints.auth import router
        print("✅ Auth endpoints import successfully")
        
        return True
    except Exception as e:
        print(f"❌ Failed to import key modules: {e}")
        traceback.print_exc()
        return False

def main():
    """Run migration verification tests"""
    print("🧪 Testing HTTPException to FynloException Migration")
    print("=" * 50)
    
    tests = [
        test_exception_imports,
        test_exception_instantiation,
        test_key_imports
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        print(f"\n📋 Running {test.__name__}...")
        if test():
            passed += 1
        else:
            print(f"❌ {test.__name__} failed")
    
    print(f"\n📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ Migration verification PASSED")
        return 0
    else:
        print("❌ Migration verification FAILED")
        return 1

if __name__ == "__main__":
    exit(main())