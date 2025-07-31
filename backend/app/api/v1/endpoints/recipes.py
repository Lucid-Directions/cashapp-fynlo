"""
API Endpoints for Recipe Management
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db, Product # Import Product model
from app.core.exceptions import ResourceNotFoundException, ValidationException
from app.core.database import User # Assuming User model for authentication/authorization
from app.crud import inventory as crud_inventory # Using the same CRUD module
from app.schemas import inventory_schemas as schemas # Using the same schemas module
from app.core.dependencies import get_current_user
from app.core.tenant_security import TenantSecurity
from app.core.exceptions import ValidationException, ResourceNotFoundException
import logging

logger = logging.getLogger(__name__)


router = APIRouter()

# --- Recipe Endpoints ---

@router.post("/", response_model=List[schemas.Recipe], status_code=201) # Returns list of created recipe ingredients
async def create_or_update_recipe_for_item_api(
    recipe_in: schemas.RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create or update the full recipe for a specific menu item (Product).
    - If the item has no recipe, it's created.
    - If the item has an existing recipe, it's entirely replaced by the ingredients provided.
    - If an empty list of ingredients is provided for an existing recipe, it effectively deletes the recipe.
    """
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(message="User must be assigned to a restaurant")    
    # Check if product (item_id) exists for this restaurant
    product = db.query(Product).filter(
        Product.id == recipe_in.item_id,
        Product.restaurant_id == restaurant_id
    ).first()
    if not product:
        raise ResourceNotFoundException(resource="Product", message=f"Product with ID {recipe_in.item_id} not found.")    
    # Verify tenant access
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(restaurant_id),
        operation="modify",
        resource_type="recipe",
        resource_id=str(recipe_in.item_id),
        db=db
    )

    # Validate that all ingredient SKUs exist in inventory for this restaurant
    for ingredient in recipe_in.ingredients:
        inv_item = crud_inventory.get_inventory_item(db, sku=ingredient.ingredient_sku, restaurant_id=restaurant_id)
        if not inv_item:
            raise ValidationException(message=f"Ingredient with SKU {ingredient.ingredient_sku} not found in inventory.")        # qty_g validation (gt=0, le=1000) is handled by Pydantic schema (RecipeIngredientCreate)

    # The CRUD function `create_or_update_recipe_ingredients` handles upsert logic
    # and deletion of ingredients not present in the new list.
    db_recipe_ingredients = crud_inventory.create_or_update_recipe_ingredients(
        db=db,
        item_id=recipe_in.item_id,
        ingredients_data=recipe_in.ingredients,
        restaurant_id=restaurant_id
    )

    if not recipe_in.ingredients and db_recipe_ingredients:
        # This case should ideally be handled by the CRUD to ensure consistency
        # For now, if input is empty and output is not, it implies something went wrong or was not fully cleared.
        # However, create_or_update_recipe_ingredients should return empty list if input ingredients_data is empty.
        pass

    return db_recipe_ingredients


@router.get("/{item_id}", response_model=schemas.RecipeResponse) # Using the RecipeResponse model
async def read_recipe_for_item_api(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve the recipe for a specific menu item, including ingredient details.
    """
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(message="User must be assigned to a restaurant")    
    recipe_details = crud_inventory.get_product_details_with_recipe(db, item_id=item_id, restaurant_id=restaurant_id)
    if not recipe_details:
        # Check if product exists but has no recipe vs product does not exist
        product = db.query(Product).filter(
            Product.id == item_id,
            Product.restaurant_id == restaurant_id
        ).first()
        if not product:
            raise ResourceNotFoundException(resource="Product", message=f"Product with ID {item_id} not found.")        
        # Verify tenant access
        await TenantSecurity.validate_restaurant_access(
            user=current_user,
            restaurant_id=str(restaurant_id),
            operation="access",
            resource_type="recipe",
            resource_id=str(item_id),
            db=db
        )
        
        # Product exists but has no recipe, return empty list of ingredients
        return schemas.RecipeResponse(item_id=item_id, item_name=product.name, ingredients=[])

    return schemas.RecipeResponse(**recipe_details)


@router.get("/", response_model=List[schemas.RecipeResponse])
async def read_all_recipes_api(
    skip: int = 0,
    limit: int = Query(default=100, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all products that have recipes, along with their recipe details.
    """
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(message="User must be assigned to a restaurant")    
    all_recipes_details = crud_inventory.get_all_products_with_recipes(
        db,
        restaurant_id=restaurant_id,
        skip=skip,
        limit=limit
    )
    return [schemas.RecipeResponse(**details) for details in all_recipes_details]


@router.delete("/{item_id}", status_code=204) # No content to return
async def delete_recipe_for_item_api(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete the entire recipe for a specific menu item.
    """
    # Use current user's restaurant
    restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not restaurant_id:
        raise ValidationException(message="User must be assigned to a restaurant")    
    # Check if product exists first
    product = db.query(Product).filter(
        Product.id == item_id,
        Product.restaurant_id == restaurant_id
    ).first()
    if not product:
        raise ResourceNotFoundException(resource="Product", message=f"Product with ID {item_id} not found, cannot delete its recipe.")    
    # Verify tenant access - require owner/manager role for deletion
    await TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(restaurant_id),
        operation="delete",
        resource_type="recipe",
        resource_id=str(item_id),
        db=db
    )

    deleted_count = crud_inventory.delete_recipe_for_item(db, item_id=item_id, restaurant_id=restaurant_id)
    if deleted_count == 0:
        # Product exists, but had no recipe to delete. Not an error, but could be a specific response.
        # For 204, no response body is sent, so client just knows it's gone or was never there.
        pass
    return None # FastAPI will return 204 No Content


# Placeholder for role-based authentication dependency
# async def get_current_active_user_with_role(required_role: str):
#     # from app.api.v1.dependencies import get_current_active_user
#     # current_user = Depends(get_current_active_user) # Your actual user dependency
#     # if current_user.role != required_role and current_user.role != "admin": # Example admin override
#     #     raise AuthenticationException(message=f"User does not have the required role: {required_role}", error_code="ACCESS_DENIED")#     # return current_user
#     logger.info(f"Auth check for role: {required_role}") # Placeholder log
#     pass # Allow all for now
