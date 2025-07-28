import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from './design-system/ThemeProvider';
import { AuthProvider } from './contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Custom render function that wraps components with necessary providers
export const renderWithProviders = (component: React.ReactElement, options = {}) => {
  return render(
    <SafeAreaProvider initialMetrics={{
      frame: { x: 0, y: 0, width: 375, height: 812 },
      insets: { top: 44, left: 0, right: 0, bottom: 34 },
    }}>
      <NavigationContainer>
        <ThemeProvider>
          <AuthProvider>
            {component}
          </AuthProvider>
        </ThemeProvider>
      </NavigationContainer>
    </SafeAreaProvider>,
    options
  );
};

// Re-export everything from React Native Testing Library
export * from '@testing-library/react-native';