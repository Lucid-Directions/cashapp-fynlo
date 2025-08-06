/**
 * Centralized mock helpers for Fynlo POS tests
 * Provides consistent mocking across all test files
 */

import { jest } from '@jest/globals';

// Enhanced store mocks with all required methods
export const createMockAppStore = (overrides = {}) => ({
  // Cart state
  cart: [],
  cartTotal: 0,
  cartItemCount: 0,
  
  // Cart actions
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  updateCartItem: jest.fn(),
  clearCart: jest.fn(),
  cleanCart: jest.fn(),
  
  // Menu state
  menuItems: [],
  setMenuItems: jest.fn(),
  
  // Loading/Error state
  isLoading: false,
  setIsLoading: jest.fn(),
  setLoading: jest.fn(),
  error: null,
  setError: jest.fn(),
  
  // Order state
  orders: [],
  setOrders: jest.fn(),
  currentOrder: null,
  setCurrentOrder: jest.fn(),
  
  // User/Auth state
  user: null,
  session: null,
  setUser: jest.fn(),
  logout: jest.fn(),
  setSession: jest.fn(),
  
  // Service charges and fees
  serviceChargePercentage: 10,
  addTransactionFee: false,
  serviceChargeIncluded: false,
  transactionFeeIncluded: false,
  calculateServiceCharge: jest.fn(() => 0),
  calculateTransactionFee: jest.fn(() => 0),
  enableServiceCharge: jest.fn(),
  enableTransactionFee: jest.fn(),
  
  // Network state
  isOnline: true,
  setOnlineStatus: jest.fn(),
  
  ...overrides,
});

export const createMockUIStore = (overrides = {}) => ({
  selectedCategory: 'All',
  setSelectedCategory: jest.fn(),
  showPaymentModal: false,
  setShowPaymentModal: jest.fn(),
  showOfflineIndicator: false,
  setShowOfflineIndicator: jest.fn(),
  theme: 'light',
  setTheme: jest.fn(),
  toggleTheme: jest.fn(),
  isLoading: false,
  setIsLoading: jest.fn(),
  error: null,
  setError: jest.fn(),
  ...overrides,
});

export const createMockSettingsStore = (overrides = {}) => ({
  taxConfiguration: {
    rate: 0,
    enabled: false,
  },
  serviceChargeConfig: {
    rate: 15,
    enabled: true,
  },
  settings: {},
  updateSettings: jest.fn(),
  getSettings: jest.fn(() => ({})),
  ...overrides,
});

export const createMockAuthStore = (overrides = {}) => ({
  isAuthenticated: true,
  user: { id: '1', email: 'test@test.com', role: 'employee' },
  login: jest.fn(),
  logout: jest.fn(),
  isLoading: false,
  setLoading: jest.fn(),
  checkAuth: jest.fn(),
  error: null,
  setError: jest.fn(),
  ...overrides,
});

// Enhanced service mocks
export const createMockDataService = (overrides = {}) => ({
  login: jest.fn(() => Promise.resolve(true)),
  getProducts: jest.fn(() => Promise.resolve([])),
  processPayment: jest.fn(() => Promise.resolve(true)),
  createOrder: jest.fn(() => Promise.resolve({ id: '1', status: 'success' })),
  ...overrides,
});

export const createMockWebSocketService = (overrides = {}) => ({
  connect: jest.fn(() => Promise.resolve()),
  disconnect: jest.fn(),
  sendMessage: jest.fn(),
  onMessage: jest.fn(),
  isConnected: jest.fn(() => true),
  ...overrides,
});

// Performance utilities mock
export const createMockPerformanceUtils = (overrides = {}) => ({
  debounce: jest.fn((fn, delay) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }),
  throttle: jest.fn((fn, delay) => {
    let lastCall = 0;
    return (...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return fn(...args);
      }
    };
  }),
  measureAsyncOperation: jest.fn(async (operation) => {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    return {
      result,
      duration: end - start,
    };
  }),
  ...overrides,
});

// Data prefetcher mock
export const createMockDataPrefetcher = (overrides = {}) => ({
  addToPrefetchQueue: jest.fn(),
  prefetchImmediate: jest.fn(() => Promise.resolve({})),
  startPrefetching: jest.fn(() => Promise.resolve()),
  clearQueue: jest.fn(),
  ...overrides,
});

// Enhanced testing utilities
export const createMockTestingUtils = (overrides = {}) => ({
  performance: createMockPerformanceUtils(),
  dataPrefetcher: createMockDataPrefetcher(),
  mockAsyncOperation: jest.fn((operation, duration = 100) => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(operation());
      }, duration);
    });
  }),
  ...overrides,
});

// Mock fetch with proper error handling
export const createMockFetch = (responses = {}, defaultResponse = { ok: true, json: () => Promise.resolve({}) }) => {
  return jest.fn((url: string, options?: RequestInit) => {
    const method = options?.method || 'GET';
    const key = `${method} ${url}`;
    
    if (responses[key]) {
      if (responses[key] instanceof Error) {
        return Promise.reject(responses[key]);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(responses[key]),
        ...responses[key],
      });
    }
    
    return Promise.resolve(defaultResponse);
  });
};

// Common test data generators
export const createTestMenuItem = (overrides = {}) => ({
  id: '1',
  name: 'Test Item',
  price: 10.99,
  category: 'food',
  emoji: '🍔',
  available: true,
  description: 'Test description',
  modifications: [],
  ...overrides,
});

export const createTestOrderItem = (overrides = {}) => ({
  id: '1',
  name: 'Test Item',
  price: 10.99,
  quantity: 1,
  category: 'food',
  emoji: '🍔',
  available: true,
  description: 'Test description',
  modifications: [],
  ...overrides,
});

export const createTestUser = (overrides = {}) => ({
  id: '1',
  email: 'test@example.com',
  role: 'employee',
  restaurant_id: 'rest_1',
  ...overrides,
});

// Async test helpers
export const waitForCondition = async (condition: () => boolean, timeout = 5000) => {
  const start = Date.now();
  while (!condition() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  if (!condition()) {
    throw new Error(`Condition not met within ${timeout}ms`);
  }
};

export const mockTimers = () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
};

// Mock component factory
export const createMockComponent = (name: string, testID?: string) => {
  return jest.fn((props: any) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    
    return React.createElement(
      View,
      { testID: testID || `mock-${name}`, ...props },
      React.createElement(Text, {}, `Mock ${name}`)
    );
  });
};
