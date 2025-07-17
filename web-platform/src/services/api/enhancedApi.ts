import { supabase } from '@/integrations/supabase/client';
import { API_CONFIG, API_ENDPOINTS, buildEndpoint } from '@/config/api.config';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

const cache = new APICache();

interface APIResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

interface RetryOptions {
  maxRetries: number;
  delay: number;
  backoff: number;
}

class EnhancedAPIService {
  private defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    delay: 1000,
    backoff: 2
  };

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useCache = true,
    cacheKey?: string,
    retryOptions = this.defaultRetryOptions
  ): Promise<APIResponse<T>> {
    const key = cacheKey || `${endpoint}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (useCache) {
      const cached = cache.get<T>(key);
      if (cached) {
        return { data: cached, error: null, success: true };
      }
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...options.headers as Record<string, string>
        };

        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(endpoint, {
          ...options,
          headers
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache successful responses
        if (useCache) {
          cache.set(key, data);
        }

        return { data, error: null, success: true };

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (error instanceof Error && error.message.includes('401')) {
          break;
        }

        if (attempt < retryOptions.maxRetries) {
          const delay = retryOptions.delay * Math.pow(retryOptions.backoff, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return { 
      data: null, 
      error: lastError?.message || 'Request failed', 
      success: false 
    };
  }

  // Restaurant API methods
  async getRestaurants(params?: Record<string, any>): Promise<APIResponse<any[]>> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.makeRequest(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.PLATFORM_RESTAURANTS}${queryString}`);
  }

  async getRestaurant(id: string): Promise<APIResponse<any>> {
    const endpoint = buildEndpoint(API_ENDPOINTS.RESTAURANT_DETAILS, { id });
    return this.makeRequest(
      `${API_CONFIG.BASE_URL}${endpoint}`,
      {},
      true,
      `restaurant_${id}`
    );
  }

  async createRestaurant(data: any): Promise<APIResponse<any>> {
    const result = await this.makeRequest(
      `${API_CONFIG.BASE_URL}${API_ENDPOINTS.PLATFORM_RESTAURANTS}`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      },
      false
    );
    
    // Invalidate restaurant list cache
    cache.invalidate('restaurants');
    return result;
  }

  async updateRestaurant(id: string, data: any): Promise<APIResponse<any>> {
    const endpoint = buildEndpoint(API_ENDPOINTS.RESTAURANT_UPDATE, { id });
    const result = await this.makeRequest(
      `${API_CONFIG.BASE_URL}${endpoint}`,
      {
        method: 'PUT',
        body: JSON.stringify(data)
      },
      false
    );
    
    // Invalidate specific restaurant and list cache
    cache.invalidate(`restaurant_${id}`);
    cache.invalidate('restaurants');
    return result;
  }

  // Orders API methods
  async getOrders(restaurantId: string, params?: Record<string, any>): Promise<APIResponse<any[]>> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const endpoint = buildEndpoint(API_ENDPOINTS.ORDERS_LIST, { id: restaurantId });
    return this.makeRequest(
      `${API_CONFIG.BASE_URL}${endpoint}${queryString}`,
      {},
      true,
      `orders_${restaurantId}_${JSON.stringify(params)}`,
      { maxRetries: 2, delay: 500, backoff: 1.5 } // Faster retry for orders
    );
  }

  async getOrder(restaurantId: string, orderId: string): Promise<APIResponse<any>> {
    const endpoint = buildEndpoint(API_ENDPOINTS.ORDER_DETAILS, { id: restaurantId, orderId });
    return this.makeRequest(
      `${API_CONFIG.BASE_URL}${endpoint}`,
      {},
      true,
      `order_${orderId}`
    );
  }

  async createOrder(restaurantId: string, orderData: any): Promise<APIResponse<any>> {
    const endpoint = buildEndpoint(API_ENDPOINTS.ORDER_CREATE, { id: restaurantId });
    const result = await this.makeRequest(
      `${API_CONFIG.BASE_URL}${endpoint}`,
      {
        method: 'POST',
        body: JSON.stringify(orderData)
      },
      false
    );
    
    // Invalidate orders cache
    cache.invalidate(`orders_${restaurantId}`);
    return result;
  }

  async updateOrderStatus(restaurantId: string, orderId: string, status: string): Promise<APIResponse<any>> {
    const endpoint = buildEndpoint(API_ENDPOINTS.ORDER_STATUS, { id: restaurantId, orderId });
    const result = await this.makeRequest(
      `${API_CONFIG.BASE_URL}${endpoint}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status })
      },
      false
    );
    
    // Invalidate order cache
    cache.invalidate(`order_${orderId}`);
    cache.invalidate(`orders_${restaurantId}`);
    return result;
  }

  // Menu API methods
  async getMenuItems(restaurantId: string, params?: Record<string, any>): Promise<APIResponse<any[]>> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const endpoint = buildEndpoint(API_ENDPOINTS.MENU_LIST, { id: restaurantId });
    return this.makeRequest(
      `${API_CONFIG.BASE_URL}${endpoint}${queryString}`,
      {},
      true,
      `menu_items_${restaurantId}`
    );
  }

  async getMenuCategories(restaurantId: string): Promise<APIResponse<any[]>> {
    const endpoint = buildEndpoint(API_ENDPOINTS.MENU_LIST, { id: restaurantId });
    return this.makeRequest(
      `${API_CONFIG.BASE_URL}${endpoint}/categories`,
      {},
      true,
      `menu_categories_${restaurantId}`
    );
  }

  async createMenuItem(restaurantId: string, itemData: any): Promise<APIResponse<any>> {
    const endpoint = buildEndpoint(API_ENDPOINTS.MENU_ITEM_CREATE, { id: restaurantId });
    const result = await this.makeRequest(
      `${API_CONFIG.BASE_URL}${endpoint}`,
      {
        method: 'POST',
        body: JSON.stringify(itemData)
      },
      false
    );
    
    cache.invalidate(`menu_items_${restaurantId}`);
    return result;
  }

  // Analytics API methods
  async getAnalytics(restaurantId: string, params?: Record<string, any>): Promise<APIResponse<any>> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const endpoint = buildEndpoint(API_ENDPOINTS.ANALYTICS_SALES, { id: restaurantId });
    return this.makeRequest(
      `${API_CONFIG.BASE_URL}${endpoint}${queryString}`,
      {},
      true,
      `analytics_${restaurantId}_${JSON.stringify(params)}`,
      { maxRetries: 1, delay: 2000, backoff: 1 } // Less aggressive retry for analytics
    );
  }

  async getPlatformAnalytics(params?: Record<string, any>): Promise<APIResponse<any>> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.makeRequest(
      `${API_CONFIG.BASE_URL}${API_ENDPOINTS.PLATFORM_OVERVIEW}${queryString}`,
      {},
      true,
      `platform_analytics_${JSON.stringify(params)}`
    );
  }

  // Utility methods
  clearCache(): void {
    cache.clear();
  }

  invalidateCache(pattern: string): void {
    cache.invalidate(pattern);
  }

  // Health check
  async healthCheck(): Promise<APIResponse<{ status: string; timestamp: number }>> {
    return this.makeRequest(
      '/api/health',
      {},
      false,
      undefined,
      { maxRetries: 1, delay: 1000, backoff: 1 }
    );
  }
}

export const apiService = new EnhancedAPIService();

// Rate limiting decorator
export function rateLimit(maxCalls: number, windowMs: number) {
  const calls: number[] = [];
  
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const now = Date.now();
      
      // Remove old calls outside the window
      while (calls.length > 0 && calls[0] <= now - windowMs) {
        calls.shift();
      }
      
      if (calls.length >= maxCalls) {
        throw new Error(`Rate limit exceeded. Max ${maxCalls} calls per ${windowMs}ms`);
      }
      
      calls.push(now);
      return method.apply(this, args);
    };
  };
}