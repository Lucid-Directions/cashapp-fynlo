"""
Employee Service - Business logic for employee management
Handles employee CRUD operations, scheduling, time tracking, and performance metrics
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from app.core.database import User
from app.models.employee import EmployeeProfile, Schedule, Shift, TimeEntry, PerformanceMetric
from app.core.database import Restaurant
from app.schemas.employee_schemas import (
    EmployeeCreateRequest, EmployeeUpdateRequest, EmployeeResponse,
    ScheduleCreateRequest, ScheduleUpdateRequest, ScheduleResponse,
    ShiftResponse, PerformanceMetricResponse, EmployeeSummary,
    WeeklyScheduleResponse, WeeklyScheduleDay
)
from app.core.exceptions import FynloException
from app.core.security import get_password_hash
import logging

logger = logging.getLogger(__name__)

class EmployeeService:
    """Service class for employee management operations"""

    def get_employees(
        self,
        db: Session,
        restaurant_id: Optional[int] = None,
        role: Optional[str] = None,
        active: Optional[bool] = True,
        current_user: User = None
    ) -> List[EmployeeResponse]:
        """Get employees with optional filtering"""
        try:
            query = db.query(EmployeeProfile)
            
            # Apply restaurant filter if provided or user restriction
            if restaurant_id:
                query = query.filter(EmployeeProfile.restaurant_id == restaurant_id)
            elif current_user and hasattr(current_user, 'restaurant_id'):
                query = query.filter(EmployeeProfile.restaurant_id == current_user.restaurant_id)
            
            # Apply role filter
            if role:
                query = query.filter(EmployeeProfile.role == role)
            
            # Apply active status filter
            if active is not None:
                query = query.filter(EmployeeProfile.is_active == active)
            
            employees = query.order_by(EmployeeProfile.last_name, EmployeeProfile.first_name).all()
            
            return [EmployeeResponse.from_orm(emp) for emp in employees]
            
        except Exception as e:
            logger.error(f"Error retrieving employees: {str(e)}")
            raise FynloException(f"Failed to retrieve employees: {str(e)}")

    def get_employee_by_id(
        self,
        db: Session,
        employee_id: int,
        current_user: User = None
    ) -> Optional[EmployeeResponse]:
        """Get specific employee by ID"""
        try:
            employee = db.query(EmployeeProfile).filter(
                EmployeeProfile.id == employee_id
            ).first()
            
            if not employee:
                return None
            
            # Check if user has access to this employee
            if current_user and hasattr(current_user, 'restaurant_id'):
                if employee.restaurant_id != current_user.restaurant_id:
                    raise FynloException("Access denied to this employee", status_code=403)
            
            return EmployeeResponse.from_orm(employee)
            
        except FynloException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving employee {employee_id}: {str(e)}")
            raise FynloException(f"Failed to retrieve employee: {str(e)}")

    def create_employee(
        self,
        db: Session,
        employee_data: EmployeeCreateRequest,
        current_user: User = None
    ) -> EmployeeResponse:
        """Create new employee"""
        try:
            # Verify restaurant exists
            restaurant = db.query(Restaurant).filter(
                Restaurant.id == employee_data.restaurant_id
            ).first()
            if not restaurant:
                raise ValueError("Restaurant not found")
            
            # Check if user has access to this restaurant
            if current_user and hasattr(current_user, 'restaurant_id'):
                if employee_data.restaurant_id != current_user.restaurant_id:
                    raise FynloException("Access denied to this restaurant", status_code=403)
            
            # Check if email already exists
            existing_employee = db.query(EmployeeProfile).filter(
                EmployeeProfile.email == employee_data.email
            ).first()
            if existing_employee:
                raise ValueError("Employee with this email already exists")
            
            # Create User record first
            user_data = {
                'email': employee_data.email,
                'first_name': employee_data.first_name,
                'last_name': employee_data.last_name,
                'role': 'employee',
                'is_active': employee_data.is_active,
                'password_hash': get_password_hash('temp_password_123'),  # Temporary password
                'restaurant_id': employee_data.restaurant_id
            }
            
            new_user = User(**user_data)
            db.add(new_user)
            db.flush()  # Get the user ID
            
            # Create EmployeeProfile
            employee_profile_data = {
                'user_id': new_user.id,
                'restaurant_id': employee_data.restaurant_id,
                'first_name': employee_data.first_name,
                'last_name': employee_data.last_name,
                'email': employee_data.email,
                'phone': employee_data.phone,
                'role': employee_data.role,
                'employment_status': employee_data.employment_status,
                'hourly_rate': employee_data.hourly_rate,
                'weekly_hours': employee_data.weekly_hours,
                'hire_date': employee_data.hire_date or date.today(),
                'is_active': employee_data.is_active,
                'emergency_contact_name': employee_data.emergency_contact_name,
                'emergency_contact_phone': employee_data.emergency_contact_phone,
                'notes': employee_data.notes
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

    def update_employee(
        self,
        db: Session,
        employee_id: int,
        employee_data: EmployeeUpdateRequest,
        current_user: User = None
    ) -> Optional[EmployeeResponse]:
        """Update employee information"""
        try:
            employee = db.query(EmployeeProfile).filter(
                EmployeeProfile.id == employee_id
            ).first()
            
            if not employee:
                return None
            
            # Check access
            if current_user and hasattr(current_user, 'restaurant_id'):
                if employee.restaurant_id != current_user.restaurant_id:
                    raise FynloException("Access denied to this employee", status_code=403)
            
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

    def delete_employee(
        self,
        db: Session,
        employee_id: int,
        current_user: User = None
    ) -> bool:
        """Delete employee (soft delete - marks as inactive)"""
        try:
            employee = db.query(EmployeeProfile).filter(
                EmployeeProfile.id == employee_id
            ).first()
            
            if not employee:
                return False
            
            # Check access
            if current_user and hasattr(current_user, 'restaurant_id'):
                if employee.restaurant_id != current_user.restaurant_id:
                    raise FynloException("Access denied to this employee", status_code=403)
            
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

    def get_employee_schedules(
        self,
        db: Session,
        employee_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        current_user: User = None
    ) -> List[ScheduleResponse]:
        """Get employee schedules with optional date filtering"""
        try:
            # Verify employee exists and user has access
            employee = self.get_employee_by_id(db, employee_id, current_user)
            if not employee:
                raise FynloException("Employee not found", status_code=404)
            
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
            logger.error(f"Error retrieving schedules for employee {employee_id}: {str(e)}")
            raise FynloException(f"Failed to retrieve schedules: {str(e)}")

    def create_schedule(
        self,
        db: Session,
        employee_id: int,
        schedule_data: ScheduleCreateRequest,
        current_user: User = None
    ) -> ScheduleResponse:
        """Create new schedule for employee"""
        try:
            # Verify employee exists and user has access
            employee = self.get_employee_by_id(db, employee_id, current_user)
            if not employee:
                raise FynloException("Employee not found", status_code=404)
            
            # Check for conflicts if recurring
            if schedule_data.is_recurring:
                existing = db.query(Schedule).filter(
                    and_(
                        Schedule.employee_id == employee_id,
                        Schedule.day_of_week == schedule_data.day_of_week,
                        Schedule.is_recurring == True,
                        Schedule.effective_date <= schedule_data.effective_date
                    )
                ).first()
                
                if existing:
                    raise ValueError(f"Recurring schedule already exists for this day of week")
            
            new_schedule = Schedule(
                employee_id=employee_id,
                day_of_week=schedule_data.day_of_week,
                start_time=schedule_data.start_time,
                end_time=schedule_data.end_time,
                is_recurring=schedule_data.is_recurring,
                effective_date=schedule_data.effective_date,
                notes=schedule_data.notes
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

    def clock_in(
        self,
        db: Session,
        employee_id: int,
        current_user: User = None
    ) -> ShiftResponse:
        """Clock in employee for their shift"""
        try:
            # Verify employee exists
            employee = self.get_employee_by_id(db, employee_id, current_user)
            if not employee:
                raise FynloException("Employee not found", status_code=404)
            
            # Check if already clocked in
            existing_shift = db.query(Shift).filter(
                and_(
                    Shift.employee_id == employee_id,
                    Shift.actual_start.isnot(None),
                    Shift.actual_end.is_(None)
                )
            ).first()
            
            if existing_shift:
                raise ValueError("Employee is already clocked in")
            
            # Create new shift
            now = datetime.utcnow()
            new_shift = Shift(
                employee_id=employee_id,
                scheduled_start=now,  # Will be updated based on schedule
                scheduled_end=now + timedelta(hours=8),  # Default 8-hour shift
                actual_start=now,
                status='in_progress'
            )
            
            db.add(new_shift)
            
            # Create time entry
            time_entry = TimeEntry(
                employee_id=employee_id,
                entry_type='clock_in',
                timestamp=now
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

    def clock_out(
        self,
        db: Session,
        employee_id: int,
        current_user: User = None
    ) -> ShiftResponse:
        """Clock out employee from their shift"""
        try:
            # Find active shift
            active_shift = db.query(Shift).filter(
                and_(
                    Shift.employee_id == employee_id,
                    Shift.actual_start.isnot(None),
                    Shift.actual_end.is_(None)
                )
            ).first()
            
            if not active_shift:
                raise ValueError("Employee is not currently clocked in")
            
            # Update shift
            now = datetime.utcnow()
            active_shift.actual_end = now
            active_shift.status = 'completed'
            
            # Create time entry
            time_entry = TimeEntry(
                employee_id=employee_id,
                shift_id=active_shift.id,
                entry_type='clock_out',
                timestamp=now
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

    def get_restaurant_employee_summary(
        self,
        db: Session,
        restaurant_id: int,
        current_user: User = None
    ) -> EmployeeSummary:
        """Get employee summary for restaurant dashboard"""
        try:
            # Check access
            if current_user and hasattr(current_user, 'restaurant_id'):
                if restaurant_id != current_user.restaurant_id:
                    raise FynloException("Access denied to this restaurant", status_code=403)
            
            # Get basic counts
            total_employees = db.query(EmployeeProfile).filter(
                EmployeeProfile.restaurant_id == restaurant_id
            ).count()
            
            active_employees = db.query(EmployeeProfile).filter(
                and_(
                    EmployeeProfile.restaurant_id == restaurant_id,
                    EmployeeProfile.is_active == True
                )
            ).count()
            
            # Get currently clocked in count
            clocked_in_now = db.query(Shift).join(EmployeeProfile).filter(
                and_(
                    EmployeeProfile.restaurant_id == restaurant_id,
                    Shift.actual_start.isnot(None),
                    Shift.actual_end.is_(None)
                )
            ).count()
            
            # Get roles breakdown
            roles_query = db.query(
                EmployeeProfile.role,
                func.count(EmployeeProfile.id).label('count')
            ).filter(
                and_(
                    EmployeeProfile.restaurant_id == restaurant_id,
                    EmployeeProfile.is_active == True
                )
            ).group_by(EmployeeProfile.role).all()
            
            roles_breakdown = {role: count for role, count in roles_query}
            
            # Get employment status breakdown
            status_query = db.query(
                EmployeeProfile.employment_status,
                func.count(EmployeeProfile.id).label('count')
            ).filter(
                and_(
                    EmployeeProfile.restaurant_id == restaurant_id,
                    EmployeeProfile.is_active == True
                )
            ).group_by(EmployeeProfile.employment_status).all()
            
            employment_status_breakdown = {status: count for status, count in status_query}
            
            return EmployeeSummary(
                total_employees=total_employees,
                active_employees=active_employees,
                clocked_in_now=clocked_in_now,
                scheduled_today=0,  # TODO: Calculate based on schedules
                roles_breakdown=roles_breakdown,
                employment_status_breakdown=employment_status_breakdown
            )
            
        except FynloException:
            raise
        except Exception as e:
            logger.error(f"Error getting employee summary for restaurant {restaurant_id}: {str(e)}")
            raise FynloException(f"Failed to get employee summary: {str(e)}")

    def get_weekly_schedule(
        self,
        db: Session,
        restaurant_id: int,
        week_start: Optional[date] = None,
        current_user: User = None
    ) -> WeeklyScheduleResponse:
        """Get weekly schedule for all restaurant employees"""
        try:
            # Check access
            if current_user and hasattr(current_user, 'restaurant_id'):
                if restaurant_id != current_user.restaurant_id:
                    raise FynloException("Access denied to this restaurant", status_code=403)
            
            if not week_start:
                # Default to current week (Monday as start)
                today = date.today()
                week_start = today - timedelta(days=today.weekday())
            
            week_end = week_start + timedelta(days=6)
            
            # Get all employees for the restaurant
            employees = db.query(EmployeeProfile).filter(
                and_(
                    EmployeeProfile.restaurant_id == restaurant_id,
                    EmployeeProfile.is_active == True
                )
            ).all()
            
            # Build weekly schedule
            days = []
            total_week_hours = 0.0
            
            for i in range(7):  # 7 days of the week
                current_date = week_start + timedelta(days=i)
                day_name = current_date.strftime('%A')
                
                # Get schedules for this day
                day_employees = []
                day_hours = 0.0
                
                for employee in employees:
                    schedules = db.query(Schedule).filter(
                        and_(
                            Schedule.employee_id == employee.id,
                            Schedule.day_of_week == i,  # 0=Monday
                            Schedule.effective_date <= current_date
                        )
                    ).order_by(desc(Schedule.effective_date)).first()
                    
                    if schedules:
                        # Calculate hours for this shift
                        start_datetime = datetime.combine(current_date, schedules.start_time)
                        end_datetime = datetime.combine(current_date, schedules.end_time)
                        if end_datetime <= start_datetime:
                            end_datetime += timedelta(days=1)  # Next day
                        
                        shift_hours = (end_datetime - start_datetime).total_seconds() / 3600
                        day_hours += shift_hours
                        
                        day_employees.append({
                            'employee_id': employee.id,
                            'employee_name': f"{employee.first_name} {employee.last_name}",
                            'role': employee.role,
                            'start_time': schedules.start_time.strftime('%H:%M'),
                            'end_time': schedules.end_time.strftime('%H:%M'),
                            'hours': round(shift_hours, 2)
                        })
                
                total_week_hours += day_hours
                
                days.append(WeeklyScheduleDay(
                    date=current_date,
                    day_name=day_name,
                    employees=day_employees,
                    total_scheduled_hours=round(day_hours, 2),
                    coverage_gaps=[]  # TODO: Implement gap analysis
                ))
            
            return WeeklyScheduleResponse(
                week_start=week_start,
                week_end=week_end,
                restaurant_id=restaurant_id,
                days=days,
                total_week_hours=round(total_week_hours, 2)
            )
            
        except FynloException:
            raise
        except Exception as e:
            logger.error(f"Error getting weekly schedule for restaurant {restaurant_id}: {str(e)}")
            raise FynloException(f"Failed to get weekly schedule: {str(e)}")

    def get_employee_shifts(
        self,
        db: Session,
        employee_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        current_user: User = None
    ) -> List[ShiftResponse]:
        """Get employee work shifts with optional date filtering"""
        try:
            # Verify employee exists and user has access
            employee = self.get_employee_by_id(db, employee_id, current_user)
            if not employee:
                raise FynloException("Employee not found", status_code=404)
            
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
            logger.error(f"Error retrieving shifts for employee {employee_id}: {str(e)}")
            raise FynloException(f"Failed to retrieve shifts: {str(e)}")

    def get_performance_metrics(
        self,
        db: Session,
        employee_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        current_user: User = None
    ) -> List[PerformanceMetricResponse]:
        """Get employee performance metrics"""
        try:
            # Verify employee exists and user has access
            employee = self.get_employee_by_id(db, employee_id, current_user)
            if not employee:
                raise FynloException("Employee not found", status_code=404)
            
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
            logger.error(f"Error retrieving performance metrics for employee {employee_id}: {str(e)}")
            raise FynloException(f"Failed to retrieve performance metrics: {str(e)}")

    # Additional helper methods

    def update_schedule(
        self,
        db: Session,
        schedule_id: int,
        schedule_data: ScheduleUpdateRequest,
        current_user: User = None
    ) -> Optional[ScheduleResponse]:
        """Update existing schedule"""
        try:
            schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
            if not schedule:
                return None
            
            # Check access through employee
            employee = self.get_employee_by_id(db, schedule.employee_id, current_user)
            if not employee:
                raise FynloException("Access denied", status_code=403)
            
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

    def delete_schedule(
        self,
        db: Session,
        schedule_id: int,
        current_user: User = None
    ) -> bool:
        """Delete schedule"""
        try:
            schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
            if not schedule:
                return False
            
            # Check access through employee
            employee = self.get_employee_by_id(db, schedule.employee_id, current_user)
            if not employee:
                raise FynloException("Access denied", status_code=403)
            
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