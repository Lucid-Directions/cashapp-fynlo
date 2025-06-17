# -*- coding: utf-8 -*-

"""
Test Configuration Module
Phase 4: Production Readiness - Testing Infrastructure

Provides configuration settings and constants for the comprehensive testing suite.
"""

import os
import logging
from unittest.mock import MagicMock

# Test environment configuration
TEST_ENV = {
    'database': {
        'name': 'test_cashapp_pos',
        'user': 'test_user',
        'password': 'test_password',
        'host': 'localhost',
        'port': 5432,
        'isolation_level': 'SERIALIZABLE'
    },
    'redis': {
        'host': 'localhost',
        'port': 6379,
        'db': 15,  # Use separate Redis DB for tests
        'password': None
    },
    'websocket': {
        'host': 'localhost',
        'port': 8765,
        'test_connections': 100,
        'max_test_connections': 1000
    }
}

# Performance testing targets
PERFORMANCE_TARGETS = {
    'api_response_time': 0.1,  # 100ms
    'database_query_time': 0.05,  # 50ms
    'websocket_message_time': 0.05,  # 50ms
    'concurrent_users': 2000,
    'requests_per_second': 1000,
    'memory_usage_mb': 512,
    'cpu_usage_percent': 80
}

# Security testing configuration
SECURITY_CONFIG = {
    'jwt_secret': 'test_jwt_secret_key_for_testing_only',
    'encryption_key': 'test_encryption_key_32_characters',
    'test_users': {
        'admin': {
            'username': 'test_admin',
            'password': 'test_admin_password',
            'role': 'admin'
        },
        'manager': {
            'username': 'test_manager',
            'password': 'test_manager_password',
            'role': 'manager'
        },
        'employee': {
            'username': 'test_employee',
            'password': 'test_employee_password',
            'role': 'employee'
        }
    },
    'vulnerability_scan': {
        'sql_injection_payloads': [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "' UNION SELECT * FROM users --"
        ],
        'xss_payloads': [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>"
        ]
    }
}

# Load testing configuration
LOAD_TEST_CONFIG = {
    'scenarios': {
        'light_load': {
            'users': 10,
            'duration': '30s',
            'ramp_up': '10s'
        },
        'normal_load': {
            'users': 100,
            'duration': '2m',
            'ramp_up': '30s'
        },
        'heavy_load': {
            'users': 500,
            'duration': '5m',
            'ramp_up': '1m'
        },
        'stress_test': {
            'users': 1000,
            'duration': '10m',
            'ramp_up': '2m'
        },
        'spike_test': {
            'users': 2000,
            'duration': '15m',
            'ramp_up': '5m'
        }
    },
    'endpoints': [
        '/api/auth/login',
        '/api/orders',
        '/api/payments/stripe/create-intent',
        '/api/timeclock/clock-in',
        '/api/sync/status'
    ]
}

# Test data fixtures
TEST_FIXTURES = {
    'products': [
        {
            'name': 'Test Burger',
            'price': 12.99,
            'category': 'Food',
            'description': 'Test burger for unit testing'
        },
        {
            'name': 'Test Drink',
            'price': 3.99,
            'category': 'Beverage',
            'description': 'Test drink for unit testing'
        }
    ],
    'customers': [
        {
            'name': 'Test Customer',
            'email': 'test@example.com',
            'phone': '+1234567890'
        }
    ],
    'employees': [
        {
            'name': 'Test Employee',
            'email': 'employee@test.com',
            'pin': '1234',
            'role': 'cashier'
        }
    ],
    'orders': [
        {
            'customer_id': 1,
            'items': [
                {'product_id': 1, 'quantity': 2, 'price': 12.99},
                {'product_id': 2, 'quantity': 1, 'price': 3.99}
            ],
            'total': 29.97,
            'payment_method': 'stripe'
        }
    ]
}

# Mock configurations for external services
MOCK_CONFIGS = {
    'stripe': {
        'api_key': 'sk_test_mock_stripe_key',
        'webhook_secret': 'whsec_mock_webhook_secret',
        'mock_responses': {
            'payment_intent_create': {
                'id': 'pi_test_1234567890',
                'status': 'requires_payment_method',
                'amount': 2997,
                'currency': 'usd'
            },
            'payment_intent_confirm': {
                'id': 'pi_test_1234567890',
                'status': 'succeeded',
                'amount': 2997,
                'currency': 'usd'
            }
        }
    },
    'apple_pay': {
        'merchant_id': 'merchant.test.fynlo.pos',
        'certificate_path': '/test/certs/apple_pay_test.pem',
        'mock_validation_response': {
            'status': 'success',
            'merchant_session': 'test_merchant_session_data'
        }
    }
}

# Coverage configuration
COVERAGE_CONFIG = {
    'target_coverage': {
        'unit_tests': 90,
        'integration_tests': 85,
        'overall': 88
    },
    'exclude_patterns': [
        '*/tests/*',
        '*/migrations/*',
        '*/__pycache__/*',
        '*/venv/*'
    ],
    'include_patterns': [
        'addons/point_of_sale_api/models/*',
        'addons/point_of_sale_api/controllers/*'
    ]
}

# Logging configuration for tests
TEST_LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'detailed': {
            'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        },
        'simple': {
            'format': '%(levelname)s: %(message)s'
        }
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'level': 'INFO',
            'formatter': 'simple',
            'stream': 'ext://sys.stdout'
        },
        'file': {
            'class': 'logging.FileHandler',
            'level': 'DEBUG',
            'formatter': 'detailed',
            'filename': 'tests.log',
            'mode': 'w'
        }
    },
    'loggers': {
        'test': {
            'level': 'DEBUG',
            'handlers': ['console', 'file'],
            'propagate': False
        }
    }
}

def get_test_database_uri():
    """Get test database connection URI"""
    db_config = TEST_ENV['database']
    return f"postgresql://{db_config['user']}:{db_config['password']}@{db_config['host']}:{db_config['port']}/{db_config['name']}"

def get_test_redis_uri():
    """Get test Redis connection URI"""
    redis_config = TEST_ENV['redis']
    return f"redis://{redis_config['host']}:{redis_config['port']}/{redis_config['db']}"

def setup_test_logging():
    """Setup logging for test environment"""
    import logging.config
    logging.config.dictConfig(TEST_LOGGING)
    return logging.getLogger('test')

def create_mock_stripe_client():
    """Create mock Stripe client for testing"""
    mock_client = MagicMock()
    mock_client.PaymentIntent.create.return_value = MOCK_CONFIGS['stripe']['mock_responses']['payment_intent_create']
    mock_client.PaymentIntent.confirm.return_value = MOCK_CONFIGS['stripe']['mock_responses']['payment_intent_confirm']
    return mock_client

def create_mock_apple_pay_client():
    """Create mock Apple Pay client for testing"""
    mock_client = MagicMock()
    mock_client.validate_merchant.return_value = MOCK_CONFIGS['apple_pay']['mock_validation_response']
    return mock_client

# Test environment validation
def validate_test_environment():
    """Validate that test environment is properly configured"""
    errors = []
    
    # Check database configuration
    required_db_keys = ['name', 'user', 'password', 'host', 'port']
    for key in required_db_keys:
        if key not in TEST_ENV['database']:
            errors.append(f"Missing database configuration: {key}")
    
    # Check Redis configuration
    required_redis_keys = ['host', 'port', 'db']
    for key in required_redis_keys:
        if key not in TEST_ENV['redis']:
            errors.append(f"Missing Redis configuration: {key}")
    
    # Check performance targets
    required_perf_keys = ['api_response_time', 'database_query_time', 'concurrent_users']
    for key in required_perf_keys:
        if key not in PERFORMANCE_TARGETS:
            errors.append(f"Missing performance target: {key}")
    
    if errors:
        raise ValueError(f"Test environment validation failed: {'; '.join(errors)}")
    
    return True

# Initialize test environment
def initialize_test_environment():
    """Initialize test environment with proper configuration"""
    try:
        validate_test_environment()
        setup_test_logging()
        logger = logging.getLogger('test')
        logger.info("Test environment initialized successfully")
        logger.info(f"Coverage target: {COVERAGE_CONFIG['target_coverage']['overall']}%")
        logger.info(f"Performance target: {PERFORMANCE_TARGETS['concurrent_users']} concurrent users")
        logger.info(f"Security target: 0 critical vulnerabilities")
        return True
    except Exception as e:
        print(f"Failed to initialize test environment: {e}")
        return False 