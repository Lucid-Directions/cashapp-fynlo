# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Cash - Complete Restaurant System',
    'version': '1.0.0',
    'category': 'Sales/Point of Sale',
    'sequence': 1,
    'summary': 'Hardware-Free Restaurant POS System for Mobile Devices',
    'description': """
POS Cash 📱💳 - The Complete Hardware-Free Restaurant POS System

Transform your smartphone or tablet into a powerful restaurant point-of-sale system. 
Accept payments, manage orders, track inventory, and run your entire restaurant operation 
without any additional hardware.

🚀 Key Features:
• 💸 Zero Hardware Costs - Use existing phones and tablets
• 🏦 Direct Bank Deposits - UK banking integration
• 📱 Mobile-First Design - Built for smartphones and tablets  
• 🇬🇧 UK-Focused - VAT compliant, Sterling support
• 🍽️ Restaurant-Specific - Every feature designed for food service

✨ Core Capabilities:
• 💳 Contactless & Card Payments (NFC, Apple Pay, Google Pay)
• 🍽️ Visual Menu Builder & Order Management
• 📊 Real-time Inventory & Recipe Management
• 👥 Staff Management with Role-based Access
• 🏪 Multi-Location Support
• 📈 Advanced Analytics & Reporting
• 👤 Customer Management & Loyalty Programs
• 🛒 Online Ordering & Delivery Integration
• 🔐 PCI DSS & GDPR Compliant Security

Supported Devices: iPhone 12+, iPad, Android 10+ with NFC
Payment Processing: Direct bank integration with transparent fees
""",
    'author': 'POS Cash Team',
    'website': 'https://www.poscash.co.uk',
    'depends': [
        'pos_restaurant',
        'pos_hr',
        'pos_loyalty',
        'pos_self_order',
        'account',
        'stock',
        'crm',
        'website',
        'payment',
        'delivery',
        'calendar',
        'contacts',
        'base_vat',
        'mail',
        'sms',
        'hr',
        'fleet',
        'survey',
    ],
    'data': [
        # Security
        'security/ir.model.access.csv',
        'security/pos_cash_security.xml',
        
        # Data
        'data/pos_cash_payment_methods.xml',
        'data/pos_cash_config_data.xml',
        'data/uk_tax_data.xml',
        'data/pos_cash_demo_data.xml',
        'data/mail_templates.xml',
        'data/sms_templates.xml',
        
        # Views - Configuration
        'views/res_config_settings_views.xml',
        'views/pos_config_views.xml',
        'views/pos_payment_method_views.xml',
        
        # Views - Restaurant Management
        'views/restaurant_table_views.xml',
        'views/restaurant_floor_views.xml',
        'views/kitchen_display_views.xml',
        'views/pos_order_views.xml',
        
        # Views - Product & Menu Management
        'views/product_template_views.xml',
        'views/product_category_views.xml',
        'views/recipe_management_views.xml',
        'views/menu_builder_views.xml',
        
        # Views - Staff Management
        'views/hr_employee_views.xml',
        'views/pos_session_views.xml',
        'views/staff_performance_views.xml',
        
        # Views - Customer Management
        'views/res_partner_views.xml',
        'views/loyalty_program_views.xml',
        'views/customer_feedback_views.xml',
        
        # Views - Inventory Management
        'views/stock_location_views.xml',
        'views/stock_move_views.xml',
        'views/inventory_dashboard_views.xml',
        
        # Views - Analytics & Reporting
        'views/pos_analytics_views.xml',
        'views/sales_report_views.xml',
        'views/financial_report_views.xml',
        
        # Views - Online Ordering
        'views/website_menu_views.xml',
        'views/delivery_management_views.xml',
        'views/online_order_views.xml',
        
        # Views - Multi-location
        'views/restaurant_location_views.xml',
        'views/multi_location_dashboard_views.xml',
        
        # Wizards
        'wizard/pos_cash_daily_report_wizard.xml',
        'wizard/pos_cash_inventory_wizard.xml',
        'wizard/pos_cash_customer_import_wizard.xml',
        'wizard/pos_cash_menu_import_wizard.xml',
        
        # Reports
        'report/pos_cash_reports.xml',
        'report/daily_sales_report.xml',
        'report/kitchen_order_ticket.xml',
        'report/customer_receipt.xml',
        'report/vat_report.xml',
        
        # Menu Items
        'views/pos_cash_menus.xml',
    ],
    'demo': [
        'demo/restaurant_demo_data.xml',
        'demo/menu_demo_data.xml',
        'demo/customer_demo_data.xml',
    ],
    'assets': {
        # Mobile POS Interface Assets
        'point_of_sale._assets_pos': [
            # Core POS Cash Files
            'pos_cash_restaurant/static/src/scss/pos_cash_variables.scss',
            'pos_cash_restaurant/static/src/scss/mobile_first.scss',
            'pos_cash_restaurant/static/src/scss/uk_theme.scss',
            
            # JavaScript Components
            'pos_cash_restaurant/static/src/js/pos_cash_main.js',
            'pos_cash_restaurant/static/src/js/models/pos_cash_models.js',
            'pos_cash_restaurant/static/src/js/utils/uk_formatting.js',
            'pos_cash_restaurant/static/src/js/utils/payment_utils.js',
            'pos_cash_restaurant/static/src/js/utils/mobile_utils.js',
            
            # Payment Components
            'pos_cash_restaurant/static/src/js/payment/nfc_payment.js',
            'pos_cash_restaurant/static/src/js/payment/stripe_integration.js',
            'pos_cash_restaurant/static/src/js/payment/paypal_integration.js',
            'pos_cash_restaurant/static/src/js/payment/bank_transfer.js',
            'pos_cash_restaurant/static/src/js/payment/split_payment.js',
            
            # Restaurant Components
            'pos_cash_restaurant/static/src/js/restaurant/table_management.js',
            'pos_cash_restaurant/static/src/js/restaurant/kitchen_display.js',
            'pos_cash_restaurant/static/src/js/restaurant/order_management.js',
            'pos_cash_restaurant/static/src/js/restaurant/floor_plan.js',
            
            # Menu & Product Components
            'pos_cash_restaurant/static/src/js/menu/visual_menu_builder.js',
            'pos_cash_restaurant/static/src/js/menu/menu_management.js',
            'pos_cash_restaurant/static/src/js/inventory/stock_tracking.js',
            'pos_cash_restaurant/static/src/js/inventory/recipe_manager.js',
            
            # Customer Management
            'pos_cash_restaurant/static/src/js/customer/customer_database.js',
            'pos_cash_restaurant/static/src/js/customer/loyalty_program.js',
            'pos_cash_restaurant/static/src/js/customer/feedback_system.js',
            
            # Staff Management
            'pos_cash_restaurant/static/src/js/staff/staff_login.js',
            'pos_cash_restaurant/static/src/js/staff/role_management.js',
            'pos_cash_restaurant/static/src/js/staff/performance_tracking.js',
            
            # Analytics & Reporting
            'pos_cash_restaurant/static/src/js/analytics/dashboard.js',
            'pos_cash_restaurant/static/src/js/analytics/sales_reports.js',
            'pos_cash_restaurant/static/src/js/analytics/financial_reports.js',
            
            # Online Ordering
            'pos_cash_restaurant/static/src/js/online/website_integration.js',
            'pos_cash_restaurant/static/src/js/online/delivery_management.js',
            'pos_cash_restaurant/static/src/js/online/order_tracking.js',
            
            # XML Templates
            'pos_cash_restaurant/static/src/xml/**/*.xml',
        ],
        
        # Backend Assets
        'web.assets_backend': [
            'pos_cash_restaurant/static/src/scss/backend.scss',
            'pos_cash_restaurant/static/src/js/backend/dashboard.js',
            'pos_cash_restaurant/static/src/js/backend/config_widgets.js',
            'pos_cash_restaurant/static/src/js/backend/report_widgets.js',
        ],
        
        # Website Assets (for online ordering)
        'website.assets_frontend': [
            'pos_cash_restaurant/static/src/scss/website_ordering.scss',
            'pos_cash_restaurant/static/src/js/website/online_menu.js',
            'pos_cash_restaurant/static/src/js/website/order_form.js',
            'pos_cash_restaurant/static/src/js/website/customer_portal.js',
        ],
        
        # Test Assets
        'web.assets_tests': [
            'pos_cash_restaurant/static/tests/tours/**/*',
        ],
    },
    'external_dependencies': {
        'python': [
            'stripe',
            'paypal-checkout-serversdk',
            'uk-bank-holidays',
            'phonenumbers',
            'qrcode',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
    'price': 0,
    'currency': 'GBP',
    'images': [
        'static/description/pos_cash_banner.png',
        'static/description/mobile_pos.png',
        'static/description/restaurant_features.png',
    ],
    'support': 'support@poscash.co.uk',
} 