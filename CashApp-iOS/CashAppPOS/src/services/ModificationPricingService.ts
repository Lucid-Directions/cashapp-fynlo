/**
 * Service for handling item modification pricing and validation
 * Manages dynamic pricing calculations for cart item modifications
 */

import { CartItemModification, EnhancedOrderItem } from '../types/cart';
import { calculateItemTotal, calculateSum } from '../utils/priceValidation';
import ErrorTrackingService from './ErrorTrackingService';

/**
 * Predefined modification options for common categories
 * Can be extended or overridden per product
 */
export const DEFAULT_MODIFICATIONS = {
  size: {
    category: 'Size Options',
    options: [
      { id: 'size-small', name: 'Small', price: -0.5, default: false },
      { id: 'size-medium', name: 'Medium', price: 0.0, default: true },
      { id: 'size-large', name: 'Large', price: 0.5, default: false },
      { id: 'size-extra-large', name: 'Extra Large', price: 1.0, default: false },
    ],
  },
  temperature: {
    category: 'Temperature',
    options: [
      { id: 'temp-hot', name: 'Hot', price: 0.0, default: true },
      { id: 'temp-iced', name: 'Iced', price: 0.0, default: false },
      { id: 'temp-extra-hot', name: 'Extra Hot', price: 0.0, default: false },
    ],
  },
  coffeeAdditions: {
    category: 'Coffee Add-ons',
    options: [
      { id: 'add-extra-shot', name: 'Extra Shot', price: 0.75, quantity: true, max: 4 },
      { id: 'add-decaf', name: 'Decaf', price: 0.0, quantity: false },
      { id: 'add-half-caff', name: 'Half Caff', price: 0.0, quantity: false },
      { id: 'add-whipped-cream', name: 'Whipped Cream', price: 0.25, quantity: false },
      { id: 'add-flavor-syrup', name: 'Flavor Syrup', price: 0.5, quantity: true, max: 3 },
      { id: 'add-extra-foam', name: 'Extra Foam', price: 0.0, quantity: false },
    ],
  },
  milkOptions: {
    category: 'Milk Options',
    options: [
      { id: 'milk-whole', name: 'Whole Milk', price: 0.0, default: true },
      { id: 'milk-skim', name: 'Skim Milk', price: 0.0, default: false },
      { id: 'milk-soy', name: 'Soy Milk', price: 0.6, default: false },
      { id: 'milk-almond', name: 'Almond Milk', price: 0.6, default: false },
      { id: 'milk-oat', name: 'Oat Milk', price: 0.7, default: false },
      { id: 'milk-coconut', name: 'Coconut Milk', price: 0.6, default: false },
    ],
  },
  removals: {
    category: 'Remove',
    options: [
      { id: 'remove-ice', name: 'No Ice', price: 0.0 },
      { id: 'remove-sugar', name: 'No Sugar', price: 0.0 },
      { id: 'remove-whip', name: 'No Whip', price: 0.0 },
    ],
  },
};

/**
 * Product category to modification mapping
 * Defines which modifications are available for each product type
 */
export const PRODUCT_MODIFICATION_MAP: Record<string, string[]> = {
  coffee: ['size', 'temperature', 'coffeeAdditions', 'milkOptions', 'removals'],
  tea: ['size', 'temperature', 'milkOptions', 'removals'],
  pastry: ['temperature'],
  sandwich: ['removals'],
  default: ['size'],
};

export class ModificationPricingService {
  private static instance: ModificationPricingService;

  private constructor() {}

  static getInstance(): ModificationPricingService {
    if (!ModificationPricingService.instance) {
      ModificationPricingService.instance = new ModificationPricingService();
    }
    return ModificationPricingService.instance;
  }

  /**
   * Get available modifications for a product based on its category
   */
  getAvailableModifications(productCategory?: string): CartItemModification[] {
    const category = productCategory?.toLowerCase() || 'default';
    const modificationKeys = PRODUCT_MODIFICATION_MAP[category] || PRODUCT_MODIFICATION_MAP.default;

    const modifications: CartItemModification[] = [];

    modificationKeys.forEach((key) => {
      const modCategory = DEFAULT_MODIFICATIONS[key as keyof typeof DEFAULT_MODIFICATIONS];
      if (!modCategory) return;

      modCategory.options.forEach((option) => {
        modifications.push({
          id: option.id,
          type: this.getModificationType(key),
          category: modCategory.category,
          name: option.name,
          price: option.price,
          selected: option.default || false,
          quantity: option.quantity ? 1 : undefined,
        });
      });
    });

    return modifications;
  }

  /**
   * Calculate the total price of selected modifications
   */
  calculateModificationPrice(modifications: CartItemModification[]): number {
    try {
      const selectedMods = modifications.filter((mod) => mod.selected);

      const modPrices = selectedMods.map((mod) => {
        const quantity = mod.quantity || 1;
        const itemTotal = calculateItemTotal(mod.price, quantity, {
          operation: 'modification_price_calculation',
          screenName: 'ModificationPricingService',
          inputValues: { modificationId: mod.id, modificationName: mod.name },
        });

        return itemTotal.isValid ? itemTotal.value : 0;
      });

      const totalSum = calculateSum(modPrices, {
        operation: 'modification_total_sum',
        screenName: 'ModificationPricingService',
      });

      return totalSum.isValid ? totalSum.value : 0;
    } catch (error) {
      ErrorTrackingService.getInstance().trackError(error, {
        context: 'calculateModificationPrice',
        modifications,
      });
      return 0;
    }
  }

  /**
   * Validate modification selections for conflicts
   */
  validateModifications(modifications: CartItemModification[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for multiple size selections
    const sizeSelections = modifications.filter((mod) => mod.type === 'size' && mod.selected);
    if (sizeSelections.length > 1) {
      errors.push('Only one size can be selected');
    }

    // Check for multiple temperature selections
    const tempSelections = modifications.filter(
      (mod) => mod.type === 'temperature' && mod.selected
    );
    if (tempSelections.length > 1) {
      errors.push('Only one temperature can be selected');
    }

    // Check for conflicting milk options
    const milkSelections = modifications.filter(
      (mod) => mod.category === 'Milk Options' && mod.selected
    );
    if (milkSelections.length > 1) {
      errors.push('Only one milk type can be selected');
    }

    // Validate quantities
    modifications.forEach((mod) => {
      if (mod.quantity !== undefined) {
        const maxQuantity = this.getMaxQuantity(mod.id);
        if (mod.quantity > maxQuantity) {
          errors.push(`${mod.name} cannot exceed ${maxQuantity}`);
        }
        if (mod.quantity < 1) {
          errors.push(`${mod.name} quantity must be at least 1`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Apply modifications to an item and recalculate pricing
   */
  applyModifications(
    item: EnhancedOrderItem,
    modifications: CartItemModification[]
  ): EnhancedOrderItem {
    const modificationPrice = this.calculateModificationPrice(modifications);
    const totalPrice = (item.originalPrice + modificationPrice) * item.quantity;

    return {
      ...item,
      modifications,
      modificationPrice,
      totalPrice,
      lastModified: new Date().toISOString(),
    };
  }

  /**
   * Generate a human-readable summary of modifications
   */
  getModificationSummary(modifications: CartItemModification[]): string {
    const selected = modifications.filter((mod) => mod.selected);
    if (selected.length === 0) return '';

    const summaryParts: string[] = [];

    // Group by category
    const byCategory = selected.reduce((acc, mod) => {
      if (!acc[mod.category]) acc[mod.category] = [];
      acc[mod.category].push(mod);
      return acc;
    }, {} as Record<string, CartItemModification[]>);

    Object.entries(byCategory).forEach(([category, mods]) => {
      const modNames = mods.map((mod) => {
        if (mod.quantity && mod.quantity > 1) {
          return `${mod.quantity}x ${mod.name}`;
        }
        return mod.name;
      });
      summaryParts.push(modNames.join(', '));
    });

    return summaryParts.join(' • ');
  }

  /**
   * Get the price impact summary for display
   */
  getPriceImpactSummary(modifications: CartItemModification[]): string {
    const totalImpact = this.calculateModificationPrice(modifications);

    if (totalImpact === 0) return 'No price change';
    if (totalImpact > 0) return `+$${totalImpact.toFixed(2)}`;
    return `-$${Math.abs(totalImpact).toFixed(2)}`;
  }

  /**
   * Clone modifications for duplicating items
   */
  cloneModifications(modifications: CartItemModification[]): CartItemModification[] {
    return modifications.map((mod) => ({
      ...mod,
      // Generate new IDs for cloned modifications
      id: `${mod.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));
  }

  /**
   * Reset modifications to defaults
   */
  resetToDefaults(modifications: CartItemModification[]): CartItemModification[] {
    return modifications.map((mod) => {
      // Find the default option in the same category
      const categoryMods = modifications.filter((m) => m.category === mod.category);
      const defaultMod = categoryMods.find((m) => {
        const option = this.findModificationOption(m.id);
        return option?.default === true;
      });

      return {
        ...mod,
        selected: defaultMod?.id === mod.id,
        quantity: mod.quantity !== undefined ? 1 : undefined,
      };
    });
  }

  // Helper methods

  private getModificationType(key: string): CartItemModification['type'] {
    switch (key) {
      case 'size':
        return 'size';
      case 'temperature':
        return 'temperature';
      case 'removals':
        return 'removal';
      case 'coffeeAdditions':
      case 'milkOptions':
        return 'addition';
      default:
        return 'custom';
    }
  }

  private getMaxQuantity(modificationId: string): number {
    // Find the modification option to get max quantity
    for (const category of Object.values(DEFAULT_MODIFICATIONS)) {
      const option = category.options.find((opt) => opt.id === modificationId);
      if (option && 'max' in option) {
        return option.max as number;
      }
    }
    return 10; // Default max
  }

  private findModificationOption(modificationId: string): any {
    for (const category of Object.values(DEFAULT_MODIFICATIONS)) {
      const option = category.options.find((opt) => opt.id === modificationId);
      if (option) return option;
    }
    return null;
  }
}
