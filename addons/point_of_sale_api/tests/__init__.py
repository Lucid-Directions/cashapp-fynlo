# -*- coding: utf-8 -*-

"""
Fynlo POS API Testing Suite
Phase 4: Production Readiness - Comprehensive Testing Infrastructure

This module provides a complete testing framework for the Fynlo POS API system,
covering unit tests, integration tests, load tests, and security tests.

Test Coverage Target: 90%+ unit coverage, 85%+ integration coverage
Performance Target: 2000+ concurrent users, <100ms API response
Security Target: 0 critical vulnerabilities, >95% security audit score
"""

# Test configuration and utilities
from . import test_config
from . import test_utils
from . import test_fixtures

# Unit tests for core services
from . import test_websocket_service
from . import test_stripe_payment_service
from . import test_apple_pay_service
from . import test_transaction_manager
from . import test_data_sync_service
from . import test_employee_timeclock_service

# Integration tests
from . import test_payment_integration
from . import test_sync_integration
from . import test_employee_integration
from . import test_websocket_integration

# API endpoint tests
from . import test_payment_api
from . import test_phase3_api
from . import test_pos_api

# Performance tests
from . import test_load_performance
from . import test_database_performance
from . import test_websocket_performance

# Security tests
from . import test_security_audit
from . import test_authentication
from . import test_authorization
from . import test_input_validation

__version__ = '4.0.0'
__phase__ = 'Phase 4: Production Readiness'
__test_coverage_target__ = '90%+'
__performance_target__ = '2000+ concurrent users'
__security_target__ = '0 critical vulnerabilities'

from . import test_auth_controller
from . import test_base_controller
from . import test_jwt_utils 