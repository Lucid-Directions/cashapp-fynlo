{
    'name': 'Point of Sale API',
    'version': '17.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'RESTful API endpoints for Fynlo POS mobile application',
    'description': """
        This module provides RESTful API endpoints for the Fynlo POS system,
        enabling mobile iOS app integration with features including:
        - Authentication and session management
        - Product and menu management
        - Order processing and management
        - Payment processing integration
        - Real-time WebSocket events
        - Analytics and reporting
    """,
    'author': 'Fynlo Development Team',
    'website': 'https://www.fynlo.com',
    'depends': [
        'base',
        'point_of_sale',
        'pos_restaurant',
        'account',
        'product',
        'auth_jwt',  # For JWT token support
    ],
    'data': [
        'security/ir.model.access.csv',
        'security/pos_api_security.xml',
        'data/pos_api_data.xml',
    ],
    'external_dependencies': {
        'python': [
            'jwt',
            'redis',
            'requests',
            'cryptography',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
} 