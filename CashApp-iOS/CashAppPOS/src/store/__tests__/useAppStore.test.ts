/**
 * Unit Tests for App Store (Zustand)
 * Testing state management, actions, and computed values
 */

import { renderHook, act } from '@testing-library/react-native';
import useAppStore from '../useAppStore';
import {
  createMockUser,
  createMockSession,
  createMockOrderItem,
} from '../../__tests__/utils/testUtils';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.logout();
      result.current.clearCart();
      result.current.setError(null);
      result.current.setLoading(false);
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.cart).toEqual([]);
      expect(result.current.currentOrder).toBeNull();
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('User Management', () => {
    it('should set user correctly', () => {
      const { result } = renderHook(() => useAppStore());
      const mockUser = createMockUser();

      act(() => {
        result.current.setUser(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
    });

    it('should clear user on logout', () => {
      const { result } = renderHook(() => useAppStore());
      const mockUser = createMockUser();
      const mockSession = createMockSession();
      const mockOrderItem = createMockOrderItem();

      // Set up state
      act(() => {
        result.current.setUser(mockUser);
        result.current.setSession(mockSession);
        result.current.addToCart(mockOrderItem);
      });

      // Logout should clear everything
      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.cart).toEqual([]);
      expect(result.current.currentOrder).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should set session correctly', () => {
      const { result } = renderHook(() => useAppStore());
      const mockSession = createMockSession();

      act(() => {
        result.current.setSession(mockSession);
      });

      expect(result.current.session).toEqual(mockSession);
    });

    it('should clear session', () => {
      const { result } = renderHook(() => useAppStore());
      const mockSession = createMockSession();

      act(() => {
        result.current.setSession(mockSession);
        result.current.setSession(null);
      });

      expect(result.current.session).toBeNull();
    });
  });

  describe('Cart Management', () => {
    it('should add item to empty cart', () => {
      const { result } = renderHook(() => useAppStore());
      const mockItem = createMockOrderItem();

      act(() => {
        result.current.addToCart(mockItem);
      });

      expect(result.current.cart).toHaveLength(1);
      expect(result.current.cart[0]).toEqual(mockItem);
    });

    it('should increase quantity when adding existing item', () => {
      const { result } = renderHook(() => useAppStore());
      const mockItem = createMockOrderItem({ id: 1, quantity: 1 });

      act(() => {
        result.current.addToCart(mockItem);
        result.current.addToCart(mockItem);
      });

      expect(result.current.cart).toHaveLength(1);
      expect(result.current.cart[0].quantity).toBe(2);
    });

    it('should add multiple different items', () => {
      const { result } = renderHook(() => useAppStore());
      const item1 = createMockOrderItem({ id: 1, name: 'Item 1' });
      const item2 = createMockOrderItem({ id: 2, name: 'Item 2' });

      act(() => {
        result.current.addToCart(item1);
        result.current.addToCart(item2);
      });

      expect(result.current.cart).toHaveLength(2);
      expect(result.current.cart[0].name).toBe('Item 1');
      expect(result.current.cart[1].name).toBe('Item 2');
    });

    it('should remove item from cart', () => {
      const { result } = renderHook(() => useAppStore());
      const mockItem = createMockOrderItem({ id: 1 });

      act(() => {
        result.current.addToCart(mockItem);
        result.current.removeFromCart(1);
      });

      expect(result.current.cart).toHaveLength(0);
    });

    it('should not remove non-existent item', () => {
      const { result } = renderHook(() => useAppStore());
      const mockItem = createMockOrderItem({ id: 1 });

      act(() => {
        result.current.addToCart(mockItem);
        result.current.removeFromCart(999); // Non-existent ID
      });

      expect(result.current.cart).toHaveLength(1);
    });

    it('should update cart item correctly', () => {
      const { result } = renderHook(() => useAppStore());
      const mockItem = createMockOrderItem({ id: 1, quantity: 1, notes: 'Original note' });

      act(() => {
        result.current.addToCart(mockItem);
        result.current.updateCartItem(1, { quantity: 3, notes: 'Updated note' });
      });

      expect(result.current.cart[0].quantity).toBe(3);
      expect(result.current.cart[0].notes).toBe('Updated note');
      expect(result.current.cart[0].name).toBe(mockItem.name); // Other properties unchanged
    });

    it('should clear entire cart', () => {
      const { result } = renderHook(() => useAppStore());
      const item1 = createMockOrderItem({ id: 1 });
      const item2 = createMockOrderItem({ id: 2 });

      act(() => {
        result.current.addToCart(item1);
        result.current.addToCart(item2);
        result.current.clearCart();
      });

      expect(result.current.cart).toHaveLength(0);
    });
  });

  describe('Computed Values', () => {
    it('should calculate cart total correctly', () => {
      const { result } = renderHook(() => useAppStore());
      const item1 = createMockOrderItem({ id: 1, price: 10.99, quantity: 2 });
      const item2 = createMockOrderItem({ id: 2, price: 5.49, quantity: 1 });

      act(() => {
        result.current.addToCart(item1);
        result.current.addToCart(item2);
      });

      const expectedTotal = 10.99 * 2 + 5.49 * 1; // 27.47
      expect(result.current.cartTotal()).toBeCloseTo(expectedTotal, 2);
    });

    it('should return 0 for empty cart total', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.cartTotal()).toBe(0);
    });

    it('should calculate cart item count correctly', () => {
      const { result } = renderHook(() => useAppStore());
      const item1 = createMockOrderItem({ id: 1, quantity: 2 });
      const item2 = createMockOrderItem({ id: 2, quantity: 3 });

      act(() => {
        result.current.addToCart(item1);
        result.current.addToCart(item2);
      });

      expect(result.current.cartItemCount()).toBe(5); // 2 + 3
    });

    it('should return 0 for empty cart item count', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.cartItemCount()).toBe(0);
    });
  });

  describe('App State Management', () => {
    it('should set online status', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setOnlineStatus(false);
      });

      expect(result.current.isOnline).toBe(false);

      act(() => {
        result.current.setOnlineStatus(true);
      });

      expect(result.current.isOnline).toBe(true);
    });

    it('should set loading state', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should set error state', () => {
      const { result } = renderHook(() => useAppStore());
      const errorMessage = 'Test error message';

      act(() => {
        result.current.setError(errorMessage);
      });

      expect(result.current.error).toBe(errorMessage);

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Order Management', () => {
    it('should set current order', () => {
      const { result } = renderHook(() => useAppStore());
      const mockOrder = {
        id: 1,
        items: [createMockOrderItem()],
        subtotal: 12.99,
        tax: 1.04,
        total: 14.03,
        createdAt: new Date(),
        status: 'draft' as const,
      };

      act(() => {
        result.current.setCurrentOrder(mockOrder);
      });

      expect(result.current.currentOrder).toEqual(mockOrder);
    });

    it('should clear current order', () => {
      const { result } = renderHook(() => useAppStore());
      const mockOrder = {
        id: 1,
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        createdAt: new Date(),
        status: 'draft' as const,
      };

      act(() => {
        result.current.setCurrentOrder(mockOrder);
        result.current.setCurrentOrder(null);
      });

      expect(result.current.currentOrder).toBeNull();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle rapid cart updates', () => {
      const { result } = renderHook(() => useAppStore());
      const item = createMockOrderItem({ id: 1, quantity: 1 });

      act(() => {
        // Rapid additions
        result.current.addToCart(item);
        result.current.addToCart(item);
        result.current.addToCart(item);

        // Update quantity
        result.current.updateCartItem(1, { quantity: 5 });

        // Remove and re-add
        result.current.removeFromCart(1);
        result.current.addToCart(item);
      });

      expect(result.current.cart).toHaveLength(1);
      expect(result.current.cart[0].quantity).toBe(1);
    });

    it('should maintain state consistency during logout', () => {
      const { result } = renderHook(() => useAppStore());
      const mockUser = createMockUser();
      const mockSession = createMockSession();
      const mockItem = createMockOrderItem();

      act(() => {
        // Set up complex state
        result.current.setUser(mockUser);
        result.current.setSession(mockSession);
        result.current.addToCart(mockItem);
        result.current.setError('Some error');
        result.current.setLoading(true);

        // Logout should clear user-specific data but preserve app state
        result.current.logout();
      });

      // User-specific data should be cleared
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.cart).toEqual([]);
      expect(result.current.currentOrder).toBeNull();

      // App state should be preserved
      expect(result.current.error).toBe('Some error');
      expect(result.current.isLoading).toBe(true);
    });
  });
});
