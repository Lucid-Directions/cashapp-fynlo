"""
Subscription schemas for API request/response validation

This module contains Pydantic models for validating subscription-related
API requests and responses.
"""

from pydantic import BaseModel, validator
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal


class SubscriptionPlanBase(BaseModel):
    """Base subscription plan schema"""

    name: str
    display_name: str
    price_monthly: Decimal
    price_yearly: Decimal
    transaction_fee_percentage: Decimal
    max_orders_per_month: Optional[int] = None
    max_staff_accounts: Optional[int] = None
    max_menu_items: Optional[int] = None
    features: Dict[str, Any]
    is_active: bool = True


class SubscriptionPlanResponse(SubscriptionPlanBase):
    """Subscription plan response schema"""

    id: int
    created_at: datetime
    updated_at: datetime

    # Computed fields
    yearly_savings: Optional[Decimal] = None
    yearly_discount_percentage: Optional[float] = None

    class Config:
        from_attributes = True

    @validator("yearly_savings", pre=False, always=True)
    def calculate_yearly_savings(cls, v, values):
        if "price_monthly" in values and "price_yearly" in values:
            monthly_yearly_cost = values["price_monthly"] * 12
            return monthly_yearly_cost - values["price_yearly"]
        return v

    @validator("yearly_discount_percentage", pre=False, always=True)
    def calculate_yearly_discount(cls, v, values):
        if "price_monthly" in values and "price_yearly" in values:
            monthly_yearly_cost = float(values["price_monthly"]) * 12
            if monthly_yearly_cost > 0:
                savings = monthly_yearly_cost - float(values["price_yearly"])
                return (savings / monthly_yearly_cost) * 100
        return v


class RestaurantSubscriptionBase(BaseModel):
    """Base restaurant subscription schema"""

    restaurant_id: int
    plan_id: int
    status: str
    trial_end_date: Optional[datetime] = None
    current_period_start: datetime
    current_period_end: datetime
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None


class SubscriptionCreateRequest(BaseModel):
    """Request schema for creating a subscription"""

    restaurant_id: int
    plan_id: int
    start_trial: bool = True
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None

    @validator("plan_id")
    def validate_plan_id(cls, v):
        if v <= 0:
            raise ValueError("Plan ID must be positive")
        return v

    @validator("restaurant_id")
    def validate_restaurant_id(cls, v):
        if v <= 0:
            raise ValueError("Restaurant ID must be positive")
        return v


class PlanChangeRequest(BaseModel):
    """Request schema for changing subscription plans"""

    restaurant_id: int
    new_plan_id: int
    immediate: bool = True  # Whether to change immediately or at next billing cycle

    @validator("new_plan_id")
    def validate_new_plan_id(cls, v):
        if v <= 0:
            raise ValueError("New plan ID must be positive")
        return v


class RestaurantSubscriptionResponse(RestaurantSubscriptionBase):
    """Restaurant subscription response schema"""

    id: int
    created_at: datetime
    updated_at: datetime

    # Related objects
    plan: Optional[SubscriptionPlanResponse] = None

    # Computed fields
    is_active: Optional[bool] = None
    is_trial: Optional[bool] = None
    is_expired: Optional[bool] = None
    days_until_renewal: Optional[int] = None

    class Config:
        from_attributes = True

    @validator("is_active", pre=False, always=True)
    def compute_is_active(cls, v, values):
        if "status" in values:
            return values["status"] in ["active", "trial"]
        return v

    @validator("is_trial", pre=False, always=True)
    def compute_is_trial(cls, v, values):
        if "status" in values:
            return values["status"] == "trial"
        return v

    @validator("is_expired", pre=False, always=True)
    def compute_is_expired(cls, v, values):
        if "current_period_end" in values:
            return datetime.utcnow() > values["current_period_end"]
        return v

    @validator("days_until_renewal", pre=False, always=True)
    def compute_days_until_renewal(cls, v, values):
        if "current_period_end" in values:
            delta = values["current_period_end"] - datetime.utcnow()
            return max(0, delta.days)
        return v


class SubscriptionUsageBase(BaseModel):
    """Base subscription usage schema"""

    restaurant_id: int
    month_year: str
    orders_count: int = 0
    staff_count: int = 0
    menu_items_count: int = 0


class SubscriptionUsageResponse(SubscriptionUsageBase):
    """Subscription usage response schema"""

    id: int
    created_at: datetime
    updated_at: datetime

    # Additional context
    limits: Optional[Dict[str, Optional[int]]] = None
    plan: Optional[SubscriptionPlanResponse] = None

    # Computed usage percentages
    orders_percentage: Optional[float] = None
    staff_percentage: Optional[float] = None
    menu_items_percentage: Optional[float] = None

    class Config:
        from_attributes = True

    @validator("orders_percentage", pre=False, always=True)
    def compute_orders_percentage(cls, v, values):
        if "limits" in values and values["limits"] and "orders_count" in values:
            limit = values["limits"].get("orders")
            if limit and limit > 0:
                return min(100.0, (values["orders_count"] / limit) * 100)
        return 0.0

    @validator("staff_percentage", pre=False, always=True)
    def compute_staff_percentage(cls, v, values):
        if "limits" in values and values["limits"] and "staff_count" in values:
            limit = values["limits"].get("staff")
            if limit and limit > 0:
                return min(100.0, (values["staff_count"] / limit) * 100)
        return 0.0

    @validator("menu_items_percentage", pre=False, always=True)
    def compute_menu_items_percentage(cls, v, values):
        if "limits" in values and values["limits"] and "menu_items_count" in values:
            limit = values["limits"].get("menu_items")
            if limit and limit > 0:
                return min(100.0, (values["menu_items_count"] / limit) * 100)
        return 0.0


class UsageIncrementRequest(BaseModel):
    """Request schema for incrementing usage"""

    restaurant_id: int
    usage_type: str
    amount: int = 1

    @validator("usage_type")
    def validate_usage_type(cls, v):
        if v not in ["orders", "staff", "menu_items"]:
            raise ValueError("Usage type must be one of: orders, staff, menu_items")
        return v

    @validator("amount")
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


class FeatureCheckRequest(BaseModel):
    """Request schema for checking feature access"""

    restaurant_id: int
    feature_name: str


class FeatureCheckResponse(BaseModel):
    """Response schema for feature access check"""

    has_access: bool
    plan_name: Optional[str] = None
    feature_name: str
    reason: Optional[str] = None  # Why access was denied
    upgrade_required: bool = False
    suggested_plans: Optional[list] = None  # Plans that include this feature


class LimitCheckRequest(BaseModel):
    """Request schema for checking usage limits"""

    restaurant_id: int
    limit_type: str
    current_usage: int

    @validator("limit_type")
    def validate_limit_type(cls, v):
        if v not in ["orders", "staff", "menu_items"]:
            raise ValueError("Limit type must be one of: orders, staff, menu_items")
        return v


class LimitCheckResponse(BaseModel):
    """Response schema for usage limit check"""

    at_limit: bool
    over_limit: bool
    current_usage: int
    limit: Optional[int] = None  # None means unlimited
    percentage_used: float
    remaining: Optional[int] = None
    plan_name: str
    limit_type: str


class BillingHistoryResponse(BaseModel):
    """Response schema for billing history"""

    subscription_id: int
    period_start: datetime
    period_end: datetime
    amount: Decimal
    status: str  # paid, pending, failed
    invoice_url: Optional[str] = None
    created_at: datetime


class SubscriptionSummaryResponse(BaseModel):
    """Summary response for subscription dashboard"""

    subscription: RestaurantSubscriptionResponse
    usage: SubscriptionUsageResponse
    feature_access: Dict[str, bool]
    usage_warnings: list  # Features approaching limits
    billing_status: str
    next_billing_date: Optional[datetime] = None
