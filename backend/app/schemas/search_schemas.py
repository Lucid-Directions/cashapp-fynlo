"""Enhanced search and filter schemas with security validation."""
from typing import Optional, List, ClassVar
from pydantic import BaseModel, Field, validator
from datetime import datetime

from app.core.validators import (
    validate_search_input,
    validate_sort_field,
    validate_uuid_format,
    validate_alphanumeric,
    validate_no_sql_injection
)


class BaseSearchRequest(BaseModel):
    """Base search request with common fields."""
    search: Optional[str] = Field(None, max_length=100)
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    sort_by: Optional[str] = None
    sort_order: Optional[str] = Field("asc", pattern="^(asc|desc)$")
    
    @validator('search', pre=True)
    def validate_search_query(cls, v):
        """Validate search input"""
        if v:
            return validate_search_input(v)
        return v
    
    @validator('sort_by')
    def validate_sort_field(cls, v):
        """Validate sort field"""
        if v:
            # Add validation logic here if needed
            return v
        return v


class CustomerSearchRequest(BaseSearchRequest):
    """Customer search with enhanced validation."""
    email: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    name: Optional[str] = Field(None, max_length=100)
    min_spent: Optional[float] = Field(None, ge=0)
    restaurant_id: Optional[str] = None
    
    ALLOWED_SORT_FIELDS: ClassVar[List[str]] = ['created_at', 'updated_at', 'total_spent', 'order_count', 
        'first_name', 'last_name', 'email']
    
    @validator('email', 'phone', 'name', pre=True)
        if v:
            return validate_search_input(v)
        return v
    
    @validator('restaurant_id')
        if v:
            return validate_uuid_format(v)
        return v
    
    @validator('sort_by')
        if v:
            return validate_sort_field(v, cls.ALLOWED_SORT_FIELDS)
        return v


class UserSearchRequest(BaseSearchRequest):
    """User search with enhanced validation."""
    email: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field(None, pattern="^(platform_owner|restaurant_owner|manager|employee)$")
    restaurant_id: Optional[str] = None
    is_active: Optional[bool] = None
    
    ALLOWED_SORT_FIELDS: ClassVar[List[str]] = ['created_at', 'updated_at', 'email', 'first_name', 'last_name']
    
    @validator('email', pre=True)
        if v:
            return validate_search_input(v)
        return v
    
    @validator('restaurant_id')
        if v:
            return validate_uuid_format(v)
        return v
    
    @validator('sort_by')
        if v:
            return validate_sort_field(v, cls.ALLOWED_SORT_FIELDS)
        return v


class RestaurantSearchRequest(BaseSearchRequest):
    """Restaurant search with enhanced validation."""
    name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    subscription_plan: Optional[str] = Field(None, pattern="^(alpha|beta|omega)$")
    is_active: Optional[bool] = None
    
    ALLOWED_SORT_FIELDS: ClassVar[List[str]] = ['created_at', 'updated_at', 'name', 'subscription_plan']
    
    @validator('name', 'email', 'phone', pre=True)
        if v:
            return validate_search_input(v)
        return v
    
    @validator('sort_by')
        if v:
            return validate_sort_field(v, cls.ALLOWED_SORT_FIELDS)
        return v


class OrderSearchRequest(BaseSearchRequest):
    """Order search with enhanced validation."""
    status: Optional[str] = Field(None, pattern="^(pending|processing|completed|cancelled)$")
    payment_method: Optional[str] = Field(None, pattern="^(cash|card|qr|apple_pay)$")
    customer_id: Optional[str] = None
    restaurant_id: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    min_amount: Optional[float] = Field(None, ge=0)
    max_amount: Optional[float] = Field(None, ge=0)
    
    ALLOWED_SORT_FIELDS: ClassVar[List[str]] = ['created_at', 'updated_at', 'total_amount', 'status', 'payment_method']
    
    @validator('customer_id', 'restaurant_id')
        if v:
            return validate_uuid_format(v)
        return v
    
    @validator('sort_by')
        if v:
            return validate_sort_field(v, cls.ALLOWED_SORT_FIELDS)
        return v
    
    @validator('max_amount')
        if v and 'min_amount' in values and values['min_amount']:
            if v < values['min_amount']:
                raise ValueError("max_amount must be greater than min_amount")
        return v


class ProductSearchRequest(BaseSearchRequest):
    """Product search with enhanced validation."""
    name: Optional[str] = Field(None, max_length=100)
    category_id: Optional[str] = None
    restaurant_id: Optional[str] = None
    is_available: Optional[bool] = None
    min_price: Optional[float] = Field(None, ge=0)
    max_price: Optional[float] = Field(None, ge=0)
    
    ALLOWED_SORT_FIELDS: ClassVar[List[str]] = ['name', 'price', 'created_at', 'updated_at', 'category_name']
    
    @validator('name', pre=True)
        if v:
            return validate_search_input(v)
        return v
    
    @validator('category_id', 'restaurant_id')
        if v:
            return validate_uuid_format(v)
        return v
    
    @validator('sort_by')
        if v:
            return validate_sort_field(v, cls.ALLOWED_SORT_FIELDS)
        return v
    
    @validator('max_price')
        if v and 'min_price' in values and values['min_price']:
            if v < values['min_price']:
                raise ValueError("max_price must be greater than min_price")
        return v


class BulkOperationRequest(BaseModel):
    """Base model for bulk operations with validation."""
    ids: List[str] = Field(..., min_items=1, max_items=100)
    
    @validator('ids')
        for id_val in v:
            validate_uuid_format(id_val)
        return v


class SafeUpdateRequest(BaseModel):
    """Base model for safe updates with field whitelisting."""
    pass

    class Config:
        extra = 'forbid'  # Reject any extra fields not defined in schema