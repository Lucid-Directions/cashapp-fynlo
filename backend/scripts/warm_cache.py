#!/usr/bin/env python3
"""
Cache Warming Script for Production Deployment
Preloads critical data into cache to improve initial performance
"""

import asyncio
import sys
from pathlib import Path
from typing import List, Dict

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.logger import logger
from app.services.cache_manager import cache_manager
from app.models import Restaurant, Product, Category, User


async def warm_restaurant_caches(db: Session) -> Dict[str, int]:
    """Warm cache for all active restaurants"""
    stats = {"restaurants": 0, "menus": 0, "settings": 0, "errors": 0}
    
    try:
        # Get all active restaurants
        restaurants = db.query(Restaurant).filter(
            Restaurant.is_active == True
        ).all()
        
        logger.info(f"Found {len(restaurants)} active restaurants to cache")
        
        for restaurant in restaurants:
            try:
                restaurant_id = str(restaurant.id)
                logger.info(f"Warming cache for restaurant: {restaurant.name} ({restaurant_id})")
                
                # Warm all caches for this restaurant
                await cache_manager.warm_cache(restaurant_id)
                
                stats["restaurants"] += 1
                stats["menus"] += 1
                stats["settings"] += 1
                
            except Exception as e:
                logger.error(f"Failed to warm cache for restaurant {restaurant_id}: {e}")
                stats["errors"] += 1
                
    except Exception as e:
        logger.error(f"Failed to query restaurants: {e}")
        stats["errors"] += 1
    
    return stats


async def warm_user_caches(db: Session) -> Dict[str, int]:
    """Cache frequently accessed user data"""
    stats = {"users": 0, "errors": 0}
    
    try:
        # Cache platform owners and restaurant owners
        important_users = db.query(User).filter(
            User.is_active == True,
            User.role.in_(["platform_owner", "restaurant_owner", "manager"])
        ).all()
        
        for user in important_users:
            try:
                # Cache user data using the cache manager
                user_data = {
                    "id": str(user.id),
                    "email": user.email,
                    "role": user.role,
                    "restaurant_id": str(user.restaurant_id) if user.restaurant_id else None,
                    "permissions": user.permissions or {}
                }
                
                await cache_manager.get_or_set(
                    namespace="user",
                    fetcher=lambda: user_data,
                    ttl=3600,  # 1 hour
                    str(user.id)
                )
                
                stats["users"] += 1
                
            except Exception as e:
                logger.error(f"Failed to cache user {user.id}: {e}")
                stats["errors"] += 1
                
    except Exception as e:
        logger.error(f"Failed to query users: {e}")
        stats["errors"] += 1
    
    return stats


async def warm_product_search_cache(db: Session) -> Dict[str, int]:
    """Pre-warm product search cache for quick lookups"""
    stats = {"products": 0, "categories": 0, "errors": 0}
    
    try:
        # Cache all active categories
        categories = db.query(Category).filter(
            Category.is_active == True
        ).all()
        
        for category in categories:
            try:
                category_data = {
                    "id": str(category.id),
                    "name": category.name,
                    "restaurant_id": str(category.restaurant_id),
                    "sort_order": category.sort_order
                }
                
                await cache_manager.get_or_set(
                    namespace="category",
                    fetcher=lambda: category_data,
                    ttl=3600,
                    str(category.id)
                )
                
                stats["categories"] += 1
                
            except Exception as e:
                logger.error(f"Failed to cache category {category.id}: {e}")
                stats["errors"] += 1
        
        # Cache popular products (top 100 by times ordered)
        popular_products = db.query(Product).filter(
            Product.is_active == True,
            Product.is_available == True
        ).order_by(Product.times_ordered.desc()).limit(100).all()
        
        for product in popular_products:
            try:
                product_data = {
                    "id": str(product.id),
                    "name": product.name,
                    "price": float(product.price),
                    "category_id": str(product.category_id),
                    "restaurant_id": str(product.restaurant_id)
                }
                
                await cache_manager.get_or_set(
                    namespace="product",
                    fetcher=lambda: product_data,
                    ttl=1800,  # 30 minutes
                    str(product.id)
                )
                
                stats["products"] += 1
                
            except Exception as e:
                logger.error(f"Failed to cache product {product.id}: {e}")
                stats["errors"] += 1
                
    except Exception as e:
        logger.error(f"Failed to warm product cache: {e}")
        stats["errors"] += 1
    
    return stats


async def main():
    """Main cache warming function"""
    logger.info("🔥 Starting cache warming process...")
    
    # Get database session
    db = None
    try:
        db = next(get_db())
        
        # Collect all stats
        all_stats = {}
        
        # Warm restaurant caches
        logger.info("Warming restaurant caches...")
        restaurant_stats = await warm_restaurant_caches(db)
        all_stats.update(restaurant_stats)
        
        # Warm user caches
        logger.info("Warming user caches...")
        user_stats = await warm_user_caches(db)
        all_stats.update(user_stats)
        
        # Warm product search cache
        logger.info("Warming product search cache...")
        product_stats = await warm_product_search_cache(db)
        all_stats.update(product_stats)
        
        # Get cache statistics
        cache_stats = cache_manager.get_cache_stats()
        
        # Summary
        logger.info("✅ Cache warming completed!")
        logger.info(f"Statistics:")
        logger.info(f"  - Restaurants cached: {all_stats.get('restaurants', 0)}")
        logger.info(f"  - Menus cached: {all_stats.get('menus', 0)}")
        logger.info(f"  - Settings cached: {all_stats.get('settings', 0)}")
        logger.info(f"  - Users cached: {all_stats.get('users', 0)}")
        logger.info(f"  - Products cached: {all_stats.get('products', 0)}")
        logger.info(f"  - Categories cached: {all_stats.get('categories', 0)}")
        logger.info(f"  - Total errors: {all_stats.get('errors', 0)}")
        logger.info(f"Cache performance:")
        logger.info(f"  - Hit rate: {cache_stats['hit_rate_percentage']}%")
        logger.info(f"  - Total requests: {cache_stats['total_requests']}")
        
        # Exit with error if too many failures
        error_rate = all_stats.get('errors', 0) / max(sum(all_stats.values()), 1)
        if error_rate > 0.5:
            logger.error(f"High error rate during cache warming: {error_rate:.1%}")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Cache warming failed: {e}")
        sys.exit(1)
    finally:
        if db:
            db.close()


if __name__ == "__main__":
    asyncio.run(main())