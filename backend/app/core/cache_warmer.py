"""
Cache warming strategies for Fynlo POS.
Pre-populates cache with frequently accessed data to improve performance.
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.cache_service import cache_service
from app.core.database import get_db
from app.models import Restaurant, MenuItem, Category, RestaurantSettings
from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheWarmer:
    """Manages cache warming operations"""
    
    def __init__(self):
        self.is_warming = False
        self.last_warm_time = None
        self.warm_interval = 3600  # 1 hour
        
    async def warm_all_caches(self, db: Session) -> dict:
        """
        Warm all caches for active restaurants.
        
        Returns:
            dict: Statistics about warmed caches
        """
        if self.is_warming:
            logger.warning("Cache warming already in progress, skipping")
            return {"status": "skipped", "reason": "already_warming"}
        
        self.is_warming = True
        start_time = datetime.utcnow()
        stats = {
            "started_at": start_time,
            "restaurants_warmed": 0,
            "menus_warmed": 0,
            "categories_warmed": 0,
            "settings_warmed": 0,
            "errors": []
        }
        
        try:
            # Get all active restaurants
            restaurants = db.query(Restaurant).filter(
                Restaurant.is_active == True
            ).all()
            
            logger.info(f"Starting cache warming for {len(restaurants)} active restaurants")
            
            for restaurant in restaurants:
                try:
                    # Warm menu cache
                    menu_warmed = await self._warm_menu_cache(db, restaurant)
                    if menu_warmed:
                        stats["menus_warmed"] += 1
                    
                    # Warm categories cache
                    categories_warmed = await self._warm_categories_cache(db, restaurant)
                    if categories_warmed:
                        stats["categories_warmed"] += 1
                    
                    # Warm settings cache
                    settings_warmed = await self._warm_settings_cache(db, restaurant)
                    if settings_warmed:
                        stats["settings_warmed"] += 1
                    
                    stats["restaurants_warmed"] += 1
                    
                except Exception as e:
                    error_msg = f"Error warming cache for restaurant {restaurant.id}: {str(e)}"
                    logger.error(error_msg)
                    stats["errors"].append(error_msg)
            
            # Calculate duration
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            stats["completed_at"] = end_time
            stats["duration_seconds"] = duration
            
            self.last_warm_time = end_time
            logger.info(f"Cache warming completed in {duration:.2f}s - {stats}")
            
            return stats
            
        finally:
            self.is_warming = False
    
    async def _warm_menu_cache(self, db: Session, restaurant: Restaurant) -> bool:
        """Warm menu cache for a restaurant"""
        try:
            # Get menu items
            menu_items = db.query(MenuItem).filter(
                and_(
                    MenuItem.restaurant_id == restaurant.id,
                    MenuItem.is_active == True
                )
            ).all()
            
            # Transform to cache format
            menu_data = [
                {
                    "id": str(item.id),
                    "name": item.name,
                    "description": item.description,
                    "price": float(item.price),
                    "category_id": str(item.category_id) if item.category_id else None,
                    "image_url": item.image_url,
                    "is_available": item.is_available,
                }
                for item in menu_items
            ]
            
            # Cache with appropriate key
            cache_key = cache_service.cache_key("menu_items", restaurant_id=str(restaurant.id), category=None)
            success = await cache_service.set(cache_key, menu_data, ttl=3600)
            
            if success:
                logger.debug(f"Warmed menu cache for restaurant {restaurant.id} with {len(menu_items)} items")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to warm menu cache for restaurant {restaurant.id}: {e}")
            return False
    
    async def _warm_categories_cache(self, db: Session, restaurant: Restaurant) -> bool:
        """Warm categories cache for a restaurant"""
        try:
            # Get categories
            categories = db.query(Category).filter(
                and_(
                    Category.restaurant_id == restaurant.id,
                    Category.is_active == True
                )
            ).order_by(Category.sort_order, Category.name).all()
            
            # Transform to cache format
            menu_categories = [
                {
                    'id': int(str(cat.id).replace('-', '')[:8], 16) % 100000,
                    'name': cat.name,
                    'active': cat.is_active
                }
                for cat in categories
            ]
            
            # Always include 'All' category
            if not any(cat['name'] == 'All' for cat in menu_categories):
                menu_categories.insert(0, {'id': 1, 'name': 'All', 'active': True})
            
            # Cache with appropriate key
            cache_key = cache_service.cache_key("menu_categories", restaurant_id=str(restaurant.id))
            success = await cache_service.set(cache_key, menu_categories, ttl=3600)
            
            if success:
                logger.debug(f"Warmed categories cache for restaurant {restaurant.id} with {len(categories)} categories")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to warm categories cache for restaurant {restaurant.id}: {e}")
            return False
    
    async def _warm_settings_cache(self, db: Session, restaurant: Restaurant) -> bool:
        """Warm settings cache for a restaurant"""
        try:
            # Get settings
            settings = db.query(RestaurantSettings).filter(
                RestaurantSettings.restaurant_id == restaurant.id
            ).first()
            
            if not settings:
                return False
            
            # Transform to cache format
            settings_data = {
                "service_charge_percentage": float(settings.service_charge_percentage),
                "vat_percentage": float(settings.vat_percentage),
                "currency": settings.currency,
                "timezone": settings.timezone,
                "opening_hours": settings.opening_hours,
            }
            
            # Cache with appropriate key
            cache_key = cache_service.cache_key("settings", restaurant_id=str(restaurant.id))
            success = await cache_service.set(cache_key, settings_data, ttl=1800)
            
            if success:
                logger.debug(f"Warmed settings cache for restaurant {restaurant.id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to warm settings cache for restaurant {restaurant.id}: {e}")
            return False
    
    async def warm_specific_restaurant(self, db: Session, restaurant_id: str) -> dict:
        """
        Warm cache for a specific restaurant.
        
        Args:
            db: Database session
            restaurant_id: Restaurant ID to warm
            
        Returns:
            dict: Warming statistics
        """
        restaurant = db.query(Restaurant).filter(
            Restaurant.id == restaurant_id
        ).first()
        
        if not restaurant:
            return {"status": "error", "reason": "restaurant_not_found"}
        
        stats = {
            "restaurant_id": restaurant_id,
            "menu_warmed": await self._warm_menu_cache(db, restaurant),
            "categories_warmed": await self._warm_categories_cache(db, restaurant),
            "settings_warmed": await self._warm_settings_cache(db, restaurant),
            "timestamp": datetime.utcnow()
        }
        
        return stats
    
    def should_warm(self) -> bool:
        """Check if cache should be warmed based on interval"""
        if not self.last_warm_time:
            return True
        
        elapsed = (datetime.utcnow() - self.last_warm_time).total_seconds()
        return elapsed >= self.warm_interval


# Global cache warmer instance
cache_warmer = CacheWarmer()


async def warm_cache_task():
    """
    Background task to periodically warm caches.
    Should be added to FastAPI's startup event.
    """
    while True:
        try:
            if cache_warmer.should_warm():
                # Get a database session
                db = next(get_db())
                try:
                    stats = await cache_warmer.warm_all_caches(db)
                    logger.info(f"Cache warming task completed: {stats}")
                finally:
                    db.close()
            
            # Sleep for 5 minutes before checking again
            await asyncio.sleep(300)
            
        except Exception as e:
            logger.error(f"Error in cache warming task: {e}")
            # Sleep for 1 minute on error
            await asyncio.sleep(60)


async def warm_cache_on_startup(db: Session):
    """
    Warm cache on application startup.
    Should be called from FastAPI's startup event.
    """
    try:
        logger.info("Starting initial cache warming...")
        stats = await cache_warmer.warm_all_caches(db)
        logger.info(f"Initial cache warming completed: {stats}")
    except Exception as e:
        logger.error(f"Failed to warm cache on startup: {e}")
        # Don't fail startup if cache warming fails
        pass