/**
 * Comprehensive mock store helpers for testing
 * Provides properly typed mock stores that match the actual store interfaces
 */

import type { User, PosSession, Order } from '../types';
import type { EnhancedOrderItem, CartTemplate, SplitBillConfig } from '../types/cart';

// Helper to create mock enhanced order items
export const createMockEnhancedOrderItem = (
  overrides?: Partial<EnhancedOrderItem>
): EnhancedOrderItem => ({
  id: '1',
  productId: '1',
  name: 'Test Item',
  price: 10.0,
  quantity: 1,
  emoji: '🍔',
  modifications: [],
  originalPrice: 10.0,
  modificationPrice: 0,
  totalPrice: 10.0,
  addedAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
  addedBy: 'test-user',
  ...overrides,
});

// Helper to create mock user
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  is_platform_owner: false,
  role: 'employee',
  restaurant_id: 'test-restaurant',
  restaurant_name: 'Test Restaurant',
  subscription_plan: 'beta',
  subscription_status: 'active',
  enabled_features: ['pos', 'orders', 'payments'],
  needs_onboarding: false,
  ...overrides,
});

// Create comprehensive mock enhanced cart store
export const createMockEnhancedCartStore = (overrides?: any) => ({
  // User/Session state
  user: null,
  session: null,
  currentOrder: null,
  isOnline: true,
  isLoading: false,
  error: null,

  // Cart state
  cart: [],
  serviceChargePercentage: 10,
  addTransactionFee: false,

  // Enhanced cart state
  templates: [],
  recentTemplates: [],
  splitBillConfig: null,
  cartHistory: [],
  historyIndex: -1,
  maxHistorySize: 20,
  selectedItemIds: [],
  isModificationModalOpen: false,
  isSplitBillModalOpen: false,
  isTemplateModalOpen: false,
  activeItemId: null,

  // User actions
  setUser: jest.fn(),
  logout: jest.fn(),
  setSession: jest.fn(),

  // Enhanced cart actions
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  updateCartItem: jest.fn(),
  clearCart: jest.fn(),
  cleanCart: jest.fn(),

  // New cart modification actions
  modifyCartItem: jest.fn(),
  setItemSpecialInstructions: jest.fn(),
  duplicateCartItem: jest.fn(),

  // Split bill actions
  initializeSplitBill: jest.fn(),
  assignItemToSplitGroup: jest.fn(),
  removeItemFromSplitGroup: jest.fn(),
  updateSplitGroup: jest.fn(),
  completeSplitPayment: jest.fn(),
  cancelSplitBill: jest.fn(),

  // Template actions
  saveCartAsTemplate: jest.fn(),
  loadTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  updateTemplateUsage: jest.fn(),

  // Bulk operations
  selectCartItem: jest.fn(),
  unselectCartItem: jest.fn(),
  selectAllItems: jest.fn(),
  unselectAllItems: jest.fn(),
  applyBulkDiscount: jest.fn(),
  removeBulkItems: jest.fn(),

  // History/Undo actions
  undoCartAction: jest.fn(),
  redoCartAction: jest.fn(),
  canUndo: jest.fn(() => false),
  canRedo: jest.fn(() => false),

  // Order actions
  setCurrentOrder: jest.fn(),

  // Service charge actions
  setServiceChargePercentage: jest.fn(),
  setAddTransactionFee: jest.fn(),

  // App state actions
  setOnlineStatus: jest.fn(),
  setLoading: jest.fn(),
  setError: jest.fn(),

  // Enhanced computed values
  cartTotal: jest.fn(() => 0),
  cartItemCount: jest.fn(() => 0),
  calculateServiceCharge: jest.fn(() => 0),
  calculateTransactionFee: jest.fn(() => 0),
  calculateOrderTotal: jest.fn(() => 0),
  getSelectedItems: jest.fn(() => []),
  getSplitGroupTotal: jest.fn(() => 0),

  // Migration helper
  migrateCartIfNeeded: jest.fn(),

  ...overrides,
});

// Create comprehensive mock auth store
export const createMockAuthStore = (overrides?: any) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  session: null,
  error: null,
  tokenRefreshListenerSetup: false,

  // Actions
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  checkAuth: jest.fn(),
  clearError: jest.fn(),
  hasFeature: jest.fn(() => false),
  requiresPlan: jest.fn(() => false),
  setupTokenListeners: jest.fn(),
  handleTokenRefresh: jest.fn(),

  ...overrides,
});

// Create comprehensive mock settings store
export const createMockSettingsStore = (overrides?: any) => ({
  // Business Settings
  businessInfo: {
    companyName: 'Test Restaurant',
    address: '123 Test Street',
    city: 'Test City',
    postalCode: 'T3ST P0ST',
    country: 'Test Country',
    phone: '+44 123 456 7890',
    email: 'test@restaurant.com',
    website: 'www.testrestaurant.com',
    vatNumber: 'GB123456789',
    companyNumber: '12345678',
  },
  taxConfiguration: {
    vatEnabled: true,
    vatRate: 20,
    vatInclusive: true,
    taxExemptItems: [],
    serviceTaxRate: 12.5,
    serviceTaxEnabled: true,
  },
  paymentMethods: {
    qrCode: {
      enabled: true,
      feePercentage: 1.2,
      requiresAuth: false,
      tipEnabled: false,
    },
    cash: {
      enabled: true,
      feePercentage: 0,
      requiresAuth: false,
      tipEnabled: false,
    },
    card: {
      enabled: true,
      feePercentage: 2.9,
      requiresAuth: false,
      tipEnabled: true,
    },
    applePay: {
      enabled: true,
      feePercentage: 2.9,
      requiresAuth: false,
      tipEnabled: true,
    },
    googlePay: {
      enabled: false,
      feePercentage: 2.9,
      requiresAuth: false,
      tipEnabled: true,
    },
  },
  receiptSettings: {
    showLogo: true,
    logoUrl: '',
    headerText: 'Thank you for dining with us!',
    footerText: 'Visit us again soon!',
    showVatNumber: true,
    showQrCode: true,
    emailReceipts: true,
    printReceipts: true,
    receiptFormat: 'thermal' as const,
  },
  operatingHours: {
    monday: { open: '09:00', close: '22:00', closed: false },
    tuesday: { open: '09:00', close: '22:00', closed: false },
    wednesday: { open: '09:00', close: '22:00', closed: false },
    thursday: { open: '09:00', close: '22:00', closed: false },
    friday: { open: '09:00', close: '23:00', closed: false },
    saturday: { open: '09:00', close: '23:00', closed: false },
    sunday: { open: '10:00', close: '21:00', closed: false },
    holidays: [],
  },

  // Hardware Configuration
  printerSettings: {
    receiptPrinter: {
      enabled: false,
      name: '',
      ipAddress: '',
      port: 9100,
      paperWidth: 80,
    },
    kitchenPrinter: {
      enabled: false,
      name: '',
      ipAddress: '',
      port: 9100,
      paperWidth: 80,
    },
  },
  cashDrawerSettings: {
    enabled: false,
    kickOnSale: true,
    kickOnRefund: false,
    requirePin: false,
    openDelay: 500,
  },
  scannerSettings: {
    enabled: false,
    soundEnabled: true,
    vibrationEnabled: true,
    continuousMode: false,
    scanningFormats: ['EAN13', 'CODE128', 'QR_CODE'],
  },
  cardReaderSettings: {
    enabled: false,
    terminalId: '',
    merchantId: '',
    contactless: true,
    chipAndPin: true,
    magneticStripe: false,
    tipPrompt: true,
  },

  // User Preferences
  userProfile: {
    name: 'Test User',
    email: 'test@restaurant.com',
    pin: '',
    role: 'admin' as const,
    permissions: ['all'],
  },
  notificationSettings: {
    soundEnabled: true,
    vibrationEnabled: true,
    orderAlerts: true,
    lowStockAlerts: true,
    endOfDayReminders: true,
    emailNotifications: false,
  },
  themeSettings: {
    mode: 'light' as const,
    primaryColor: '#00A651',
    fontSize: 'medium' as const,
    highContrast: false,
  },
  localizationSettings: {
    language: 'en-GB',
    region: 'GB',
    currency: 'GBP',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h' as const,
    numberFormat: '1,234.56',
  },
  accessibilitySettings: {
    screenReader: false,
    largeText: false,
    highContrast: false,
    reducedMotion: false,
    voiceGuidance: false,
  },

  // App Configuration
  menuSettings: {
    categoriesEnabled: true,
    modifiersEnabled: true,
    nutritionInfo: false,
    allergenInfo: true,
    itemImages: true,
    quickAdd: true,
  },
  pricingSettings: {
    dynamicPricing: false,
    discountCodes: true,
    loyaltyProgram: true,
    happyHour: false,
    bulkDiscounts: false,
    staffDiscounts: true,
  },
  backupSettings: {
    autoBackup: true,
    backupFrequency: 'daily' as const,
    cloudSync: true,
    retentionDays: 30,
    encryptionEnabled: true,
  },

  // Loading states
  isLoading: false,
  error: null,

  // Actions
  updateBusinessInfo: jest.fn(),
  updateTaxConfiguration: jest.fn(),
  updatePaymentMethods: jest.fn(),
  updateReceiptSettings: jest.fn(),
  updateOperatingHours: jest.fn(),
  updatePrinterSettings: jest.fn(),
  updateCashDrawerSettings: jest.fn(),
  updateScannerSettings: jest.fn(),
  updateCardReaderSettings: jest.fn(),
  updateUserProfile: jest.fn(),
  updateNotificationSettings: jest.fn(),
  updateThemeSettings: jest.fn(),
  updateLocalizationSettings: jest.fn(),
  updateAccessibilitySettings: jest.fn(),
  updateMenuSettings: jest.fn(),
  updatePricingSettings: jest.fn(),
  updateBackupSettings: jest.fn(),
  resetSettings: jest.fn(),
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
  initializeStore: jest.fn(),
  updatePaymentMethod: jest.fn(),

  ...overrides,
});

// Create basic mock cart store (for backward compatibility)
export const createMockCartStore = (overrides?: any) => {
  const enhancedStore = createMockEnhancedCartStore(overrides);

  // Return a simplified version for components that don't need enhanced features
  return {
    cart: enhancedStore.cart,
    addToCart: enhancedStore.addToCart,
    removeFromCart: enhancedStore.removeFromCart,
    updateCartItem: enhancedStore.updateCartItem,
    clearCart: enhancedStore.clearCart,
    cartTotal: enhancedStore.cartTotal,
    cartItemCount: enhancedStore.cartItemCount,
    ...overrides,
  };
};

// Create mock UI store
export const createMockUIStore = (overrides?: any) => ({
  // Loading states
  isLoading: false,
  loadingMessage: '',
  setLoading: jest.fn(),

  // Error states
  error: null,
  errorDetails: null,
  setError: jest.fn(),
  clearError: jest.fn(),

  // Modal states
  activeModal: null,
  modalProps: {},
  showModal: jest.fn(),
  hideModal: jest.fn(),

  // Navigation states
  currentRoute: 'POS',
  navigationHistory: [],
  setCurrentRoute: jest.fn(),

  // UI preferences
  selectedCategory: 'All',
  setSelectedCategory: jest.fn(),
  showOfflineIndicator: false,
  setShowOfflineIndicator: jest.fn(),

  // Theme
  theme: 'light',
  setTheme: jest.fn(),
  toggleTheme: jest.fn(),

  ...overrides,
});

// Create mock app store (combines features from different stores)
export const createMockAppStore = (overrides?: any) => ({
  ...createMockEnhancedCartStore(),
  ...createMockUIStore(),

  // Additional app-wide state
  menuItems: [],
  setMenuItems: jest.fn(),
  orders: [],
  setOrders: jest.fn(),

  ...overrides,
});

// Export mock store instances for direct use
export const mockEnhancedCartStore = createMockEnhancedCartStore();
export const mockAuthStore = createMockAuthStore();
export const mockSettingsStore = createMockSettingsStore();
export const mockCartStore = createMockCartStore();
export const mockUIStore = createMockUIStore();
export const mockAppStore = createMockAppStore();

// Helper to create authenticated mock stores
export const createAuthenticatedMocks = (userOverrides?: Partial<User>) => {
  const user = createMockUser(userOverrides);

  return {
    authStore: createMockAuthStore({
      user,
      isAuthenticated: true,
      session: { access_token: 'test-token', refresh_token: 'test-refresh' },
      hasFeature: jest.fn((feature: string) => true),
      requiresPlan: jest.fn(() => true),
    }),
    cartStore: createMockEnhancedCartStore({ user }),
    settingsStore: createMockSettingsStore(),
  };
};

// Helper to create mock stores with test data
export const createMockStoresWithData = () => {
  const cartItems = [
    createMockEnhancedOrderItem({ id: '1', name: 'Burger', price: 12.99, emoji: '🍔' }),
    createMockEnhancedOrderItem({ id: '2', name: 'Fries', price: 4.99, emoji: '🍟' }),
  ];

  return {
    authStore: createMockAuthStore({
      user: createMockUser(),
      isAuthenticated: true,
    }),
    cartStore: createMockEnhancedCartStore({
      cart: cartItems,
      cartTotal: jest.fn(() => 17.98),
      cartItemCount: jest.fn(() => 2),
    }),
    settingsStore: createMockSettingsStore(),
  };
};
