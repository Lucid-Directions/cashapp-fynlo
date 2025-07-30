"""
API Endpoints for Recipe Management
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app.core.database import get_db, Product
from app.core.database import User
from app.crud import inventory as crud_inventory
from app.schemas import inventory_schemas as schemas
from app.core.exceptions import ResourceNotFoundException, ValidationException
router = APIRouter()

@router.post('/', response_model=List[schemas.Recipe], status_code=201)
async def create_or_update_recipe_for_item_api(recipe_in: schemas.RecipeCreate, db: Session=Depends(get_db)):
    """
    Create or update the full recipe for a specific menu item (Product).
    - If the item has no recipe, it's created.
    - If the item has an existing recipe, it's entirely replaced by the ingredients provided.
    - If an empty list of ingredients is provided for an existing recipe, it effectively deletes the recipe.
    """
    product = db.query(Product).filter(Product.id == recipe_in.item_id).first()
    if not product:
        raise ResourceNotFoundException(message="Product with ID {recipe_in.item_id} not found.", resource_type="Resource")
    for ingredient in recipe_in.ingredients:
        inv_item = crud_inventory.get_inventory_item(db, sku=ingredient.ingredient_sku)
        if not inv_item:
            raise ValidationException(message='', error_code='BAD_REQUEST')
    db_recipe_ingredients = crud_inventory.create_or_update_recipe_ingredients(db=db, item_id=recipe_in.item_id, ingredients_data=recipe_in.ingredients)
    if not recipe_in.ingredients and db_recipe_ingredients:
        pass
    return db_recipe_ingredients

@router.get('/{item_id}', response_model=schemas.RecipeResponse)
async def read_recipe_for_item_api(item_id: UUID, db: Session=Depends(get_db)):
    """
    Retrieve the recipe for a specific menu item, including ingredient details.
    """
    recipe_details = crud_inventory.get_product_details_with_recipe(db, item_id=item_id)
    if not recipe_details:
        product = db.query(Product).filter(Product.id == item_id).first()
        if not product:
            raise ResourceNotFoundException(message="Product with ID {item_id} not found.", resource_type="Resource")
        return schemas.RecipeResponse(item_id=item_id, item_name=product.name, ingredients=[])
    return schemas.RecipeResponse(**recipe_details)

@router.get('/', response_model=List[schemas.RecipeResponse])
async def read_all_recipes_api(skip: int=0, limit: int=Query(default=100, le=200), db: Session=Depends(get_db)):
    """
    Retrieve all products that have recipes, along with their recipe details.
    """
    all_recipes_details = crud_inventory.get_all_products_with_recipes(db, skip=skip, limit=limit)
    return [schemas.RecipeResponse(**details) for details in all_recipes_details]

@router.delete('/{item_id}', status_code=204)
async def delete_recipe_for_item_api(item_id: UUID, db: Session=Depends(get_db)):
    """
    Delete the entire recipe for a specific menu item.
    """
    product = db.query(Product).filter(Product.id == item_id).first()
    if not product:
        raise ResourceNotFoundException(message="Product with ID {item_id} not found, cannot delete its recipe.", resource_type="Resource")
    deleted_count = crud_inventory.delete_recipe_for_item(db, item_id=item_id)
    if deleted_count == 0:
        pass
    return None