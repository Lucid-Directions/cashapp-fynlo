"""Security utilities for password hashing and input sanitization."""

import html
import re
from typing import Any, Dict, List, Optional

import bleach
from fastapi import HTTPException
from passlib.context import CryptContext

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# SQL keywords that should be blocked in user input
SQL_KEYWORDS = [
    "UNION",
    "SELECT",
    "DROP",
    "INSERT",
    "UPDATE",
    "DELETE",
    "EXEC",
    "EXECUTE",
    "CAST",
    "CONVERT",
    "WAITFOR",
    "SLEEP",
    "BENCHMARK",
    "DECLARE",
    "CREATE",
    "ALTER",
    "TRUNCATE",
    "REPLACE",
    "MERGE",
]

# SQL comment sequences
SQL_COMMENT_PATTERNS = [r"--", r"/\*", r"\*/", r"#", r";\s*--", r";\s*/\*"]

# Dangerous characters for various injection attacks
DANGEROUS_CHARS_PATTERN = re.compile(r'[<>"\';()&+`|\\*=$\x00-\x1f\x7f]')

# Hex encoding patterns
HEX_ENCODING_PATTERN = re.compile(r"(0x[0-9a-fA-F]+|\\\x[0-9a-fA-F]{2})")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def sanitize_string(
    text: str,
    max_length: int = 1000,
    allow_html: bool = False,
    strict: bool = False,
) -> str:
    """
    Enhanced string sanitization to prevent SQL injection and XSS attacks.

    Args:
        text: Input text to sanitize
        max_length: Maximum allowed length
        allow_html: Whether to allow safe HTML tags
        strict: Apply strict filtering (blocks more patterns)

    Returns:
        Sanitized string
    """
    if not text:
        return ""

    # Truncate to max length first
    text = text[:max_length]

    # Remove null bytes and control characters
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = "".join(char for char in text if ord(char) >= 32 or char in "\t\n")

    # HTML escape or clean based on settings
    if allow_html:
        # Use bleach for safe HTML
        allowed_tags = ["b", "i", "u", "strong", "em", "p", "br"]
        text = bleach.clean(text, tags=allowed_tags, strip=True)
    else:
        # Escape all HTML
        text = html.escape(text)

    # Remove SQL comment sequences
    for pattern in SQL_COMMENT_PATTERNS:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)

    # Remove hex encoding attempts
    text = HEX_ENCODING_PATTERN.sub("", text)

    if strict:
        # Remove SQL keywords in strict mode
        for keyword in SQL_KEYWORDS:
            # Use word boundaries to avoid breaking normal words
            text = re.sub(rf"\b{keyword}\b", "", text, flags=re.IGNORECASE)

        # Remove all potentially dangerous characters
        text = DANGEROUS_CHARS_PATTERN.sub("", text)
    else:
        # Basic character filtering for non-strict mode
        # Keep some punctuation for normal text
        text = re.sub(r'[<>"`\'\\]', "", text)

    # Clean up multiple spaces
    text = " ".join(text.split())

    return text.strip()


def sanitize_dict(
    data: Dict[str, Any],
    fields_to_sanitize: Optional[List[str]] = None,
    max_length: int = 1000,
    strict: bool = False,
) -> Dict[str, Any]:
    """
    Sanitize string fields in a dictionary.

    Args:
        data: Dictionary to sanitize
        fields_to_sanitize: Specific fields to sanitize
            (None = all string fields)
        max_length: Maximum length for string fields
        strict: Apply strict filtering

    Returns:
        Dictionary with sanitized values
    """
    sanitized = {}

    for key, value in data.items():
        if fields_to_sanitize and key not in fields_to_sanitize:
            sanitized[key] = value
            continue

        if isinstance(value, str):
            sanitized[key] = sanitize_string(value, max_length, strict=strict)
        elif isinstance(value, dict):
            sanitized[key] = sanitize_dict(
                value, fields_to_sanitize, max_length, strict
            )
        elif isinstance(value, list):
            sanitized[key] = [
                (
                    sanitize_string(item, max_length, strict=strict)
                    if isinstance(item, str)
                    else item
                )
                for item in value
            ]
        else:
            sanitized[key] = value

    return sanitized


def validate_sql_safe(text: str, field_name: str = "input") -> str:
    """
    Validate that text is safe from SQL injection.

    Raises exception if dangerous patterns detected.

    Args:
        text: Text to validate
        field_name: Name of field for error messages

    Returns:
        Original text if safe

    Raises:
        HTTPException: If dangerous patterns detected
    """
    if not text:
        return text

    # Check for SQL comment sequences
    for pattern in SQL_COMMENT_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            raise HTTPException(
                status_code=400, detail=f"Invalid characters in {field_name}"
            )

    # Check for common SQL injection patterns
    dangerous_patterns = [
        r"('\s*OR\s*'1'\s*=\s*'1)",  # ' OR '1'='1
        r"(;\s*(DROP|DELETE|UPDATE|INSERT))",  # ; DROP/DELETE/etc
        r"(UNION\s+SELECT)",  # UNION SELECT
        r"(INTO\s+OUTFILE)",  # INTO OUTFILE
        r"(LOAD_FILE\s*\()",  # LOAD_FILE(
    ]

    for pattern in dangerous_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            raise HTTPException(
                status_code=400, detail=f"Invalid input in {field_name}"
            )

    return text


def sanitize_filename(filename: str, max_length: int = 255) -> str:
    """
    Sanitize filename to prevent directory traversal and other attacks.

    Args:
        filename: Original filename
        max_length: Maximum allowed length

    Returns:
        Sanitized filename
    """
    if not filename:
        return "unnamed"

    # Remove path components
    filename = filename.replace("..", "").replace("/", "").replace("\\", "")

    # Remove dangerous characters
    filename = re.sub(r'[<>:"|?*\x00-\x1f]', "", filename)

    # Limit length
    if len(filename) > max_length:
        if "." in filename:
            name, ext = filename.rsplit(".", 1)
        else:
            name, ext = filename, ""
        if ext:
            name = name[: max_length - len(ext) - 1]
            filename = f"{name}.{ext}"
        else:
            filename = filename[:max_length]

    return filename or "unnamed"
