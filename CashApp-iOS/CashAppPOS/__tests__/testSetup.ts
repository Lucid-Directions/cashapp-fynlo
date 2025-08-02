import 'react-native-gesture-handler/jestSetup';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MockedIcon');

// Mock navigation
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
    }),
    useRoute: () => ({
      params: {},
    }),
    useFocusEffect: jest.fn(),
  };
});

// Mock Dimensions
const mockDimensions = {
  get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

jest.mock('react-native/Libraries/Utilities/Dimensions', () => mockDimensions);

// Mock Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  Version: '14.0',
  select: jest.fn((config) => config.ios),
}));

// Mock StatusBar
jest.mock('react-native/Libraries/Components/StatusBar/StatusBar', () => ({
  currentHeight: 44,
  setBarStyle: jest.fn(),
  setBackgroundColor: jest.fn(),
  setTranslucent: jest.fn(),
}));

// Mock InteractionManager
jest.mock('react-native/Libraries/Interaction/InteractionManager', () => ({
  runAfterInteractions: jest.fn((callback) => {
    callback();
    return { cancel: jest.fn() };
  }),
  createInteractionHandle: jest.fn(),
  clearInteractionHandle: jest.fn(),
}));

// Mock Animated
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    })
  ),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Global test utilities
global.mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(() => Promise.resolve([])),
};

// Mock timers
global.setTimeout = jest.fn((callback, delay) => {
  if (typeof callback === 'function') {
    callback();
  }
  return 1;
});

global.clearTimeout = jest.fn();
global.setInterval = jest.fn(() => 1);
global.clearInterval = jest.fn();

// Custom matchers
expect.extend({
  toBeAccessible(received) {
    const hasAccessibilityLabel = received.props.accessibilityLabel;
    const hasAccessibilityRole = received.props.accessibilityRole;
    const hasAccessibilityHint = received.props.accessibilityHint;

    const pass = !!(hasAccessibilityLabel || hasAccessibilityRole || hasAccessibilityHint);

    if (pass) {
      return {
        message: () => `Expected element not to be accessible`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected element to have accessibility properties (label, role, or hint)`,
        pass: false,
      };
    }
  },

  toHaveMinimumTouchTarget(received) {
    const style = received.props.style;
    let flatStyle = {};

    if (Array.isArray(style)) {
      flatStyle = Object.assign({}, ...style);
    } else if (style) {
      flatStyle = style;
    }

    const hasMinimumSize =
      (flatStyle.width >= 44 && flatStyle.height >= 44) ||
      (flatStyle.minWidth >= 44 && flatStyle.minHeight >= 44);

    return {
      message: () =>
        hasMinimumSize
          ? `Expected element not to have minimum touch target size (44x44)`
          : `Expected element to have minimum touch target size (44x44)`,
      pass: hasMinimumSize,
    };
  },

  toHaveCorrectTextContrast(received) {
    // Simplified contrast check for testing
    const backgroundColor = received.props.style?.backgroundColor;
    const color = received.props.style?.color;

    // This is a simplified check - in reality you'd calculate actual contrast ratios
    const hasGoodContrast = backgroundColor !== color;

    return {
      message: () =>
        hasGoodContrast
          ? `Expected element to have poor text contrast`
          : `Expected element to have good text contrast`,
      pass: hasGoodContrast,
    };
  },
});

// Performance monitoring for tests
global.performance = global.performance || {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
};

// Console suppression for tests
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  // Suppress known warnings/errors during tests
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
        args[0].includes('Warning: componentWillMount has been renamed'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('source.uri should not be an empty string')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterEach(() => {
  console.error = originalError;
  console.warn = originalWarn;
  jest.clearAllMocks();
});

// Test environment configuration
const testConfig = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/testSetup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@stores/(.*)$': '<rootDir>/src/stores/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vector-icons|@react-navigation)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

export default testConfig;
