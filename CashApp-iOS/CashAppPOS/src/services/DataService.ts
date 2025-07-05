// DataService.ts - Unified data service with mock/real data switching
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from './DatabaseService';
import APITestingService from './APITestingService';
import API_CONFIG from '../config/api';
import { envBool, IS_DEV } from '../env';

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

  // Authentication methods - can use mock or real
  async login(username: string, password: string): Promise<boolean> {
    // Test authentication endpoint in background when in test mode
    if (this.featureFlags.TEST_API_MODE) {
      await this.testAPIEndpoint('/api/v1/auth/login', 'POST', { email: username, password });
    }

    if (this.featureFlags.MOCK_AUTHENTICATION) {
      return this.db.login(username, password);
    }

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.db.login(username, password);
      } catch (error) {
        console.log('Real login failed, falling back to mock');
        return this.db.login(username, password);
      }
    }

    return this.db.login(username, password);
  }

  async logout(): Promise<void> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      await this.db.logout();
    }
    // Always clear local state
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
    console.warn('DataService.getCustomers is a stub and not implemented.');
    // In a real scenario, this would call this.db.getCustomers() or similar
    // which in turn makes an API call.
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      // return this.db.getCustomers();
      throw new Error('DataService.getCustomers not implemented yet');
    }
    return Promise.resolve([]); // Return empty array for now
  }

  async getInventory(): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const inventoryItems = await this.db.getInventoryItems();
        if (inventoryItems && inventoryItems.length > 0) {
          return inventoryItems;
        }
      } catch (error) {
        console.log('Failed to fetch inventory from API, using mock data');
      }
    }
    // Return mock inventory data
    return this.db.getInventoryItems();
  }

  async getEmployees(): Promise<any[]> {
    console.log('🔍 DataService.getEmployees called', {
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable
    });
    
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        console.log('🌐 Attempting to fetch employees from API...');
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/employees`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const employees = result.data || result; // Handle both wrapped and unwrapped responses
          console.log('✅ API employees received:', employees.length);
          return employees;
        }
      } catch (error) {
        console.log('❌ Failed to fetch employees from API, using mock data', error);
      }
    }
    
    // Return mock employee data
    console.log('🎭 Using mock employee data...');
    const mockEmployees = await this.db.getEmployees();
    console.log('📋 Mock employees returned:', mockEmployees?.length || 0);
    return mockEmployees || [];
  }

  async getWeekSchedule(weekStart: Date, employees: any[]): Promise<any | null> {
    console.log('DataService.getWeekSchedule called', {
      weekStart,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable
    });
    
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        console.log('Attempting to fetch schedule from API...');
        const schedule = await this.db.getWeekSchedule(weekStart, employees);
        if (schedule) {
          console.log('API schedule received');
          return schedule;
        }
      } catch (error) {
        console.log('Failed to fetch schedule from API, using mock data', error);
      }
    }
    
    // Return mock schedule data
    console.log('Using mock schedule data...');
    const mockSchedule = await this.db.getWeekSchedule(weekStart, employees);
    console.log('Mock schedule returned:', mockSchedule?.shifts?.length || 0, 'shifts');
    return mockSchedule;
  }

  async getOrders(dateRange: string): Promise<any[]> {
    console.warn('DataService.getOrders is a stub and not implemented.');
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      // Example: return this.db.getOrdersByDateRange(dateRange);
      throw new Error('DataService.getOrders not implemented yet');
    }
    return Promise.resolve([]);
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
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/analytics/financial?period=${period}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const financialData = result.data || result; // Handle both wrapped and unwrapped responses
          console.log('✅ API financial data received');
          return financialData;
        }
      } catch (error) {
        console.log('❌ Failed to fetch financial data from API, using mock data', error);
      }
    }
    
    // Return comprehensive mock financial data
    console.log('Using mock financial data for period:', period);
    const mockFinancialData = {
      summary: {
        totalRevenue: 15847.50,
        totalCosts: 8956.25,
        grossProfit: 6891.25,
        netProfit: 4234.75,
        profitMargin: 26.7
      },
      revenue: {
        foodSales: 12456.75,
        beverageSales: 2890.50,
        serviceFees: 500.25,
        totalRevenue: 15847.50
      },
      costs: {
        costOfGoodsSold: 4782.25,
        laborCosts: 3456.80,
        operatingExpenses: 717.20,
        totalCosts: 8956.25
      },
      paymentBreakdown: {
        cashPayments: 2377.13,
        cardPayments: 10577.88,
        qrPayments: 2892.49,
        totalPayments: 15847.50
      },
      taxes: {
        vatCollected: 2641.25,
        serviceChargeCollected: 1979.44,
        totalTaxes: 4620.69
      },
      trends: [
        { date: '2025-01-01', revenue: 2847.50, costs: 1623.45, profit: 1224.05 },
        { date: '2025-01-02', revenue: 3156.75, costs: 1798.85, profit: 1357.90 },
        { date: '2025-01-03', revenue: 2734.25, costs: 1556.95, profit: 1177.30 },
        { date: '2025-01-04', revenue: 3234.80, costs: 1842.34, profit: 1392.46 },
        { date: '2025-01-05', revenue: 3874.20, costs: 2134.66, profit: 1739.54 }
      ]
    };
    
    return Promise.resolve(mockFinancialData);
  }

  async getSalesReportDetail(period: string): Promise<any[]> { // Should return SalesData[]
    console.log('DataService.getSalesReportDetail called', {
      period,
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable
    });
    
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        console.log('🌐 Attempting to fetch sales data from API...');
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/analytics/sales?period=${period}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const salesData = result.data || result; // Handle both wrapped and unwrapped responses
          console.log('✅ API sales data received');
          return salesData;
        }
      } catch (error) {
        console.log('❌ Failed to fetch sales data from API, using mock data', error);
      }
    }
    
    // Return mock sales data for the period
    console.log('Using mock sales data for period:', period);
    const mockSalesData = [
      { 
        date: '2025-01-01', 
        dailySales: 2847.50, 
        transactions: 127, 
        averageOrder: 22.42,
        cashSales: 450.00,
        cardSales: 1897.50,
        qrSales: 500.00
      },
      { 
        date: '2025-01-02', 
        dailySales: 3156.75, 
        transactions: 142, 
        averageOrder: 22.23,
        cashSales: 520.00,
        cardSales: 2136.75,
        qrSales: 500.00
      },
      { 
        date: '2025-01-03', 
        dailySales: 2734.25, 
        transactions: 119, 
        averageOrder: 22.97,
        cashSales: 380.00,
        cardSales: 1854.25,
        qrSales: 500.00
      }
    ];
    
    return Promise.resolve(mockSalesData);
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
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/analytics/employees?period=${period}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const staffData = result.data || result; // Handle both wrapped and unwrapped responses
          console.log('✅ API staff data received');
          return staffData;
        }
      } catch (error) {
        console.log('❌ Failed to fetch staff data from API, using mock data', error);
      }
    }
    
    // Return mock staff data for the period
    console.log('Using mock staff data for period:', period);
    const mockStaffData = [
      {
        id: '1',
        name: 'Maria Garcia',
        role: 'Server',
        avatar: '👩‍🍳',
        totalSales: 2456.75,
        transactionsHandled: 89,
        averageOrderValue: 27.60,
        hoursWorked: 32.5,
        efficiency: 92,
        customerRating: 4.8,
        shiftsCompleted: 6,
        performance: 'excellent'
      },
      {
        id: '2',
        name: 'Jose Rodriguez',
        role: 'Server',
        avatar: '👨‍🍳',
        totalSales: 2134.50,
        transactionsHandled: 76,
        averageOrderValue: 28.09,
        hoursWorked: 30.0,
        efficiency: 88,
        customerRating: 4.6,
        shiftsCompleted: 5,
        performance: 'good'
      },
      {
        id: '3',
        name: 'Ana Martinez',
        role: 'Bartender',
        avatar: '👩‍🍳',
        totalSales: 1876.25,
        transactionsHandled: 65,
        averageOrderValue: 28.86,
        hoursWorked: 28.0,
        efficiency: 85,
        customerRating: 4.7,
        shiftsCompleted: 5,
        performance: 'good'
      },
      {
        id: '4',
        name: 'Carlos Lopez',
        role: 'Server',
        avatar: '👨‍🍳',
        totalSales: 1654.80,
        transactionsHandled: 58,
        averageOrderValue: 28.53,
        hoursWorked: 26.5,
        efficiency: 82,
        customerRating: 4.5,
        shiftsCompleted: 4,
        performance: 'average'
      }
    ];
    
    return Promise.resolve(mockStaffData);
  }

  async getReportsDashboardData(): Promise<any | null> {
    console.log('DataService.getReportsDashboardData called', {
      USE_REAL_API: this.featureFlags.USE_REAL_API,
      isBackendAvailable: this.isBackendAvailable
    });
    
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        console.log('🌐 Attempting to fetch reports from API...');
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/analytics/dashboard/mobile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const dashboardData = result.data || result; // Handle both wrapped and unwrapped responses
          console.log('✅ API reports received');
          return dashboardData;
        }
      } catch (error) {
        console.log('❌ Failed to fetch reports dashboard from API, using mock data', error);
      }
    }
    
    // Return comprehensive mock data for reports dashboard
    console.log('Using mock reports data...');
    const mockData = {
      todaySummary: { 
        totalSales: 2847.50, 
        transactions: 127, 
        averageOrder: 22.42,
        totalRevenue: 2847.50,
        totalOrders: 127,
        averageOrderValue: 22.42
      },
      weeklyLabor: { 
        totalActualHours: 248, 
        totalLaborCost: 3720.00, 
        efficiency: 87.5,
        scheduledHours: 280,
        overtimeHours: 8
      },
      topItemsToday: [
        { name: 'Chicken Tacos', quantity: 45, revenue: 675.00 },
        { name: 'Beef Burrito', quantity: 38, revenue: 570.00 },
        { name: 'Churros', quantity: 32, revenue: 192.00 },
        { name: 'Margarita', quantity: 28, revenue: 336.00 },
        { name: 'Quesadilla', quantity: 25, revenue: 375.00 }
      ],
      topPerformersToday: [
        { name: 'Maria Garcia', role: 'Server', orders: 18, sales: 425.50 },
        { name: 'Jose Rodriguez', role: 'Server', orders: 16, sales: 398.25 },
        { name: 'Ana Martinez', role: 'Bartender', orders: 12, sales: 286.75 },
        { name: 'Carlos Lopez', role: 'Server', orders: 14, sales: 315.80 },
        { name: 'Sofia Hernandez', role: 'Server', orders: 11, sales: 267.90 }
      ],
      salesTrend: [
        { period: 'Mon', sales: 1850.25 },
        { period: 'Tue', sales: 2124.50 },
        { period: 'Wed', sales: 1976.75 },
        { period: 'Thu', sales: 2398.00 },
        { period: 'Fri', sales: 3247.50 },
        { period: 'Sat', sales: 3856.25 },
        { period: 'Sun', sales: 2847.50 }
      ]
    };
    
    console.log('Returning mock reports data:', Object.keys(mockData));
    return Promise.resolve(mockData);
  }

  async getUserProfile(): Promise<any | null> {
    console.warn('DataService.getUserProfile is a stub and not implemented.');
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      // return this.db.getUserProfile();
      throw new Error('DataService.getUserProfile not implemented yet');
    }
    return Promise.resolve({ id: 1, name: 'Default User', email: 'user@example.com', role: 'admin' });
  }
}

export default DataService;