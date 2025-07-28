// CashApp-iOS/CashAppPOS/__mocks__/DataService.ts

// This is a manual mock for the DataService.
// Jest will automatically use this mock when jest.mock('../../services/DataService') is called in a test file.

// Import actual types if needed for mockResolvedValue typing, or use 'any' for simplicity here.
// For a real project, importing types would be better.
// import { CustomerData, EmployeeData, InventoryData, Order, SalesDataReportItem } from '../src/types';

const mockUser = {
  id: 1,
  name: 'Mock User',
  email: 'mock@example.com',
  role: 'admin',
  isActive: true,
};

const DataService = {
  getInstance: jest.fn().mockReturnThis(), // Mock getInstance to return the mock object itself

  // --- Methods from original DataService that might be called ---
  loadFeatureFlags: jest.fn().mockResolvedValue(undefined),
  updateFeatureFlag: jest.fn().mockResolvedValue(undefined),
  getFeatureFlags: jest.fn().mockReturnValue({
    USE_REAL_API: false, // Default to false in tests unless overridden
    TEST_API_MODE: false,
    ENABLE_PAYMENTS: false,
    ENABLE_HARDWARE: false,
    SHOW_DEV_MENU: true,
    MOCK_AUTHENTICATION: true, // Default to true in tests
  }),
  getAPITestingService: jest.fn().mockReturnValue({
    testEndpoint: jest.fn().mockResolvedValue({ success: true }),
    getHistory: jest.fn().mockReturnValue([]),
    clearHistory: jest.fn(),
  }),
  isBackendConnected: jest.fn().mockReturnValue(false), // Default to false in tests
  forceCheckBackend: jest.fn().mockResolvedValue(false),
  login: jest.fn().mockResolvedValue(true), // Or mock a specific user object
  logout: jest.fn().mockResolvedValue(undefined),

  // --- New methods added or assumed for refactored screens ---
  getProducts: jest.fn().mockResolvedValue([]), // Also used as getMenu
  getProductsByCategory: jest.fn().mockResolvedValue([]),
  getCategories: jest.fn().mockResolvedValue([]),
  createOrder: jest.fn().mockResolvedValue({ id: 'mock-order-123', total: 0, items: [] }),
  updateOrder: jest.fn().mockResolvedValue({ id: 'mock-order-123', total: 0, items: [] }),
  getRecentOrders: jest.fn().mockResolvedValue([]),
  processPayment: jest.fn().mockResolvedValue(true),
  getRestaurantFloorPlan: jest.fn().mockResolvedValue({ tables: [], sections: [] }),
  updateTableStatus: jest.fn().mockResolvedValue({ success: true }),
  getDailySalesReport: jest.fn().mockResolvedValue({ summary: {}, hourly_breakdown: [], payment_methods: [], top_products: [] }),
  getSalesSummary: jest.fn().mockResolvedValue({ summary: {}, order_types: {} }),
  getCurrentSession: jest.fn().mockResolvedValue(null),
  createSession: jest.fn().mockResolvedValue({ id: 'mock-session-456' }),
  printReceipt: jest.fn().mockResolvedValue(true),
  openCashDrawer: jest.fn().mockResolvedValue(true),
  scanBarcode: jest.fn().mockResolvedValue(null),
  syncOfflineData: jest.fn().mockResolvedValue(undefined),
  resetToMockData: jest.fn().mockResolvedValue(undefined),
  enableRealAPI: jest.fn().mockResolvedValue(undefined),
  getConnectionStatus: jest.fn().mockReturnValue({ mode: 'MOCK', backend: false, flags: {} }),

  // Specific methods for newly refactored screens
  getCustomers: jest.fn().mockResolvedValue([]),
  getInventory: jest.fn().mockResolvedValue([]),
  getEmployees: jest.fn().mockResolvedValue([]),
  getWeekSchedule: jest.fn().mockResolvedValue({ weekStart: new Date(), shifts: [] }),
  getOrders: jest.fn().mockResolvedValue([]), // Takes dateRange
  getFinancialReportDetail: jest.fn().mockResolvedValue(null), // Takes period
  getSalesReportDetail: jest.fn().mockResolvedValue([]), // Takes period, returns SalesData[]
  getStaffReportDetail: jest.fn().mockResolvedValue([]), // Takes period
  getReportsDashboardData: jest.fn().mockResolvedValue({ // Structure based on ReportsScreenSimple
    todaySummary: { totalSales: 0, transactions: 0, averageOrder: 0 },
    weeklyLabor: { totalActualHours: 0, totalLaborCost: 0, efficiency: 0 },
    topItemsToday: [],
    topPerformersToday: [],
  }),
  getUserProfile: jest.fn().mockResolvedValue(mockUser), // For dataPrefetcher
  // Add any other methods that might be called if not covered
};

export default DataService;
