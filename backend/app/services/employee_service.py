from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from app.models import Employee
from app.schemas.employee import EmployeeCreate, EmployeeUpdate

def get_employee(db: Session, employee_id: int) -> Optional[Employee]:
    return db.query(Employee).filter(Employee.id == employee_id).first()

def get_employees_by_restaurant(db: Session, restaurant_id: uuid.UUID, skip: int = 0, limit: int = 100) -> List[Employee]:
    return db.query(Employee).filter(Employee.restaurant_id == restaurant_id).offset(skip).limit(limit).all()

def create_employee(db: Session, employee: EmployeeCreate) -> Employee:
    db_employee = Employee(
        name=employee.name,
        role=employee.role,
        restaurant_id=employee.restaurant_id,
        hourly_rate=employee.hourly_rate,
        status=employee.status
    )
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee

def update_employee(db: Session, employee_id: int, employee_update: EmployeeUpdate) -> Optional[Employee]:
    db_employee = get_employee(db, employee_id)
    if db_employee:
        update_data = employee_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_employee, key, value)
        db.commit()
        db.refresh(db_employee)
    return db_employee

def delete_employee(db: Session, employee_id: int) -> Optional[Employee]:
    db_employee = get_employee(db, employee_id)
    if db_employee:
        db.delete(db_employee)
        db.commit()
    return db_employee
