"""
Subscription models for Fynlo POS

This module contains SQLAlchemy models for managing subscription plans,
restaurant subscriptions, and usage tracking.
"""

from sqlalchemy import Column, Integer, String, DECIMAL, Boolean, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

from app.database import Base


class SubscriptionPlan(Base):
    """
    Subscription plans available to restaurants
    
    Defines the different pricing tiers with their features and limits.
    """
    __tablename__ = "subscription_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    price_monthly = Column(DECIMAL(10, 2), nullable=False)
    price_yearly = Column(DECIMAL(10, 2), nullable=False)
    transaction_fee_percentage = Column(DECIMAL(5, 2), nullable=False, default=1.0)  # Transaction fee %
    max_orders_per_month = Column(Integer, nullable=True)  # None = unlimited
    max_staff_accounts = Column(Integer, nullable=True)    # None = unlimited
    max_menu_items = Column(Integer, nullable=True)        # None = unlimited
    features = Column(JSONB, nullable=False)  # Feature flags and capabilities
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    restaurant_subscriptions = relationship("RestaurantSubscription", back_populates="plan")

    def __repr__(self):
        return f"<SubscriptionPlan(name='{self.name}', display_name='{self.display_name}')>"

    def has_feature(self, feature_name: str) -> bool:
        """Check if this plan includes a specific feature"""
        return self.features.get(feature_name, False)

    def is_unlimited(self, limit_type: str) -> bool:
        """Check if a limit is unlimited (None) for this plan"""
        limit_map = {
            'orders': self.max_orders_per_month,
            'staff': self.max_staff_accounts,
            'menu_items': self.max_menu_items
        }
        return limit_map.get(limit_type) is None

    def get_yearly_savings(self) -> float:
        """Calculate yearly savings compared to monthly billing"""
        monthly_yearly_cost = float(self.price_monthly) * 12
        actual_yearly_cost = float(self.price_yearly)
        return monthly_yearly_cost - actual_yearly_cost

    def get_yearly_discount_percentage(self) -> float:
        """Calculate the discount percentage for yearly billing"""
        monthly_yearly_cost = float(self.price_monthly) * 12
        if monthly_yearly_cost > 0:
            savings = self.get_yearly_savings()
            return (savings / monthly_yearly_cost) * 100
        return 0.0


class RestaurantSubscription(Base):
    """
    Individual restaurant subscriptions
    
    Links restaurants to their current subscription plans and tracks
    billing information and subscription status.
    """
    __tablename__ = "restaurant_subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    restaurant_id = Column(Integer, nullable=False, index=True)  # FK to restaurants table
    plan_id = Column(Integer, ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String(20), nullable=False, index=True)  # active, trial, suspended, cancelled
    trial_end_date = Column(TIMESTAMP, nullable=True)
    current_period_start = Column(TIMESTAMP, nullable=False)
    current_period_end = Column(TIMESTAMP, nullable=False)
    stripe_subscription_id = Column(String(255), nullable=True, unique=True)
    stripe_customer_id = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    plan = relationship("SubscriptionPlan", back_populates="restaurant_subscriptions")

    def __repr__(self):
        return f"<RestaurantSubscription(restaurant_id={self.restaurant_id}, plan='{self.plan.name}', status='{self.status}')>"

    @property
    def is_active(self) -> bool:
        """Check if subscription is currently active"""
        return self.status in ['active', 'trial']

    @property
    def is_trial(self) -> bool:
        """Check if subscription is in trial period"""
        return self.status == 'trial'

    @property
    def is_expired(self) -> bool:
        """Check if subscription period has expired"""
        return datetime.utcnow() > self.current_period_end

    @property
    def days_until_renewal(self) -> int:
        """Calculate days until subscription renewal"""
        delta = self.current_period_end - datetime.utcnow()
        return max(0, delta.days)

    def has_feature(self, feature_name: str) -> bool:
        """Check if current plan includes a specific feature"""
        if not self.is_active:
            return False
        return self.plan.has_feature(feature_name)

    def get_limit(self, limit_type: str) -> int | None:
        """Get the limit for a specific resource type"""
        if not self.is_active:
            return 0
            
        limit_map = {
            'orders': self.plan.max_orders_per_month,
            'staff': self.plan.max_staff_accounts,
            'menu_items': self.plan.max_menu_items
        }
        return limit_map.get(limit_type)

    def is_at_limit(self, limit_type: str, current_usage: int) -> bool:
        """Check if current usage has reached the plan limit"""
        limit = self.get_limit(limit_type)
        if limit is None:  # Unlimited
            return False
        return current_usage >= limit


class SubscriptionUsage(Base):
    """
    Monthly usage tracking for restaurants
    
    Tracks resource usage (orders, staff, menu items) by month
    to enforce subscription limits and provide analytics.
    """
    __tablename__ = "subscription_usage"
    __table_args__ = (
        UniqueConstraint('restaurant_id', 'month_year', name='unique_restaurant_month'),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    restaurant_id = Column(Integer, nullable=False)  # FK to restaurants table
    month_year = Column(String(7), nullable=False)  # Format: "2025-01"
    orders_count = Column(Integer, default=0)
    staff_count = Column(Integer, default=0)
    menu_items_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SubscriptionUsage(restaurant_id={self.restaurant_id}, month='{self.month_year}', orders={self.orders_count})>"

    @classmethod
    def get_current_month_key(cls) -> str:
        """Get the current month key in YYYY-MM format"""
        return datetime.utcnow().strftime("%Y-%m")

    def get_usage_percentage(self, limit_type: str, plan_limit: int | None) -> float:
        """Calculate usage percentage for a specific limit"""
        if plan_limit is None:  # Unlimited
            return 0.0
            
        usage_map = {
            'orders': self.orders_count,
            'staff': self.staff_count,
            'menu_items': self.menu_items_count
        }
        
        current_usage = usage_map.get(limit_type, 0)
        if plan_limit > 0:
            return min(100.0, (current_usage / plan_limit) * 100)
        return 0.0

    def is_over_limit(self, limit_type: str, plan_limit: int | None) -> bool:
        """Check if usage exceeds the plan limit"""
        if plan_limit is None:  # Unlimited
            return False
            
        usage_map = {
            'orders': self.orders_count,
            'staff': self.staff_count,
            'menu_items': self.menu_items_count
        }
        
        current_usage = usage_map.get(limit_type, 0)
        return current_usage > plan_limit

    def increment_usage(self, usage_type: str, amount: int = 1) -> None:
        """Increment usage for a specific type"""
        if usage_type == 'orders':
            self.orders_count += amount
        elif usage_type == 'staff':
            self.staff_count += amount
        elif usage_type == 'menu_items':
            self.menu_items_count += amount