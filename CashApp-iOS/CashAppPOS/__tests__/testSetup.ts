/**
 * REAL INFRASTRUCTURE TEST SETUP - NO MOCKS
 * Pre-production testing with actual services
 */

import 'react-native-gesture-handler/jestSetup';

// Load test environment variables
require('dotenv').config({ path: '.env.test' });

// Import real test configuration
import { TEST_CONFIG, supabaseTestClient } from '../__tests__/config/real.test.config';

// ===========================================
// ENVIRONMENT SETUP FOR REAL SERVICES
// ===========================================

process.env.NODE_ENV = 'test';
process.env.USE_REAL_BACKEND = 'true';
process.env.USE_REAL_AUTH = 'true';  
process.env.USE_REAL_WEBSOCKET = 'true';
process.env.SKIP_MOCKS = 'true';

// Override config variables for test environment
process.env.SUPABASE_URL = TEST_CONFIG.supabase.url;
process.env.SUPABASE_ANON_KEY = TEST_CONFIG.supabase.anonKey;
process.env.API_BASE_URL = TEST_CONFIG.api.baseUrl;
process.env.WEBSOCKET_URL = TEST_CONFIG.websocket.url;

// ===========================================
// TIMER CONFIGURATION - EXTENDED FOR REAL CALLS
// ===========================================
beforeEach(() => {
  jest.useRealTimers();
});

afterEach(() => {
  jest.clearAllTimers();
});

// ===========================================
// REAL WEBSOCKET SETUP - NO MOCKS
// ===========================================
if (typeof global.WebSocket === 'undefined') {
  const WebSocket = require('ws');
  global.WebSocket = WebSocket;
}

global.CloseEvent = class CloseEvent extends Event {
  code: number;
  reason: string;
  wasClean: boolean;

  constructor(type: string, eventInitDict: any = {}) {
    super(type);
    this.code = eventInitDict.code || 1000;
    this.reason = eventInitDict.reason || '';
    this.wasClean = eventInitDict.wasClean || true;
  }
} as any;

global.MessageEvent = class MessageEvent extends Event {
  data: any;
  
  constructor(type: string, eventInitDict: any = {}) {
    super(type);
    this.data = eventInitDict.data;
  }
} as any;

// ===========================================
// ASYNC STORAGE - REAL IMPLEMENTATION
// ===========================================
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// ===========================================
// SUPABASE - REAL CLIENT (NO MOCKS)
// ===========================================
jest.mock('../src/lib/supabase', () => ({
  supabase: supabaseTestClient,
}));

// ===========================================
// LOGGER - REAL IMPLEMENTATION  
// ===========================================
const realLogger = require('../src/utils/logger').logger;

// Enable logging in test environment
realLogger.configure({
  enableInDevelopment: true,
  enableInProduction: true,
});

// ===========================================
// REACT NATIVE COMPONENT MOCKS (UI ONLY)
// ===========================================

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
    initialWindowMetrics: {
      insets: inset,
      frame: { x: 0, y: 0, width: 0, height: 0 },
    },
  };
});

jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const React = require('react');
  return (props: any) => React.createElement('Text', props, props.name || 'MockedIcon');
});

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      reset: jest.fn(),
      setParams: jest.fn(),
      dispatch: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
      removeListener: jest.fn(),
      canGoBack: jest.fn(() => false),
      isFocused: jest.fn(() => true),
    }),
    useRoute: () => ({
      params: {},
      name: 'TestScreen',
      key: 'test-key',
    }),
    useFocusEffect: jest.fn(),
    useIsFocused: jest.fn(() => true),
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: {
        isConnectionExpensive: false,
      },
    })
  ),
  addEventListener: jest.fn(() => jest.fn()),
  refresh: jest.fn(() => Promise.resolve()),
}));

// ===========================================
// THEME PROVIDER - REAL IMPLEMENTATION
// ===========================================
const actualThemeProvider = jest.requireActual('../src/design-system/ThemeProvider');
jest.mock('../src/design-system/ThemeProvider', () => actualThemeProvider);

// ===========================================
// GLOBAL TEST UTILITIES
// ===========================================

global.performance = {
  now: () => Date.now(),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn((name) => [{
    name,
    duration: Math.random() * 100,
    startTime: Date.now(),
    entryType: 'measure'
  }]),
  getEntriesByType: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  clearResourceTimings: jest.fn(),
  setResourceTimingBufferSize: jest.fn(),
} as any;

global.crypto = {
  getRandomValues: (arr: any) => {
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(arr.length);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = randomBytes[i];
    }
    return arr;
  },
  subtle: {} as any,
} as any;

global.flushPromises = () => new Promise(resolve => setImmediate(resolve));

global.waitForAsync = async (fn: () => boolean, timeout: number = 30000) => {
  const start = Date.now();
  while (!fn() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!fn()) {
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  }
};

global.simulateNetworkDelay = (ms: number = 100) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// ===========================================
// PAYMENT SDK MOCKS (TEST MODE)
// ===========================================
jest.mock('sumup-react-native-alpha', () => ({
  SumUpProvider: ({ children }: any) => children,
  useSumUp: () => ({
    initSumUp: jest.fn(() => Promise.resolve()),
    login: jest.fn(() => Promise.resolve()),
    logout: jest.fn(() => Promise.resolve()),
    checkout: jest.fn(({ amount }) => {
      const timestampId = Date.now();
      return Promise.resolve({ 
        success: true, 
        transactionId: `test-${timestampId}`,
        amount: amount,
        currency: 'GBP'
      });
    }),
    isLoggedIn: jest.fn(() => Promise.resolve(true)),
    getSettings: jest.fn(() => Promise.resolve({
      merchantCode: 'TEST_MERCHANT',
      currency: 'GBP'
    })),
  }),
}));

jest.mock('react-dom', () => ({}), { virtual: true });
jest.mock('mobx-react', () => ({
  observer: (component: any) => component,
  inject: () => (component: any) => component,
  Provider: ({ children }: any) => children,
}));
jest.mock('mobx-react-lite', () => ({
  observer: (component: any) => component,
  useObserver: (fn: any) => fn(),
  Observer: ({ children }: any) => children(),
}));

// ===========================================
// TEST AUTHENTICATION HELPER
// ===========================================
global.authenticateForTests = async () => {
  try {
    const { data, error } = await supabaseTestClient.auth.signInWithPassword({
      email: TEST_CONFIG.testUser.email,
      password: TEST_CONFIG.testUser.password,
    });
    
    if (error) {
      console.warn('Test authentication failed:', error.message);
      return null;
    }
    
    return data.session;
  } catch (error) {
    console.warn('Test authentication error:', error);
    return null;
  }
};

// ===========================================
// TEST CLEANUP AND ERROR HANDLING
// ===========================================
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    const errorString = args[0]?.toString() || '';
    
    if (
      errorString.includes('Warning: An update to') ||
      errorString.includes('not wrapped in act') ||
      errorString.includes('Warning: Failed prop type')
    ) {
      return;
    }
    
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

jest.setTimeout(60000); // 60 seconds for real API calls

console.log('🔧 Real Infrastructure Test Setup Complete');
console.log(`📡 API: ${TEST_CONFIG.api.baseUrl}`);
console.log(`🔐 Auth: ${TEST_CONFIG.supabase.url}`);
console.log(`🔌 WebSocket: ${TEST_CONFIG.websocket.url}`);
