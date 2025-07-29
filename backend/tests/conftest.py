"""
Test configuration and fixtures
"""
import pytest
import asyncio
from unittest.mock import Mock, MagicMock, AsyncMock
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock external dependencies before imports
mock_square = MagicMock()
mock_square.client = MagicMock()
mock_square.types = MagicMock()
sys.modules['square'] = mock_square
sys.modules['square.client'] = mock_square.client
sys.modules['square.types'] = mock_square.types

# Mock Stripe
mock_stripe = MagicMock()
sys.modules['stripe'] = mock_stripe

# Mock other payment providers
sys.modules['sumup'] = MagicMock()

# Import all fixtures
from tests.fixtures.database import *
from tests.fixtures.auth import *

# Configure pytest-asyncio
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def mock_square_client():
    """Mock Square client for testing"""
    mock_client = Mock()
    mock_client.locations.list_locations.return_value = Mock(
        is_error=Mock(return_value=False),
        body={'locations': [{'id': 'test-location-id'}]}
    )
    mock_client.payments.create_payment.return_value = Mock(
        is_error=Mock(return_value=False),
        body={'payment': {'id': 'test-payment-id', 'status': 'COMPLETED'}}
    )
    mock_client.payments.get_payment.return_value = Mock(
        is_error=Mock(return_value=False),
        body={'payment': {'id': 'test-payment-id', 'status': 'COMPLETED'}}
    )
    mock_client.refunds.refund_payment.return_value = Mock(
        is_error=Mock(return_value=False),
        body={'refund': {'id': 'test-refund-id', 'status': 'COMPLETED'}}
    )
    return mock_client

@pytest.fixture
def mock_redis():
    """Mock Redis client for testing"""
    mock_redis_client = AsyncMock()
    mock_redis_client.get.return_value = None
    mock_redis_client.set.return_value = True
    mock_redis_client.delete.return_value = True
    mock_redis_client.expire.return_value = True
    return mock_redis_client

@pytest.fixture
def mock_database_session():
    """Mock database session for testing"""
    session = Mock()
    session.commit = Mock()
    session.rollback = Mock()
    session.refresh = Mock()
    session.add = Mock()
    session.query = Mock()
    return session

@pytest.fixture(autouse=True)
def reset_db():
    """Reset database state between tests"""
    yield
    # Cleanup code here if needed

# Configure test environment
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test_secret"
os.environ["REDIS_URL"] = "redis://localhost:6379/15"  # Use test DB