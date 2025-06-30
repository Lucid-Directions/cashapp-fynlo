from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..core.database import Base, Restaurant # Import Restaurant from core.database

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True) # Consider using UUID to align with other models
    name = Column(String, index=True)
    role = Column(String)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id")) # Match UUID type
    hourly_rate = Column(Float)
    status = Column(String)  # e.g., "active", "inactive"

    restaurant = relationship("Restaurant", back_populates="employees")

# Add the employees relationship to the Restaurant model in core.database
# This needs to be done manually or by modifying Restaurant model directly
# For now, assume Restaurant model in core.database will be updated to include:
# employees = relationship("Employee", back_populates="restaurant")
