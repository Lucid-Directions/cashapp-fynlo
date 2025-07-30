"""
Secure version of products endpoint with proper tenant isolation
This demonstrates how to fix the vulnerability in the existing products.py
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models import User, Product, Category
from app.core.tenant_security import TenantSecurity
from app.core.exceptions import AuthorizationException, ErrorCodes, FynloException
from app.core.exceptions import ResourceNotFoundException
router = APIRouter()

@router.put('/{product_id}')
async def update_product_secure(product_id: str, product_data: dict, db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """
    Secure version of update_product that validates restaurant access
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ResourceNotFoundException(message='Product not found', error_code='NOT_FOUND', resource_type='product')
    TenantSecurity.validate_restaurant_access(user=current_user, restaurant_id=str(product.restaurant_id), operation='modify')
    if 'restaurant_id' in product_data and product_data['restaurant_id'] != str(product.restaurant_id):
        if not TenantSecurity.is_platform_owner(current_user):
            raise AuthorizationException(message="Only platform owners can move products between restaurants")
        TenantSecurity.validate_restaurant_access(user=current_user, restaurant_id=product_data['restaurant_id'], operation='create')
    return {'message': 'Product updated securely'}

@router.delete('/{product_id}')
async def delete_product_secure(product_id: str, db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """
    Secure version of delete_product that validates restaurant access
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ResourceNotFoundException(message='Product not found', error_code='NOT_FOUND', resource_type='product')
    TenantSecurity.validate_restaurant_access(user=current_user, restaurant_id=str(product.restaurant_id), operation='delete')
    product.is_active = False
    db.commit()
    return {'message': 'Product deleted securely'}

@router.get('/')
async def get_products_secure(restaurant_id: Optional[str]=Query(None), category_id: Optional[str]=Query(None), is_active: Optional[bool]=Query(True), db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """
    Secure version of get_products with proper tenant filtering
    """
    query = db.query(Product)
    query = TenantSecurity.apply_tenant_filter(query=query, user=current_user, model_class=Product)
    if restaurant_id:
        TenantSecurity.validate_restaurant_access(user=current_user, restaurant_id=restaurant_id, operation='view')
        query = query.filter(Product.restaurant_id == restaurant_id)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    products = query.all()
    results = []
    for product in products:
        product_dict = {'id': str(product.id), 'name': product.name, 'price': float(product.price), 'category_id': str(product.category_id), 'restaurant_id': str(product.restaurant_id)}
        if TenantSecurity.is_platform_owner(current_user):
            product_dict['cost'] = float(product.cost) if product.cost else None
            product_dict['profit_margin'] = (float(product.price) - float(product.cost)) / float(product.price) * 100 if product.cost else None
        results.append(product_dict)
    return {'items': results, 'total': len(results), 'restaurant_filter': restaurant_id or current_user.restaurant_id}

@router.post('/bulk-update')
async def bulk_update_products_secure(updates: List[dict], db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """
    Secure bulk update that validates each product's restaurant
    """
    results = []
    errors = []
    for update in updates:
        product_id = update.get('id')
        if not product_id:
            errors.append({'error': 'Missing product ID in update'})
            continue
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            errors.append({'id': product_id, 'error': 'Product not found'})
            continue
        try:
            TenantSecurity.validate_restaurant_access(user=current_user, restaurant_id=str(product.restaurant_id), operation='modify')
            results.append({'id': product_id, 'status': 'updated'})
        except HTTPException as e:
            errors.append({'id': product_id, 'error': str(e.detail)})
    db.commit()
    return {'successful': results, 'errors': errors, 'summary': f'{len(results)} updated, {len(errors)} failed'}