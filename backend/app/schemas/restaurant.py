"""
Restaurant schemas for Fynlo POS
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, EmailStr


class RestaurantBase(BaseModel):
    """Base restaurant schema"""
    name: str
    address: dict
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    timezone: str = "UTC"
    business_hours: dict = {}
    settings: dict = {}


class RestaurantCreate(RestaurantBase):
    """Schema for creating a restaurant"""
    pass


class RestaurantUpdate(BaseModel):
    """Schema for updating a restaurant"""
    name: Optional[str] = None
    address: Optional[dict] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    timezone: Optional[str] = None
    business_hours: Optional[dict] = None
    settings: Optional[dict] = None
    tax_configuration: Optional[dict] = None
    payment_methods: Optional[dict] = None
    is_active: Optional[bool] = None


class RestaurantResponse(RestaurantBase):
    """Schema for restaurant responses"""
    id: str
    platform_id: Optional[str]
    tax_configuration: dict
    payment_methods: dict
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class RestaurantStats(BaseModel):
    """Restaurant statistics schema"""
    restaurant_id: str
    name: str
    daily_revenue: float
    monthly_revenue: float
    total_orders: int
    active_customers: int
    average_order_value: float
    payment_method_breakdown: dict


class PlatformStats(BaseModel):
    """Platform statistics schema"""
    total_restaurants: int
    active_restaurants: int
    total_revenue: float
    total_orders: int
    total_customers: int
    top_performing_restaurants: List[RestaurantStats]