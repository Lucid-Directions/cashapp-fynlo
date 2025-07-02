/**
 * CostCalculationService - Advanced cost calculations and COGS management
 * Handles inventory costing, waste allocation, menu pricing, and profitability analysis
 */

import { InventoryItem, Recipe, RecipeIngredient, Order, OrderItem } from '../types';

export interface CostBreakdown {
  ingredientCost: number;
  wasteCost: number;
  totalDirectCost: number;
  laborCost?: number;
  overheadCost?: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
}

export interface MenuItemCost {
  itemId: string;
  itemName: string;
  salePrice: number;
  costBreakdown: CostBreakdown;
  profitability: 'high' | 'medium' | 'low' | 'loss';
  suggestions: string[];
}

export interface InventoryCostReport {
  totalInventoryValue: number;
  totalWasteCost: number;
  wastePercentage: number;
  monthlyCOGS: number;
  topWasteItems: {
    sku: string;
    name: string;
    wasteCost: number;
    wastePercentage: number;
  }[];
  costCategories: {
    category: string;
    totalCost: number;
    wastePercentage: number;
  }[];
}

export interface OrderCostAnalysis {
  orderId: number;
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: number;
  itemAnalysis: {
    itemName: string;
    quantity: number;
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
  }[];
}

export interface CostingConfig {
  laborCostPercentage: number; // % of ingredient cost
  overheadCostPercentage: number; // % of ingredient cost
  targetMarginPercentage: number; // Target profit margin
  wasteCalculationMethod: 'average' | 'item_specific' | 'category_average';
  includeLaborInCOGS: boolean;
  includeOverheadInCOGS: boolean;
}

class CostCalculationService {
  private config: CostingConfig = {
    laborCostPercentage: 25, // 25% of ingredient cost
    overheadCostPercentage: 15, // 15% of ingredient cost
    targetMarginPercentage: 65, // 65% target margin
    wasteCalculationMethod: 'item_specific',
    includeLaborInCOGS: true,
    includeOverheadInCOGS: false,
  };

  /**
   * Calculate the cost of a menu item based on its recipe
   */
  calculateMenuItemCost(
    recipe: Recipe,
    inventoryItems: { [sku: string]: InventoryItem },
    salePrice: number
  ): MenuItemCost {
    const costBreakdown = this.calculateCostBreakdown(recipe, inventoryItems);
    const profit = salePrice - costBreakdown.totalCost;
    const profitMargin = salePrice > 0 ? (profit / salePrice) * 100 : 0;

    costBreakdown.margin = profit;
    costBreakdown.marginPercent = profitMargin;

    return {
      itemId: recipe.item_id,
      itemName: recipe.item_name || 'Unknown Item',
      salePrice,
      costBreakdown,
      profitability: this.determineProfitability(profitMargin),
      suggestions: this.generateCostSuggestions(costBreakdown, profitMargin),
    };
  }

  /**
   * Calculate detailed cost breakdown for a recipe
   */
  private calculateCostBreakdown(
    recipe: Recipe,
    inventoryItems: { [sku: string]: InventoryItem }
  ): CostBreakdown {
    let ingredientCost = 0;
    let wasteCost = 0;

    // Calculate ingredient and waste costs
    for (const ingredient of recipe.ingredients) {
      const inventoryItem = inventoryItems[ingredient.ingredient_sku];
      if (inventoryItem && inventoryItem.cost_per_unit) {
        const baseIngredientCost = (ingredient.qty_g / 1000) * inventoryItem.cost_per_unit;
        ingredientCost += baseIngredientCost;

        // Calculate waste cost based on waste percentage
        const wastePercent = (inventoryItem.waste_pct || 0) / 100;
        wasteCost += baseIngredientCost * wastePercent;
      }
    }

    const totalDirectCost = ingredientCost + wasteCost;

    // Calculate labor and overhead costs
    const laborCost = this.config.includeLaborInCOGS 
      ? (ingredientCost * this.config.laborCostPercentage) / 100 
      : 0;
    
    const overheadCost = this.config.includeOverheadInCOGS 
      ? (ingredientCost * this.config.overheadCostPercentage) / 100 
      : 0;

    const totalCost = totalDirectCost + laborCost + overheadCost;

    return {
      ingredientCost,
      wasteCost,
      totalDirectCost,
      laborCost,
      overheadCost,
      totalCost,
      margin: 0, // Will be calculated by caller
      marginPercent: 0, // Will be calculated by caller
    };
  }

  /**
   * Calculate comprehensive inventory cost report
   */
  calculateInventoryCostReport(
    inventoryItems: { [sku: string]: InventoryItem }
  ): InventoryCostReport {
    const items = Object.values(inventoryItems);
    let totalInventoryValue = 0;
    let totalWasteCost = 0;
    const categoryTotals: { [category: string]: { cost: number; waste: number } } = {};
    const wasteItems: Array<{
      sku: string;
      name: string;
      wasteCost: number;
      wastePercentage: number;
    }> = [];

    for (const item of items) {
      if (!item.cost_per_unit || !item.qty_g) continue;

      const itemValue = (item.qty_g / 1000) * item.cost_per_unit;
      const wastePercent = (item.waste_pct || 0) / 100;
      const itemWasteCost = itemValue * wastePercent;

      totalInventoryValue += itemValue;
      totalWasteCost += itemWasteCost;

      // Track by category
      const category = item.category || 'Uncategorized';
      if (!categoryTotals[category]) {
        categoryTotals[category] = { cost: 0, waste: 0 };
      }
      categoryTotals[category].cost += itemValue;
      categoryTotals[category].waste += itemWasteCost;

      // Track individual waste items
      if (itemWasteCost > 0) {
        wasteItems.push({
          sku: item.sku,
          name: item.name,
          wasteCost: itemWasteCost,
          wastePercentage: item.waste_pct || 0,
        });
      }
    }

    // Sort waste items by cost (highest first) and take top 10
    const topWasteItems = wasteItems
      .sort((a, b) => b.wasteCost - a.wasteCost)
      .slice(0, 10);

    // Calculate category breakdowns
    const costCategories = Object.entries(categoryTotals).map(([category, totals]) => ({
      category,
      totalCost: totals.cost,
      wastePercentage: totals.cost > 0 ? (totals.waste / totals.cost) * 100 : 0,
    }));

    // Estimate monthly COGS (assuming 4 inventory turnovers per month)
    const monthlyCOGS = totalInventoryValue * 4;

    return {
      totalInventoryValue,
      totalWasteCost,
      wastePercentage: totalInventoryValue > 0 ? (totalWasteCost / totalInventoryValue) * 100 : 0,
      monthlyCOGS,
      topWasteItems,
      costCategories,
    };
  }

  /**
   * Calculate cost analysis for a completed order
   */
  calculateOrderCostAnalysis(
    order: Order,
    recipes: Recipe[],
    inventoryItems: { [sku: string]: InventoryItem }
  ): OrderCostAnalysis {
    const recipeMap = new Map(recipes.map(r => [r.item_id, r]));
    let totalCOGS = 0;
    const itemAnalysis: OrderCostAnalysis['itemAnalysis'] = [];

    for (const orderItem of order.items) {
      const recipe = recipeMap.get(orderItem.id.toString());
      let itemCOGS = 0;

      if (recipe) {
        const costBreakdown = this.calculateCostBreakdown(recipe, inventoryItems);
        itemCOGS = costBreakdown.totalCost * orderItem.quantity;
      }

      const itemRevenue = orderItem.price * orderItem.quantity;
      const itemProfit = itemRevenue - itemCOGS;
      const itemMargin = itemRevenue > 0 ? (itemProfit / itemRevenue) * 100 : 0;

      itemAnalysis.push({
        itemName: orderItem.name,
        quantity: orderItem.quantity,
        revenue: itemRevenue,
        cogs: itemCOGS,
        profit: itemProfit,
        margin: itemMargin,
      });

      totalCOGS += itemCOGS;
    }

    const totalRevenue = order.total;
    const grossProfit = totalRevenue - totalCOGS;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      orderId: order.id || 0,
      totalRevenue,
      totalCOGS,
      grossProfit,
      grossMargin,
      itemAnalysis,
    };
  }

  /**
   * Calculate suggested selling price based on cost and target margin
   */
  calculateSuggestedPrice(
    recipe: Recipe,
    inventoryItems: { [sku: string]: InventoryItem },
    targetMargin?: number
  ): number {
    const costBreakdown = this.calculateCostBreakdown(recipe, inventoryItems);
    const margin = targetMargin || this.config.targetMarginPercentage;
    
    // Price = Cost / (1 - Target Margin %)
    return costBreakdown.totalCost / (1 - margin / 100);
  }

  /**
   * Determine profitability level based on margin percentage
   */
  private determineProfitability(marginPercent: number): 'high' | 'medium' | 'low' | 'loss' {
    if (marginPercent < 0) return 'loss';
    if (marginPercent < 30) return 'low';
    if (marginPercent < 60) return 'medium';
    return 'high';
  }

  /**
   * Generate cost optimization suggestions
   */
  private generateCostSuggestions(
    costBreakdown: CostBreakdown,
    marginPercent: number
  ): string[] {
    const suggestions: string[] = [];

    if (marginPercent < 0) {
      suggestions.push('Item is selling at a loss - consider increasing price');
    } else if (marginPercent < this.config.targetMarginPercentage) {
      suggestions.push(`Margin below target (${this.config.targetMarginPercentage}%) - consider price adjustment`);
    }

    const wastePercentage = costBreakdown.ingredientCost > 0 
      ? (costBreakdown.wasteCost / costBreakdown.ingredientCost) * 100 
      : 0;

    if (wastePercentage > 10) {
      suggestions.push('High waste cost detected - review portion control and storage');
    } else if (wastePercentage > 5) {
      suggestions.push('Moderate waste cost - consider optimizing portions');
    }

    if (costBreakdown.laborCost && costBreakdown.laborCost > costBreakdown.ingredientCost) {
      suggestions.push('Labor cost exceeds ingredient cost - review preparation efficiency');
    }

    return suggestions;
  }

  /**
   * Update costing configuration
   */
  updateConfig(newConfig: Partial<CostingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current costing configuration
   */
  getConfig(): CostingConfig {
    return { ...this.config };
  }

  /**
   * Calculate price elasticity impact on profit
   */
  calculatePriceElasticityImpact(
    currentPrice: number,
    currentVolume: number,
    costPerUnit: number,
    priceChanges: number[]
  ): Array<{
    newPrice: number;
    estimatedVolume: number;
    totalProfit: number;
    marginPercent: number;
  }> {
    // Simple elasticity model (in reality, this would use historical data)
    const elasticity = -1.2; // Typical restaurant elasticity

    return priceChanges.map(priceChange => {
      const newPrice = currentPrice * (1 + priceChange / 100);
      const volumeChange = elasticity * priceChange;
      const estimatedVolume = Math.max(0, currentVolume * (1 + volumeChange / 100));
      const profit = (newPrice - costPerUnit) * estimatedVolume;
      const marginPercent = newPrice > 0 ? ((newPrice - costPerUnit) / newPrice) * 100 : 0;

      return {
        newPrice,
        estimatedVolume,
        totalProfit: profit,
        marginPercent,
      };
    });
  }
}

// Create default cost calculation service instance
export const costCalculationService = new CostCalculationService();

export default CostCalculationService;