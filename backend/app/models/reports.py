"""
Reports and Analytics Models
Cached aggregations for performance and historical reporting
"""

from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    Date,
    DECIMAL,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.core.database import Base


class DailyReport(Base):
    """Daily aggregated reports for quick access"""

    __tablename__ = "daily_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(
        UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False
    )
    report_date = Column(Date, nullable=False)

    # Sales Summary
    total_revenue = Column(DECIMAL(12, 2), default=0.0)
    total_orders = Column(Integer, default=0)
    average_order_value = Column(DECIMAL(10, 2), default=0.0)

    # Payment Breakdown
    cash_sales = Column(DECIMAL(12, 2), default=0.0)
    card_sales = Column(DECIMAL(12, 2), default=0.0)
    qr_sales = Column(DECIMAL(12, 2), default=0.0)
    other_sales = Column(DECIMAL(12, 2), default=0.0)

    # Order Types
    dine_in_orders = Column(Integer, default=0)
    takeaway_orders = Column(Integer, default=0)
    delivery_orders = Column(Integer, default=0)

    # Fees & Charges
    total_tax = Column(DECIMAL(10, 2), default=0.0)
    total_service_charge = Column(DECIMAL(10, 2), default=0.0)
    total_discounts = Column(DECIMAL(10, 2), default=0.0)
    payment_processing_fees = Column(DECIMAL(10, 2), default=0.0)

    # Labor Summary
    total_labor_hours = Column(DECIMAL(10, 2), default=0.0)
    total_labor_cost = Column(DECIMAL(12, 2), default=0.0)
    employees_worked = Column(Integer, default=0)

    # Inventory Impact
    cogs = Column(DECIMAL(12, 2), default=0.0)  # Cost of Goods Sold
    waste_cost = Column(DECIMAL(10, 2), default=0.0)

    # Customer Metrics
    unique_customers = Column(Integer, default=0)
    new_customers = Column(Integer, default=0)
    returning_customers = Column(Integer, default=0)

    # Hourly Breakdown (stored as JSONB for flexibility)
    hourly_sales = Column(JSONB, default={})  # {"09": 150.00, "10": 280.00, ...}
    hourly_orders = Column(JSONB, default={})  # {"09": 5, "10": 12, ...}

    # Top Items
    top_items = Column(JSONB, default=[])  # [{item_id, name, quantity, revenue}, ...]
    top_categories = Column(
        JSONB, default=[]
    )  # [{category_id, name, quantity, revenue}, ...]

    # Status
    is_complete = Column(Boolean, default=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    restaurant = relationship("Restaurant")

    # Unique constraint to ensure one report per restaurant per day
    __table_args__ = (
        UniqueConstraint(
            "restaurant_id", "report_date", name="uq_restaurant_daily_report"
        ),
    )


class HourlyMetric(Base):
    """Hourly metrics for real-time monitoring"""

    __tablename__ = "hourly_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(
        UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False
    )
    metric_datetime = Column(DateTime(timezone=True), nullable=False)
    hour = Column(Integer, nullable=False)  # 0-23

    # Sales Metrics
    revenue = Column(DECIMAL(10, 2), default=0.0)
    order_count = Column(Integer, default=0)
    item_count = Column(Integer, default=0)
    average_order_value = Column(DECIMAL(10, 2), default=0.0)

    # Service Metrics
    average_prep_time = Column(Integer, default=0)  # minutes
    average_service_time = Column(Integer, default=0)  # minutes
    tables_turned = Column(Integer, default=0)

    # Labor Metrics
    staff_count = Column(Integer, default=0)
    labor_cost = Column(DECIMAL(10, 2), default=0.0)
    revenue_per_labor_hour = Column(DECIMAL(10, 2), default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    restaurant = relationship("Restaurant")

    # Unique constraint
    __table_args__ = (
        UniqueConstraint(
            "restaurant_id",
            "metric_datetime",
            "hour",
            name="uq_restaurant_hourly_metric",
        ),
    )


class ProductPerformance(Base):
    """Product performance analytics"""

    __tablename__ = "product_performance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(
        UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False
    )
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    report_date = Column(Date, nullable=False)

    # Sales Metrics
    quantity_sold = Column(Integer, default=0)
    total_revenue = Column(DECIMAL(10, 2), default=0.0)
    total_cost = Column(DECIMAL(10, 2), default=0.0)
    gross_profit = Column(DECIMAL(10, 2), default=0.0)
    profit_margin = Column(DECIMAL(5, 2), default=0.0)  # percentage

    # Time Distribution
    lunch_sales = Column(Integer, default=0)  # 11am-2pm
    dinner_sales = Column(Integer, default=0)  # 5pm-9pm
    other_sales = Column(Integer, default=0)

    # Combo/Modifier Analysis
    sold_as_combo = Column(Integer, default=0)
    popular_modifiers = Column(JSONB, default=[])  # [{modifier, count}, ...]

    # Rankings
    revenue_rank = Column(Integer, nullable=True)
    quantity_rank = Column(Integer, nullable=True)
    profit_rank = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    restaurant = relationship("Restaurant")
    product = relationship("Product")

    # Unique constraint
    __table_args__ = (
        UniqueConstraint(
            "restaurant_id", "product_id", "report_date", name="uq_product_performance"
        ),
    )


class EmployeePerformance(Base):
    """Employee performance summary for reports"""

    __tablename__ = "employee_performance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(
        UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False
    )
    employee_id = Column(
        UUID(as_uuid=True), ForeignKey("employee_profiles.id"), nullable=False
    )
    report_date = Column(Date, nullable=False)

    # Work Summary
    hours_worked = Column(DECIMAL(5, 2), default=0.0)
    shifts_worked = Column(Integer, default=0)

    # Sales Performance (for servers/cashiers)
    total_sales = Column(DECIMAL(12, 2), default=0.0)
    transaction_count = Column(Integer, default=0)
    average_transaction = Column(DECIMAL(10, 2), default=0.0)
    sales_per_hour = Column(DECIMAL(10, 2), default=0.0)

    # Service Metrics
    tables_served = Column(Integer, default=0)
    items_sold = Column(Integer, default=0)
    average_service_time = Column(Integer, default=0)  # minutes

    # Tips
    tips_earned = Column(DECIMAL(10, 2), default=0.0)
    tip_percentage = Column(DECIMAL(5, 2), default=0.0)

    # Labor Cost
    wages_earned = Column(DECIMAL(10, 2), default=0.0)
    total_compensation = Column(DECIMAL(10, 2), default=0.0)  # wages + tips

    # Rankings (within restaurant for the day)
    sales_rank = Column(Integer, nullable=True)
    efficiency_rank = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    restaurant = relationship("Restaurant")
    employee = relationship("EmployeeProfile")

    # Unique constraint
    __table_args__ = (
        UniqueConstraint(
            "restaurant_id",
            "employee_id",
            "report_date",
            name="uq_employee_performance",
        ),
    )


class FinancialSummary(Base):
    """Weekly/Monthly financial summaries"""

    __tablename__ = "financial_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(
        UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False
    )
    platform_id = Column(UUID(as_uuid=True), ForeignKey("platforms.id"), nullable=False)

    # Period
    period_type = Column(
        String(20), nullable=False
    )  # weekly, monthly, quarterly, yearly
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    # Revenue
    gross_revenue = Column(DECIMAL(12, 2), default=0.0)
    net_revenue = Column(DECIMAL(12, 2), default=0.0)

    # Costs
    total_cogs = Column(DECIMAL(12, 2), default=0.0)
    total_labor = Column(DECIMAL(12, 2), default=0.0)
    total_overhead = Column(DECIMAL(12, 2), default=0.0)

    # Fees & Commissions
    payment_processing_fees = Column(DECIMAL(10, 2), default=0.0)
    platform_commission = Column(DECIMAL(10, 2), default=0.0)
    service_charges_collected = Column(DECIMAL(10, 2), default=0.0)

    # Profit
    gross_profit = Column(DECIMAL(12, 2), default=0.0)
    operating_profit = Column(DECIMAL(12, 2), default=0.0)
    profit_margin = Column(DECIMAL(5, 2), default=0.0)  # percentage

    # Operational Metrics
    total_orders = Column(Integer, default=0)
    average_order_value = Column(DECIMAL(10, 2), default=0.0)
    customer_count = Column(Integer, default=0)

    # Comparisons (stored as percentages)
    revenue_vs_last_period = Column(DECIMAL(5, 2), default=0.0)
    profit_vs_last_period = Column(DECIMAL(5, 2), default=0.0)

    # Breakdown by category
    category_breakdown = Column(
        JSONB, default={}
    )  # {category_id: {revenue, quantity, profit}}

    # Status
    is_finalized = Column(Boolean, default=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    restaurant = relationship("Restaurant")
    platform = relationship("Platform")

    # Unique constraint
    __table_args__ = (
        UniqueConstraint(
            "restaurant_id", "period_type", "period_start", name="uq_financial_summary"
        ),
    )
