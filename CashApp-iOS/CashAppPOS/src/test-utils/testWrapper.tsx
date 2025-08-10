/**
 * Comprehensive Test Wrapper for Fynlo POS
 * Provides all necessary providers for testing React components
 */

import { NavigationContainer } from '@react-navigation/native';
import type { RenderOptions } from '@testing-library/react-native';
import { render } from '@testing-library/react-native';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../design-system/ThemeProvider';

// Mock navigation helpers
export const createMockNavigation = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  setParams: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  pop: jest.fn(),
  popToTop: jest.fn(),
  canGoBack: jest.fn(() => false),
  isFocused: jest.fn(() => true),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeListener: jest.fn(),
});

export const createMockRoute = (params = {}) => ({
  key: 'test-route',
  name: 'TestScreen',
  params,
});

// Mock theme for testing
const mockTheme = {
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#F2F2F7',
    surface: '#FFFFFF',
    text: '#000000',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    border: '#C6C6C8',
    disabled: '#8E8E93',
    placeholder: '#8E8E93',
    accent: '#007AFF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: 'bold' as const },
    h2: { fontSize: 24, fontWeight: 'bold' as const },
    h3: { fontSize: 20, fontWeight: '600' as const },
    body: { fontSize: 16, fontWeight: 'normal' as const },
    caption: { fontSize: 14, fontWeight: 'normal' as const },
  },
  isDark: false,
};

interface TestWrapperOptions extends Omit<RenderOptions, 'wrapper'> {
  mockNavigation?: any;
  mockRoute?: any;
  initialAuth?: any;
  disableNavigation?: boolean;
}

const TestWrapper = ({
  children,
  mockNavigation = createMockNavigation(),
  mockRoute = createMockRoute(),
  disableNavigation = false,
}: {
  children: React.ReactNode;
  mockNavigation?: any;
  mockRoute?: any;
  disableNavigation?: boolean;
}) => {
  const wrappedChildren = React.isValidElement(children)
    ? React.cloneElement(children, { navigation: mockNavigation, route: mockRoute })
    : children;

  if (disableNavigation) {
    return (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 375, height: 812 },
          insets: { top: 44, left: 0, right: 0, bottom: 34 },
        }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <PaperProvider>
            <ThemeProvider>
              <AuthProvider>{wrappedChildren}</AuthProvider>
            </ThemeProvider>
          </PaperProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 44, left: 0, right: 0, bottom: 34 },
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PaperProvider>
          <ThemeProvider>
            <AuthProvider>
              <NavigationContainer>{wrappedChildren}</NavigationContainer>
            </AuthProvider>
          </ThemeProvider>
        </PaperProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

/**
 * Comprehensive render function with all providers
 */
export const renderWithAllProviders = (
  ui: React.ReactElement,
  options: TestWrapperOptions = {}
) => {
  const { mockNavigation, mockRoute, disableNavigation = false, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <TestWrapper
        mockNavigation={mockNavigation}
        mockRoute={mockRoute}
        disableNavigation={disableNavigation}
      >
        {children}
      </TestWrapper>
    ),
    ...renderOptions,
  });
};

/**
 * Simplified render function (backward compatibility)
 */
export const renderWithProviders = renderWithAllProviders;

// Re-export testing utilities
export * from '@testing-library/react-native';
export { mockTheme };
