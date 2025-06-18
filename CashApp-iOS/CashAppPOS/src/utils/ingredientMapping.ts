// Ingredient to Menu Item Mapping System
// This allows granular control over ingredient quantities for each menu item

export interface IngredientRequirement {
  ingredientName: string;
  quantity: number;
  unit: 'kg' | 'g' | 'l' | 'ml' | 'units';
}

export interface MenuItemRecipe {
  menuItemName: string;
  ingredients: IngredientRequirement[];
}

// Mexican Restaurant Recipe Mappings
export const recipeMap: MenuItemRecipe[] = [
  {
    menuItemName: 'Nachos',
    ingredients: [
      { ingredientName: 'Tortillas (Corn)', quantity: 200, unit: 'g' },
      { ingredientName: 'Cheese (Cheddar)', quantity: 100, unit: 'g' },
      { ingredientName: 'Jalapeños', quantity: 50, unit: 'g' },
      { ingredientName: 'Salsa', quantity: 100, unit: 'ml' },
      { ingredientName: 'Sour Cream', quantity: 50, unit: 'ml' },
    ]
  },
  {
    menuItemName: 'Carnitas Taco',
    ingredients: [
      { ingredientName: 'Tortillas (Corn)', quantity: 2, unit: 'units' },
      { ingredientName: 'Pork Shoulder', quantity: 150, unit: 'g' },
      { ingredientName: 'Onions', quantity: 30, unit: 'g' },
      { ingredientName: 'Cilantro', quantity: 10, unit: 'g' },
      { ingredientName: 'Limes', quantity: 0.5, unit: 'units' },
    ]
  },
  {
    menuItemName: 'Regular Burrito',
    ingredients: [
      { ingredientName: 'Tortillas (Flour)', quantity: 1, unit: 'units' },
      { ingredientName: 'Rice', quantity: 150, unit: 'g' },
      { ingredientName: 'Black Beans', quantity: 100, unit: 'g' },
      { ingredientName: 'Ground Beef', quantity: 120, unit: 'g' },
      { ingredientName: 'Cheese (Mexican)', quantity: 50, unit: 'g' },
      { ingredientName: 'Lettuce', quantity: 30, unit: 'g' },
      { ingredientName: 'Tomatoes', quantity: 50, unit: 'g' },
      { ingredientName: 'Sour Cream', quantity: 30, unit: 'ml' },
    ]
  },
  {
    menuItemName: 'Fish Taco',
    ingredients: [
      { ingredientName: 'Tortillas (Corn)', quantity: 2, unit: 'units' },
      { ingredientName: 'Fish Fillets', quantity: 100, unit: 'g' },
      { ingredientName: 'Lettuce', quantity: 20, unit: 'g' },
      { ingredientName: 'Tomatoes', quantity: 30, unit: 'g' },
      { ingredientName: 'Limes', quantity: 0.5, unit: 'units' },
      { ingredientName: 'Hot Sauce', quantity: 10, unit: 'ml' },
    ]
  },
  {
    menuItemName: 'Side of Rice',
    ingredients: [
      { ingredientName: 'Rice', quantity: 200, unit: 'g' },
      { ingredientName: 'Tomatoes', quantity: 30, unit: 'g' },
      { ingredientName: 'Onions', quantity: 20, unit: 'g' },
      { ingredientName: 'Cilantro', quantity: 5, unit: 'g' },
    ]
  },
];

// Function to calculate ingredient requirements for an order
export const calculateIngredientRequirements = (orderItems: { menuItem: string; quantity: number }[]): Map<string, number> => {
  const ingredientTotals = new Map<string, number>();
  
  orderItems.forEach(({ menuItem, quantity }) => {
    const recipe = recipeMap.find(r => r.menuItemName === menuItem);
    if (recipe) {
      recipe.ingredients.forEach(ingredient => {
        const currentQuantity = ingredientTotals.get(ingredient.ingredientName) || 0;
        ingredientTotals.set(
          ingredient.ingredientName,
          currentQuantity + (ingredient.quantity * quantity)
        );
      });
    }
  });
  
  return ingredientTotals;
};

// Function to check if inventory has sufficient ingredients
export const checkInventoryAvailability = (
  requiredIngredients: Map<string, number>,
  currentInventory: Map<string, number>
): { available: boolean; shortages: { ingredient: string; required: number; available: number }[] } => {
  const shortages: { ingredient: string; required: number; available: number }[] = [];
  
  requiredIngredients.forEach((required, ingredient) => {
    const available = currentInventory.get(ingredient) || 0;
    if (available < required) {
      shortages.push({ ingredient, required, available });
    }
  });
  
  return {
    available: shortages.length === 0,
    shortages
  };
};

// Function to deduct ingredients from inventory after order
export const deductIngredientsFromInventory = (
  orderItems: { menuItem: string; quantity: number }[],
  currentInventory: Map<string, number>
): Map<string, number> => {
  const requiredIngredients = calculateIngredientRequirements(orderItems);
  const updatedInventory = new Map(currentInventory);
  
  requiredIngredients.forEach((required, ingredient) => {
    const current = updatedInventory.get(ingredient) || 0;
    updatedInventory.set(ingredient, Math.max(0, current - required));
  });
  
  return updatedInventory;
};