/**
 * MenuInventoryService - Real-time inventory deduction and menu integration
 * Handles automatic inventory deduction when orders are completed, recipe costing, and stock validation
 */

import { Order, OrderItem, Recipe, InventoryItem, StockMovement } from '../types';
import { costCalculationService } from './CostCalculationService';
import * as InventoryApiService from './InventoryApiService';

export interface InventoryDeduction {
  sku: string;
  itemName: string;
  quantityUsed: number; // in grams
  costDeducted: number;
  remainingStock: number;
  stockStatus: 'sufficient' | 'low_stock' | 'insufficient';
}

export interface OrderInventoryImpact {
  orderId: number;
  deductions: InventoryDeduction[];
  totalCostOfGoods: number;
  stockWarnings: string[];
  insufficientItems: string[];
  success: boolean;
}

export interface StockValidationResult {
  canFulfill: boolean;
  missingIngredients: {
    sku: string;
    name: string;
    required: number;
    available: number;
    shortage: number;
  }[];
  lowStockWarnings: {
    sku: string;
    name: string;
    currentStock: number;
    parLevel: number;
  }[];
}

export interface MenuItemAvailability {
  itemId: string;
  itemName: string;
  isAvailable: boolean;
  stockStatus: 'available' | 'limited' | 'unavailable';
  missingIngredients: string[];
  estimatedPortionsAvailable: number;
}

class MenuInventoryService {
  /**
   * Process order completion and deduct inventory automatically
   */
  async processOrderCompletion(
    order: Order,
    recipes: Recipe[],
    inventoryItems: { [sku: string]: InventoryItem }
  ): Promise<OrderInventoryImpact> {
    const recipeMap = new Map(recipes.map(r => [r.item_id, r]));
    const deductions: InventoryDeduction[] = [];
    const stockWarnings: string[] = [];
    const insufficientItems: string[] = [];
    let totalCostOfGoods = 0;
    let success = true;

    // Calculate required ingredients for the entire order
    const requiredIngredients = this.calculateOrderIngredientRequirements(order, recipeMap);

    // Validate stock availability first
    const validation = this.validateStockAvailability(requiredIngredients, inventoryItems);
    
    if (!validation.canFulfill) {
      return {
        orderId: order.id || 0,
        deductions: [],
        totalCostOfGoods: 0,
        stockWarnings: validation.lowStockWarnings.map(w => 
          `Low stock warning: ${w.name} (${w.currentStock}g remaining, par level: ${w.parLevel}g)`
        ),
        insufficientItems: validation.missingIngredients.map(m => 
          `Insufficient ${m.name}: need ${m.required}g, have ${m.available}g`
        ),
        success: false,
      };
    }

    // Process inventory deductions
    for (const [sku, totalRequired] of requiredIngredients) {
      const inventoryItem = inventoryItems[sku];
      if (!inventoryItem) continue;

      try {
        // Calculate cost and perform deduction
        const costPerGram = inventoryItem.cost_per_unit ? inventoryItem.cost_per_unit / 1000 : 0;
        const deductionCost = totalRequired * costPerGram;
        
        // Call API to adjust stock
        await InventoryApiService.adjustStock(
          sku, 
          -totalRequired, 
          `order_completion_${order.id}`
        );

        const newStock = inventoryItem.qty_g - totalRequired;
        const stockStatus = this.determineStockStatus(newStock, inventoryItem.par_level_g || 0);

        deductions.push({
          sku,
          itemName: inventoryItem.name,
          quantityUsed: totalRequired,
          costDeducted: deductionCost,
          remainingStock: Math.max(0, newStock),
          stockStatus,
        });

        totalCostOfGoods += deductionCost;

        // Add stock warnings
        if (stockStatus === 'low_stock') {
          stockWarnings.push(`${inventoryItem.name} is now at low stock (${Math.max(0, newStock)}g remaining)`);
        } else if (stockStatus === 'insufficient') {
          stockWarnings.push(`${inventoryItem.name} is now out of stock`);
        }

      } catch (error) {
        console.error(`Failed to deduct inventory for ${sku}:`, error);
        insufficientItems.push(`Failed to process deduction for ${inventoryItem.name}`);
        success = false;
      }
    }

    return {
      orderId: order.id || 0,
      deductions,
      totalCostOfGoods,
      stockWarnings,
      insufficientItems,
      success,
    };
  }

  /**
   * Calculate total ingredient requirements for an order
   */
  private calculateOrderIngredientRequirements(
    order: Order,
    recipeMap: Map<string, Recipe>
  ): Map<string, number> {
    const requirements = new Map<string, number>();

    for (const orderItem of order.items) {
      const recipe = recipeMap.get(orderItem.id.toString());
      if (!recipe) continue;

      for (const ingredient of recipe.ingredients) {
        const totalRequired = ingredient.qty_g * orderItem.quantity;
        const currentRequired = requirements.get(ingredient.ingredient_sku) || 0;
        requirements.set(ingredient.ingredient_sku, currentRequired + totalRequired);
      }
    }

    return requirements;
  }

  /**
   * Validate if order can be fulfilled with current stock
   */
  validateStockAvailability(
    requiredIngredients: Map<string, number>,
    inventoryItems: { [sku: string]: InventoryItem }
  ): StockValidationResult {
    const missingIngredients: StockValidationResult['missingIngredients'] = [];
    const lowStockWarnings: StockValidationResult['lowStockWarnings'] = [];
    let canFulfill = true;

    for (const [sku, required] of requiredIngredients) {
      const inventoryItem = inventoryItems[sku];
      
      if (!inventoryItem) {
        missingIngredients.push({
          sku,
          name: `Unknown Item (${sku})`,
          required,
          available: 0,
          shortage: required,
        });
        canFulfill = false;
        continue;
      }

      const available = inventoryItem.qty_g || 0;
      
      if (available < required) {
        missingIngredients.push({
          sku,
          name: inventoryItem.name,
          required,
          available,
          shortage: required - available,
        });
        canFulfill = false;
      } else {
        // Check for low stock warnings
        const remainingAfterUse = available - required;
        const parLevel = inventoryItem.par_level_g || 0;
        
        if (parLevel > 0 && remainingAfterUse <= parLevel * 0.1) {
          lowStockWarnings.push({
            sku,
            name: inventoryItem.name,
            currentStock: remainingAfterUse,
            parLevel,
          });
        }
      }
    }

    return {
      canFulfill,
      missingIngredients,
      lowStockWarnings,
    };
  }

  /**
   * Check menu item availability based on current inventory
   */
  checkMenuItemAvailability(
    menuItems: { id: string; name: string }[],
    recipes: Recipe[],
    inventoryItems: { [sku: string]: InventoryItem }
  ): MenuItemAvailability[] {
    const recipeMap = new Map(recipes.map(r => [r.item_id, r]));

    return menuItems.map(menuItem => {
      const recipe = recipeMap.get(menuItem.id);
      
      if (!recipe) {
        return {
          itemId: menuItem.id,
          itemName: menuItem.name,
          isAvailable: true, // No recipe = no inventory constraints
          stockStatus: 'available',
          missingIngredients: [],
          estimatedPortionsAvailable: 999,
        };
      }

      const missingIngredients: string[] = [];
      let minPortionsAvailable = Number.MAX_SAFE_INTEGER;
      let hasInsufficientStock = false;

      for (const ingredient of recipe.ingredients) {
        const inventoryItem = inventoryItems[ingredient.ingredient_sku];
        
        if (!inventoryItem || inventoryItem.qty_g <= 0) {
          missingIngredients.push(inventoryItem?.name || ingredient.ingredient_sku);
          hasInsufficientStock = true;
          minPortionsAvailable = 0;
        } else {
          const portionsFromThisIngredient = Math.floor(inventoryItem.qty_g / ingredient.qty_g);
          minPortionsAvailable = Math.min(minPortionsAvailable, portionsFromThisIngredient);
        }
      }

      const isAvailable = !hasInsufficientStock && minPortionsAvailable > 0;
      const stockStatus = hasInsufficientStock 
        ? 'unavailable' 
        : minPortionsAvailable <= 5 
          ? 'limited' 
          : 'available';

      return {
        itemId: menuItem.id,
        itemName: menuItem.name,
        isAvailable,
        stockStatus,
        missingIngredients,
        estimatedPortionsAvailable: Math.max(0, minPortionsAvailable === Number.MAX_SAFE_INTEGER ? 999 : minPortionsAvailable),
      };
    });
  }

  /**
   * Calculate real-time menu item cost including current inventory prices
   */
  calculateRealTimeMenuCost(
    recipe: Recipe,
    inventoryItems: { [sku: string]: InventoryItem }
  ): {
    totalCost: number;
    ingredientCosts: { name: string; cost: number; available: boolean }[];
    isAvailable: boolean;
  } {
    let totalCost = 0;
    const ingredientCosts: { name: string; cost: number; available: boolean }[] = [];
    let isAvailable = true;

    for (const ingredient of recipe.ingredients) {
      const inventoryItem = inventoryItems[ingredient.ingredient_sku];
      const available = inventoryItem && inventoryItem.qty_g >= ingredient.qty_g;
      
      if (!available) {
        isAvailable = false;
      }

      const cost = inventoryItem?.cost_per_unit 
        ? (ingredient.qty_g / 1000) * inventoryItem.cost_per_unit 
        : 0;

      totalCost += cost;
      ingredientCosts.push({
        name: inventoryItem?.name || ingredient.ingredient_sku,
        cost,
        available: !!available,
      });
    }

    return {
      totalCost,
      ingredientCosts,
      isAvailable,
    };
  }

  /**
   * Estimate when inventory will run out based on sales velocity
   */
  estimateStockoutDate(
    sku: string,
    currentStock: number,
    averageDailyUsage: number
  ): Date | null {
    if (averageDailyUsage <= 0 || currentStock <= 0) {
      return new Date(); // Already out or no usage data
    }

    const daysUntilStockout = Math.floor(currentStock / averageDailyUsage);
    const stockoutDate = new Date();
    stockoutDate.setDate(stockoutDate.getDate() + daysUntilStockout);
    
    return stockoutDate;
  }

  /**
   * Generate reorder recommendations based on recipe usage
   */
  generateReorderRecommendations(
    recipes: Recipe[],
    inventoryItems: { [sku: string]: InventoryItem },
    averageDailySales: { [menuItemId: string]: number } = {}
  ): {
    sku: string;
    itemName: string;
    currentStock: number;
    recommendedOrder: number;
    urgency: 'critical' | 'high' | 'medium' | 'low';
    estimatedStockoutDate: Date | null;
  }[] {
    const recommendations: any[] = [];
    const usageMap = new Map<string, number>();

    // Calculate daily usage based on recipes and sales
    for (const recipe of recipes) {
      const dailySales = averageDailySales[recipe.item_id] || 1;
      
      for (const ingredient of recipe.ingredients) {
        const dailyUsage = ingredient.qty_g * dailySales;
        const currentUsage = usageMap.get(ingredient.ingredient_sku) || 0;
        usageMap.set(ingredient.ingredient_sku, currentUsage + dailyUsage);
      }
    }

    // Generate recommendations
    for (const [sku, dailyUsage] of usageMap) {
      const inventoryItem = inventoryItems[sku];
      if (!inventoryItem) continue;

      const currentStock = inventoryItem.qty_g || 0;
      const parLevel = inventoryItem.par_level_g || dailyUsage * 7; // Default to 1 week supply
      const stockoutDate = this.estimateStockoutDate(sku, currentStock, dailyUsage);
      
      let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
      const daysUntilStockout = stockoutDate ? 
        Math.ceil((stockoutDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 999;

      if (daysUntilStockout <= 1) urgency = 'critical';
      else if (daysUntilStockout <= 3) urgency = 'high';
      else if (daysUntilStockout <= 7) urgency = 'medium';

      if (currentStock < parLevel || urgency !== 'low') {
        recommendations.push({
          sku,
          itemName: inventoryItem.name,
          currentStock,
          recommendedOrder: Math.max(parLevel - currentStock, dailyUsage * 3), // At least 3 days supply
          urgency,
          estimatedStockoutDate: stockoutDate,
        });
      }
    }

    return recommendations.sort((a, b) => {
      const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    });
  }

  /**
   * Determine stock status based on current stock and par level
   */
  private determineStockStatus(
    currentStock: number, 
    parLevel: number
  ): 'sufficient' | 'low_stock' | 'insufficient' {
    if (currentStock <= 0) return 'insufficient';
    if (parLevel > 0 && currentStock <= parLevel * 0.1) return 'low_stock';
    return 'sufficient';
  }

  /**
   * Simulate order impact without actually processing it
   */
  simulateOrderImpact(
    order: Order,
    recipes: Recipe[],
    inventoryItems: { [sku: string]: InventoryItem }
  ): OrderInventoryImpact {
    const recipeMap = new Map(recipes.map(r => [r.item_id, r]));
    const requiredIngredients = this.calculateOrderIngredientRequirements(order, recipeMap);
    const validation = this.validateStockAvailability(requiredIngredients, inventoryItems);

    const deductions: InventoryDeduction[] = [];
    let totalCostOfGoods = 0;

    for (const [sku, totalRequired] of requiredIngredients) {
      const inventoryItem = inventoryItems[sku];
      if (!inventoryItem) continue;

      const costPerGram = inventoryItem.cost_per_unit ? inventoryItem.cost_per_unit / 1000 : 0;
      const deductionCost = totalRequired * costPerGram;
      const newStock = Math.max(0, inventoryItem.qty_g - totalRequired);
      const stockStatus = this.determineStockStatus(newStock, inventoryItem.par_level_g || 0);

      deductions.push({
        sku,
        itemName: inventoryItem.name,
        quantityUsed: totalRequired,
        costDeducted: deductionCost,
        remainingStock: newStock,
        stockStatus,
      });

      totalCostOfGoods += deductionCost;
    }

    return {
      orderId: order.id || 0,
      deductions,
      totalCostOfGoods,
      stockWarnings: validation.lowStockWarnings.map(w => 
        `Low stock warning: ${w.name} (${w.currentStock}g remaining)`
      ),
      insufficientItems: validation.missingIngredients.map(m => 
        `Insufficient ${m.name}: need ${m.required}g, have ${m.available}g`
      ),
      success: validation.canFulfill,
    };
  }
}

// Create default menu inventory service instance
export const menuInventoryService = new MenuInventoryService();

export default MenuInventoryService;