/**
 * Jest Setup File for Fynlo POS Testing
 * Configures mocks, testing utilities, and global test setup
 */

import 'react-native-gesture-handler/jestSetup';
import fetchMock from 'jest-fetch-mock';

// Mock react-native modules
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      dispatch: jest.fn(),
      goBack: jest.fn(),
      setParams: jest.fn(),
      reset: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
    useFocusEffect: jest.fn(),
    useIsFocused: () => true,
    DrawerActions: {
      openDrawer: jest.fn(),
      closeDrawer: jest.fn(),
      toggleDrawer: jest.fn(),
    },
  };
});

// Mock Zustand stores
jest.mock('./src/store/useAppStore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    user: null,
    session: null,
    cart: [],
    currentOrder: null,
    isOnline: true,
    isLoading: false,
    error: null,
    setUser: jest.fn(),
    logout: jest.fn(),
    setSession: jest.fn(),
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateCartItem: jest.fn(),
    clearCart: jest.fn(),
    setCurrentOrder: jest.fn(),
    setOnlineStatus: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    cartTotal: jest.fn(() => 0),
    cartItemCount: jest.fn(() => 0),
  })),
}));

jest.mock('./src/store/useUIStore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    selectedCategory: 'All',
    showPaymentModal: false,
    showOfflineIndicator: false,
    theme: 'light',
    setSelectedCategory: jest.fn(),
    setShowPaymentModal: jest.fn(),
    setShowOfflineIndicator: jest.fn(),
    setTheme: jest.fn(),
    toggleTheme: jest.fn(),
  })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  
  // The mock for `call` immediately calls the callback which is incorrect
  // So we override it with a no-op
  Reanimated.default.call = () => {};
  
  return Reanimated;
});

// Mock Animated module
jest.mock('react-native/Libraries/Animated/Animated', () => {
  const ActualAnimated = require('react-native/Libraries/Animated/Animated');
  return {
    ...ActualAnimated,
    timing: () => ({
      start: jest.fn(),
    }),
    spring: () => ({
      start: jest.fn(),
    }),
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      interpolate: jest.fn(),
    })),
  };
});

// Mock Keychain
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(),
  getInternetCredentials: jest.fn(),
  resetInternetCredentials: jest.fn(),
  hasInternetCredentials: jest.fn(),
}));

// Mock Biometrics
jest.mock(
  'react-native-biometrics',
  () => ({
    isSensorAvailable: jest.fn(),
    simplePrompt: jest.fn(),
    createKeys: jest.fn(),
    deleteKeys: jest.fn(),
  }),
  { virtual: true }
);

// Mock Camera
jest.mock(
  'react-native-camera',
  () => ({
    RNCamera: 'Camera',
    Constants: {
      BarCodeType: {
        qr: 'qr',
        pdf417: 'pdf417',
        aztec: 'aztec',
        ean13: 'ean13',
        ean8: 'ean8',
        code128: 'code128',
        code39: 'code39',
        code93: 'code93',
        codabar: 'codabar',
        datamatrix: 'datamatrix',
        upc_e: 'upc_e',
        interleaved2of5: 'interleaved2of5',
        itf14: 'itf14',
        upc_a: 'upc_a',
      },
    },
  }),
  { virtual: true }
);

// Mock DatabaseService with sensible defaults so integration tests pass
jest.mock('./src/services/DatabaseService', () => {
  const {
    mockMenuItems,
    mockCategories,
    mockOrders,
    mockSessions,
  } = require('./src/__tests__/fixtures/mockData');

  const dbMock = {
    login: jest.fn().mockResolvedValue(true),
    logout: jest.fn().mockResolvedValue(true),
    getProducts: jest.fn().mockResolvedValue(mockMenuItems),
    getProductsByCategory: jest.fn().mockResolvedValue(mockMenuItems.filter((p) => p.category === 'Appetizers')),
    getCategories: jest.fn().mockResolvedValue(mockCategories),
    getCurrentSession: jest.fn().mockResolvedValue(mockSessions[1]),
    createSession: jest.fn().mockResolvedValue(mockSessions[1]),
    createOrder: jest.fn().mockResolvedValue(mockOrders[0]),
    updateOrder: jest.fn().mockResolvedValue({ ...mockOrders[0], state: 'paid' }),
    getRecentOrders: jest.fn().mockResolvedValue(mockOrders.slice(0, 10)),
    processPayment: jest.fn().mockResolvedValue(true),
    syncOfflineData: jest.fn().mockResolvedValue(undefined),
  };

  return {
    __esModule: true,
    default: {
      getInstance: jest.fn(() => dbMock),
    },
  };
});

// Global test utilities
global.mockNavigate = jest.fn();
global.mockGoBack = jest.fn();
global.mockDispatch = jest.fn();

// Silence the warning: Animated: `useNativeDriver` is not supported
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);

// Custom matchers (if needed)
expect.extend({
  toBeValidNumber(received) {
    const pass = typeof received === 'number' && !isNaN(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid number`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid number`,
        pass: false,
      };
    }
  },
});

// Setup fake timers if needed
// jest.useFakeTimers();

fetchMock.enableMocks();