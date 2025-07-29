"""
Security Dependencies for FastAPI
Reusable dependencies that enforce tenant isolation
"""

from typing import Optional, Any
from fastapi import Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.tenant_security import TenantSecurity
from app.core.rls_context import RLSContext
from app.models import User


async def get_current_user_with_tenant_validation(
    restaurant_id: Optional[str] = Query(None, description="Restaurant ID to access"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency that validates tenant access based on restaurant_id parameter
    
    Usage:
        @router.get("/endpoint")
        async def endpoint(
            current_user: User = Depends(get_current_user_with_tenant_validation)
        ):
            # User is guaranteed to have access to the requested restaurant
    """
    if restaurant_id:
        # Validate access to specified restaurant
        TenantSecurity.validate_restaurant_access(
            user=current_user,
            restaurant_id=restaurant_id,
            operation="access"
        )
    elif not TenantSecurity.is_platform_owner(current_user) and not current_user.restaurant_id:
        # Non-platform owners must have a restaurant
        raise HTTPException(
            status_code=403,
            detail="User has no restaurant assigned"
        )
    
    # Set RLS context for the database session
    RLSContext.get_db_with_context(db, current_user)
    
    return current_user


async def validate_resource_access(
    resource_model: Any,
    resource_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Generic dependency to validate access to any resource
    
    Usage:
        @router.put("/products/{product_id}")
        async def update_product(
            product: Product = Depends(
                lambda product_id: validate_resource_access(Product, product_id)
            )
        ):
            # Product is guaranteed to belong to user's restaurant
    """
    # Query the resource
    resource = db.query(resource_model).filter(
        resource_model.id == resource_id
    ).first()
    
    if not resource:
        raise HTTPException(
            status_code=404,
            detail=f"{resource_model.__name__} not found"
        )
    
    # Validate restaurant access if resource has restaurant_id
    if hasattr(resource, 'restaurant_id'):
        TenantSecurity.validate_restaurant_access(
            user=current_user,
            restaurant_id=str(resource.restaurant_id),
            operation="access"
        )
    
    return resource


class TenantFilter:
    """
    Dependency class for automatic tenant filtering
    
    Usage:
        @router.get("/orders")
        async def get_orders(
            filters: dict = Depends(TenantFilter())
        ):
            # filters will include restaurant_id based on user access
    """
    
    def __init__(self, allow_restaurant_override: bool = False):
        self.allow_restaurant_override = allow_restaurant_override
    
    async def __call__(
        self,
        restaurant_id: Optional[str] = Query(None),
        current_user: User = Depends(get_current_user)
    ) -> dict:
        """
        Returns filter dictionary with proper restaurant_id
        """
        filters = {}
        
        if TenantSecurity.is_platform_owner(current_user):
            # Platform owners can specify any restaurant or see all
            if restaurant_id:
                filters["restaurant_id"] = restaurant_id
            # If no restaurant specified, no filter (see all)
        else:
            # Regular users can only see their restaurant
            if restaurant_id and str(restaurant_id) != str(current_user.restaurant_id):
                raise HTTPException(
                    status_code=403,
                    detail="You can only access your own restaurant's data"
                )
            filters["restaurant_id"] = str(current_user.restaurant_id)
        
        return filters


class SecureQuery:
    """
    Dependency that returns a pre-filtered query based on tenant access
    
    Usage:
        @router.get("/products")
        async def get_products(
            query = Depends(SecureQuery(Product))
        ):
            # query is already filtered by restaurant_id
    """
    
    def __init__(self, model_class: Any):
        self.model_class = model_class
    
    async def __call__(
        self,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        """
        Returns a query filtered by tenant access
        """
        query = db.query(self.model_class)
        
        # Apply tenant filtering
        query = TenantSecurity.apply_tenant_filter(
            query=query,
            user=current_user,
            model_class=self.model_class
        )
        
        return query


async def platform_owner_required(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency that ensures only platform owners (Ryan & Arnaud) can access
    
    Usage:
        @router.post("/platform/settings")
        async def update_platform_settings(
            current_user: User = Depends(platform_owner_required)
        ):
            # Only Ryan and Arnaud can access this
    """
    if not TenantSecurity.is_platform_owner(current_user):
        raise HTTPException(
            status_code=403,
            detail="This endpoint is restricted to platform owners only"
        )
    
    return current_user


async def get_db_with_rls(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Session:
    """
    Get database session with RLS context already set
    
    Usage:
        @router.get("/orders")
        async def get_orders(
            db: Session = Depends(get_db_with_rls)
        ):
            # All queries will be automatically filtered by RLS
    """
    return RLSContext.get_db_with_context(db, current_user)