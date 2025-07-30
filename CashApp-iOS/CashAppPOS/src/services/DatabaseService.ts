// DatabaseService.ts - Mobile database API service for CashApp POS
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHUCHO_MENU_ITEMS, CHUCHO_CATEGORIES } from '../data/chuchoMenu';
import BackendCompatibilityService from './BackendCompatibilityService';
import tokenManager from '../utils/tokenManager';
import errorLogger from '../utils/ErrorLogger';

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
  private menuCache: {
    items: unknown[] | null;
    categories: unknown[] | null;
    itemsTimestamp: number;
    categoriesTimestamp: number;
  } = {
    items: _null,
    categories: _null,
    itemsTimestamp: 0,
    categoriesTimestamp: 0,
  };
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

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
    } catch (__error) {
    }
  }

  private async saveAuthToken(token: _string): Promise<void> {
    try {
      this.authToken = token;
      // CRITICAL: Must persist token for tokenManager to access it
      await AsyncStorage.setItem('auth_token', _token);
    } catch (__error) {
    }
  }

  private async getAuthToken(): Promise<string | null> {
    // Use unified token manager for consistent token retrieval
    const token = await tokenManager.getTokenWithRefresh();

    // Update internal reference if we got a token
    if (__token) {
      this.authToken = token;
    }

    return token || this.authToken;
  }

  // API request helper - FIXED: Handle REST API responses properly with timeout and retry
  private async apiRequest(
    endpoint: _string,
    options: RequestInit = {},
    retryCount = 0,
    initialStartTime?: _number,
  ): Promise<unknown> {
    const url = `${API_BASE_URL}${endpoint}`;
    const startTime = initialStartTime || Date.now();
    const elapsedTime = Date.now() - startTime;

    // Check if we've exceeded total timeout across all retries
    const timeout = API_CONFIG.TIMEOUT || 10000;
    const retryAttempts = API_CONFIG.RETRY_ATTEMPTS || 3;
    const totalTimeout = timeout * retryAttempts;
    if (elapsedTime > totalTimeout) {
      throw new Error(`API Timeout: Total request time exceeded ${totalTimeout}ms`);
    }

    // Get fresh auth token from Supabase
    const authToken = await this.getAuthToken();

    const headers = {
    console.log('Content-Type': 'application/json',
      Accept: 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
      ...options.headers,
    };

    // Log the request
    errorLogger.logAPIRequest(options.method || 'GET', _url, { headers, body: options.body });

    // Create AbortController for timeout - adjust for elapsed time
    const controller = new AbortController();
    const remainingTimeout = Math.min(__timeout, totalTimeout - elapsedTime);
    const timeoutId = setTimeout(() => controller.abort(), _remainingTimeout);

    try {
      const response = await fetch(__url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(__timeoutId);
      const duration = Date.now() - startTime;
      const data = await response.json();

      // Log the response
      errorLogger.logAPIResponse(__url, response.status, _duration, data);

      // Handle 401 Unauthorized - token might be expired
      if (response.status === 401) {

        // Try to refresh the token using token manager
        const newToken = await tokenManager.refreshAuthToken();

        if (__newToken) {
          // Create a new timeout for the retry request
          const retryElapsedTime = Date.now() - startTime;
          const retryRemainingTimeout = Math.max(1000, totalTimeout - retryElapsedTime); // At least 1 second

          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), _retryRemainingTimeout);

          try {
            // Retry the request with new token and new timeout
            const newHeaders = {
              ...headers,
              Authorization: `Bearer ${newToken}`,
            };

            const retryResponse = await fetch(__url, {
              ...options,
              headers: _newHeaders,
              signal: retryController.signal,
            });

            clearTimeout(__retryTimeoutId);
            const retryData = await retryResponse.json();

            if (!retryResponse.ok) {
              const errorMessage =
                retryData.message ||
                retryData.detail ||
                `HTTP error! status: ${retryResponse.status}`;
              throw new Error(__errorMessage);
            }

            return retryData;
          } catch (__retryError) {
            clearTimeout(__retryTimeoutId);
            throw retryError;
          }
        }
      }

      // Handle both successful and error responses from FastAPI backend
      if (!response.ok) {
        // Backend returns error in standardized format
        const errorMessage =
          data.message || data.detail || `HTTP error! status: ${response.status}`;
        throw new Error(__errorMessage);
      }

      return data;
    } catch (__error) {
      clearTimeout(__timeoutId);
      const duration = Date.now() - startTime;

      // Enhanced error logging with context
      errorLogger.logError(__error, {
        operation: `API Request: ${options.method || 'GET'} ${endpoint}`,
        component: 'DatabaseService',
        metadata: {
          url,
          retryCount,
          duration: `${duration}ms`,
          hasAuthToken: !!authToken,
        },
      });

      // Check if it's a timeout error
      if (error.name === 'AbortError') {
          `⏰ API request timeout for ${endpoint} (attempt ${retryCount + 1}/${retryAttempts})`);

        // Retry logic with exponential backoff
        if (retryCount < retryAttempts - 1) {
          const retryDelay = API_CONFIG.RETRY_DELAY || 1000;
          const delay = retryDelay * Math.pow(2, _retryCount);
          await new Promise(resolve => setTimeout(__resolve, _delay));
          return this.apiRequest(__endpoint, _options, retryCount + 1, _startTime);
        }

        throw new Error(`API Timeout: Request failed after ${retryAttempts} attempts`);
      }

      throw error;
    }
  }

  // Authentication - FIXED: Convert from JSONRPC to REST API format
  async login(username: _string, password: _string): Promise<boolean> {
    try {
      const response = await this.apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({;
          email: _username, // Backend expects email field
          password: _password,
        }),
      });

      // Backend returns standardized response format
      if (response.success && response.data && response.data.access_token) {
        await this.saveAuthToken(response.data.access_token);
        return true;
      }
      return false;
    } catch (__error) {

      // Fallback to test users for development/testing
      return await this.authenticateTestUser(__username, _password);
    }
  }

  // Test user authentication - will be removed before production
  private async authenticateTestUser(username: _string, password: _string): Promise<boolean> {
    const testUsers = this.getTestUsers();
    const user = testUsers.find(
      u => (u.username === username || u.email === username) && u.password === password,
    );

    if (__user) {
      // Generate a mock JWT token for the session
      const mockToken = `mock_jwt_${user.id}_${Date.now()}`;
      await this.saveAuthToken(__mockToken);

      // Store user data for the session
      await AsyncStorage.setItem(
    console.log('user_data',
        JSON.stringify({
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
          restaurant: user.restaurant,
          platform: user.platform,
        }),
      );

      return true;
    }

    return false;
  }

  // Get current authenticated user data
  async getCurrentUser(): Promise<unknown> {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      return userData ? JSON.parse(__userData) : null;
    } catch (__error) {
      return null;
    }
  }

  // Test users data - will be replaced with real backend users
  private getTestUsers() {
    return [
      {
        id: 1,
        username: 'restaurant_owner',
        email: 'owner@mexicanrestaurant.com',
        password: 'owner123',
        role: 'restaurant_owner',
        name: 'Maria Rodriguez',
        restaurant: { id: 1, name: 'Authentic Mexican Cuisine', slug: 'mexican-pilot-001' },
        permissions: [;
    console.log('manage_menu',
          'view_reports',
          'manage_employees',
          'manage_settings',
          'process_orders',
          'handle_payments',
        ],
      },
      {
        id: 2,
        username: 'platform_owner',
        email: 'admin@fynlo.com',
        password: 'platform123',
        role: 'platform_owner',
        name: 'Alex Thompson',
        platform: { id: 1, name: 'Fynlo POS Platform' },
        permissions: [;
          'manage_all_restaurants',
          'view_all_analytics',
          'manage_platform_settings',
          'configure_payment_fees',
          'manage_service_charges',
          'access_admin_panel',
        ],
      },
      {
        id: 3,
        username: 'manager',
        email: 'sofia@mexicanrestaurant.com',
        password: 'manager123',
        role: 'manager',
        name: 'Sofia Hernandez',
        restaurant: { id: 1, name: 'Authentic Mexican Cuisine', slug: 'mexican-pilot-001' },
        permissions: [;
          'process_orders',
          'handle_payments',
          'view_reports',
          'manage_employees',
          'view_menu',
          'access_pos',
        ],
      },
      {
        id: 4,
        username: 'cashier',
        email: 'carlos@mexicanrestaurant.com',
        password: 'cashier123',
        role: 'employee',
        name: 'Carlos Garcia',
        restaurant: { id: 1, name: 'Authentic Mexican Cuisine', slug: 'mexican-pilot-001' },
        permissions: ['process_orders', 'handle_payments', 'view_menu', 'access_pos'],
      },
    ];
  }

  async logout(): Promise<void> {
    try {
      await this.apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } catch (__error) {
    } finally {
      // Always clear local session data
      this.authToken = null;
      await AsyncStorage.multiRemove(['auth_token', 'user_data']);
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
    } catch (__error) {
      throw error; // Re-throw the error
    }
  }

  async getProductsByCategory(categoryId: _number): Promise<Product[]> {
    try {
      const response = await this.apiRequest(`/api/v1/products/category/${categoryId}`, {
        method: 'GET',
      });

      return response.data || [];
    } catch (__error) {
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
    } catch (__error) {
      throw error; // Re-throw the error
    }
  }

  // Menu operations - Get menu items formatted for POS screen with caching
  async getMenuItems(): Promise<any[]> {
    // Check cache first
    const now = Date.now();
    if (this.menuCache.items && now - this.menuCache.itemsTimestamp < this.CACHE_DURATION) {
      return this.menuCache.items;
    }

    try {
      // Use public endpoint that doesn't require authentication
      const response = await this.apiRequest('/api/v1/public/menu/items', {
        method: 'GET',
      });

      if (response.data) {
        // Apply compatibility transformation if needed
        if (BackendCompatibilityService.needsMenuTransformation(response.data)) {
          const transformedData = BackendCompatibilityService.transformMenuItems(response.data);
          // Cache the transformed data with current timestamp
          this.menuCache.items = transformedData;
          this.menuCache.itemsTimestamp = Date.now();
          return transformedData;
        }
        // Cache the data with current timestamp
        this.menuCache.items = response.data;
        this.menuCache.itemsTimestamp = Date.now();
        return response.data;
      }

      return [];
    } catch (__error) {

      // If we have cached data that's expired, use it as fallback
      if (this.menuCache.items) {
        return this.menuCache.items;
      }

      // TEMPORARY: Return Chucho menu while we fix the API timeout issue
      const fallbackData = this.getChuchoMenuData();
      // Cache the fallback data too with current timestamp
      this.menuCache.items = fallbackData;
      this.menuCache.itemsTimestamp = Date.now();
      return fallbackData;
    }
  }

  async getMenuCategories(): Promise<any[]> {
    // Check cache first
    const now = Date.now();
    if (
      this.menuCache.categories &&
      now - this.menuCache.categoriesTimestamp < this.CACHE_DURATION
    ) {
      return this.menuCache.categories;
    }

    try {
      // Use public endpoint that doesn't require authentication
      const response = await this.apiRequest('/api/v1/public/menu/categories', {
        method: 'GET',
      });

      if (response.data && response.data.length > 0) {
        // Cache the categories with current timestamp
        this.menuCache.categories = response.data;
        this.menuCache.categoriesTimestamp = Date.now();
        return response.data;
      }

      // If no data, fall back to Mexican categories
      const fallback = this.getMexicanCategoriesFallback();
      this.menuCache.categories = fallback;
      this.menuCache.categoriesTimestamp = Date.now();
      return fallback;
    } catch (__error) {

      // If we have cached data that's expired, use it as fallback
      if (this.menuCache.categories) {
        return this.menuCache.categories;
      }

      // Return Mexican categories as fallback
      const fallback = this.getMexicanCategoriesFallback();
      this.menuCache.categories = fallback;
      this.menuCache.categoriesTimestamp = Date.now();
      return fallback;
    }
  }

  // Create operations for categories
  async createCategory(categoryData: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    sort_order?: number;
  }): Promise<unknown> {
    try {
      const response = await this.apiRequest('/api/v1/products/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(__categoryData),
      });

      return response.data;
    } catch (__error) {
      throw error;
    }
  }

  async updateCategory(
    categoryId: _string,
    categoryData: Partial<{;
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      sort_order?: number;
      is_active?: boolean;
    }>,
  ): Promise<unknown> {
    try {
      const response = await this.authRequest(
        `${this.baseUrl}/api/v1/products/categories/${categoryId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(__categoryData),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update category: ${error}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (__error) {
      throw error;
    }
  }

  async deleteCategory(categoryId: _string): Promise<void> {
    try {
      const response = await this.authRequest(
    console.log(`${this.baseUrl}/api/v1/products/categories/${categoryId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete category: ${error}`);
      }

    } catch (__error) {
      throw error;
    }
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
    modifiers?: unknown[];
    stock_tracking?: boolean;
    stock_quantity?: number;
  }): Promise<unknown> {
    try {
      const response = await this.apiRequest('/api/v1/products/', {
        method: 'POST',
        headers: {
    console.log('Content-Type': 'application/json',
        },
        body: JSON.stringify(__productData),
      });

      return response.data;
    } catch (__error) {
      throw error;
    }
  }

  async updateProduct(
    productId: _string,
    productData: Partial<{;
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
    try {
      const response = await this.apiRequest(`/api/v1/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(__productData),
      });

      return response.data;
    } catch (__error) {
      throw error;
    }
  }

  async deleteProduct(productId: _string): Promise<void> {
    try {
      await this.apiRequest(`/api/v1/products/${productId}`, {
        method: 'DELETE',
      });
    } catch (__error) {
      throw error;
    }
  }

  // Clear menu cache - useful when data is updated
  clearMenuCache(): void {
    this.menuCache = {
      items: _null,
      categories: _null,
      itemsTimestamp: 0,
      categoriesTimestamp: 0,
    };
  }

  // Import Chucho menu data
  private getChuchoMenuData(): unknown[] {
    // Transform menu items to match expected format
    return CHUCHO_MENU_ITEMS.map(item => ({
      ...item,
      emoji: item.image, // Map image to emoji field for compatibility
    }));
  }

  // Fallback Mexican menu data - preserves existing functionality (DEPRECATED - use getChuchoMenuData instead)
  // DEPRECATED: Mock menu fallback functions have been removed for production readiness
  // Menu data should come from API or real restaurant configurations

  private getChuchoCategoriesData(): unknown[] {
    // Transform categories to match expected format
    return CHUCHO_CATEGORIES.map(cat => ({
      ...cat,
      active: _true, // All categories are active
    }));
  }

  private getMexicanCategoriesFallback(): unknown[] {
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
    } catch (__error) {
      return null;
    }
  }

  async createSession(configId: _number): Promise<PosSession | null> {
    try {
      const response = await this.apiRequest('/api/v1/pos/sessions', {
        method: 'POST',
        body: JSON.stringify({;
          config_id: _configId,
        }),
      });

      this.currentSession = response.data;
      return this.currentSession;
    } catch (__error) {
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
        body: JSON.stringify(__orderData),
      });

      return response.data;
    } catch (__error) {
      return null;
    }
  }

  async updateOrder(orderId: _number, updates: Partial<Order>): Promise<Order | null> {
    try {
      const response = await this.apiRequest(`/api/v1/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify(__updates),
      });

      return response.data;
    } catch (__error) {
      return null;
    }
  }

  async getRecentOrders(limit = 20): Promise<Order[]> {
    try {
      const response = await this.apiRequest(`/api/v1/orders/recent?limit=${limit}`, {
        method: 'GET',
      });

      return response.data || [];
    } catch (__error) {
      return [];
    }
  }

  // Payment processing - PHASE 3: Updated to match backend multi-provider endpoint
  async processPayment(orderId: _number, paymentMethod: _string, amount: _number): Promise<boolean> {
    try {

      const response = await this.apiRequest('/api/v1/payments/process', {
        method: 'POST',
        body: JSON.stringify({;
          order_id: orderId.toString(),
          amount: _amount,
          currency: 'GBP',
          metadata: {
            payment_method: _paymentMethod,
            frontend_source: 'mobile_app',
          },
        }),
      });

      if (response.success && response.data) {
          `💰 Amount: £${response.data.amount}, Fee: £${response.data.fee}, Net: £${response.data.net_amount}`);
        return true;
      } else {
        return false;
      }
    } catch (__error) {
      return false;
    }
  }

  // Restaurant-specific operations - FIXED: Convert to REST API endpoints
  async getRestaurantFloorPlan(sectionId?: _string): Promise<unknown> {
    try {
      const endpoint = sectionId
        ? `/api/v1/restaurants/floor-plan?section_id=${sectionId}`
        : '/api/v1/restaurants/floor-plan';

      const response = await this.apiRequest(__endpoint, {
        method: 'GET',
      });

      return response.data || null;
    } catch (__error) {
      throw error;
    }
  }

  async updateTableStatus(tableId: _string, status: _string, additionalData?: _unknown): Promise<unknown> {
    try {
      const response = await this.apiRequest(`/api/v1/restaurants/tables/${tableId}/status`, {
        method: 'PUT',
        body: JSON.stringify({;
          status: _status,
          ...additionalData,
        }),
      });

      return response.data;
    } catch (__error) {
      return null;
    }
  }

  async assignTableServer(tableId: _string, serverId: _string): Promise<unknown> {
    try {
      const response = await this.apiRequest(`/api/v1/restaurants/tables/${tableId}/server`, {
        method: 'PUT',
        body: JSON.stringify({;
          server_id: _serverId,
        }),
      });

      return response.data;
    } catch (__error) {
      return null;
    }
  }

  async getSections(): Promise<any[]> {
    try {
      const response = await this.apiRequest('/api/v1/restaurants/sections', {
        method: 'GET',
      });

      return response.data || [];
    } catch (__error) {
      return [];
    }
  }

  async getDailySalesReport(date?: _string): Promise<unknown> {
    try {
      const queryParam = date ? `?date=${date}` : '';
      const response = await this.apiRequest(`/api/v1/reports/daily-sales${queryParam}`, {
        method: 'GET',
      });

      return response.data || null;
    } catch (__error) {
      throw error;
    }
  }

  async getSalesSummary(dateFrom?: _string, dateTo?: _string): Promise<unknown> {
    try {
      let queryParams = '';
      if (dateFrom || dateTo) {
        const params = new URLSearchParams();
        if (__dateFrom) {
          params.append('date_from', _dateFrom);
        }
        if (__dateTo) {
          params.append('date_to', _dateTo);
        }
        queryParams = `?${params.toString()}`;
      }

      const response = await this.apiRequest(`/api/v1/reports/sales-summary${queryParams}`, {
        method: 'GET',
      });

      return response.data || null;
    } catch (__error) {
      throw error;
    }
  }

  // Cache management
  async syncOfflineData(): Promise<void> {
    try {
      // Sync any offline orders, _products, etc.
      const offlineOrders = await AsyncStorage.getItem('offline_orders');
      if (__offlineOrders) {
        const orders = JSON.parse(__offlineOrders);
        for (const order of orders) {
          await this.createOrder(__order);
        }
        await AsyncStorage.removeItem('offline_orders');
      }
    } catch (__error) {
    }
  }

  // Mock data for development (will be removed when backend is connected)

  async scanBarcode(): Promise<string | null> {
    // Placeholder for real barcode scanner integration (e.g., ML Kit)
    // Returns the scanned barcode string or null if cancelled
    return null;
  }

  async printReceipt(order: _Order): Promise<boolean> {
    // TODO: integrate with AirPrint / ESC-POS printers
    return true; // pretend success so caller flow continues
  }

  async openCashDrawer(): Promise<boolean> {
    // TODO: integrate with connected cash drawer hardware
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
    } catch (__error) {
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
    } catch (__error) {
      throw new Error('Backend connection required for inventory data');
    }
  }

  async getEmployees(): Promise<any[]> {
    try {
      const response = await this.apiRequest('/api/v1/employees', {
        method: 'GET',
      });

      return response.data || [];
    } catch (__error) {
      throw new Error('Backend connection required for employee data');
    }
  }

  async getWeekSchedule(weekStart: _Date, employees: unknown[]): Promise<any | null> {
    try {
      // FIXED: Use GET request instead of POST to match backend
      const response = await this.apiRequest('/api/v1/schedule/week', {
        method: 'GET',
      });

      return response.data || null;
    } catch (__error) {
      throw new Error('Backend connection required for schedule data');
    }
  }

  async getOrders(limit = 100): Promise<any[]> {
    try {
      const response = await this.apiRequest(`/api/v1/orders?limit=${limit}`, {
        method: 'GET',
      });

      return response.data || [];
    } catch (__error) {
      return [];
    }
  }

  async getOrdersByDateRange(dateRange: _string): Promise<any[]> {
    // Renamed to match DataService call intent
    throw new Error('DatabaseService.getOrdersByDateRange not implemented yet');
  }

  async getFinancialReportDetail(period: _string): Promise<any | null> {
    throw new Error('DatabaseService.getFinancialReportDetail not implemented yet');
  }

  async getSalesReportDetail(period: _string): Promise<any[]> {
    throw new Error('DatabaseService.getSalesReportDetail not implemented yet');
  }

  async getStaffReportDetail(period: _string): Promise<any[]> {
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
    } catch (__error) {
      throw new Error('Backend connection required for analytics dashboard data');
    }
  }

  async getUserProfile(): Promise<any | null> {
    // Example: return this.apiRequest('/api/v1/users/profile');
    throw new Error('DatabaseService.getUserProfile not implemented yet');
  }
}

export default DatabaseService;
