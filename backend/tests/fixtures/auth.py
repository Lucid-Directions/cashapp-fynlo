"""
Authentication fixtures for testing
"""
import pytest
from unittest.mock import Mock, AsyncMock
from datetime import datetime, timedelta
import jwt
import uuid
import os


def get_test_jwt_secret():
    """Get JWT secret for testing from environment or use default"""
    # For tests, we can use a predictable secret that's clearly for testing
    # This is not a security risk as it's only used in test environments
    return os.environ.get("TEST_JWT_SECRET", "test-jwt-secret-do-not-use-in-production")


@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client for testing"""
    client = Mock()
    
    # Mock auth methods
    # Use dynamic test tokens instead of hardcoded values
    test_access_token = f"test_access_{uuid.uuid4().hex[:8]}"
    test_refresh_token = f"test_refresh_{uuid.uuid4().hex[:8]}"
    
    client.auth.sign_in_with_password.return_value = Mock(
        user=Mock(
            id=str(uuid.uuid4()),
            email="test@example.com",
            user_metadata={"subscription_plan": "beta"}
        ),
        session=Mock(
            access_token=test_access_token,
            refresh_token=test_refresh_token
        )
    )
    
    client.auth.get_user.return_value = Mock(
        user=Mock(
            id=str(uuid.uuid4()),
            email="test@example.com",
            user_metadata={"subscription_plan": "beta"}
        )
    )
    
    client.auth.verify_otp.return_value = Mock(
        user=Mock(
            id=str(uuid.uuid4()),
            email="test@example.com"
        ),
        session=Mock(
            access_token=test_access_token
        )
    )
    
    return client


@pytest.fixture
def auth_headers():
    """Generate test authentication headers"""
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "test@example.com",
            "exp": datetime.utcnow() + timedelta(hours=1)
        },
        get_test_jwt_secret(),
        algorithm="HS256"
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def platform_owner_headers():
    """Generate platform owner authentication headers"""
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "platform@fynlo.com",
            "role": "platform_owner",
            "exp": datetime.utcnow() + timedelta(hours=1)
        },
        get_test_jwt_secret(),
        algorithm="HS256"
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def restaurant_owner_headers(test_restaurant):
    """Generate restaurant owner authentication headers"""
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "owner@restaurant.com",
            "role": "restaurant_owner",
            "restaurant_id": test_restaurant.id,
            "exp": datetime.utcnow() + timedelta(hours=1)
        },
        get_test_jwt_secret(),
        algorithm="HS256"
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def manager_headers(test_restaurant):
    """Generate manager authentication headers"""
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "manager@restaurant.com",
            "role": "manager",
            "restaurant_id": test_restaurant.id,
            "exp": datetime.utcnow() + timedelta(hours=1)
        },
        get_test_jwt_secret(),
        algorithm="HS256"
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def employee_headers(test_restaurant):
    """Generate employee authentication headers"""
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "employee@restaurant.com",
            "role": "employee",
            "restaurant_id": test_restaurant.id,
            "exp": datetime.utcnow() + timedelta(hours=1)
        },
        get_test_jwt_secret(),
        algorithm="HS256"
    )
    return {"Authorization": f"Bearer {token}"}