"""
Employee Service - Business logic for employee management
Handles employee CRUD operations, scheduling, time tracking, and performance metrics
"""

from typing import List, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
from app.core.database import User, UserRestaurant
from app.models.employee import (
    EmployeeProfile,
    Schedule,
    Shift,
    TimeEntry,
    PerformanceMetric,
)
from app.core.database import Restaurant
from app.schemas.employee_schemas import (
    EmployeeCreateRequest,
    EmployeeUpdateRequest,
    EmployeeResponse,
    ScheduleCreateRequest,
    ScheduleUpdateRequest,
    ScheduleResponse,
    ShiftResponse,
    PerformanceMetricResponse,
    EmployeeSummary,
    WeeklyScheduleResponse,
    WeeklyScheduleDay,
)
from app.core.exceptions import (
    AuthenticationException,
    FynloException,
    ResourceNotFoundException,
)
from app.core.security import get_password_hash
from app.core.tenant_security import TenantSecurity
import logging

logger = logging.getLogger(__name__)


class EmployeeService:
    """Service class for employee management operations"""

    async def get_employees(
        self,
        db: Session,
        restaurant_id: Optional[int] = None,
        role: Optional[str] = None,
        active: Optional[bool] = True,
        current_user: User = None,
    ) -> List[EmployeeResponse]:
        """Get employees with optional filtering"""
        try:
            # If specific restaurant_id provided, validate access to it
            if restaurant_id:
                await TenantSecurity.validate_restaurant_access(
                    user=current_user,
                    restaurant_id=str(restaurant_id),
                    operation="access",
                    resource_type="employees",
                    db=db,
                )
                # Query for specific restaurant
                query = db.query(EmployeeProfile).filter(
                    EmployeeProfile.restaurant_id == restaurant_id
                )
            else:
                # Get all accessible restaurants for the user
                accessible_restaurants = TenantSecurity.get_accessible_restaurant_ids(
                    current_user, db
                )

                if not accessible_restaurants:
                    # No restaurant access
                    raise FynloException(
                        "User must be assigned to a restaurant", status_code=400
                    )

                # Apply tenant filter for all accessible restaurants
                query = TenantSecurity.apply_tenant_filter(
                    query=db.query(EmployeeProfile),
                    user=current_user,
                    model_class=EmployeeProfile,
                    restaurant_field="restaurant_id",
                    db=db,
                )

            # Apply role filter
            if role:
                query = query.filter(EmployeeProfile.role == role)

            # Apply active status filter
            if active is not None:
                query = query.filter(EmployeeProfile.is_active == active)

            employees = query.order_by(
                EmployeeProfile.last_name, EmployeeProfile.first_name
            ).all()

            return [EmployeeResponse.from_orm(emp) for emp in employees]

        except FynloException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving employees: {str(e)}")
            raise FynloException(f"Failed to retrieve employees: {str(e)}")

    async def get_employee_by_id(
        self, db: Session, employee_id: int, current_user: User = None
    ) -> Optional[EmployeeResponse]:
        """Get specific employee by ID"""
        try:
            employee = (
                db.query(EmployeeProfile)
                .filter(EmployeeProfile.id == employee_id)
                .first()
            )

            if not employee:
                return None

            # Validate tenant access using TenantSecurity
            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=str(employee.restaurant_id),
                operation="access",
                resource_type="employee",
                resource_id=str(employee_id),
                db=db,
            )
            return EmployeeResponse.from_orm(employee)

        except FynloException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving employee {employee_id}: {str(e)}")
            raise FynloException(f"Failed to retrieve employee: {str(e)}")

    async def create_employee(
        self,
        db: Session,
        employee_data: EmployeeCreateRequest,
        current_user: User = None,
    ) -> EmployeeResponse:
        """Create new employee"""
        try:
            # Determine target restaurant
            # If restaurant_id is provided in the request, validate access to it
            # Otherwise use the user's current restaurant
            target_restaurant_id = employee_data.restaurant_id

            if not target_restaurant_id and current_user:
                target_restaurant_id = (
                    current_user.current_restaurant_id or current_user.restaurant_id
                )

            if not target_restaurant_id:
                raise FynloException("Restaurant ID must be specified", status_code=400)

            # Validate access to the target restaurant
            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=str(target_restaurant_id),
                operation="modify",
                resource_type="employees",
                db=db,
            )

            # Verify restaurant exists
            restaurant = (
                db.query(Restaurant)
                .filter(Restaurant.id == target_restaurant_id)
                .first()
            )
            if not restaurant:
                raise ValueError("Restaurant not found")

            # Check if email already exists for this restaurant
            existing_employee = (
                db.query(EmployeeProfile)
                .filter(
                    and_(
                        EmployeeProfile.email == employee_data.email,
                        EmployeeProfile.restaurant_id == target_restaurant_id,
                    )
                )
                .first()
            )
            if existing_employee:
                raise ValueError(
                    "Employee with this email already exists in this restaurant"
                )

            # Create User record first
            user_data = {
                "email": employee_data.email,
                "first_name": employee_data.first_name,
                "last_name": employee_data.last_name,
                "role": "employee",
                "is_active": employee_data.is_active,
                "password_hash": get_password_hash(
                    "temp_password_123"
                ),  # Temporary password
                "restaurant_id": target_restaurant_id,
                "current_restaurant_id": target_restaurant_id,
            }

            new_user = User(**user_data)
            db.add(new_user)
            db.flush()  # Get the user ID

            # Create UserRestaurant entry to assign employee to restaurant
            user_restaurant = UserRestaurant(
                user_id=new_user.id,
                restaurant_id=target_restaurant_id,
                role="employee",
                is_primary=True,
                assigned_by=current_user.id if current_user else None,
            )
            db.add(user_restaurant)

            # Create EmployeeProfile
            employee_profile_data = {
                "user_id": new_user.id,
                "restaurant_id": target_restaurant_id,
                "employment_type": employee_data.employment_status,
                "hourly_rate": employee_data.hourly_rate,
                "hire_date": employee_data.hire_date or date.today(),
                "phone": employee_data.phone,
                "is_active": employee_data.is_active,
                "emergency_contact": (
                    {
                        "name": employee_data.emergency_contact_name,
                        "phone": employee_data.emergency_contact_phone,
                    }
                    if employee_data.emergency_contact_name
                    else {}
                ),
                "notes": (
                    [
                        {
                            "date": datetime.utcnow().isoformat(),
                            "note": employee_data.notes,
                            "author_id": str(current_user.id),
                        }
                    ]
                    if employee_data.notes
                    else []
                ),
                "max_hours_per_week": (
                    employee_data.weekly_hours if employee_data.weekly_hours else 40
                ),
            }

            new_employee = EmployeeProfile(**employee_profile_data)
            db.add(new_employee)
            db.commit()

            logger.info(f"Created new employee: {new_employee.email}")
            return EmployeeResponse.from_orm(new_employee)

        except ValueError as e:
            db.rollback()
            raise e
        except FynloException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating employee: {str(e)}")
            raise FynloException(f"Failed to create employee: {str(e)}")

    async def update_employee(
        self,
        db: Session,
        employee_id: int,
        employee_data: EmployeeUpdateRequest,
        current_user: User = None,
    ) -> Optional[EmployeeResponse]:
        """Update employee information"""
        try:
            employee = (
                db.query(EmployeeProfile)
                .filter(EmployeeProfile.id == employee_id)
                .first()
            )

            if not employee:
                return None

            # Validate tenant access using TenantSecurity
            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=str(employee.restaurant_id),
                operation="modify",
                resource_type="employee",
                resource_id=str(employee_id),
                db=db,
            )
            # Update fields if provided
            update_data = employee_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                if hasattr(employee, field):
                    setattr(employee, field, value)

            employee.updated_at = datetime.utcnow()
            db.commit()

            logger.info(f"Updated employee: {employee.email}")
            return EmployeeResponse.from_orm(employee)

        except FynloException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating employee {employee_id}: {str(e)}")
            raise FynloException(f"Failed to update employee: {str(e)}")

    async def delete_employee(
        self, db: Session, employee_id: int, current_user: User = None
    ) -> bool:
        """Delete employee (soft delete - marks as inactive)"""
        try:
            employee = (
                db.query(EmployeeProfile)
                .filter(EmployeeProfile.id == employee_id)
                .first()
            )

            if not employee:
                return False

            # Validate tenant access using TenantSecurity
            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=str(employee.restaurant_id),
                operation="delete",
                resource_type="employee",
                resource_id=str(employee_id),
                db=db,
            )
            # Soft delete - mark as inactive
            employee.is_active = False
            employee.updated_at = datetime.utcnow()

            # Also deactivate the User record
            user = db.query(User).filter(User.id == employee.user_id).first()
            if user:
                user.is_active = False

            db.commit()

            logger.info(f"Deactivated employee: {employee.email}")
            return True

        except FynloException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting employee {employee_id}: {str(e)}")
            raise FynloException(f"Failed to delete employee: {str(e)}")

    # Schedule Management Methods

    async def get_employee_schedules(
        self,
        db: Session,
        employee_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        current_user: User = None,
    ) -> List[ScheduleResponse]:
        """Get employee schedules with optional date filtering"""
        try:
            # Verify employee exists and user has access
            employee = await self.get_employee_by_id(db, employee_id, current_user)
            if not employee:
                raise ResourceNotFoundException("Employee not found")

            query = db.query(Schedule).filter(Schedule.employee_id == employee_id)

            if start_date:
                query = query.filter(Schedule.effective_date >= start_date)
            if end_date:
                query = query.filter(Schedule.effective_date <= end_date)

            schedules = query.order_by(Schedule.day_of_week, Schedule.start_time).all()

            return [ScheduleResponse.from_orm(schedule) for schedule in schedules]

        except FynloException:
            raise
        except Exception as e:
            logger.error(
                f"Error retrieving schedules for employee {employee_id}: {str(e)}"
            )
            raise FynloException(f"Failed to retrieve schedules: {str(e)}")

    async def create_schedule(
        self,
        db: Session,
        employee_id: int,
        schedule_data: ScheduleCreateRequest,
        current_user: User = None,
    ) -> ScheduleResponse:
        """Create new schedule for employee"""
        try:
            # Verify employee exists and user has access
            employee = await self.get_employee_by_id(db, employee_id, current_user)
            if not employee:
                raise ResourceNotFoundException("Employee not found")

            # Check for conflicts if recurring
            if schedule_data.is_recurring:
                existing = (
                    db.query(Schedule)
                    .filter(
                        and_(
                            Schedule.employee_id == employee_id,
                            Schedule.day_of_week == schedule_data.day_of_week,
                            Schedule.is_recurring == True,
                            Schedule.effective_date <= schedule_data.effective_date,
                        )
                    )
                    .first()
                )

                if existing:
                    raise ValueError(
                        f"Recurring schedule already exists for this day of week"
                    )

            new_schedule = Schedule(
                employee_id=employee_id,
                day_of_week=schedule_data.day_of_week,
                start_time=schedule_data.start_time,
                end_time=schedule_data.end_time,
                is_recurring=schedule_data.is_recurring,
                effective_date=schedule_data.effective_date,
                notes=schedule_data.notes,
            )

            db.add(new_schedule)
            db.commit()

            logger.info(f"Created schedule for employee {employee_id}")
            return ScheduleResponse.from_orm(new_schedule)

        except ValueError as e:
            db.rollback()
            raise e
        except FynloException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating schedule: {str(e)}")
            raise FynloException(f"Failed to create schedule: {str(e)}")

    async def clock_in(
        self, db: Session, employee_id: int, current_user: User = None
    ) -> ShiftResponse:
        """Clock in employee for their shift"""
        try:
            # Verify employee exists and user has access
            employee = await self.get_employee_by_id(db, employee_id, current_user)
            if not employee:
                raise ResourceNotFoundException("Employee not found")

            # Check if already clocked in
            existing_shift = (
                db.query(Shift)
                .filter(
                    and_(
                        Shift.employee_id == employee_id,
                        Shift.actual_start.isnot(None),
                        Shift.actual_end.is_(None),
                    )
                )
                .first()
            )

            if existing_shift:
                raise ValueError("Employee is already clocked in")

            # Get employee to access restaurant_id
            employee_profile = (
                db.query(EmployeeProfile)
                .filter(EmployeeProfile.id == employee_id)
                .first()
            )

            # Create new shift
            now = datetime.utcnow()
            new_shift = Shift(
                employee_id=employee_id,
                restaurant_id=employee_profile.restaurant_id,
                scheduled_start=now,  # Will be updated based on schedule
                scheduled_end=now + timedelta(hours=8),  # Default 8-hour shift
                actual_start=now,
                status="in_progress",
            )

            db.add(new_shift)

            # Create time entry
            time_entry = TimeEntry(
                employee_id=employee_id, entry_type="clock_in", timestamp=now
            )
            db.add(time_entry)

            db.commit()

            logger.info(f"Employee {employee_id} clocked in")
            return ShiftResponse.from_orm(new_shift)

        except ValueError as e:
            db.rollback()
            raise e
        except FynloException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error clocking in employee {employee_id}: {str(e)}")
            raise FynloException(f"Failed to clock in: {str(e)}")

    async def clock_out(
        self, db: Session, employee_id: int, current_user: User = None
    ) -> ShiftResponse:
        """Clock out employee from their shift"""
        try:
            # Verify employee exists and user has access
            employee = await self.get_employee_by_id(db, employee_id, current_user)
            if not employee:
                raise ResourceNotFoundException("Employee not found")

            # Find active shift
            active_shift = (
                db.query(Shift)
                .filter(
                    and_(
                        Shift.employee_id == employee_id,
                        Shift.actual_start.isnot(None),
                        Shift.actual_end.is_(None),
                    )
                )
                .first()
            )

            if not active_shift:
                raise ValueError("Employee is not currently clocked in")

            # Update shift
            now = datetime.utcnow()
            active_shift.actual_end = now
            active_shift.status = "completed"

            # Create time entry
            time_entry = TimeEntry(
                employee_id=employee_id,
                shift_id=active_shift.id,
                entry_type="clock_out",
                timestamp=now,
            )
            db.add(time_entry)

            db.commit()

            logger.info(f"Employee {employee_id} clocked out")
            return ShiftResponse.from_orm(active_shift)

        except ValueError as e:
            db.rollback()
            raise e
        except Exception as e:
            db.rollback()
            logger.error(f"Error clocking out employee {employee_id}: {str(e)}")
            raise FynloException(f"Failed to clock out: {str(e)}")

    async def get_restaurant_employee_summary(
        self, db: Session, restaurant_id: int, current_user: User = None
    ) -> EmployeeSummary:
        """Get employee summary for restaurant dashboard"""
        try:
            # Validate tenant access using TenantSecurity
            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=str(restaurant_id),
                operation="access",
                resource_type="employee_summary",
                db=db,
            )

            # Get accessible restaurants for the user
            accessible_restaurants = TenantSecurity.get_accessible_restaurant_ids(
                current_user, db
            )

            # If specific restaurant requested, use only that one (after validation)
            if restaurant_id in accessible_restaurants:
                restaurant_ids = [restaurant_id]
            else:
                # Use all accessible restaurants
                restaurant_ids = accessible_restaurants
            # Get basic counts
            total_employees = (
                db.query(EmployeeProfile)
                .filter(EmployeeProfile.restaurant_id.in_(restaurant_ids))
                .count()
            )

            active_employees = (
                db.query(EmployeeProfile)
                .filter(
                    and_(
                        EmployeeProfile.restaurant_id.in_(restaurant_ids),
                        EmployeeProfile.is_active == True,
                    )
                )
                .count()
            )

            # Get currently clocked in count
            clocked_in_now = (
                db.query(Shift)
                .join(EmployeeProfile)
                .filter(
                    and_(
                        EmployeeProfile.restaurant_id.in_(restaurant_ids),
                        Shift.actual_start.isnot(None),
                        Shift.actual_end.is_(None),
                    )
                )
                .count()
            )

            # Get roles breakdown
            roles_query = (
                db.query(
                    EmployeeProfile.role, func.count(EmployeeProfile.id).label("count")
                )
                .filter(
                    and_(
                        EmployeeProfile.restaurant_id.in_(restaurant_ids),
                        EmployeeProfile.is_active == True,
                    )
                )
                .group_by(EmployeeProfile.role)
                .all()
            )

            roles_breakdown = {role: count for role, count in roles_query}

            # Get employment type breakdown
            status_query = (
                db.query(
                    EmployeeProfile.employment_type,
                    func.count(EmployeeProfile.id).label("count"),
                )
                .filter(
                    and_(
                        EmployeeProfile.restaurant_id.in_(restaurant_ids),
                        EmployeeProfile.is_active == True,
                    )
                )
                .group_by(EmployeeProfile.employment_type)
                .all()
            )

            employment_status_breakdown = {
                status: count for status, count in status_query
            }

            return EmployeeSummary(
                total_employees=total_employees,
                active_employees=active_employees,
                clocked_in_now=clocked_in_now,
                scheduled_today=0,  # TODO: Calculate based on schedules
                roles_breakdown=roles_breakdown,
                employment_status_breakdown=employment_status_breakdown,
            )

        except FynloException:
            raise
        except Exception as e:
            logger.error(
                f"Error getting employee summary for restaurant {restaurant_id}: {str(e)}"
            )
            raise FynloException(f"Failed to get employee summary: {str(e)}")

    async def get_weekly_schedule(
        self,
        db: Session,
        restaurant_id: int,
        week_start: Optional[date] = None,
        current_user: User = None,
    ) -> WeeklyScheduleResponse:
        """Get weekly schedule for all restaurant employees"""
        try:
            # Validate tenant access using TenantSecurity
            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=str(restaurant_id),
                operation="access",
                resource_type="weekly_schedule",
                db=db,
            )
            if not week_start:
                # Default to current week (Monday as start)
                today = date.today()
                week_start = today - timedelta(days=today.weekday())

            week_end = week_start + timedelta(days=6)

            # Get all employees for the restaurant
            employees = (
                db.query(EmployeeProfile)
                .filter(
                    and_(
                        EmployeeProfile.restaurant_id == restaurant_id,
                        EmployeeProfile.is_active == True,
                    )
                )
                .all()
            )

            # Build weekly schedule
            days = []
            total_week_hours = 0.0

            for i in range(7):  # 7 days of the week
                current_date = week_start + timedelta(days=i)
                day_name = current_date.strftime("%A")

                # Get schedules for this day
                day_employees = []
                day_hours = 0.0

                for employee in employees:
                    schedules = (
                        db.query(Schedule)
                        .filter(
                            and_(
                                Schedule.employee_id == employee.id,
                                Schedule.day_of_week == i,  # 0=Monday
                                Schedule.effective_date <= current_date,
                            )
                        )
                        .order_by(desc(Schedule.effective_date))
                        .first()
                    )

                    if schedules:
                        # Calculate hours for this shift
                        start_datetime = datetime.combine(
                            current_date, schedules.start_time
                        )
                        end_datetime = datetime.combine(
                            current_date, schedules.end_time
                        )
                        if end_datetime <= start_datetime:
                            end_datetime += timedelta(days=1)  # Next day

                        shift_hours = (
                            end_datetime - start_datetime
                        ).total_seconds() / 3600
                        day_hours += shift_hours

                        day_employees.append(
                            {
                                "employee_id": employee.id,
                                "employee_name": f"{employee.first_name} {employee.last_name}",
                                "role": employee.role,
                                "start_time": schedules.start_time.strftime("%H:%M"),
                                "end_time": schedules.end_time.strftime("%H:%M"),
                                "hours": round(shift_hours, 2),
                            }
                        )

                total_week_hours += day_hours

                days.append(
                    WeeklyScheduleDay(
                        date=current_date,
                        day_name=day_name,
                        employees=day_employees,
                        total_scheduled_hours=round(day_hours, 2),
                        coverage_gaps=[],  # TODO: Implement gap analysis
                    )
                )

            return WeeklyScheduleResponse(
                week_start=week_start,
                week_end=week_end,
                restaurant_id=restaurant_id,
                days=days,
                total_week_hours=round(total_week_hours, 2),
            )

        except FynloException:
            raise
        except Exception as e:
            logger.error(
                f"Error getting weekly schedule for restaurant {restaurant_id}: {str(e)}"
            )
            raise FynloException(f"Failed to get weekly schedule: {str(e)}")

    async def get_employee_shifts(
        self,
        db: Session,
        employee_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        current_user: User = None,
    ) -> List[ShiftResponse]:
        """Get employee work shifts with optional date filtering"""
        try:
            # Verify employee exists and user has access
            employee = await self.get_employee_by_id(db, employee_id, current_user)
            if not employee:
                raise ResourceNotFoundException("Employee not found")

            query = db.query(Shift).filter(Shift.employee_id == employee_id)

            if start_date:
                query = query.filter(func.date(Shift.scheduled_start) >= start_date)
            if end_date:
                query = query.filter(func.date(Shift.scheduled_end) <= end_date)

            shifts = query.order_by(desc(Shift.scheduled_start)).all()

            return [ShiftResponse.from_orm(shift) for shift in shifts]

        except FynloException:
            raise
        except Exception as e:
            logger.error(
                f"Error retrieving shifts for employee {employee_id}: {str(e)}"
            )
            raise FynloException(f"Failed to retrieve shifts: {str(e)}")

    async def get_performance_metrics(
        self,
        db: Session,
        employee_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        current_user: User = None,
    ) -> List[PerformanceMetricResponse]:
        """Get employee performance metrics"""
        try:
            # Verify employee exists and user has access
            employee = await self.get_employee_by_id(db, employee_id, current_user)
            if not employee:
                raise ResourceNotFoundException("Employee not found")

            query = db.query(PerformanceMetric).filter(
                PerformanceMetric.employee_id == employee_id
            )

            if start_date:
                query = query.filter(PerformanceMetric.metric_date >= start_date)
            if end_date:
                query = query.filter(PerformanceMetric.metric_date <= end_date)

            metrics = query.order_by(desc(PerformanceMetric.metric_date)).all()

            return [PerformanceMetricResponse.from_orm(metric) for metric in metrics]

        except FynloException:
            raise
        except Exception as e:
            logger.error(
                f"Error retrieving performance metrics for employee {employee_id}: {str(e)}"
            )
            raise FynloException(f"Failed to retrieve performance metrics: {str(e)}")

    # Additional helper methods

    async def update_schedule(
        self,
        db: Session,
        schedule_id: int,
        schedule_data: ScheduleUpdateRequest,
        current_user: User = None,
    ) -> Optional[ScheduleResponse]:
        """Update existing schedule"""
        try:
            schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
            if not schedule:
                return None

            # Check access through employee
            employee = await self.get_employee_by_id(
                db, schedule.employee_id, current_user
            )
            if not employee:
                raise AuthenticationException(
                    message="Access denied", error_code="ACCESS_DENIED"
                )

            # Update fields if provided
            update_data = schedule_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                if hasattr(schedule, field):
                    setattr(schedule, field, value)

            schedule.updated_at = datetime.utcnow()
            db.commit()

            return ScheduleResponse.from_orm(schedule)

        except FynloException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating schedule {schedule_id}: {str(e)}")
            raise FynloException(f"Failed to update schedule: {str(e)}")

    async def delete_schedule(
        self, db: Session, schedule_id: int, current_user: User = None
    ) -> bool:
        """Delete schedule"""
        try:
            schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
            if not schedule:
                return False

            # Check access through employee
            employee = await self.get_employee_by_id(
                db, schedule.employee_id, current_user
            )
            if not employee:
                raise AuthenticationException(
                    message="Access denied", error_code="ACCESS_DENIED"
                )

            db.delete(schedule)
            db.commit()

            return True

        except FynloException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting schedule {schedule_id}: {str(e)}")
            raise FynloException(f"Failed to delete schedule: {str(e)}")
