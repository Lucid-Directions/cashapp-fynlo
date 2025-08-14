/**
 * Cart Persistence Tests
 * Verify that cart data persists across app restarts using AsyncStorage
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useCartStore, isEnhancedCartEnabled } from '../cartStoreAdapter';
import useEnhancedCartStore from '../useEnhancedCartStore';
import { createMockOrderItem } from '../../__tests__/utils/testUtils';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('Cart Persistence', () => {
  beforeEach(async () => {
    // Clear AsyncStorage before each test
    await AsyncStorage.clear();
    
    // Reset store state
    const { result } = renderHook(() => useEnhancedCartStore());
    act(() => {
      result.current.clearCart();
      result.current.logout();
    });
  });

  describe('Enhanced Cart Store Persistence', () => {
    it('should persist cart to AsyncStorage when items are added', async () => {
      const { result } = renderHook(() => useEnhancedCartStore());
      const mockItem = createMockOrderItem();

      // Add item to cart
      act(() => {
        result.current.addToCart(mockItem);
      });

      // Wait for AsyncStorage to be updated
      await waitFor(async () => {
        const storedData = await AsyncStorage.getItem('enhanced-cart-storage');
        expect(storedData).toBeTruthy();
        
        const parsedData = JSON.parse(storedData!);
        expect(parsedData.state.cart).toHaveLength(1);
        expect(parsedData.state.cart[0].name).toBe(mockItem.name);
      });
    });

    it('should restore cart from AsyncStorage on initialization', async () => {
      const mockItem = createMockOrderItem();
      
      // Manually set data in AsyncStorage
      const storageData = {
        state: {
          cart: [{
            id: mockItem.id.toString(),
            productId: mockItem.id.toString(),
            name: mockItem.name,
            price: mockItem.price,
            quantity: mockItem.quantity,
            emoji: mockItem.emoji,
            modifications: [],
            originalPrice: mockItem.price,
            modificationPrice: 0,
            totalPrice: mockItem.price * mockItem.quantity,
            addedAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          }],
          serviceChargePercentage: 10,
          addTransactionFee: false,
          templates: [],
          recentTemplates: [],
        },
        version: 0,
      };
      
      await AsyncStorage.setItem('enhanced-cart-storage', JSON.stringify(storageData));

      // Create new store instance (simulates app restart)
      const { result } = renderHook(() => useEnhancedCartStore());

      // Wait for rehydration
      await waitFor(() => {
        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].name).toBe(mockItem.name);
      });
    });

    it('should clear cart from AsyncStorage on logout', async () => {
      const { result } = renderHook(() => useEnhancedCartStore());
      const mockItem = createMockOrderItem();

      // Add item and verify it's stored
      act(() => {
        result.current.addToCart(mockItem);
      });

      await waitFor(async () => {
        const storedData = await AsyncStorage.getItem('enhanced-cart-storage');
        const parsedData = JSON.parse(storedData!);
        expect(parsedData.state.cart).toHaveLength(1);
      });

      // Logout should clear cart
      act(() => {
        result.current.logout();
      });

      await waitFor(async () => {
        const storedData = await AsyncStorage.getItem('enhanced-cart-storage');
        const parsedData = JSON.parse(storedData!);
        expect(parsedData.state.cart).toHaveLength(0);
      });
    });

    it('should handle corrupted cart data gracefully', async () => {
      // Set corrupted data in AsyncStorage
      const corruptedData = {
        state: {
          cart: [
            { id: 1, name: 'Valid Item', price: 10, quantity: 1 },
            { id: null, name: null, price: 'invalid', quantity: -1 }, // Corrupted item
            { id: 3, name: 'Another Valid', price: 15, quantity: 2 },
          ],
        },
        version: 0,
      };
      
      await AsyncStorage.setItem('enhanced-cart-storage', JSON.stringify(corruptedData));

      // Create store and trigger migration
      const { result } = renderHook(() => useEnhancedCartStore());
      
      act(() => {
        result.current.migrateCartIfNeeded();
      });

      // Should migrate valid items and ignore corrupted ones
      await waitFor(() => {
        expect(result.current.cart).toHaveLength(2);
        expect(result.current.cart[0].name).toBe('Valid Item');
        expect(result.current.cart[1].name).toBe('Another Valid');
      });
    });

    it('should preserve cart templates across sessions', async () => {
      const { result } = renderHook(() => useEnhancedCartStore());
      const mockItem1 = createMockOrderItem();
      const mockItem2 = createMockOrderItem({ id: 2, name: 'Item 2' });

      // Add items and save as template
      act(() => {
        result.current.addToCart(mockItem1);
        result.current.addToCart(mockItem2);
        result.current.saveCartAsTemplate(
          'Lunch Special',
          'Popular lunch combination',
          ['lunch', 'special']
        );
      });

      // Wait for AsyncStorage update
      await waitFor(async () => {
        const storedData = await AsyncStorage.getItem('enhanced-cart-storage');
        const parsedData = JSON.parse(storedData!);
        expect(parsedData.state.templates).toHaveLength(1);
        expect(parsedData.state.templates[0].name).toBe('Lunch Special');
      });

      // Clear cart but keep templates
      act(() => {
        result.current.clearCart();
      });

      // Simulate app restart
      const { result: newResult } = renderHook(() => useEnhancedCartStore());

      // Templates should still be available
      await waitFor(() => {
        expect(newResult.current.templates).toHaveLength(1);
        expect(newResult.current.templates[0].name).toBe('Lunch Special');
        expect(newResult.current.cart).toHaveLength(0);
      });

      // Load template
      act(() => {
        newResult.current.loadTemplate(newResult.current.templates[0].id);
      });

      // Cart should be populated from template
      expect(newResult.current.cart).toHaveLength(2);
    });
  });

  describe('Cart Store Adapter', () => {
    it('should use enhanced store when feature flag is enabled', () => {
      expect(isEnhancedCartEnabled()).toBe(true);
      
      const { result } = renderHook(() => useCartStore(true));
      
      // Should have enhanced store methods
      expect(result.current.modifyCartItem).toBeDefined();
      expect(result.current.saveCartAsTemplate).toBeDefined();
      expect(result.current.initializeSplitBill).toBeDefined();
    });

    it('should provide backward compatibility for old cart format', () => {
      const { result } = renderHook(() => useCartStore(true));
      const mockItem = createMockOrderItem();

      // Add item using old format
      act(() => {
        result.current.addToCart(mockItem);
      });

      // Should convert to enhanced format internally
      expect(result.current.cart).toHaveLength(1);
      expect(result.current.cart[0].id).toBe(mockItem.id.toString());
      expect(result.current.cart[0].modifications).toEqual([]);
      expect(result.current.cart[0].totalPrice).toBe(mockItem.price * mockItem.quantity);
    });

    it('should handle numeric and string IDs correctly', () => {
      const { result } = renderHook(() => useCartStore(true));
      const numericIdItem = createMockOrderItem({ id: 123 });
      const stringIdItem = createMockOrderItem({ id: 'abc-456' as any });

      act(() => {
        result.current.addToCart(numericIdItem);
        result.current.addToCart(stringIdItem);
      });

      // Both should be added successfully
      expect(result.current.cart).toHaveLength(2);
      
      // Remove by numeric ID
      act(() => {
        result.current.removeFromCart(123);
      });
      
      expect(result.current.cart).toHaveLength(1);
      expect(result.current.cart[0].id).toBe('abc-456');
    });
  });

  describe('Cart History and Undo/Redo', () => {
    it('should track cart history for undo functionality', () => {
      const { result } = renderHook(() => useEnhancedCartStore());
      const item1 = createMockOrderItem({ id: 1, name: 'Item 1' });
      const item2 = createMockOrderItem({ id: 2, name: 'Item 2' });

      // Add first item
      act(() => {
        result.current.addToCart(item1);
      });
      
      expect(result.current.cart).toHaveLength(1);
      expect(result.current.cartHistory).toHaveLength(1);

      // Add second item
      act(() => {
        result.current.addToCart(item2);
      });
      
      expect(result.current.cart).toHaveLength(2);
      expect(result.current.cartHistory).toHaveLength(2);

      // Undo last action
      act(() => {
        result.current.undoCartAction();
      });
      
      expect(result.current.cart).toHaveLength(1);
      expect(result.current.cart[0].name).toBe('Item 1');

      // Redo
      act(() => {
        result.current.redoCartAction();
      });
      
      expect(result.current.cart).toHaveLength(2);
    });

    it('should limit history size to prevent memory issues', () => {
      const { result } = renderHook(() => useEnhancedCartStore());
      const maxHistorySize = result.current.maxHistorySize;

      // Add more items than history limit
      for (let i = 0; i < maxHistorySize + 5; i++) {
        act(() => {
          result.current.addToCart(createMockOrderItem({ id: i, name: `Item ${i}` }));
        });
      }

      // History should be limited to maxHistorySize
      expect(result.current.cartHistory.length).toBeLessThanOrEqual(maxHistorySize);
    });
  });
});