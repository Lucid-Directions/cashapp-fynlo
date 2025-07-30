// @ts-nocheck
/**
 * Test Utilities for Fynlo POS
 * Provides common testing helpers, wrappers, and utilities
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: unknown;
  navigationProps?: unknown;
}

const AllTheProviders = ({ children, navigationProps = {} }: unknown) => {
  return (
    <SafeAreaProvider>
      <NavigationContainer {...navigationProps}>{children}</NavigationContainer>
    </SafeAreaProvider>
  );
};

const customRender = (ui: ReactElement, options: CustomRenderOptions = {}) => {
  const { navigationProps, ...renderOptions } = options;

  return render(_ui, {
    wrapper: props => <AllTheProviders {...props} navigationProps={navigationProps} />,
    ...renderOptions,
  });
};

// Make available to test suites
export { customRender };

// Mock data generators
export const createMockMenuItem = (overrides = {}) => ({
  id: 1,
  name: 'Test Item',
  price: 12.99,
  category: 'Main',
  emoji: '🍔',
  available: true,
  ...overrides,
});

export const createMockOrderItem = (overrides = {}) => ({
  id: 1,
  name: 'Test Item',
  price: 12.99,
  quantity: 1,
  emoji: '🍔',
  ...overrides,
});

export const createMockOrder = (overrides = {}) => ({
  id: 1,
  items: [createMockOrderItem()],
  subtotal: 12.99,
  tax: 1.04,
  total: 14.03,
  createdAt: new Date(),
  status: 'draft' as const,
  ...overrides,
});

export const createMockUser = (overrides = {}) => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'cashier' as const,
  isActive: true,
  ...overrides,
});

export const createMockSession = (overrides = {}) => ({
  id: 1,
  userId: 1,
  userName: 'Test User',
  startTime: new Date(),
  isActive: true,
  startingCash: 100,
  totalSales: 0,
  ordersCount: 0,
  ...overrides,
});

// Wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(_resolve, ms));

// Mock navigation helpers
export const createMockNavigation = (overrides = {}) => ({
  navigate: jest.fn(),
  dispatch: jest.fn(),
  goBack: jest.fn(),
  setParams: jest.fn(),
  reset: jest.fn(),
  canGoBack: jest.fn(() => false),
  getId: jest.fn(),
  getState: jest.fn(),
  getParent: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  isFocused: jest.fn(() => true),
  ...overrides,
});

export const createMockRoute = (overrides = {}) => ({
  key: 'test-key',
  name: 'TestScreen',
  params: {},
  ...overrides,
});

// Test assertion helpers
export const expectToBeVisible = (element: unknown) => {
  expect(_element).toBeTruthy();
  expect(element.props.style).not.toContainEqual({ display: 'none' });
};

export const expectToBeHidden = (element: unknown) => {
  expect(_element).toBeFalsy();
};

// Mock store creators
export const createMockAppStore = (initialState = {}) => {
  const defaultState = {
    user: null,
    session: null,
    cart: [],
    currentOrder: null,
    isOnline: true,
    isLoading: false,
    error: null,
  };

  const state = { ...defaultState, ...initialState };

  return {
    ...state,
    setUser: jest.fn(),
    logout: jest.fn(),
    setSession: jest.fn(),
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateCartItem: jest.fn(),
    clearCart: jest.fn(),
    setCurrentOrder: jest.fn(),
    setOnlineStatus: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    cartTotal: jest.fn(() =>
      state.cart.reduce((total: number, item: unknown) => total + item.price * item.quantity, 0),
    ),
    cartItemCount: jest.fn(() =>
      state.cart.reduce((count: number, item: unknown) => count + item.quantity, 0),
    ),
  };
};

export const createMockUIStore = (initialState = {}) => {
  const defaultState = {
    selectedCategory: 'All',
    showPaymentModal: false,
    showOfflineIndicator: false,
    theme: 'light',
  };

  const state = { ...defaultState, ...initialState };

  return {
    ...state,
    setSelectedCategory: jest.fn(),
    setShowPaymentModal: jest.fn(),
    setShowOfflineIndicator: jest.fn(),
    setTheme: jest.fn(),
    toggleTheme: jest.fn(),
  };
};

// API response helpers
export const createMockApiResponse = (data: unknown, success = true) => ({
  success,
  data: success ? data : undefined,
  error: success ? undefined : 'Mock error',
});

export const createMockApiError = (message = 'Mock API error') => ({
  success: false,
  error: message,
});

// Form testing helpers
export const fillInput = async (getByTestId: unknown, testId: string, value: string) => {
  const input = getByTestId(_testId);
  fireEvent.changeText(_input, value);
  return input;
};

export const pressButton = async (getByTestId: unknown, testId: string) => {
  const button = getByTestId(_testId);
  fireEvent.press(_button);
  return button;
};

// Mock fetch for API testing
export const createMockFetch = (responses: unknown[] = []) => {
  let callCount = 0;

  return jest.fn(() => {
    const response = responses[callCount] || { ok: true, json: () => Promise.resolve({}) };
    callCount++;

    return Promise.resolve({
      ok: response.ok !== false,
      status: response.status || 200,
      json: () => Promise.resolve(response.data || response),
      text: () => Promise.resolve(JSON.stringify(response.data || response)),
    });
  });
};

// Export everything including the custom render
export * from '@testing-library/react-native';

export { customRenderWithStores } from './testProviders';
