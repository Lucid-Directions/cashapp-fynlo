/**
 * Integration tests for ModificationPricingService
 * Tests the service with real data and edge cases
 */

import { ModificationPricingService, DEFAULT_MODIFICATIONS, PRODUCT_MODIFICATION_MAP } from '../ModificationPricingService';
import type { CartItemModification, EnhancedOrderItem } from '../../types/cart';

describe('ModificationPricingService Integration Tests', () => {
  let service: ModificationPricingService;

  beforeEach(() => {
    service = ModificationPricingService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ModificationPricingService.getInstance();
      const instance2 = ModificationPricingService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getAvailableModifications', () => {
    it('should return coffee modifications for coffee category', () => {
      const modifications = service.getAvailableModifications('coffee');
      
      // Should include all coffee categories
      const categories = [...new Set(modifications.map(m => m.category))];
      expect(categories).toContain('Size Options');
      expect(categories).toContain('Temperature');
      expect(categories).toContain('Coffee Add-ons');
      expect(categories).toContain('Milk Options');
      expect(categories).toContain('Remove');
      
      // Check size options
      const sizeOptions = modifications.filter(m => m.category === 'Size Options');
      expect(sizeOptions).toHaveLength(4);
      expect(sizeOptions.find(m => m.name === 'Medium')).toHaveProperty('selected', true);
      expect(sizeOptions.find(m => m.name === 'Small')).toHaveProperty('price', -0.5);
      expect(sizeOptions.find(m => m.name === 'Large')).toHaveProperty('price', 0.5);
    });

    it('should return tea modifications for tea category', () => {
      const modifications = service.getAvailableModifications('tea');
      const categories = [...new Set(modifications.map(m => m.category))];
      
      expect(categories).toContain('Size Options');
      expect(categories).toContain('Temperature');
      expect(categories).toContain('Milk Options');
      expect(categories).not.toContain('Coffee Add-ons');
    });

    it('should return default modifications for unknown category', () => {
      const modifications = service.getAvailableModifications('unknown');
      const categories = [...new Set(modifications.map(m => m.category))];
      
      expect(categories).toEqual(['Size Options']);
    });

    it('should handle null/undefined category', () => {
      const modifications = service.getAvailableModifications(undefined);
      expect(modifications).toBeDefined();
      expect(modifications.length).toBeGreaterThan(0);
    });
  });

  describe('calculateModificationPrice', () => {
    it('should calculate price for single modification', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'size-large',
          type: 'size',
          category: 'Size Options',
          name: 'Large',
          price: 0.5,
          selected: true,
        },
      ];
      
      const price = service.calculateModificationPrice(modifications);
      expect(price).toBe(0.5);
    });

    it('should calculate price for multiple modifications', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'size-large',
          type: 'size',
          category: 'Size Options',
          name: 'Large',
          price: 0.5,
          selected: true,
        },
        {
          id: 'milk-oat',
          type: 'addition',
          category: 'Milk Options',
          name: 'Oat Milk',
          price: 0.7,
          selected: true,
        },
        {
          id: 'add-extra-shot',
          type: 'addition',
          category: 'Coffee Add-ons',
          name: 'Extra Shot',
          price: 0.75,
          selected: true,
          quantity: 2,
        },
      ];
      
      const price = service.calculateModificationPrice(modifications);
      expect(price).toBe(0.5 + 0.7 + (0.75 * 2)); // 2.7
    });

    it('should ignore unselected modifications', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'size-large',
          type: 'size',
          category: 'Size Options',
          name: 'Large',
          price: 0.5,
          selected: false,
        },
        {
          id: 'milk-oat',
          type: 'addition',
          category: 'Milk Options',
          name: 'Oat Milk',
          price: 0.7,
          selected: true,
        },
      ];
      
      const price = service.calculateModificationPrice(modifications);
      expect(price).toBe(0.7);
    });

    it('should handle negative prices (discounts)', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'size-small',
          type: 'size',
          category: 'Size Options',
          name: 'Small',
          price: -0.5,
          selected: true,
        },
      ];
      
      const price = service.calculateModificationPrice(modifications);
      expect(price).toBe(-0.5);
    });

    it('should handle empty modifications array', () => {
      const price = service.calculateModificationPrice([]);
      expect(price).toBe(0);
    });
  });

  describe('validateModifications', () => {
    it('should validate single size selection', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'size-small',
          type: 'size',
          category: 'Size Options',
          name: 'Small',
          price: -0.5,
          selected: true,
        },
        {
          id: 'size-large',
          type: 'size',
          category: 'Size Options',
          name: 'Large',
          price: 0.5,
          selected: true,
        },
      ];
      
      const result = service.validateModifications(modifications);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Only one size can be selected');
    });

    it('should validate single temperature selection', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'temp-hot',
          type: 'temperature',
          category: 'Temperature',
          name: 'Hot',
          price: 0,
          selected: true,
        },
        {
          id: 'temp-iced',
          type: 'temperature',
          category: 'Temperature',
          name: 'Iced',
          price: 0,
          selected: true,
        },
      ];
      
      const result = service.validateModifications(modifications);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Only one temperature can be selected');
    });

    it('should validate single milk selection', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'milk-whole',
          type: 'addition',
          category: 'Milk Options',
          name: 'Whole Milk',
          price: 0,
          selected: true,
        },
        {
          id: 'milk-oat',
          type: 'addition',
          category: 'Milk Options',
          name: 'Oat Milk',
          price: 0.7,
          selected: true,
        },
      ];
      
      const result = service.validateModifications(modifications);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Only one milk type can be selected');
    });

    it('should validate quantity limits', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'add-extra-shot',
          type: 'addition',
          category: 'Coffee Add-ons',
          name: 'Extra Shot',
          price: 0.75,
          selected: true,
          quantity: 0,
        },
      ];
      
      const result = service.validateModifications(modifications);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Extra Shot quantity must be at least 1');
    });

    it('should pass valid modifications', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'size-large',
          type: 'size',
          category: 'Size Options',
          name: 'Large',
          price: 0.5,
          selected: true,
        },
        {
          id: 'temp-hot',
          type: 'temperature',
          category: 'Temperature',
          name: 'Hot',
          price: 0,
          selected: true,
        },
        {
          id: 'milk-oat',
          type: 'addition',
          category: 'Milk Options',
          name: 'Oat Milk',
          price: 0.7,
          selected: true,
        },
        {
          id: 'add-extra-shot',
          type: 'addition',
          category: 'Coffee Add-ons',
          name: 'Extra Shot',
          price: 0.75,
          selected: true,
          quantity: 2,
        },
      ];
      
      const result = service.validateModifications(modifications);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('applyModifications', () => {
    it('should apply modifications to an item correctly', () => {
      const item: EnhancedOrderItem = {
        id: 'item-1',
        productId: 'prod-1',
        name: 'Cappuccino',
        price: 3.5,
        originalPrice: 3.5,
        quantity: 2,
        emoji: '☕',
        modifications: [],
        modificationPrice: 0,
        totalPrice: 7.0,
      };
      
      const modifications: CartItemModification[] = [
        {
          id: 'size-large',
          type: 'size',
          category: 'Size Options',
          name: 'Large',
          price: 0.5,
          selected: true,
        },
        {
          id: 'milk-oat',
          type: 'addition',
          category: 'Milk Options',
          name: 'Oat Milk',
          price: 0.7,
          selected: true,
        },
      ];
      
      const updatedItem = service.applyModifications(item, modifications);
      
      expect(updatedItem.modifications).toEqual(modifications);
      expect(updatedItem.modificationPrice).toBe(1.2);
      expect(updatedItem.totalPrice).toBe((3.5 + 1.2) * 2); // 9.4
      expect(updatedItem.lastModified).toBeDefined();
    });
  });

  describe('getModificationSummary', () => {
    it('should generate readable summary', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'size-large',
          type: 'size',
          category: 'Size Options',
          name: 'Large',
          price: 0.5,
          selected: true,
        },
        {
          id: 'milk-oat',
          type: 'addition',
          category: 'Milk Options',
          name: 'Oat Milk',
          price: 0.7,
          selected: true,
        },
        {
          id: 'add-extra-shot',
          type: 'addition',
          category: 'Coffee Add-ons',
          name: 'Extra Shot',
          price: 0.75,
          selected: true,
          quantity: 2,
        },
      ];
      
      const summary = service.getModificationSummary(modifications);
      expect(summary).toContain('Large');
      expect(summary).toContain('Oat Milk');
      expect(summary).toContain('2x Extra Shot');
    });

    it('should return empty string for no selections', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'size-medium',
          type: 'size',
          category: 'Size Options',
          name: 'Medium',
          price: 0,
          selected: false,
        },
      ];
      
      const summary = service.getModificationSummary(modifications);
      expect(summary).toBe('');
    });
  });

  describe('getPriceImpactSummary', () => {
    it('should show positive price impact', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'size-large',
          type: 'size',
          category: 'Size Options',
          name: 'Large',
          price: 0.5,
          selected: true,
        },
      ];
      
      const summary = service.getPriceImpactSummary(modifications);
      expect(summary).toBe('+$0.50');
    });

    it('should show negative price impact', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'size-small',
          type: 'size',
          category: 'Size Options',
          name: 'Small',
          price: -0.5,
          selected: true,
        },
      ];
      
      const summary = service.getPriceImpactSummary(modifications);
      expect(summary).toBe('-$0.50');
    });

    it('should show no price change', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'temp-hot',
          type: 'temperature',
          category: 'Temperature',
          name: 'Hot',
          price: 0,
          selected: true,
        },
      ];
      
      const summary = service.getPriceImpactSummary(modifications);
      expect(summary).toBe('No price change');
    });
  });

  describe('resetToDefaults', () => {
    it('should reset modifications to default states', () => {
      const modifications: CartItemModification[] = [
        {
          id: 'size-large',
          type: 'size',
          category: 'Size Options',
          name: 'Large',
          price: 0.5,
          selected: true,
        },
        {
          id: 'size-medium',
          type: 'size',
          category: 'Size Options',
          name: 'Medium',
          price: 0,
          selected: false,
        },
        {
          id: 'add-extra-shot',
          type: 'addition',
          category: 'Coffee Add-ons',
          name: 'Extra Shot',
          price: 0.75,
          selected: true,
          quantity: 3,
        },
      ];
      
      const reset = service.resetToDefaults(modifications);
      
      // Medium should be selected (default)
      expect(reset.find(m => m.id === 'size-medium')?.selected).toBe(true);
      expect(reset.find(m => m.id === 'size-large')?.selected).toBe(false);
      
      // Quantities should reset to 1
      expect(reset.find(m => m.id === 'add-extra-shot')?.quantity).toBe(1);
    });
  });
});