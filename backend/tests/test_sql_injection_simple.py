"""
Simple SQL injection tests to verify our security fixes
"""
import pytest
import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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


class TestInputValidators:
    """Test input validation functions"""
    
    def test_search_input_validation(self):
        """Test search input sanitization"""
        # Valid inputs
        assert validate_search_input("hello world") == "hello world"
        assert validate_search_input("test@example.com") == "test@example.com"
        
        # SQL injection attempts - should raise ValueError due to SQL patterns
        with pytest.raises(ValueError, match="potentially malicious SQL patterns"):
            validate_search_input("'; DROP TABLE users--")
        
        with pytest.raises(ValueError, match="potentially malicious SQL patterns"):
            validate_search_input("1' OR '1'='1")
        
        with pytest.raises(ValueError, match="potentially malicious SQL patterns"):
            validate_search_input("admin'--")
    
    def test_uuid_validation(self):
        """Test UUID format validation"""
        # Valid UUIDs
        valid_uuid = "123e4567-e89b-12d3-a456-426614174000"
        assert validate_uuid_format(valid_uuid) == valid_uuid
        
        # Invalid formats should raise ValueError
        with pytest.raises(ValueError):
            validate_uuid_format("not-a-uuid")
        
        with pytest.raises(ValueError):
            validate_uuid_format("123e4567-e89b-12d3-a456-426614174000'; DROP TABLE--")
    
    def test_sort_field_validation(self):
        """Test sort field whitelist validation"""
        allowed_fields = ['created_at', 'updated_at', 'name']
        
        # Valid fields
        assert validate_sort_field('created_at', allowed_fields) == 'created_at'
        
        # Invalid fields should raise ValueError
        with pytest.raises(ValueError):
            validate_sort_field('password', allowed_fields)
        
        with pytest.raises(ValueError):
            validate_sort_field('created_at; DROP TABLE users', allowed_fields)


class TestSecurityUtils:
    """Test security utility functions"""
    
    def test_sanitize_sql_like_pattern(self):
        """Test LIKE pattern sanitization"""
        # Normal patterns
        assert sanitize_sql_like_pattern("test") == "test"
        assert sanitize_sql_like_pattern("test%") == "test\\%"
        assert sanitize_sql_like_pattern("_test") == "\\_test"
        
        # SQL injection in LIKE
        assert sanitize_sql_like_pattern("'; DROP TABLE--") == "'; DROP TABLE--"
        assert sanitize_sql_like_pattern("\\%admin") == "\\\\\\%admin"
    
    def test_sanitize_sql_identifier(self):
        """Test SQL identifier whitelist validation"""
        # Valid identifiers
        allowed_tables = ["users", "restaurants", "orders"]
        assert sanitize_sql_identifier("users", allowed_tables) == "users"
        assert sanitize_sql_identifier("restaurants", allowed_tables) == "restaurants"
        
        # Invalid identifiers should raise ValueError
        with pytest.raises(ValueError):
            sanitize_sql_identifier("customers", allowed_tables)
        
        with pytest.raises(ValueError):
            sanitize_sql_identifier("users; DROP TABLE--", allowed_tables)
    
    def test_is_valid_uuid(self):
        """Test UUID validation"""
        # Valid UUIDs
        assert is_valid_uuid("123e4567-e89b-12d3-a456-426614174000") is True
        assert is_valid_uuid("550e8400-e29b-41d4-a716-446655440000") is True
        
        # Invalid UUIDs
        assert is_valid_uuid("not-a-uuid") is False
        assert is_valid_uuid("123456789") is False
        assert is_valid_uuid("123e4567-e89b-12d3-a456") is False  # Too short
        assert is_valid_uuid("123e4567-e89b-12d3-a456-426614174000-extra") is False  # Too long


class TestSQLInjectionPatterns:
    """Test common SQL injection patterns are blocked"""
    
    @pytest.mark.parametrize("payload", [
        "' OR '1'='1",
        "'; DROP TABLE users--",
        "admin'--",
        "' UNION SELECT * FROM users--",
        "1' AND SLEEP(5)--",
        "'; EXEC xp_cmdshell('dir')--",
        "' OR 1=1#",
        "\\'; DROP TABLE users--",
        "' AND (SELECT COUNT(*) FROM users) > 0--",
        "%27%20OR%20%271%27%3D%271",  # URL encoded
    ])
    def test_sql_injection_patterns_blocked(self, payload):
        """Test that common SQL injection patterns are detected"""
        # The validate_no_sql_injection should raise ValueError for these
        with pytest.raises(ValueError, match="potential SQL injection"):
            validate_no_sql_injection(payload, "test field")


class TestPydanticSchemas:
    """Test Pydantic schema validation"""
    
    def test_search_schema_validation(self):
        """Test search schema blocks SQL injection"""
        from app.schemas.search_schemas import CustomerSearchRequest
        
        # Valid search
        valid_data = {
            "search": "john",
            "email": "john@example.com",
            "sort_by": "created_at",
            "page": 1,
            "limit": 20
        }
        schema = CustomerSearchRequest(**valid_data)
        assert schema.search == "john"
        
        # SQL injection in search - should raise validation error
        injection_data = {
            "search": "'; DROP TABLE users--",
            "page": 1
        }
        with pytest.raises(ValueError, match="potentially malicious SQL patterns"):
            CustomerSearchRequest(**injection_data)
        
        # Invalid sort field should raise error
        with pytest.raises(ValueError):
            CustomerSearchRequest(
                search="test",
                sort_by="password",  # Not in allowed fields
                page=1
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
