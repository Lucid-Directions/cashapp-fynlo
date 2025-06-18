// DatabaseService.ts - Mobile database API service for CashApp POS
import AsyncStorage from '@react-native-async-storage/async-storage';

// Database configuration
const API_BASE_URL = 'http://localhost:8069'; // CashApp backend URL
const DB_CONFIG = {
  host: 'localhost',
  port: 6432, // pgbouncer port for connection pooling
  database: 'cashapp_mobile',
  user: 'cashapp_user',
  password: 'cashapp_mobile_password',
};

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

  // API request helper
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Authentication
  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await this.apiRequest('/web/session/authenticate', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            db: DB_CONFIG.database,
            login: username,
            password: password,
          },
        }),
      });

      if (response.result && response.result.uid) {
        await this.saveAuthToken(response.result.session_id);
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
      await this.apiRequest('/web/session/destroy', { method: 'POST' });
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
      // Return mock data for development
      return this.getMockProducts();
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
      return [];
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
      return this.getMockCategories();
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

  // Payment processing
  async processPayment(orderId: number, paymentMethod: string, amount: number): Promise<boolean> {
    try {
      const response = await this.apiRequest('/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderId,
          payment_method: paymentMethod,
          amount: amount,
        }),
      });
      
      return response.success || false;
    } catch (error) {
      console.error('Payment processing failed:', error);
      return false;
    }
  }

  // Restaurant-specific operations
  async getRestaurantFloorPlan(sectionId?: string | null): Promise<any> {
    try {
      const endpoint = sectionId 
        ? `/restaurant/floor_plan?section_id=${sectionId}`
        : '/restaurant/floor_plan';
      
      const response = await this.apiRequest(endpoint, {
        method: 'GET',
      });
      
      return response || { tables: [], sections: [] };
    } catch (error) {
      console.error('Failed to fetch floor plan:', error);
      // Return mock data for development
      return this.getMockFloorPlan();
    }
  }

  async updateTableStatus(tableId: string, status: string, additionalData?: any): Promise<any> {
    try {
      const response = await this.apiRequest('/restaurant/table/update_status', {
        method: 'POST',
        body: JSON.stringify({
          table_id: tableId,
          status,
          ...additionalData,
        }),
      });
      
      return response;
    } catch (error) {
      console.error('Failed to update table status:', error);
      throw error;
    }
  }

  async assignServerToTable(tableId: string, serverId: string): Promise<any> {
    try {
      const response = await this.apiRequest('/restaurant/table/assign_server', {
        method: 'POST',
        body: JSON.stringify({
          table_id: tableId,
          server_id: serverId,
        }),
      });
      
      return response;
    } catch (error) {
      console.error('Failed to assign server to table:', error);
      throw error;
    }
  }

  async getRestaurantSections(): Promise<any[]> {
    try {
      const response = await this.apiRequest('/restaurant/sections', {
        method: 'GET',
      });
      
      return response.sections || [];
    } catch (error) {
      console.error('Failed to fetch restaurant sections:', error);
      return [];
    }
  }

  // Analytics and Reporting
  async getDailySalesReport(date?: string): Promise<any> {
    try {
      const endpoint = date 
        ? `/pos/reports/daily_sales?date=${date}`
        : '/pos/reports/daily_sales';
      
      const response = await this.apiRequest(endpoint, {
        method: 'GET',
      });
      
      return response || this.getMockDailyReport();
    } catch (error) {
      console.error('Failed to fetch daily sales report:', error);
      // Return mock data for development
      return this.getMockDailyReport();
    }
  }

  async getSalesSummary(dateFrom?: string, dateTo?: string): Promise<any> {
    try {
      let endpoint = '/pos/reports/sales_summary';
      const params = [];
      
      if (dateFrom) params.push(`date_from=${dateFrom}`);
      if (dateTo) params.push(`date_to=${dateTo}`);
      
      if (params.length > 0) {
        endpoint += '?' + params.join('&');
      }
      
      const response = await this.apiRequest(endpoint, {
        method: 'GET',
      });
      
      return response || this.getMockSalesSummary();
    } catch (error) {
      console.error('Failed to fetch sales summary:', error);
      return this.getMockSalesSummary();
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
  private getMockProducts(): Product[] {
    return [
      { id: 1, name: 'Classic Burger', price: 12.99, category: 'Main', image: '🍔', available_in_pos: true, active: true },
      { id: 2, name: 'Caesar Salad', price: 9.99, category: 'Salads', image: '🥗', available_in_pos: true, active: true },
      { id: 3, name: 'Margherita Pizza', price: 15.99, category: 'Main', image: '🍕', available_in_pos: true, active: true },
      { id: 4, name: 'Chicken Wings', price: 11.99, category: 'Appetizers', image: '🍗', available_in_pos: true, active: true },
      { id: 5, name: 'Fish & Chips', price: 14.99, category: 'Main', image: '🐟', available_in_pos: true, active: true },
      { id: 6, name: 'Chocolate Cake', price: 6.99, category: 'Desserts', image: '🍰', available_in_pos: true, active: true },
      { id: 7, name: 'Coca Cola', price: 2.99, category: 'Drinks', image: '🥤', available_in_pos: true, active: true },
      { id: 8, name: 'French Fries', price: 4.99, category: 'Sides', image: '🍟', available_in_pos: true, active: true },
    ];
  }

  private getMockCategories(): Category[] {
    return [
      { id: 1, name: 'Main', active: true },
      { id: 2, name: 'Appetizers', active: true },
      { id: 3, name: 'Salads', active: true },
      { id: 4, name: 'Sides', active: true },
      { id: 5, name: 'Desserts', active: true },
      { id: 6, name: 'Drinks', active: true },
    ];
  }

  private getMockFloorPlan(): any {
    return {
      tables: [
        {
          id: '1',
          name: 'T1',
          display_name: 'Main Floor - Table T1',
          capacity: 4,
          status: 'available',
          section: { id: '1', name: 'Main Floor', color: '#3498db' },
          stats: { orders_today: 3, revenue_today: 125.50 }
        },
        {
          id: '2',
          name: 'T2',
          display_name: 'Main Floor - Table T2',
          capacity: 2,
          status: 'occupied',
          section: { id: '1', name: 'Main Floor', color: '#3498db' },
          current_order: { id: '101', name: 'Order 101', amount: 45.99 },
          server: { id: '1', name: 'John Doe' },
          occupied_since: new Date().toISOString(),
          stats: { orders_today: 5, revenue_today: 225.00 }
        },
        {
          id: '3',
          name: 'T3',
          display_name: 'Main Floor - Table T3',
          capacity: 6,
          status: 'reserved',
          section: { id: '1', name: 'Main Floor', color: '#3498db' },
          stats: { orders_today: 2, revenue_today: 180.00 }
        },
        {
          id: '4',
          name: 'P1',
          display_name: 'Patio - Table P1',
          capacity: 4,
          status: 'available',
          section: { id: '2', name: 'Patio', color: '#27ae60' },
          stats: { orders_today: 1, revenue_today: 65.00 }
        },
        {
          id: '5',
          name: 'P2',
          display_name: 'Patio - Table P2',
          capacity: 4,
          status: 'cleaning',
          section: { id: '2', name: 'Patio', color: '#27ae60' },
          stats: { orders_today: 4, revenue_today: 195.00 }
        },
        {
          id: '6',
          name: 'B1',
          display_name: 'Bar - Table B1',
          capacity: 2,
          status: 'available',
          section: { id: '3', name: 'Bar', color: '#e74c3c' },
          stats: { orders_today: 6, revenue_today: 145.00 }
        },
      ],
      sections: [
        { id: '1', name: 'Main Floor', color: '#3498db', table_count: 3, total_capacity: 12 },
        { id: '2', name: 'Patio', color: '#27ae60', table_count: 2, total_capacity: 8 },
        { id: '3', name: 'Bar', color: '#e74c3c', table_count: 1, total_capacity: 2 },
      ]
    };
  }

  private getMockDailyReport(): any {
    const today = new Date().toISOString().split('T')[0];
    return {
      report_info: {
        type: 'daily',
        date: today,
        generated_at: new Date().toISOString(),
        total_orders: 47
      },
      summary: {
        total_sales: 1847.50,
        net_sales: 1685.00,
        total_tax: 162.50,
        total_orders: 47,
        average_ticket: 39.31,
        total_items: 124,
        average_items_per_order: 2.64,
        refund_amount: 25.99,
        refund_count: 1,
        discount_amount: 89.75
      },
      hourly_breakdown: [
        { hour: '09:00', sales: 45.50, orders: 2, items: 3 },
        { hour: '10:00', sales: 128.75, orders: 4, items: 8 },
        { hour: '11:00', sales: 234.20, orders: 7, items: 15 },
        { hour: '12:00', sales: 387.90, orders: 12, items: 28 },
        { hour: '13:00', sales: 445.60, orders: 11, items: 31 },
        { hour: '14:00', sales: 198.30, orders: 5, items: 14 },
        { hour: '15:00', sales: 156.75, orders: 3, items: 9 },
        { hour: '16:00', sales: 89.25, orders: 2, items: 5 },
        { hour: '17:00', sales: 161.25, orders: 1, items: 11 }
      ],
      payment_methods: [
        { method: 'Card', amount: 1234.50, count: 35, orders: 35, percentage: 66.8 },
        { method: 'Cash', amount: 455.75, count: 11, orders: 11, percentage: 24.7 },
        { method: 'Apple Pay', amount: 157.25, count: 1, orders: 1, percentage: 8.5 }
      ],
      top_products: [
        { name: 'Classic Burger', qty: 18, amount: 233.82, orders: 15, category: 'Main' },
        { name: 'Margherita Pizza', qty: 12, amount: 191.88, orders: 11, category: 'Main' },
        { name: 'Caesar Salad', qty: 8, amount: 79.92, orders: 8, category: 'Salads' },
        { name: 'Chicken Wings', qty: 14, amount: 167.86, orders: 7, category: 'Appetizers' },
        { name: 'French Fries', qty: 22, amount: 109.78, orders: 18, category: 'Sides' }
      ]
    };
  }

  private getMockSalesSummary(): any {
    return {
      period: {
        from: new Date().toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
      },
      summary: {
        total_sales: 1847.50,
        net_sales: 1685.00,
        total_tax: 162.50,
        total_orders: 47,
        average_ticket: 39.31
      },
      order_types: {
        dine_in: 32,
        takeout: 12,
        delivery: 3
      },
      generated_at: new Date().toISOString()
    };
  }
}

export default DatabaseService; 