/**
 * Test utilities for creating mock data
 */

import type { OrderItem } from '../../types';
import type { EnhancedOrderItem } from '../../types/cart';

export function createMockOrderItem(overrides?: Partial<OrderItem>): OrderItem {
  return {
    id: Math.floor(Math.random() * 10000),
    name: 'Test Item',
    price: 5.99,
    quantity: 1,
    emoji: '☕',
    ...overrides,
  };
}

export function createMockEnhancedOrderItem(overrides?: Partial<EnhancedOrderItem>): EnhancedOrderItem {
  const now = new Date().toISOString();
  return {
    id: `item-${Math.random().toString(36).substr(2, 9)}`,
    productId: '123',
    name: 'Test Item',
    price: 5.99,
    quantity: 1,
    emoji: '☕',
    modifications: [],
    originalPrice: 5.99,
    modificationPrice: 0,
    totalPrice: 5.99,
    addedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockUser() {
  return {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'cashier' as const,
  };
}

// Mock AsyncStorage data structure
export function createMockStorageData(cart: OrderItem[] = [], serviceCharge = 0, addTransactionFee = false) {
  return {
    state: {
      cart,
      serviceChargePercentage: serviceCharge,
      addTransactionFee,
      user: null,
      session: null,
    },
    version: 0,
  };
}