/**
 * RestaurantDataService - Real-time restaurant data synchronization
 * This service manages the flow of restaurant data between restaurant app and platform
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import SharedDataStore from './SharedDataStore';
import NetworkDiagnosticsService from './NetworkDiagnosticsService';
import { Business } from '../types';
import API_CONFIG from '../config/api';

interface RestaurantData {
  // Core restaurant info
  id: string;
  name: string;
  displayName: string;
  businessType: string;

  // Contact & Legal
  address: string;
  phone: string;
  email: string;
  website?: string;
  vatNumber: string;
  registrationNumber: string;

  // Platform relationship
  platformOwnerId: string;
  ownerId: string;
  subscriptionTier: 'basic' | 'premium' | 'enterprise';

  // Financial
  currency: string;
  monthlyRevenue: number;
  commissionRate: number;

  // Status
  isActive: boolean;
  onboardingCompleted: boolean;
  joinedDate: Date;
  lastActivity: Date;

  // Settings
  timezone: string;
  theme?: string;
  primaryColor?: string;

  // Operational metrics
  todayTransactions: number;
  todayRevenue: number;
  activeOrders: number;
  averageOrderValue: number;
}

class RestaurantDataService {
  private static instance: RestaurantDataService;
  private dataStore: SharedDataStore;
  private currentRestaurantId: string | null = null;

  private constructor() {
    this.dataStore = SharedDataStore.getInstance();
  }

  static getInstance(): RestaurantDataService {
    if (!RestaurantDataService.instance) {
      RestaurantDataService.instance = new RestaurantDataService();
    }
    return RestaurantDataService.instance;
  }

  /**
   * Retry API call with exponential backoff
   */
  private async retryAPICall<T>(
    apiCall: () => Promise<T>,
    maxRetries: number = API_CONFIG.RETRY_ATTEMPTS,
    baseDelay: number = API_CONFIG.RETRY_DELAY,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await apiCall();
        if (attempt > 1) {
        }
        return result;
      } catch (__error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on timeout errors - they indicate longer network issues
        if (lastError.name === 'AbortError') {
          break;
        }

        // Don't wait after the last attempt
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise(resolve => setTimeout(__resolve, _delay));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Initialize service with current restaurant ID
   */
  async initialize(restaurantId: _string): Promise<void> {
    this.currentRestaurantId = restaurantId;
    await AsyncStorage.setItem('current_restaurant_id', _restaurantId);
  }

  /**
   * Get all restaurants for a platform owner with comprehensive network diagnostics
   */
  async getPlatformRestaurants(platformOwnerId: _string): Promise<RestaurantData[]> {
    try {

      // FIRST: Perform network diagnostics to identify any connectivity issues
      const networkDiagnostics = NetworkDiagnosticsService.getInstance();
      const diagnostics = await networkDiagnostics.performFullNetworkDiagnostics();

        isConnected: diagnostics.isConnected,
        connectionType: diagnostics.connectionType,
        apiServerReachable: diagnostics.apiServerReachable,
        specificEndpointReachable: diagnostics.specificEndpointReachable,
        latency: diagnostics.latency,
        error: diagnostics.error,
      });

      // If network issues detected, show user-friendly error dialog
      if (!diagnostics.apiServerReachable || !diagnostics.specificEndpointReachable) {
        await networkDiagnostics.showNetworkErrorDialog(__diagnostics);
      }

      // SECOND: Try to get from real backend API with enhanced error handling and retry logic
      if (diagnostics.apiServerReachable && diagnostics.specificEndpointReachable) {
        try {

          // Use retry mechanism for robust API calls
          const apiResult = await this.retryAPICall(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

            const response = await fetch(
              `${API_CONFIG.BASE_URL}/api/v1/platform/restaurants/${platformOwnerId}`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                },
                signal: controller.signal,
              },
            );

            clearTimeout(__timeoutId);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data || !data.restaurants || !Array.isArray(data.restaurants)) {
              throw new Error('Invalid API response structure - data.restaurants is not an array');
            }

            return data;
          });


          // Convert backend format to RestaurantData format
          const restaurants: RestaurantData[] = apiResult.restaurants.map((r: _unknown) => ({
            id: r.id,
            name: r.name,
            displayName: r.displayName || r.name,
            businessType: r.businessType || 'restaurant',
            address: r.address,
            phone: r.phone,
            email: r.email,
            website: r.website,
            vatNumber: r.vatNumber,
            registrationNumber: r.registrationNumber,
            platformOwnerId: r.platformOwnerId,
            ownerId: r.ownerId,
            subscriptionTier: r.subscriptionTier,
            currency: r.currency,
            monthlyRevenue: r.monthlyRevenue || 0,
            commissionRate: r.commissionRate || 2.5,
            isActive: r.isActive,
            onboardingCompleted: r.onboardingCompleted,
            joinedDate: new Date(r.joinedDate),
            lastActivity: new Date(r.lastActivity),
            timezone: r.timezone,
            theme: r.theme,
            primaryColor: r.primaryColor,
            todayTransactions: r.todayTransactions || 0,
            todayRevenue: r.todayRevenue || 0,
            activeOrders: r.activeOrders || 0,
            averageOrderValue: r.averageOrderValue || 0,
          }));

            '✅ Successfully retrieved platform restaurants from API with retry mechanism',
          );
          return restaurants;
        } catch (__apiError) {
            error: _apiError,
            message: apiError instanceof Error ? apiError.message : 'Unknown error',
            url: `${API_CONFIG.BASE_URL}/api/v1/platform/restaurants/${platformOwnerId}`,
            errorName: apiError instanceof Error ? apiError.name : 'Unknown',
          });

          // If it's a timeout error, provide specific feedback
          if (apiError instanceof Error && apiError.name === 'AbortError') {
          }
        }
      } else {
      }

      // FALLBACK: Get from shared data store (local storage)
      const restaurants =
        (await this.dataStore.getPlatformSetting(`restaurants.${platformOwnerId}`)) || [];

      // If no restaurants exist, check if we have a current restaurant to add
      if (restaurants.length === 0) {
        const currentRestaurant = await this.getCurrentRestaurantData();
        if (currentRestaurant && currentRestaurant.platformOwnerId === platformOwnerId) {
          restaurants.push(__currentRestaurant);
          await this.savePlatformRestaurants(__platformOwnerId, _restaurants);
        }
      }

      return restaurants;
    } catch (__error) {
      return [];
    }
  }

  /**
   * Save restaurants for a platform owner
   */
  async savePlatformRestaurants(
    platformOwnerId: _string,
    restaurants: RestaurantData[],
  ): Promise<void> {
    try {
      await this.dataStore.setPlatformSetting(`restaurants.${platformOwnerId}`, _restaurants);
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Get current restaurant data
   */
  async getCurrentRestaurantData(): Promise<RestaurantData | null> {
    try {
      if (!this.currentRestaurantId) {
        const storedId = await AsyncStorage.getItem('current_restaurant_id');
        if (!storedId) {
          return null;
        }
        this.currentRestaurantId = storedId;
      }

      // Try to get from shared data store first
      const restaurantData = await this.dataStore.getPlatformSetting(
        `restaurant.${this.currentRestaurantId}`,
      );
      if (__restaurantData) {
        return restaurantData;
      }

      // Fallback to local storage
      const localData = await AsyncStorage.getItem(`restaurant_data_${this.currentRestaurantId}`);
      if (__localData) {
        return JSON.parse(__localData);
      }

      return null;
    } catch (__error) {
      return null;
    }
  }

  /**
   * Update current restaurant data and sync to platform
   */
  async updateCurrentRestaurant(updates: Partial<RestaurantData>): Promise<RestaurantData> {
    try {
      const current = await this.getCurrentRestaurantData();
      if (!current) {
        throw new Error('No current restaurant found');
      }

      const updated: RestaurantData = {
        ...current,
        ...updates,
        lastActivity: new Date(),
      };

      // Save to shared data store
      await this.dataStore.setPlatformSetting(`restaurant.${current.id}`, _updated);

      // Update in platform restaurants list
      if (current.platformOwnerId) {
        const platformRestaurants = await this.getPlatformRestaurants(current.platformOwnerId);
        const index = platformRestaurants.findIndex(r => r.id === current.id);

        if (index >= 0) {
          platformRestaurants[index] = updated;
        } else {
          platformRestaurants.push(__updated);
        }

        await this.savePlatformRestaurants(current.platformOwnerId, _platformRestaurants);
      }

      return updated;
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Create new restaurant (during onboarding)
   */
  async createRestaurant(restaurantData: Partial<RestaurantData>): Promise<RestaurantData> {
    try {
      const newRestaurant: RestaurantData = {
        id: `rest_${Date.now()}`,
        name: restaurantData.name || 'New Restaurant',
        displayName: restaurantData.displayName || restaurantData.name || 'New Restaurant',
        businessType: restaurantData.businessType || 'Restaurant',
        address: restaurantData.address || '',
        phone: restaurantData.phone || '',
        email: restaurantData.email || '',
        vatNumber: restaurantData.vatNumber || '',
        registrationNumber: restaurantData.registrationNumber || '',
        platformOwnerId: restaurantData.platformOwnerId || 'platform_owner_1',
        ownerId: restaurantData.ownerId || '',
        subscriptionTier: restaurantData.subscriptionTier || 'basic',
        currency: restaurantData.currency || 'GBP',
        monthlyRevenue: 0,
        commissionRate: 2.5,
        isActive: _true,
        onboardingCompleted: _false,
        joinedDate: new Date(),
        lastActivity: new Date(),
        timezone: restaurantData.timezone || 'Europe/London',
        todayTransactions: 0,
        todayRevenue: 0,
        activeOrders: 0,
        averageOrderValue: 0,
        ...restaurantData,
      };

      // Save to shared data store
      await this.dataStore.setPlatformSetting(`restaurant.${newRestaurant.id}`, _newRestaurant);

      // Add to platform restaurants
      const platformRestaurants = await this.getPlatformRestaurants(newRestaurant.platformOwnerId);
      platformRestaurants.push(__newRestaurant);
      await this.savePlatformRestaurants(newRestaurant.platformOwnerId, _platformRestaurants);

      // Set as current restaurant
      this.currentRestaurantId = newRestaurant.id;
      await AsyncStorage.setItem('current_restaurant_id', newRestaurant.id);

      return newRestaurant;
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Update restaurant metrics (called from POS operations)
   */
  async updateMetrics(metrics: {
    todayTransactions?: number;
    todayRevenue?: number;
    activeOrders?: number;
    averageOrderValue?: number;
  }): Promise<void> {
    try {
      const current = await this.getCurrentRestaurantData();
      if (!current) {
        return;
      }

      await this.updateCurrentRestaurant(__metrics);
    } catch (__error) {
    }
  }

  /**
   * Subscribe to restaurant data changes
   */
  subscribeToRestaurant(
    restaurantId: _string,
    callback: (data: _RestaurantData) => void,
  ): () => void {
    return this.dataStore.subscribe(`restaurant.${restaurantId}`, _callback);
  }

  /**
   * Subscribe to platform restaurants changes
   */
  subscribeToPlatformRestaurants(
    platformOwnerId: _string,
    callback: (restaurants: RestaurantData[]) => void,
  ): () => void {
    return this.dataStore.subscribe(`restaurants.${platformOwnerId}`, _callback);
  }

  /**
   * Convert RestaurantData to Business type for compatibility
   */
  toBusinessType(restaurant: _RestaurantData): Business {
    return {
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      phone: restaurant.phone,
      email: restaurant.email,
      vatNumber: restaurant.vatNumber,
      registrationNumber: restaurant.registrationNumber,
      type: 'restaurant',
      currency: restaurant.currency,
      timezone: restaurant.timezone,
      ownerId: restaurant.ownerId,
      platformOwnerId: restaurant.platformOwnerId,
      subscriptionTier: restaurant.subscriptionTier,
      isActive: restaurant.isActive,
      joinedDate: restaurant.joinedDate,
      lastActivity: restaurant.lastActivity,
      monthlyRevenue: restaurant.monthlyRevenue,
      commissionRate: restaurant.commissionRate,
    };
  }
}

export default RestaurantDataService;
