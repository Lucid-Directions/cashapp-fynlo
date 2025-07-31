"""
Secure version of products endpoint with proper tenant isolation
This demonstrates how to fix the vulnerability in the existing products.py
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models import User, Product, Category
from app.core.tenant_security import TenantSecurity
from app.core.exceptions import AuthorizationException, ResourceNotFoundException

router = APIRouter()


@router.put("/{product_id}")
async def update_product_secure(
    product_id: str,
    product_data: dict,  # ProductUpdate schema
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Secure version of update_product that validates restaurant access
    """
    # First, get the product to check its restaurant
    product = db.query(Product).filter(Product.id == product_id).first()
    
    if not product:
        raise ResourceNotFoundException(resource="Product")
    
    # CRITICAL SECURITY CHECK: Validate user can access this product's restaurant
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(product.restaurant_id),
        operation="modify",
        db=db
    )
    
    # If we get here, user has access (either platform owner or same restaurant)
    # Proceed with update...
    
    # Additional security: If user tries to change restaurant_id, validate that too
    if "restaurant_id" in product_data and product_data["restaurant_id"] != str(product.restaurant_id):
        # Only platform owners can move products between restaurants
        if not TenantSecurity.is_platform_owner(current_user):
            raise AuthorizationException(message="Only platform owners can move products between restaurants")
        # Validate access to target restaurant
        await TenantSecurity.validate_restaurant_access(
            user=current_user,
            restaurant_id=product_data["restaurant_id"],
            operation="create",
            db=db
        )
    
    # Update the product...
    return {"message": "Product updated securely"}


@router.delete("/{product_id}")
async def delete_product_secure(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Secure version of delete_product that validates restaurant access
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    
    if not product:
        raise ResourceNotFoundException(resource="Product")
    
    # CRITICAL: Validate access before deletion
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(product.restaurant_id),
        operation="delete",
        db=db
    )
    
    # Proceed with soft delete
    product.is_active = False
    db.commit()
    
    return {"message": "Product deleted securely"}


@router.get("/")
async def get_products_secure(
    restaurant_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Secure version of get_products with proper tenant filtering
    """
    # Start with base query
    query = db.query(Product)
    
    # Apply tenant filtering
    query = TenantSecurity.apply_tenant_filter(
        query=query,
        user=current_user,
        model_class=Product,
        db=db
    )
    
    # If restaurant_id specified, validate access
    if restaurant_id:
        await TenantSecurity.validate_restaurant_access(
            user=current_user,
            restaurant_id=restaurant_id,
            operation="view",
            db=db
        )
        query = query.filter(Product.restaurant_id == restaurant_id)
    
    # Apply other filters
    if category_id:
        query = query.filter(Product.category_id == category_id)
    
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    
    products = query.all()
    
    # Additional security: Sanitize response based on user level
    results = []
    for product in products:
        product_dict = {
            "id": str(product.id),
            "name": product.name,
            "price": float(product.price),
            "category_id": str(product.category_id),
            "restaurant_id": str(product.restaurant_id)
        }
        
        # Platform owners see cost/profit data
        if TenantSecurity.is_platform_owner(current_user):
            product_dict["cost"] = float(product.cost) if product.cost else None
            product_dict["profit_margin"] = (
                ((float(product.price) - float(product.cost)) / float(product.price) * 100)
                if product.cost else None
            )
        
        results.append(product_dict)
    
    return {
        "items": results,
        "total": len(results),
        "restaurant_filter": restaurant_id or current_user.restaurant_id
    }


@router.post("/bulk-update")
async def bulk_update_products_secure(
    updates: List[dict],  # List of product updates
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Secure bulk update that validates each product's restaurant
    """
    results = []
    errors = []
    
    for update in updates:
        product_id = update.get("id")
        if not product_id:
            errors.append({"error": "Missing product ID in update"})
            continue
        
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            errors.append({"id": product_id, "error": "Product not found"})
            continue
        
        # Validate access for each product
        try:
            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=str(product.restaurant_id),
                operation="modify",
                db=db
            )
            
            # Update product...
            results.append({"id": product_id, "status": "updated"})
            
        except FynloException as e:
            errors.append({"id": product_id, "error": str(e.detail)})
    
    db.commit()
    
    return {
        "successful": results,
        "errors": errors,
        "summary": f"{len(results)} updated, {len(errors)} failed"
    }