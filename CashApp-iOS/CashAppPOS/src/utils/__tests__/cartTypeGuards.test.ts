/**
 * Tests for cart type guards
 */

import {
  isOrderItem,
  isEnhancedOrderItem,
  isCartItemModification,
  isSplitBillGroup,
  isCartTemplate,
  validateCartIntegrity,
  cartNeedsMigration,
} from '../cartTypeGuards';
import { OrderItem } from '../../types';
import { EnhancedOrderItem, CartItemModification } from '../../types/cart';

describe('cartTypeGuards', () => {
  describe('isOrderItem', () => {
    it('should validate correct OrderItem with number ID', () => {
      const item: OrderItem = {
        id: 123,
        name: 'Coffee',
        price: 4.99,
        quantity: 2,
      };

      expect(isOrderItem(item)).toBe(true);
    });

    it('should validate OrderItem with string ID', () => {
      const item = {
        id: '456',
        name: 'Tea',
        price: 3.5,
        quantity: 1,
      };

      expect(isOrderItem(item)).toBe(true);
    });

    it('should reject invalid OrderItems', () => {
      const invalidItems = [
        null,
        undefined,
        {},
        { name: 'No ID', price: 5, quantity: 1 },
        { id: 1, price: 5, quantity: 1 }, // No name
        { id: 1, name: 'Item', quantity: 1 }, // No price
        { id: 1, name: 'Item', price: 5 }, // No quantity
        { id: 1, name: 'Item', price: -5, quantity: 1 }, // Negative price
        { id: 1, name: 'Item', price: 5, quantity: 0 }, // Zero quantity
        { id: 1, name: 'Item', price: NaN, quantity: 1 }, // NaN price
        { id: 1, name: 'Item', price: Infinity, quantity: 1 }, // Infinity price
      ];

      invalidItems.forEach((item) => {
        expect(isOrderItem(item)).toBe(false);
      });
    });
  });

  describe('isEnhancedOrderItem', () => {
    it('should validate correct EnhancedOrderItem', () => {
      const item: EnhancedOrderItem = {
        id: '123',
        productId: '123',
        name: 'Coffee',
        price: 4.99,
        quantity: 2,
        originalPrice: 4.99,
        modificationPrice: 0,
        totalPrice: 9.98,
        modifications: [],
        addedAt: '2023-01-01T10:00:00Z',
        lastModified: '2023-01-01T10:00:00Z',
      };

      expect(isEnhancedOrderItem(item)).toBe(true);
    });

    it('should validate EnhancedOrderItem with modifications', () => {
      const item: EnhancedOrderItem = {
        id: '123',
        productId: '123',
        name: 'Coffee',
        price: 4.99,
        quantity: 1,
        originalPrice: 4.99,
        modificationPrice: 0.5,
        totalPrice: 5.49,
        modifications: [
          {
            id: 'm1',
            type: 'size',
            category: 'Size',
            name: 'Large',
            price: 0.5,
            selected: true,
          },
        ],
        addedAt: '2023-01-01T10:00:00Z',
        lastModified: '2023-01-01T10:00:00Z',
      };

      expect(isEnhancedOrderItem(item)).toBe(true);
    });

    it('should reject items with number IDs', () => {
      const item = {
        id: 123, // Number ID
        productId: '123',
        name: 'Coffee',
        price: 4.99,
        quantity: 1,
        originalPrice: 4.99,
        modificationPrice: 0,
        totalPrice: 4.99,
        modifications: [],
        addedAt: '2023-01-01T10:00:00Z',
        lastModified: '2023-01-01T10:00:00Z',
      };

      expect(isEnhancedOrderItem(item)).toBe(false);
    });

    it('should reject items with invalid modifications', () => {
      const item = {
        id: '123',
        productId: '123',
        name: 'Coffee',
        price: 4.99,
        quantity: 1,
        originalPrice: 4.99,
        modificationPrice: 0,
        totalPrice: 4.99,
        modifications: [{ invalid: 'modification' }], // Invalid modification
        addedAt: '2023-01-01T10:00:00Z',
        lastModified: '2023-01-01T10:00:00Z',
      };

      expect(isEnhancedOrderItem(item)).toBe(false);
    });
  });

  describe('isCartItemModification', () => {
    it('should validate correct modification', () => {
      const mod: CartItemModification = {
        id: 'm1',
        type: 'size',
        category: 'Size Options',
        name: 'Large',
        price: 0.5,
        selected: true,
      };

      expect(isCartItemModification(mod)).toBe(true);
    });

    it('should validate modification with quantity', () => {
      const mod: CartItemModification = {
        id: 'm2',
        type: 'addition',
        category: 'Extras',
        name: 'Extra Shot',
        price: 0.75,
        selected: true,
        quantity: 2,
      };

      expect(isCartItemModification(mod)).toBe(true);
    });

    it('should reject invalid modifications', () => {
      const invalidMods = [
        { id: 'm1', type: 'invalid', category: 'Test', name: 'Test', price: 0, selected: true }, // Invalid type
        { id: 'm1', type: 'size', name: 'Test', price: 0, selected: true }, // Missing category
        { id: 'm1', type: 'size', category: 'Test', price: 0, selected: true }, // Missing name
        { id: 'm1', type: 'size', category: 'Test', name: 'Test', selected: true }, // Missing price
        { id: 'm1', type: 'size', category: 'Test', name: 'Test', price: NaN, selected: true }, // NaN price
        { id: 'm1', type: 'size', category: 'Test', name: 'Test', price: 0, selected: 'yes' }, // Invalid selected type
      ];

      invalidMods.forEach((mod) => {
        expect(isCartItemModification(mod)).toBe(false);
      });
    });
  });

  describe('validateCartIntegrity', () => {
    it('should validate cart with no issues', () => {
      const cart: EnhancedOrderItem[] = [
        {
          id: '1',
          productId: '1',
          name: 'Coffee',
          price: 4.99,
          quantity: 2,
          originalPrice: 4.99,
          modificationPrice: 0,
          totalPrice: 9.98,
          modifications: [],
          addedAt: '2023-01-01T10:00:00Z',
          lastModified: '2023-01-01T10:00:00Z',
        },
        {
          id: '2',
          productId: '2',
          name: 'Muffin',
          price: 2.99,
          quantity: 1,
          originalPrice: 2.99,
          modificationPrice: 0,
          totalPrice: 2.99,
          modifications: [],
          addedAt: '2023-01-01T10:00:00Z',
          lastModified: '2023-01-01T10:00:00Z',
        },
      ];

      const result = validateCartIntegrity(cart);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate IDs', () => {
      const cart: EnhancedOrderItem[] = [
        {
          id: '1',
          productId: '1',
          name: 'Coffee',
          price: 4.99,
          quantity: 1,
          originalPrice: 4.99,
          modificationPrice: 0,
          totalPrice: 4.99,
          modifications: [],
          addedAt: '2023-01-01T10:00:00Z',
          lastModified: '2023-01-01T10:00:00Z',
        },
        {
          id: '1', // Duplicate ID
          productId: '2',
          name: 'Tea',
          price: 3.99,
          quantity: 1,
          originalPrice: 3.99,
          modificationPrice: 0,
          totalPrice: 3.99,
          modifications: [],
          addedAt: '2023-01-01T10:00:00Z',
          lastModified: '2023-01-01T10:00:00Z',
        },
      ];

      const result = validateCartIntegrity(cart);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate item ID found: 1');
    });

    it('should detect pricing inconsistencies', () => {
      const cart: EnhancedOrderItem[] = [
        {
          id: '1',
          productId: '1',
          name: 'Coffee',
          price: 4.99,
          quantity: 2,
          originalPrice: 4.99,
          modificationPrice: 0.5,
          totalPrice: 15.0, // Should be (4.99 + 0.50) * 2 = 10.98
          modifications: [
            {
              id: 'm1',
              type: 'size',
              category: 'Size',
              name: 'Large',
              price: 0.5,
              selected: true,
            },
          ],
          addedAt: '2023-01-01T10:00:00Z',
          lastModified: '2023-01-01T10:00:00Z',
        },
      ];

      const result = validateCartIntegrity(cart);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Item "Coffee" has inconsistent total price. Expected: 10.98, Actual: 15'
      );
    });

    it('should detect multiple size selections', () => {
      const cart: EnhancedOrderItem[] = [
        {
          id: '1',
          productId: '1',
          name: 'Coffee',
          price: 4.99,
          quantity: 1,
          originalPrice: 4.99,
          modificationPrice: 1.0,
          totalPrice: 5.99,
          modifications: [
            {
              id: 'm1',
              type: 'size',
              category: 'Size',
              name: 'Small',
              price: -0.5,
              selected: true,
            },
            {
              id: 'm2',
              type: 'size',
              category: 'Size',
              name: 'Large',
              price: 0.5,
              selected: true,
            },
          ],
          addedAt: '2023-01-01T10:00:00Z',
          lastModified: '2023-01-01T10:00:00Z',
        },
      ];

      const result = validateCartIntegrity(cart);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Item "Coffee" has multiple size selections');
    });
  });

  describe('cartNeedsMigration', () => {
    it('should return true for old format cart', () => {
      const cart: OrderItem[] = [
        { id: 1, name: 'Coffee', price: 4.99, quantity: 1 },
        { id: 2, name: 'Muffin', price: 2.99, quantity: 1 },
      ];

      expect(cartNeedsMigration(cart)).toBe(true);
    });

    it('should return false for enhanced cart', () => {
      const cart: EnhancedOrderItem[] = [
        {
          id: '1',
          productId: '1',
          name: 'Coffee',
          price: 4.99,
          quantity: 1,
          originalPrice: 4.99,
          modificationPrice: 0,
          totalPrice: 4.99,
          modifications: [],
          addedAt: '2023-01-01T10:00:00Z',
          lastModified: '2023-01-01T10:00:00Z',
        },
      ];

      expect(cartNeedsMigration(cart)).toBe(false);
    });

    it('should return true for mixed format cart', () => {
      const cart: any[] = [
        { id: 1, name: 'Old Item', price: 4.99, quantity: 1 }, // Old format
        {
          id: '2',
          productId: '2',
          name: 'New Item',
          price: 3.99,
          quantity: 1,
          originalPrice: 3.99,
          modificationPrice: 0,
          totalPrice: 3.99,
          modifications: [],
          addedAt: '2023-01-01T10:00:00Z',
          lastModified: '2023-01-01T10:00:00Z',
        }, // Enhanced format
      ];

      expect(cartNeedsMigration(cart)).toBe(true);
    });

    it('should return false for empty cart', () => {
      expect(cartNeedsMigration([])).toBe(false);
    });
  });
});
