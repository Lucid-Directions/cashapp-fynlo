import 'react-native-gesture-handler/jestSetup';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Supabase
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signIn: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({ data: [], error: null })),
      insert: jest.fn(() => ({ data: null, error: null })),
      update: jest.fn(() => ({ data: null, error: null })),
      delete: jest.fn(() => ({ data: null, error: null })),
    })),
  },
}));

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
    }),
    useRoute: () => ({
      params: {},
    }),
    useFocusEffect: jest.fn(),
  };
});

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

// Global mocks for testing environment
global.mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(() => Promise.resolve([])),
};

// Mock performance
global.performance = global.performance || {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
};

// Mock crypto.getRandomValues
global.crypto = {
  getRandomValues: (arr: any) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
} as any;

// Mock global flags
global.FLAGS = {
  SHOW_DEV_MENU: true,
};

// Mock __DEV__
global.__DEV__ = true;

// WebSocket polyfills for Jest environment
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

global.Event = class Event {
  type: string;
  target: any;
  
  constructor(type: string) {
    this.type = type;
    this.target = null;
  }
} as any;

// Suppress console logs during tests
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.error = originalError;
  console.warn = originalWarn;
  jest.clearAllMocks();
});

// Ensure all globals are defined
if (typeof global.logger === 'undefined') {
  global.logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

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

// Additional Dimensions mock is handled above in the main React Native mock

// Mock SumUp React Native SDK
jest.mock('sumup-react-native-alpha', () => ({
  SumUpProvider: ({ children }: any) => children,
  useSumUp: () => ({
    initSumUp: jest.fn(() => Promise.resolve()),
    login: jest.fn(() => Promise.resolve()),
    checkout: jest.fn(() => Promise.resolve({ success: true })),
    isLoggedIn: jest.fn(() => Promise.resolve(false)),
  }),
}));

// Mock react-dom for SumUp dependency
jest.mock('react-dom', () => ({}), { virtual: true });

// Mock mobx-react for SumUp dependency  
jest.mock('mobx-react', () => ({
  observer: (component: any) => component,
  inject: () => (component: any) => component,
}));

// Mock mobx-react-lite for SumUp dependency
jest.mock('mobx-react-lite', () => ({
  observer: (component: any) => component,
  useObserver: (fn: any) => fn(),
}));

// Mock store hooks
jest.mock('../src/store/useAppStore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    cart: [],
    menuItems: [],
    user: null,
    session: null,
    currentOrder: null,
    serviceChargePercentage: 10,
    addTransactionFee: false,
    isOnline: true,
    isLoading: false,
    error: null,
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateCartItem: jest.fn(),
    clearCart: jest.fn(),
    cleanCart: jest.fn(),
    setCurrentOrder: jest.fn(),
    setUser: jest.fn(),
    logout: jest.fn(),
    setSession: jest.fn(),
    setOnlineStatus: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    cartTotal: jest.fn(() => 0),
    cartItemCount: jest.fn(() => 0),
    calculateServiceCharge: jest.fn(() => 0),
    calculateTransactionFee: jest.fn(() => 0),
    serviceChargeIncluded: false,
    transactionFeeIncluded: false,
    enableServiceCharge: jest.fn(),
    enableTransactionFee: jest.fn(),
  })),
  useAppStore: jest.fn(() => ({
    cart: [],
    menuItems: [],
    user: null,
    session: null,
    currentOrder: null,
    serviceChargePercentage: 10,
    addTransactionFee: false,
    isOnline: true,
    isLoading: false,
    error: null,
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateCartItem: jest.fn(),
    clearCart: jest.fn(),
    cleanCart: jest.fn(),
    setCurrentOrder: jest.fn(),
    setUser: jest.fn(),
    logout: jest.fn(),
    setSession: jest.fn(),
    setOnlineStatus: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    cartTotal: jest.fn(() => 0),
    cartItemCount: jest.fn(() => 0),
    calculateServiceCharge: jest.fn(() => 0),
    calculateTransactionFee: jest.fn(() => 0),
    serviceChargeIncluded: false,
    transactionFeeIncluded: false,
    enableServiceCharge: jest.fn(),
    enableTransactionFee: jest.fn(),
  })),
}));

jest.mock('../src/store/useUIStore', () => ({
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

jest.mock('../src/store/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    settings: {},
    updateSettings: jest.fn(),
    getSettings: jest.fn(() => ({})),
  })),
}));


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
