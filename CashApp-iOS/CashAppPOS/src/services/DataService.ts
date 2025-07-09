// DataService.ts - Unified data service with mock/real data switching
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from './DatabaseService';
import APITestingService from './APITestingService';
import API_CONFIG from '../config/api';
import { envBool, IS_DEV } from '../env';
import { useAuthStore } from '../store/useAuthStore';

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
  USE_REAL_API: envBool('USE_REAL_API', true), // Should use real API with seed data
  TEST_API_MODE: envBool('TEST_API_MODE', false), // Default to false for production
  ENABLE_PAYMENTS: envBool('ENABLE_PAYMENTS', false),
  ENABLE_HARDWARE: envBool('ENABLE_HARDWARE', false),
  SHOW_DEV_MENU: envBool('SHOW_DEV_MENU', IS_DEV),
  MOCK_AUTHENTICATION: envBool('MOCK_AUTHENTICATION', false), // Default to false for production
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
  private isBackendAvailable: boolean = false;
  private db: ReturnType<typeof DatabaseService.getInstance>;

  constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.apiTestingService = APITestingService.getInstance();
    this.loadFeatureFlags();
    this.checkBackendAvailability();
    this.db = DatabaseService.getInstance();
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
      if (stored) {
        this.featureFlags = { ...DEFAULT_FLAGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.log('Using default feature flags');
    }
  }

  async updateFeatureFlag(flag: keyof FeatureFlags, value: boolean): Promise<void> {
    this.featureFlags[flag] = value;
    await AsyncStorage.setItem('feature_flags', JSON.stringify(this.featureFlags));
  }

  getFeatureFlags(): FeatureFlags {
    return { ...this.featureFlags };
  }

  // API Testing Service access
  getAPITestingService(): APITestingService {
    return this.apiTestingService;
  }

  // Test API endpoint in background without affecting UI
  private async testAPIEndpoint(endpoint: string, method: string = 'GET', data?: any): Promise<void> {
    if (this.featureFlags.TEST_API_MODE) {
      try {
        await this.apiTestingService.testEndpoint(endpoint, method, data);
      } catch (error) {
        console.log(`API test failed for ${endpoint}:`, error);
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
      
      clearTimeout(timeoutId);
      const wasAvailable = this.isBackendAvailable;
      this.isBackendAvailable = response.ok;
      
      // Test health endpoint when in test mode
      if (this.featureFlags.TEST_API_MODE && this.isBackendAvailable) {
        await this.testAPIEndpoint('/health');
      }
      
      // Log status changes
      if (wasAvailable !== this.isBackendAvailable) {
        console.log(`Backend status changed: ${this.isBackendAvailable ? 'Available' : 'Unavailable'}`);
      }
      
    } catch (error) {
      this.isBackendAvailable = false;
      console.log('Backend not available, using mock data');
      
      // Still test the endpoint in test mode to record the failure
      if (this.featureFlags.TEST_API_MODE) {
        await this.testAPIEndpoint('/health');
      }
    }

    // Recheck every 30 seconds
    setTimeout(() => this.checkBackendAvailability(), 30000);
  }

  // Authentication methods - Updated to use Supabase
  async login(username: string, password: string): Promise<boolean> {
    // Always use Supabase authentication now
    try {
      const authStore = useAuthStore.getState();
      await authStore.signIn(username, password);
      return true;
    } catch (error) {
      console.error('Supabase login failed:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      const authStore = useAuthStore.getState();
      await authStore.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
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
      } catch (error) {
        console.log('Failed to fetch products from API, using mock data');
      }
    }
    return this.db.getProducts();
  }

  async getProductsByCategory(categoryId: number): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.getProductsByCategory(categoryId);
      } catch (error) {
        console.log('Failed to fetch products by category, using mock data');
      }
    }
    return this.db.getProductsByCategory(categoryId);
  }

  // Category operations
  async getCategories(): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const categories = await this.db.getCategories();
        if (categories && categories.length > 0) {
          return categories;
        }
      } catch (error) {
        console.log('Failed to fetch categories from API, using mock data');
      }
    }
    return this.db.getCategories();
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
          return menuItems;
        }
      } catch (error) {
        console.log('Failed to fetch menu items from API, using mock data');
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
      } catch (error) {
        console.log('Failed to fetch menu categories from API, using mock data');
      }
    }
    return this.db.getMenuCategories();
  }

  // Order operations
  async createOrder(order: any): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const result = await this.db.createOrder(order);
        if (result) return result;
      } catch (error) {
        console.log('Failed to create order via API, using mock');
      }
    }
    return this.db.createOrder(order);
  }

  async updateOrder(orderId: number, updates: any): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.updateOrder(orderId, updates);
      } catch (error) {
        console.log('Failed to update order via API');
      }
    }
    return this.db.updateOrder(orderId, updates);
  }

  async getRecentOrders(limit: number = 20): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const orders = await this.db.getRecentOrders(limit);
        if (orders && orders.length > 0) {
          return orders;
        }
      } catch (error) {
        console.log('Failed to fetch orders from API, using mock data');
      }
    }
    return this.db.getRecentOrders(limit);
  }

  // Payment processing - PHASE 3: Fix SumUp integration
  async processPayment(orderId: number, paymentMethod: string, amount: number): Promise<boolean> {
    // Test payment endpoint in background when in test mode
    if (this.featureFlags.TEST_API_MODE) {
      await this.testAPIEndpoint('/api/v1/payments/process', 'POST', { 
        orderId, 
        paymentMethod, 
        amount 
      });
    }

    if (this.featureFlags.ENABLE_PAYMENTS && this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        console.log(`Processing real payment: ${paymentMethod} for £${amount} (Order: ${orderId})`);
        const result = await this.db.processPayment(orderId, paymentMethod, amount);
        
        if (result) {
          console.log('✅ Real payment processed successfully');
          return true;
        } else {
          console.log('❌ Real payment failed - no result returned');
          throw new Error('Payment processing failed');
        }
      } catch (error) {
        console.log('❌ Real payment failed, falling back to mock:', error);
        // Don't fall back for payment processing - we want to see the real error
        throw error;
      }
    }

    // If payments disabled or no backend, simulate success for demo
    if (!this.featureFlags.ENABLE_PAYMENTS) {
      console.log(`🎭 Demo mode payment: ${paymentMethod} for £${amount}`);
      return this.db.processPayment(orderId, paymentMethod, amount);
    }
    
    // Fallback to mock if no backend available
    console.log(`⚠️  No backend available, using mock payment: ${paymentMethod} for £${amount}`);
    return this.db.processPayment(orderId, paymentMethod, amount);
  }

  // Restaurant operations
  async getRestaurantFloorPlan(sectionId?: string | null): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const floorPlan = await this.db.getRestaurantFloorPlan(sectionId ?? undefined);
        if (floorPlan && floorPlan.tables && floorPlan.tables.length > 0) {
          return floorPlan;
        }
      } catch (error) {
        console.log('Failed to fetch floor plan from API, using mock data');
      }
    }
    return this.db.getRestaurantFloorPlan(sectionId ?? undefined);
  }

  async updateTableStatus(tableId: string, status: string, additionalData?: any): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.updateTableStatus(tableId, status, additionalData);
      } catch (error) {
        console.log('Failed to update table status via API');
      }
    }
    return this.db.updateTableStatus(tableId, status, additionalData);
  }

  // Analytics and Reporting
  async getDailySalesReport(date?: string): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const report = await this.db.getDailySalesReport(date);
        if (report && report.summary) {
          return report;
        }
      } catch (error) {
        console.log('Failed to fetch daily report from API, using mock data');
      }
    }
    return this.db.getDailySalesReport(date);
  }

  async getSalesSummary(dateFrom?: string, dateTo?: string): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const summary = await this.db.getSalesSummary(dateFrom ?? undefined, dateTo ?? undefined);
        if (summary && summary.summary) {
          return summary;
        }
      } catch (error) {
        console.log('Failed to fetch sales summary from API, using mock data');
      }
    }
    return this.db.getSalesSummary(dateFrom ?? undefined, dateTo ?? undefined);
  }

  // Session management
  async getCurrentSession(): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.getCurrentSession();
      } catch (error) {
        console.log('Failed to get session from API');
      }
    }
    return this.db.getCurrentSession();
  }

  async createSession(configId: number): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.createSession(configId);
      } catch (error) {
        console.log('Failed to create session via API');
      }
    }
    return this.db.createSession(configId);
  }

  // Hardware operations (always mock for now)
  async printReceipt(order: any): Promise<boolean> {
    if (this.featureFlags.ENABLE_HARDWARE) {
      console.log('Hardware printing not yet implemented');
    }
    return this.db.printReceipt(order);
  }

  async openCashDrawer(): Promise<boolean> {
    if (this.featureFlags.ENABLE_HARDWARE) {
      console.log('Hardware cash drawer not yet implemented');
    }
    return this.db.openCashDrawer();
  }

  async scanBarcode(): Promise<string | null> {
    if (this.featureFlags.ENABLE_HARDWARE) {
      console.log('Hardware barcode scanning not yet implemented');
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
    await this.updateFeatureFlag('USE_REAL_API', false);
    await this.updateFeatureFlag('ENABLE_PAYMENTS', false);
    await this.updateFeatureFlag('ENABLE_HARDWARE', false);
    console.log('Reset to mock data mode');
  }

  async enableRealAPI(): Promise<void> {
    await this.updateFeatureFlag('USE_REAL_API', true);
    await this.checkBackendAvailability();
    console.log('Enabled real API mode');
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
    console.log('🌐 DataService.getCustomers - fetching from API');
    
    try {
      const authToken = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.FULL_API_URL}/customers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        const customers = result.data || result;
        console.log('✅ API customers received:', Array.isArray(customers) ? customers.length : 'not an array');
        return Array.isArray(customers) ? customers : [];
      } else {
        console.error('❌ API error:', response.status, response.statusText);
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Failed to fetch customers from API:', error);
      throw error; // No fallback - API must work for production readiness
    }
  }

  async getInventory(): Promise<any[]> {
    console.log('🌐 DataService.getInventory - fetching from API');
    
    try {
      const inventoryItems = await this.db.getInventoryItems();
      if (inventoryItems && inventoryItems.length >= 0) { // Allow empty arrays
        console.log('✅ API inventory received:', inventoryItems.length, 'items');
        return inventoryItems;
      } else {
        throw new Error('Invalid inventory data received from API');
      }
    } catch (error) {
      console.error('❌ Failed to fetch inventory from API:', error);
      throw error; // No fallback - API must work for production readiness
    }
  }

  async getEmployees(): Promise<any[]> {
    console.log('🌐 DataService.getEmployees - fetching from API');
    
    try {
      const authToken = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.FULL_API_URL}/employees`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        const employees = result.data || result;
        console.log('✅ API employees received:', Array.isArray(employees) ? employees.length : 'not an array');
        return Array.isArray(employees) ? employees : [];
      } else {
        console.error('❌ API error:', response.status, response.statusText);
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Failed to fetch employees from API, falling back to mock data:', error);
      
      // Fallback to mock employee data with complete schema
      const mockEmployees = [
        {
          id: 1,
          name: 'John Manager',
          email: 'john@restaurant.com',
          role: 'manager',
          hourlyRate: 25.00,
          isActive: true,
          avatar: null,
          phone: '+44 7700 900001',
          startDate: '2024-01-01',
          totalSales: 15420.50,
          totalOrders: 185,
          avgOrderValue: 83.35,
          performanceRating: 9.2,
          performanceScore: 9.2,
          hoursWorked: 160,
        },
        {
          id: 2,
          name: 'Sarah Cashier',
          email: 'sarah@restaurant.com',
          role: 'cashier',
          hourlyRate: 15.50,
          isActive: true,
          avatar: null,
          phone: '+44 7700 900002',
          startDate: '2024-01-15',
          totalSales: 8750.25,
          totalOrders: 142,
          avgOrderValue: 61.62,
          performanceRating: 8.8,
          performanceScore: 8.8,
          hoursWorked: 155,
        },
        {
          id: 3,
          name: 'Mike Kitchen',
          email: 'mike@restaurant.com',
          role: 'kitchen',
          hourlyRate: 18.00,
          isActive: true,
          avatar: null,
          phone: '+44 7700 900003',
          startDate: '2024-02-01',
          totalSales: 12100.75,
          totalOrders: 167,
          avgOrderValue: 72.46,
          performanceRating: 9.0,
          performanceScore: 9.0,
          hoursWorked: 162,
        },
        {
          id: 4,
          name: 'Lisa Server',
          email: 'lisa@restaurant.com',
          role: 'server',
          hourlyRate: 12.50,
          isActive: false,
          avatar: null,
          phone: '+44 7700 900004',
          startDate: '2023-12-01',
          totalSales: 6890.00,
          totalOrders: 98,
          avgOrderValue: 70.31,
          performanceRating: 7.5,
          performanceScore: 7.5,
          hoursWorked: 120,
        },
      ];
      
      console.log('📋 Using mock employee data:', mockEmployees.length, 'employees');
      return mockEmployees;
    }
  }

  async getWeekSchedule(weekStart: Date, employees: any[]): Promise<any | null> {
    console.log('🌐 DataService.getWeekSchedule - fetching from API', { weekStart });
    
    try {
      const schedule = await this.db.getWeekSchedule(weekStart, employees);
      console.log('✅ API schedule received:', schedule?.shifts?.length || 0, 'shifts');
      return schedule;
    } catch (error) {
      console.error('❌ Failed to fetch schedule from API:', error);
      throw error; // No fallback - API must work for production readiness
    }
  }

  async getOrders(dateRange: string): Promise<any[]> {
    console.log('DataService.getOrders called', {
      dateRange,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable
    });
    
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        console.log('🌐 Attempting to fetch orders from API...');
        const authToken = await AsyncStorage.getItem('auth_token');
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/orders?date_range=${dateRange}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const orders = result.data || result;
          console.log('✅ API orders received:', Array.isArray(orders) ? orders.length : 'not an array');
          return Array.isArray(orders) ? orders : [];
        } else {
          console.error('❌ API error:', response.status, response.statusText);
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch orders from API:', error);
        throw error; // No fallback - API must work for production readiness
      }
    }
  }

  async getFinancialReportDetail(period: string): Promise<any | null> {
    console.log('DataService.getFinancialReportDetail called', {
      period,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable
    });
    
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        console.log('🌐 Attempting to fetch financial data from API...');
        const authToken = await AsyncStorage.getItem('auth_token');
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/analytics/financial?period=${period}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const financialData = result.data || result; // Handle both wrapped and unwrapped responses
          console.log('✅ API financial data received');
          return financialData;
        } else {
          console.error('❌ API error:', response.status, response.statusText);
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch financial data from API:', error);
        throw error; // No fallback - API must work for production readiness
      }
    }
    
  }

  async getSalesReportDetail(period: string): Promise<any[]> {
    console.log('🌐 DataService.getSalesReportDetail - fetching from API', { period });
    
    try {
      const authToken = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.FULL_API_URL}/analytics/sales?timeframe=${period}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        let salesData = result.data || result;
        
        // Transform API data to match frontend SalesData[] interface
        if (salesData && !Array.isArray(salesData)) {
          // Convert API format to SalesData array format
          const transformedData = this.transformApiDataToArray(salesData, period);
          console.log('✅ API sales data transformed for frontend');
          return transformedData;
        } else if (Array.isArray(salesData)) {
          console.log('✅ API sales data received in array format');
          return salesData;
        } else {
          throw new Error('Invalid sales data format received from API');
        }
      } else {
        console.error('❌ API error:', response.status, response.statusText);
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Failed to fetch sales data from API:', error);
      throw error; // No fallback - API must work for production readiness
    }
  }

  /**
   * Transform API response data to SalesData array format
   * Handles various API response formats and converts to frontend interface
   */
  private transformApiDataToArray(apiData: any, period: string): any[] {
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
    } catch (error) {
      console.error('❌ Error transforming API data:', error);
      return [];
    }
  }

  async getStaffReportDetail(period: string): Promise<any[]> { // Should return StaffMember[]
    console.log('DataService.getStaffReportDetail called', {
      period,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable
    });
    
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        console.log('🌐 Attempting to fetch staff data from API...');
        const authToken = await AsyncStorage.getItem('auth_token');
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/analytics/employees?timeframe=${period}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const staffData = result.data || result; // Handle both wrapped and unwrapped responses
          console.log('✅ API staff data received');
          return staffData;
        } else {
          console.error('❌ API error:', response.status, response.statusText);
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch staff data from API:', error);
        throw error; // No fallback - API must work for production readiness
      }
    }
    
  }

  async getReportsDashboardData(): Promise<any | null> {
    console.log('DataService.getReportsDashboardData called', {
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable
    });
    
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        console.log('🌐 Attempting to fetch reports from API...');
        const authToken = await AsyncStorage.getItem('auth_token');
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/analytics/dashboard/mobile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const dashboardData = result.data || result; // Handle both wrapped and unwrapped responses
          console.log('✅ API reports received');
          return dashboardData;
        } else {
          console.error('❌ API error:', response.status, response.statusText);
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch reports dashboard from API:', error);
        // Return generic mock data for any restaurant
        return this.getGenericRestaurantReports();
      }
    }
    
    // Return mock data if not using real API
    return this.getGenericRestaurantReports();
  }
  
  private getGenericRestaurantReports() {
    const today = new Date();
    return {
      revenue: {
        today: 2847.50,
        yesterday: 3156.80,
        thisWeek: 18432.75,
        lastWeek: 19875.20,
        thisMonth: 67890.50,
        lastMonth: 71234.80
      },
      orders: {
        today: 42,
        yesterday: 48,
        thisWeek: 287,
        lastWeek: 312,
        averageOrderValue: 67.80
      },
      topItems: [
        { name: 'Main Dish #1', quantity: 156, revenue: 1872.00 },
        { name: 'Main Dish #2', quantity: 134, revenue: 1474.00 },
        { name: 'Main Dish #3', quantity: 98, revenue: 1323.00 },
        { name: 'Appetizer #1', quantity: 89, revenue: 712.00 },
        { name: 'Beverage #1', quantity: 78, revenue: 624.00 }
      ],
      hourlyBreakdown: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        orders: hour >= 11 && hour <= 22 ? Math.floor(Math.random() * 15) + 5 : 0,
        revenue: hour >= 11 && hour <= 22 ? Math.floor(Math.random() * 500) + 100 : 0
      })),
      paymentMethods: {
        card: { count: 178, percentage: 62 },
        cash: { count: 65, percentage: 23 },
        applePay: { count: 44, percentage: 15 }
      },
      staffPerformance: [
        { name: 'Staff Member #1', orders: 89, revenue: 5234.50 },
        { name: 'Staff Member #2', orders: 76, revenue: 4567.80 },
        { name: 'Staff Member #3', orders: 68, revenue: 4123.40 },
        { name: 'Staff Member #4', orders: 54, revenue: 3456.80 }
      ]
    };
  }

  async getUserProfile(): Promise<any | null> {
    console.warn('DataService.getUserProfile is a stub and not implemented.');
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      // return this.db.getUserProfile();
      throw new Error('DataService.getUserProfile not implemented yet');
    }
    return Promise.resolve({ id: 1, name: 'Default User', email: 'user@example.com', role: 'admin' });
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
  }): Promise<any> {
    console.log('🌐 DataService.createEmployee - creating employee via API', employeeData);
    
    try {
      const authToken = await AsyncStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_CONFIG.FULL_API_URL}/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          first_name: employeeData.firstName,
          last_name: employeeData.lastName,
          email: employeeData.email,
          phone: employeeData.phone,
          role: employeeData.role,
          hourly_rate: employeeData.hourlyRate,
          start_date: employeeData.startDate,
          permissions: employeeData.permissions || [],
          is_active: true,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        const newEmployee = result.data || result;
        console.log('✅ Employee created successfully:', newEmployee.id);
        return newEmployee;
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to create employee:', response.status, errorText);
        throw new Error(`Failed to create employee: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Employee creation failed:', error);
      throw new Error(`Employee creation failed: ${error.message}`);
    }
  }
}

export default DataService;