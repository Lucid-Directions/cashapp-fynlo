import 'react-native-gesture-handler/jestSetup';

// ===========================================
// TIMER CONFIGURATION - MUST BE FIRST
// ===========================================
// Set up fake timers globally to prevent timer-related issues
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// ===========================================
// WEBSOCKET MOCK - COMPREHENSIVE
// ===========================================
// Mock WebSocket class with proper event handling
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate async connection
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) {
          this.onopen(new Event('open'));
        }
      }
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close(code?: number, reason?: string) {
    if (this.readyState !== MockWebSocket.CLOSED) {
      this.readyState = MockWebSocket.CLOSING;
      setTimeout(() => {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) {
          this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
        }
      }, 0);
    }
  }
}

// Set global WebSocket
(global as any).WebSocket = MockWebSocket;

// WebSocket event polyfills
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
  origin: string;
  lastEventId: string;
  source: any;
  ports: any[];
  
  constructor(type: string, eventInitDict: any = {}) {
    super(type);
    this.data = eventInitDict.data;
    this.origin = eventInitDict.origin || '';
    this.lastEventId = eventInitDict.lastEventId || '';
    this.source = eventInitDict.source || null;
    this.ports = eventInitDict.ports || [];
  }
} as any;

global.Event = class Event {
  type: string;
  target: any;
  currentTarget: any;
  eventPhase: number = 0;
  bubbles: boolean = false;
  cancelable: boolean = false;
  defaultPrevented: boolean = false;
  composed: boolean = false;
  isTrusted: boolean = false;
  timeStamp: number = Date.now();
  
  constructor(type: string, eventInitDict?: EventInit) {
    this.type = type;
    this.target = null;
    this.currentTarget = null;
    if (eventInitDict) {
      this.bubbles = eventInitDict.bubbles || false;
      this.cancelable = eventInitDict.cancelable || false;
      this.composed = eventInitDict.composed || false;
    }
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  stopPropagation() {}
  stopImmediatePropagation() {}
} as any;

// ===========================================
// ASYNC STORAGE MOCK
// ===========================================
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// ===========================================
// SUPABASE MOCK
// ===========================================
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signIn: jest.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      signUp: jest.fn(() => Promise.resolve({ data: null, error: null })),
      resetPasswordForEmail: jest.fn(() => Promise.resolve({ data: null, error: null })),
      updateUser: jest.fn(() => Promise.resolve({ data: null, error: null })),
    },
    from: jest.fn((table: string) => ({
      select: jest.fn(() => Promise.resolve({ data: [], error: null })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => Promise.resolve({ data: null, error: null })),
      delete: jest.fn(() => Promise.resolve({ data: null, error: null })),
      upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      eq: jest.fn(() => ({ data: [], error: null })),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}));

// ===========================================
// REACT NATIVE MOCKS
// ===========================================
// Mock react-native-safe-area-context
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

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const React = require('react');
  return (props: any) => React.createElement('Text', props, props.name || 'MockedIcon');
});

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

// Mock NetInfo
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
// THEME PROVIDER MOCK
// ===========================================
jest.mock('../src/design-system/ThemeProvider', () => ({
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
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    borderRadius: {
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
    },
    typography: {
      h1: { fontSize: 32, fontWeight: 'bold' },
      h2: { fontSize: 24, fontWeight: 'bold' },
      h3: { fontSize: 20, fontWeight: 'semibold' },
      body: { fontSize: 16, fontWeight: 'normal' },
      caption: { fontSize: 14, fontWeight: 'normal' },
    },
  }),
}));

// ===========================================
// GLOBAL MOCKS
// ===========================================
// Global mocks for testing environment
global.mockAsyncStorage = {
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
};

// Mock performance API with proper implementation
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  clearResourceTimings: jest.fn(),
  setResourceTimingBufferSize: jest.fn(),
} as any;

// Mock crypto.getRandomValues
global.crypto = {
  getRandomValues: (arr: any) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  subtle: {} as any,
} as any;

// Mock global flags
global.FLAGS = {
  SHOW_DEV_MENU: true,
};

// Mock __DEV__
global.__DEV__ = true;

// ===========================================
// THIRD-PARTY SDK MOCKS
// ===========================================
// Mock SumUp React Native SDK
jest.mock('sumup-react-native-alpha', () => ({
  SumUpProvider: ({ children }: any) => children,
  useSumUp: () => ({
    initSumUp: jest.fn(() => Promise.resolve()),
    login: jest.fn(() => Promise.resolve()),
    logout: jest.fn(() => Promise.resolve()),
    checkout: jest.fn(() => Promise.resolve({ success: true, transactionId: 'test-123' })),
    isLoggedIn: jest.fn(() => Promise.resolve(false)),
    getSettings: jest.fn(() => Promise.resolve({})),
  }),
}));

// Mock react-dom for SumUp dependency
jest.mock('react-dom', () => ({}), { virtual: true });

// Mock mobx-react for SumUp dependency  
jest.mock('mobx-react', () => ({
  observer: (component: any) => component,
  inject: () => (component: any) => component,
  Provider: ({ children }: any) => children,
}));

// Mock mobx-react-lite for SumUp dependency
jest.mock('mobx-react-lite', () => ({
  observer: (component: any) => component,
  useObserver: (fn: any) => fn(),
  Observer: ({ children }: any) => children(),
}));

// ===========================================
// STORE MOCKS
// ===========================================
// Import centralized mocks
import { mockAppStore, mockUIStore, mockSettingsStore, mockAuthStore } from '../__mocks__/storeMocks';

// Mock store hooks with centralized versions
jest.mock('../src/store/useAppStore', () => ({
  __esModule: true,
  default: jest.fn(() => mockAppStore),
  useAppStore: jest.fn(() => mockAppStore),
}));

jest.mock('../src/store/useUIStore', () => ({
  __esModule: true,
  default: jest.fn(() => mockUIStore),
  useUIStore: jest.fn(() => mockUIStore),
}));

jest.mock('../src/store/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn(() => mockSettingsStore),
  useSettingsStore: jest.fn(() => mockSettingsStore),
}));

jest.mock('../src/store/useAuthStore', () => ({
  __esModule: true,
  default: jest.fn(() => mockAuthStore),
  useAuthStore: jest.fn(() => mockAuthStore),
}));

// ===========================================
// ADDITIONAL GLOBAL UTILITIES
// ===========================================
// Ensure all globals are defined
if (typeof global.logger === 'undefined') {
  global.logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  };
}

// Mock global theme - fallback for components that don't use ThemeProvider
if (typeof global.theme === 'undefined') {
  global.theme = {
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
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    borderRadius: {
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
    },
    typography: {
      h1: { fontSize: 32, fontWeight: 'bold' },
      h2: { fontSize: 24, fontWeight: 'bold' },
      h3: { fontSize: 20, fontWeight: 'semibold' },
      body: { fontSize: 16, fontWeight: 'normal' },
      caption: { fontSize: 14, fontWeight: 'normal' },
    },
  };
}

// ===========================================
// HELPER FUNCTIONS FOR ASYNC TESTS
// ===========================================
// Helper to properly handle async operations in tests
global.flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Helper to wait for async updates
global.waitForAsync = async (fn: () => boolean, timeout: number = 5000) => {
  const start = Date.now();
  while (!fn() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  if (!fn()) {
    throw new Error('Timeout waiting for condition');
  }
};

// Add console error suppression for expected errors
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Suppress specific expected errors during tests
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