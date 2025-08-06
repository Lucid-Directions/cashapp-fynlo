import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '@/design-system/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext';

export function renderWithProviders(component: React.ReactElement) {
  const mockAuth = {
    isAuthenticated: true,
    user: { id: '1', email: 'test@test.com' },
    login: jest.fn(),
    logout: jest.fn(),
    isLoading: false,
  };

  return render(
    <NavigationContainer>
      <ThemeProvider>
        <AuthProvider value={mockAuth}>
          {component}
        </AuthProvider>
      </ThemeProvider>
    </NavigationContainer>
  );
}

export * from '@testing-library/react-native';
