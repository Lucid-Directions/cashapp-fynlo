# Fynlo POS Backend Testing Guide

## Overview

This test suite uses **real services** in test/sandbox mode for true end-to-end testing. No mocks are used - all tests interact with actual databases, payment providers, and external services.

## Philosophy

- **Real Services Only**: Tests use actual PostgreSQL, Redis, and payment provider sandboxes
- **User Workflow Focus**: Tests follow real user journeys from login to payment
- **Multi-tenant Isolation**: Every test verifies proper restaurant data isolation
- **Security First**: Comprehensive security testing for SQL injection, XSS, and access control

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
pip install -r requirements-test.txt
```

### 2. Set Up Test Database

```bash
# Run the setup script
./setup_test_db.sh

# Or manually:
psql -U postgres -c "CREATE USER fynlo_test WITH PASSWORD 'fynlo_test_password' CREATEDB;"
psql -U postgres -c "CREATE DATABASE fynlo_pos_test OWNER fynlo_test;"
```

### 3. Configure Test Environment

Copy `.env.test.example` to `.env.test` and fill in your test credentials:

```bash
# Required Services
DATABASE_URL=postgresql://fynlo_test:fynlo_test_password@localhost:5432/fynlo_pos_test
REDIS_URL=redis://localhost:6379/15

# Payment Provider Sandboxes
STRIPE_TEST_SECRET_KEY=sk_test_...
SQUARE_SANDBOX_ACCESS_TOKEN=...
SUMUP_SANDBOX_API_KEY=...

# Supabase Test Project
SUPABASE_TEST_URL=https://[project].supabase.co
SUPABASE_TEST_ANON_KEY=...
SUPABASE_TEST_SERVICE_ROLE_KEY=...
```

### 4. Start Required Services

```bash
# PostgreSQL
brew services start postgresql

# Redis
brew services start redis

# Or with Docker:
docker-compose -f docker-compose.test.yml up -d
```

## Running Tests

### All Tests
```bash
APP_ENV=test pytest
```

### Specific Test Categories
```bash
# Security tests
APP_ENV=test pytest tests/security/ -v

# End-to-end workflows
APP_ENV=test pytest tests/e2e/ -v

# Payment provider tests
APP_ENV=test pytest tests/e2e/test_payment_providers.py -v

# With coverage
APP_ENV=test pytest --cov=app --cov-report=html
```

### Run with Real Payment Providers
```bash
# Skip tests without credentials
APP_ENV=test pytest -v -m "not requires_stripe and not requires_square"

# Run only configured providers
APP_ENV=test STRIPE_TEST_SECRET_KEY=sk_test_... pytest tests/e2e/test_payment_providers.py::TestStripeIntegration
```

## Test Structure

```
tests/
├── conftest.py           # Real database and service fixtures
├── e2e/                  # End-to-end user workflows
│   ├── test_user_workflow.py
│   └── test_payment_providers.py
├── security/             # Security testing
│   ├── test_sql_injection.py
│   ├── test_authentication.py
│   └── test_multi_tenant_isolation.py
├── integration/          # API integration tests
│   ├── test_orders_api.py
│   └── test_restaurants_api.py
└── unit/                 # Business logic tests
    ├── test_fee_calculations.py
    └── test_order_validation.py
```

## Key Testing Patterns

### 1. Real Database Transactions

```python
@pytest.mark.asyncio
async def test_order_creation(db_session, test_restaurant):
    """Uses real PostgreSQL with rollback after test"""
    order = Order(
        restaurant_id=test_restaurant.id,
        total_amount=50.00
    )
    db_session.add(order)
    await db_session.commit()
    
    # Test runs with real database
    assert order.id is not None
    # Automatic rollback after test
```

### 2. Real Payment Provider Testing

```python
@pytest.mark.asyncio
async def test_stripe_payment(client, test_order, auth_headers):
    """Uses Stripe test mode with real API calls"""
    response = await client.post(
        f"/api/v1/orders/{test_order.id}/payment",
        json={
            "provider": "stripe",
            "test_mode": True,
            "card": "4242424242424242"  # Test card
        },
        headers=auth_headers
    )
    assert response.status_code == 200
```

### 3. Multi-tenant Isolation Testing

```python
@pytest.mark.asyncio
async def test_restaurant_isolation(client, restaurant_a, restaurant_b):
    """Verifies data isolation between restaurants"""
    # User from restaurant A cannot access restaurant B data
    response = await client.get(
        f"/api/v1/restaurants/{restaurant_b.id}",
        headers=restaurant_a_auth
    )
    assert response.status_code == 403
```

## Payment Provider Test Cards

### Stripe
- Success: `4242424242424242`
- Decline: `4000000000000002`
- Insufficient Funds: `4000000000009995`

### Square Sandbox
- Success: `cnon:card-nonce-ok`
- Decline: `cnon:card-nonce-declined`
- CVV Failure: `cnon:card-nonce-rejected-cvv`

### SumUp
- Use SumUp test app for sandbox transactions
- Test merchant account required

## Debugging Tests

### View SQL Queries
```python
# In conftest.py, set echo=True
engine = create_async_engine(DATABASE_URL, echo=True)
```

### Check Redis State
```python
@pytest.fixture
async def redis_client():
    client = await redis.from_url(REDIS_URL)
    yield client
    # Optionally inspect cache:
    keys = await client.keys("*")
    print(f"Redis keys after test: {keys}")
```

### Payment Provider Logs
- Stripe: Check dashboard.stripe.com/test/logs
- Square: View in Square Sandbox Dashboard
- SumUp: Check merchant.sumup.com/test

## CI/CD Integration

```yaml
# .github/workflows/test.yml
test:
  services:
    postgres:
      image: postgres:15
      env:
        POSTGRES_PASSWORD: postgres
    redis:
      image: redis:7
  
  steps:
    - name: Setup test database
      run: |
        psql -h localhost -U postgres -c "CREATE DATABASE fynlo_pos_test;"
    
    - name: Run tests
      env:
        APP_ENV: test
        DATABASE_URL: postgresql://postgres:postgres@localhost/fynlo_pos_test
        REDIS_URL: redis://localhost:6379
      run: |
        pytest --cov=app --cov-report=xml
```

## Best Practices

1. **Always use real services** - No mocks except for truly external APIs
2. **Test user workflows** - Not just individual endpoints
3. **Verify security** - Every test should consider multi-tenant isolation
4. **Clean up resources** - Use fixtures with proper teardown
5. **Use transactions** - Rollback after each test for isolation
6. **Test edge cases** - Network failures, timeouts, invalid data
7. **Document test data** - Clear comments on what each fixture represents

## Troubleshooting

### "Database does not exist"
Run `./setup_test_db.sh` to create the test database

### "Connection refused" 
Ensure PostgreSQL and Redis are running

### "Invalid API credentials"
Check `.env.test` has valid sandbox/test credentials

### "Test timeout"
Real API calls take time - increase pytest timeout:
```bash
pytest --timeout=30
```