// DatabaseService.ts - Mobile database API service for CashApp POS
import AsyncStorage from '@react-native-async-storage/async-storage';

// Database configuration - FIXED: Uses LAN IP for device testing
import API_CONFIG from '../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;
const DB_CONFIG = API_CONFIG.DATABASE;

// Types for our data models
export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  image?: string;
  barcode?: string;
  available_in_pos: boolean;
  active: boolean;
}

export interface Category {
  id: number;
  name: string;
  active: boolean;
}

export interface Order {
  id?: number;
  name?: string;
  date_order: string;
  state: 'draft' | 'paid' | 'done' | 'invoiced' | 'cancel';
  amount_total: number;
  partner_id?: number;
  partner_name?: string;
  session_id: number;
  lines: OrderLine[];
}

export interface OrderLine {
  id?: number;
  order_id?: number;
  product_id: number;
  product_name: string;
  qty: number;
  price_unit: number;
  price_subtotal: number;
}

export interface PosSession {
  id: number;
  name: string;
  state: 'opening_control' | 'opened' | 'closing_control' | 'closed';
  start_at: string;
  stop_at?: string;
  config_id: number;
  config_name: string;
  user_id: number;
  user_name: string;
}

class DatabaseService {
  private static instance: DatabaseService;
  private authToken: string | null = null;
  private currentSession: PosSession | null = null;

  constructor() {
    this.loadAuthToken();
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Authentication methods
  private async loadAuthToken(): Promise<void> {
    try {
      this.authToken = await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.error('Error loading auth token:', error);
    }
  }

  private async saveAuthToken(token: string): Promise<void> {
    try {
      this.authToken = token;
      await AsyncStorage.setItem('auth_token', token);
    } catch (error) {
      console.error('Error saving auth token:', error);
    }
  }

  // API request helper - FIXED: Handle REST API responses properly
  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();
      
      // Handle both successful and error responses from FastAPI backend
      if (!response.ok) {
        // Backend returns error in standardized format
        const errorMessage = data.message || data.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Authentication - FIXED: Convert from JSONRPC to REST API format
  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await this.apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: username, // Backend expects email field
          password: password,
        }),
      });

      // Backend returns standardized response format
      if (response.success && response.data && response.data.access_token) {
        await this.saveAuthToken(response.data.access_token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.apiRequest('/api/v1/auth/logout', { method: 'POST' });
      this.authToken = null;
      await AsyncStorage.removeItem('auth_token');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  // Product operations
  async getProducts(): Promise<Product[]> {
    try {
      // Use the mobile-optimized view we created
      const response = await this.apiRequest('/api/v1/products/mobile', {
        method: 'GET',
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch products:', error);
      throw error; // Re-throw the error
    }
  }

  async getProductsByCategory(categoryId: number): Promise<Product[]> {
    try {
      const response = await this.apiRequest(`/api/v1/products/category/${categoryId}`, {
        method: 'GET',
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch products by category:', error);
      throw error; // Re-throw the error
    }
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    try {
      const response = await this.apiRequest('/api/v1/categories', {
        method: 'GET',
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      throw error; // Re-throw the error
    }
  }

  // POS Session operations
  async getCurrentSession(): Promise<PosSession | null> {
    try {
      const response = await this.apiRequest('/api/v1/pos/sessions/current', {
        method: 'GET',
      });
      
      this.currentSession = response.data;
      return this.currentSession;
    } catch (error) {
      console.error('Failed to get current session:', error);
      return null;
    }
  }

  async createSession(configId: number): Promise<PosSession | null> {
    try {
      const response = await this.apiRequest('/api/v1/pos/sessions', {
        method: 'POST',
        body: JSON.stringify({
          config_id: configId,
        }),
      });
      
      this.currentSession = response.data;
      return this.currentSession;
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  }

  // Order operations
  async createOrder(order: Partial<Order>): Promise<Order | null> {
    try {
      const orderData = {
        ...order,
        session_id: this.currentSession?.id,
        date_order: new Date().toISOString(),
        state: 'draft',
      };

      const response = await this.apiRequest('/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to create order:', error);
      return null;
    }
  }

  async updateOrder(orderId: number, updates: Partial<Order>): Promise<Order | null> {
    try {
      const response = await this.apiRequest(`/api/v1/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to update order:', error);
      return null;
    }
  }

  async getRecentOrders(limit: number = 20): Promise<Order[]> {
    try {
      const response = await this.apiRequest(`/api/v1/orders/recent?limit=${limit}`, {
        method: 'GET',
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch recent orders:', error);
      return [];
    }
  }

  // Payment processing - PHASE 3: Updated to match backend multi-provider endpoint
  async processPayment(orderId: number, paymentMethod: string, amount: number): Promise<boolean> {
    try {
      console.log(`🔄 Processing ${paymentMethod} payment for £${amount} (Order: ${orderId})`);
      
      const response = await this.apiRequest('/api/v1/payments/process', {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderId.toString(),
          amount: amount,
          currency: 'GBP',
          metadata: {
            payment_method: paymentMethod,
            frontend_source: 'mobile_app'
          }
        }),
      });
      
      if (response.success && response.data) {
        console.log(`✅ Payment processed successfully via ${response.data.provider}`);
        console.log(`💰 Amount: £${response.data.amount}, Fee: £${response.data.fee}, Net: £${response.data.net_amount}`);
        return true;
      } else {
        console.log(`❌ Payment failed:`, response.message || 'Unknown error');
        return false;
      }
    } catch (error) {
      console.error('❌ Payment processing failed:', error);
      return false;
    }
  }

  // Restaurant-specific operations - FIXED: Convert to REST API endpoints
  async getRestaurantFloorPlan(sectionId?: string): Promise<any> {
    try {
      const endpoint = sectionId 
        ? `/api/v1/restaurants/floor-plan?section_id=${sectionId}`
        : '/api/v1/restaurants/floor-plan';
      
      const response = await this.apiRequest(endpoint, {
        method: 'GET',
      });
      
      return response.data || null;
    } catch (error) {
      console.error('Failed to fetch floor plan:', error);
      throw error;
    }
  }

  async updateTableStatus(tableId: string, status: string, additionalData?: any): Promise<any> {
    try {
      const response = await this.apiRequest(`/api/v1/restaurants/tables/${tableId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: status,
          ...additionalData,
        }),
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to update table status:', error);
      return null;
    }
  }

  async assignTableServer(tableId: string, serverId: string): Promise<any> {
    try {
      const response = await this.apiRequest(`/api/v1/restaurants/tables/${tableId}/server`, {
        method: 'PUT',
        body: JSON.stringify({
          server_id: serverId,
        }),
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to assign server to table:', error);
      return null;
    }
  }

  async getSections(): Promise<any[]> {
    try {
      const response = await this.apiRequest('/api/v1/restaurants/sections', {
        method: 'GET',
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch restaurant sections:', error);
      return [];
    }
  }

  async getDailySalesReport(date?: string): Promise<any> {
    try {
      const queryParam = date ? `?date=${date}` : '';
      const response = await this.apiRequest(`/api/v1/reports/daily-sales${queryParam}`, {
        method: 'GET',
      });
      
      return response.data || null;
    } catch (error) {
      console.error('Failed to fetch daily sales report:', error);
      throw error;
    }
  }

  async getSalesSummary(dateFrom?: string, dateTo?: string): Promise<any> {
    try {
      let queryParams = '';
      if (dateFrom || dateTo) {
        const params = new URLSearchParams();
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);
        queryParams = `?${params.toString()}`;
      }
      
      const response = await this.apiRequest(`/api/v1/reports/sales-summary${queryParams}`, {
        method: 'GET',
      });
      
      return response.data || null;
    } catch (error) {
      console.error('Failed to fetch sales summary:', error);
      throw error;
    }
  }

  // Cache management
  async syncOfflineData(): Promise<void> {
    try {
      // Sync any offline orders, products, etc.
      const offlineOrders = await AsyncStorage.getItem('offline_orders');
      if (offlineOrders) {
        const orders = JSON.parse(offlineOrders);
        for (const order of orders) {
          await this.createOrder(order);
        }
        await AsyncStorage.removeItem('offline_orders');
      }
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }

  // Mock data for development (will be removed when backend is connected)

  async scanBarcode(): Promise<string | null> {
    // Placeholder for real barcode scanner integration (e.g., ML Kit)
    // Returns the scanned barcode string or null if cancelled
    console.warn('scanBarcode() not yet implemented in DatabaseService');
    return null;
  }

  async printReceipt(order: Order): Promise<boolean> {
    // TODO: integrate with AirPrint / ESC-POS printers
    console.warn('printReceipt() not yet implemented in DatabaseService');
    return true; // pretend success so caller flow continues
  }

  async openCashDrawer(): Promise<boolean> {
    // TODO: integrate with connected cash drawer hardware
    console.warn('openCashDrawer() not yet implemented in DatabaseService');
    return true;
  }

  // --- Stubs for new methods called by DataService ---
  // TODO(real API): Implement actual API calls for these methods in DatabaseService

  async getCustomers(): Promise<any[]> {
    // Example: return this.apiRequest('/api/v1/customers');
    console.warn('DatabaseService.getCustomers is a stub and not implemented.');
    throw new Error('DatabaseService.getCustomers not implemented yet');
    // return Promise.resolve([]); // Or throw error if DataService should handle the stubbing
  }

  async getInventory(): Promise<any[]> {
    console.warn('DatabaseService.getInventory is a stub and not implemented.');
    throw new Error('DatabaseService.getInventory not implemented yet');
  }

  async getEmployees(): Promise<any[]> {
    console.warn('DatabaseService.getEmployees is a stub and not implemented.');
    throw new Error('DatabaseService.getEmployees not implemented yet');
  }

  async getWeekSchedule(weekStart: Date, employees: any[]): Promise<any | null> {
    console.warn('DatabaseService.getWeekSchedule is a stub and not implemented.');
    throw new Error('DatabaseService.getWeekSchedule not implemented yet');
  }

  async getOrdersByDateRange(dateRange: string): Promise<any[]> { // Renamed to match DataService call intent
    console.warn('DatabaseService.getOrdersByDateRange is a stub and not implemented.');
    throw new Error('DatabaseService.getOrdersByDateRange not implemented yet');
  }

  async getFinancialReportDetail(period: string): Promise<any | null> {
    console.warn('DatabaseService.getFinancialReportDetail is a stub and not implemented.');
    throw new Error('DatabaseService.getFinancialReportDetail not implemented yet');
  }

  async getSalesReportDetail(period: string): Promise<any[]> {
    console.warn('DatabaseService.getSalesReportDetail is a stub and not implemented.');
    throw new Error('DatabaseService.getSalesReportDetail not implemented yet');
  }

  async getStaffReportDetail(period: string): Promise<any[]> {
    console.warn('DatabaseService.getStaffReportDetail is a stub and not implemented.');
    throw new Error('DatabaseService.getStaffReportDetail not implemented yet');
  }

  async getReportsDashboardData(): Promise<any | null> {
    console.warn('DatabaseService.getReportsDashboardData is a stub and not implemented.');
    throw new Error('DatabaseService.getReportsDashboardData not implemented yet');
  }

  async getUserProfile(): Promise<any | null> {
    console.warn('DatabaseService.getUserProfile is a stub and not implemented.');
    // Example: return this.apiRequest('/api/v1/users/profile');
    throw new Error('DatabaseService.getUserProfile not implemented yet');
  }
}

export default DatabaseService; 