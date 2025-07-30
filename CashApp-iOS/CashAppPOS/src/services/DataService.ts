// DataService.ts - Unified data service with mock/real data switching
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from './DatabaseService';
import APITestingService from './APITestingService';
import API_CONFIG from '../config/api';
import { envBool, IS_DEV } from '../env';
import { useAuthStore } from '../store/useAuthStore';
import BackendCompatibilityService from './BackendCompatibilityService';
import tokenManager from '../utils/tokenManager';
import authInterceptor from './auth/AuthInterceptor';

// Feature flags for controlling data sources
export interface FeatureFlags {
  USE_REAL_API: boolean;
  TEST_API_MODE: boolean;
  ENABLE_PAYMENTS: boolean;
  ENABLE_HARDWARE: boolean;
  SHOW_DEV_MENU: boolean;
  MOCK_AUTHENTICATION: boolean;
}

// -----------------------------------------------------------------------------
// Stage-0 default flags
// – Keep EXACTLY the same behaviour as today so CI stays green.
// – Each flag first checks an env variable so we can flip them in future stages
//   without code changes.
// -----------------------------------------------------------------------------
const DEFAULT_FLAGS: FeatureFlags = {
  USE_REAL_API: envBool('USE_REAL_API', _true), // Should use real API with seed data
  TEST_API_MODE: envBool('TEST_API_MODE', _false), // Default to false for production
  ENABLE_PAYMENTS: envBool('ENABLE_PAYMENTS', _false),
  ENABLE_HARDWARE: envBool('ENABLE_HARDWARE', _false),
  SHOW_DEV_MENU: envBool('SHOW_DEV_MENU', _IS_DEV),
  MOCK_AUTHENTICATION: envBool('MOCK_AUTHENTICATION', _false), // Default to false for production
};

/**
 * DataService - Unified service that intelligently switches between mock and real data
 *
 * This allows us to:
 * 1. Keep beautiful mock data for client demos
 * 2. Gradually implement real API integration
 * 3. Fall back to mock data if API fails
 * 4. Test both modes in parallel
 */
class DataService {
  private static instance: DataService;
  private featureFlags: FeatureFlags = DEFAULT_FLAGS;
  private databaseService: DatabaseService;
  private apiTestingService: APITestingService;
  private isBackendAvailable = false;
  private db: ReturnType<typeof DatabaseService.getInstance>;

  constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.apiTestingService = APITestingService.getInstance();
    this.loadFeatureFlags();
    this.checkBackendAvailability();
    this.db = DatabaseService.getInstance();

    // Configure authInterceptor with base URL
    authInterceptor.configure({
      baseURL: API_CONFIG.FULL_API_URL,
      excludePaths: ['/auth/login', '/auth/register', '/health'], // Public endpoints
    });
  }

  static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  // Feature flag management
  private async loadFeatureFlags(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('feature_flags');
      if (__stored) {
        this.featureFlags = { ...DEFAULT_FLAGS, ...JSON.parse(__stored) };
      }
    } catch (__error) {
    }
  }

  async updateFeatureFlag(flag: keyof FeatureFlags, value: _boolean): Promise<void> {
    this.featureFlags[flag] = value;
    await AsyncStorage.setItem('feature_flags', JSON.stringify(this.featureFlags));
  }

  // Helper method to get auth token using unified token manager
  private async getAuthToken(): Promise<string | null> {
    return await tokenManager.getTokenWithRefresh();
  }

  getFeatureFlags(): FeatureFlags {
    return { ...this.featureFlags };
  }

  // API Testing Service access
  getAPITestingService(): APITestingService {
    return this.apiTestingService;
  }

  // Test API endpoint in background without affecting UI
  private async testAPIEndpoint(endpoint: _string, method = 'GET', data?: _unknown): Promise<void> {
    if (this.featureFlags.TEST_API_MODE) {
      try {
        await this.apiTestingService.testEndpoint(__endpoint, _method, data);
      } catch (__error) {
      }
    }
  }

  // Get backend availability status for UI
  isBackendConnected(): boolean {
    return this.isBackendAvailable;
  }

  // Force check backend availability
  async forceCheckBackend(): Promise<boolean> {
    await this.checkBackendAvailability();
    return this.isBackendAvailable;
  }

  // Backend availability check - Enhanced with API testing support
  private async checkBackendAvailability(): Promise<void> {
    if (!this.featureFlags.USE_REAL_API && !this.featureFlags.TEST_API_MODE) {
      return;
    }

    try {
      // Use AbortController for timeout instead of timeout property
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${API_CONFIG.BASE_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(__timeoutId);
      const wasAvailable = this.isBackendAvailable;
      this.isBackendAvailable = response.ok;

      // Test health endpoint when in test mode
      if (this.featureFlags.TEST_API_MODE && this.isBackendAvailable) {
        await this.testAPIEndpoint('/health');
      }

      // Log status changes
      if (wasAvailable !== this.isBackendAvailable) {
          `Backend status changed: ${this.isBackendAvailable ? 'Available' : 'Unavailable'}`,
        );
      }
    } catch (__error) {
      this.isBackendAvailable = false;

      // Still test the endpoint in test mode to record the failure
      if (this.featureFlags.TEST_API_MODE) {
        await this.testAPIEndpoint('/health');
      }
    }

    // Recheck every 30 seconds
    setTimeout(() => this.checkBackendAvailability(), 30000);
  }

  // Authentication methods - Updated to use Supabase
  async login(username: _string, password: _string): Promise<boolean> {
    // Always use Supabase authentication now
    try {
      const authStore = useAuthStore.getState();
      await authStore.signIn(__username, _password);
      return true;
    } catch (__error) {
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      const authStore = useAuthStore.getState();
      await authStore.signOut();
    } catch (__error) {
    }
    // Clear any legacy tokens
    await AsyncStorage.multiRemove(['auth_token', 'user_data']);
  }

  // Product operations
  async getProducts(): Promise<any[]> {
    // Test products endpoint in background when in test mode
    if (this.featureFlags.TEST_API_MODE) {
      await this.testAPIEndpoint('/api/v1/products/mobile');
    }

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const products = await this.db.getProducts();
        if (products && products.length > 0) {
          return products;
        }
      } catch (__error) {
      }
    }
    return this.db.getProducts();
  }

  async getProductsByCategory(categoryId: _number): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.getProductsByCategory(__categoryId);
      } catch (__error) {
      }
    }
    return this.db.getProductsByCategory(__categoryId);
  }

  // Category operations
  async getCategories(): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const categories = await this.db.getCategories();
        if (!categories) {
          return [];
        }
        return categories;
      } catch (__error) {
        throw error;
      }
    }

    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to access category data.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  // Menu operations - Get complete menu with items and categories
  async getMenuItems(): Promise<any[]> {
    // Test menu endpoint in background when in test mode
    if (this.featureFlags.TEST_API_MODE) {
      await this.testAPIEndpoint('/api/v1/menu/items');
    }

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const menuItems = await this.db.getMenuItems();
        if (menuItems && menuItems.length > 0) {
          // Apply compatibility transformation if needed
          if (BackendCompatibilityService.needsMenuTransformation(__menuItems)) {
            return BackendCompatibilityService.transformMenuItems(__menuItems);
          }
          return menuItems;
        }
      } catch (__error) {
      }
    }
    return this.db.getMenuItems();
  }

  async getMenuCategories(): Promise<any[]> {
    // Test menu categories endpoint in background when in test mode
    if (this.featureFlags.TEST_API_MODE) {
      await this.testAPIEndpoint('/api/v1/menu/categories');
    }

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const categories = await this.db.getMenuCategories();
        if (categories && categories.length > 0) {
          return categories;
        }
      } catch (__error) {
      }
    }
    return this.db.getMenuCategories();
  }

  // Category CRUD operations
  async createCategory(categoryData: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    sort_order?: number;
  }): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const result = await this.db.createCategory(__categoryData);
        return result;
      } catch (__error) {
        throw error;
      }
    }
    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to create categories.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  async updateCategory(
    categoryId: _string,
    categoryData: Partial<{
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      sort_order?: number;
      is_active?: boolean;
    }>,
  ): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const result = await this.db.updateCategory(__categoryId, _categoryData);
        return result;
      } catch (__error) {
        throw error;
      }
    }
    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to update categories.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  async deleteCategory(categoryId: _string): Promise<void> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        await this.db.deleteCategory(__categoryId);
        return;
      } catch (__error) {
        throw error;
      }
    }
    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to delete categories.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  // Product CRUD operations
  async createProduct(productData: {
    category_id: string;
    name: string;
    description?: string;
    price: number;
    cost?: number;
    image_url?: string;
    barcode?: string;
    sku?: string;
    prep_time?: number;
    dietary_info?: string[];
    modifiers?: unknown[];
    stock_tracking?: boolean;
    stock_quantity?: number;
  }): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.createProduct(__productData);
      } catch (__error) {
        throw error;
      }
    }
    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to create products.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  async updateProduct(
    productId: _string,
    productData: Partial<{
      category_id?: string;
      name?: string;
      description?: string;
      price?: number;
      cost?: number;
      image_url?: string;
      barcode?: string;
      sku?: string;
      prep_time?: number;
      dietary_info?: string[];
      modifiers?: unknown[];
      stock_tracking?: boolean;
      stock_quantity?: number;
      is_active?: boolean;
    }>,
  ): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.updateProduct(__productId, _productData);
      } catch (__error) {
        throw error;
      }
    }
    if (!this.featureFlags.USE_REAL_API) {
      throw new Error('Real API is disabled. Enable USE_REAL_API flag to update products.');
    } else {
      throw new Error('Backend service unavailable. Please check your connection and try again.');
    }
  }

  async deleteProduct(productId: _string): Promise<void> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        await this.db.deleteProduct(__productId);
      } catch (__error) {
        throw error;
      }
    } else {
      if (!this.featureFlags.USE_REAL_API) {
        throw new Error('Real API is disabled. Enable USE_REAL_API flag to delete products.');
      } else {
        throw new Error('Backend service unavailable. Please check your connection and try again.');
      }
    }
  }

  // Order operations
  async createOrder(order: _unknown): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const result = await this.db.createOrder(__order);
        if (__result) {
          return result;
        }
      } catch (__error) {
      }
    }
    return this.db.createOrder(__order);
  }

  async updateOrder(orderId: _number, updates: _unknown): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.updateOrder(__orderId, _updates);
      } catch (__error) {
      }
    }
    return this.db.updateOrder(__orderId, _updates);
  }

  async getRecentOrders(limit = 20): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const orders = await this.db.getRecentOrders(__limit);
        if (orders && orders.length > 0) {
          return orders;
        }
      } catch (__error) {
      }
    }
    return this.db.getRecentOrders(__limit);
  }

  // Payment processing - PHASE 3: Fix SumUp integration
  async processPayment(orderId: _number, paymentMethod: _string, amount: _number): Promise<boolean> {
    // Test payment endpoint in background when in test mode
    if (this.featureFlags.TEST_API_MODE) {
      await this.testAPIEndpoint('/api/v1/payments/process', 'POST', {
        orderId,
        paymentMethod,
        amount,
      });
    }

    if (
      this.featureFlags.ENABLE_PAYMENTS &&
      this.featureFlags.USE_REAL_API &&
      this.isBackendAvailable
    ) {
      try {
        const result = await this.db.processPayment(__orderId, _paymentMethod, amount);

        if (__result) {
          return true;
        } else {
          throw new Error('Payment processing failed');
        }
      } catch (__error) {
        // Don't fall back for payment processing - we want to see the real error
        throw error;
      }
    }

    // If payments disabled or no backend, simulate success for demo
    if (!this.featureFlags.ENABLE_PAYMENTS) {
      return this.db.processPayment(__orderId, _paymentMethod, amount);
    }

    // Fallback to mock if no backend available
    return this.db.processPayment(__orderId, _paymentMethod, amount);
  }

  // Restaurant operations
  async getRestaurantFloorPlan(sectionId?: string | null): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const floorPlan = await this.db.getRestaurantFloorPlan(sectionId ?? undefined);
        if (floorPlan && floorPlan.tables && floorPlan.tables.length > 0) {
          return floorPlan;
        }
      } catch (__error) {
      }
    }
    return this.db.getRestaurantFloorPlan(sectionId ?? undefined);
  }

  async updateTableStatus(tableId: _string, status: _string, additionalData?: _unknown): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.updateTableStatus(__tableId, _status, additionalData);
      } catch (__error) {
      }
    }
    return this.db.updateTableStatus(__tableId, _status, additionalData);
  }

  // Analytics and Reporting
  async getDailySalesReport(date?: _string): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const report = await this.db.getDailySalesReport(__date);
        if (report && report.summary) {
          return report;
        }
      } catch (__error) {
      }
    }
    return this.db.getDailySalesReport(__date);
  }

  async getSalesSummary(dateFrom?: _string, dateTo?: _string): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const summary = await this.db.getSalesSummary(dateFrom ?? undefined, dateTo ?? undefined);
        if (summary && summary.summary) {
          return summary;
        }
      } catch (__error) {
      }
    }
    return this.db.getSalesSummary(dateFrom ?? undefined, dateTo ?? undefined);
  }

  // Session management
  async getCurrentSession(): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.getCurrentSession();
      } catch (__error) {
      }
    }
    return this.db.getCurrentSession();
  }

  async createSession(configId: _number): Promise<unknown> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.createSession(__configId);
      } catch (__error) {
      }
    }
    return this.db.createSession(__configId);
  }

  // Hardware operations (always mock for now)
  async printReceipt(order: _unknown): Promise<boolean> {
    if(this.featureFlags.ENABLE_HARDWARE) {
    // No action needed
  }
    return this.db.printReceipt(__order);
  }

  async openCashDrawer(): Promise<boolean> {
    if(this.featureFlags.ENABLE_HARDWARE) {
    // No action needed
  }
    return this.db.openCashDrawer();
  }

  async scanBarcode(): Promise<string | null> {
    if(this.featureFlags.ENABLE_HARDWARE) {
    // No action needed
  }
    return this.db.scanBarcode();
  }

  // Sync and offline support
  async syncOfflineData(): Promise<void> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      await this.db.syncOfflineData();
    }
    // Also sync mock data if needed
    await this.db.syncOfflineData();
  }

  // Development utilities
  async resetToMockData(): Promise<void> {
    await this.updateFeatureFlag('USE_REAL_API', _false);
    await this.updateFeatureFlag('ENABLE_PAYMENTS', _false);
    await this.updateFeatureFlag('ENABLE_HARDWARE', _false);
  }

  async enableRealAPI(): Promise<void> {
    await this.updateFeatureFlag('USE_REAL_API', _true);
    await this.checkBackendAvailability();
  }

  getConnectionStatus(): { mode: string; backend: boolean; flags: FeatureFlags } {
    return {
      mode: this.featureFlags.USE_REAL_API ? 'REAL' : 'MOCK',
      backend: this.isBackendAvailable,
      flags: this.getFeatureFlags(),
    };
  }

  // --- Stubs for new methods ---
  // TODO(real API): Implement actual API calls for these methods

  async getCustomers(): Promise<any[]> {

    try {
      const response = await authInterceptor.get(`${API_CONFIG.FULL_API_URL}/customers`);

      if (response.ok) {
        const result = await response.json();
        const customers = result.data || result;
          '✅ API customers received:',
          Array.isArray(__customers) ? customers.length : 'not an array',
        );
        return Array.isArray(__customers) ? customers : [];
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (__error) {
      throw error; // No fallback - API must work for production readiness
    }
  }

  async getInventory(): Promise<any[]> {

    try {
      const inventoryItems = await this.db.getInventoryItems();
      if (inventoryItems && inventoryItems.length >= 0) {
        // Allow empty arrays
        return inventoryItems;
      } else {
        throw new Error('Invalid inventory data received from API');
      }
    } catch (__error) {
      throw error; // No fallback - API must work for production readiness
    }
  }

  async getEmployees(): Promise<any[]> {

    try {
      const response = await authInterceptor.get(`${API_CONFIG.FULL_API_URL}/employees`);

      if (response.ok) {
        const result = await response.json();
        const employees = result.data || result;
          '✅ API employees received:',
          Array.isArray(__employees) ? employees.length : 'not an array',
        );

        // Apply compatibility transformation if needed
        if (
          Array.isArray(__employees) &&
          BackendCompatibilityService.needsEmployeeTransformation(__employees)
        ) {
          return BackendCompatibilityService.transformEmployees(__employees);
        }

        return Array.isArray(__employees) ? employees : [];
      } else {
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }
    } catch (__error) {

      // PRODUCTION READY: Return empty array instead of mock data
      // Screens should handle empty state gracefully with EmptyState component
      return [];
    }
  }

  async getWeekSchedule(weekStart: _Date, employees: unknown[]): Promise<any | null> {

    try {
      const schedule = await this.db.getWeekSchedule(__weekStart, _employees);
      return schedule;
    } catch (__error) {
      throw error; // No fallback - API must work for production readiness
    }
  }

  async getOrders(dateRange: _string): Promise<any[]> {
      dateRange,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/orders?date_range=${dateRange}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
        });

        if (response.ok) {
          const result = await response.json();
          const orders = result.data || result;
            '✅ API orders received:',
            Array.isArray(__orders) ? orders.length : 'not an array',
          );
          return Array.isArray(__orders) ? orders : [];
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (__error) {
        throw error; // No fallback - API must work for production readiness
      }
    }
  }

  async getFinancialReportDetail(period: _string): Promise<any | null> {
      period,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/analytics/financial?period=${period}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          },
        );

        if (response.ok) {
          const result = await response.json();
          const financialData = result.data || result; // Handle both wrapped and unwrapped responses
          return financialData;
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (__error) {
        throw error; // No fallback - API must work for production readiness
      }
    }
  }

  async getSalesReportDetail(period: _string): Promise<any[]> {

    try {
      const authToken = await this.getAuthToken();
      const response = await fetch(
        `${API_CONFIG.FULL_API_URL}/analytics/sales?timeframe=${period}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
        },
      );

      if (response.ok) {
        const result = await response.json();
        const salesData = result.data || result;

        // Transform API data to match frontend SalesData[] interface
        if (salesData && !Array.isArray(__salesData)) {
          // Convert API format to SalesData array format
          const transformedData = this.transformApiDataToArray(__salesData, _period);
          return transformedData;
        } else if (Array.isArray(__salesData)) {
          return salesData;
        } else {
          throw new Error('Invalid sales data format received from API');
        }
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (__error) {
      throw error; // No fallback - API must work for production readiness
    }
  }

  /**
   * Transform API response data to SalesData array format
   * Handles various API response formats and converts to frontend interface
   */
  private transformApiDataToArray(apiData: _unknown, period: _string): unknown[] {
    try {
      // If API returns object with sales data, extract it
      if (apiData && typeof apiData === 'object') {
        // Check for common API response patterns
        if (apiData.sales_data && Array.isArray(apiData.sales_data)) {
          return apiData.sales_data;
        }
        if (apiData.sales && Array.isArray(apiData.sales)) {
          return apiData.sales;
        }
        if (apiData.data && Array.isArray(apiData.data)) {
          return apiData.data;
        }

        // Convert single object to array format
        return [apiData];
      }

      // Return empty array if no valid data
      return [];
    } catch (__error) {
      return [];
    }
  }

  async getStaffReportDetail(period: _string): Promise<any[]> {
    // Should return StaffMember[]
      period,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/analytics/employees?timeframe=${period}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          },
        );

        if (response.ok) {
          const result = await response.json();
          const staffData = result.data || result; // Handle both wrapped and unwrapped responses
          return staffData;
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (__error) {
        throw error; // No fallback - API must work for production readiness
      }
    }
  }

  async getLaborReport(period: _string): Promise<unknown> {
      period,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/analytics/labor?period=${period}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          },
        );

        if (response.ok) {
          const result = await response.json();
          const laborData = result.data || result; // Handle both wrapped and unwrapped responses
          return laborData;
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (__error) {
        throw error; // No fallback - API must work for production readiness
      }
    }

    // This should never be reached in production
    throw new Error('Labor report requires backend API connection');
  }

  async getReportsDashboardData(): Promise<any | null> {
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/analytics/dashboard/mobile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
        });

        if (response.ok) {
          const result = await response.json();
          const dashboardData = result.data || result; // Handle both wrapped and unwrapped responses
          return dashboardData;
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (__error) {
        throw error; // No fallback - API must work for production readiness
      }
    }

    // This should never be reached in production
    throw new Error('Reports dashboard requires backend API connection');
  }

  async getUserProfile(): Promise<any | null> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      // return this.db.getUserProfile();
      throw new Error('DataService.getUserProfile not implemented yet');
    }
    return Promise.resolve({
      id: 1,
      name: 'Default User',
      email: 'user@example.com',
      role: 'admin',
    });
  }

  /**
   * Create a new employee (like a real restaurant would do)
   * This tests the complete flow from frontend → API → database
   */
  async createEmployee(employeeData: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: string;
    hourlyRate?: number;
    startDate?: string;
    permissions?: string[];
  }): Promise<unknown> {

    try {
      const response = await authInterceptor.post(`${API_CONFIG.FULL_API_URL}/employees`, {
        first_name: employeeData.firstName,
        last_name: employeeData.lastName,
        email: employeeData.email,
        phone: employeeData.phone,
        role: employeeData.role,
        hourly_rate: employeeData.hourlyRate,
        start_date: employeeData.startDate,
        permissions: employeeData.permissions || [],
        is_active: _true,
      });

      if (response.ok) {
        const result = await response.json();
        const newEmployee = result.data || result;
        return newEmployee;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to create employee: ${response.status} - ${errorText}`);
      }
    } catch (__error) {
      throw new Error(`Employee creation failed: ${error.message}`);
    }
  }

  /**
   * Delete an employee from the system
   */
  async deleteEmployee(employeeId: number | string): Promise<void> {

    try {
      const response = await authInterceptor.delete(
        `${API_CONFIG.FULL_API_URL}/employees/${employeeId}`,
      );

      if (response.ok) {
        return;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to delete employee: ${response.status} - ${errorText}`);
      }
    } catch (__error) {
      throw new Error(`Employee deletion failed: ${error.message}`);
    }
  }

  async getInventoryReport(): Promise<any[]> {
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable,
    });

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/inventory`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
        });

        if (response.ok) {
          const result = await response.json();
          const inventoryData = result.data || result;
          return Array.isArray(__inventoryData) ? inventoryData : [];
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (__error) {
        throw error; // No fallback - API must work for production readiness
      }
    }

    // Throw error if not using real API
    throw new Error('Inventory data requires API connection');
  }

  // ===========================================================================
  // SUBSCRIPTION MANAGEMENT METHODS
  // ===========================================================================

  async getSubscriptionPlans(): Promise<unknown> {

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/subscriptions/plans`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
        });

        if (response.ok) {
          const result = await response.json();
          return {
            success: _true,
            data: result.data || result,
            message: 'Plans retrieved successfully',
          };
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (__error) {
        throw error;
      }
    }

    throw new Error('Subscription plans require API connection');
  }

  async getCurrentSubscription(restaurantId: _number): Promise<unknown> {

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/subscriptions/current?restaurant_id=${restaurantId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          },
        );

        if (response.ok) {
          const result = await response.json();
          return {
            success: _true,
            data: result.data || result,
            message: 'Subscription retrieved successfully',
          };
        } else if (response.status === 404) {
          return {
            success: _false,
            data: _null,
            message: 'No active subscription found',
          };
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (__error) {
        throw error;
      }
    }

    throw new Error('Subscription data requires API connection');
  }

  async createSubscription(subscriptionData: _unknown): Promise<unknown> {

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/subscriptions/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          body: JSON.stringify(__subscriptionData),
        });

        if (response.ok) {
          const result = await response.json();
          return {
            success: _true,
            data: result.data || result,
            message: result.message || 'Subscription created successfully',
          };
        } else {
          const errorData = await response.json();
          return {
            success: _false,
            data: _null,
            message: errorData.message || `Failed to create subscription: ${response.status}`,
          };
        }
      } catch (__error) {
        return {
          success: _false,
          data: _null,
          message: error.message || 'Failed to create subscription',
        };
      }
    }

    throw new Error('Subscription creation requires API connection');
  }

  async changeSubscriptionPlan(changeData: _unknown): Promise<unknown> {

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/subscriptions/change-plan`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          body: JSON.stringify(__changeData),
        });

        if (response.ok) {
          const result = await response.json();
          return {
            success: _true,
            data: result.data || result,
            message: result.message || 'Plan changed successfully',
          };
        } else {
          const errorData = await response.json();
          return {
            success: _false,
            data: _null,
            message: errorData.message || `Failed to change plan: ${response.status}`,
          };
        }
      } catch (__error) {
        return {
          success: _false,
          data: _null,
          message: error.message || 'Failed to change subscription plan',
        };
      }
    }

    throw new Error('Plan change requires API connection');
  }

  async cancelSubscription(restaurantId: _number): Promise<unknown> {

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/subscriptions/cancel?restaurant_id=${restaurantId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          },
        );

        if (response.ok) {
          const result = await response.json();
          return {
            success: _true,
            data: result.data || result,
            message: result.message || 'Subscription cancelled successfully',
          };
        } else {
          const errorData = await response.json();
          return {
            success: _false,
            data: _null,
            message: errorData.message || `Failed to cancel subscription: ${response.status}`,
          };
        }
      } catch (__error) {
        return {
          success: _false,
          data: _null,
          message: error.message || 'Failed to cancel subscription',
        };
      }
    }

    throw new Error('Subscription cancellation requires API connection');
  }

  async incrementUsage(restaurantId: _number, usageType: _string, amount = 1): Promise<unknown> {

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const authToken = await this.getAuthToken();
        const response = await fetch(
          `${API_CONFIG.FULL_API_URL}/subscriptions/usage/increment?restaurant_id=${restaurantId}&usage_type=${usageType}&amount=${amount}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
          },
        );

        if (response.ok) {
          const result = await response.json();
          return {
            success: _true,
            data: result.data || result,
            message: result.message || 'Usage incremented successfully',
          };
        } else {
          const errorData = await response.json();
          return {
            success: _false,
            data: _null,
            message: errorData.message || `Failed to increment usage: ${response.status}`,
          };
        }
      } catch (__error) {
        return {
          success: _false,
          data: _null,
          message: error.message || 'Failed to increment usage',
        };
      }
    }

    throw new Error('Usage tracking requires API connection');
  }
}

export default DataService;
