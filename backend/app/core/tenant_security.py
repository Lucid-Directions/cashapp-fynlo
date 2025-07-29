"""
Tenant Security Module for Fynlo POS
Ensures proper multi-tenant isolation while maintaining platform owner access

Platform Owners (Ryan and Arnaud) have FULL access to everything.
All other users are restricted to their own restaurant's data.
"""

from typing import Optional, Union
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, Query
from app.models import User, Restaurant

# Platform owner emails - ONLY these users have full access
PLATFORM_OWNER_EMAILS = [
    "ryan@fynlo.com",
    "arnaud@fynlo.com",
    "ryand2626@gmail.com",  # Ryan's alternate email if used
    "arno@fynlo.com",       # Arnaud's alternate email if used
]


class TenantSecurity:
    """Handles multi-tenant data isolation and access control"""
    
    @staticmethod
    def is_platform_owner(user: User) -> bool:
        """
        Check if user is a platform owner (Ryan or Arnaud)
        Platform owners have full access to all data
        """
        if not user:
            return False
            
        # Check by role AND email for extra security
        is_owner_role = user.role == "platform_owner"
        is_owner_email = user.email.lower() in [email.lower() for email in PLATFORM_OWNER_EMAILS]
        
        # Both conditions must be true for platform owner access
        return is_owner_role and is_owner_email
    
    @staticmethod
    def validate_restaurant_access(
        user: User,
        restaurant_id: str,
        operation: str = "access"
    ) -> None:
        """
        Validate if user can access a specific restaurant's data
        
        Args:
            user: Current user
            restaurant_id: Restaurant ID to access
            operation: Type of operation (access, modify, delete)
            
        Raises:
            HTTPException: If access is denied
        """
        # Platform owners (Ryan and Arnaud) can access everything
        if TenantSecurity.is_platform_owner(user):
            return  # Full access granted
        
        # All other users can only access their own restaurant
        if not user.restaurant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: User has no restaurant assigned"
            )
        
        if str(user.restaurant_id) != str(restaurant_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You can only {operation} data from your own restaurant"
            )
    
    @staticmethod
    def apply_tenant_filter(
        query: Query,
        user: User,
        model_class: type,
        restaurant_field: str = "restaurant_id"
    ) -> Query:
        """
        Apply tenant filtering to a SQLAlchemy query
        
        Args:
            query: Base query
            user: Current user
            model_class: Model class being queried
            restaurant_field: Field name for restaurant_id (default: "restaurant_id")
            
        Returns:
            Filtered query
        """
        # Platform owners see everything
        if TenantSecurity.is_platform_owner(user):
            return query
        
        # All other users only see their restaurant's data
        if not user.restaurant_id:
            # Return empty result for users without restaurant
            return query.filter(False)
        
        # Filter by user's restaurant
        filter_field = getattr(model_class, restaurant_field)
        return query.filter(filter_field == user.restaurant_id)
    
    @staticmethod
    def get_accessible_restaurant_ids(user: User) -> list[str]:
        """
        Get list of restaurant IDs accessible by user
        
        Returns:
            List of restaurant IDs user can access
        """
        # Platform owners can access all restaurants
        if TenantSecurity.is_platform_owner(user):
            return []  # Empty list means "all restaurants"
        
        # Other users can only access their own restaurant
        if user.restaurant_id:
            return [str(user.restaurant_id)]
        
        return []  # No access
    
    @staticmethod
    def validate_cross_restaurant_operation(
        user: User,
        source_restaurant_id: str,
        target_restaurant_id: str,
        operation: str = "transfer"
    ) -> None:
        """
        Validate operations that involve multiple restaurants
        
        Args:
            user: Current user
            source_restaurant_id: Source restaurant
            target_restaurant_id: Target restaurant
            operation: Type of operation
            
        Raises:
            HTTPException: If operation is not allowed
        """
        # Only platform owners can perform cross-restaurant operations
        if not TenantSecurity.is_platform_owner(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Only platform owners can {operation} data between restaurants"
            )
    
    @staticmethod
    def sanitize_response_data(data: dict, user: User) -> dict:
        """
        Remove sensitive data based on user's access level
        
        Args:
            data: Response data
            user: Current user
            
        Returns:
            Sanitized data
        """
        # Platform owners see everything
        if TenantSecurity.is_platform_owner(user):
            return data
        
        # Remove platform-level sensitive data for non-platform owners
        sensitive_fields = [
            "platform_commission",
            "platform_fee",
            "total_platform_revenue",
            "other_restaurant_data"
        ]
        
        for field in sensitive_fields:
            data.pop(field, None)
        
        return data