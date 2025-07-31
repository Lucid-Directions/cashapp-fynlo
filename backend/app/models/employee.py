"""
Employee Management Models
Extends the User model with employee-specific features like schedules, shifts, and performance tracking
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Date, Time, DECIMAL, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.core.database import Base


class EmployeeProfile(Base):
    """Extended employee information linked to User model"""
    __tablename__ = "employee_profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    
    # Employment Information
    employee_id = Column(String(50), unique=True)  # Internal employee ID
    hire_date = Column(Date, nullable=False)
    employment_type = Column(String(50), default="full_time")  # full_time, part_time, seasonal
    hourly_rate = Column(DECIMAL(10, 2), nullable=False)
    
    # Contact & Emergency
    phone = Column(String(20), nullable=False)
    emergency_contact = Column(JSONB, default={})  # {name, phone, relationship}
    
    # Scheduling Preferences
    max_hours_per_week = Column(Integer, default=40)
    min_hours_per_week = Column(Integer, default=0)
    availability = Column(JSONB, default={})  # {monday: {start: "09:00", end: "17:00"}, ...}
    
    # Performance Metrics
    performance_rating = Column(DECIMAL(3, 2), default=0.0)  # 0.00 to 5.00
    total_sales = Column(DECIMAL(12, 2), default=0.0)
    orders_served = Column(Integer, default=0)
    average_order_time = Column(Integer, default=0)  # minutes
    
    # Status
    is_active = Column(Boolean, default=True)
    termination_date = Column(Date, nullable=True)
    notes = Column(JSONB, default=[])  # [{date, note, author_id}]
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", backref="employee_profile")
    restaurant = relationship("Restaurant", backref="employees")
    schedules = relationship("Schedule", back_populates="employee", cascade="all, delete-orphan", foreign_keys="Schedule.employee_id")
    shifts = relationship("Shift", back_populates="employee", cascade="all, delete-orphan")
    time_entries = relationship("TimeEntry", back_populates="employee", cascade="all, delete-orphan")


class Schedule(Base):
    """Employee work schedules"""
    __tablename__ = "schedules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employee_profiles.id"), nullable=False)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    
    # Schedule Details
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    break_minutes = Column(Integer, default=0)
    
    # Role for this shift
    role = Column(String(50), nullable=False)  # server, kitchen, cashier, manager
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=True)  # For servers
    
    # Status
    status = Column(String(20), default="scheduled")  # scheduled, confirmed, completed, cancelled
    is_published = Column(Boolean, default=False)
    
    # Swap/Cover requests
    swap_requested = Column(Boolean, default=False)
    swap_with_employee_id = Column(UUID(as_uuid=True), ForeignKey("employee_profiles.id"), nullable=True)
    
    notes = Column(String(500), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("EmployeeProfile", back_populates="schedules", foreign_keys=[employee_id])
    restaurant = relationship("Restaurant")
    section = relationship("Section")
    creator = relationship("User", foreign_keys=[created_by])
    swap_with_employee = relationship("EmployeeProfile", foreign_keys=[swap_with_employee_id])
    
    # Ensure no duplicate schedules for same employee on same date/time
    __table_args__ = (
        UniqueConstraint('employee_id', 'date', 'start_time', name='uq_employee_schedule'),
    )


class Shift(Base):
    """Actual worked shifts (clock in/out records)"""
    __tablename__ = "shifts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employee_profiles.id"), nullable=False)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("schedules.id"), nullable=True)
    
    # Clock In/Out
    clock_in = Column(DateTime(timezone=True), nullable=False)
    clock_out = Column(DateTime(timezone=True), nullable=True)
    
    # Break tracking
    break_start = Column(DateTime(timezone=True), nullable=True)
    break_end = Column(DateTime(timezone=True), nullable=True)
    total_break_minutes = Column(Integer, default=0)
    
    # Shift Details
    role = Column(String(50), nullable=False)
    hourly_rate = Column(DECIMAL(10, 2), nullable=False)  # Rate at time of shift
    
    # Calculated Fields
    total_hours = Column(DECIMAL(5, 2), default=0.0)
    regular_hours = Column(DECIMAL(5, 2), default=0.0)
    overtime_hours = Column(DECIMAL(5, 2), default=0.0)
    
    # Earnings
    tips_cash = Column(DECIMAL(10, 2), default=0.0)
    tips_card = Column(DECIMAL(10, 2), default=0.0)
    total_sales = Column(DECIMAL(12, 2), default=0.0)
    total_earnings = Column(DECIMAL(10, 2), default=0.0)  # wages + tips
    
    # Status
    status = Column(String(20), default="active")  # active, completed, void
    approval_status = Column(String(20), default="pending")  # pending, approved, rejected
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("EmployeeProfile", back_populates="shifts")
    restaurant = relationship("Restaurant")
    schedule = relationship("Schedule")
    approver = relationship("User")


class TimeEntry(Base):
    """Time clock entries for tracking all clock events"""
    __tablename__ = "time_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employee_profiles.id"), nullable=False)
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id"), nullable=True)
    
    # Entry Details
    entry_type = Column(String(20), nullable=False)  # clock_in, clock_out, break_start, break_end
    timestamp = Column(DateTime(timezone=True), nullable=False)
    
    # Location/Device
    device_id = Column(String(100), nullable=True)
    ip_address = Column(String(45), nullable=True)
    location = Column(JSONB, nullable=True)  # {lat, lng, accuracy}
    
    # Verification
    pin_verified = Column(Boolean, default=True)
    biometric_verified = Column(Boolean, default=False)
    manager_override = Column(Boolean, default=False)
    override_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    override_reason = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    employee = relationship("EmployeeProfile", back_populates="time_entries")
    shift = relationship("Shift")
    override_manager = relationship("User")


class PerformanceMetric(Base):
    """Employee performance tracking"""
    __tablename__ = "performance_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employee_profiles.id"), nullable=False)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    
    # Period
    metric_date = Column(Date, nullable=False)
    metric_type = Column(String(50), nullable=False)  # daily, weekly, monthly
    
    # Sales Metrics
    total_sales = Column(DECIMAL(12, 2), default=0.0)
    transaction_count = Column(Integer, default=0)
    average_transaction = Column(DECIMAL(10, 2), default=0.0)
    
    # Service Metrics
    tables_served = Column(Integer, default=0)
    average_table_time = Column(Integer, default=0)  # minutes
    
    # Quality Metrics
    customer_rating = Column(DECIMAL(3, 2), default=0.0)  # 0.00 to 5.00
    compliments = Column(Integer, default=0)
    complaints = Column(Integer, default=0)
    
    # Efficiency
    items_per_hour = Column(DECIMAL(10, 2), default=0.0)
    waste_percentage = Column(DECIMAL(5, 2), default=0.0)
    
    # Attendance
    scheduled_hours = Column(DECIMAL(5, 2), default=0.0)
    worked_hours = Column(DECIMAL(5, 2), default=0.0)
    late_arrivals = Column(Integer, default=0)
    no_shows = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("EmployeeProfile")
    restaurant = relationship("Restaurant")
    
    # Ensure one metric per employee per date per type
    __table_args__ = (
        UniqueConstraint('employee_id', 'metric_date', 'metric_type', name='uq_employee_metric'),
    )