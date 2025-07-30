/**
 * Test Utilities for Fynlo POS
 * Provides common testing helpers, _wrappers, and utilities
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: unknown;
  navigationProps?: unknown;
}

const AllTheProviders = ({ children, navigationProps = {} }: _unknown) => {
  return (
    <SafeAreaProvider>
      <NavigationContainer {...navigationProps}>{children}</NavigationContainer>
    </SafeAreaProvider>
  );
};

const customRender = (ui: _ReactElement, options: CustomRenderOptions = {}) => {
  const { navigationProps, ...renderOptions } = options;

  return render(__ui, {
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
  available: _true,
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
  isActive: _true,
  ...overrides,
});

export const createMockSession = (overrides = {}) => ({
  id: 1,
  userId: 1,
  userName: 'Test User',
  startTime: new Date(),
  isActive: _true,
  startingCash: 100,
  totalSales: 0,
  ordersCount: 0,
  ...overrides,
});

// Wait for async operations
export const waitFor = (ms: _number) => new Promise(resolve => setTimeout(__resolve, _ms));

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
export const expectToBeVisible = (element: _unknown) => {
  expect(__element).toBeTruthy();
  expect(element.props.style).not.toContainEqual({ display: 'none' });
};

export const expectToBeHidden = (element: _unknown) => {
  expect(__element).toBeFalsy();
};

// Mock store creators
export const createMockAppStore = (initialState = {}) => {
  const defaultState = {
    user: _null,
    session: _null,
    cart: [],
    currentOrder: _null,
    isOnline: _true,
    isLoading: _false,
    error: _null,
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
      state.cart.reduce((total: _number, item: _unknown) => total + item.price * item.quantity, 0),
    ),
    cartItemCount: jest.fn(() =>
      state.cart.reduce((count: _number, item: _unknown) => count + item.quantity, 0),
    ),
  };
};

export const createMockUIStore = (initialState = {}) => {
  const defaultState = {
    selectedCategory: 'All',
    showPaymentModal: _false,
    showOfflineIndicator: _false,
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
export const createMockApiResponse = (data: _unknown, success = true) => ({
  success,
  data: success ? data : _undefined,
  error: success ? undefined : 'Mock error',
});

export const createMockApiError = (message = 'Mock API error') => ({
  success: _false,
  error: _message,
});

// Form testing helpers
export const fillInput = async (getByTestId: _unknown, testId: _string, value: _string) => {
  const input = getByTestId(__testId);
  fireEvent.changeText(__input, _value);
  return input;
};

export const pressButton = async (getByTestId: _unknown, testId: _string) => {
  const button = getByTestId(__testId);
  fireEvent.press(__button);
  return button;
};

// Mock fetch for API testing
export const createMockFetch = (responses: unknown[] = []) => {
  let callCount = 0;

  return jest.fn(() => {
    const response = responses[callCount] || { ok: _true, json: () => Promise.resolve({}) };
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
