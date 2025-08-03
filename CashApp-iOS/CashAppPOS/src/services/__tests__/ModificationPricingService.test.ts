/**
 * Tests for ModificationPricingService
 * Validates pricing calculations, modification validation, and category mapping
 */

import { ModificationPricingService, DEFAULT_MODIFICATIONS } from '../ModificationPricingService';
import { CartItemModification, EnhancedOrderItem } from '../../types/cart';

describe('ModificationPricingService', () => {
  let service: ModificationPricingService;

  beforeEach(() => {
    service = ModificationPricingService.getInstance();
  });

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const instance1 = ModificationPricingService.getInstance();
      const instance2 = ModificationPricingService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getAvailableModifications', () => {
    it('returns coffee modifications for coffee category', () => {
      const mods = service.getAvailableModifications('coffee');
      
      expect(mods).toHaveLength(expect.any(Number));
      
      // Should include size options
      const sizeOptions = mods.filter(m => m.type === 'size');
      expect(sizeOptions.length).toBeGreaterThan(0);
      
      // Should include temperature options
      const tempOptions = mods.filter(m => m.type === 'temperature');
      expect(tempOptions.length).toBeGreaterThan(0);
      
      // Should include coffee additions
      const additions = mods.filter(m => m.category === 'Coffee Add-ons');
      expect(additions.length).toBeGreaterThan(0);
    });

    it('returns limited modifications for tea category', () => {
      const mods = service.getAvailableModifications('tea');
      
      // Tea should have fewer options than coffee
      const coffeeMods = service.getAvailableModifications('coffee');
      expect(mods.length).toBeLessThan(coffeeMods.length);
      
      // Should not have coffee-specific additions
      const coffeeAddons = mods.filter(m => m.category === 'Coffee Add-ons');
      expect(coffeeAddons).toHaveLength(0);
    });

    it('returns default modifications for unknown category', () => {
      const mods = service.getAvailableModifications('unknown-category');
      
      // Should only have size options by default
      const types = [...new Set(mods.map(m => m.type))];
      expect(types).toEqual(['size']);
    });

    it('sets default selections correctly', () => {
      const mods = service.getAvailableModifications('coffee');
      
      // Medium size should be selected by default
      const mediumSize = mods.find(m => m.name === 'Medium' && m.type === 'size');
      expect(mediumSize?.selected).toBe(true);
      
      // Hot temperature should be selected by default
      const hotTemp = mods.find(m => m.name === 'Hot' && m.type === 'temperature');
      expect(hotTemp?.selected).toBe(true);
      
      // Whole milk should be selected by default
      const wholeMilk = mods.find(m => m.name === 'Whole Milk');
      expect(wholeMilk?.selected).toBe(true);
    });
  });

  describe('calculateModificationPrice', () => {
    it('calculates price for selected modifications', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Large', price: 0.50, selected: true },
        { id: '2', type: 'addition', category: 'Add-ons', name: 'Extra Shot', price: 0.75, selected: true, quantity: 2 },
        { id: '3', type: 'addition', category: 'Add-ons', name: 'Syrup', price: 0.50, selected: false },
      ];

      const total = service.calculateModificationPrice(modifications);
      expect(total).toBe(0.50 + (0.75 * 2)); // 0.50 + 1.50 = 2.00
    });

    it('returns 0 for no selected modifications', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Medium', price: 0.00, selected: false },
        { id: '2', type: 'addition', category: 'Add-ons', name: 'Syrup', price: 0.50, selected: false },
      ];

      const total = service.calculateModificationPrice(modifications);
      expect(total).toBe(0);
    });

    it('handles negative prices for removals', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Small', price: -0.50, selected: true },
        { id: '2', type: 'removal', category: 'Remove', name: 'No Whip', price: 0.00, selected: true },
      ];

      const total = service.calculateModificationPrice(modifications);
      expect(total).toBe(-0.50);
    });
  });

  describe('validateModifications', () => {
    it('validates single size selection', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Small', price: -0.50, selected: true },
        { id: '2', type: 'size', category: 'Size', name: 'Large', price: 0.50, selected: true },
      ];

      const result = service.validateModifications(modifications);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Only one size can be selected');
    });

    it('validates single temperature selection', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'temperature', category: 'Temp', name: 'Hot', price: 0, selected: true },
        { id: '2', type: 'temperature', category: 'Temp', name: 'Iced', price: 0, selected: true },
      ];

      const result = service.validateModifications(modifications);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Only one temperature can be selected');
    });

    it('validates single milk selection', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'addition', category: 'Milk Options', name: 'Whole Milk', price: 0, selected: true },
        { id: '2', type: 'addition', category: 'Milk Options', name: 'Oat Milk', price: 0.70, selected: true },
      ];

      const result = service.validateModifications(modifications);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Only one milk type can be selected');
    });

    it('validates quantity limits', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'addition', category: 'Add-ons', name: 'Extra Shot', price: 0.75, selected: true, quantity: 5 },
      ];

      const result = service.validateModifications(modifications);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('cannot exceed'))).toBe(true);
    });

    it('passes validation for valid modifications', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Large', price: 0.50, selected: true },
        { id: '2', type: 'temperature', category: 'Temp', name: 'Hot', price: 0, selected: true },
        { id: '3', type: 'addition', category: 'Add-ons', name: 'Extra Shot', price: 0.75, selected: true, quantity: 2 },
      ];

      const result = service.validateModifications(modifications);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('applyModifications', () => {
    const baseItem: EnhancedOrderItem = {
      id: '123',
      productId: 'prod-1',
      name: 'Latte',
      price: 4.50,
      quantity: 2,
      originalPrice: 4.50,
      modificationPrice: 0,
      totalPrice: 9.00,
      modifications: [],
      categoryName: 'coffee',
      emoji: '☕',
      icon: 'coffee',
      addedAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      addedBy: 'user-1'
    };

    it('applies modifications and recalculates prices', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Large', price: 0.50, selected: true },
        { id: '2', type: 'addition', category: 'Add-ons', name: 'Extra Shot', price: 0.75, selected: true },
      ];

      const result = service.applyModifications(baseItem, modifications);

      expect(result.modifications).toEqual(modifications);
      expect(result.modificationPrice).toBe(1.25); // 0.50 + 0.75
      expect(result.totalPrice).toBe((4.50 + 1.25) * 2); // (base + mods) * quantity = 11.50
      expect(result.lastModified).toBeDefined();
    });
  });

  describe('getModificationSummary', () => {
    it('generates human-readable summary', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Large', price: 0.50, selected: true },
        { id: '2', type: 'temperature', category: 'Temp', name: 'Iced', price: 0, selected: true },
        { id: '3', type: 'addition', category: 'Add-ons', name: 'Extra Shot', price: 0.75, selected: true, quantity: 2 },
      ];

      const summary = service.getModificationSummary(modifications);
      expect(summary).toContain('Large');
      expect(summary).toContain('Iced');
      expect(summary).toContain('2x Extra Shot');
    });

    it('returns empty string for no modifications', () => {
      const summary = service.getModificationSummary([]);
      expect(summary).toBe('');
    });
  });

  describe('getPriceImpactSummary', () => {
    it('shows positive price impact', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Large', price: 0.50, selected: true },
      ];

      const summary = service.getPriceImpactSummary(modifications);
      expect(summary).toBe('+$0.50');
    });

    it('shows negative price impact', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Small', price: -0.50, selected: true },
      ];

      const summary = service.getPriceImpactSummary(modifications);
      expect(summary).toBe('-$0.50');
    });

    it('shows no price change', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'temperature', category: 'Temp', name: 'Iced', price: 0, selected: true },
      ];

      const summary = service.getPriceImpactSummary(modifications);
      expect(summary).toBe('No price change');
    });
  });

  describe('resetToDefaults', () => {
    it('resets modifications to default selections', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Small', price: -0.50, selected: true },
        { id: '2', type: 'size', category: 'Size', name: 'Medium', price: 0.00, selected: false },
        { id: '3', type: 'size', category: 'Size', name: 'Large', price: 0.50, selected: false },
      ];

      const reset = service.resetToDefaults(modifications);
      
      // Small should be deselected
      expect(reset.find(m => m.name === 'Small')?.selected).toBe(false);
      // Medium should be selected (default)
      expect(reset.find(m => m.name === 'Medium')?.selected).toBe(true);
      // Large should remain deselected
      expect(reset.find(m => m.name === 'Large')?.selected).toBe(false);
    });

    it('resets quantities to 1', () => {
      const modifications: CartItemModification[] = [
        { id: '1', type: 'addition', category: 'Add-ons', name: 'Extra Shot', price: 0.75, selected: true, quantity: 3 },
      ];

      const reset = service.resetToDefaults(modifications);
      expect(reset[0].quantity).toBe(1);
    });
  });
});