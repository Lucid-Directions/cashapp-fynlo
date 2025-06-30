from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.schemas.employee import Employee, EmployeeCreate, EmployeeUpdate
from app.services import employee_service
from app.core.database import get_db # Dependency to get DB session

router = APIRouter()

@router.post("/", response_model=Employee, status_code=status.HTTP_201_CREATED)
def create_new_employee(
    employee: EmployeeCreate,
    db: Session = Depends(get_db)
):
    # TODO: Add check to ensure restaurant_id from employee data exists
    # restaurant = db.query(RestaurantModel).filter(RestaurantModel.id == employee.restaurant_id).first()
    # if not restaurant:
    #     raise HTTPException(status_code=404, detail=f"Restaurant with id {employee.restaurant_id} not found")
    return employee_service.create_employee(db=db, employee=employee)

@router.get("/{restaurant_id}", response_model=List[Employee])
def read_employees_by_restaurant(
    restaurant_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    employees = employee_service.get_employees_by_restaurant(db, restaurant_id=restaurant_id, skip=skip, limit=limit)
    return employees

@router.get("/detail/{employee_id}", response_model=Employee) # Changed path to avoid conflict if restaurant_id could be int
def read_employee_details(
    employee_id: int,
    db: Session = Depends(get_db)
):
    db_employee = employee_service.get_employee(db, employee_id=employee_id)
    if db_employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return db_employee

@router.put("/{employee_id}", response_model=Employee)
def update_existing_employee(
    employee_id: int,
    employee_update: EmployeeUpdate,
    db: Session = Depends(get_db)
):
    db_employee = employee_service.update_employee(db, employee_id=employee_id, employee_update=employee_update)
    if db_employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return db_employee

@router.delete("/{employee_id}", response_model=Employee)
def delete_existing_employee(
    employee_id: int,
    db: Session = Depends(get_db)
):
    db_employee = employee_service.delete_employee(db, employee_id=employee_id)
    if db_employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    # Return the deleted employee data, or a confirmation message
    return db_employee # Or perhaps return a {"message": "Employee deleted successfully"}
