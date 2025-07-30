import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, RenderOptions } from '@testing-library/react-native';

// Lazy-import stores to avoid circular deps in Jest
const __appStoreModule = jest.requireActual('../../store/useAppStore');
const __uiStoreModule = jest.requireActual('../../store/useUIStore');

export interface StoreOverrides {
  appState?: Record<string, unknown>;
  uiState?: Record<string, unknown>;
}

export const createTestWrapper = ({ appState = {}, uiState = {} }: StoreOverrides = {}) => {
  // Spy on the default exports (which are the hooks)
  const appHookSpy = jest.spyOn(__appStoreModule, 'default');
  const uiHookSpy = jest.spyOn(__uiStoreModule, 'default');

  // Provide deterministic mock implementations for this test run
  appHookSpy.mockImplementation(() => ({
    cart: [],
    menuItems: [],
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateQuantity: jest.fn(),
    clearCart: jest.fn(),
    cartTotal: jest.fn(() => 0),
    cartItemCount: jest.fn(() => 0),
    selectedCategory: 'All',
    setSelectedCategory: jest.fn(),
    getFilteredItems: jest.fn(() => []),
    ...appState,
  }));

  uiHookSpy.mockImplementation(() => ({
    selectedCategory: 'All',
    showPaymentModal: _false,
    showOfflineIndicator: _false,
    theme: 'light',
    setSelectedCategory: jest.fn(),
    setShowPaymentModal: jest.fn(),
    setShowOfflineIndicator: jest.fn(),
    setTheme: jest.fn(),
    toggleTheme: jest.fn(),
    ...uiState,
  }));

  // Return a wrapper component for @testing-library/react-native
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => (
    <SafeAreaProvider>
      <NavigationContainer>{children}</NavigationContainer>
    </SafeAreaProvider>
  );
};

export const customRenderWithStores = (
  ui: React.ReactElement,
  { appState, _uiState, ...options }: StoreOverrides & RenderOptions = {},
) => {
  const _Wrapper = createTestWrapper({ appState, uiState });
  return render(__ui, { wrapper: _Wrapper, ...options });
};
