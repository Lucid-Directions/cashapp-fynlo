/**
 * Tests for cart migration utilities
 */

import { 
  migrateOrderItem, 
  migrateCart, 
  validateUniqueIds, 
  recalculateItemPricing 
} from '../cartMigration';
import { OrderItem } from '../../types';
import { EnhancedOrderItem } from '../../types/cart';

describe('cartMigration', () => {
  describe('migrateOrderItem', () => {
    it('should migrate a valid OrderItem with number ID', () => {
      const oldItem: OrderItem = {
        id: 123,
        name: 'Coffee',
        price: 4.99,
        quantity: 2,
        emoji: '☕'
      };
      
      const result = migrateOrderItem(oldItem, 'user123');
      
      expect(result).toBeTruthy();
      expect(result?.id).toBe('123');
      expect(result?.productId).toBe('123');
      expect(result?.name).toBe('Coffee');
      expect(result?.price).toBe(4.99);
      expect(result?.quantity).toBe(2);
      expect(result?.emoji).toBe('☕');
      expect(result?.modifications).toEqual([]);
      expect(result?.originalPrice).toBe(4.99);
      expect(result?.modificationPrice).toBe(0);
      expect(result?.totalPrice).toBe(9.98); // 4.99 * 2
      expect(result?.addedBy).toBe('user123');
    });
    
    it('should handle OrderItem with string ID', () => {
      const oldItem: OrderItem = {
        id: '456' as any, // String ID in old format
        name: 'Tea',
        price: 3.50,
        quantity: 1
      };
      
      const result = migrateOrderItem(oldItem);
      
      expect(result?.id).toBe('456');
      expect(result?.productId).toBe('456');
    });
    
    it('should handle missing or invalid ID', () => {
      const oldItem: any = {
        id: null,
        name: 'Muffin',
        price: 2.99,
        quantity: 1
      };
      
      const result = migrateOrderItem(oldItem);
      
      expect(result).toBeTruthy();
      expect(result?.id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/); // UUID format
    });
    
    it('should handle zero or negative quantity', () => {
      const oldItem: OrderItem = {
        id: 789,
        name: 'Sandwich',
        price: 7.99,
        quantity: 0
      };
      
      const result = migrateOrderItem(oldItem);
      
      expect(result?.quantity).toBe(1); // Minimum quantity of 1
      expect(result?.totalPrice).toBe(7.99); // Price for quantity 1
    });
    
    it('should return null for invalid items', () => {
      const invalidItems = [
        { id: 1, name: '', price: 5, quantity: 1 }, // Empty name
        { id: 2, name: 'Item', price: NaN, quantity: 1 }, // NaN price
        { id: 3, name: 'Item', price: 5, quantity: NaN }, // NaN quantity
        { id: 4, price: 5, quantity: 1 }, // Missing name
        null,
        undefined
      ];
      
      invalidItems.forEach(item => {
        const result = migrateOrderItem(item as any);
        expect(result).toBeNull();
      });
    });
  });
  
  describe('migrateCart', () => {
    it('should migrate an entire cart successfully', () => {
      const oldCart: OrderItem[] = [
        { id: 1, name: 'Coffee', price: 4.99, quantity: 2, emoji: '☕' },
        { id: 2, name: 'Muffin', price: 2.99, quantity: 1, emoji: '🧁' },
        { id: 3, name: 'Sandwich', price: 7.99, quantity: 1 }
      ];
      
      const result = migrateCart(oldCart, 'user123');
      
      expect(result.success).toBe(true);
      expect(result.migratedItems).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.totalItems).toBe(3);
      expect(result.stats.successfullyMigrated).toBe(3);
      expect(result.stats.failed).toBe(0);
      
      // Check first migrated item
      const firstItem = result.migratedItems[0];
      expect(firstItem.id).toBe('1');
      expect(firstItem.name).toBe('Coffee');
      expect(firstItem.totalPrice).toBe(9.98);
    });
    
    it('should handle partial migration with errors', () => {
      const mixedCart: any[] = [
        { id: 1, name: 'Valid Item', price: 5.99, quantity: 1 },
        { id: 2, name: '', price: 3.99, quantity: 1 }, // Invalid - empty name
        { id: 3, name: 'Another Valid', price: 2.99, quantity: 2 },
        { name: 'No ID', price: 1.99, quantity: 1 }, // Invalid - no ID
        { id: 5, name: 'Invalid Price', price: -5, quantity: 1 } // Invalid - negative price
      ];
      
      const result = migrateCart(mixedCart);
      
      expect(result.success).toBe(false);
      expect(result.migratedItems).toHaveLength(2); // Only valid items
      expect(result.errors).toHaveLength(3);
      expect(result.stats.successfullyMigrated).toBe(2);
      expect(result.stats.failed).toBe(3);
      expect(result.warnings).toContain('3 items failed to migrate and were excluded from the cart');
    });
    
    it('should warn about ID type conversions', () => {
      const cart: OrderItem[] = [
        { id: 123, name: 'Coffee', price: 4.99, quantity: 1 }
      ];
      
      const result = migrateCart(cart);
      
      expect(result.warnings).toContain('Item "Coffee" ID converted from number (123) to string ("123")');
    });
    
    it('should handle empty cart', () => {
      const result = migrateCart([]);
      
      expect(result.success).toBe(true);
      expect(result.migratedItems).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.totalItems).toBe(0);
    });
  });
  
  describe('validateUniqueIds', () => {
    it('should return true for unique IDs', () => {
      const items: EnhancedOrderItem[] = [
        { id: '1', name: 'Item 1' } as EnhancedOrderItem,
        { id: '2', name: 'Item 2' } as EnhancedOrderItem,
        { id: '3', name: 'Item 3' } as EnhancedOrderItem
      ];
      
      expect(validateUniqueIds(items)).toBe(true);
    });
    
    it('should return false for duplicate IDs', () => {
      const items: EnhancedOrderItem[] = [
        { id: '1', name: 'Item 1' } as EnhancedOrderItem,
        { id: '2', name: 'Item 2' } as EnhancedOrderItem,
        { id: '1', name: 'Item 3' } as EnhancedOrderItem // Duplicate ID
      ];
      
      expect(validateUniqueIds(items)).toBe(false);
    });
  });
  
  describe('recalculateItemPricing', () => {
    it('should calculate pricing without modifications', () => {
      const item: EnhancedOrderItem = {
        id: '1',
        productId: '1',
        name: 'Coffee',
        price: 4.99,
        quantity: 2,
        originalPrice: 4.99,
        modificationPrice: 0,
        totalPrice: 0, // Will be recalculated
        modifications: [],
        addedAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      
      const result = recalculateItemPricing(item);
      
      expect(result.modificationPrice).toBe(0);
      expect(result.totalPrice).toBe(9.98); // 4.99 * 2
    });
    
    it('should calculate pricing with modifications', () => {
      const item: EnhancedOrderItem = {
        id: '1',
        productId: '1',
        name: 'Coffee',
        price: 4.99,
        quantity: 2,
        originalPrice: 4.99,
        modificationPrice: 0,
        totalPrice: 0,
        modifications: [
          { id: 'm1', type: 'size', category: 'Size', name: 'Large', price: 0.50, selected: true },
          { id: 'm2', type: 'addition', category: 'Extras', name: 'Extra Shot', price: 0.75, selected: true, quantity: 2 },
          { id: 'm3', type: 'addition', category: 'Extras', name: 'Whipped Cream', price: 0.25, selected: false } // Not selected
        ],
        addedAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      
      const result = recalculateItemPricing(item);
      
      expect(result.modificationPrice).toBe(2.00); // 0.50 + (0.75 * 2) + 0 (not selected)
      expect(result.totalPrice).toBe(13.98); // (4.99 + 2.00) * 2
    });
    
    it('should handle edge cases in pricing', () => {
      const item: EnhancedOrderItem = {
        id: '1',
        productId: '1',
        name: 'Test Item',
        price: 0,
        quantity: 0, // Edge case
        originalPrice: 0,
        modificationPrice: 0,
        totalPrice: 0,
        modifications: [],
        addedAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      
      const result = recalculateItemPricing(item);
      
      expect(result.totalPrice).toBe(0);
      expect(result.lastModified).not.toBe(item.lastModified); // Should update timestamp
    });
  });
});