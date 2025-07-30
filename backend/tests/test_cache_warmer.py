"""
Test suite for CacheWarmer functionality
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

from app.core.cache_warmer import CacheWarmer, cache_warmer, warm_cache_task, warm_cache_on_startup
from app.core.cache_service import cache_service


class TestCacheWarmer:
    """Test CacheWarmer class functionality"""
    
    @pytest.fixture
    def cache_warmer_instance(self):
        """Create a fresh CacheWarmer instance"""
        warmer = CacheWarmer()
        warmer.last_warm_time = None
        warmer.is_warming = False
        return warmer
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return MagicMock()
    
    @pytest.fixture
    def mock_restaurants(self):
        """Create mock restaurant data"""
        return [
            MagicMock(id="rest_1", is_active=True, name="Restaurant 1"),
            MagicMock(id="rest_2", is_active=True, name="Restaurant 2"),
        ]
    
    @pytest.fixture
    def mock_menu_items(self):
        """Create mock menu items"""
        return [
            MagicMock(
                id="item_1",
                name="Tacos",
                description="Delicious tacos",
                price=8.99,
                category_id="cat_1",
                image_url="http://example.com/tacos.jpg",
                is_active=True,
                is_active=True
            ),
            MagicMock(
                id="item_2",
                name="Burrito",
                description="Big burrito",
                price=10.99,
                category_id="cat_1",
                image_url="http://example.com/burrito.jpg",
                is_active=True,
                is_active=True
            )
        ]
    
    @pytest.fixture
    def mock_categories(self):
        """Create mock categories"""
        return [
            MagicMock(
                id="cat_1",
                name="Main Dishes",
                description="Main course items",
                is_active=True,
                sort_order=1
            ),
            MagicMock(
                id="cat_2",
                name="Beverages",
                description="Drinks",
                is_active=True,
                sort_order=2
            )
        ]
    
    @pytest.fixture
    def mock_settings(self):
        """Create mock restaurant settings"""
        return MagicMock(
            service_charge_percentage=10.0,
            vat_percentage=20.0,
            currency="GBP",
            timezone="Europe/London",
            opening_hours={"monday": "9-17", "tuesday": "9-17"}
        )
    
    @pytest.mark.asyncio
    async def test_warm_all_caches_success(self, cache_warmer_instance, mock_db, mock_restaurants):
        """Test successful warming of all caches"""
        # Mock the private warming methods
        cache_warmer_instance._warm_menu_cache = AsyncMock(return_value=True)
        cache_warmer_instance._warm_categories_cache = AsyncMock(return_value=True)
        cache_warmer_instance._warm_settings_cache = AsyncMock(return_value=True)
        
        # Setup database query
        mock_db.query.return_value.filter.return_value.all.return_value = mock_restaurants
        
        # Execute warming
        stats = await cache_warmer_instance.warm_all_caches(mock_db)
        
        # Verify results
        assert stats["restaurants_warmed"] == 2
        assert stats["menus_warmed"] == 2
        assert stats["categories_warmed"] == 2
        assert stats["settings_warmed"] == 2
        assert stats["errors"] == []
        assert "started_at" in stats
        assert "completed_at" in stats
        assert "duration_seconds" in stats
        
        # Verify each restaurant was warmed
        assert cache_warmer_instance._warm_menu_cache.call_count == 2
        assert cache_warmer_instance._warm_categories_cache.call_count == 2
        assert cache_warmer_instance._warm_settings_cache.call_count == 2
    
    @pytest.mark.asyncio
    async def test_warm_all_caches_already_warming(self, cache_warmer_instance, mock_db):
        """Test skipping when already warming"""
        cache_warmer_instance.is_warming = True
        
        stats = await cache_warmer_instance.warm_all_caches(mock_db)
        
        assert stats["status"] == "skipped"
        assert stats["reason"] == "already_warming"
    
    @pytest.mark.asyncio
    async def test_warm_all_caches_with_errors(self, cache_warmer_instance, mock_db, mock_restaurants):
        """Test warming with some errors"""
        # Setup one successful and one failing warm
        cache_warmer_instance._warm_menu_cache = AsyncMock(side_effect=[True, Exception("Menu error")])
        cache_warmer_instance._warm_categories_cache = AsyncMock(return_value=True)
        cache_warmer_instance._warm_settings_cache = AsyncMock(return_value=True)
        
        mock_db.query.return_value.filter.return_value.all.return_value = mock_restaurants
        
        stats = await cache_warmer_instance.warm_all_caches(mock_db)
        
        assert stats["restaurants_warmed"] == 1  # Only one succeeded
        assert len(stats["errors"]) == 1
        assert "Menu error" in stats["errors"][0]
    
    @pytest.mark.asyncio
    async def test_warm_menu_cache(self, cache_warmer_instance, mock_db, mock_restaurants, mock_menu_items):
        """Test warming menu cache for a restaurant"""
        restaurant = mock_restaurants[0]
        
        # Setup menu items query
        mock_db.query.return_value.filter.return_value.all.return_value = mock_menu_items
        
        with patch.object(cache_service, 'set', return_value=True) as mock_set:
            result = await cache_warmer_instance._warm_menu_cache(mock_db, restaurant)
            
            assert result is True
            
            # Verify cache was set with correct data
            mock_set.assert_called_once()
            cache_key, menu_data, kwargs = mock_set.call_args[0][0], mock_set.call_args[0][1], mock_set.call_args[1]
            
            assert len(menu_data) == 2
            assert menu_data[0]["name"] == "Tacos"
            assert menu_data[1]["name"] == "Burrito"
            assert kwargs["ttl"] == 3600
    
    @pytest.mark.asyncio
    async def test_warm_categories_cache(self, cache_warmer_instance, mock_db, mock_restaurants, mock_categories):
        """Test warming categories cache for a restaurant"""
        restaurant = mock_restaurants[0]
        
        # Setup categories query
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mock_categories
        
        with patch.object(cache_service, 'set', return_value=True) as mock_set:
            result = await cache_warmer_instance._warm_categories_cache(mock_db, restaurant)
            
            assert result is True
            
            # Verify cache was set with correct data
            mock_set.assert_called_once()
            cache_key, categories_data, kwargs = mock_set.call_args[0][0], mock_set.call_args[0][1], mock_set.call_args[1]
            
            # Should have 3 categories (2 from DB + 'All')
            assert len(categories_data) == 3
            assert categories_data[0]["name"] == "All"
            assert categories_data[1]["name"] == "Main Dishes"
            assert categories_data[2]["name"] == "Beverages"
            assert kwargs["ttl"] == 3600
    
    @pytest.mark.asyncio
    async def test_warm_settings_cache(self, cache_warmer_instance, mock_db, mock_restaurants, mock_settings):
        """Test warming settings cache for a restaurant"""
        restaurant = mock_restaurants[0]
        
        # Setup settings query
        mock_db.query.return_value.filter.return_value.first.return_value = mock_settings
        
        with patch.object(cache_service, 'set', return_value=True) as mock_set:
            result = await cache_warmer_instance._warm_settings_cache(mock_db, restaurant)
            
            assert result is True
            
            # Verify cache was set with correct data
            mock_set.assert_called_once()
            cache_key, settings_data, kwargs = mock_set.call_args[0][0], mock_set.call_args[0][1], mock_set.call_args[1]
            
            assert settings_data["service_charge_percentage"] == 10.0
            assert settings_data["vat_percentage"] == 20.0
            assert settings_data["currency"] == "GBP"
            assert kwargs["ttl"] == 1800
    
    @pytest.mark.asyncio
    async def test_warm_settings_cache_no_settings(self, cache_warmer_instance, mock_db, mock_restaurants):
        """Test warming settings cache when no settings exist"""
        restaurant = mock_restaurants[0]
        
        # No settings found
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = await cache_warmer_instance._warm_settings_cache(mock_db, restaurant)
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_warm_specific_restaurant(self, cache_warmer_instance, mock_db, mock_restaurants):
        """Test warming cache for a specific restaurant"""
        restaurant = mock_restaurants[0]
        
        # Setup restaurant query
        mock_db.query.return_value.filter.return_value.first.return_value = restaurant
        
        # Mock warming methods
        cache_warmer_instance._warm_menu_cache = AsyncMock(return_value=True)
        cache_warmer_instance._warm_categories_cache = AsyncMock(return_value=True)
        cache_warmer_instance._warm_settings_cache = AsyncMock(return_value=False)
        
        stats = await cache_warmer_instance.warm_specific_restaurant(mock_db, "rest_1")
        
        assert stats["restaurant_id"] == "rest_1"
        assert stats["menu_warmed"] is True
        assert stats["categories_warmed"] is True
        assert stats["settings_warmed"] is False
        assert "timestamp" in stats
    
    @pytest.mark.asyncio
    async def test_warm_specific_restaurant_not_found(self, cache_warmer_instance, mock_db):
        """Test warming cache for non-existent restaurant"""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        stats = await cache_warmer_instance.warm_specific_restaurant(mock_db, "invalid_id")
        
        assert stats["status"] == "error"
        assert stats["reason"] == "restaurant_not_found"
    
    def test_should_warm_first_time(self, cache_warmer_instance):
        """Test should_warm when never warmed before"""
        assert cache_warmer_instance.should_warm() is True
    
    def test_should_warm_interval_passed(self, cache_warmer_instance):
        """Test should_warm when interval has passed"""
        cache_warmer_instance.last_warm_time = datetime.utcnow() - timedelta(hours=2)
        cache_warmer_instance.warm_interval = 3600  # 1 hour
        
        assert cache_warmer_instance.should_warm() is True
    
    def test_should_warm_interval_not_passed(self, cache_warmer_instance):
        """Test should_warm when interval hasn't passed"""
        cache_warmer_instance.last_warm_time = datetime.utcnow() - timedelta(minutes=30)
        cache_warmer_instance.warm_interval = 3600  # 1 hour
        
        assert cache_warmer_instance.should_warm() is False


class TestCacheWarmingTasks:
    """Test background warming tasks"""
    
    @pytest.mark.asyncio
    async def test_warm_cache_task_execution(self):
        """Test the background warming task"""
        # Mock get_db
        mock_db = MagicMock()
        
        with patch('app.core.cache_warmer.cache_warmer') as mock_warmer, \
             patch('app.core.cache_warmer.get_db', return_value=iter([mock_db])), \
             patch('asyncio.sleep') as mock_sleep:
            
            # Setup warmer behavior
            mock_warmer.should_warm.side_effect = [True, False, False]  # Warm once then stop
            mock_warmer.warm_all_caches = AsyncMock(return_value={"status": "success"})
            
            # Make sleep raise to exit loop
            mock_sleep.side_effect = [None, None, KeyboardInterrupt()]
            
            try:
                await warm_cache_task()
            except KeyboardInterrupt:
                pass
            
            # Verify warming was called
            mock_warmer.warm_all_caches.assert_called_once_with(mock_db)
            mock_db.close.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_warm_cache_task_error_handling(self):
        """Test error handling in background task"""
        mock_db = MagicMock()
        
        with patch('app.core.cache_warmer.cache_warmer') as mock_warmer, \
             patch('app.core.cache_warmer.get_db', return_value=iter([mock_db])), \
             patch('asyncio.sleep') as mock_sleep:
            
            # Setup warmer to raise error
            mock_warmer.should_warm.return_value = True
            mock_warmer.warm_all_caches = AsyncMock(side_effect=Exception("Test error"))
            
            # Make sleep raise to exit loop after error
            mock_sleep.side_effect = [None, KeyboardInterrupt()]
            
            try:
                await warm_cache_task()
            except KeyboardInterrupt:
                pass
            
            # Should sleep for 60 seconds on error
            mock_sleep.assert_any_call(60)
    
    @pytest.mark.asyncio
    async def test_warm_cache_on_startup(self):
        """Test cache warming on startup"""
        mock_db = MagicMock()
        
        with patch('app.core.cache_warmer.cache_warmer') as mock_warmer:
            mock_warmer.warm_all_caches = AsyncMock(return_value={"status": "success"})
            
            await warm_cache_on_startup(mock_db)
            
            mock_warmer.warm_all_caches.assert_called_once_with(mock_db)
    
    @pytest.mark.asyncio
    async def test_warm_cache_on_startup_error(self):
        """Test startup warming continues even with errors"""
        mock_db = MagicMock()
        
        with patch('app.core.cache_warmer.cache_warmer') as mock_warmer:
            mock_warmer.warm_all_caches = AsyncMock(side_effect=Exception("Startup error"))
            
            # Should not raise exception
            await warm_cache_on_startup(mock_db)
            
            mock_warmer.warm_all_caches.assert_called_once_with(mock_db)