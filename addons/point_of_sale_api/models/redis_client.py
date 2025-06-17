# -*- coding: utf-8 -*-

import redis
import json
import logging
import time
from datetime import datetime, timedelta
from odoo import models, fields, api
from odoo.tools import config
import hashlib
import pickle

_logger = logging.getLogger(__name__)

class RedisClient:
    """Redis client for POS caching and session management"""
    
    def __init__(self):
        self.pool = None
        self.client = None
        self.connected = False
        self.setup_connection()
    
    def setup_connection(self):
        """Setup Redis connection pool"""
        try:
            # Redis configuration
            redis_host = config.get('redis_host', 'localhost')
            redis_port = int(config.get('redis_port', 6379))
            redis_db = int(config.get('redis_db', 0))
            redis_password = config.get('redis_password', None)
            
            # Create connection pool
            self.pool = redis.ConnectionPool(
                host=redis_host,
                port=redis_port,
                db=redis_db,
                password=redis_password,
                decode_responses=True,
                max_connections=50,
                retry_on_timeout=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Create client
            self.client = redis.Redis(connection_pool=self.pool)
            
            # Test connection
            self.client.ping()
            self.connected = True
            _logger.info("Redis connection established successfully")
            
        except Exception as e:
            _logger.error(f"Failed to connect to Redis: {e}")
            self.connected = False
    
    def is_connected(self):
        """Check if Redis is connected"""
        try:
            if self.client:
                self.client.ping()
                return True
        except:
            pass
        return False
    
    def reconnect(self):
        """Attempt to reconnect to Redis"""
        if not self.is_connected():
            self.setup_connection()
    
    def get(self, key, default=None):
        """Get value from Redis cache"""
        try:
            if not self.is_connected():
                return default
            
            value = self.client.get(key)
            if value is None:
                return default
            
            # Try to deserialize JSON
            try:
                return json.loads(value)
            except:
                return value
                
        except Exception as e:
            _logger.error(f"Redis GET error for key {key}: {e}")
            return default
    
    def set(self, key, value, ttl=3600):
        """Set value in Redis cache"""
        try:
            if not self.is_connected():
                return False
            
            # Serialize to JSON if not string
            if not isinstance(value, str):
                value = json.dumps(value, default=str)
            
            if ttl:
                return self.client.setex(key, ttl, value)
            else:
                return self.client.set(key, value)
                
        except Exception as e:
            _logger.error(f"Redis SET error for key {key}: {e}")
            return False
    
    def delete(self, key):
        """Delete key from Redis"""
        try:
            if not self.is_connected():
                return False
            return self.client.delete(key)
        except Exception as e:
            _logger.error(f"Redis DELETE error for key {key}: {e}")
            return False
    
    def exists(self, key):
        """Check if key exists in Redis"""
        try:
            if not self.is_connected():
                return False
            return bool(self.client.exists(key))
        except Exception as e:
            _logger.error(f"Redis EXISTS error for key {key}: {e}")
            return False
    
    def increment(self, key, amount=1):
        """Increment a numeric value"""
        try:
            if not self.is_connected():
                return None
            return self.client.incr(key, amount)
        except Exception as e:
            _logger.error(f"Redis INCR error for key {key}: {e}")
            return None
    
    def expire(self, key, ttl):
        """Set expiration time for key"""
        try:
            if not self.is_connected():
                return False
            return self.client.expire(key, ttl)
        except Exception as e:
            _logger.error(f"Redis EXPIRE error for key {key}: {e}")
            return False
    
    def flush_pattern(self, pattern):
        """Delete all keys matching pattern"""
        try:
            if not self.is_connected():
                return 0
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception as e:
            _logger.error(f"Redis FLUSH_PATTERN error for pattern {pattern}: {e}")
            return 0

# Global Redis client instance
redis_client = RedisClient()

class POSCacheManager(models.Model):
    """POS-specific caching manager"""
    _name = 'pos.cache.manager'
    _description = 'POS Cache Management'
    
    # Cache key prefixes
    PRODUCT_CACHE_PREFIX = 'pos:products'
    CATEGORY_CACHE_PREFIX = 'pos:categories'
    SESSION_CACHE_PREFIX = 'pos:session'
    USER_CACHE_PREFIX = 'pos:user'
    MENU_CACHE_PREFIX = 'pos:menu'
    
    # Cache TTL settings (in seconds)
    PRODUCT_TTL = 900  # 15 minutes
    CATEGORY_TTL = 3600  # 1 hour
    SESSION_TTL = 0  # No expiration (session-based)
    USER_TTL = 1800  # 30 minutes
    MENU_TTL = 1800  # 30 minutes
    
    @api.model
    def get_cache_key(self, prefix, identifier):
        """Generate standardized cache key"""
        return f"{prefix}:{identifier}"
    
    @api.model
    def get_product_cache_key(self, product_id):
        """Get cache key for product"""
        return self.get_cache_key(self.PRODUCT_CACHE_PREFIX, product_id)
    
    @api.model
    def get_products_list_key(self, session_id=None):
        """Get cache key for products list"""
        key = f"{self.PRODUCT_CACHE_PREFIX}:list"
        if session_id:
            key += f":session_{session_id}"
        return key
    
    @api.model
    def cache_product(self, product):
        """Cache individual product data"""
        key = self.get_product_cache_key(product.id)
        data = {
            'id': product.id,
            'name': product.name,
            'price': product.list_price,
            'barcode': product.barcode,
            'available_in_pos': product.available_in_pos,
            'pos_categ_id': product.pos_categ_id.id if product.pos_categ_id else None,
            'uom_id': product.uom_id.id,
            'taxes_id': product.taxes_id.ids,
            'image_url': f'/web/image/product.product/{product.id}/image_128' if product.image_128 else None,
            'cached_at': datetime.now().isoformat()
        }
        redis_client.set(key, data, self.PRODUCT_TTL)
        return data
    
    @api.model
    def get_cached_product(self, product_id):
        """Get cached product data"""
        key = self.get_product_cache_key(product_id)
        return redis_client.get(key)
    
    @api.model
    def cache_products_list(self, products, session_id=None):
        """Cache list of products for quick access"""
        key = self.get_products_list_key(session_id)
        data = []
        
        for product in products:
            product_data = self.cache_product(product)
            data.append(product_data)
        
        # Cache the list
        list_data = {
            'products': data,
            'count': len(data),
            'cached_at': datetime.now().isoformat()
        }
        redis_client.set(key, list_data, self.PRODUCT_TTL)
        return list_data
    
    @api.model
    def get_cached_products_list(self, session_id=None):
        """Get cached products list"""
        key = self.get_products_list_key(session_id)
        return redis_client.get(key)
    
    @api.model
    def cache_categories(self):
        """Cache product categories"""
        key = f"{self.CATEGORY_CACHE_PREFIX}:list"
        categories = self.env['pos.category'].search([])
        
        data = []
        for category in categories:
            cat_data = {
                'id': category.id,
                'name': category.name,
                'parent_id': category.parent_id.id if category.parent_id else None,
                'sequence': category.sequence,
                'image_url': f'/web/image/pos.category/{category.id}/image_128' if category.image_128 else None
            }
            data.append(cat_data)
        
        list_data = {
            'categories': data,
            'count': len(data),
            'cached_at': datetime.now().isoformat()
        }
        redis_client.set(key, list_data, self.CATEGORY_TTL)
        return list_data
    
    @api.model
    def get_cached_categories(self):
        """Get cached categories"""
        key = f"{self.CATEGORY_CACHE_PREFIX}:list"
        return redis_client.get(key)
    
    @api.model
    def cache_session_data(self, session):
        """Cache session data"""
        key = self.get_cache_key(self.SESSION_CACHE_PREFIX, session.id)
        data = {
            'id': session.id,
            'name': session.name,
            'state': session.state,
            'start_at': session.start_at.isoformat() if session.start_at else None,
            'stop_at': session.stop_at.isoformat() if session.stop_at else None,
            'config_id': session.config_id.id,
            'user_id': session.user_id.id,
            'cash_register_balance_start': session.cash_register_balance_start,
            'cash_register_balance_end_real': session.cash_register_balance_end_real,
            'cached_at': datetime.now().isoformat()
        }
        redis_client.set(key, data, self.SESSION_TTL)
        return data
    
    @api.model
    def get_cached_session(self, session_id):
        """Get cached session data"""
        key = self.get_cache_key(self.SESSION_CACHE_PREFIX, session_id)
        return redis_client.get(key)
    
    @api.model
    def cache_user_permissions(self, user):
        """Cache user permissions"""
        key = self.get_cache_key(self.USER_CACHE_PREFIX, user.id)
        
        permissions = []
        if user.has_group('point_of_sale.group_pos_user'):
            permissions.append('pos.order.create')
            permissions.append('pos.order.read')
        if user.has_group('point_of_sale.group_pos_manager'):
            permissions.extend([
                'pos.order.write',
                'pos.order.delete',
                'pos.session.manage',
                'pos.payment.refund'
            ])
        
        data = {
            'user_id': user.id,
            'name': user.name,
            'login': user.login,
            'permissions': permissions,
            'groups': [group.name for group in user.groups_id],
            'cached_at': datetime.now().isoformat()
        }
        redis_client.set(key, data, self.USER_TTL)
        return data
    
    @api.model
    def get_cached_user_permissions(self, user_id):
        """Get cached user permissions"""
        key = self.get_cache_key(self.USER_CACHE_PREFIX, user_id)
        return redis_client.get(key)
    
    @api.model
    def invalidate_cache(self, cache_type, identifier=None):
        """Invalidate specific cache or cache type"""
        if identifier:
            key = self.get_cache_key(cache_type, identifier)
            redis_client.delete(key)
        else:
            # Invalidate all keys with this prefix
            pattern = f"{cache_type}:*"
            redis_client.flush_pattern(pattern)
    
    @api.model
    def warm_cache(self):
        """Warm up frequently accessed caches on startup"""
        try:
            _logger.info("Starting cache warming...")
            
            # Cache product categories
            self.cache_categories()
            _logger.info("Cached product categories")
            
            # Cache available POS products
            products = self.env['product.product'].search([
                ('available_in_pos', '=', True),
                ('active', '=', True)
            ])
            self.cache_products_list(products)
            _logger.info(f"Cached {len(products)} products")
            
            # Cache active sessions
            sessions = self.env['pos.session'].search([
                ('state', '=', 'opened')
            ])
            for session in sessions:
                self.cache_session_data(session)
            _logger.info(f"Cached {len(sessions)} active sessions")
            
            _logger.info("Cache warming completed successfully")
            
        except Exception as e:
            _logger.error(f"Cache warming failed: {e}")
    
    @api.model
    def get_cache_stats(self):
        """Get cache performance statistics"""
        try:
            if not redis_client.is_connected():
                return {'error': 'Redis not connected'}
            
            info = redis_client.client.info()
            
            # Count keys by prefix
            product_keys = len(redis_client.client.keys(f"{self.PRODUCT_CACHE_PREFIX}:*"))
            category_keys = len(redis_client.client.keys(f"{self.CATEGORY_CACHE_PREFIX}:*"))
            session_keys = len(redis_client.client.keys(f"{self.SESSION_CACHE_PREFIX}:*"))
            user_keys = len(redis_client.client.keys(f"{self.USER_CACHE_PREFIX}:*"))
            
            return {
                'connected': True,
                'used_memory': info.get('used_memory_human'),
                'total_keys': info.get('db0', {}).get('keys', 0),
                'cache_counts': {
                    'products': product_keys,
                    'categories': category_keys,
                    'sessions': session_keys,
                    'users': user_keys
                },
                'hit_rate': self._calculate_hit_rate(),
                'uptime': info.get('uptime_in_seconds')
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def _calculate_hit_rate(self):
        """Calculate cache hit rate"""
        try:
            info = redis_client.client.info()
            hits = info.get('keyspace_hits', 0)
            misses = info.get('keyspace_misses', 0)
            total = hits + misses
            if total > 0:
                return round((hits / total) * 100, 2)
            return 0
        except:
            return 0

# Cache warming on module load
class POSCacheWarmer(models.Model):
    _name = 'pos.cache.warmer'
    _description = 'POS Cache Warmer'
    
    @api.model
    def warm_cache_cron(self):
        """Cron job to warm cache"""
        cache_manager = self.env['pos.cache.manager']
        cache_manager.warm_cache()
    
    @api.model
    def cleanup_expired_cache(self):
        """Cleanup expired cache entries"""
        try:
            if redis_client.is_connected():
                # Let Redis handle expiration automatically
                # Just log the cleanup activity
                _logger.info("Cache cleanup completed (Redis auto-expiration)")
        except Exception as e:
            _logger.error(f"Cache cleanup error: {e}") 