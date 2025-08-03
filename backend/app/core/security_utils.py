"""Security utilities for input sanitization and validation."""

from typing import Optional
import re


def sanitize_sql_like_pattern(value: Optional[str]) -> Optional[str]:
    """
    Sanitize user input for SQL LIKE queries by escaping special characters.

    SQL LIKE special characters:
    - % (matches any sequence of characters)
    - _ (matches any single character)
    - \ (escape character)

    Args:
        value: The user input string to sanitize

    Returns:
        Sanitized string safe for use in SQL LIKE queries
    """
    if not value:
        return value

    # Escape backslashes first (must be done before other escapes)
    value = value.replace("\\", "\\\\")
    # Escape percentage signs
    value = value.replace("%", "\\%")
    # Escape underscores
    value = value.replace("_", "\\_")

    return value


def sanitize_sql_identifier(identifier: str, allowed_values: list[str]) -> str:
    """
    Sanitize and validate SQL identifiers (table names, column names).

    Args:
        identifier: The identifier to validate
        allowed_values: List of allowed values (whitelist)

    Returns:
        The validated identifier

    Raises:
        ValueError: If identifier is not in the allowed list
    """
    if identifier not in allowed_values:
        raise ValueError(f"Invalid identifier: {identifier}")
    return identifier


def is_valid_uuid(value: str) -> bool:
    """
    Validate if a string is a valid UUID.

    Args:
        value: String to validate

    Returns:
        True if valid UUID, False otherwise
    """
    uuid_pattern = re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
    )
    return bool(uuid_pattern.match(value))


def sanitize_search_term(term: str, max_length: int = 100) -> str:
    """
    Sanitize a general search term.

    Args:
        term: The search term to sanitize
        max_length: Maximum allowed length

    Returns:
        Sanitized search term
    """
    if not term:
        return ""

    # Truncate to max length
    term = term[:max_length]

    # Remove any null bytes
    term = term.replace("\x00", "")

    # Strip leading/trailing whitespace
    term = term.strip()

    return term
