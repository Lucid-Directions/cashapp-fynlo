/**
 * RestaurantDataService - Real-time restaurant data synchronization
 * This service manages the flow of restaurant data between restaurant app and platform
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import SharedDataStore from './SharedDataStore';
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
   * Initialize service with current restaurant ID
   */
  async initialize(restaurantId: string): Promise<void> {
    this.currentRestaurantId = restaurantId;
    await AsyncStorage.setItem('current_restaurant_id', restaurantId);
  }

  /**
   * Get all restaurants for a platform owner
   */
  async getPlatformRestaurants(platformOwnerId: string): Promise<RestaurantData[]> {
    try {
      console.log('📊 Getting restaurants for platform:', platformOwnerId);
      
      // FIRST: Try to get from real backend API
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/platform/restaurants/${platformOwnerId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Got ${data.restaurants?.length || 0} restaurants from backend API`);
          console.log('🔗 Data source:', data.source);
          console.log('🔍 Response data structure:', typeof data, data);
          
          if (data && data.restaurants && Array.isArray(data.restaurants)) {
            // Convert backend format to RestaurantData format
            const restaurants: RestaurantData[] = data.restaurants.map((r: any) => ({
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
            
            return restaurants;
          } else {
            console.error('❌ Invalid API response structure - data.restaurants is not an array:', {
              hasData: !!data,
              hasRestaurants: !!data?.restaurants,
              restaurantsType: typeof data?.restaurants,
              isArray: Array.isArray(data?.restaurants),
              data: data
            });
          }
        } else {
          console.log('⚠️ Backend API response not ok:', response.status);
        }
      } catch (apiError) {
        console.error('⚠️ Backend API error, falling back to local storage:', {
          error: apiError,
          message: apiError instanceof Error ? apiError.message : 'Unknown error',
          url: `${API_CONFIG.BASE_URL}/api/v1/platform/restaurants/${platformOwnerId}`
        });
      }
      
      // FALLBACK: Get from shared data store (local storage)
      const restaurants = await this.dataStore.getPlatformSetting(`restaurants.${platformOwnerId}`) || [];
      
      // If no restaurants exist, check if we have a current restaurant to add
      if (restaurants.length === 0) {
        const currentRestaurant = await this.getCurrentRestaurantData();
        if (currentRestaurant && currentRestaurant.platformOwnerId === platformOwnerId) {
          restaurants.push(currentRestaurant);
          await this.savePlatformRestaurants(platformOwnerId, restaurants);
        }
      }
      
      console.log('✅ Found restaurants (from fallback):', restaurants.length);
      return restaurants;
    } catch (error) {
      console.error('❌ Failed to get platform restaurants:', error);
      return [];
    }
  }

  /**
   * Save restaurants for a platform owner
   */
  async savePlatformRestaurants(platformOwnerId: string, restaurants: RestaurantData[]): Promise<void> {
    try {
      await this.dataStore.setPlatformSetting(`restaurants.${platformOwnerId}`, restaurants);
      console.log('✅ Saved platform restaurants:', restaurants.length);
    } catch (error) {
      console.error('❌ Failed to save platform restaurants:', error);
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
        if (!storedId) return null;
        this.currentRestaurantId = storedId;
      }

      // Try to get from shared data store first
      const restaurantData = await this.dataStore.getPlatformSetting(`restaurant.${this.currentRestaurantId}`);
      if (restaurantData) {
        return restaurantData;
      }

      // Fallback to local storage
      const localData = await AsyncStorage.getItem(`restaurant_data_${this.currentRestaurantId}`);
      if (localData) {
        return JSON.parse(localData);
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to get current restaurant data:', error);
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
      await this.dataStore.setPlatformSetting(`restaurant.${current.id}`, updated);
      
      // Update in platform restaurants list
      if (current.platformOwnerId) {
        const platformRestaurants = await this.getPlatformRestaurants(current.platformOwnerId);
        const index = platformRestaurants.findIndex(r => r.id === current.id);
        
        if (index >= 0) {
          platformRestaurants[index] = updated;
        } else {
          platformRestaurants.push(updated);
        }
        
        await this.savePlatformRestaurants(current.platformOwnerId, platformRestaurants);
      }

      console.log('✅ Restaurant data updated and synced:', updated.name);
      return updated;
    } catch (error) {
      console.error('❌ Failed to update restaurant data:', error);
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
        isActive: true,
        onboardingCompleted: false,
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
      await this.dataStore.setPlatformSetting(`restaurant.${newRestaurant.id}`, newRestaurant);
      
      // Add to platform restaurants
      const platformRestaurants = await this.getPlatformRestaurants(newRestaurant.platformOwnerId);
      platformRestaurants.push(newRestaurant);
      await this.savePlatformRestaurants(newRestaurant.platformOwnerId, platformRestaurants);

      // Set as current restaurant
      this.currentRestaurantId = newRestaurant.id;
      await AsyncStorage.setItem('current_restaurant_id', newRestaurant.id);

      console.log('✅ Restaurant created:', newRestaurant.name);
      return newRestaurant;
    } catch (error) {
      console.error('❌ Failed to create restaurant:', error);
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
      if (!current) return;

      await this.updateCurrentRestaurant(metrics);
    } catch (error) {
      console.error('❌ Failed to update metrics:', error);
    }
  }

  /**
   * Subscribe to restaurant data changes
   */
  subscribeToRestaurant(restaurantId: string, callback: (data: RestaurantData) => void): () => void {
    return this.dataStore.subscribe(`restaurant.${restaurantId}`, callback);
  }

  /**
   * Subscribe to platform restaurants changes
   */
  subscribeToPlatformRestaurants(platformOwnerId: string, callback: (restaurants: RestaurantData[]) => void): () => void {
    return this.dataStore.subscribe(`restaurants.${platformOwnerId}`, callback);
  }

  /**
   * Convert RestaurantData to Business type for compatibility
   */
  toBusinessType(restaurant: RestaurantData): Business {
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