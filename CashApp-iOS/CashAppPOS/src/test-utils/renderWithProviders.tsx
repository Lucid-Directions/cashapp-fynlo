import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '../design-system/ThemeProvider';
import { AuthProvider } from '../contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider } from '../contexts/DataContext';
import { OrderProvider } from '../contexts/OrderContext';
import { PaymentProvider } from '../contexts/PaymentContext';

// Create mock providers
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  canGoBack: jest.fn(() => false),
  isFocused: jest.fn(() => true),
  reset: jest.fn(),
  setParams: jest.fn(),
};

const mockRoute = {
  params: {},
  name: 'TestScreen',
  key: 'test-key',
};

const mockAuth = {
  isAuthenticated: true,
  user: { 
    id: '1', 
    email: 'test@test.com',
    role: 'manager',
    restaurantId: 'test-restaurant'
  },
  login: jest.fn(() => Promise.resolve()),
  logout: jest.fn(() => Promise.resolve()),
  isLoading: false,
  token: 'test-token',
};

const mockData = {
  menuItems: [],
  categories: [],
  orders: [],
  tables: [],
  employees: [],
  isLoading: false,
  error: null,
  fetchMenuItems: jest.fn(() => Promise.resolve()),
  fetchOrders: jest.fn(() => Promise.resolve()),
  refreshData: jest.fn(() => Promise.resolve()),
};

const mockOrder = {
  currentOrder: null,
  orderItems: [],
  addItem: jest.fn(),
  removeItem: jest.fn(),
  updateQuantity: jest.fn(),
  clearOrder: jest.fn(),
  submitOrder: jest.fn(() => Promise.resolve()),
  totalAmount: 0,
  itemCount: 0,
};

const mockPayment = {
  processPayment: jest.fn(() => Promise.resolve({ success: true })),
  refundPayment: jest.fn(() => Promise.resolve({ success: true })),
  isProcessing: false,
  lastTransaction: null,
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialAuth?: any;
  initialData?: any;
  initialOrder?: any;
  initialPayment?: any;
  navigation?: any;
  route?: any;
}

const AllTheProviders = ({ children, auth, data, order, payment }: any) => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <ThemeProvider>
          <AuthProvider value={auth}>
            <DataProvider value={data}>
              <OrderProvider value={order}>
                <PaymentProvider value={payment}>
                  {children}
                </PaymentProvider>
              </OrderProvider>
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export function renderWithProviders(
  ui: React.ReactElement,
  options?: CustomRenderOptions
) {
  const auth = { ...mockAuth, ...options?.initialAuth };
  const data = { ...mockData, ...options?.initialData };
  const order = { ...mockOrder, ...options?.initialOrder };
  const payment = { ...mockPayment, ...options?.initialPayment };
  const navigation = options?.navigation || mockNavigation;
  const route = options?.route || mockRoute;

  // Clone element with navigation props
  const uiWithProps = React.cloneElement(ui, { navigation, route });

  return render(uiWithProps, {
    wrapper: ({ children }) => (
      <AllTheProviders auth={auth} data={data} order={order} payment={payment}>
        {children}
      </AllTheProviders>
    ),
    ...options,
  });
}

// Re-export everything from React Native Testing Library
export * from '@testing-library/react-native';
export { mockNavigation, mockRoute, mockAuth, mockData, mockOrder, mockPayment };
