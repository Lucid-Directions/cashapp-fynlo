"""Enhanced input validators for security."""
import re
from typing import Any, Optional
from pydantic import validator, ValidationError
from app.core.security_utils import sanitize_search_term, is_valid_uuid


# SQL injection pattern detection
SQL_INJECTION_PATTERNS = [
    r"(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|eval)\s",
    r"(-{2}|\/\*|\*\/|;|'|\")",  # SQL comments and quotes
    r"(xp_|sp_|0x[0-9a-f]+)",  # Extended stored procedures and hex
    r"(cast|convert|concat|substring|char|ascii)\s*\(",  # SQL functions
    r"(waitfor|delay|sleep|benchmark)\s",  # Time-based attacks
    r"(or|and)\s+\d+\s*=\s*\d+",  # Boolean-based attacks like "or 1=1"
]

COMPILED_SQL_PATTERNS = [re.compile(pattern, re.IGNORECASE) for pattern in SQL_INJECTION_PATTERNS]


def validate_no_sql_injection(value: str, field_name: str = "input") -> str:
    """Validate that input doesn't contain SQL injection patterns."""
    if not value:
        return value
    
    # Check for SQL injection patterns
    for pattern in COMPILED_SQL_PATTERNS:
        if pattern.search(value):
            raise ValueError(f"{field_name} contains potentially malicious SQL patterns")
    
    return value


def validate_search_input(value: Optional[str]) -> Optional[str]:
    """Validate and sanitize search input."""
    if not value:
        return value
    
    # Length check
    if len(value) > 100:
        raise ValueError("Search input too long (max 100 characters)")
    
    # Check for SQL injection
    validate_no_sql_injection(value, "Search input")
    
    # Sanitize
    return sanitize_search_term(value)


def validate_uuid_format(value: str) -> str:
    """Validate UUID format."""
    if not is_valid_uuid(value):
        raise ValueError("Invalid UUID format")
    return value


def validate_sort_field(value: str, allowed_fields: list[str]) -> str:
    """Validate sort field against whitelist."""
    # Remove any direction suffix (e.g., "name:asc" -> "name")
    field = value.split(':')[0].strip()
    
    if field not in allowed_fields:
        raise ValueError(f"Invalid sort field. Allowed fields: {', '.join(allowed_fields)}")
    
    return value


def validate_email_format(email: str) -> str:
    """Enhanced email validation."""
    if not email:
        raise ValueError("Email cannot be empty")
    
    # Basic email pattern
    email_pattern = re.compile(
        r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    )
    
    if not email_pattern.match(email):
        raise ValueError("Invalid email format")
    
    # Check for SQL injection in email
    validate_no_sql_injection(email, "Email")
    
    return email.lower()


def validate_phone_format(phone: str) -> str:
    """Enhanced phone validation."""
    if not phone:
        return phone
    
    # Remove common formatting characters
    cleaned = re.sub(r'[\s\-\(\)\+\.]', '', phone)
    
    # Check if it's all digits after cleaning
    if not cleaned.isdigit():
        raise ValueError("Phone number contains invalid characters")
    
    # Length check
    if len(cleaned) < 7 or len(cleaned) > 15:
        raise ValueError("Phone number length invalid (7-15 digits)")
    
    return phone


def validate_name_field(name: str, field_name: str = "Name") -> str:
    """Validate name fields (first name, last name, etc)."""
    if not name:
        return name
    
    # Length check
    if len(name) > 50:
        raise ValueError(f"{field_name} too long (max 50 characters)")
    
    # Allow only letters, spaces, hyphens, and apostrophes
    name_pattern = re.compile(r"^[a-zA-Z\s\-']+$")
    if not name_pattern.match(name):
        raise ValueError(f"{field_name} contains invalid characters")
    
    # Check for SQL injection
    validate_no_sql_injection(name, field_name)
    
    return name.strip()


def validate_alphanumeric(value: str, field_name: str = "Field") -> str:
    """Validate alphanumeric input with limited special characters."""
    if not value:
        return value
    
    # Allow alphanumeric, spaces, and basic punctuation
    pattern = re.compile(r'^[a-zA-Z0-9\s\-_\.]+$')
    if not pattern.match(value):
        raise ValueError(f"{field_name} contains invalid characters")
    
    # Check for SQL injection
    validate_no_sql_injection(value, field_name)
    
    return value


def validate_numeric_id(value: Any) -> int:
    """Validate numeric ID."""
    try:
        id_val = int(value)
        if id_val <= 0:
            raise ValueError("ID must be positive")
        return id_val
    except (ValueError, TypeError):
        raise ValueError("Invalid ID format")


def validate_decimal_amount(value: Any, min_value: float = 0.0) -> float:
    """Validate decimal amounts (prices, quantities, etc)."""
    try:
        amount = float(value)
        if amount < min_value:
            raise ValueError(f"Amount must be at least {min_value}")
        # Limit to 2 decimal places for money
        return round(amount, 2)
    except (ValueError, TypeError):
        raise ValueError("Invalid amount format")


# Pydantic field validators for common use cases
class SearchValidator:
    @validator('search', 'query', 'q', pre=True, always=True)
    def validate_search(cls, v):
        return validate_search_input(v)


class UUIDValidator:
    @validator('id', 'user_id', 'restaurant_id', 'order_id', 'customer_id', pre=True)
    def validate_uuid(cls, v):
        if v:
            return validate_uuid_format(v)
        return v


class EmailValidator:
    @validator('email', pre=True)
    def validate_email(cls, v):
        if v:
            return validate_email_format(v)
        return v


class PhoneValidator:
    @validator('phone', 'phone_number', pre=True)
    def validate_phone(cls, v):
        if v:
            return validate_phone_format(v)
        return v


class NameValidator:
    @validator('first_name', pre=True)
    def validate_first_name(cls, v):
        if v:
            return validate_name_field(v, "First name")
        return v
    
    @validator('last_name', pre=True)
    def validate_last_name(cls, v):
        if v:
            return validate_name_field(v, "Last name")
        return v