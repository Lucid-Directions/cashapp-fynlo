"""
Enhanced Validation System for Fynlo POS
Provides comprehensive business logic validation with iOS-friendly error messages
"""

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