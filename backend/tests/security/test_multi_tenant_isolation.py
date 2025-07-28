"""Multi-tenant Isolation Security Tests for Fynlo POS.

Ensures proper restaurant data isolation and prevents cross-tenant access.
"""

from unittest.mock import MagicMock, Mock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.middleware.tenant_isolation import (
    TenantIsolationMiddleware,
    get_user_restaurant_id,
    validate_restaurant_access,
)
from app.models.user import User


@pytest.fixture
def tenant_middleware():
    """Create tenant isolation middleware instance."""
    return TenantIsolationMiddleware()


@pytest.fixture
def mock_db():
    """Create mock database session."""
    return MagicMock(spec=Session)


@pytest.fixture
def restaurant_a_id():
    """Restaurant A UUID."""
    return uuid4()


@pytest.fixture
def restaurant_b_id():
    """Restaurant B UUID."""
    return uuid4()


@pytest.fixture
def platform_owner_user():
    """Create platform owner user."""
    user = Mock(spec=User)
    user.id = uuid4()
    user.email = "platform@fynlo.com"
    user.role = "platform_owner"
    user.restaurant_id = None
    user.is_active = True
    return user


@pytest.fixture
def restaurant_owner_user(restaurant_a_id):
    """Create restaurant owner user for Restaurant A."""
    user = Mock(spec=User)
    user.id = uuid4()
    user.email = "owner@restaurant-a.com"
    user.role = "restaurant_owner"
    user.restaurant_id = restaurant_a_id
    user.is_active = True
    return user


@pytest.fixture
def manager_user(restaurant_a_id):
    """Create manager user for Restaurant A."""
    user = Mock(spec=User)
    user.id = uuid4()
    user.email = "manager@restaurant-a.com"
    user.role = "manager"
    user.restaurant_id = restaurant_a_id
    user.is_active = True
    return user


@pytest.fixture
def employee_user(restaurant_b_id):
    """Create employee user for Restaurant B."""
    user = Mock(spec=User)
    user.id = uuid4()
    user.email = "employee@restaurant-b.com"
    user.role = "employee"
    user.restaurant_id = restaurant_b_id
    user.is_active = True
    return user


class TestMultiTenantIsolation:
    """Test suite for multi-tenant isolation."""

    def test_restaurant_user_cannot_access_other_restaurant(
        self, tenant_middleware, restaurant_owner_user, restaurant_b_id
    ):
        """Test that restaurant users cannot access other restaurants."""
        # Restaurant A owner trying to access Restaurant B
        has_access = tenant_middleware.validate_restaurant_access(
            restaurant_owner_user, restaurant_b_id, allow_platform_owner=True
        )
        assert has_access is False

    def test_user_can_access_own_restaurant(
        self, tenant_middleware, restaurant_owner_user, restaurant_a_id
    ):
        """Test that users can access their own restaurant."""
        has_access = tenant_middleware.validate_restaurant_access(
            restaurant_owner_user, restaurant_a_id, allow_platform_owner=True
        )
        assert has_access is True

    def test_platform_owner_has_full_access(
        self,
        tenant_middleware,
        platform_owner_user,
        restaurant_a_id,
        restaurant_b_id,
    ):
        """Test that platform owners can access all restaurants.

        Should have access when allow_platform_owner=True.
        """
        # Should have access to Restaurant A
        assert (
            tenant_middleware.validate_restaurant_access(
                platform_owner_user, restaurant_a_id, allow_platform_owner=True
            )
            is True
        )

        # Should have access to Restaurant B
        assert (
            tenant_middleware.validate_restaurant_access(
                platform_owner_user, restaurant_b_id, allow_platform_owner=True
            )
            is True
        )

    def test_platform_owner_restricted_when_not_allowed(
        self, tenant_middleware, platform_owner_user, restaurant_a_id
    ):
        """Test platform owners restricted when explicitly not allowed."""
        has_access = tenant_middleware.validate_restaurant_access(
            platform_owner_user, restaurant_a_id, allow_platform_owner=False
        )
        assert has_access is False

    def test_cross_role_isolation(
        self,
        tenant_middleware,
        manager_user,
        employee_user,
        restaurant_a_id,
        restaurant_b_id,
    ):
        """Test isolation between different roles in different restaurants."""
        # Manager from Restaurant A cannot access Restaurant B
        assert (
            tenant_middleware.validate_restaurant_access(
                manager_user, restaurant_b_id
            )
            is False
        )

        # Employee from Restaurant B cannot access Restaurant A
        assert (
            tenant_middleware.validate_restaurant_access(
                employee_user, restaurant_a_id
            )
            is False
        )

    def test_validate_restaurant_access_dependency(
        self, restaurant_owner_user, restaurant_a_id, restaurant_b_id
    ):
        """Test the FastAPI dependency for restaurant access validation."""
        # Should succeed for own restaurant
        result = validate_restaurant_access(
            restaurant_a_id, restaurant_owner_user
        )
        assert result == restaurant_a_id

        # Should raise HTTPException for other restaurant
        with pytest.raises(HTTPException) as exc_info:
            validate_restaurant_access(restaurant_b_id, restaurant_owner_user)
        assert exc_info.value.status_code == 403
        assert "Access denied" in exc_info.value.detail

    def test_get_user_restaurant_id_platform_owner(
        self, platform_owner_user, restaurant_a_id
    ):
        """Test that platform owners must specify restaurant_id."""
        # Should raise exception when no restaurant_id provided
        with pytest.raises(HTTPException) as exc_info:
            get_user_restaurant_id(platform_owner_user, None)
        assert exc_info.value.status_code == 400
        assert "must specify restaurant_id" in exc_info.value.detail

        # Should return the specified restaurant_id
        result = get_user_restaurant_id(platform_owner_user, restaurant_a_id)
        assert result == restaurant_a_id

    def test_get_user_restaurant_id_regular_user(
        self, restaurant_owner_user, restaurant_a_id, restaurant_b_id
    ):
        """Test restaurant_id resolution for regular users."""
        # Should use user's restaurant_id when none specified
        result = get_user_restaurant_id(restaurant_owner_user, None)
        assert result == restaurant_a_id

        # Should validate when restaurant_id is specified
        result = get_user_restaurant_id(restaurant_owner_user, restaurant_a_id)
        assert result == restaurant_a_id

        # Should reject different restaurant_id
        with pytest.raises(HTTPException) as exc_info:
            get_user_restaurant_id(restaurant_owner_user, restaurant_b_id)
        assert exc_info.value.status_code == 403

    def test_user_without_restaurant_assignment(self):
        """Test handling of users without restaurant assignment."""
        user = Mock(spec=User)
        user.role = "employee"
        user.restaurant_id = None

        with pytest.raises(HTTPException) as exc_info:
            get_user_restaurant_id(user, None)
        assert exc_info.value.status_code == 400
        assert "not assigned to any restaurant" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_require_restaurant_context_decorator(
        self,
        tenant_middleware,
        restaurant_owner_user,
        restaurant_a_id,
        restaurant_b_id,
    ):
        """Test the require_restaurant_context decorator."""
        call_count = 0

        @tenant_middleware.require_restaurant_context()
        async def test_endpoint(restaurant_id: UUID, current_user: User):
            nonlocal call_count
            call_count += 1
            return {"restaurant_id": str(restaurant_id)}

        # Should succeed with correct restaurant
        result = await test_endpoint(
            restaurant_id=restaurant_a_id, current_user=restaurant_owner_user
        )
        assert call_count == 1
        assert result["restaurant_id"] == str(restaurant_a_id)

        # Should fail with wrong restaurant
        with pytest.raises(HTTPException) as exc_info:
            await test_endpoint(
                restaurant_id=restaurant_b_id,
                current_user=restaurant_owner_user,
            )
        assert exc_info.value.status_code == 403
        assert call_count == 1  # Should not have been called again

    def test_filter_by_restaurant_regular_user(
        self, tenant_middleware, restaurant_owner_user, mock_db
    ):
        """Test query filtering for regular users."""
        # Create mock query
        mock_query = MagicMock()
        mock_model = MagicMock()
        mock_model.restaurant_id = "restaurant_id"
        mock_query.column_descriptions = [{"type": mock_model}]

        # Apply filter
        tenant_middleware.filter_by_restaurant(
            mock_query, restaurant_owner_user
        )

        # Should have called filter with user's restaurant_id
        mock_query.filter.assert_called_once()

    def test_filter_by_restaurant_platform_owner(
        self, tenant_middleware, platform_owner_user, mock_db
    ):
        """Test that platform owners see all data without filtering."""
        mock_query = MagicMock()

        # Apply filter
        filtered = tenant_middleware.filter_by_restaurant(
            mock_query, platform_owner_user
        )

        # Should return original query without filtering
        assert filtered == mock_query
        mock_query.filter.assert_not_called()

    def test_platform_specific_endpoints(
        self, tenant_middleware, platform_owner_user
    ):
        """Test that platform-specific endpoints are properly identified."""
        platform_paths = [
            "/api/v1/platform/analytics",
            "/api/v1/analytics/platform/revenue",
            "/api/v1/restaurants/all",
        ]

        for path in platform_paths:
            # Check if path is recognized as platform-specific
            unrestricted_paths = (
                tenant_middleware.platform_owner_unrestricted_paths
            )
            is_platform_path = any(
                path.startswith(allowed_path)
                for allowed_path in unrestricted_paths
            )
            assert is_platform_path is True

    @pytest.mark.asyncio
    async def test_inactive_restaurant_rejection(
        self,
        tenant_middleware,
        restaurant_owner_user,
        restaurant_a_id,
        mock_db,
    ):
        """Test inactive restaurants rejected when verify_active=True."""
        # Mock inactive restaurant
        (mock_db.query.return_value.filter.return_value.first.return_value) = (
            None
        )

        @tenant_middleware.require_restaurant_context(verify_active=True)
        async def test_endpoint(
            restaurant_id: UUID, current_user: User, db: Session
        ):
            return {"success": True}

        # Should raise HTTPException for inactive restaurant
        with pytest.raises(HTTPException) as exc_info:
            await test_endpoint(
                restaurant_id=restaurant_a_id,
                current_user=restaurant_owner_user,
                db=mock_db,
            )
        assert exc_info.value.status_code == 404
        assert "not found or inactive" in exc_info.value.detail
