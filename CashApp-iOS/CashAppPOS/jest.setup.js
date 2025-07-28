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

// Mock SumUp native module to avoid ESM issues during tests
jest.mock('sumup-react-native-alpha', () => ({
  __esModule: true,
  SumUpProvider: ({ children }) => children,
  useSumUp: () => ({
    initPaymentSheet: jest.fn(),
    presentPaymentSheet: jest.fn(),
  }),
}));

// Mock Supabase to avoid ESM issues
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signIn: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  })),
}));

// Mock react-native-config
jest.mock('react-native-config', () => ({
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
  API_URL: 'http://localhost:8000',
}));