// DataService.ts - Unified data service with mock/real data switching
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from './DatabaseService';
import MockDataService from './MockDataService';

// Feature flags for controlling data sources
export interface FeatureFlags {
  USE_REAL_API: boolean;
  ENABLE_PAYMENTS: boolean;
  ENABLE_HARDWARE: boolean;
  SHOW_DEV_MENU: boolean;
  MOCK_AUTHENTICATION: boolean;
}

// Default feature flags - FIXED: Enable real API to connect to working backend
const DEFAULT_FLAGS: FeatureFlags = {
  USE_REAL_API: true,  // Changed from false to true - backend is now functional
  ENABLE_PAYMENTS: false,
  ENABLE_HARDWARE: false,
  SHOW_DEV_MENU: __DEV__,
  MOCK_AUTHENTICATION: false, // Changed from true to false - use real auth
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
  private mockDataService: MockDataService;
  private isBackendAvailable: boolean = false;

  constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.mockDataService = MockDataService.getInstance();
    this.loadFeatureFlags();
    this.checkBackendAvailability();
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

  // Backend availability check - FIXED: Updated to use correct port
  private async checkBackendAvailability(): Promise<void> {
    if (!this.featureFlags.USE_REAL_API) {
      return;
    }

    try {
      // Use AbortController for timeout instead of timeout property
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch('http://localhost:8000/health', {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      this.isBackendAvailable = response.ok;
    } catch {
      this.isBackendAvailable = false;
      console.log('Backend not available, using mock data');
    }

    // Recheck every 30 seconds
    setTimeout(() => this.checkBackendAvailability(), 30000);
  }

  // Authentication methods - can use mock or real
  async login(username: string, password: string): Promise<boolean> {
    if (this.featureFlags.MOCK_AUTHENTICATION) {
      return this.mockDataService.login(username, password);
    }

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.databaseService.login(username, password);
      } catch (error) {
        console.log('Real login failed, falling back to mock');
        return this.mockDataService.login(username, password);
      }
    }

    return this.mockDataService.login(username, password);
  }

  async logout(): Promise<void> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      await this.databaseService.logout();
    }
    // Always clear local state
    await AsyncStorage.multiRemove(['auth_token', 'user_data']);
  }

  // Product operations
  async getProducts(): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const products = await this.databaseService.getProducts();
        if (products && products.length > 0) {
          return products;
        }
      } catch (error) {
        console.log('Failed to fetch products from API, using mock data');
      }
    }
    return this.mockDataService.getProducts();
  }

  async getProductsByCategory(categoryId: number): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.databaseService.getProductsByCategory(categoryId);
      } catch (error) {
        console.log('Failed to fetch products by category, using mock data');
      }
    }
    return this.mockDataService.getProductsByCategory(categoryId);
  }

  // Category operations
  async getCategories(): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const categories = await this.databaseService.getCategories();
        if (categories && categories.length > 0) {
          return categories;
        }
      } catch (error) {
        console.log('Failed to fetch categories from API, using mock data');
      }
    }
    return this.mockDataService.getCategories();
  }

  // Order operations
  async createOrder(order: any): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const result = await this.databaseService.createOrder(order);
        if (result) return result;
      } catch (error) {
        console.log('Failed to create order via API, using mock');
      }
    }
    return this.mockDataService.createOrder(order);
  }

  async updateOrder(orderId: number, updates: any): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.databaseService.updateOrder(orderId, updates);
      } catch (error) {
        console.log('Failed to update order via API');
      }
    }
    return this.mockDataService.updateOrder(orderId, updates);
  }

  async getRecentOrders(limit: number = 20): Promise<any[]> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const orders = await this.databaseService.getRecentOrders(limit);
        if (orders && orders.length > 0) {
          return orders;
        }
      } catch (error) {
        console.log('Failed to fetch orders from API, using mock data');
      }
    }
    return this.mockDataService.getRecentOrders(limit);
  }

  // Payment processing
  async processPayment(orderId: number, paymentMethod: string, amount: number): Promise<boolean> {
    if (!this.featureFlags.ENABLE_PAYMENTS) {
      // Always succeed in demo mode
      console.log(`Mock payment processed: ${paymentMethod} for £${amount}`);
      return true;
    }

    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.databaseService.processPayment(orderId, paymentMethod, amount);
      } catch (error) {
        console.log('Real payment failed, using mock');
      }
    }
    
    return this.mockDataService.processPayment(orderId, paymentMethod, amount);
  }

  // Restaurant operations
  async getRestaurantFloorPlan(sectionId?: string | null): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const floorPlan = await this.databaseService.getRestaurantFloorPlan(sectionId);
        if (floorPlan && floorPlan.tables && floorPlan.tables.length > 0) {
          return floorPlan;
        }
      } catch (error) {
        console.log('Failed to fetch floor plan from API, using mock data');
      }
    }
    return this.mockDataService.getRestaurantFloorPlan(sectionId);
  }

  async updateTableStatus(tableId: string, status: string, additionalData?: any): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.databaseService.updateTableStatus(tableId, status, additionalData);
      } catch (error) {
        console.log('Failed to update table status via API');
      }
    }
    return this.mockDataService.updateTableStatus(tableId, status, additionalData);
  }

  // Analytics and Reporting
  async getDailySalesReport(date?: string): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const report = await this.databaseService.getDailySalesReport(date);
        if (report && report.summary) {
          return report;
        }
      } catch (error) {
        console.log('Failed to fetch daily report from API, using mock data');
      }
    }
    return this.mockDataService.getDailySalesReport(date);
  }

  async getSalesSummary(dateFrom?: string, dateTo?: string): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        const summary = await this.databaseService.getSalesSummary(dateFrom, dateTo);
        if (summary && summary.summary) {
          return summary;
        }
      } catch (error) {
        console.log('Failed to fetch sales summary from API, using mock data');
      }
    }
    return this.mockDataService.getSalesSummary(dateFrom, dateTo);
  }

  // Session management
  async getCurrentSession(): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.databaseService.getCurrentSession();
      } catch (error) {
        console.log('Failed to get session from API');
      }
    }
    return this.mockDataService.getCurrentSession();
  }

  async createSession(configId: number): Promise<any> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      try {
        return await this.databaseService.createSession(configId);
      } catch (error) {
        console.log('Failed to create session via API');
      }
    }
    return this.mockDataService.createSession(configId);
  }

  // Hardware operations (always mock for now)
  async printReceipt(order: any): Promise<boolean> {
    if (this.featureFlags.ENABLE_HARDWARE) {
      console.log('Hardware printing not yet implemented');
    }
    return this.mockDataService.printReceipt(order);
  }

  async openCashDrawer(): Promise<boolean> {
    if (this.featureFlags.ENABLE_HARDWARE) {
      console.log('Hardware cash drawer not yet implemented');
    }
    return this.mockDataService.openCashDrawer();
  }

  async scanBarcode(): Promise<string | null> {
    if (this.featureFlags.ENABLE_HARDWARE) {
      console.log('Hardware barcode scanning not yet implemented');
    }
    return this.mockDataService.scanBarcode();
  }

  // Sync and offline support
  async syncOfflineData(): Promise<void> {
    if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
      await this.databaseService.syncOfflineData();
    }
    // Also sync mock data if needed
    await this.mockDataService.syncOfflineData();
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
}

export default DataService;