from pydantic import BaseModel
from typing import Optional
import uuid

class EmployeeBase(BaseModel):
    name: str
    role: str
    hourly_rate: float
    status: str = "active"
    restaurant_id: uuid.UUID

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    hourly_rate: Optional[float] = None
    status: Optional[str] = None

class Employee(EmployeeBase):
    id: int

    class Config:
        orm_mode = True
