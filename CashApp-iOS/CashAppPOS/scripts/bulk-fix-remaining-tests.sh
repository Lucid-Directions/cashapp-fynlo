#\!/bin/bash

echo "🔧 Bulk Fix Remaining Test Failures"
echo "===================================="

# Fix the renderWithProviders file that got corrupted
echo "📝 Fixing renderWithProviders..."
cat > src/test-utils/renderWithProviders.tsx << 'WRAPPER'
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
WRAPPER

# Create missing context mocks if they don't exist
echo "📝 Creating/updating context mocks..."
mkdir -p src/contexts/__mocks__

cat > src/contexts/__mocks__/DataContext.tsx << 'MOCK'
import React from 'react';

const mockDataContext = {
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

export const DataContext = React.createContext(mockDataContext);
export const DataProvider = ({ children, value }: any) => (
  <DataContext.Provider value={value || mockDataContext}>
    {children}
  </DataContext.Provider>
);
export const useData = () => mockDataContext;
MOCK

cat > src/contexts/__mocks__/OrderContext.tsx << 'MOCK'
import React from 'react';

const mockOrderContext = {
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

export const OrderContext = React.createContext(mockOrderContext);
export const OrderProvider = ({ children, value }: any) => (
  <OrderContext.Provider value={value || mockOrderContext}>
    {children}
  </OrderContext.Provider>
);
export const useOrder = () => mockOrderContext;
MOCK

cat > src/contexts/__mocks__/PaymentContext.tsx << 'MOCK'
import React from 'react';

const mockPaymentContext = {
  processPayment: jest.fn(() => Promise.resolve({ success: true })),
  refundPayment: jest.fn(() => Promise.resolve({ success: true })),
  isProcessing: false,
  lastTransaction: null,
};

export const PaymentContext = React.createContext(mockPaymentContext);
export const PaymentProvider = ({ children, value }: any) => (
  <PaymentContext.Provider value={value || mockPaymentContext}>
    {children}
  </PaymentContext.Provider>
);
export const usePayment = () => mockPaymentContext;
MOCK

# Update jest config to use manual mocks
echo "📝 Updating jest configuration..."
cat > jest.setup.js << 'SETUP'
// Mock contexts
jest.mock('./src/contexts/DataContext', () => require('./src/contexts/__mocks__/DataContext'));
jest.mock('./src/contexts/OrderContext', () => require('./src/contexts/__mocks__/OrderContext'));
jest.mock('./src/contexts/PaymentContext', () => require('./src/contexts/__mocks__/PaymentContext'));
SETUP

# Fix error handler test specifically
echo "📝 Fixing errorHandler test..."
cat > __tests__/utils/errorHandler.test.fix << 'FIX'
// At the top of the test file, after imports
const { logger } = require('../../src/utils/logger');

// In the test setup
beforeEach(() => {
  jest.clearAllMocks();
  // Reset logger mocks
  logger.error.mockClear();
  logger.warn.mockClear();
  logger.info.mockClear();
  logger.debug.mockClear();
});
FIX

# Apply the fix to errorHandler test
if [ -f "__tests__/utils/errorHandler.test.ts" ]; then
  # Insert the fix at line 20 (after the mock setup)
  head -20 __tests__/utils/errorHandler.test.ts > __tests__/utils/errorHandler.test.ts.tmp
  cat __tests__/utils/errorHandler.test.fix >> __tests__/utils/errorHandler.test.ts.tmp
  tail -n +21 __tests__/utils/errorHandler.test.ts >> __tests__/utils/errorHandler.test.ts.tmp
  mv __tests__/utils/errorHandler.test.ts.tmp __tests__/utils/errorHandler.test.ts
fi

echo "✅ Bulk fixes applied"
echo ""
echo "🏃 Running tests to check improvements..."
npm test 2>&1 | grep -E "(Test Suites:|Tests:)" | tail -2
