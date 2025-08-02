"""
Pydantic schemas for Employee Management API
Defines request/response models for employee operations
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date, time
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator
from enum import Enum

# Enums for employee roles and statuses
class EmployeeRole(str, Enum):
    CHEF = "chef"
    SOUS_CHEF = "sous_chef"
    LINE_COOK = "line_cook"
    SERVER = "server"
    BARTENDER = "bartender"
    HOST = "host"
    CASHIER = "cashier"
    MANAGER = "manager"
    ASSISTANT_MANAGER = "assistant_manager"
    CLEANER = "cleaner"

class EmploymentStatus(str, Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERN = "intern"

class ShiftStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    MISSED = "missed"
    CANCELLED = "cancelled"

# Base Employee Schemas
class EmployeeBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    phone: Optional[str] = Field(None, pattern=r'^\+?[\d\s\-\(\)]+$')
    role: EmployeeRole
    employment_status: EmploymentStatus
    hourly_rate: Optional[Decimal] = Field(None, ge=0)
    weekly_hours: Optional[int] = Field(None, ge=0, le=80)
    is_active: bool = True

class EmployeeCreateRequest(EmployeeBase):
    restaurant_id: int = Field(..., gt=0)
    hire_date: Optional[date] = None
    emergency_contact_name: Optional[str] = Field(None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(None, pattern=r'^\+?[\d\s\-\(\)]+$')
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator('hire_date')
    @classmethod
    def validate_hire_date(cls, v):
        """Validate hire date"""
        if v is None:
            return date.today()
        if v > date.today():
            raise ValueError('Hire date cannot be in the future')
        return v

class EmployeeUpdateRequest(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[str] = Field(None, pattern=r'^[^@]+@[^@]+\.[^@]+$')
    phone: Optional[str] = Field(None, pattern=r'^\+?[\d\s\-\(\)]+$')
    role: Optional[EmployeeRole] = None
    employment_status: Optional[EmploymentStatus] = None
    hourly_rate: Optional[Decimal] = Field(None, ge=0)
    weekly_hours: Optional[int] = Field(None, ge=0, le=80)
    is_active: Optional[bool] = None
    emergency_contact_name: Optional[str] = Field(None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(None, pattern=r'^\+?[\d\s\-\(\)]+$')
    notes: Optional[str] = Field(None, max_length=500)

class EmployeeResponse(BaseModel):
    id: int
    user_id: int
    restaurant_id: int
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    role: EmployeeRole
    employment_status: EmploymentStatus
    hourly_rate: Optional[Decimal]
    weekly_hours: Optional[int]
    hire_date: Optional[date]
    is_active: bool
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

# Schedule Schemas
class ScheduleBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: time
    end_time: time
    is_recurring: bool = True

    @field_validator('end_time')
    @classmethod
        if info.data and 'start_time' in info.data and v <= info.data['start_time']:
            raise ValueError('End time must be after start time')
        return v

class ScheduleCreateRequest(ScheduleBase):
    effective_date: date = Field(default_factory=date.today)
    notes: Optional[str] = Field(None, max_length=200)

    @field_validator('effective_date')
    @classmethod
        if v < date.today():
            raise ValueError('Effective date cannot be in the past')
        return v

class ScheduleUpdateRequest(BaseModel):
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_recurring: Optional[bool] = None
    effective_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=200)

    @field_validator('end_time')
    @classmethod
        if v and info.data and 'start_time' in info.data and info.data['start_time'] and v <= info.data['start_time']:
            raise ValueError('End time must be after start time')
        return v

class ScheduleResponse(BaseModel):
    id: int
    employee_id: int
    day_of_week: int
    start_time: time
    end_time: time
    is_recurring: bool
    effective_date: date
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

# Shift Schemas
class ShiftResponse(BaseModel):
    id: int
    employee_id: int
    scheduled_start: datetime
    scheduled_end: datetime
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    status: ShiftStatus
    break_duration: Optional[int] = Field(None, description="Break duration in minutes")
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    @property
    def scheduled_hours(self) -> float:
                """Calculate scheduled hours for the shift"""
        delta = self.scheduled_end - self.scheduled_start
        return round(delta.total_seconds() / 3600, 2)

    @property
    def actual_hours(self) -> Optional[float]:
                """Calculate actual hours worked"""
        if not self.actual_start or not self.actual_end:
            return None
        delta = self.actual_end - self.actual_start
        hours = delta.total_seconds() / 3600
        if self.break_duration:
            hours -= self.break_duration / 60
        return round(hours, 2)

    class Config:
        from_attributes = True

# Time Entry Schemas
class TimeEntryResponse(BaseModel):
    id: int
    employee_id: int
    shift_id: Optional[int]
    entry_type: str = Field(..., description="clock_in, clock_out, break_start, break_end")
    timestamp: datetime
    location: Optional[str] = Field(None, description="GPS coordinates or location name")
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Performance Metrics Schemas
class PerformanceMetricResponse(BaseModel):
    id: int
    employee_id: int
    metric_date: date
    orders_served: Optional[int] = 0
    sales_total: Optional[Decimal] = Field(None)
    customer_rating: Optional[Decimal] = Field(None, ge=0, le=5)
    punctuality_score: Optional[Decimal] = Field(None, ge=0, le=100)
    efficiency_score: Optional[Decimal] = Field(None, ge=0, le=100)
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

# Dashboard and Summary Schemas
class EmployeeSummary(BaseModel):
    total_employees: int
    active_employees: int
    clocked_in_now: int
    scheduled_today: int
    roles_breakdown: Dict[str, int]
    employment_status_breakdown: Dict[str, int]

class WeeklyScheduleDay(BaseModel):
    date: date
    day_name: str
    employees: List[Dict[str, Any]] = Field(
        ..., 
        description="List of employees with their scheduled shifts for this day"
    )
    total_scheduled_hours: float
    coverage_gaps: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Time periods with insufficient coverage"
    )

class WeeklyScheduleResponse(BaseModel):
    week_start: date
    week_end: date
    restaurant_id: int
    days: List[WeeklyScheduleDay]
    total_week_hours: float
    total_labor_cost: Optional[Decimal] = Field(None)
    coverage_summary: Dict[str, Any] = Field(
        default_factory=dict,
        description="Summary of coverage adequacy across the week"
    )

# Clock In/Out Request Schemas
class ClockInRequest(BaseModel):
    location: Optional[str] = Field(None, description="GPS coordinates or location name")
    notes: Optional[str] = Field(None, max_length=200)

class ClockOutRequest(BaseModel):
    location: Optional[str] = Field(None, description="GPS coordinates or location name")
    notes: Optional[str] = Field(None, max_length=200)
    break_duration: Optional[int] = Field(None, ge=0, description="Total break time in minutes")

# Error Response Schema
class EmployeeErrorResponse(BaseModel):
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None

# Batch Operations Schemas
class EmployeeBatchUpdateRequest(BaseModel):
    employee_ids: List[int] = Field(..., min_items=1, max_items=50)
    updates: EmployeeUpdateRequest

class ScheduleBatchCreateRequest(BaseModel):
    employee_id: int
    schedules: List[ScheduleCreateRequest] = Field(..., min_items=1, max_items=7)

# Analytics and Reporting Schemas
class EmployeeHoursReport(BaseModel):
    employee_id: int
    employee_name: str
    scheduled_hours: float
    actual_hours: float
    overtime_hours: float
    attendance_rate: Decimal = Field(..., description="Percentage")
    average_rating: Optional[Decimal] = Field(None)

class RestaurantLaborReport(BaseModel):
    period_start: date
    period_end: date
    total_scheduled_hours: float
    total_actual_hours: float
    total_labor_cost: Decimal = Field(...)
    average_hourly_rate: Decimal = Field(...)
    employees: List[EmployeeHoursReport]
    busiest_days: List[str]
    peak_hours: List[str]