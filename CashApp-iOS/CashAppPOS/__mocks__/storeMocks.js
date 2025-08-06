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
