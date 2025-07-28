{
    'name': 'POS Advanced Analytics & Reporting',
    'version': '17.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Comprehensive analytics, reporting, and business intelligence for POS',
    'description': """
        Advanced Analytics & Reporting for Fynlo POS System
        ===================================================
        
        This module provides comprehensive business intelligence features:
        
        Real-time Dashboard:
        • Live sales metrics and KPIs
        • Interactive charts and visualizations
        • Performance monitoring
        • Real-time updates and auto-refresh
        
        Advanced Reporting:
        • Daily, weekly, monthly sales reports
        • Product performance analytics
        • Staff performance metrics
        • Financial reports and P&L
        • Custom report builder
        
        Export & Sharing:
        • PDF report generation
        • Excel export functionality
        • Email delivery
        • Scheduled reports
        
        Analytics Features:
        • Sales forecasting
        • Trend analysis
        • Customer analytics
        • ABC product analysis
        • Profitability analysis
        
        Staff Performance:
        • Individual staff metrics
        • Performance scoring
        • Efficiency tracking
        • Sales per hour analysis
        
        Built with modern web technologies:
        • Chart.js for interactive visualizations
        • Responsive design
        • Real-time data updates
        • Modern UI/UX
    """,
    'depends': [
        'point_of_sale',
        'web',
        'mail',
        'account',
        'hr',
        'stock',
        'base'
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/analytics_dashboard_views.xml',
        'data/cron_jobs.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'pos_analytics_reporting/static/src/js/analytics_dashboard.js',
            'pos_analytics_reporting/static/src/xml/dashboard_templates.xml',
            'pos_analytics_reporting/static/src/css/dashboard.css',
            # Chart.js library
            'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js',
        ],
        'web.assets_frontend': [
            'pos_analytics_reporting/static/src/css/dashboard.css',
        ],
    },
    'external_dependencies': {
        'python': ['xlsxwriter'],
    },
    'installable': True,
    'auto_install': False,
    'application': True,
    'license': 'LGPL-3',
    'author': 'Fynlo Development Team',
    'website': 'https://www.fynlo.com',
    'support': 'support@fynlo.com',
}