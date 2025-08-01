"""
Products and Menu Management API endpoints for Fynlo POS
<<<<<<< HEAD
=======
"""
>>>>>>> parent of af057592 (fix: docstring syntax and formatting issues across backend)


"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
import uuid
from datetime import datetime

from app.core.database import get_db, Product, Category, User
from app.core.auth import get_current_user
from app.core.redis_client import get_redis, RedisClient
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes
from app.core.tenant_security import TenantSecurity
from app.core.cache_service import cache_service

router = APIRouter()

# Pydantic models
class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#00A651"
    icon: Optional[str] = None
    sort_order: int = 0

class CategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    color: str
    icon: Optional[str]
    sort_order: int
    is_active: bool
    created_at: datetime

class ProductCreate(BaseModel):
    category_id: str
    name: str
    description: Optional[str] = None
    price: float
    cost: float = 0.0
    image_url: Optional[str] = None
    barcode: Optional[str] = None
    sku: Optional[str] = None
    prep_time: int = 0
    dietary_info: List[str] = []
    modifiers: List[dict] = []
    stock_tracking: bool = False
    stock_quantity: int = 0

class ProductUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    image_url: Optional[str] = None
    barcode: Optional[str] = None
    sku: Optional[str] = None
    prep_time: Optional[int] = None
    dietary_info: Optional[List[str]] = None
    modifiers: Optional[List[dict]] = None
    stock_tracking: Optional[bool] = None
    stock_quantity: Optional[int] = None
    is_active: Optional[bool] = None

class ProductResponse(BaseModel):
    id: str
    category_id: str
    name: str
    description: Optional[str]
    price: float
    cost: float
    image_url: Optional[str]
    barcode: Optional[str]
    sku: Optional[str]
    prep_time: int
    dietary_info: List[str]
    modifiers: List[dict]
    is_active: bool
    stock_tracking: bool
    stock_quantity: int
    created_at: datetime
    updated_at: Optional[datetime]

class MenuResponse(BaseModel):
    categories: List[CategoryResponse]
    products: List[ProductResponse]

# Category endpoints
@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Get all categories for a restaurant"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    # Check cache first
    cached_categories = await redis.get(f"categories:{restaurant_id}")
    if cached_categories:
        return APIResponseHelper.success(
            data=cached_categories,
            message=f"Retrieved {len(cached_categories)} categories"
        )
    
    categories = db.query(Category).filter(
        and_(Category.restaurant_id == restaurant_id, Category.is_active == True)
    ).order_by(Category.sort_order, Category.name).all()
    
    result = [
        CategoryResponse(
            id=str(cat.id),
            name=cat.name,
            description=cat.description,
            color=cat.color,
            icon=cat.icon,
            sort_order=cat.sort_order,
            is_active=cat.is_active,
            created_at=cat.created_at
        )
        for cat in categories
    ]
    
    # Convert to dicts for consistent API response
    response_data = [cat.model_dump() for cat in result]
    
    # Cache for 5 minutes
    await redis.set(f"categories:{restaurant_id}", response_data, expire=300)
    
    return APIResponseHelper.success(
        data=response_data,
        message=f"Retrieved {len(response_data)} categories"
    )

@router.post("/categories", response_model=CategoryResponse)
async def create_category(
    category_data: CategoryCreate,
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Create a new category"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    new_category = Category(
        restaurant_id=restaurant_id,
        name=category_data.name,
        description=category_data.description,
        color=category_data.color,
        icon=category_data.icon,
        sort_order=category_data.sort_order
    )
    
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    
    # Clear categories cache using enhanced cache service
    await cache_service.invalidate_restaurant_cache(restaurant_id)
    
    category_response = CategoryResponse(
        id=str(new_category.id),
        name=new_category.name,
        description=new_category.description,
        color=new_category.color,
        icon=new_category.icon,
        sort_order=new_category.sort_order,
        is_active=new_category.is_active,
        created_at=new_category.created_at
    )
    
    return APIResponseHelper.success(
        data=category_response.dict(),
        message=f"Category '{new_category.name}' created successfully"
    )

@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    category_data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Update a category"""
    
    # Find the category
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.restaurant_id == current_user.restaurant_id
    ).first()
    
    if not category:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Category not found"
        )
    
    # Update fields
    category.name = category_data.name
    category.description = category_data.description
    category.color = category_data.color
    category.icon = category_data.icon
    category.sort_order = category_data.sort_order
    category.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(category)
    
    # Clear categories cache using enhanced cache service
    await cache_service.invalidate_restaurant_cache(str(category.restaurant_id))
    
    category_response = CategoryResponse(
        id=str(category.id),
        name=category.name,
        description=category.description,
        color=category.color,
        icon=category.icon,
        sort_order=category.sort_order,
        is_active=category.is_active,
        created_at=category.created_at
    )
    
    return APIResponseHelper.success(
        data=category_response.dict(),
        message=f"Category '{category.name}' updated successfully"
    )

@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Delete a category (soft delete)"""
    
    # Find the category
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.restaurant_id == current_user.restaurant_id
    ).first()
    
    if not category:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Category not found"
        )
    
    # Check if category has products
    product_count = db.query(Product).filter(
        Product.category_id == category_id,
        Product.is_active == True
    ).count()
    
    if product_count > 0:
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail=f"Cannot delete category with {product_count} active products"
        )
    
    # Soft delete
    category.is_active = False
    category.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Clear categories cache using enhanced cache service
    await cache_service.invalidate_restaurant_cache(str(category.restaurant_id))
    
    return APIResponseHelper.success(
        message=f"Category '{category.name}' deleted successfully"
    )

# Product endpoints
@router.get("/", response_model=List[ProductResponse])
async def get_products(
    restaurant_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Get all products for a restaurant"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    # Check cache first
    cache_key = f"products:{restaurant_id}:{category_id or 'all'}:{active_only}"
    cached_products = await redis.get(cache_key)
    if cached_products:
        return APIResponseHelper.success(
            data=cached_products,
            message=f"Retrieved {len(cached_products)} products"
        )
    
    query = db.query(Product).filter(Product.restaurant_id == restaurant_id)
    
    if category_id:
        query = query.filter(Product.category_id == category_id)
    
    if active_only:
        query = query.filter(Product.is_active == True)
    
    products = query.order_by(Product.name).all()
    
    result = [
        ProductResponse(
            id=str(product.id),
            category_id=str(product.category_id),
            name=product.name,
            description=product.description,
            price=product.price,
            cost=product.cost,
            image_url=product.image_url,
            barcode=product.barcode,
            sku=product.sku,
            prep_time=product.prep_time,
            dietary_info=product.dietary_info,
            modifiers=product.modifiers,
            is_active=product.is_active,
            stock_tracking=product.stock_tracking,
            stock_quantity=product.stock_quantity,
            created_at=product.created_at,
            updated_at=product.updated_at
        )
        for product in products
    ]
    
    # Convert to dicts for consistent API response
    response_data = [prod.model_dump() for prod in result]
    
    # Cache for 5 minutes
    await redis.set(cache_key, response_data, expire=300)
    
    return APIResponseHelper.success(
        data=response_data,
        message=f"Retrieved {len(response_data)} products",
        meta={
            "restaurant_id": restaurant_id,
            "category_id": category_id,
            "active_only": active_only,
            "total_count": len(result)
        }
    )

@router.get("/menu", response_model=MenuResponse)
async def get_full_menu(
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Get complete menu with categories and products"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    # Check cache first
    cached_menu = await redis.get_cached_menu(restaurant_id)
    if cached_menu:
        return APIResponseHelper.success(
            data=cached_menu,
            message="Menu retrieved from cache"
        )
    
    # Get categories
    categories = db.query(Category).filter(
        and_(Category.restaurant_id == restaurant_id, Category.is_active == True)
    ).order_by(Category.sort_order, Category.name).all()
    
    # Get products
    products = db.query(Product).filter(
        and_(Product.restaurant_id == restaurant_id, Product.is_active == True)
    ).order_by(Product.name).all()
    
    result = MenuResponse(
        categories=[
            CategoryResponse(
                id=str(cat.id),
                name=cat.name,
                description=cat.description,
                color=cat.color,
                icon=cat.icon,
                sort_order=cat.sort_order,
                is_active=cat.is_active,
                created_at=cat.created_at
            )
            for cat in categories
        ],
        products=[
            ProductResponse(
                id=str(product.id),
                category_id=str(product.category_id),
                name=product.name,
                description=product.description,
                price=product.price,
                cost=product.cost,
                image_url=product.image_url,
                barcode=product.barcode,
                sku=product.sku,
                prep_time=product.prep_time,
                dietary_info=product.dietary_info,
                modifiers=product.modifiers,
                is_active=product.is_active,
                stock_tracking=product.stock_tracking,
                stock_quantity=product.stock_quantity,
                created_at=product.created_at,
                updated_at=product.updated_at
            )
            for product in products
        ]
    )
    
    # Cache for 10 minutes
    await redis.cache_menu(restaurant_id, result.dict(), expire=600)
    
    return APIResponseHelper.success(
        data=result.dict(),
        message=f"Retrieved complete menu with {len(result.categories)} categories and {len(result.products)} products",
        meta={
            "restaurant_id": restaurant_id,
            "categories_count": len(result.categories),
            "products_count": len(result.products)
        }
    )

@router.post("/", response_model=ProductResponse)
async def create_product(
    product_data: ProductCreate,
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Create a new product"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    # Verify category exists
    category = db.query(Category).filter(
        and_(Category.id == product_data.category_id, Category.restaurant_id == restaurant_id)
    ).first()
    
    if not category:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Category not found"
        )
    
    new_product = Product(
        restaurant_id=restaurant_id,
        category_id=product_data.category_id,
        name=product_data.name,
        description=product_data.description,
        price=product_data.price,
        cost=product_data.cost,
        image_url=product_data.image_url,
        barcode=product_data.barcode,
        sku=product_data.sku,
        prep_time=product_data.prep_time,
        dietary_info=product_data.dietary_info,
        modifiers=product_data.modifiers,
        stock_tracking=product_data.stock_tracking,
        stock_quantity=product_data.stock_quantity
    )
    
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    
    # Clear caches using enhanced cache service
    await cache_service.invalidate_restaurant_cache(restaurant_id)
    
    return ProductResponse(
        id=str(new_product.id),
        category_id=str(new_product.category_id),
        name=new_product.name,
        description=new_product.description,
        price=new_product.price,
        cost=new_product.cost,
        image_url=new_product.image_url,
        barcode=new_product.barcode,
        sku=new_product.sku,
        prep_time=new_product.prep_time,
        dietary_info=new_product.dietary_info,
        modifiers=new_product.modifiers,
        is_active=new_product.is_active,
        stock_tracking=new_product.stock_tracking,
        stock_quantity=new_product.stock_quantity,
        created_at=new_product.created_at,
        updated_at=new_product.updated_at
    )

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Update a product"""
    
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Product not found"
        )
    
    # Verify user has access to the product's restaurant
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(product.restaurant_id),
        operation="modify",
        resource_type="product",
        resource_id=product_id,
        db=db
    )
    
    # Update fields if provided
    if product_data.category_id is not None:
        product.category_id = product_data.category_id
    if product_data.name is not None:
        product.name = product_data.name
    if product_data.description is not None:
        product.description = product_data.description
    if product_data.price is not None:
        product.price = product_data.price
    if product_data.cost is not None:
        product.cost = product_data.cost
    if product_data.image_url is not None:
        product.image_url = product_data.image_url
    if product_data.barcode is not None:
        product.barcode = product_data.barcode
    if product_data.sku is not None:
        product.sku = product_data.sku
    if product_data.prep_time is not None:
        product.prep_time = product_data.prep_time
    if product_data.dietary_info is not None:
        product.dietary_info = product_data.dietary_info
    if product_data.modifiers is not None:
        product.modifiers = product_data.modifiers
    if product_data.stock_tracking is not None:
        product.stock_tracking = product_data.stock_tracking
    if product_data.stock_quantity is not None:
        product.stock_quantity = product_data.stock_quantity
    if product_data.is_active is not None:
        product.is_active = product_data.is_active
    
    product.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(product)
    
    # Clear caches using enhanced cache service
    restaurant_id = str(product.restaurant_id)
    await cache_service.invalidate_restaurant_cache(restaurant_id)
    
    return ProductResponse(
        id=str(product.id),
        category_id=str(product.category_id),
        name=product.name,
        description=product.description,
        price=product.price,
        cost=product.cost,
        image_url=product.image_url,
        barcode=product.barcode,
        sku=product.sku,
        prep_time=product.prep_time,
        dietary_info=product.dietary_info,
        modifiers=product.modifiers,
        is_active=product.is_active,
        stock_tracking=product.stock_tracking,
        stock_quantity=product.stock_quantity,
        created_at=product.created_at,
        updated_at=product.updated_at
    )

@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Soft delete a product"""
    
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Product not found"
        )
    
    # Verify user has access to the product's restaurant
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(product.restaurant_id),
        operation="delete",
        resource_type="product",
        resource_id=product_id,
        db=db
    )
    
    product.is_active = False
    product.updated_at = datetime.utcnow()
    db.commit()
    
    # Clear caches using enhanced cache service
    restaurant_id = str(product.restaurant_id)
    await cache_service.invalidate_restaurant_cache(restaurant_id)
    
    return APIResponseHelper.success(message="Product deleted successfully")

# Mobile-optimized endpoints
class MobileProductResponse(BaseModel):
    id: int  # Frontend expects integer ID
    name: str
    price: float
    category: str  # Category name, not ID
    image: Optional[str] = None  # Frontend expects 'image' not 'image_url'
    barcode: Optional[str] = None
    available_in_pos: bool = True  # Frontend expects this field
    active: bool  # Frontend expects 'active' not 'is_active'

@router.get("/mobile")
async def get_products_mobile(
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Get mobile-optimized products list matching frontend expectations"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    # Check cache first
    cache_key = f"products:mobile:{restaurant_id}"
    cached_products = await redis.get(cache_key)
    if cached_products:
        return APIResponseHelper.success(data=cached_products)
    
    # Get products with category info
    products_query = db.query(Product, Category).join(
        Category, Product.category_id == Category.id
    ).filter(
        and_(
            Product.restaurant_id == restaurant_id,
            Product.is_active == True,
            Category.is_active == True
        )
    ).order_by(Category.sort_order, Product.name)
    
    products_with_categories = products_query.all()
    
    result = [
        {
            "id": str(product.id),  # Keep UUID as string for consistency
            "name": product.name,
            "price": str(product.price),  # Keep as string to preserve precision
            "category": category.name,
            "image": product.image_url,
            "barcode": product.barcode,
            "available_in_pos": True,
            "active": product.is_active
        }
        for product, category in products_with_categories
    ]
    
    # Cache for 5 minutes
    await redis.set(cache_key, result, expire=300)
    
    return APIResponseHelper.success(
        data=result,
        message=f"Retrieved {len(result)} mobile products"
    )

@router.get("/category/{category_id}")
async def get_products_by_category(
    category_id: int,
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Get products by category ID - mobile compatible"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    # Check cache first
    cache_key = f"products:category:{category_id}:{restaurant_id}"
    cached_products = await redis.get(cache_key)
    if cached_products:
        return APIResponseHelper.success(data=cached_products)
    
    # Find category by ID
    category = db.query(Category).filter(
        and_(Category.id == str(category_id), Category.restaurant_id == restaurant_id)
    ).first()
    
    if not category:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Category not found"
        )
    
    # Get products in this category
    products = db.query(Product).filter(
        and_(
            Product.category_id == str(category_id),
            Product.restaurant_id == restaurant_id,
            Product.is_active == True
        )
    ).order_by(Product.name).all()
    
    result = [
        {
            "id": str(product.id),  # Keep UUID as string for consistency
            "name": product.name,
            "price": str(product.price),  # Keep as string to preserve precision
            "category": category.name,
            "image": product.image_url,
            "barcode": product.barcode,
            "available_in_pos": True,
            "active": product.is_active
        }
        for product in products
    ]
    
    # Cache for 5 minutes
    await redis.set(cache_key, result, expire=300)
    
    return APIResponseHelper.success(
        data=result,
        message=f"Retrieved {len(result)} products in category '{category.name}'"
    )

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific product"""
    
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Product not found"
        )
    
    # Verify user has access to the product's restaurant
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(product.restaurant_id),
        operation="access",
        resource_type="product",
        resource_id=product_id,
        db=db
    )
    
    return ProductResponse(
        id=str(product.id),
        category_id=str(product.category_id),
        name=product.name,
        description=product.description,
        price=product.price,
        cost=product.cost,
        image_url=product.image_url,
        barcode=product.barcode,
        sku=product.sku,
        prep_time=product.prep_time,
        dietary_info=product.dietary_info,
        modifiers=product.modifiers,
        is_active=product.is_active,
        stock_tracking=product.stock_tracking,
        stock_quantity=product.stock_quantity,
        created_at=product.created_at,
        updated_at=product.updated_at
    )