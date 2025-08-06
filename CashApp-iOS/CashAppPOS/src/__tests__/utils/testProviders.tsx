// @ts-nocheck
import React from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../design-system/ThemeProvider';
import type { RenderOptions } from '@testing-library/react-native';

// Mock theme for testing
const mockTheme = {
  colors: {
    primary: '#FF6B35',
    secondary: '#666',
    background: '#fff',
    surface: '#fff',
    text: '#000',
    textSecondary: '#666',
    border: '#E5E5E5',
    white: '#fff',
    black: '#000',
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
    danger: { 500: '#FF3B30' },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    }
  },
  spacing: {
    xs: 4,
    small: 8,
    medium: 16,
    large: 24,
    xl: 32,
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 12,
    xl: 16,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: 'bold' },
    h2: { fontSize: 24, fontWeight: 'bold' },
    h3: { fontSize: 20, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: 'normal' },
    caption: { fontSize: 14, fontWeight: 'normal' },
  },
};

export interface StoreOverrides {
  appState?: Record<string, unknown>;
  uiState?: Record<string, unknown>;
}

export const createTestWrapper = ({ appState = {}, uiState = {} }: StoreOverrides = {}) => {
  // Return a wrapper component for @testing-library/react-native
  return ({ children }: { children: React.ReactNode }) => (
    <SafeAreaProvider>
      <ThemeProvider theme={mockTheme}>
        <NavigationContainer>{children}</NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export const customRenderWithStores = (
  ui: React.ReactElement,
  { appState, uiState, ...options }: StoreOverrides & RenderOptions = {}
) => {
  const Wrapper = createTestWrapper({ appState, uiState });
  return render(ui, { wrapper: Wrapper, ...options });
};
