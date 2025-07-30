#!/usr/bin/env python3
"""
Standalone script to verify SQL injection fixes are working
"""
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set test environment
os.environ["APP_ENV"] = "test"

from app.core.validators import (
    validate_search_input,
    validate_sort_field,
    validate_uuid_format,
    validate_no_sql_injection
)
from app.core.security_utils import (
    sanitize_sql_like_pattern,
    sanitize_sql_identifier,
    is_valid_uuid
)

def test_sql_injection_validation():
    """Test that SQL injection patterns are detected"""
    print("\n=== Testing SQL Injection Detection ===")
    
    sql_injection_patterns = [
        "' OR '1'='1",
        "'; DROP TABLE users--",
        "admin'--",
        "' UNION SELECT * FROM users--",
        "1' AND SLEEP(5)--",
        "'; EXEC xp_cmdshell('dir')--",
    ]
    
    for pattern in sql_injection_patterns:
        try:
            validate_no_sql_injection(pattern, "test")
            print(f"❌ FAILED: Pattern not detected: {pattern}")
            return False
        except ValueError as e:
            print(f"✅ PASSED: Detected SQL injection in: {pattern}")
    
    return True

def test_search_input_validation():
    """Test search input validation"""
    print("\n=== Testing Search Input Validation ===")
    
    # Valid inputs should pass
    valid_inputs = ["hello world", "test@example.com", "product name"]
    for inp in valid_inputs:
        try:
            result = validate_search_input(inp)
            print(f"✅ PASSED: Valid input accepted: {inp}")
        except:
            print(f"❌ FAILED: Valid input rejected: {inp}")
            return False
    
    # SQL injection attempts should be blocked
    invalid_inputs = ["'; DROP TABLE--", "' OR 1=1--", "admin'--"]
    for inp in invalid_inputs:
        try:
            result = validate_search_input(inp)
            print(f"❌ FAILED: SQL injection not blocked: {inp}")
            return False
        except ValueError:
            print(f"✅ PASSED: SQL injection blocked: {inp}")
    
    return True

def test_uuid_validation():
    """Test UUID format validation"""
    print("\n=== Testing UUID Validation ===")
    
    # Valid UUIDs
    valid_uuids = [
        "123e4567-e89b-12d3-a456-426614174000",
        "550e8400-e29b-41d4-a716-446655440000"
    ]
    
    for uuid in valid_uuids:
        try:
            validate_uuid_format(uuid)
            print(f"✅ PASSED: Valid UUID accepted: {uuid}")
        except:
            print(f"❌ FAILED: Valid UUID rejected: {uuid}")
            return False
    
    # Invalid UUIDs
    invalid_uuids = [
        "not-a-uuid",
        "123456789",
        "'; DROP TABLE--"
    ]
    
    for uuid in invalid_uuids:
        try:
            validate_uuid_format(uuid)
            print(f"❌ FAILED: Invalid UUID accepted: {uuid}")
            return False
        except ValueError:
            print(f"✅ PASSED: Invalid UUID rejected: {uuid}")
    
    return True

def test_sanitization_functions():
    """Test sanitization utilities"""
    print("\n=== Testing Sanitization Functions ===")
    
    # Test LIKE pattern sanitization
    assert sanitize_sql_like_pattern("test%") == "test\\%"
    assert sanitize_sql_like_pattern("_test") == "\\_test"
    print("✅ PASSED: LIKE pattern sanitization working")
    
    # Test SQL identifier validation
    allowed = ["users", "orders", "products"]
    try:
        sanitize_sql_identifier("users", allowed)
        print("✅ PASSED: Valid identifier accepted")
    except:
        print("❌ FAILED: Valid identifier rejected")
        return False
    
    try:
        sanitize_sql_identifier("invalid_table", allowed)
        print("❌ FAILED: Invalid identifier accepted")
        return False
    except ValueError:
        print("✅ PASSED: Invalid identifier rejected")
    
    return True

def test_pydantic_schemas():
    """Test Pydantic schema validation"""
    print("\n=== Testing Pydantic Schema Validation ===")
    
    from app.schemas.search_schemas import CustomerSearchRequest
    
    # Valid request
    try:
        schema = CustomerSearchRequest(search="john", page=1)
        print("✅ PASSED: Valid search request accepted")
    except:
        print("❌ FAILED: Valid search request rejected")
        return False
    
    # SQL injection attempt
    try:
        schema = CustomerSearchRequest(search="'; DROP TABLE--", page=1)
        print("❌ FAILED: SQL injection in schema not blocked")
        return False
    except ValueError:
        print("✅ PASSED: SQL injection in schema blocked")
    
    # Invalid sort field
    try:
        schema = CustomerSearchRequest(search="test", sort_by="password", page=1)
        print("❌ FAILED: Invalid sort field accepted")
        return False
    except ValueError:
        print("✅ PASSED: Invalid sort field rejected")
    
    return True

def main():
    """Run all tests"""
    print("SQL Injection Security Fix Verification")
    print("=" * 50)
    
    all_passed = True
    
    tests = [
        test_sql_injection_validation,
        test_search_input_validation,
        test_uuid_validation,
        test_sanitization_functions,
        test_pydantic_schemas
    ]
    
    for test in tests:
        try:
            if not test():
                all_passed = False
        except Exception as e:
            print(f"❌ ERROR in {test.__name__}: {e}")
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("✅ ALL TESTS PASSED - SQL injection fixes are working correctly!")
    else:
        print("❌ SOME TESTS FAILED - Please check the output above")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())