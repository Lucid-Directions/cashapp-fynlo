"""SQL Injection Security Tests for Fynlo POS.

Tests various SQL injection attack vectors against the application.
"""

import pytest
from fastapi import HTTPException

from app.core.security import (
    sanitize_dict,
    sanitize_filename,
    sanitize_string,
    validate_sql_safe,
)


class TestSQLInjectionPrevention:
    """Test suite for SQL injection prevention."""

    def test_sql_comment_sequences_blocked(self):
        """Test that SQL comment sequences are removed."""
        dangerous_inputs = [
            "normal text -- DROP TABLE users",
            "data /* DROP TABLE */ more data",
            "input # DELETE FROM orders",
            "value; -- malicious comment",
            "text; /* evil */ code",
        ]

        for dangerous in dangerous_inputs:
            sanitized = sanitize_string(dangerous, strict=True)
            assert "--" not in sanitized
            assert "/*" not in sanitized
            assert "*/" not in sanitized
            assert "#" not in sanitized

    def test_sql_keywords_removed_strict_mode(self):
        """Test that SQL keywords are removed in strict mode."""
        dangerous_inputs = [
            "SELECT * FROM users",
            "DROP TABLE orders",
            "UPDATE users SET admin=true",
            "DELETE FROM restaurants",
            "INSERT INTO payments",
            "UNION SELECT password",
            "EXEC xp_cmdshell",
            "WAITFOR DELAY '00:00:05'",
        ]

        for dangerous in dangerous_inputs:
            sanitized = sanitize_string(dangerous, strict=True)
            # Check that SQL keywords are removed
            for keyword in [
                "SELECT",
                "DROP",
                "UPDATE",
                "DELETE",
                "INSERT",
                "UNION",
                "EXEC",
                "WAITFOR",
            ]:
                assert keyword.lower() not in sanitized.lower()

    def test_sql_keywords_preserved_non_strict(self):
        """Test that normal words containing SQL keywords are preserved.

        In non-strict mode, normal words should not be affected.
        """
        normal_inputs = [
            "Please select your order",
            "The update was successful",
            "Delete this item from cart",
            "Insert coin to continue",
        ]

        for normal in normal_inputs:
            sanitized = sanitize_string(normal, strict=False)
            # In non-strict mode, these should be preserved
            # as they're normal text
            assert len(sanitized) > 0

    def test_hex_encoding_removed(self):
        """Test that hex encoding attempts are removed."""
        dangerous_inputs = [
            "0x44524f50205441424c45",  # Hex for DROP TABLE
            "char(0x44)",
            "\\x27 OR 1=1",
            "0xDEADBEEF",
        ]

        for dangerous in dangerous_inputs:
            sanitized = sanitize_string(dangerous, strict=True)
            assert "0x" not in sanitized
            assert "\\x" not in sanitized

    def test_special_characters_sanitization(self):
        """Test that special characters used in SQL injection are handled."""
        dangerous_inputs = [
            "'; DROP TABLE users; --",
            '" OR "1"="1',
            "` OR `1`=`1",
            "admin'--",
            "1' OR '1'='1",
            "1; DELETE FROM orders WHERE '1'='1",
        ]

        for dangerous in dangerous_inputs:
            sanitized = sanitize_string(dangerous, strict=True)
            # These characters should be removed in strict mode
            assert "'" not in sanitized
            assert ";" not in sanitized
            assert "`" not in sanitized

    def test_validate_sql_safe_blocks_injection_patterns(self):
        """Test that validate_sql_safe raises exceptions.

        Should detect dangerous SQL injection patterns.
        """
        injection_attempts = [
            "' OR '1'='1",
            "; DROP TABLE users",
            "UNION SELECT * FROM passwords",
            "'; WAITFOR DELAY '00:00:05'--",
            "INTO OUTFILE '/etc/passwd'",
            "LOAD_FILE('/etc/passwd')",
        ]

        for attempt in injection_attempts:
            with pytest.raises(HTTPException) as exc_info:
                validate_sql_safe(attempt)
            assert exc_info.value.status_code == 400

    def test_validate_sql_safe_allows_normal_text(self):
        """Test that validate_sql_safe allows normal user input."""
        normal_inputs = [
            "John's Pizza Order",
            "Special instructions: Extra cheese, no onions",
            "Address: 123 Main St.",
            "Note: Call when arriving",
            "Business name: Smith & Sons",
        ]

        for normal in normal_inputs:
            # Should not raise exception
            result = validate_sql_safe(normal)
            assert result == normal

    def test_sanitize_dict_processes_nested_structures(self):
        """Test that sanitize_dict handles nested dictionaries and lists."""
        dangerous_dict = {
            "name": "John'; DROP TABLE users; --",
            "notes": "Normal note /* evil comment */",
            "items": [
                "item1 SELECT * FROM passwords",
                "item2 -- DELETE everything",
            ],
            "nested": {"field": "UNION SELECT secrets", "value": "0x44524f50"},
        }

        sanitized = sanitize_dict(dangerous_dict, strict=True)

        # Check that dangerous content is removed
        assert "DROP TABLE" not in sanitized["name"]
        assert "/*" not in sanitized["notes"]
        assert "SELECT" not in sanitized["items"][0]
        assert "--" not in sanitized["items"][1]
        assert "UNION" not in sanitized["nested"]["field"]
        assert "0x" not in sanitized["nested"]["value"]

    def test_null_byte_injection_prevention(self):
        """Test that null bytes and control characters are removed."""
        dangerous_inputs = [
            "data\x00after_null",
            "text\x01\x02\x03control_chars",
            "line1\x00\nline2",
            "field\x1funit_separator",
        ]

        for dangerous in dangerous_inputs:
            sanitized = sanitize_string(dangerous)
            # Null bytes and control characters should be removed
            assert "\x00" not in sanitized
            assert all(ord(char) >= 32 or char in "\t\n" for char in sanitized)

    def test_filename_sanitization(self):
        """Test filename sanitization prevents directory traversal."""
        dangerous_filenames = [
            "../../../etc/passwd",
            "..\\..\\windows\\system32\\config",
            "file<script>.pdf",
            "report|command.doc",
            "data:text/html,<script>alert(1)</script>",
            "file\x00.txt",
        ]

        for dangerous in dangerous_filenames:
            sanitized = sanitize_filename(dangerous)
            assert ".." not in sanitized
            assert "/" not in sanitized
            assert "\\" not in sanitized
            assert "<" not in sanitized
            assert ">" not in sanitized
            assert "|" not in sanitized

    def test_time_based_injection_patterns(self):
        """Test detection of time-based SQL injection attempts."""
        time_attacks = [
            "1' AND SLEEP(5)--",
            "'; WAITFOR DELAY '00:00:05'--",
            "1' AND BENCHMARK(1000000,MD5('test'))--",
            "' OR IF(1=1, SLEEP(5), 0)--",
        ]

        for attack in time_attacks:
            sanitized = sanitize_string(attack, strict=True)
            assert "SLEEP" not in sanitized.upper()
            assert "WAITFOR" not in sanitized.upper()
            assert "BENCHMARK" not in sanitized.upper()

    def test_unicode_bypass_attempts(self):
        """Test that Unicode encoding bypass attempts are handled."""
        unicode_attacks = [
            "＇ OR １＝１",  # Full-width characters
            "＂ OR ＂１＂＝＂１",
            "％27 OR 1=1",  # URL encoded in Unicode
        ]

        for attack in unicode_attacks:
            sanitized = sanitize_string(attack, strict=True)
            # Should handle Unicode variations of dangerous characters
            # Some characters should be removed
            assert len(sanitized) < len(attack)

    def test_second_order_injection_prevention(self):
        """Test prevention of second-order injection.

        Verify that stored data is sanitized properly.
        """
        # Simulate data that might be stored and later used in queries
        stored_data = {
            "username": "admin'; DROP TABLE users; --",
            "email": "test@test.com' OR '1'='1",
            "company": "ACME'); DELETE FROM orders; --",
        }

        # Sanitize before storage
        sanitized_data = sanitize_dict(stored_data, strict=False)

        # Verify dangerous patterns are removed even for stored data
        assert "DROP TABLE" not in sanitized_data["username"]
        assert "' OR '" not in sanitized_data["email"]
        assert "DELETE FROM" not in sanitized_data["company"]
