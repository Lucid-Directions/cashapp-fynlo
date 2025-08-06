import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '../../design-system/ThemeProvider';
import { AuthProvider } from '../../contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
};

// Mock route
const mockRoute = {
  params: {},
  name: 'TestScreen',
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialAuth?: any;
  initialRoute?: any;
  navigation?: any;
}

const AllTheProviders = ({ children, auth, navigation, route }: any) => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <ThemeProvider>
          <AuthProvider value={auth}>
            {React.cloneElement(children, { navigation, route })}
          </AuthProvider>
        </ThemeProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export function renderWithAllProviders(
  ui: React.ReactElement,
  options?: CustomRenderOptions
) {
  const auth = options?.initialAuth || {
    isAuthenticated: true,
    user: { id: '1', email: 'test@test.com' },
    login: jest.fn(),
    logout: jest.fn(),
    isLoading: false,
  };

  const navigation = options?.navigation || mockNavigation;
  const route = options?.initialRoute || mockRoute;

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders auth={auth} navigation={navigation} route={route}>
        {children}
      </AllTheProviders>
    ),
    ...options,
  });
}

export * from '@testing-library/react-native';
export { mockNavigation, mockRoute };
