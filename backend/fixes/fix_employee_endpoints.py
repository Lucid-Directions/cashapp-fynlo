"""
Employee Endpoints Fix for Backend
Resolves 403 Forbidden errors on employee management endpoints

This fix addresses:
1. Restaurant context extraction from multiple sources
2. Proper RBAC validation
3. Multi-tenant isolation
4. Clear error messages
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.session import get_db
from app.models.user import User
from app.models.employee import Employee
from app.models.restaurant import Restaurant
from app.core.auth import get_current_active_user
from app.core.response_helper import APIResponseHelper
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from app.core.rbac import check_permission
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# Response wrapper model to match APIResponseHelper structure
class APIResponse(BaseModel):
    success: bool
    data: Any
    message: Optional[str] = None
    error: Optional[str] = None
    

def get_restaurant_context(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> int:
    """
    Extract restaurant context from request
    Tries multiple sources in order of preference
    """
    restaurant_id = None
    
    # 1. Try from header (explicit)
    restaurant_id = request.headers.get("X-Restaurant-Id")
    
    # 2. Try from user's default restaurant
    if not restaurant_id and current_user:
        if current_user.role == "restaurant_owner":
            # Get owner's restaurant
            restaurant = db.query(Restaurant).filter(
                Restaurant.owner_id == current_user.id
            ).first()
            if restaurant:
                restaurant_id = restaurant.id
        elif current_user.role in ["manager", "employee"]:
            # Get employee's restaurant
            employee = db.query(Employee).filter(
                Employee.user_id == current_user.id,
                Employee.is_active.is_(True)
            ).first()
            if employee:
                restaurant_id = employee.restaurant_id
    
    # 3. Try from URL path
    if not restaurant_id:
        path_parts = request.url.path.split("/")
        if "restaurants" in path_parts:
            idx = path_parts.index("restaurants")
            if idx + 1 < len(path_parts):
                try:
                    restaurant_id = int(path_parts[idx + 1])
                except ValueError:
                    pass
    
    if not restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Restaurant context required. Please provide X-Restaurant-Id header"
        )
    
    # Validate user has access to this restaurant
    if not validate_restaurant_access(current_user, int(restaurant_id), db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You don't have access to restaurant {restaurant_id}"
        )
    
    return int(restaurant_id)


def validate_restaurant_access(
    user: User,
    restaurant_id: int,
    db: Session
) -> bool:
    """Validate user has access to the restaurant"""
    # Platform owners have access to all
    if user.role == "platform_owner":
        return True
    
    # Check restaurant exists
    restaurant = db.query(Restaurant).filter(
        Restaurant.id == restaurant_id
    ).first()
    
    if not restaurant:
        return False
    
    # Restaurant owners have access to their restaurants
    if user.role == "restaurant_owner" and restaurant.owner_id == user.id:
        return True
    
    # Managers and employees must belong to the restaurant
    if user.role in ["manager", "employee"]:
        employee = db.query(Employee).filter(
            Employee.user_id == user.id,
            Employee.restaurant_id == restaurant_id,
            Employee.is_active.is_(True)
        ).first()
        return employee is not None
    
    return False


@router.get("/employees/", response_model=APIResponse)
async def get_employees(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    restaurant_id: int = Depends(get_restaurant_context),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all employees for a restaurant
    Requires: restaurant_owner, manager, or platform_owner role
    """
    try:
        # Check permission
        if not check_permission(current_user, "employees", "read"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view employees"
            )
        
        # Get employees
        employees = db.query(Employee).filter(
            Employee.restaurant_id == restaurant_id,
            Employee.is_active.is_(True)
        ).offset(skip).limit(limit).all()
        
        # Convert to response format
        employee_list = []
        for emp in employees:
            user = db.query(User).filter(User.id == emp.user_id).first()
            if user:
                employee_list.append({
                    "id": emp.id,
                    "user_id": emp.user_id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "role": emp.role,
                    "restaurant_id": emp.restaurant_id,
                    "is_active": emp.is_active,
                    "created_at": emp.created_at,
                    "permissions": emp.permissions or {}
                })
        
        return APIResponseHelper.success(
            data=employee_list,
            message=f"Found {len(employee_list)} employees"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching employees: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch employees"
        )


@router.post("/employees/", response_model=APIResponse)
async def create_employee(
    request: Request,
    employee_data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    restaurant_id: int = Depends(get_restaurant_context)
):
    """
    Create a new employee
    Requires: restaurant_owner or manager role
    """
    try:
        # Check permission
        if not check_permission(current_user, "employees", "create"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to create employees"
            )
        
        # Check if user already exists
        existing_user = db.query(User).filter(
            User.email == employee_data.email
        ).first()
        
        if existing_user:
            # Check if already an employee at this restaurant
            existing_employee = db.query(Employee).filter(
                Employee.user_id == existing_user.id,
                Employee.restaurant_id == restaurant_id
            ).first()
            
            if existing_employee:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is already an employee at this restaurant"
                )
            
            # Add existing user as employee
            user = existing_user
        else:
            # Create new user
            from app.core.security import get_password_hash
            
            user = User(
                email=employee_data.email,
                full_name=employee_data.full_name,
                hashed_password=get_password_hash(employee_data.password),
                role=employee_data.role,
                is_active=True
            )
            db.add(user)
            db.flush()
        
        # Create employee record
        employee = Employee(
            user_id=user.id,
            restaurant_id=restaurant_id,
            role=employee_data.role,
            permissions=employee_data.permissions or {},
            is_active=True
        )
        db.add(employee)
        db.commit()
        
        return APIResponseHelper.success(
            data={
                "id": employee.id,
                "user_id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": employee.role,
                "restaurant_id": restaurant_id,
                "is_active": employee.is_active,
                "created_at": employee.created_at,
                "permissions": employee.permissions
            },
            message="Employee created successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating employee: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create employee"
        )


@router.put("/employees/{employee_id}", response_model=APIResponse)
async def update_employee(
    request: Request,
    employee_id: int,
    employee_data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    restaurant_id: int = Depends(get_restaurant_context)
):
    """
    Update an employee
    Requires: restaurant_owner or manager role
    """
    try:
        # Check permission
        if not check_permission(current_user, "employees", "update"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update employees"
            )
        
        # Get employee
        employee = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.restaurant_id == restaurant_id
        ).first()
        
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        # Update employee fields
        if employee_data.role is not None:
            employee.role = employee_data.role
        if employee_data.permissions is not None:
            employee.permissions = employee_data.permissions
        if employee_data.is_active is not None:
            employee.is_active = employee_data.is_active
        
        # Update user fields if provided
        user = db.query(User).filter(User.id == employee.user_id).first()
        if user:
            if employee_data.full_name is not None:
                user.full_name = employee_data.full_name
            if employee_data.role is not None:
                user.role = employee_data.role
        
        db.commit()
        
        return APIResponseHelper.success(
            data={
                "id": employee.id,
                "user_id": employee.user_id,
                "email": user.email if user else None,
                "full_name": user.full_name if user else None,
                "role": employee.role,
                "restaurant_id": restaurant_id,
                "is_active": employee.is_active,
                "created_at": employee.created_at,
                "permissions": employee.permissions
            },
            message="Employee updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating employee: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update employee"
        )


@router.delete("/employees/{employee_id}")
async def delete_employee(
    request: Request,
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    restaurant_id: int = Depends(get_restaurant_context)
):
    """
    Delete (deactivate) an employee
    Requires: restaurant_owner role
    """
    try:
        # Check permission - only owners can delete
        if (current_user.role != "restaurant_owner" and 
            current_user.role != "platform_owner"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only restaurant owners can delete employees"
            )
        
        # Get employee
        employee = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.restaurant_id == restaurant_id
        ).first()
        
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        # Soft delete (deactivate)
        employee.is_active = False
        db.commit()
        
        return APIResponseHelper.success(
            data={"id": employee_id},
            message="Employee deactivated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting employee: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete employee"
        )


# Usage instructions:
"""
Replace the existing employee endpoints in app/api/v1/endpoints/employees.py
with this fixed version. The key improvements are:

1. Proper restaurant context extraction from multiple sources
2. RBAC validation with clear permission checks
3. Multi-tenant isolation ensuring data security
4. Better error messages for debugging
5. Support for both headers and token-based context
"""