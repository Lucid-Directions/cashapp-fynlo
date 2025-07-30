"""
Tenant Security Module for Fynlo POS
Ensures proper multi-tenant isolation while maintaining platform owner access

Platform Owners (Ryan and Arnaud) have FULL access to everything.
All other users are restricted to their own restaurant's data.
"""

from typing import Optional, Union
from fastapi import Request
from sqlalchemy.orm import Session, Query
from app.models import User, Restaurant
from app.core.security_monitor import security_monitor, SecurityEventType
from app.core.exceptions import AuthenticationException, FynloException

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
    async def validate_restaurant_access(
        user: User,
        restaurant_id: str,
        operation: str = "access",
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        request: Optional[Request] = None
    ) -> None:
        """
        Validate if user can access a specific restaurant's data
        
        Args:
            user: Current user
            restaurant_id: Restaurant ID to access
            operation: Type of operation (access, modify, delete)
            
        Raises:
            AuthenticationException: If access is denied
        """
        # Get client IP for logging
        client_ip = None
        if request:
            client_ip = request.client.host if request.client else "unknown"
        
        # Platform owners (Ryan and Arnaud) can access everything
        if TenantSecurity.is_platform_owner(user):
            # Log platform owner access for audit trail
            await security_monitor.log_platform_owner_access(
                user=user,
                target_restaurant_id=restaurant_id,
                action=operation,
                resource_type=resource_type,
                details={"resource_id": resource_id} if resource_id else None
            )
            return  # Full access granted
        
        # All other users can only access their own restaurant
        if not user.restaurant_id:
            # Log access denial
            await security_monitor.log_access_attempt(
                user=user,
                resource_type=resource_type or "restaurant",
                resource_id=restaurant_id,
                action=operation,
                granted=False,
                ip_address=client_ip or "unknown",
                reason="User has no restaurant assigned"
            )
            raise AuthenticationException(message='Access denied', error_code='ACCESS_DENIED')
        
        if str(user.restaurant_id) != str(restaurant_id):
            # Log cross-tenant access attempt
            await security_monitor.log_access_attempt(
                user=user,
                resource_type=resource_type or "restaurant",
                resource_id=restaurant_id,
                action=operation,
                granted=False,
                ip_address=client_ip or "unknown",
                reason=f"Cross-tenant access attempt from restaurant {user.restaurant_id} to {restaurant_id}"
            )
            raise AuthenticationException(message='Access denied', error_code='ACCESS_DENIED')
    
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
            AuthenticationException: If operation is not allowed
        """
        # Only platform owners can perform cross-restaurant operations
        if not TenantSecurity.is_platform_owner(user):
            raise AuthenticationException(message='Access denied', error_code='ACCESS_DENIED')
    
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