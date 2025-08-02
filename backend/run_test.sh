#!/bin/bash

# Set up test environment variables
# WARNING: These are LOCAL TEST ONLY values. Never use these in production!
# These keys are from the Supabase demo/local environment and are safe for testing.
export SUPABASE_URL="http://localhost:54321"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"  # Local Supabase demo key - NOT FOR PRODUCTION
export DATABASE_URL="postgresql://postgres:test@localhost:5432/fynlo_test"
export APP_ENV="test"
export JWT_SECRET_KEY="test_secret_key_for_jwt_authentication_in_tests"  # Test-only secret
export PLATFORM_OWNER_EMAIL="platform@fynlo.co.uk"
export ENVIRONMENT="test"
export REDIS_URL="redis://localhost:6379/0"
export RESEND_API_KEY="test_resend_api_key"  # Mock API key for testing

# Activate virtual environment
source venv/bin/activate

# Run specific test
python -m pytest tests/test_multi_tenant_role_based_access.py::TestMultiTenantRoleBasedAccess::test_omega_owner_can_switch_restaurants -v -s