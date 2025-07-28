"""Enhanced context-aware input validation system.

Provides comprehensive validation with context-specific rules for different
types of input data, including protection against various injection attacks.
"""

import re
from decimal import Decimal
from typing import Any, Dict, List, Optional, Type, Union

from pydantic import BaseModel, Field, validator

from app.core.exceptions import FynloException
from app.core.security import sanitize_string as basic_sanitize


class ValidationContext:
    """Context for validation rules."""

    def __init__(
        self,
        field_type: str,
        data_type: Type,
        max_length: Optional[int] = None,
        min_length: Optional[int] = None,
        pattern: Optional[str] = None,
        allowed_values: Optional[List[Any]] = None,
        custom_rules: Optional[Dict[str, Any]] = None,
    ):
        """Initialize validation context."""
        self.field_type = field_type
        self.data_type = data_type
        self.max_length = max_length
        self.min_length = min_length
        self.pattern = pattern
        self.allowed_values = allowed_values
        self.custom_rules = custom_rules or {}


class ContextAwareValidator:
    """Context-aware validation system."""

    # Field type definitions with validation rules
    FIELD_CONTEXTS = {
        # User input fields
        "email": ValidationContext(
            field_type="email",
            data_type=str,
            max_length=255,
            pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
        ),
        "password": ValidationContext(
            field_type="password",
            data_type=str,
            min_length=8,
            max_length=128,
            pattern=(
                r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])"
                r"[A-Za-z\d@$!%*?&]{8,}$"
            ),
        ),
        "username": ValidationContext(
            field_type="username",
            data_type=str,
            min_length=3,
            max_length=50,
            pattern=r"^[a-zA-Z0-9_-]+$",
        ),
        "phone": ValidationContext(
            field_type="phone",
            data_type=str,
            max_length=20,
            pattern=r"^(\+44|0)[1-9]\d{8,9}$",  # UK format
        ),
        # Business fields
        "restaurant_name": ValidationContext(
            field_type="business_name",
            data_type=str,
            max_length=255,
            pattern=r"^[a-zA-Z0-9\s\-\'\&\.]+$",
        ),
        "product_name": ValidationContext(
            field_type="product_name",
            data_type=str,
            max_length=200,
            pattern=r"^[a-zA-Z0-9\s\-\'\(\)\&\,\.]+$",
        ),
        "description": ValidationContext(
            field_type="description",
            data_type=str,
            max_length=1000,
        ),
        # Financial fields
        "price": ValidationContext(
            field_type="money",
            data_type=Decimal,
            custom_rules={"min": 0, "max": 999999.99, "decimal_places": 2},
        ),
        "quantity": ValidationContext(
            field_type="quantity",
            data_type=int,
            custom_rules={"min": 1, "max": 9999},
        ),
        "percentage": ValidationContext(
            field_type="percentage",
            data_type=float,
            custom_rules={"min": 0, "max": 100},
        ),
        # IDs and references
        "uuid": ValidationContext(
            field_type="uuid",
            data_type=str,
            pattern=(
                r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-"
                r"[0-9a-f]{4}-[0-9a-f]{12}$"
            ),
        ),
        "sku": ValidationContext(
            field_type="sku",
            data_type=str,
            max_length=100,
            pattern=r"^[A-Z0-9\-_]+$",
        ),
        # Address fields
        "postal_code": ValidationContext(
            field_type="postal_code",
            data_type=str,
            pattern=r"^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$",  # UK format
        ),
        "street_address": ValidationContext(
            field_type="address",
            data_type=str,
            max_length=255,
            pattern=r"^[a-zA-Z0-9\s\-\,\.]+$",
        ),
        # Status fields
        "order_status": ValidationContext(
            field_type="enum",
            data_type=str,
            allowed_values=[
                "pending",
                "confirmed",
                "preparing",
                "ready",
                "completed",
                "cancelled",
            ],
        ),
        "payment_method": ValidationContext(
            field_type="enum",
            data_type=str,
            allowed_values=["qr_code", "cash", "card", "apple_pay"],
        ),
    }

    # Unicode attack patterns
    UNICODE_ATTACKS = [
        r"[\u0000-\u001F\u007F-\u009F]",  # Control characters
        r"[\u200B-\u200F\u202A-\u202E\u2060-\u206F]",  # Format control
        r"[\uFEFF]",  # Zero-width no-break space
        r"[\uE000-\uF8FF]",  # Private use area
    ]

    # Advanced SQL injection patterns
    ADVANCED_SQL_PATTERNS = [
        r"(\\x[0-9a-fA-F]{2})+",  # Hex encoding
        r"char\s*\([0-9]+\)",  # CHAR() function
        r"concat\s*\(",  # CONCAT function
        r"(sleep|benchmark|waitfor)\s*\(",  # Time-based attacks
        r"(extractvalue|updatexml)\s*\(",  # XML-based attacks
        r"(load_file|into\s+(out|dump)file)",  # File operations
        r"information_schema",  # Schema probing
        r"(pg_|mysql_|sqlite_)",  # Database-specific functions
    ]

    @classmethod
    def validate_field(
        cls,
        value: Any,
        field_name: str,
        context_type: Optional[str] = None,
        custom_context: Optional[ValidationContext] = None,
    ) -> Any:
        """Validate a field with context-aware rules.

        Args:
            value: Value to validate
            field_name: Name of the field (for error messages)
            context_type: Type of context from FIELD_CONTEXTS
            custom_context: Custom validation context

        Returns:
            Validated and sanitized value

        Raises:
            FynloException: If validation fails
        """
        if custom_context:
            context = custom_context
        elif context_type and context_type in cls.FIELD_CONTEXTS:
            context = cls.FIELD_CONTEXTS[context_type]
        else:
            # Default context for unknown fields
            context = ValidationContext(
                field_type="generic",
                data_type=type(value),
                max_length=1000,
            )

        # Type validation
        if not isinstance(value, context.data_type):
            raise FynloException(
                f"{field_name} must be of type {context.data_type.__name__}",
                status_code=400,
            )

        # String-specific validation
        if context.data_type == str:
            value = cls._validate_string(value, field_name, context)

        # Number-specific validation
        elif context.data_type in [int, float, Decimal]:
            value = cls._validate_number(value, field_name, context)

        # Enum validation
        if context.allowed_values:
            if value not in context.allowed_values:
                raise FynloException(
                    f"{field_name} must be one of: "
                    f"{', '.join(map(str, context.allowed_values))}",
                    status_code=400,
                )

        return value

    @classmethod
    def _validate_string(
        cls, value: str, field_name: str, context: ValidationContext
    ) -> str:
        """Validate string fields with context-specific rules."""
        # Basic sanitization
        value = value.strip()

        # Length validation
        if context.min_length and len(value) < context.min_length:
            raise FynloException(
                f"{field_name} must be at least "
                f"{context.min_length} characters",
                status_code=400,
            )

        if context.max_length and len(value) > context.max_length:
            raise FynloException(
                f"{field_name} must not exceed "
                f"{context.max_length} characters",
                status_code=400,
            )

        # Pattern validation
        if context.pattern:
            if not re.match(context.pattern, value):
                cls._raise_pattern_error(field_name, context.field_type)

        # Unicode attack prevention
        for pattern in cls.UNICODE_ATTACKS:
            if re.search(pattern, value):
                raise FynloException(
                    f"{field_name} contains invalid characters",
                    status_code=400,
                )

        # Advanced SQL injection prevention
        for pattern in cls.ADVANCED_SQL_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                raise FynloException(
                    f"{field_name} contains suspicious patterns",
                    status_code=400,
                )

        # Context-specific sanitization
        if context.field_type in ["email", "username", "sku"]:
            # These should not contain any HTML
            value = basic_sanitize(value, allow_html=False, strict=True)
        elif context.field_type in ["description", "address"]:
            # Allow some formatting but sanitize
            value = basic_sanitize(value, allow_html=False, strict=False)
        else:
            # Default strict sanitization
            value = basic_sanitize(value, allow_html=False, strict=True)

        return value

    @classmethod
    def _validate_number(
        cls,
        value: Union[int, float, Decimal],
        field_name: str,
        context: ValidationContext,
    ) -> Union[int, float, Decimal]:
        """Validate numeric fields with context-specific rules."""
        rules = context.custom_rules or {}

        # Min/max validation
        if "min" in rules and value < rules["min"]:
            raise FynloException(
                f"{field_name} must be at least {rules['min']}",
                status_code=400,
            )

        if "max" in rules and value > rules["max"]:
            raise FynloException(
                f"{field_name} must not exceed {rules['max']}",
                status_code=400,
            )

        # Decimal places validation
        if "decimal_places" in rules and isinstance(value, (float, Decimal)):
            # Convert to string to check decimal places
            str_value = str(value)
            if "." in str_value:
                decimal_part = str_value.split(".")[1]
                if len(decimal_part) > rules["decimal_places"]:
                    raise FynloException(
                        f"{field_name} must have at most "
                        f"{rules['decimal_places']} decimal places",
                        status_code=400,
                    )

        return value

    @classmethod
    def _raise_pattern_error(cls, field_name: str, field_type: str):
        """Raise appropriate error message for pattern validation failure."""
        error_messages = {
            "email": f"{field_name} must be a valid email address",
            "phone": f"{field_name} must be a valid UK phone number",
            "username": (
                f"{field_name} can only contain letters, numbers, "
                "underscores, and hyphens"
            ),
            "uuid": f"{field_name} must be a valid UUID",
            "postal_code": f"{field_name} must be a valid UK postal code",
            "sku": (
                f"{field_name} can only contain uppercase letters, "
                "numbers, hyphens, and underscores"
            ),
        }

        message = error_messages.get(
            field_type, f"{field_name} format is invalid"
        )
        raise FynloException(message, status_code=400)

    @classmethod
    def validate_request_data(
        cls,
        data: Dict[str, Any],
        schema: Dict[str, str],
        partial: bool = False,
    ) -> Dict[str, Any]:
        """Validate entire request payload against a schema.

        Args:
            data: Request data to validate
            schema: Mapping of field names to context types
            partial: Whether to allow missing fields (for PATCH requests)

        Returns:
            Validated and sanitized data
        """
        validated = {}

        for field_name, context_type in schema.items():
            if field_name in data:
                validated[field_name] = cls.validate_field(
                    data[field_name],
                    field_name,
                    context_type,
                )
            elif not partial:
                raise FynloException(
                    f"Missing required field: {field_name}",
                    status_code=400,
                )

        # Check for unexpected fields
        unexpected = set(data.keys()) - set(schema.keys())
        if unexpected:
            raise FynloException(
                f"Unexpected fields: {', '.join(unexpected)}",
                status_code=400,
            )

        return validated


# Pydantic models with enhanced validation
class SecureUserCreate(BaseModel):
    """User creation with enhanced validation."""

    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    phone: Optional[str] = Field(None, max_length=20)

    @validator("email")
    def validate_email(cls, v):
        """Validate email field."""
        return ContextAwareValidator.validate_field(v, "email", "email")

    @validator("password")
    def validate_password(cls, v):
        """Validate password field."""
        return ContextAwareValidator.validate_field(v, "password", "password")

    @validator("first_name", "last_name")
    def validate_names(cls, v, field):
        """Validate name fields."""
        # Names can contain letters, spaces, hyphens, and apostrophes
        context = ValidationContext(
            field_type="name",
            data_type=str,
            max_length=100,
            pattern=r"^[a-zA-Z\s\-\']+$",
        )
        return ContextAwareValidator.validate_field(
            v, field.name, custom_context=context
        )

    @validator("phone")
    def validate_phone(cls, v):
        """Validate phone field."""
        if v:
            return ContextAwareValidator.validate_field(v, "phone", "phone")
        return v


class SecureProductCreate(BaseModel):
    """Product creation with enhanced validation."""

    name: str = Field(..., max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    price: Decimal = Field(..., ge=0, le=999999.99, decimal_places=2)
    sku: str = Field(..., max_length=100)
    category_id: str

    @validator("name")
    def validate_name(cls, v):
        """Validate product name field."""
        return ContextAwareValidator.validate_field(v, "name", "product_name")

    @validator("description")
    def validate_description(cls, v):
        """Validate description field."""
        if v:
            return ContextAwareValidator.validate_field(
                v, "description", "description"
            )
        return v

    @validator("price")
    def validate_price(cls, v):
        """Validate price field."""
        return ContextAwareValidator.validate_field(v, "price", "price")

    @validator("sku")
    def validate_sku(cls, v):
        """Validate SKU field."""
        return ContextAwareValidator.validate_field(v, "sku", "sku")

    @validator("category_id")
    def validate_category_id(cls, v):
        """Validate category ID field."""
        return ContextAwareValidator.validate_field(v, "category_id", "uuid")
