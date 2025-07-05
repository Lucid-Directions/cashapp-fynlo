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
    // Alias for getInventoryItems
    return this.getInventoryItems();
  }

  async getInventoryItems(): Promise<any[]> {
    // Return mock inventory data for Casa Estrella Mexican Cuisine
    return Promise.resolve([
      {
        id: 1,
        itemId: 1,
        sku: 'BEEF-001',
        name: 'Ground Beef',
        category: 'Meat',
        currentStock: 25.5,
        unit: 'kg',
        minThreshold: 10,
        maxThreshold: 50,
        unitCost: 8.50,
        supplier: 'Premium Meats Ltd',
        lastRestocked: '2025-07-01',
        status: 'in_stock'
      },
      {
        id: 2,
        itemId: 2,
        sku: 'CHICK-001',
        name: 'Chicken Breast',
        category: 'Meat',
        currentStock: 18.2,
        unit: 'kg',
        minThreshold: 15,
        maxThreshold: 40,
        unitCost: 6.75,
        supplier: 'Premium Meats Ltd',
        lastRestocked: '2025-06-30',
        status: 'in_stock'
      },
      {
        id: 3,
        itemId: 3,
        sku: 'TORT-001',
        name: 'Flour Tortillas',
        category: 'Bread',
        currentStock: 120,
        unit: 'pieces',
        minThreshold: 50,
        maxThreshold: 200,
        unitCost: 0.25,
        supplier: 'Mexican Foods Co',
        lastRestocked: '2025-07-02',
        status: 'in_stock'
      },
      {
        id: 4,
        itemId: 4,
        sku: 'CHES-001',
        name: 'Cheddar Cheese',
        category: 'Dairy',
        currentStock: 8.5,
        unit: 'kg',
        minThreshold: 10,
        maxThreshold: 25,
        unitCost: 12.00,
        supplier: 'Dairy Fresh Ltd',
        lastRestocked: '2025-06-28',
        status: 'low_stock'
      },
      {
        id: 5,
        itemId: 5,
        sku: 'TOM-001',
        name: 'Fresh Tomatoes',
        category: 'Vegetables',
        currentStock: 12.8,
        unit: 'kg',
        minThreshold: 8,
        maxThreshold: 30,
        unitCost: 3.20,
        supplier: 'Garden Fresh Produce',
        lastRestocked: '2025-07-01',
        status: 'in_stock'
      },
      {
        id: 6,
        itemId: 6,
        sku: 'ONI-001',
        name: 'Yellow Onions',
        category: 'Vegetables',
        currentStock: 15.5,
        unit: 'kg',
        minThreshold: 10,
        maxThreshold: 25,
        unitCost: 1.80,
        supplier: 'Garden Fresh Produce',
        lastRestocked: '2025-06-30',
        status: 'in_stock'
      },
      {
        id: 7,
        itemId: 7,
        sku: 'AVD-001',
        name: 'Avocados',
        category: 'Vegetables',
        currentStock: 4.2,
        unit: 'kg',
        minThreshold: 5,
        maxThreshold: 15,
        unitCost: 4.50,
        supplier: 'Garden Fresh Produce',
        lastRestocked: '2025-06-29',
        status: 'low_stock'
      },
      {
        id: 8,
        itemId: 8,
        sku: 'BEE-001',
        name: 'Corona Beer',
        category: 'Beverages',
        currentStock: 48,
        unit: 'bottles',
        minThreshold: 24,
        maxThreshold: 120,
        unitCost: 2.50,
        supplier: 'Beverages Direct',
        lastRestocked: '2025-07-01',
        status: 'in_stock'
      },
      {
        id: 9,
        itemId: 9,
        sku: 'TEQ-001',
        name: 'Tequila Blanco',
        category: 'Spirits',
        currentStock: 6,
        unit: 'bottles',
        minThreshold: 4,
        maxThreshold: 12,
        unitCost: 35.00,
        supplier: 'Spirits & More',
        lastRestocked: '2025-06-25',
        status: 'in_stock'
      },
      {
        id: 10,
        itemId: 10,
        sku: 'CHU-001',
        name: 'Churro Mix',
        category: 'Desserts',
        currentStock: 2.5,
        unit: 'kg',
        minThreshold: 3,
        maxThreshold: 10,
        unitCost: 8.75,
        supplier: 'Mexican Foods Co',
        lastRestocked: '2025-06-20',
        status: 'low_stock'
      }
    ]);
  }

  async getEmployees(): Promise<any[]> {
    // Return mock employee data for Casa Estrella Mexican Cuisine
    return Promise.resolve([
      {
        id: 1,
        name: 'Maria Garcia',
        firstName: 'Maria',
        lastName: 'Garcia',
        role: 'server',
        email: 'maria.garcia@casaestrella.com',
        phone: '+44 7700 900001',
        hourlyRate: 12.50,
        hoursWorked: 38,
        totalSales: 2450.75,
        isActive: true,
        hireDate: '2023-01-15'
      },
      {
        id: 2,
        name: 'Jose Rodriguez',
        firstName: 'Jose',
        lastName: 'Rodriguez',
        role: 'chef',
        email: 'jose.rodriguez@casaestrella.com',
        phone: '+44 7700 900002',
        hourlyRate: 18.00,
        hoursWorked: 42,
        totalSales: 0, // Chefs don't directly handle sales
        isActive: true,
        hireDate: '2022-08-20'
      },
      {
        id: 3,
        name: 'Ana Martinez',
        firstName: 'Ana',
        lastName: 'Martinez',
        role: 'bartender',
        email: 'ana.martinez@casaestrella.com',
        phone: '+44 7700 900003',
        hourlyRate: 14.00,
        hoursWorked: 35,
        totalSales: 1875.30,
        isActive: true,
        hireDate: '2023-03-10'
      },
      {
        id: 4,
        name: 'Carlos Lopez',
        firstName: 'Carlos',
        lastName: 'Lopez',
        role: 'server',
        email: 'carlos.lopez@casaestrella.com',
        phone: '+44 7700 900004',
        hourlyRate: 12.50,
        hoursWorked: 32,
        totalSales: 1920.50,
        isActive: true,
        hireDate: '2023-06-01'
      },
      {
        id: 5,
        name: 'Sofia Hernandez',
        firstName: 'Sofia',
        lastName: 'Hernandez',
        role: 'cashier',
        email: 'sofia.hernandez@casaestrella.com',
        phone: '+44 7700 900005',
        hourlyRate: 11.50,
        hoursWorked: 40,
        totalSales: 3150.25,
        isActive: true,
        hireDate: '2023-04-15'
      }
    ]);
  }

  async getWeekSchedule(weekStart: Date, employees: any[]): Promise<any | null> {
    // Return mock weekly schedule data
    const mockSchedule = {
      weekStart: weekStart,
      shifts: [
        // Monday
        { employeeId: 1, employeeName: 'Maria Garcia', day: 'Monday', startTime: '09:00', endTime: '17:00', role: 'server' },
        { employeeId: 2, employeeName: 'Jose Rodriguez', day: 'Monday', startTime: '08:00', endTime: '16:00', role: 'chef' },
        { employeeId: 3, employeeName: 'Ana Martinez', day: 'Monday', startTime: '15:00', endTime: '23:00', role: 'bartender' },
        
        // Tuesday
        { employeeId: 1, employeeName: 'Maria Garcia', day: 'Tuesday', startTime: '09:00', endTime: '17:00', role: 'server' },
        { employeeId: 4, employeeName: 'Carlos Lopez', day: 'Tuesday', startTime: '11:00', endTime: '19:00', role: 'server' },
        { employeeId: 2, employeeName: 'Jose Rodriguez', day: 'Tuesday', startTime: '08:00', endTime: '16:00', role: 'chef' },
        
        // Wednesday
        { employeeId: 5, employeeName: 'Sofia Hernandez', day: 'Wednesday', startTime: '10:00', endTime: '18:00', role: 'cashier' },
        { employeeId: 2, employeeName: 'Jose Rodriguez', day: 'Wednesday', startTime: '08:00', endTime: '16:00', role: 'chef' },
        { employeeId: 3, employeeName: 'Ana Martinez', day: 'Wednesday', startTime: '15:00', endTime: '23:00', role: 'bartender' },
        
        // Thursday
        { employeeId: 1, employeeName: 'Maria Garcia', day: 'Thursday', startTime: '09:00', endTime: '17:00', role: 'server' },
        { employeeId: 4, employeeName: 'Carlos Lopez', day: 'Thursday', startTime: '11:00', endTime: '19:00', role: 'server' },
        { employeeId: 2, employeeName: 'Jose Rodriguez', day: 'Thursday', startTime: '08:00', endTime: '16:00', role: 'chef' },
        { employeeId: 3, employeeName: 'Ana Martinez', day: 'Thursday', startTime: '15:00', endTime: '23:00', role: 'bartender' },
        
        // Friday (Busy day - more staff)
        { employeeId: 1, employeeName: 'Maria Garcia', day: 'Friday', startTime: '09:00', endTime: '17:00', role: 'server' },
        { employeeId: 4, employeeName: 'Carlos Lopez', day: 'Friday', startTime: '11:00', endTime: '19:00', role: 'server' },
        { employeeId: 2, employeeName: 'Jose Rodriguez', day: 'Friday', startTime: '08:00', endTime: '16:00', role: 'chef' },
        { employeeId: 3, employeeName: 'Ana Martinez', day: 'Friday', startTime: '15:00', endTime: '23:00', role: 'bartender' },
        { employeeId: 5, employeeName: 'Sofia Hernandez', day: 'Friday', startTime: '10:00', endTime: '18:00', role: 'cashier' },
        
        // Saturday (Busiest day - full staff)
        { employeeId: 1, employeeName: 'Maria Garcia', day: 'Saturday', startTime: '10:00', endTime: '18:00', role: 'server' },
        { employeeId: 4, employeeName: 'Carlos Lopez', day: 'Saturday', startTime: '10:00', endTime: '18:00', role: 'server' },
        { employeeId: 2, employeeName: 'Jose Rodriguez', day: 'Saturday', startTime: '08:00', endTime: '16:00', role: 'chef' },
        { employeeId: 3, employeeName: 'Ana Martinez', day: 'Saturday', startTime: '14:00', endTime: '22:00', role: 'bartender' },
        { employeeId: 5, employeeName: 'Sofia Hernandez', day: 'Saturday', startTime: '09:00', endTime: '17:00', role: 'cashier' },
        
        // Sunday (Moderate day)
        { employeeId: 1, employeeName: 'Maria Garcia', day: 'Sunday', startTime: '11:00', endTime: '19:00', role: 'server' },
        { employeeId: 2, employeeName: 'Jose Rodriguez', day: 'Sunday', startTime: '10:00', endTime: '18:00', role: 'chef' },
        { employeeId: 3, employeeName: 'Ana Martinez', day: 'Sunday', startTime: '16:00', endTime: '22:00', role: 'bartender' }
      ]
    };
    
    return Promise.resolve(mockSchedule);
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
    // Alias for getAnalyticsDashboard
    return this.getAnalyticsDashboard();
  }

  async getAnalyticsDashboard(): Promise<any | null> {
    // Return comprehensive analytics dashboard data
    return Promise.resolve({
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
    });
  }

  async getUserProfile(): Promise<any | null> {
    console.warn('DatabaseService.getUserProfile is a stub and not implemented.');
    // Example: return this.apiRequest('/api/v1/users/profile');
    throw new Error('DatabaseService.getUserProfile not implemented yet');
  }
}

export default DatabaseService; 