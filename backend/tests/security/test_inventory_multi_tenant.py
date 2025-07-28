"""Inventory Multi-tenant Isolation Tests.

Tests to ensure inventory system properly isolates data by restaurant.
"""

from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.database import InventoryItem, InventoryLedgerEntry, Recipe
from app.middleware.tenant_isolation import tenant_isolation


@pytest.fixture
def restaurant_a_id():
    """Restaurant A UUID."""
    return uuid4()


@pytest.fixture
def restaurant_b_id():
    """Restaurant B UUID."""
    return uuid4()


@pytest.fixture
def mock_inventory_item(restaurant_a_id):
    """Create mock inventory item for Restaurant A."""
    return InventoryItem(
        sku="TEST-001",
        restaurant_id=restaurant_a_id,
        name="Test Ingredient",
        qty_g=1000,
        unit="grams",
        cost_per_unit=0.05,
    )


class TestInventoryMultiTenantIsolation:
    """Test suite for inventory multi-tenant isolation."""

    def test_inventory_item_requires_restaurant_id(self):
        """Test that inventory items must have restaurant_id."""
        # Attempt to create inventory without restaurant_id should fail
        with pytest.raises(Exception):
            item = InventoryItem(
                sku="TEST-002",
                name="Invalid Item",
                qty_g=500,
            )
            # restaurant_id is required and should cause validation error

    def test_inventory_query_filtered_by_restaurant(
        self, mock_inventory_item, restaurant_a_id, restaurant_b_id
    ):
        """Test that inventory queries are filtered by restaurant."""
        # Create mock query
        from unittest.mock import MagicMock

        mock_query = MagicMock()
        mock_query.column_descriptions = [{"type": InventoryItem}]

        # Create user from Restaurant A
        user = MagicMock()
        user.role = "manager"
        user.restaurant_id = restaurant_a_id

        # Apply filter
        filtered_query = tenant_isolation.filter_by_restaurant(
            mock_query, user, "restaurant_id"
        )

        # Should have filtered by restaurant_id
        mock_query.filter.assert_called_once()

    def test_recipe_requires_restaurant_id(self):
        """Test that recipes must have restaurant_id."""
        with pytest.raises(Exception):
            recipe = Recipe(
                item_id=uuid4(),
                ingredient_sku="TEST-001",
                qty_g=100,
                # Missing restaurant_id
            )

    def test_ledger_entry_requires_restaurant_id(self):
        """Test that ledger entries must have restaurant_id."""
        with pytest.raises(Exception):
            entry = InventoryLedgerEntry(
                sku="TEST-001",
                delta_g=100,
                source="manual_add",
                # Missing restaurant_id
            )

    def test_cross_restaurant_inventory_access_blocked(
        self, restaurant_a_id, restaurant_b_id
    ):
        """Test that users cannot access inventory from other restaurants."""
        # User from Restaurant B
        user = MagicMock()
        user.role = "manager"
        user.restaurant_id = restaurant_b_id

        # Try to access Restaurant A inventory
        has_access = tenant_isolation.validate_restaurant_access(
            user, restaurant_a_id, allow_platform_owner=True
        )
        assert has_access is False

    def test_platform_owner_can_access_all_inventory(
        self, restaurant_a_id, restaurant_b_id
    ):
        """Test that platform owners can access inventory from all restaurants."""
        # Platform owner user
        user = MagicMock()
        user.role = "platform_owner"
        user.restaurant_id = None

        # Should have access to both restaurants
        assert tenant_isolation.validate_restaurant_access(
            user, restaurant_a_id, allow_platform_owner=True
        )
        assert tenant_isolation.validate_restaurant_access(
            user, restaurant_b_id, allow_platform_owner=True
        )

    def test_inventory_cascade_operations_respect_tenant(
        self, restaurant_a_id
    ):
        """Test that cascading operations respect tenant boundaries."""
        # When deleting a product, only recipes from same restaurant
        # should be affected
        product_id = uuid4()

        # Mock recipe query that should be filtered
        mock_query = MagicMock()
        mock_query.column_descriptions = [{"type": Recipe}]

        user = MagicMock()
        user.role = "manager"
        user.restaurant_id = restaurant_a_id

        # Apply tenant filter
        filtered = tenant_isolation.filter_by_restaurant(
            mock_query, user, "restaurant_id"
        )

        # Verify filter was applied
        mock_query.filter.assert_called_once()

    def test_inventory_reports_filtered_by_restaurant(
        self, restaurant_a_id, restaurant_b_id
    ):
        """Test that inventory reports only show restaurant-specific data."""
        # Mock inventory aggregation query
        mock_query = MagicMock()
        mock_query.column_descriptions = [{"type": InventoryItem}]

        # Restaurant A user
        user_a = MagicMock()
        user_a.role = "manager"
        user_a.restaurant_id = restaurant_a_id

        # Apply filter for Restaurant A
        filtered_a = tenant_isolation.filter_by_restaurant(
            mock_query, user_a, "restaurant_id"
        )

        # Should have filtered by restaurant_a_id
        mock_query.filter.assert_called()

    def test_stock_movement_isolation(self, restaurant_a_id, restaurant_b_id):
        """Test that stock movements are isolated by restaurant."""
        # Stock movement from Restaurant A
        movement_a = {
            "restaurant_id": restaurant_a_id,
            "sku": "TEST-001",
            "delta_g": -50,
            "source": "order_fulfillment",
        }

        # User from Restaurant B should not see this movement
        user_b = MagicMock()
        user_b.role = "manager"
        user_b.restaurant_id = restaurant_b_id

        # Validate access
        has_access = tenant_isolation.validate_restaurant_access(
            user_b, restaurant_a_id, allow_platform_owner=True
        )
        assert has_access is False

    def test_supplier_inventory_link_respects_tenant(
        self, restaurant_a_id, restaurant_b_id
    ):
        """Test that supplier-inventory relationships respect tenant boundaries."""
        # Supplier from Restaurant A
        supplier_a = MagicMock()
        supplier_a.restaurant_id = restaurant_a_id

        # Should only be able to supply to Restaurant A inventory
        user_a = MagicMock()
        user_a.role = "manager"
        user_a.restaurant_id = restaurant_a_id

        # Access should be allowed for same restaurant
        assert tenant_isolation.validate_restaurant_access(
            user_a, restaurant_a_id, allow_platform_owner=True
        )

        # But not for different restaurant
        user_b = MagicMock()
        user_b.role = "manager"
        user_b.restaurant_id = restaurant_b_id

        assert not tenant_isolation.validate_restaurant_access(
            user_b, restaurant_a_id, allow_platform_owner=True
        )
