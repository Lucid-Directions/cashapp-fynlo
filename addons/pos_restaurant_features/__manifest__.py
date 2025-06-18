{
    'name': 'POS Restaurant Features',
    'version': '17.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Restaurant-specific features for POS',
    'description': """
        Restaurant Features for Fynlo POS System
        ========================================
        
        This module provides comprehensive restaurant-specific functionality:
        
        Table Management:
        • Visual floor plan with drag-and-drop table layout
        • Real-time table status tracking (Available, Occupied, Reserved, Cleaning, Blocked)
        • Server section management and assignments
        • Table capacity and shape configuration
        • Interactive table selection and management
        
        Kitchen Display System:
        • Real-time order display for kitchen stations
        • Order timing and preparation tracking
        • Station-specific order filtering (Grill, Fryer, Salad, Dessert, Expo)
        • Order completion workflow
        • Elapsed time monitoring with color-coded alerts
        
        Restaurant Workflow:
        • Order routing to appropriate kitchen stations
        • Course timing and sequencing
        • Server notifications and alerts
        • Table turnover optimization
        • Restaurant performance analytics
        
        Integration Features:
        • Seamless integration with existing POS system
        • Real-time WebSocket updates
        • Mobile-responsive design
        • Touch-optimized interface
        • Multi-station support
        
        Built for restaurant efficiency and customer satisfaction.
    """,
    'depends': [
        'point_of_sale',
        'point_of_sale_api',
        'pos_analytics_reporting',
        'web',
        'mail',
        'hr',
        'base'
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/table_views.xml',
        'views/kitchen_views.xml',
        'data/restaurant_data.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'pos_restaurant_features/static/src/js/table_management.js',
            'pos_restaurant_features/static/src/js/kitchen_display.js',
            'pos_restaurant_features/static/src/xml/restaurant_templates.xml',
            'pos_restaurant_features/static/src/css/restaurant.css',
        ],
        'web.assets_frontend': [
            'pos_restaurant_features/static/src/css/restaurant.css',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': True,
    'license': 'LGPL-3',
    'author': 'Fynlo Development Team',
    'website': 'https://www.fynlo.com',
    'support': 'support@fynlo.com',
} 