// DatabaseService.ts - Mobile database API service for CashApp POS
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

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
      // Get the current Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        this.authToken = session.access_token;
      } else {
        // Fallback to stored token (legacy support)
        this.authToken = await AsyncStorage.getItem('auth_token');
      }
    } catch (error) {
      console.error('Error loading auth token:', error);
    }
  }

  private async saveAuthToken(token: string): Promise<void> {
    try {
      this.authToken = token;
      // Still save to AsyncStorage for backward compatibility
      await AsyncStorage.setItem('auth_token', token);
    } catch (error) {
      console.error('Error saving auth token:', error);
    }
  }

  private async getAuthToken(): Promise<string | null> {
    // First try to get fresh token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      return session.access_token;
    }
    // Fallback to stored token
    return this.authToken;
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
        
        // Try to refresh the session
        const { data: { session }, error } = await supabase.auth.refreshSession();
        
        if (session && !error) {
          // Retry the request with new token
          const newHeaders = {
            ...headers,
            'Authorization': `Bearer ${session.access_token}`
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
      const response = await this.apiRequest('/api/v1/categories', {
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
      
      return response.data || this.getMexicanMenuFallback();
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
      // Return Mexican menu as fallback to preserve functionality
      return this.getMexicanMenuFallback();
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

  // Fallback Mexican menu data - preserves existing functionality
  private getMexicanMenuFallback(): any[] {
    return [
      // SNACKS
      { id: 1, name: 'Nachos', price: 5.00, category: 'Snacks', emoji: '🧀', available: true, description: 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander' },
      { id: 2, name: 'Quesadillas', price: 5.50, category: 'Snacks', emoji: '🫓', available: true, description: 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander' },
      { id: 3, name: 'Chorizo Quesadilla', price: 5.50, category: 'Snacks', emoji: '🌶️', available: true, description: 'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander' },
      { id: 4, name: 'Chicken Quesadilla', price: 5.50, category: 'Snacks', emoji: '🐔', available: true, description: 'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander' },
      { id: 5, name: 'Tostada', price: 6.50, category: 'Snacks', emoji: '🥙', available: true, description: 'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta' },
      
      // TACOS
      { id: 6, name: 'Carnitas', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander' },
      { id: 7, name: 'Cochinita', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Marinated pulled pork served with pickle red onion' },
      { id: 8, name: 'Barbacoa de Res', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Juicy pulled beef topped with onion, guacamole & coriander' },
      { id: 9, name: 'Chorizo', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole' },
      { id: 10, name: 'Rellena', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion' },
      { id: 11, name: 'Chicken Fajita', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander' },
      { id: 12, name: 'Haggis', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Haggis with beans, onion & chilli. Topped with coriander and pickled red onion' },
      { id: 13, name: 'Pescado', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa' },
      { id: 14, name: 'Dorados', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta' },
      { id: 15, name: 'Dorados Papa', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta' },
      { id: 16, name: 'Nopal', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Cactus, black beans & onion, topped with tomato salsa and crumbled feta' },
      { id: 17, name: 'Frijol', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Black beans with fried plantain served with tomato salsa, feta & coriander' },
      { id: 18, name: 'Verde', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Courgette & sweetcorn fried with garlic, served with tomato salsa and crumbled feta' },
      { id: 19, name: 'Fajita', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Mushrooms, peppers & onion with black beans. Topped with salsa, feta & coriander' },
      
      // SPECIAL TACOS
      { id: 20, name: 'Carne Asada', price: 4.50, category: 'Special Tacos', emoji: '⭐', available: true, description: 'Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander' },
      { id: 21, name: 'Camaron', price: 4.50, category: 'Special Tacos', emoji: '🦐', available: true, description: 'Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole' },
      { id: 22, name: 'Pulpos', price: 4.50, category: 'Special Tacos', emoji: '🐙', available: true, description: 'Chargrilled octopus, cooked with peppers and red onion. Served on grilled potato with garlic & coriander' },
      
      // BURRITOS
      { id: 23, name: 'Regular Burrito', price: 8.00, category: 'Burritos', emoji: '🌯', available: true, description: 'Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.' },
      { id: 24, name: 'Special Burrito', price: 10.00, category: 'Burritos', emoji: '🌯', available: true, description: 'Choose any filling from the special tacos menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.' },
      { id: 25, name: 'Add Mozzarella', price: 1.00, category: 'Burritos', emoji: '🧀', available: true, description: 'Add extra cheese to any burrito' },
      
      // SIDES & SALSAS
      { id: 26, name: 'Skinny Fries', price: 3.50, category: 'Sides', emoji: '🍟', available: true, description: 'Thin cut fries' },
      { id: 27, name: 'Pico de Gallo', price: 0.00, category: 'Sides', emoji: '🍅', available: true, description: 'Diced tomato, onion and chilli - FREE!' },
      { id: 28, name: 'Green Chili', price: 0.00, category: 'Sides', emoji: '🌶️', available: true, description: 'Homemade green chili salsa - HOT! - FREE!' },
      { id: 29, name: 'Pineapple Habanero', price: 0.00, category: 'Sides', emoji: '🍍', available: true, description: 'Pineapple sauce with habanero chili - HOT! - FREE!' },
      { id: 30, name: 'Scotch Bonnet', price: 0.00, category: 'Sides', emoji: '🔥', available: true, description: 'Homemade spicy salsa made with scotch bonnet chilies - VERY HOT! - FREE!' },
      
      // DRINKS
      { id: 31, name: 'Pink Paloma', price: 3.75, category: 'Drinks', emoji: '🍹', available: true, description: 'An alcohol-free version of our refreshing cocktail. Tangy lime juice and grapefruit soda, with a splash of grenadine' },
      { id: 32, name: 'Coco-Nought', price: 3.75, category: 'Drinks', emoji: '🥥', available: true, description: 'Coconut, pineapple juice and milk, blended into a creamy, sweet, alcohol-free treat!' },
      { id: 33, name: 'Corona', price: 3.80, category: 'Drinks', emoji: '🍺', available: true, description: 'Mexican beer' },
      { id: 34, name: 'Modelo', price: 4.00, category: 'Drinks', emoji: '🍺', available: true, description: 'Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml' },
      { id: 35, name: 'Pacifico', price: 4.00, category: 'Drinks', emoji: '🍺', available: true, description: 'Pilsner style Lager from the Pacific Ocean city of Mazatlán. 355ml' },
      { id: 36, name: 'Dos Equis', price: 4.00, category: 'Drinks', emoji: '🍺', available: true, description: '"Two X\'s". German brewing heritage with the spirit of Mexican traditions. 355ml' },
    ];
  }

  private getMexicanCategoriesFallback(): any[] {
    return [
      { id: 1, name: 'All', active: true },
      { id: 2, name: 'Snacks', active: true },
      { id: 3, name: 'Tacos', active: true },
      { id: 4, name: 'Special Tacos', active: true },
      { id: 5, name: 'Burritos', active: true },
      { id: 6, name: 'Sides', active: true },
      { id: 7, name: 'Drinks', active: true },
    ];
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