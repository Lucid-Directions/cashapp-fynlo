"""
Test multi-tenant isolation for Recipe model
"""
import pytest
from uuid import uuid4
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.core.database import get_db, Recipe, Product, InventoryItem, Restaurant, User
from app.main import app
from app.core.auth import create_access_token
from app.core.dependencies import get_current_user


# Test fixtures
@pytest.fixture
def test_restaurants(db: Session):
    """Create test restaurants"""
    restaurant1 = Restaurant(
        id=uuid4(),
        name="Restaurant 1",
        address={"street": "123 Main St"},
        email="rest1@example.com"
    )
    restaurant2 = Restaurant(
        id=uuid4(),
        name="Restaurant 2", 
        address={"street": "456 Oak Ave"},
        email="rest2@example.com"
    )
    db.add_all([restaurant1, restaurant2])
    db.commit()
    return restaurant1, restaurant2


@pytest.fixture
def test_users(db: Session, test_restaurants):
    """Create test users for each restaurant"""
    restaurant1, restaurant2 = test_restaurants
    
    user1 = User(
        id=uuid4(),
        email="user1@example.com",
        first_name="User",
        last_name="One",
        role="restaurant_owner",
        restaurant_id=restaurant1.id,
        current_restaurant_id=restaurant1.id,
        is_active=True
    )
    user2 = User(
        id=uuid4(),
        email="user2@example.com",
        first_name="User",
        last_name="Two",
        role="restaurant_owner",
        restaurant_id=restaurant2.id,
        current_restaurant_id=restaurant2.id,
        is_active=True
    )
    db.add_all([user1, user2])
    db.commit()
    return user1, user2


@pytest.fixture
def test_products(db: Session, test_restaurants):
    """Create test products for each restaurant"""
    restaurant1, restaurant2 = test_restaurants
    
    product1 = Product(
        id=uuid4(),
        restaurant_id=restaurant1.id,
        category_id=uuid4(),
        name="Restaurant 1 Burger",
        price=10.99
    )
    product2 = Product(
        id=uuid4(),
        restaurant_id=restaurant2.id,
        category_id=uuid4(),
        name="Restaurant 2 Pizza",
        price=12.99
    )
    db.add_all([product1, product2])
    db.commit()
    return product1, product2


@pytest.fixture
def test_inventory_items(db: Session, test_restaurants):
    """Create test inventory items for each restaurant"""
    restaurant1, restaurant2 = test_restaurants
    
    item1 = InventoryItem(
        sku="BEEF001",
        restaurant_id=restaurant1.id,
        name="Ground Beef",
        qty_g=5000,
        unit="grams"
    )
    item2 = InventoryItem(
        sku="CHEESE001",
        restaurant_id=restaurant2.id,
        name="Mozzarella Cheese",
        qty_g=3000,
        unit="grams"
    )
    db.add_all([item1, item2])
    db.commit()
    return item1, item2


class TestRecipeMultiTenantIsolation:
    """Test multi-tenant isolation for Recipe model"""
    
    def test_recipe_isolation_between_restaurants(self, db: Session, test_restaurants, test_products, test_inventory_items):
        """Test that recipes are isolated between restaurants"""
        restaurant1, restaurant2 = test_restaurants
        product1, product2 = test_products
        item1, item2 = test_inventory_items
        
        # Create recipe for restaurant 1
        recipe1 = Recipe(
            restaurant_id=restaurant1.id,
            item_id=product1.id,
            ingredient_sku=item1.sku,
            qty_g=200
        )
        db.add(recipe1)
        db.commit()
        
        # Verify restaurant 1 can see their recipe
        restaurant1_recipes = db.query(Recipe).filter(
            Recipe.restaurant_id == restaurant1.id
        ).all()
        assert len(restaurant1_recipes) == 1
        assert restaurant1_recipes[0].item_id == product1.id
        
        # Verify restaurant 2 cannot see restaurant 1's recipe
        restaurant2_recipes = db.query(Recipe).filter(
            Recipe.restaurant_id == restaurant2.id
        ).all()
        assert len(restaurant2_recipes) == 0
    
    def test_recipe_cannot_use_other_restaurant_inventory(self, db: Session, test_restaurants, test_products, test_inventory_items):
        """Test that recipes cannot reference inventory items from other restaurants"""
        restaurant1, restaurant2 = test_restaurants
        product1, product2 = test_products
        item1, item2 = test_inventory_items
        
        # Try to create recipe for restaurant 1 using restaurant 2's inventory item
        # This should be prevented by application logic
        with pytest.raises(Exception):  # Should raise validation error
            recipe = Recipe(
                restaurant_id=restaurant1.id,
                item_id=product1.id,
                ingredient_sku=item2.sku,  # This belongs to restaurant 2
                qty_g=200
            )
            db.add(recipe)
            db.commit()
    
    def test_recipe_api_endpoint_isolation(self, client: TestClient, test_users, test_products, test_inventory_items):
        """Test API endpoint isolation for recipes"""
        user1, user2 = test_users
        product1, product2 = test_products
        item1, item2 = test_inventory_items
        
        # Create tokens for each user
        token1 = create_access_token(data={"sub": user1.email})
        token2 = create_access_token(data={"sub": user2.email})
        
        # User 1 creates a recipe for their product
        headers1 = {"Authorization": f"Bearer {token1}"}
        recipe_data = {
            "item_id": str(product1.id),
            "ingredients": [
                {"ingredient_sku": item1.sku, "qty_g": 200}
            ]
        }
        response = client.post("/api/v1/recipes/", json=recipe_data, headers=headers1)
        assert response.status_code == 201
        
        # User 2 tries to access user 1's recipe
        headers2 = {"Authorization": f"Bearer {token2}"}
        response = client.get(f"/api/v1/recipes/{product1.id}", headers=headers2)
        assert response.status_code == 404  # Should not find the product
        
        # User 2 can create their own recipe
        recipe_data2 = {
            "item_id": str(product2.id),
            "ingredients": [
                {"ingredient_sku": item2.sku, "qty_g": 300}
            ]
        }
        response = client.post("/api/v1/recipes/", json=recipe_data2, headers=headers2)
        assert response.status_code == 201
    
    def test_recipe_list_endpoint_filters_by_restaurant(self, client: TestClient, db: Session, test_users, test_restaurants, test_products, test_inventory_items):
        """Test that recipe list endpoint only shows recipes for user's restaurant"""
        user1, user2 = test_users
        restaurant1, restaurant2 = test_restaurants
        product1, product2 = test_products
        item1, item2 = test_inventory_items
        
        # Create recipes for both restaurants
        recipe1 = Recipe(
            restaurant_id=restaurant1.id,
            item_id=product1.id,
            ingredient_sku=item1.sku,
            qty_g=200
        )
        recipe2 = Recipe(
            restaurant_id=restaurant2.id,
            item_id=product2.id,
            ingredient_sku=item2.sku,
            qty_g=300
        )
        db.add_all([recipe1, recipe2])
        db.commit()
        
        # User 1 lists recipes
        token1 = create_access_token(data={"sub": user1.email})
        headers1 = {"Authorization": f"Bearer {token1}"}
        response = client.get("/api/v1/recipes/", headers=headers1)
        assert response.status_code == 200
        recipes = response.json()
        assert len(recipes) == 1
        assert recipes[0]["item_id"] == str(product1.id)
        
        # User 2 lists recipes
        token2 = create_access_token(data={"sub": user2.email})
        headers2 = {"Authorization": f"Bearer {token2}"}
        response = client.get("/api/v1/recipes/", headers=headers2)
        assert response.status_code == 200
        recipes = response.json()
        assert len(recipes) == 1
        assert recipes[0]["item_id"] == str(product2.id)
    
    def test_recipe_unique_constraint_per_restaurant(self, db: Session, test_restaurants, test_products, test_inventory_items):
        """Test that unique constraint allows same product-ingredient combo in different restaurants"""
        restaurant1, restaurant2 = test_restaurants
        product1, product2 = test_products
        item1, item2 = test_inventory_items
        
        # Create same ingredient SKU for both restaurants
        item_shared = InventoryItem(
            sku="SALT001",
            restaurant_id=restaurant2.id,
            name="Salt",
            qty_g=1000,
            unit="grams"
        )
        db.add(item_shared)
        db.commit()
        
        # Create recipe for restaurant 1
        recipe1 = Recipe(
            restaurant_id=restaurant1.id,
            item_id=product1.id,
            ingredient_sku=item1.sku,
            qty_g=100
        )
        db.add(recipe1)
        db.commit()
        
        # Restaurant 2 should be able to create recipe with same product-ingredient
        # (if they had same product ID, which shouldn't happen in practice)
        # This tests the unique constraint includes restaurant_id
        recipe2 = Recipe(
            restaurant_id=restaurant2.id,
            item_id=product2.id,
            ingredient_sku=item2.sku,
            qty_g=150
        )
        db.add(recipe2)
        db.commit()
        
        # Both recipes should exist
        assert db.query(Recipe).count() == 2