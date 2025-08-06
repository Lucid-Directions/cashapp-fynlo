// Centralized store mocks for consistency

export const mockAppStore = {
  // Cart state
  cart: [],
  cartTotal: 0,
  cartItemCount: 0,
  
  // Cart actions
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  updateCartItem: jest.fn(),
  clearCart: jest.fn(),
  cleanCart: jest.fn(),
  
  // Menu state
  menuItems: [],
  setMenuItems: jest.fn(),
  
  // Loading/Error state
  isLoading: false,
  setIsLoading: jest.fn(),
  setLoading: jest.fn(),
  error: null,
  setError: jest.fn(),
  
  // Order state
  orders: [],
  setOrders: jest.fn(),
  currentOrder: null,
  setCurrentOrder: jest.fn(),
  
  // User/Auth state
  user: null,
  session: null,
  setUser: jest.fn(),
  logout: jest.fn(),
  setSession: jest.fn(),
  
  // Service charges and fees
  serviceChargePercentage: 10,
  addTransactionFee: false,
  serviceChargeIncluded: false,
  transactionFeeIncluded: false,
  calculateServiceCharge: jest.fn(() => 0),
  calculateTransactionFee: jest.fn(() => 0),
  enableServiceCharge: jest.fn(),
  enableTransactionFee: jest.fn(),
  
  // Network state
  isOnline: true,
  setOnlineStatus: jest.fn(),
};

export const mockUIStore = {
  selectedCategory: 'All',
  setSelectedCategory: jest.fn(),
  showPaymentModal: false,
  setShowPaymentModal: jest.fn(),
  showOfflineIndicator: false,
  setShowOfflineIndicator: jest.fn(),
  theme: 'light',
  setTheme: jest.fn(),
  toggleTheme: jest.fn(),
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
  setLoading: jest.fn(),
  checkAuth: jest.fn(),
  error: null,
  setError: jest.fn(),
};
