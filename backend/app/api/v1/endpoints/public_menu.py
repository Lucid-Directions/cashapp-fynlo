"""
Public Menu API endpoints for Fynlo POS
These endpoints don't require authentication to allow menu loading before login
<<<<<<< HEAD
=======
"""
>>>>>>> parent of af057592 (fix: docstring syntax and formatting issues across backend)


"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
import time
import logging

from app.core.database import get_db, Product, Category
from app.core.redis_client import get_redis, RedisClient
from app.core.responses import APIResponseHelper

router = APIRouter()
logger = logging.getLogger(__name__)

def format_menu_item(product, category_name=None):
    """Format product as menu item with required fields"""
    # Map category names to emojis
    emoji_map = {
        'Tacos': '🌮',
        'Snacks': '🌮',
        'Appetizers': '🥗',
        'Beverages': '🥤',
        'Desserts': '🍰',
        'Main Courses': '🍽️',
        'Sides': '🍟',
        'Breakfast': '🍳',
        'Salads': '🥗',
        'Soups': '🍲',
        'Drinks': '🥤',
        'Alcohol': '🍺',
        'Coffee': '☕',
        'Tea': '🍵',
    }
    
    # Get emoji based on category or use default
    emoji = emoji_map.get(category_name, '🍽️')
    
    return {
        'id': str(product.id),  # Convert UUID to string
        'name': product.name,
        'price': str(product.price),  # Convert to string for precision
        'emoji': emoji,
        'available': product.is_active if hasattr(product, 'is_active') else True,
        'category': category_name or 'Uncategorized',
        'description': product.description or '',
        'icon': 'restaurant',  # Default icon for compatibility
        'category_id': str(product.category_id) if hasattr(product, 'category_id') and product.category_id else None  # Convert UUID to string
    }

@router.get("/items")
async def get_public_menu_items(
    restaurant_id: Optional[str] = Query(None, description="Restaurant ID (optional for multi-tenant)"),
    category: Optional[str] = Query(None, description="Filter by category name"),
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis)
):
    """
    Get menu items without authentication requirement.
    This allows menu to be loaded on POS screen before login.
    """
    start_time = time.time()
    
    try:
        # Try to get from cache first
        cache_key = f"public_menu:items:{restaurant_id or 'default'}:{category or 'all'}"
        
        if redis:
            try:
                cached_data = await redis.get(cache_key)
                if cached_data:
                    logger.info(f"Returning cached public menu items for key: {cache_key}")
                    return APIResponseHelper.success(
                        data=cached_data,
                        message="Menu items retrieved from cache"
                    )
            except Exception as e:
                logger.warning(f"Redis cache error: {e}")
        
        # Build query
        query = db.query(Product).filter(Product.is_active == True)
        
        # Filter by category if provided
        if category:
            category_obj = db.query(Category).filter(
                Category.name == category,
                Category.is_active == True
            ).first()
            
            if category_obj:
                query = query.filter(Product.category_id == category_obj.id)
        
        # Get all products
        products = query.order_by(Product.category_id, Product.name).all()
        
        # Format menu items with category names
        menu_items = []
        for product in products:
            category_name = None
            if product.category_id:
                category_obj = db.query(Category).filter(Category.id == product.category_id).first()
                if category_obj:
                    category_name = category_obj.name
            
            menu_items.append(format_menu_item(product, category_name))
        
        # Cache the result
        if redis and menu_items:
            try:
                await redis.set(cache_key, menu_items, expire=300)  # 5 minute cache
            except Exception as e:
                logger.warning(f"Failed to cache public menu items: {e}")
        
        elapsed_time = time.time() - start_time
        logger.info(f"Public menu items retrieved in {elapsed_time:.3f}s - {len(menu_items)} items")
        
        return APIResponseHelper.success(
            data=menu_items,
            message=f"Successfully retrieved {len(menu_items)} menu items"
        )
        
    except Exception as e:
        logger.error(f"Error retrieving public menu items: {str(e)}")
        return APIResponseHelper.error(
            message="Failed to retrieve menu items",
            status_code=500
        )

@router.get("/categories")
async def get_public_menu_categories(
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis)
):
    """
    Get menu categories without authentication requirement.
    This allows menu categories to be loaded on POS screen before login.
    """
    start_time = time.time()
    
    try:
        # Try to get from cache first
        cache_key = f"public_menu:categories:{restaurant_id or 'default'}"
        
        if redis:
            try:
                cached_data = await redis.get(cache_key)
                if cached_data:
                    logger.info(f"Returning cached public menu categories")
                    return APIResponseHelper.success(
                        data=cached_data,
                        message="Menu categories retrieved from cache"
                    )
            except Exception as e:
                logger.warning(f"Redis cache error: {e}")
        
        # Get all active categories
        categories = db.query(Category).filter(
            Category.is_active == True
        ).order_by(Category.sort_order, Category.name).all()
        
        # Format categories
        category_list = []
        for cat in categories:
            # Count products in category
            product_count = db.query(Product).filter(
                Product.category_id == cat.id,
                Product.is_active == True
            ).count()
            
            category_list.append({
                'id': str(cat.id),  # Convert UUID to string
                'name': cat.name,
                'description': cat.description,
                'active': cat.is_active,
                'product_count': product_count
            })
        
        # Cache the result
        if redis and category_list:
            try:
                await redis.set(cache_key, category_list, expire=300)  # 5 minute cache
            except Exception as e:
                logger.warning(f"Failed to cache public menu categories: {e}")
        
        elapsed_time = time.time() - start_time
        logger.info(f"Public menu categories retrieved in {elapsed_time:.3f}s - {len(category_list)} categories")
        
        return APIResponseHelper.success(
            data=category_list,
            message=f"Successfully retrieved {len(category_list)} menu categories"
        )
        
    except Exception as e:
        logger.error(f"Error retrieving public menu categories: {str(e)}")
        return APIResponseHelper.error(
            message="Failed to retrieve menu categories",
            status_code=500
        )