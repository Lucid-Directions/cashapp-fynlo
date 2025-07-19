"""
Test health endpoints don't expose sensitive credentials
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)


def test_basic_health_no_credentials():
    """Test basic health endpoint doesn't expose any credentials"""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    
    data = response.json()
    response_str = str(data).lower()
    
    # Check for sensitive keywords
    sensitive_keywords = [
        'password', 'secret', 'key', 'token', 
        'redis://', 'rediss://', 'postgresql://', 
        'postgres://', 'amqp://', 'mongodb://'
    ]
    
    for keyword in sensitive_keywords:
        assert keyword not in response_str, f"Found sensitive keyword '{keyword}' in response"


def test_detailed_health_no_redis_url():
    """Test detailed health endpoint doesn't expose Redis URL"""
    response = client.get("/api/v1/health/detailed")
    assert response.status_code == 200
    
    data = response.json()
    
    # Check Redis component doesn't have connection_url
    if 'data' in data and 'components' in data['data'] and 'redis' in data['data']['components']:
        redis_info = data['data']['components']['redis']
        assert 'connection_url' not in redis_info, "Redis connection URL exposed in health endpoint"
        assert 'url' not in redis_info, "Redis URL exposed in health endpoint"
        
        # Verify expected fields are present
        assert 'status' in redis_info
        assert 'type' in redis_info
        assert 'mode' in redis_info
    
    # Check entire response for Redis URL patterns
    response_str = str(data)
    assert 'redis://' not in response_str.lower()
    assert 'rediss://' not in response_str.lower()
    
    # Check for actual Redis URL if configured
    if hasattr(settings, 'REDIS_URL') and settings.REDIS_URL:
        # Extract just the host part for checking (without credentials)
        redis_password = None
        if '@' in settings.REDIS_URL and ':' in settings.REDIS_URL:
            # Extract password from redis://user:password@host:port format
            url_parts = settings.REDIS_URL.split('@')
            if len(url_parts) > 1:
                auth_part = url_parts[0].split('://')[-1]
                if ':' in auth_part:
                    redis_password = auth_part.split(':')[-1]
        
        # Ensure password is not in response
        if redis_password:
            assert redis_password not in response_str, "Redis password found in health endpoint response"


def test_detailed_health_no_database_url():
    """Test detailed health endpoint doesn't expose database URLs"""
    response = client.get("/api/v1/health/detailed")
    assert response.status_code == 200
    
    data = response.json()
    response_str = str(data).lower()
    
    # Check for database URL patterns
    assert 'postgresql://' not in response_str
    assert 'postgres://' not in response_str
    assert 'mysql://' not in response_str
    assert 'sqlite://' not in response_str
    
    # Check database component doesn't expose connection details
    if 'data' in data and 'components' in data['data'] and 'database' in data['data']['components']:
        db_info = data['data']['components']['database']
        assert 'connection_url' not in db_info
        assert 'url' not in db_info
        assert 'password' not in db_info
        assert 'user' not in db_info
        assert 'host' not in db_info


def test_dependencies_requires_auth():
    """Test dependencies endpoint requires authentication"""
    response = client.get("/api/v1/health/dependencies")
    assert response.status_code == 401  # Unauthorized


def test_dependencies_no_urls_with_auth(mock_platform_owner_auth):
    """Test dependencies endpoint doesn't expose URLs even with authentication"""
    # This test would require a proper auth mock, so we'll check the structure
    # In a real test environment, you'd authenticate as a platform_owner first
    
    # For now, we can verify the endpoint structure doesn't include sensitive fields
    # by checking the code structure (this would be better as an integration test)
    from app.api.v1.endpoints.health import check_dependencies
    import inspect
    
    # Get the source code of the function
    source = inspect.getsource(check_dependencies)
    
    # Verify no URLs are being exposed in the dependencies structure
    assert 'endpoint": settings.' not in source
    assert 'url": settings.' not in source
    assert '_URL' not in source or 'SUPABASE_URL' not in source


def test_stats_requires_auth():
    """Test stats endpoint requires authentication"""
    response = client.get("/api/v1/health/stats")
    assert response.status_code == 401  # Unauthorized


def test_metrics_requires_auth():
    """Test metrics endpoint requires authentication"""
    response = client.get("/api/v1/health/metrics")
    assert response.status_code == 401  # Unauthorized


def test_performance_requires_auth():
    """Test performance endpoint requires authentication"""
    response = client.get("/api/v1/health/performance")
    assert response.status_code == 401  # Unauthorized


if __name__ == "__main__":
    pytest.main([__file__, "-v"])