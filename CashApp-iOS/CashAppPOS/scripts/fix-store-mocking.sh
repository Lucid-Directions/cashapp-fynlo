#!/bin/bash

echo "🔧 Fixing store mocking issues comprehensively"
echo "============================================="

# 1. Remove duplicate store mocks from testSetup.ts (they were added twice)
echo "1. Cleaning up duplicate mocks in testSetup.ts..."
# Remove the duplicate mocks we just added (lines 330-370)
sed -i '' '330,370d' __tests__/testSetup.ts

# 2. Create a centralized mock configuration
echo "2. Creating centralized store mocks..."
cat > __mocks__/storeMocks.js << 'EOF'
// Centralized store mocks for consistency

export const mockAppStore = {
  cart: [],
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  updateCartItem: jest.fn(),
  clearCart: jest.fn(),
  cartTotal: 0,
  cartItemCount: 0,
  menuItems: [],
  setMenuItems: jest.fn(),
  isLoading: false,
  setIsLoading: jest.fn(),
  orders: [],
  setOrders: jest.fn(),
  currentOrder: null,
  setCurrentOrder: jest.fn(),
};

export const mockUIStore = {
  selectedCategory: 'All',
  setSelectedCategory: jest.fn(),
  showPaymentModal: false,
  setShowPaymentModal: jest.fn(),
  isLoading: false,
  setIsLoading: jest.fn(),
  error: null,
  setError: jest.fn(),
};

export const mockSettingsStore = {
  taxConfiguration: {
    rate: 0,
    enabled: false,
  },
  settings: {},
  updateSettings: jest.fn(),
  getSettings: jest.fn(() => ({})),
};

export const mockAuthStore = {
  isAuthenticated: true,
  user: { id: '1', email: 'test@test.com', role: 'employee' },
  login: jest.fn(),
  logout: jest.fn(),
  isLoading: false,
  checkAuth: jest.fn(),
};
EOF

# 3. Update testSetup.ts to use centralized mocks
echo "3. Updating testSetup.ts to use centralized mocks..."
cat >> __tests__/testSetup.ts << 'EOF'

// Import centralized mocks
import { mockAppStore, mockUIStore, mockSettingsStore, mockAuthStore } from '../__mocks__/storeMocks';

// Override store mocks with centralized versions
jest.mock('../src/store/useAppStore', () => ({
  __esModule: true,
  default: jest.fn(() => mockAppStore),
}));

jest.mock('../src/store/useUIStore', () => ({
  __esModule: true,
  default: jest.fn(() => mockUIStore),
}));

jest.mock('../src/store/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn(() => mockSettingsStore),
}));

jest.mock('../src/store/useAuthStore', () => ({
  __esModule: true,
  default: jest.fn(() => mockAuthStore),
}));
EOF

# 4. Fix SharedDataStore mock
echo "4. Creating proper SharedDataStore mock..."
cat > src/services/__mocks__/SharedDataStore.ts << 'EOF'
export default class SharedDataStore {
  private static instance: SharedDataStore;
  
  serviceChargeConfig = {
    enabled: false,
    rate: 0,
    description: 'Test service charge',
  };
  
  private listeners: Array<() => void> = [];
  
  static getInstance(): SharedDataStore {
    if (!SharedDataStore.instance) {
      SharedDataStore.instance = new SharedDataStore();
    }
    return SharedDataStore.instance;
  }
  
  addListener(callback: () => void): void {
    this.listeners.push(callback);
  }
  
  removeListener(callback: () => void): void {
    this.listeners = this.listeners.filter(l => l !== callback);
  }
  
  updateServiceChargeConfig(config: any): void {
    this.serviceChargeConfig = config;
    this.listeners.forEach(l => l());
  }
}
EOF

# 5. Fix component test rendering issues
echo "5. Creating test render utility..."
cat > src/__tests__/utils/renderWithProviders.tsx << 'EOF'
import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '../../design-system/ThemeProvider';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: any;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: CustomRenderOptions
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <NavigationContainer>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </NavigationContainer>
  );

  return render(ui, { wrapper: Wrapper, ...options });
}

export * from '@testing-library/react-native';
EOF

# 6. Fix POSScreen test specifically
echo "6. Fixing POSScreen test..."
cat > src/screens/main/__tests__/POSScreen.test.fix.tsx << 'EOF'
/**
 * POSScreen Component Tests
 * Testing the main point-of-sale interface
 */

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/utils/renderWithProviders';
import POSScreen from '../POSScreen';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

// Mock SharedDataStore
jest.mock('../../../services/SharedDataStore');

// Mock other services
jest.mock('../../../services/DataService', () => ({
  fetchMenuItems: jest.fn(() => Promise.resolve([])),
  getInstance: jest.fn(() => ({
    fetchMenuItems: jest.fn(() => Promise.resolve([])),
  })),
}));

describe('POSScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and shows main elements', async () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(<POSScreen />);
    
    await waitFor(() => {
      expect(getByText('All')).toBeTruthy();
      expect(getByPlaceholderText('Search menu...')).toBeTruthy();
    });
  });

  it('renders with proper navigation setup', async () => {
    const { getByTestId } = renderWithProviders(<POSScreen />);
    
    await waitFor(() => {
      // Check for cart icon
      const cartButton = getByTestId('cart-button');
      expect(cartButton).toBeTruthy();
    });
  });
});
EOF

# Move the fixed test over the original
mv src/screens/main/__tests__/POSScreen.test.fix.tsx src/screens/main/__tests__/POSScreen.test.tsx

echo ""
echo "✅ Store mocking fixes applied!"
echo ""
echo "Running tests to check improvement..."
npm test -- --verbose=false 2>&1 | grep -E "(Test Suites:|Tests:)" | tail -2