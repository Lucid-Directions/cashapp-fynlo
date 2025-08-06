#\!/bin/bash

echo "🔧 Comprehensive Test Infrastructure Fix v2"
echo "=========================================="

# Create improved renderWithProviders utility
echo "📝 Creating improved test wrapper utility..."
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

# Create missing mock contexts
echo "📝 Creating mock contexts..."
mkdir -p src/__mocks__/contexts

cat > src/__mocks__/contexts/DataContext.tsx << 'DATACONTEXT'
import React from 'react';

export const DataContext = React.createContext({
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
});

export const DataProvider = ({ children, value }: any) => (
  <DataContext.Provider value={value || {}}>
    {children}
  </DataContext.Provider>
);

export const useData = () => React.useContext(DataContext);
DATACONTEXT

cat > src/__mocks__/contexts/OrderContext.tsx << 'ORDERCONTEXT'
import React from 'react';

export const OrderContext = React.createContext({
  currentOrder: null,
  orderItems: [],
  addItem: jest.fn(),
  removeItem: jest.fn(),
  updateQuantity: jest.fn(),
  clearOrder: jest.fn(),
  submitOrder: jest.fn(() => Promise.resolve()),
  totalAmount: 0,
  itemCount: 0,
});

export const OrderProvider = ({ children, value }: any) => (
  <OrderContext.Provider value={value || {}}>
    {children}
  </OrderContext.Provider>
);

export const useOrder = () => React.useContext(OrderContext);
ORDERCONTEXT

cat > src/__mocks__/contexts/PaymentContext.tsx << 'PAYMENTCONTEXT'
import React from 'react';

export const PaymentContext = React.createContext({
  processPayment: jest.fn(() => Promise.resolve({ success: true })),
  refundPayment: jest.fn(() => Promise.resolve({ success: true })),
  isProcessing: false,
  lastTransaction: null,
});

export const PaymentProvider = ({ children, value }: any) => (
  <PaymentContext.Provider value={value || {}}>
    {children}
  </PaymentContext.Provider>
);

export const usePayment = () => React.useContext(PaymentContext);
PAYMENTCONTEXT

# Fix specific test files that commonly fail
echo "📝 Fixing common test patterns..."

# Create a script to fix test imports
cat > scripts/fix-test-imports.js << 'FIXIMPORTS'
const fs = require('fs');
const path = require('path');

function fixTestFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace old render imports with new renderWithProviders
  content = content.replace(
    /import\s+{\s*render[^}]*}\s+from\s+['"]@testing-library\/react-native['"]/g,
    "import { renderWithProviders as render } from '../../test-utils/renderWithProviders'"
  );
  
  // Add missing mock imports
  if (content.includes('useTheme') && \!content.includes("jest.mock('../design-system/ThemeProvider')")) {
    content = `jest.mock('../../design-system/ThemeProvider', () => ({
  ThemeProvider: ({ children }: any) => children,
  useTheme: () => ({
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
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 8, lg: 12, xl: 16 },
    typography: {
      h1: { fontSize: 32, fontWeight: 'bold' },
      h2: { fontSize: 24, fontWeight: 'bold' },
      h3: { fontSize: 20, fontWeight: 'semibold' },
      body: { fontSize: 16, fontWeight: 'normal' },
      caption: { fontSize: 14, fontWeight: 'normal' },
    },
  }),
}));

` + content;
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${filePath}`);
}

// Find and fix all test files
const testFiles = [
  'src/screens/main/__tests__/OrdersScreen.test.tsx',
  'src/screens/main/__tests__/SettingsScreen.test.tsx',
  'src/screens/main/__tests__/ReportsScreen.test.tsx',
  'src/screens/employees/__tests__/EnhancedEmployeeScheduleScreen.test.tsx',
];

testFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    fixTestFile(fullPath);
  }
});
FIXIMPORTS

node scripts/fix-test-imports.js

echo "✅ Test infrastructure improvements complete"
echo ""
echo "🏃 Running tests to check improvements..."
npm test 2>&1 | grep -E "(PASS|FAIL|Test Suites:|Tests:)" | tail -10
