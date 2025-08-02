"""
Tenant Security Module for Fynlo POS
Ensures proper multi-tenant isolation while maintaining platform owner access

Platform Owners (Ryan and Arnaud) have FULL access to everything.
All other users are restricted to their own restaurant's data.
"""

from typing import Optional, Union, List
from fastapi import status, Request
from sqlalchemy.orm import Session, Query
from sqlalchemy import func
from app.models import User, UserRestaurant
from app.core.security_monitor import security_monitor, SecurityEventType
from app.core.config import settings
from app.core.validators import validate_uuid_format
from app.core.exceptions import FynloException, ValidationException, AuthorizationException

class TenantSecurity:
    """Handles multi-tenant data isolation and access control"""
    
    pass

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
        is_owner_email = user.email.lower() in settings.platform_owner_emails_list
        
        # Both conditions must be true for platform owner access
        return is_owner_role and is_owner_email
    
    @staticmethod
    async def validate_restaurant_access(
        user: User,
        restaurant_id: str,
        operation: str = "access",
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        request: Optional[Request] = None,
        db: Optional[Session] = None
    ) -> None:
        """
        Validate if user can access a specific restaurant's data
        
        Args:
            user: Current user
            restaurant_id: Restaurant ID to access
            operation: Type of operation (access, modify, delete)
            db: Database session (required for multi-restaurant check)
            
        Raises:
            FynloException: If access is denied
        """
        # Validate restaurant_id format to prevent SQL injection
        try:
            validate_uuid_format(str(restaurant_id))
        except ValueError:
            raise ValidationException(message="Invalid restaurant ID format")
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
        
        # Check if user has access to this restaurant (multi-restaurant support)
        has_access = False        
        # First check legacy single restaurant assignment
        if user.restaurant_id and str(user.restaurant_id) == str(restaurant_id):
            has_access = True
        
        # Then check multi-restaurant access for restaurant owners
        elif db and user.role == "restaurant_owner":
            # Check if user has access through user_restaurants table
            user_restaurant = db.query(UserRestaurant).filter(
                UserRestaurant.user_id == user.id,
                UserRestaurant.restaurant_id == restaurant_id
            ).first()
            
            if user_restaurant:
                has_access = True
                # Update current restaurant context if different
                if user.current_restaurant_id != restaurant_id:
                    try:
                        user.current_restaurant_id = restaurant_id
                        user.last_restaurant_switch = func.now()
                        db.commit()
                    except Exception as e:
                        db.rollback()
                        # Log the error but don't fail the access check
                        await security_monitor.log_event(
                            user=user,
                            event_type=SecurityEventType.ERROR,
                            details={
                                "error": "Failed to update current restaurant context",
                                "restaurant_id": restaurant_id,
                                "exception": str(e)
                            }
                        )
        
        if not has_access:
            # Log access denial
            reason = "User has no access to this restaurant"
            if not user.restaurant_id and (not db or user.role != "restaurant_owner"):
                reason = "User has no restaurant assigned"
            
            await security_monitor.log_access_attempt(
                user=user,
                resource_type=resource_type or "restaurant",
                resource_id=restaurant_id,
                action=operation,
                granted=False,
                ip_address=client_ip or "unknown",
                reason=reason
            )
            raise AuthorizationException(message=f"Access denied: You don't have permission to {operation} data from this restaurant")
            
    
    @staticmethod
    def apply_tenant_filter(
        query: Query,
        user: User,
        model_class: type,
        restaurant_field: str = "restaurant_id",
        db: Optional[Session] = None
    ) -> Query:
        """Execute apply_tenant_filter operation."""
        """
        Apply tenant filtering to a SQLAlchemy query
        
        Args:
            query: Base query
            user: Current user
            model_class: Model class being queried
            restaurant_field: Field name for restaurant_id (default: "restaurant_id")
            db: Database session (required for multi-restaurant filtering)
            
        Returns:
            Filtered query
        """
        # Platform owners see everything
        if TenantSecurity.is_platform_owner(user):
            return query
        
        # Get accessible restaurant IDs
        accessible_restaurants = TenantSecurity.get_accessible_restaurant_ids(user, db)
        
        if not accessible_restaurants:
            # Return empty result for users without restaurant access
            return query.filter(False)
        
        # Filter by accessible restaurants
        filter_field = getattr(model_class, restaurant_field)
        
        # If only one restaurant, use simple equality
        if len(accessible_restaurants) == 1:
            return query.filter(filter_field == accessible_restaurants[0])
        
        # Multiple restaurants - use IN clause
        return query.filter(filter_field.in_(accessible_restaurants))
    
    @staticmethod
    def get_accessible_restaurant_ids(user: User, db: Optional[Session] = None) -> List[str]:
        """
        Get list of restaurant IDs accessible by user
        
        Returns:
            List of restaurant IDs user can access
        """
        # Platform owners can access all restaurants
        if TenantSecurity.is_platform_owner(user):
            return []  # Empty list means "all restaurants"
        
        # Use a set for efficient deduplication
        accessible_restaurants = set()
        
        # For restaurant owners, check user_restaurants table
        if db and user.role == "restaurant_owner":
            # Get all restaurants from user_restaurants table
            user_restaurants = db.query(UserRestaurant).filter(
                UserRestaurant.user_id == user.id
            ).all()
            
            for ur in user_restaurants:
                accessible_restaurants.add(str(ur.restaurant_id))
        
        # For non-restaurant owners, only add legacy restaurant_id if it exists
        # This ensures that if a restaurant owner's access is revoked via user_restaurants,
        # they don't retain access through the legacy field
        elif user.restaurant_id:
            accessible_restaurants.add(str(user.restaurant_id))
        
        return list(accessible_restaurants)
    
    @staticmethod
    def validate_cross_restaurant_operation(
        user: User,
        source_restaurant_id: str,
        target_restaurant_id: str,
        operation: str = "transfer"
    ) -> None:
        """Execute validate_cross_restaurant_operation operation."""
        """
        Validate operations that involve multiple restaurants
        
        Args:
            user: Current user
            source_restaurant_id: Source restaurant
            target_restaurant_id: Target restaurant
            operation: Type of operation
            
        Raises:
            FynloException: If operation is not allowed
        """
        # Only platform owners can perform cross-restaurant operations
        if not TenantSecurity.is_platform_owner(user):
            raise AuthorizationException(message=f"Access denied: Only platform owners can {operation} data between restaurants")
            
    
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