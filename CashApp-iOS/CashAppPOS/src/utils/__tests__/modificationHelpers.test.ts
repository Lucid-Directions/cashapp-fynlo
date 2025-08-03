/**
 * Tests for modification helper utilities
 * Validates formatting, calculations, and utility functions
 */

import {
  formatModificationSummary,
  calculateTotalModificationPrice,
  formatModificationPrice,
  hasModifications,
  getModificationCount,
  serializeModifications,
  deserializeModifications,
  groupModificationsByCategory,
  getModificationTypeColor,
  isModificationCombinationValid,
  getModificationIcon,
  sortModifications,
  areModificationsEqual
} from '../modificationHelpers';
import { CartItemModification, EnhancedOrderItem } from '../../types/cart';

describe('modificationHelpers', () => {
  const mockModifications: CartItemModification[] = [
    { id: '1', type: 'size', category: 'Size', name: 'Large', price: 0.50, selected: true },
    { id: '2', type: 'temperature', category: 'Temp', name: 'Iced', price: 0.00, selected: true },
    { id: '3', type: 'addition', category: 'Add-ons', name: 'Extra Shot', price: 0.75, selected: true, quantity: 2 },
    { id: '4', type: 'addition', category: 'Add-ons', name: 'Vanilla Syrup', price: 0.50, selected: false },
    { id: '5', type: 'removal', category: 'Remove', name: 'No Whip', price: 0.00, selected: true },
  ];

  describe('formatModificationSummary', () => {
    it('formats selected modifications with quantities', () => {
      const summary = formatModificationSummary(mockModifications);
      expect(summary).toContain('Large');
      expect(summary).toContain('Iced');
      expect(summary).toContain('2x Extra Shot');
      expect(summary).toContain('No Whip');
      expect(summary).not.toContain('Vanilla Syrup'); // Not selected
    });

    it('returns empty string for no selected modifications', () => {
      const unselected = mockModifications.map(m => ({ ...m, selected: false }));
      const summary = formatModificationSummary(unselected);
      expect(summary).toBe('');
    });

    it('truncates long summaries', () => {
      const manyMods = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        type: 'addition' as const,
        category: 'Add-ons',
        name: `Very Long Modification Name ${i}`,
        price: 0.50,
        selected: true
      }));

      const summary = formatModificationSummary(manyMods, 50);
      expect(summary.length).toBeLessThanOrEqual(50);
      expect(summary).toMatch(/\.\.\.$/);
    });

    it('orders modifications by type', () => {
      const summary = formatModificationSummary(mockModifications);
      const parts = summary.split(', ');
      
      // Size should come before temperature
      const sizeIndex = parts.findIndex(p => p.includes('Large'));
      const tempIndex = parts.findIndex(p => p.includes('Iced'));
      expect(sizeIndex).toBeLessThan(tempIndex);
    });
  });

  describe('calculateTotalModificationPrice', () => {
    it('calculates total with quantities', () => {
      const total = calculateTotalModificationPrice(mockModifications);
      // Large: 0.50 + Extra Shot: 0.75 * 2 = 2.00
      expect(total).toBe(2.00);
    });

    it('returns 0 for no selected modifications', () => {
      const unselected = mockModifications.map(m => ({ ...m, selected: false }));
      const total = calculateTotalModificationPrice(unselected);
      expect(total).toBe(0);
    });

    it('handles negative prices', () => {
      const mods: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Small', price: -0.50, selected: true },
      ];
      const total = calculateTotalModificationPrice(mods);
      expect(total).toBe(-0.50);
    });
  });

  describe('formatModificationPrice', () => {
    it('formats positive prices with plus sign', () => {
      expect(formatModificationPrice(1.50)).toBe('+$1.50');
    });

    it('formats negative prices without plus sign', () => {
      expect(formatModificationPrice(-0.50)).toBe('-$0.50');
    });

    it('returns empty string for zero', () => {
      expect(formatModificationPrice(0)).toBe('');
    });

    it('formats to two decimal places', () => {
      expect(formatModificationPrice(1.555)).toBe('+$1.56');
    });
  });

  describe('hasModifications', () => {
    const baseItem: EnhancedOrderItem = {
      id: '123',
      productId: 'prod-1',
      name: 'Coffee',
      price: 3.00,
      quantity: 1,
      originalPrice: 3.00,
      modificationPrice: 0,
      totalPrice: 3.00,
      modifications: [],
      addedAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      addedBy: 'user-1'
    };

    it('returns true for items with selected modifications', () => {
      const item = { ...baseItem, modifications: mockModifications };
      expect(hasModifications(item)).toBe(true);
    });

    it('returns true for items with special instructions', () => {
      const item = { ...baseItem, specialInstructions: 'Extra hot please' };
      expect(hasModifications(item)).toBe(true);
    });

    it('returns false for items without modifications or instructions', () => {
      expect(hasModifications(baseItem)).toBe(false);
    });
  });

  describe('getModificationCount', () => {
    const baseItem: EnhancedOrderItem = {
      id: '123',
      productId: 'prod-1',
      name: 'Coffee',
      price: 3.00,
      quantity: 1,
      originalPrice: 3.00,
      modificationPrice: 0,
      totalPrice: 3.00,
      modifications: [],
      addedAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      addedBy: 'user-1'
    };

    it('counts selected modifications', () => {
      const item = { ...baseItem, modifications: mockModifications };
      expect(getModificationCount(item)).toBe(4); // 4 selected mods
    });

    it('includes special instructions in count', () => {
      const item = { 
        ...baseItem, 
        modifications: mockModifications,
        specialInstructions: 'Extra foam' 
      };
      expect(getModificationCount(item)).toBe(5); // 4 mods + 1 instruction
    });
  });

  describe('serializeModifications / deserializeModifications', () => {
    it('serializes and deserializes modifications correctly', () => {
      const serialized = serializeModifications(mockModifications);
      const deserialized = deserializeModifications(serialized, mockModifications);

      // Should maintain selected state
      expect(deserialized.find(m => m.id === '1')?.selected).toBe(true);
      expect(deserialized.find(m => m.id === '4')?.selected).toBe(false);

      // Should maintain quantities
      expect(deserialized.find(m => m.id === '3')?.quantity).toBe(2);
    });

    it('handles invalid JSON gracefully', () => {
      const deserialized = deserializeModifications('invalid json', mockModifications);
      expect(deserialized).toEqual(mockModifications);
    });
  });

  describe('groupModificationsByCategory', () => {
    it('groups modifications correctly', () => {
      const grouped = groupModificationsByCategory(mockModifications);
      
      expect(grouped['Size']).toHaveLength(1);
      expect(grouped['Temp']).toHaveLength(1);
      expect(grouped['Add-ons']).toHaveLength(2);
      expect(grouped['Remove']).toHaveLength(1);
    });
  });

  describe('getModificationTypeColor', () => {
    const mockTheme = {
      colors: {
        info: '#2196F3',
        warning: '#FF9800',
        success: '#4CAF50',
        error: '#F44336',
        primary: '#007AFF'
      }
    };

    it('returns correct colors for modification types', () => {
      expect(getModificationTypeColor('size', mockTheme)).toBe('#2196F3');
      expect(getModificationTypeColor('temperature', mockTheme)).toBe('#FF9800');
      expect(getModificationTypeColor('addition', mockTheme)).toBe('#4CAF50');
      expect(getModificationTypeColor('removal', mockTheme)).toBe('#F44336');
      expect(getModificationTypeColor('custom', mockTheme)).toBe('#007AFF');
    });
  });

  describe('isModificationCombinationValid', () => {
    it('validates single size selection', () => {
      const mods: CartItemModification[] = [
        { id: '1', type: 'size', category: 'Size', name: 'Small', price: -0.50, selected: true },
        { id: '2', type: 'size', category: 'Size', name: 'Large', price: 0.50, selected: true },
      ];

      const result = isModificationCombinationValid(mods);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Only one size option');
    });

    it('validates single temperature selection', () => {
      const mods: CartItemModification[] = [
        { id: '1', type: 'temperature', category: 'Temp', name: 'Hot', price: 0, selected: true },
        { id: '2', type: 'temperature', category: 'Temp', name: 'Iced', price: 0, selected: true },
      ];

      const result = isModificationCombinationValid(mods);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Only one temperature option');
    });

    it('validates single milk selection', () => {
      const mods: CartItemModification[] = [
        { id: '1', type: 'addition', category: 'Milk Options', name: 'Whole', price: 0, selected: true },
        { id: '2', type: 'addition', category: 'Milk Options', name: 'Oat', price: 0.70, selected: true },
      ];

      const result = isModificationCombinationValid(mods);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Only one milk option');
    });

    it('validates valid combinations', () => {
      const result = isModificationCombinationValid(mockModifications);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('getModificationIcon', () => {
    it('returns correct icons for modification types', () => {
      expect(getModificationIcon('size')).toBe('format-size');
      expect(getModificationIcon('temperature')).toBe('device-thermostat');
      expect(getModificationIcon('addition')).toBe('add-circle-outline');
      expect(getModificationIcon('removal')).toBe('remove-circle-outline');
      expect(getModificationIcon('custom')).toBe('tune');
    });
  });

  describe('sortModifications', () => {
    it('sorts modifications by type order', () => {
      const unsorted: CartItemModification[] = [
        { id: '1', type: 'removal', category: 'Remove', name: 'No Whip', price: 0, selected: true },
        { id: '2', type: 'size', category: 'Size', name: 'Large', price: 0.50, selected: true },
        { id: '3', type: 'addition', category: 'Add-ons', name: 'Shot', price: 0.75, selected: true },
      ];

      const sorted = sortModifications(unsorted);
      expect(sorted[0].type).toBe('size');
      expect(sorted[1].type).toBe('addition');
      expect(sorted[2].type).toBe('removal');
    });

    it('sorts by name within same type', () => {
      const unsorted: CartItemModification[] = [
        { id: '1', type: 'addition', category: 'Add-ons', name: 'Vanilla', price: 0.50, selected: true },
        { id: '2', type: 'addition', category: 'Add-ons', name: 'Caramel', price: 0.50, selected: true },
      ];

      const sorted = sortModifications(unsorted);
      expect(sorted[0].name).toBe('Caramel');
      expect(sorted[1].name).toBe('Vanilla');
    });
  });

  describe('areModificationsEqual', () => {
    it('returns true for equal modifications', () => {
      const mods1 = mockModifications;
      const mods2 = [...mockModifications];
      expect(areModificationsEqual(mods1, mods2)).toBe(true);
    });

    it('returns false for different lengths', () => {
      const mods1 = mockModifications;
      const mods2 = mockModifications.slice(0, 3);
      expect(areModificationsEqual(mods1, mods2)).toBe(false);
    });

    it('returns false for different selections', () => {
      const mods1 = mockModifications;
      const mods2 = mockModifications.map(m => 
        m.id === '4' ? { ...m, selected: true } : m
      );
      expect(areModificationsEqual(mods1, mods2)).toBe(false);
    });

    it('returns false for different quantities', () => {
      const mods1 = mockModifications;
      const mods2 = mockModifications.map(m => 
        m.id === '3' ? { ...m, quantity: 3 } : m
      );
      expect(areModificationsEqual(mods1, mods2)).toBe(false);
    });

    it('ignores order of modifications', () => {
      const mods1 = mockModifications;
      const mods2 = [...mockModifications].reverse();
      expect(areModificationsEqual(mods1, mods2)).toBe(true);
    });
  });
});