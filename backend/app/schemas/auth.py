"""
Authentication schemas for Supabase integration
<<<<<<< HEAD
=======
"""
>>>>>>> parent of af057592 (fix: docstring syntax and formatting issues across backend)


"""
from pydantic import BaseModel
from typing import Optional, List


class RegisterRestaurantRequest(BaseModel):
    """Request model for registering a new restaurant"""
    phone: Optional[str] = None
    address: Optional[str] = None


class UserInfo(BaseModel):
    """User information returned in auth responses"""
    restaurant_id: Optional[str] = None
    restaurant_name: Optional[str] = None
    subscription_plan: Optional[str] = None
    subscription_status: Optional[str] = None
    enabled_features: Optional[List[str]] = []


class AuthVerifyResponse(BaseModel):
    """Response model for auth verification"""