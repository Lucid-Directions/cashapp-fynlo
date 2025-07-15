// DatabaseService.ts - Mobile database API service for CashApp POS
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { CHUCHO_MENU_ITEMS, CHUCHO_CATEGORIES } from '../data/chuchoMenu';
import BackendCompatibilityService from './BackendCompatibilityService';
import tokenManager from '../utils/tokenManager';

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

  // Authentication methods - Updated for Supabase
  private async loadAuthToken(): Promise<void> {
    try {
      // Use tokenManager for consistent token retrieval
      this.authToken = await tokenManager.getTokenWithRefresh();
    } catch (error) {
      console.error('Error loading auth token:', error);
    }
  }

  private async saveAuthToken(token: string): Promise<void> {
    try {
      this.authToken = token;
      // CRITICAL: Must persist token for tokenManager to access it
      await AsyncStorage.setItem('auth_token', token);
      console.log('✅ Auth token saved to storage');
    } catch (error) {
      console.error('Error saving auth token:', error);
    }
  }

  private async getAuthToken(): Promise<string | null> {
    // Use unified token manager for consistent token retrieval
    const token = await tokenManager.getTokenWithRefresh();
    
    // Update internal reference if we got a token
    if (token) {
      this.authToken = token;
    }
    
    return token || this.authToken;
  }

  // API request helper - FIXED: Handle REST API responses properly
  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Get fresh auth token from Supabase
    const authToken = await this.getAuthToken();
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();
      
      // Handle 401 Unauthorized - token might be expired
      if (response.status === 401) {
        console.log('Token expired, attempting to refresh...');
        
        // Try to refresh the token using token manager
        const newToken = await tokenManager.refreshAuthToken();
        
        if (newToken) {
          // Retry the request with new token
          const newHeaders = {
            ...headers,
            'Authorization': `Bearer ${newToken}`
          };
          
          const retryResponse = await fetch(url, {
            ...options,
            headers: newHeaders,
          });
          
          const retryData = await retryResponse.json();
          
          if (!retryResponse.ok) {
            const errorMessage = retryData.message || retryData.detail || `HTTP error! status: ${retryResponse.status}`;
            throw new Error(errorMessage);
          }
          
          return retryData;
        }
      }
      
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
      console.error('Login failed, trying test users:', error);
      
      // Fallback to test users for development/testing
      return await this.authenticateTestUser(username, password);
    }
  }

  // Test user authentication - will be removed before production
  private async authenticateTestUser(username: string, password: string): Promise<boolean> {
    const testUsers = this.getTestUsers();
    const user = testUsers.find(u => 
      (u.username === username || u.email === username) && u.password === password
    );

    if (user) {
      // Generate a mock JWT token for the session
      const mockToken = `mock_jwt_${user.id}_${Date.now()}`;
      await this.saveAuthToken(mockToken);
      
      // Store user data for the session
      await AsyncStorage.setItem('user_data', JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        restaurant: user.restaurant,
        platform: user.platform
      }));

      console.log('✅ Test user authenticated:', user.name, `(${user.role})`);
      return true;
    }

    console.log('❌ Invalid test user credentials');
    return false;
  }

  // Get current authenticated user data
  async getCurrentUser(): Promise<any> {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  // Test users data - will be replaced with real backend users
  private getTestUsers() {
    return [
      {
        id: 1,
        username: "restaurant_owner",
        email: "owner@mexicanrestaurant.com",
        password: "owner123",
        role: "restaurant_owner",
        name: "Maria Rodriguez",
        restaurant: { id: 1, name: "Authentic Mexican Cuisine", slug: "mexican-pilot-001" },
        permissions: ["manage_menu", "view_reports", "manage_employees", "manage_settings", "process_orders", "handle_payments"]
      },
      {
        id: 2,
        username: "platform_owner",
        email: "admin@fynlo.com",
        password: "platform123",
        role: "platform_owner", 
        name: "Alex Thompson",
        platform: { id: 1, name: "Fynlo POS Platform" },
        permissions: ["manage_all_restaurants", "view_all_analytics", "manage_platform_settings", "configure_payment_fees", "manage_service_charges", "access_admin_panel"]
      },
      {
        id: 3,
        username: "manager",
        email: "sofia@mexicanrestaurant.com",
        password: "manager123",
        role: "manager",
        name: "Sofia Hernandez",
        restaurant: { id: 1, name: "Authentic Mexican Cuisine", slug: "mexican-pilot-001" },
        permissions: ["process_orders", "handle_payments", "view_reports", "manage_employees", "view_menu", "access_pos"]
      },
      {
        id: 4,
        username: "cashier",
        email: "carlos@mexicanrestaurant.com", 
        password: "cashier123",
        role: "employee",
        name: "Carlos Garcia",
        restaurant: { id: 1, name: "Authentic Mexican Cuisine", slug: "mexican-pilot-001" },
        permissions: ["process_orders", "handle_payments", "view_menu", "access_pos"]
      }
    ];
  }

  async logout(): Promise<void> {
    try {
      await this.apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } catch (error) {
      console.log('API logout failed (expected for test users):', error);
    } finally {
      // Always clear local session data
      this.authToken = null;
      await AsyncStorage.multiRemove(['auth_token', 'user_data']);
      console.log('✅ User session cleared');
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
      const response = await this.apiRequest('/api/v1/products/categories', {
        method: 'GET',
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      throw error; // Re-throw the error
    }
  }

  // Menu operations - Get menu items formatted for POS screen
  async getMenuItems(): Promise<any[]> {
    try {
      const response = await this.apiRequest('/api/v1/menu/items', {
        method: 'GET',
      });
      
      if (response.data) {
        // Apply compatibility transformation if needed
        if (BackendCompatibilityService.needsMenuTransformation(response.data)) {
          console.log('🔄 Applying menu compatibility transformation in DatabaseService');
          return BackendCompatibilityService.transformMenuItems(response.data);
        }
        return response.data;
      }
      
      console.warn('🚨 Production Mode: API returned no menu data');
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch menu items from API:', error);
      console.warn('🍮 TEMPORARY: Using Chucho menu data while API is being fixed');
      // TEMPORARY: Return Chucho menu while we fix the API timeout issue
      return this.getChuchoMenuData();
    }
  }

  async getMenuCategories(): Promise<any[]> {
    try {
      const response = await this.apiRequest('/api/v1/menu/categories', {
        method: 'GET',
      });
      
      return response.data || this.getMexicanCategoriesFallback();
    } catch (error) {
      console.error('Failed to fetch menu categories:', error);
      // Return Mexican categories as fallback
      return this.getMexicanCategoriesFallback();
    }
  }

  // Create operations for categories
  async createCategory(categoryData: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    sort_order?: number;
  }): Promise<any> {
    try {
      const response = await this.apiRequest('/api/v1/products/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categoryData),
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to create category:', error);
      throw error;
    }
  }

  async updateCategory(categoryId: string, categoryData: Partial<{
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    sort_order?: number;
    is_active?: boolean;
  }>): Promise<any> {
    // TODO: Backend needs to implement PUT /api/v1/products/categories/{categoryId}
    throw new Error('Category update endpoint not yet implemented in backend. Please contact system administrator.');
  }

  async deleteCategory(categoryId: string): Promise<void> {
    // TODO: Backend needs to implement DELETE /api/v1/products/categories/{categoryId}
    throw new Error('Category deletion endpoint not yet implemented in backend. Please contact system administrator.');
  }

  // Create operations for products
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
    modifiers?: any[];
    stock_tracking?: boolean;
    stock_quantity?: number;
  }): Promise<any> {
    try {
      const response = await this.apiRequest('/api/v1/products/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to create product:', error);
      throw error;
    }
  }

  async updateProduct(productId: string, productData: Partial<{
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
    modifiers?: any[];
    stock_tracking?: boolean;
    stock_quantity?: number;
    is_active?: boolean;
  }>): Promise<any> {
    try {
      const response = await this.apiRequest(`/api/v1/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to update product:', error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.apiRequest(`/api/v1/products/${productId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete product:', error);
      throw error;
    }
  }

  // Import Chucho menu data
  private getChuchoMenuData(): any[] {
    // Transform menu items to match expected format
    return CHUCHO_MENU_ITEMS.map(item => ({
      ...item,
      emoji: item.image, // Map image to emoji field for compatibility
    }));
  }

  // Fallback Mexican menu data - preserves existing functionality (DEPRECATED - use getChuchoMenuData instead)
  // DEPRECATED: Mock menu fallback functions have been removed for production readiness
  // Menu data should come from API or real restaurant configurations

  private getChuchoCategoriesData(): any[] {
    // Transform categories to match expected format
    return CHUCHO_CATEGORIES.map(cat => ({
      ...cat,
      active: true, // All categories are active
    }));
  }

  private getMexicanCategoriesFallback(): any[] {
    // This function is deprecated. We now use Chucho's actual categories.
    // Redirecting to Chucho categories to ensure consistency
    return this.getChuchoCategoriesData();
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
    try {
      const response = await this.apiRequest('/api/v1/customers', {
        method: 'GET',
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      // Return empty array instead of throwing to prevent app crashes
      return [];
    }
  }

  async getInventory(): Promise<any[]> {
    // Alias for getInventoryItems
    return this.getInventoryItems();
  }

  async getInventoryItems(): Promise<any[]> {
    try {
      const response = await this.apiRequest('/api/v1/inventory', {
        method: 'GET',
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch inventory items:', error);
      throw new Error('Backend connection required for inventory data');
    }
  }

  async getEmployees(): Promise<any[]> {
    try {
      const response = await this.apiRequest('/api/v1/employees', {
        method: 'GET',
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch employees from API:', error);
      throw new Error('Backend connection required for employee data');
    }
  }

  async getWeekSchedule(weekStart: Date, employees: any[]): Promise<any | null> {
    try {
      // FIXED: Use GET request instead of POST to match backend
      const response = await this.apiRequest('/api/v1/schedule/week', {
        method: 'GET',
      });
      
      console.log('✅ Schedule API response received:', response);
      return response.data || null;
    } catch (error) {
      console.error('Failed to fetch week schedule:', error);
      throw new Error('Backend connection required for schedule data');
    }
  }

  async getOrders(limit: number = 100): Promise<any[]> {
    try {
      const response = await this.apiRequest(`/api/v1/orders?limit=${limit}`, {
        method: 'GET',
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      return [];
    }
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
    try {
      const response = await this.apiRequest('/api/v1/analytics/dashboard', {
        method: 'GET',
      });
      
      return response.data || null;
    } catch (error) {
      console.error('Failed to fetch analytics dashboard:', error);
      throw new Error('Backend connection required for analytics dashboard data');
    }
  }

  async getUserProfile(): Promise<any | null> {
    console.warn('DatabaseService.getUserProfile is a stub and not implemented.');
    // Example: return this.apiRequest('/api/v1/users/profile');
    throw new Error('DatabaseService.getUserProfile not implemented yet');
  }
}

export default DatabaseService; 