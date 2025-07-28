import { apiService } from './baseApi';
import { 
  Restaurant, 
  Order, 
  Product, 
  ProductCategory,
  User,
  APIResponse 
} from '../../types';
import { API_ENDPOINTS } from '@/config/api.config';

/**
 * Restaurant API Service
 * Uses shared types from @fynlo/shared
 */
export class RestaurantApiService {
  /**
   * Get all restaurants for the platform
   */
  async getRestaurants(): Promise<APIResponse<Restaurant[]>> {
    try {
      const data = await apiService.get<Restaurant[]>(API_ENDPOINTS.RESTAURANTS.LIST);
      return {
        success: true,
        data,
        message: 'Restaurants fetched successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Failed to fetch restaurants'
      };
    }
  }

  /**
   * Get a single restaurant by ID
   */
  async getRestaurant(id: string): Promise<APIResponse<Restaurant>> {
    try {
      const data = await apiService.get<Restaurant>(
        API_ENDPOINTS.RESTAURANTS.DETAIL.replace(':id', id)
      );
      return {
        success: true,
        data,
        message: 'Restaurant fetched successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Failed to fetch restaurant'
      };
    }
  }

  /**
   * Create a new restaurant
   */
  async createRestaurant(restaurant: Partial<Restaurant>): Promise<APIResponse<Restaurant>> {
    try {
      const data = await apiService.post<Restaurant>(
        API_ENDPOINTS.RESTAURANTS.CREATE,
        restaurant
      );
      return {
        success: true,
        data,
        message: 'Restaurant created successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Failed to create restaurant'
      };
    }
  }

  /**
   * Update restaurant details
   */
  async updateRestaurant(id: string, updates: Partial<Restaurant>): Promise<APIResponse<Restaurant>> {
    try {
      const data = await apiService.put<Restaurant>(
        API_ENDPOINTS.RESTAURANTS.UPDATE.replace(':id', id),
        updates
      );
      return {
        success: true,
        data,
        message: 'Restaurant updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Failed to update restaurant'
      };
    }
  }

  /**
   * Get restaurant orders
   */
  async getRestaurantOrders(restaurantId: string): Promise<APIResponse<Order[]>> {
    try {
      const data = await apiService.get<Order[]>(
        API_ENDPOINTS.ORDERS.BY_RESTAURANT.replace(':restaurantId', restaurantId)
      );
      return {
        success: true,
        data,
        message: 'Orders fetched successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Failed to fetch orders'
      };
    }
  }

  /**
   * Get restaurant products/menu items
   */
  async getRestaurantProducts(restaurantId: string): Promise<APIResponse<Product[]>> {
    try {
      const data = await apiService.get<Product[]>(
        API_ENDPOINTS.PRODUCTS.BY_RESTAURANT.replace(':restaurantId', restaurantId)
      );
      return {
        success: true,
        data,
        message: 'Products fetched successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Failed to fetch products'
      };
    }
  }

  /**
   * Get restaurant product categories
   */
  async getRestaurantCategories(restaurantId: string): Promise<APIResponse<ProductCategory[]>> {
    try {
      const data = await apiService.get<ProductCategory[]>(
        API_ENDPOINTS.CATEGORIES.BY_RESTAURANT.replace(':restaurantId', restaurantId)
      );
      return {
        success: true,
        data,
        message: 'Categories fetched successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Failed to fetch categories'
      };
    }
  }

  /**
   * Get restaurant staff
   */
  async getRestaurantStaff(restaurantId: string): Promise<APIResponse<User[]>> {
    try {
      const data = await apiService.get<User[]>(
        API_ENDPOINTS.STAFF.BY_RESTAURANT.replace(':restaurantId', restaurantId)
      );
      return {
        success: true,
        data,
        message: 'Staff fetched successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Failed to fetch staff'
      };
    }
  }
}

export const restaurantApi = new RestaurantApiService();