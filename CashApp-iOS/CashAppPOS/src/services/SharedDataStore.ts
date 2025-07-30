/**
 * SharedDataStore - Real API-based data store
 * Replaces AsyncStorage with real backend API calls for cross-device sync
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import tokenManager from '../utils/tokenManager';

// API Configuration and robust networking
import API_CONFIG from '../config/api';
import NetworkUtils from '../utils/NetworkUtils';
const API_BASE_URL = API_CONFIG.FULL_API_URL;

interface ServiceChargeConfig {
  enabled: boolean;
  rate: number;
  description: string;
  lastUpdated: string;
}

interface PaymentConfig {
  sumupEnabled: boolean;
  sumupFeeRate: number;
  cardPaymentsEnabled: boolean;
  qrPaymentsEnabled: boolean;
  cashPaymentsEnabled: boolean;
  lastUpdated: string;
}

interface PlatformSettings {
  serviceCharge: ServiceChargeConfig;
  payments: PaymentConfig;
  [key: string]: any;
}

class SharedDataStore {
  private static instance: SharedDataStore;
  private cache: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): SharedDataStore {
    if (!SharedDataStore.instance) {
      SharedDataStore.instance = new SharedDataStore();
    }
    return SharedDataStore.instance;
  }

  // Service Charge Management
  async getServiceChargeConfig(): Promise<ServiceChargeConfig> {
    try {
      console.log('💰 SharedDataStore - Loading service charge config...');

      // Try to get from real backend API first using robust networking
      const networkResult = await NetworkUtils.getServiceChargeConfig();

      if (networkResult.success && networkResult.data) {
        console.log('✅ Service charge config received from API:', networkResult.data);

        // Handle different API response formats
        let config: ServiceChargeConfig;
        const result = networkResult.data;

        if (result.data && result.data.service_charge) {
          // API response with wrapped data
          const serviceChargeData = result.data.service_charge;
          config = {
            enabled: serviceChargeData.enabled,
            rate: serviceChargeData.rate,
            description: serviceChargeData.description,
            lastUpdated: new Date().toISOString(),
          };
        } else if (result.service_charge) {
          // Direct service_charge object
          config = {
            enabled: result.service_charge.enabled,
            rate: result.service_charge.rate,
            description: result.service_charge.description,
            lastUpdated: new Date().toISOString(),
          };
        } else {
          // Fallback if structure is different
          config = {
            enabled: result.enabled ?? true,
            rate: result.rate ?? 12.5,
            description: result.description ?? 'Platform service charge',
            lastUpdated: new Date().toISOString(),
          };
        }

        // Cache the result and save to AsyncStorage for offline use
        this.cache.set('serviceCharge', config);
        await AsyncStorage.setItem('platform.serviceCharge', JSON.stringify(config));
        console.log('✅ Service charge config cached locally:', config);
        return config;
      } else {
        console.warn('⚠️ API request failed:', networkResult.error);
      }

      // Fallback to AsyncStorage if API fails
      const stored = await AsyncStorage.getItem('platform.serviceCharge');
      if (stored) {
        const config = JSON.parse(stored);
        this.cache.set('serviceCharge', config);
        console.log('✅ Service charge config from local storage (API fallback):', config);
        return config;
      }

      // Default configuration if everything fails
      const defaultConfig: ServiceChargeConfig = {
        enabled: true,
        rate: 12.5,
        description: 'Platform service charge',
        lastUpdated: new Date().toISOString(),
      };

      await this.setServiceChargeConfig(defaultConfig);
      return defaultConfig;
    } catch (error) {
      console.error('❌ Failed to get service charge config:', error);

      // Emergency fallback to default
      return {
        enabled: true,
        rate: 12.5,
        description: 'Platform service charge',
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  async setServiceChargeConfig(config: ServiceChargeConfig): Promise<void> {
    try {
      const configWithTimestamp = {
        ...config,
        lastUpdated: new Date().toISOString(),
      };

      // Save to real backend API first
      try {
        // Get auth token for API requests
        const authToken = await tokenManager.getTokenWithRefresh();
        const headers: any = {
          'Content-Type': 'application/json',
        };

        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Prepare the request body to match backend schema
        const requestBody = {
          enabled: config.enabled,
          rate: config.rate,
          description: config.description,
          currency: 'GBP', // Default currency
        };

        const response = await fetch(`${API_BASE_URL}/platform/service-charge`, {
          method: 'PUT', // Changed from POST to PUT to match backend endpoint
          headers,
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Service charge saved to API:', result);

          // Update cache with confirmed data
          this.cache.set('serviceCharge', configWithTimestamp);

          // Also save locally as backup
          await AsyncStorage.setItem('platform.serviceCharge', JSON.stringify(configWithTimestamp));

          // Trigger sync event for real-time updates
          this.notifySubscribers('serviceCharge', configWithTimestamp);
          return;
        } else {
          const errorText = await response.text();
          console.error('❌ API response error:', response.status, errorText);
        }
      } catch (apiError) {
        console.warn('⚠️ API save failed, using local storage:', apiError);
      }

      // Fallback to AsyncStorage if API fails
      await AsyncStorage.setItem('platform.serviceCharge', JSON.stringify(configWithTimestamp));
      this.cache.set('serviceCharge', configWithTimestamp);

      console.log('✅ Service charge config saved locally (API fallback):', configWithTimestamp);

      // Trigger sync event for real-time updates
      this.notifySubscribers('serviceCharge', configWithTimestamp);
    } catch (error) {
      console.error('❌ Failed to save service charge config:', error);
      throw error;
    }
  }

  // Payment Configuration Management
  async getPaymentConfig(): Promise<PaymentConfig> {
    try {
      const cached = this.cache.get('payments');
      if (cached) {
        return cached;
      }

      const stored = await AsyncStorage.getItem('platform.payments');
      if (stored) {
        const config = JSON.parse(stored);
        this.cache.set('payments', config);
        return config;
      }

      // Default payment configuration
      const defaultConfig: PaymentConfig = {
        sumupEnabled: true,
        sumupFeeRate: 0.69,
        cardPaymentsEnabled: true,
        qrPaymentsEnabled: true,
        cashPaymentsEnabled: true,
        lastUpdated: new Date().toISOString(),
      };

      await this.setPaymentConfig(defaultConfig);
      return defaultConfig;
    } catch (error) {
      console.error('❌ Failed to get payment config:', error);
      throw error;
    }
  }

  async setPaymentConfig(config: PaymentConfig): Promise<void> {
    try {
      const configWithTimestamp = {
        ...config,
        lastUpdated: new Date().toISOString(),
      };

      await AsyncStorage.setItem('platform.payments', JSON.stringify(configWithTimestamp));
      this.cache.set('payments', configWithTimestamp);

      console.log('✅ Payment config saved:', configWithTimestamp);
      this.notifySubscribers('payments', configWithTimestamp);
    } catch (error) {
      console.error('❌ Failed to save payment config:', error);
      throw error;
    }
  }

  // Generic platform setting management
  async getPlatformSetting(key: string): Promise<any> {
    try {
      const cached = this.cache.get(key);
      if (cached) {
        return cached;
      }

      const stored = await AsyncStorage.getItem(`platform.${key}`);
      if (stored) {
        const value = JSON.parse(stored);
        this.cache.set(key, value);
        return value;
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to get platform setting ${key}:`, error);
      return null;
    }
  }

  async setPlatformSetting(key: string, value: any): Promise<void> {
    try {
      const valueWithTimestamp = {
        data: value,
        lastUpdated: new Date().toISOString(),
      };

      await AsyncStorage.setItem(`platform.${key}`, JSON.stringify(valueWithTimestamp));
      this.cache.set(key, valueWithTimestamp);

      console.log(`✅ Platform setting ${key} saved:`, valueWithTimestamp);
      this.notifySubscribers(key, valueWithTimestamp);
    } catch (error) {
      console.error(`❌ Failed to save platform setting ${key}:`, error);
      throw error;
    }
  }

  // Real-time subscription system
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();

  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }

    this.subscribers.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
      }
    };
  }

  private notifySubscribers(key: string, data: any): void {
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Subscriber callback error for ${key}:`, error);
        }
      });
    }
  }

  // Clear all cached data (for development/testing)
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const platformKeys = keys.filter(key => key.startsWith('platform.'));

      await AsyncStorage.multiRemove(platformKeys);
      this.cache.clear();

      console.log('✅ All platform data cleared');
    } catch (error) {
      console.error('❌ Failed to clear platform data:', error);
      throw error;
    }
  }

  // Get all platform settings
  async getAllPlatformSettings(): Promise<PlatformSettings> {
    try {
      const serviceCharge = await this.getServiceChargeConfig();
      const payments = await this.getPaymentConfig();

      return {
        serviceCharge,
        payments,
      };
    } catch (error) {
      console.error('❌ Failed to get all platform settings:', error);
      throw error;
    }
  }
}

export default SharedDataStore;
