# -*- coding: utf-8 -*-
{
    'name': 'Point of Sale API',
    'version': '1.0.0',
    'category': 'Point of Sale',
    'summary': 'Advanced POS API with real-time features, payment processing, and mobile optimization',
    'description': """
        Advanced Point of Sale API Module
        ===================================
        
        This module provides a comprehensive REST API for Point of Sale operations with:
        
        **Phase 1 - Real-time Infrastructure (IMPLEMENTED)**
        * WebSocket server for real-time updates
        * Redis caching for performance optimization
        * Order state machine with business logic validation
        * Kitchen integration and order tracking
        
        **Core Features:**
        * Complete order management with state transitions
        * Real-time WebSocket notifications
        * Advanced caching with Redis
        * Payment processing integration
        * Performance monitoring and analytics
        * Offline sync capabilities
        * Kitchen display system integration
        
        **API Endpoints:**
        * /api/v1/orders/ - Order management
        * /api/v1/products/ - Product catalog
        * /api/v1/sessions/ - POS session management
        * /api/v1/payments/ - Payment processing
        * /ws/pos/<session_id>/ - WebSocket connections
        * /api/v1/sync/ - Data synchronization
        
        **Performance Optimizations:**
        * Redis caching for frequently accessed data
        * Database query optimization
        * Connection pooling
        * Automatic cache warming
        * Performance monitoring
        
        **Security Features:**
        * JWT authentication
        * Rate limiting
        * API security headers
        * Audit logging
        * User permission caching
        
        **Real-time Features:**
        * Order state changes broadcast
        * Kitchen order notifications
        * Payment processing updates
        * Session status updates
        * Multi-device synchronization
    """,
    'author': 'Fynlo Team',
    'website': 'https://fynlo.com',
    'depends': [
        'base',
        'point_of_sale',
        'product',
        'account',
        'stock',
        'web',
        'http_routing',
    ],
    'external_dependencies': {
        'python': [
            'redis',
            'websocket',
            'asyncio',
            'jwt',
            'requests',
            'pycryptodome',
        ],
        'bin': [
            'redis-server',
        ]
    },
    'data': [
        # Security
        'security/ir.model.access.csv',
        'security/pos_security.xml',
        
        # Database schema
        'data/database_schema.xml',
        
        # Cron jobs
        'data/cron_jobs.xml',
        
        # Configuration data
        'data/pos_config.xml',
        
        # Views
        'views/pos_order_views.xml',
        'views/pos_session_views.xml',
        'views/pos_payment_views.xml',
        'views/pos_performance_views.xml',
        'views/pos_websocket_views.xml',
        'views/pos_cache_views.xml',
        
        # Menu items
        'views/pos_menu.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'point_of_sale_api/static/src/js/pos_websocket_client.js',
            'point_of_sale_api/static/src/js/pos_performance_monitor.js',
            'point_of_sale_api/static/src/css/pos_backend.css',
        ],
        'web.assets_frontend': [
            'point_of_sale_api/static/src/js/pos_api_client.js',
            'point_of_sale_api/static/src/css/pos_frontend.css',
        ],
    },
    'demo': [
        'demo/pos_demo_data.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': True,
    'license': 'LGPL-3',
    'price': 299.00,
    'currency': 'USD',
    'images': [
        'static/description/banner.png',
        'static/description/icon.png',
    ],
    
    # Configuration parameters
    'pre_init_hook': 'pre_init_hook',
    'post_init_hook': 'post_init_hook',
    'uninstall_hook': 'uninstall_hook',
    
    # Version info
    'version_info': {
        'major': 1,
        'minor': 0,
        'patch': 0,
        'release': 'stable',
        'build': '20241201-phase1'
    },
    
    # Module compatibility
    'odoo_version': '>=15.0',
    'python_version': '>=3.8',
    
    # Performance settings
    'bootstrap': True,
    'sequence': 1,
    'category_id': 'point_of_sale',
    
    # Development info
    'development_status': 'Production/Stable',
    'maintainers': ['fynlo-team'],
    'contributors': ['backend-team'],
    
    # Support info
    'support': 'support@fynlo.com',
    'website': 'https://fynlo.com/pos-api',
    'documentation': 'https://docs.fynlo.com/pos-api',
    'repository': 'https://github.com/fynlo/pos-api',
    'bug_tracker': 'https://github.com/fynlo/pos-api/issues',
    
    # Module configuration
    'config': {
        'redis_enabled': True,
        'websocket_enabled': True,
        'cache_enabled': True,
        'performance_monitoring': True,
        'debug_mode': False,
        'max_connections': 1000,
        'cache_ttl': 3600,
        'websocket_ping_interval': 30,
    }
} 