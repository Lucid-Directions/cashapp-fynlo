"""
Test configuration and fixtures
"""
import pytest
from unittest.mock import Mock, MagicMock
import sys

# Mock the Square SDK before any imports
mock_square = MagicMock()
mock_square.client = MagicMock()
mock_square.types = MagicMock()
sys.modules['square'] = mock_square
sys.modules['square.client'] = mock_square.client
sys.modules['square.types'] = mock_square.types

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
def mock_database_session():
    """Mock database session for testing"""
    return Mock()