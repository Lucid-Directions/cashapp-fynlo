"""
Enhanced Validation System for Fynlo POS
Provides comprehensive business logic validation with iOS-friendly error messages
"""TODO: Add docstring."""

from typing import List, Dict, Any, Optional, Union
from datetime import datetime, time
from decimal import Decimal
import re
from pydantic import BaseModel

from app.core.exceptions import FynloException, ErrorCodes

class ValidationError(BaseModel):
    """Individual validation error"""
    field: str
    message: str
    code: str
    value: Any = None

class ValidationResult(BaseModel):
    """Validation result with multiple errors"""
    is_valid: bool
    errors: List[ValidationError] = []
    
    def add_error(self, field: str, message: str, code: str, value: Any = None):
        """Add a validation error"""
        self.errors.append(ValidationError(
            field=field,
            message=message,
            code=code,
            value=value
        ))
        self.is_valid = False

class BusinessValidator:
    """Business logic validation for Fynlo POS operations"""
    
    @staticmethod
    def validate_order_creation(order_data: dict, products: List[dict]) -> ValidationResult:
        """Validate order creation with comprehensive checks"""
        result = ValidationResult(is_valid=True)
        
        # Validate items exist
        if not order_data.get('items') or len(order_data['items']) == 0:
            result.add_error(
                field="items",
                message="Order must contain at least one item",
                code="EMPTY_ORDER"
            )
        
        # Validate product availability and quantities
        product_map = {str(p['id']): p for p in products}
        
        for i, item in enumerate(order_data.get('items', [])):
            item_field = f"items[{i}]"
            
            # Check product exists
            product_id = str(item.get('product_id', ''))
            if product_id not in product_map:
                result.add_error(
                    field=f"{item_field}.product_id",
                    message=f"Product {product_id} not found or unavailable",
                    code="PRODUCT_NOT_FOUND",
                    value=product_id
                )
                continue
            
            product = product_map[product_id]
            
            # Check quantity is valid
            quantity = item.get('quantity', 0)
            if not isinstance(quantity, int) or quantity <= 0:
                result.add_error(
                    field=f"{item_field}.quantity",
                    message="Quantity must be a positive integer",
                    code="INVALID_QUANTITY",
                    value=quantity
                )
            
            # Check stock if tracking enabled
            if product.get('stock_tracking', False):
                available_stock = product.get('stock_quantity', 0)
                if quantity > available_stock:
                    result.add_error(
                        field=f"{item_field}.quantity",
                        message=f"Insufficient stock. Available: {available_stock}, Requested: {quantity}",
                        code="INSUFFICIENT_STOCK",
                        value={"requested": quantity, "available": available_stock}
                    )
            
            # Validate price consistency
            expected_price = float(product.get('price', 0))
            item_price = float(item.get('unit_price', 0))
            if abs(expected_price - item_price) > 0.01:  # Allow 1 cent tolerance
                result.add_error(
                    field=f"{item_field}.unit_price",
                    message=f"Price mismatch. Expected: £{expected_price:.2f}, Provided: £{item_price:.2f}",
                    code="PRICE_MISMATCH",
                    value={"expected": expected_price, "provided": item_price}
                )
        
        # Validate order type
        valid_order_types = ["dine_in", "takeaway", "delivery"]
        order_type = order_data.get('order_type', '')
        if order_type not in valid_order_types:
            result.add_error(
                field="order_type",
                message=f"Invalid order type. Must be one of: {', '.join(valid_order_types)}",
                code="INVALID_ORDER_TYPE",
                value=order_type
            )
        
        # Validate table number for dine-in orders
        if order_type == "dine_in":
            table_number = order_data.get('table_number')
            if not table_number or not str(table_number).strip():
                result.add_error(
                    field="table_number",
                    message="Table number is required for dine-in orders",
                    code="MISSING_TABLE_NUMBER"
                )
        
        return result
    
    @staticmethod
    def validate_order_status_transition(current_status: str, new_status: str) -> ValidationResult:
        """Validate order status transitions"""
        result = ValidationResult(is_valid=True)
        
        # Define valid status transitions
        valid_transitions = {
            "pending": ["confirmed", "cancelled"],
            "confirmed": ["preparing", "cancelled"],
            "preparing": ["ready", "cancelled"],
            "ready": ["completed", "cancelled"],
            "completed": [],  # Final state
            "cancelled": []   # Final state
        }
        
        valid_statuses = list(valid_transitions.keys())
        
        # Check if statuses are valid
        if current_status not in valid_statuses:
            result.add_error(
                field="current_status",
                message=f"Invalid current status: {current_status}",
                code="INVALID_STATUS",
                value=current_status
            )
        
        if new_status not in valid_statuses:
            result.add_error(
                field="new_status",
                message=f"Invalid new status: {new_status}",
                code="INVALID_STATUS",
                value=new_status
            )
        
        # Check if transition is allowed
        if result.is_valid and new_status not in valid_transitions[current_status]:
            result.add_error(
                field="status_transition",
                message=f"Cannot transition from '{current_status}' to '{new_status}'. Valid transitions: {', '.join(valid_transitions[current_status]) or 'None (final state)'}",
                code="INVALID_STATUS_TRANSITION",
                value={"from": current_status, "to": new_status}
            )
        
        return result
    
    @staticmethod
    def validate_payment_amount(order_total: float, payment_amount: float, payment_method: str) -> ValidationResult:
        """Validate payment amounts and methods"""
        result = ValidationResult(is_valid=True)
        
        # Check amount is positive
        if payment_amount <= 0:
            result.add_error(
                field="amount",
                message="Payment amount must be positive",
                code="INVALID_AMOUNT",
                value=payment_amount
            )
        
        # Check amount matches order total (allow small tolerance for floating point)
        tolerance = 0.01
        if abs(payment_amount - order_total) > tolerance:
            result.add_error(
                field="amount",
                message=f"Payment amount (£{payment_amount:.2f}) does not match order total (£{order_total:.2f})",
                code="AMOUNT_MISMATCH",
                value={"payment": payment_amount, "order_total": order_total}
            )
        
        # Validate payment method
        valid_methods = ["qr_code", "stripe", "apple_pay", "cash"]
        if payment_method not in valid_methods:
            result.add_error(
                field="payment_method",
                message=f"Invalid payment method. Must be one of: {', '.join(valid_methods)}",
                code="INVALID_PAYMENT_METHOD",
                value=payment_method
            )
        
        return result
    
    @staticmethod
    def validate_business_hours(operation_time: datetime, business_hours: dict) -> ValidationResult:
        """Validate operation against business hours"""
        result = ValidationResult(is_valid=True)
        
        if not business_hours:
            # No restrictions if business hours not configured
            return result
        
        day_name = operation_time.strftime('%A').lower()  # monday, tuesday, etc.
        day_hours = business_hours.get(day_name)
        
        if not day_hours:
            result.add_error(
                field="operation_time",
                message=f"Restaurant is closed on {day_name.title()}",
                code="CLOSED_DAY",
                value=day_name
            )
            return result
        
        # Check if within operating hours
        current_time = operation_time.time()
        open_time = time.fromisoformat(day_hours.get('open', '00:00'))
        close_time = time.fromisoformat(day_hours.get('close', '23:59'))
        
        if not (open_time <= current_time <= close_time):
            result.add_error(
                field="operation_time",
                message=f"Restaurant is closed. Operating hours: {open_time.strftime('%H:%M')} - {close_time.strftime('%H:%M')}",
                code="OUTSIDE_BUSINESS_HOURS",
                value={
                    "current": current_time.strftime('%H:%M'),
                    "open": open_time.strftime('%H:%M'),
                    "close": close_time.strftime('%H:%M')
                }
            )
        
        return result
    
    @staticmethod
    def validate_customer_data(customer_data: dict) -> ValidationResult:
        """Validate customer information"""
        result = ValidationResult(is_valid=True)
        
        # Validate required fields
        if not customer_data.get('first_name', '').strip():
            result.add_error(
                field="first_name",
                message="First name is required",
                code="MISSING_REQUIRED_FIELD"
            )
        
        if not customer_data.get('last_name', '').strip():
            result.add_error(
                field="last_name",
                message="Last name is required",
                code="MISSING_REQUIRED_FIELD"
            )
        
        # Validate email format if provided
        email = customer_data.get('email', '').strip()
        if email:
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, email):
                result.add_error(
                    field="email",
                    message="Invalid email format",
                    code="INVALID_EMAIL_FORMAT",
                    value=email
                )
        
        # Validate phone format if provided (UK format)
        phone = customer_data.get('phone', '').strip()
        if phone:
            # Remove common separators
            clean_phone = re.sub(r'[\s\-\(\)]', '', phone)
            uk_phone_pattern = r'^(\+44|0)[1-9]\d{8,9}$'
            if not re.match(uk_phone_pattern, clean_phone):
                result.add_error(
                    field="phone",
                    message="Invalid UK phone number format",
                    code="INVALID_PHONE_FORMAT",
                    value=phone
                )
        
        # At least one contact method required
        if not email and not phone:
            result.add_error(
                field="contact",
                message="Either email or phone number is required",
                code="MISSING_CONTACT_INFO"
            )
        
        return result
    
    @staticmethod
    def validate_image_upload(file_data: dict) -> ValidationResult:
        """Validate image upload data"""
        result = ValidationResult(is_valid=True)
        
        # Check file size (already validated in file_upload.py, but double-check)
        max_size = 10 * 1024 * 1024  # 10MB
        file_size = file_data.get('size', 0)
        
        if file_size > max_size:
            result.add_error(
                field="file_size",
                message=f"File too large. Maximum size: {max_size // (1024*1024)}MB",
                code="FILE_TOO_LARGE",
                value={"size": file_size, "max_size": max_size}
            )
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        file_type = file_data.get('mime_type', '')
        
        if file_type not in allowed_types:
            result.add_error(
                field="file_type",
                message=f"Unsupported file type. Allowed: {', '.join(allowed_types)}",
                code="UNSUPPORTED_FILE_TYPE",
                value=file_type
            )
        
        return result

def raise_validation_exception(validation_result: ValidationResult, message: str = "Validation failed"):
    """Convert validation result to FynloException"""
    if not validation_result.is_valid:
        error_details = {
            "validation_errors": [error.dict() for error in validation_result.errors],
            "error_count": len(validation_result.errors)
        }
        
        # Create user-friendly message
        if len(validation_result.errors) == 1:
            user_message = validation_result.errors[0].message
        else:
            user_message = f"{message} ({len(validation_result.errors)} errors found)"
        
        raise FynloException(
            message=user_message,
            error_code=ErrorCodes.VALIDATION_ERROR,
            details=error_details,
            status_code=400
        )

# Convenience functions for common validations
def validate_order_or_raise(order_data: dict, products: List[dict]):
    """Validate order creation and raise exception if invalid"""
    result = BusinessValidator.validate_order_creation(order_data, products)
    if not result.is_valid:
        raise_validation_exception(result, "Order validation failed")

def validate_status_transition_or_raise(current_status: str, new_status: str):
    """Validate status transition and raise exception if invalid"""
    result = BusinessValidator.validate_order_status_transition(current_status, new_status)
    if not result.is_valid:
        raise_validation_exception(result, "Invalid status transition")

def validate_payment_or_raise(order_total: float, payment_amount: float, payment_method: str):
    """Validate payment and raise exception if invalid"""
    result = BusinessValidator.validate_payment_amount(order_total, payment_amount, payment_method)
    if not result.is_valid:
        raise_validation_exception(result, "Payment validation failed")

def validate_customer_or_raise(customer_data: dict):
    """Validate customer data and raise exception if invalid"""
    result = BusinessValidator.validate_customer_data(customer_data)
    if not result.is_valid:
        raise_validation_exception(result, "Customer validation failed")

"""
Input validation schemas and helpers for Fynlo POS
Provides JSON schema validation for all JSONB fields in database models
"""TODO: Add docstring."""

import re
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, validator, ValidationError
from jsonschema import validate, ValidationError as JSONSchemaError


class AddressSchema(BaseModel):
    """Validation schema for restaurant address"""
    street: str
    city: str
    state: str
    postal_code: str
    country: str = "GB"
    
    @validator('postal_code')
    def validate_postal_code(cls, v):
        """Validate UK postal code format"""
        if not re.match(r'^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$', v.upper()):
            raise ValueError('Invalid UK postal code format')
        return v.upper()


class BusinessHoursSchema(BaseModel):
    """Validation schema for business hours"""
    monday: Optional[Dict[str, str]] = None
    tuesday: Optional[Dict[str, str]] = None
    wednesday: Optional[Dict[str, str]] = None
    thursday: Optional[Dict[str, str]] = None
    friday: Optional[Dict[str, str]] = None
    saturday: Optional[Dict[str, str]] = None
    sunday: Optional[Dict[str, str]] = None
    
    @validator('*', pre=True)
    def validate_day_hours(cls, v):
        """Validate day hours format"""
        if v is None:
            return None
        if not isinstance(v, dict):
            raise ValueError('Day hours must be a dictionary')
        if 'open' not in v or 'close' not in v:
            raise ValueError('Day hours must have "open" and "close" times')
        
        # Validate time format (HH:MM)
        time_pattern = r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
        if not re.match(time_pattern, v['open']) or not re.match(time_pattern, v['close']):
            raise ValueError('Time must be in HH:MM format')
        
        return v


class TaxConfigurationSchema(BaseModel):
    """Validation schema for tax configuration"""
    vatEnabled: bool
    vatRate: float
    serviceTaxEnabled: bool
    serviceTaxRate: float
    
    @validator('vatRate', 'serviceTaxRate')
    def validate_tax_rates(cls, v):
        """Validate tax rates are reasonable"""
        if v < 0 or v > 100:
            raise ValueError('Tax rate must be between 0 and 100')
        return v


class PaymentMethodSchema(BaseModel):
    """Validation schema for individual payment method"""
    enabled: bool
    feePercentage: Optional[float] = 0.0
    requiresAuth: Optional[bool] = False
    
    @validator('feePercentage')
    def validate_fee_percentage(cls, v):
        """Validate fee percentage is reasonable"""
        if v is not None and (v < 0 or v > 10):
            raise ValueError('Fee percentage must be between 0 and 10')
        return v


class PaymentMethodsSchema(BaseModel):
    """Validation schema for payment methods configuration"""
    qrCode: Optional[PaymentMethodSchema] = None
    cash: Optional[PaymentMethodSchema] = None
    card: Optional[PaymentMethodSchema] = None
    applePay: Optional[PaymentMethodSchema] = None
    giftCard: Optional[PaymentMethodSchema] = None


class RestaurantSettingsSchema(BaseModel):
    """Validation schema for restaurant settings"""
    currency: str = "GBP"
    autoAcceptOrders: bool = True
    orderTimeout: int = 30  # minutes
    requireTableNumber: bool = True
    enableLoyaltyProgram: bool = True
    loyaltyPointsPerPound: float = 1.0
    
    @validator('currency')
    def validate_currency(cls, v):
        """Validate currency code"""
        valid_currencies = ['GBP', 'EUR', 'USD']
        if v not in valid_currencies:
            raise ValueError(f'Currency must be one of: {valid_currencies}')
        return v
    
    @validator('orderTimeout')
    def validate_order_timeout(cls, v):
        """Validate order timeout is reasonable"""
        if v < 5 or v > 120:
            raise ValueError('Order timeout must be between 5 and 120 minutes')
        return v


class UserPermissionsSchema(BaseModel):
    """Validation schema for user permissions"""
    canManageUsers: bool = False
    canManageMenu: bool = False
    canViewReports: bool = False
    canProcessPayments: bool = False
    canManageOrders: bool = False
    canAccessPOS: bool = False
    canManageSettings: bool = False


class CustomerPreferencesSchema(BaseModel):
    """Validation schema for customer preferences"""
    dietaryRestrictions: Optional[List[str]] = []
    favoriteItems: Optional[List[str]] = []
    preferredTable: Optional[str] = None
    communicationPreferences: Optional[Dict[str, bool]] = {}
    
    @validator('dietaryRestrictions')
    def validate_dietary_restrictions(cls, v):
        """Validate dietary restrictions"""
        valid_restrictions = [
            'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 
            'nut-free', 'halal', 'kosher', 'low-sodium'
        ]
        if v:
            for restriction in v:
                if restriction not in valid_restrictions:
                    raise ValueError(f'Invalid dietary restriction: {restriction}')
        return v


class ProductModifierSchema(BaseModel):
    """Validation schema for product modifiers"""
    name: str
    type: str  # 'single', 'multiple', 'quantity'
    required: bool = False
    options: List[Dict[str, Union[str, float]]]
    
    @validator('type')
    def validate_modifier_type(cls, v):
        """Validate modifier type"""
        valid_types = ['single', 'multiple', 'quantity']
        if v not in valid_types:
            raise ValueError(f'Modifier type must be one of: {valid_types}')
        return v
    
    @validator('options')
    def validate_options(cls, v):
        """Validate modifier options"""
        for option in v:
            if 'name' not in option or 'price' not in option:
                raise ValueError('Each option must have "name" and "price"')
            if not isinstance(option['price'], (int, float)):
                raise ValueError('Option price must be a number')
        return v


class OrderItemSchema(BaseModel):
    """Validation schema for order items"""
    productId: str
    name: str
    price: float
    quantity: int
    modifiers: Optional[List[Dict[str, Any]]] = []
    specialInstructions: Optional[str] = None
    
    @validator('price')
    def validate_price(cls, v):
        """Validate price is positive"""
        if v < 0:
            raise ValueError('Price must be positive')
        return v
    
    @validator('quantity')
    def validate_quantity(cls, v):
        """Validate quantity is positive"""
        if v <= 0:
            raise ValueError('Quantity must be positive')
        return v


class PaymentMetadataSchema(BaseModel):
    """Validation schema for payment metadata"""
    stripePaymentId: Optional[str] = None
    cashReceived: Optional[float] = None
    changeGiven: Optional[float] = None
    cardLast4: Optional[str] = None
    approvalCode: Optional[str] = None
    
    @validator('cardLast4')
    def validate_card_last4(cls, v):
        """Validate card last 4 digits"""
        if v is not None and not re.match(r'^\d{4}$', v):
            raise ValueError('Card last 4 must be 4 digits')
        return v


# Validation helper functions
def validate_jsonb_field(data: Any, schema_class: BaseModel) -> Dict[str, Any]:
    """
    Validate JSONB field data against a schema
    
    Args:
        data: The data to validate
        schema_class: The Pydantic schema class
        
    Returns:
        Validated and cleaned data
        
    Raises:
        ValidationError: If validation fails
    """
    try:
        validated = schema_class.parse_obj(data)
        return validated.dict()
    except ValidationError as e:
        raise ValidationError(f"JSONB validation failed: {e}")


def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_phone(phone: str) -> bool:
    """Validate UK phone number format"""
    # UK phone number patterns
    patterns = [
        r'^(\+44|0)[1-9]\d{8,9}$',  # Standard UK numbers
        r'^(\+44|0)7\d{9}$',        # Mobile numbers
    ]
    return any(re.match(pattern, phone.replace(' ', '').replace('-', '')) for pattern in patterns)


def validate_file_size(file_size: int, max_size_mb: int = 5) -> bool:
    """Validate file size"""
    max_size_bytes = max_size_mb * 1024 * 1024
    return file_size <= max_size_bytes


def validate_image_format(filename: str) -> bool:
    """Validate image file format"""
    valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    return any(filename.lower().endswith(ext) for ext in valid_extensions)


def sanitize_string(text: str, max_length: int = 255) -> str:
    """Sanitize string input"""
    if not text:
        return ""
    
    # Remove potentially dangerous characters - comprehensive list
    # Includes: HTML/XML tags, quotes, parentheses, semicolons, ampersands, 
    # plus signs, backticks, pipes, backslashes, asterisks, equals, dollar signs
    cleaned = re.sub(r'[<>"\';()&+`|\\*=$]', '', text)
    
    # Remove SQL keywords (case insensitive)
    sql_keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 
                    'ALTER', 'EXEC', 'EXECUTE', 'UNION', 'FROM', 'WHERE',
                    'JOIN', 'SCRIPT', 'JAVASCRIPT', 'VBSCRIPT']
    for keyword in sql_keywords:
        cleaned = re.sub(rf'\b{keyword}\b', '', cleaned, flags=re.IGNORECASE)
    
    # Trim whitespace and limit length
    cleaned = cleaned.strip()[:max_length]
    
    return cleaned


# Schema mapping for database fields
VALIDATION_SCHEMAS = {
    'restaurant.address': AddressSchema,
    'restaurant.business_hours': BusinessHoursSchema,
    'restaurant.settings': RestaurantSettingsSchema,
    'restaurant.tax_configuration': TaxConfigurationSchema,
    'restaurant.payment_methods': PaymentMethodsSchema,
    'user.permissions': UserPermissionsSchema,
    'customer.preferences': CustomerPreferencesSchema,
    'product.dietary_info': lambda x: x if isinstance(x, list) else [],
    'product.modifiers': lambda x: [ProductModifierSchema.parse_obj(m).dict() for m in x] if x else [],
    'order.items': lambda x: [OrderItemSchema.parse_obj(item).dict() for item in x] if x else [],
    'payment.payment_metadata': PaymentMetadataSchema,
}


def validate_model_jsonb_fields(model_name: str, field_name: str, data: Any) -> Any:
    """
    Validate JSONB field for a specific model
    
    Args:
        model_name: Name of the database model (e.g., 'restaurant')
        field_name: Name of the JSONB field (e.g., 'address')
        data: Data to validate
        
    Returns:
        Validated data
    """
    schema_key = f"{model_name}.{field_name}"
    
    if schema_key in VALIDATION_SCHEMAS:
        schema = VALIDATION_SCHEMAS[schema_key]
        
        if callable(schema) and not issubclass(schema, BaseModel):
            # Custom validation function
            return schema(data)
        else:
            # Pydantic schema class
            return validate_jsonb_field(data, schema)
    
    # No specific validation, return as-is
    return data