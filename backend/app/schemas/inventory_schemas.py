"""
Pydantic Schemas for Inventory, Recipes, and Ledger
"""
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from uuid import UUID
from datetime import datetime

# Schema for InventoryItem
class InventoryItemBase(BaseModel):
    sku: str = Field(..., description="Stock Keeping Unit - unique identifier for the inventory item")
    name: str = Field(..., description="Name of the inventory item")
    description: Optional[str] = None
    qty_g: int = Field(default=0, description="Current quantity in grams (or ml or units)")
    par_level_g: Optional[int] = Field(default=0, description="Desired stock level (par level)")
    unit: Optional[str] = Field(default="grams", description="Unit of measurement (e.g., grams, ml, units)")
    cost_per_unit: Optional[float] = Field(None, description="Cost per unit (e.g., cost per gram)")
    supplier: Optional[str] = None

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    qty_g: Optional[int] = None
    par_level_g: Optional[int] = None
    unit: Optional[str] = None
    cost_per_unit: Optional[float] = None
    supplier: Optional[str] = None

class InventoryItemInDBBase(InventoryItemBase):
    last_updated: datetime

    class Config:
        orm_mode = True

class InventoryItem(InventoryItemInDBBase):
    pass


# Schema for RecipeIngredient
class RecipeIngredientBase(BaseModel):
    ingredient_sku: str = Field(..., description="SKU of the ingredient, maps to InventoryItem.sku")
    qty_g: int = Field(..., gt=0, le=1000, description="Quantity of this ingredient in grams (or ml/units) per portion of the menu item. Must be > 0 and <= 1000.")

class RecipeIngredientCreate(RecipeIngredientBase):
    pass

class RecipeIngredient(RecipeIngredientBase):
    # Optional: Add fields from InventoryItem if you want to return them nested
    # ingredient_name: Optional[str] = None
    pass


# Schema for Recipe
class RecipeBase(BaseModel):
    item_id: UUID = Field(..., description="ID of the menu item (Product) this recipe is for")
    ingredients: List[RecipeIngredientCreate] = Field(..., description="List of ingredients and their quantities")

class RecipeCreate(RecipeBase):
    pass

class RecipeUpdate(BaseModel):
    item_id: Optional[UUID] = None
    ingredients: Optional[List[RecipeIngredientCreate]] = None


class RecipeInDBBase(BaseModel):
    id: int
    item_id: UUID
    # ingredients list will be constructed by joining Recipe and InventoryItem or by separate queries
    # For now, let's represent it as it is in the Recipe table for direct mapping,
    # and the service layer can enrich it.
    # Alternatively, a more complex schema can be defined here if needed.

    class Config:
        orm_mode = True

class Recipe(RecipeInDBBase):
    # This schema is for individual recipe ingredient entries as stored in DB
    # The API will likely want to return a list of these grouped by item_id
    ingredient_sku: str
    qty_g: int

    # Optional: to return full ingredient details
    # ingredient: Optional[InventoryItem]


class RecipeResponse(BaseModel):
    item_id: UUID
    item_name: Optional[str] # Product name, to be joined
    ingredients: List[RecipeIngredient]


# Schema for InventoryLedgerEntry
class InventoryLedgerEntryBase(BaseModel):
    sku: str
    delta_g: int = Field(..., description="Change in quantity. Positive for additions, negative for deductions.")
    source: str = Field(..., description="Source of the inventory change (e.g., 'order_fulfillment', 'manual_stock_add')")
    source_id: Optional[str] = Field(None, description="Identifier for the source (e.g., Order ID, User ID)")

class InventoryLedgerEntryCreate(InventoryLedgerEntryBase):
    pass

class InventoryLedgerEntryInDBBase(InventoryLedgerEntryBase):
    id: int
    ts: datetime

    class Config:
        orm_mode = True

class InventoryLedgerEntry(InventoryLedgerEntryInDBBase):
    pass

# Schemas for bulk operations or specific use cases
class StockAdjustment(BaseModel):
    sku: str
    change_qty_g: int # Positive to add stock, negative to remove (e.g. for spoilage)
    reason: Optional[str] = "manual_adjustment" # Default reason

class StockAdjustmentResult(BaseModel):
    sku: str
    new_qty_g: int
    message: str

class InventoryStatusResponse(BaseModel):
    sku: str
    name: str
    current_qty_g: int
    par_level_g: Optional[int]
    status: str # e.g. "In Stock", "Low Stock", "Out of Stock"
    unit: Optional[str]

class LowStockItem(BaseModel):
    sku: str
    name: str
    qty_g: int
    par_level_g: int
    percentage_remaining: float
    unit: str
