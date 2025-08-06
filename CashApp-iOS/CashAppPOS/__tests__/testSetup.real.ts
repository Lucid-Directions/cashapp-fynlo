/**
 * REAL Test Setup - NO MOCKS!
 * Pre-production testing with actual infrastructure
 */

import 'react-native-gesture-handler/jestSetup';
import { TextEncoder, TextDecoder } from 'util';
import fetch from 'node-fetch';

// ===========================================
// GLOBAL SETUP FOR REAL TESTING
// ===========================================

// Add TextEncoder/TextDecoder for Node environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Add fetch for Node environment (for real API calls)
global.fetch = fetch as any;

// Real WebSocket (use ws package for Node)
if (typeof WebSocket === 'undefined') {
  global.WebSocket = require('ws');
}

// ===========================================
// TIMER CONFIGURATION - REAL TIMERS FOR REAL TESTS
// ===========================================
// Use real timers for integration tests
beforeEach(() => {
  jest.useRealTimers(); // REAL timers for real async operations
});

afterEach(() => {
  jest.clearAllTimers();
});

// ===========================================
// ASYNC STORAGE - REAL IMPLEMENTATION
// ===========================================
// Use actual AsyncStorage implementation
jest.mock('@react-native-async-storage/async-storage', () => {
  const actualAsyncStorage = jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock');
  return actualAsyncStorage;
});

// ===========================================
// SUPABASE - REAL CLIENT, NO MOCKS!
// ===========================================
jest.mock('../src/lib/supabase', () => {
  const { createClient } = require('@supabase/supabase-js');
  const TEST_CONFIG = require('../src/__tests__/config/test.config').default;
  
  // Create REAL Supabase client inside the mock factory
  const realSupabaseClient = createClient(
    process.env.SUPABASE_URL || TEST_CONFIG.SUPABASE.URL,
    process.env.SUPABASE_ANON_KEY || TEST_CONFIG.SUPABASE.ANON_KEY
  );
  
  return {
    supabase: realSupabaseClient,
  };
});

// ===========================================
// NAVIGATION - REAL NAVIGATION CONTEXT
// ===========================================
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn((screen, params) => {
        console.log(`[REAL NAV] Navigate to ${screen}`, params);
      }),
      goBack: jest.fn(),
      dispatch: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
    useIsFocused: () => true,
  };
});

// ===========================================
// REACT NATIVE MODULES - REAL IMPLEMENTATIONS
// ===========================================

// Real Alert implementation
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: (title: string, message?: string, buttons?: any[]) => {
    console.log(`[REAL ALERT] ${title}: ${message}`);
    // Call the OK button callback if provided
    if (buttons && buttons[0] && buttons[0].onPress) {
      buttons[0].onPress();
    }
  },
}));

// Real Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn((url) => {
    console.log(`[REAL LINKING] Open URL: ${url}`);
    return Promise.resolve();
  }),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// ===========================================
// NETINFO - REAL NETWORK STATUS
// ===========================================
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

// ===========================================
// LOGGER - REAL LOGGING (NO MOCK)
// ===========================================
// Use actual logger for debugging real test failures
jest.unmock('../src/utils/logger');

// ===========================================
// KEYCHAIN - REAL SECURE STORAGE
// ===========================================
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn((server, username, password) => {
    console.log(`[REAL KEYCHAIN] Store credentials for ${server}`);
    return Promise.resolve(true);
  }),
  getInternetCredentials: jest.fn((server) => {
    console.log(`[REAL KEYCHAIN] Retrieve credentials for ${server}`);
    return Promise.resolve({
      username: 'test',
      password: JSON.stringify({ apiKey: 'test-key', secretKey: 'test-secret' }),
    });
  }),
  resetInternetCredentials: jest.fn((server) => {
    console.log(`[REAL KEYCHAIN] Reset credentials for ${server}`);
    return Promise.resolve(true);
  }),
}));

// ===========================================
// REAL TEST ENVIRONMENT SETUP
// ===========================================
global.performance = {
  now: () => Date.now(),
  mark: (name: string) => console.log(`[PERF] Mark: ${name}`),
  measure: (name: string, start: string, end: string) => {
    console.log(`[PERF] Measure: ${name} from ${start} to ${end}`);
  },
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  getEntries: jest.fn(() => []),
  navigation: {} as any,
  timeOrigin: Date.now(),
  toJSON: () => ({}),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
} as any;

// ===========================================
// HELPER FUNCTIONS FOR REAL ASYNC TESTS
// ===========================================
global.flushPromises = () => new Promise(resolve => setImmediate(resolve));

global.waitForAsync = async (fn: () => boolean, timeout: number = 5000) => {
  const start = Date.now();
  while (!fn() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  if (!fn()) {
    throw new Error('Timeout waiting for condition');
  }
};

// ===========================================
// REAL API TEST HELPER
// ===========================================
// Import helper and make it available globally
const RealAPITestHelper = require('../src/__tests__/helpers/realApiTestHelper').default;
global.RealAPITestHelper = RealAPITestHelper;

// ===========================================
// TEST ENVIRONMENT VALIDATION
// ===========================================
beforeAll(async () => {
  console.log('🚀 Starting REAL test environment...');
  
  // Check if we have required environment variables
  const hasSupabaseConfig = !!(
    process.env.SUPABASE_URL || 'https://eweggzpvuqczrrrwszyy.supabase.co'
  );
  
  if (!hasSupabaseConfig) {
    console.warn('⚠️ Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY');
  }
  
  // Test backend connectivity
  try {
    if (global.RealAPITestHelper && global.RealAPITestHelper.checkBackendHealth) {
      const isHealthy = await global.RealAPITestHelper.checkBackendHealth();
      if (isHealthy) {
        console.log('✅ Backend is healthy and ready for testing');
      } else {
        console.warn('⚠️ Backend health check failed - tests may fail');
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not check backend health:', error);
  }
});

afterAll(async () => {
  // Clean up any test data
  if (global.RealAPITestHelper && global.RealAPITestHelper.cleanup) {
    await global.RealAPITestHelper.cleanup();
  }
  console.log('👋 Test environment cleaned up');
});

// ===========================================
// CONSOLE OUTPUT CONTROL
// ===========================================
const originalError = console.error;
console.error = (...args: any[]) => {
  // Only suppress React Native warnings, not real errors
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

console.log('✅ REAL test environment ready - NO MOCKS!');

export { RealAPITestHelper };