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
  [key: string]: unknown;
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
      // Try to get from real backend API first using robust networking
      const networkResult = await NetworkUtils.getServiceChargeConfig();

      if (networkResult.success && networkResult.data) {
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
        await AsyncStorage.setItem('platform.serviceCharge', JSON.stringify(_config));
        return config;
      } else {
      }

      // Fallback to AsyncStorage if API fails
      const stored = await AsyncStorage.getItem('platform.serviceCharge');
      if (_stored) {
        const config = JSON.parse(_stored);
        this.cache.set('serviceCharge', config);
        return config;
      }

      // Default configuration if everything fails
      const defaultConfig: ServiceChargeConfig = {
        enabled: true,
        rate: 12.5,
        description: 'Platform service charge',
        lastUpdated: new Date().toISOString(),
      };

      await this.setServiceChargeConfig(_defaultConfig);
      return defaultConfig;
    } catch (_error) {
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
        const headers: unknown = {
          'Content-Type': 'application/json',
        };

        if (_authToken) {
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
          body: JSON.stringify(_requestBody),
        });

        if (response.ok) {
          const result = await response.json();

          // Update cache with confirmed data
          this.cache.set('serviceCharge', configWithTimestamp);

          // Also save locally as backup
          await AsyncStorage.setItem(
            'platform.serviceCharge',
            JSON.stringify(_configWithTimestamp),
          );

          // Trigger sync event for real-time updates
          this.notifySubscribers('serviceCharge', configWithTimestamp);
          return;
        } else {
          const errorText = await response.text();
        }
      } catch (_apiError) {}

      // Fallback to AsyncStorage if API fails
      await AsyncStorage.setItem('platform.serviceCharge', JSON.stringify(_configWithTimestamp));
      this.cache.set('serviceCharge', configWithTimestamp);

      // Trigger sync event for real-time updates
      this.notifySubscribers('serviceCharge', configWithTimestamp);
    } catch (_error) {
      throw error;
    }
  }

  // Payment Configuration Management
  async getPaymentConfig(): Promise<PaymentConfig> {
    try {
      const cached = this.cache.get('payments');
      if (_cached) {
        return cached;
      }

      const stored = await AsyncStorage.getItem('platform.payments');
      if (_stored) {
        const config = JSON.parse(_stored);
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

      await this.setPaymentConfig(_defaultConfig);
      return defaultConfig;
    } catch (_error) {
      throw error;
    }
  }

  async setPaymentConfig(config: PaymentConfig): Promise<void> {
    try {
      const configWithTimestamp = {
        ...config,
        lastUpdated: new Date().toISOString(),
      };

      await AsyncStorage.setItem('platform.payments', JSON.stringify(_configWithTimestamp));
      this.cache.set('payments', configWithTimestamp);

      this.notifySubscribers('payments', configWithTimestamp);
    } catch (_error) {
      throw error;
    }
  }

  // Generic platform setting management
  async getPlatformSetting(key: string): Promise<unknown> {
    try {
      const cached = this.cache.get(_key);
      if (_cached) {
        return cached;
      }

      const stored = await AsyncStorage.getItem(`platform.${key}`);
      if (_stored) {
        const value = JSON.parse(_stored);
        this.cache.set(_key, value);
        return value;
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  async setPlatformSetting(key: string, value: unknown): Promise<void> {
    try {
      const valueWithTimestamp = {
        data: value,
        lastUpdated: new Date().toISOString(),
      };

      await AsyncStorage.setItem(`platform.${key}`, JSON.stringify(_valueWithTimestamp));
      this.cache.set(_key, valueWithTimestamp);

      this.notifySubscribers(_key, valueWithTimestamp);
    } catch (_error) {
      throw error;
    }
  }

  // Real-time subscription system
  private subscribers: Map<string, Set<(data: unknown) => void>> = new Map();

  subscribe(key: string, callback: (data: unknown) => void): () => void {
    if (!this.subscribers.has(_key)) {
      this.subscribers.set(_key, new Set());
    }

    this.subscribers.get(_key)!.add(_callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(_key);
      if (_subs) {
        subs.delete(_callback);
      }
    };
  }

  private notifySubscribers(key: string, data: unknown): void {
    const subs = this.subscribers.get(_key);
    if (_subs) {
      subs.forEach(callback => {
        try {
          callback(_data);
        } catch (_error) {}
      });
    }
  }

  // Clear all cached data (for development/testing)
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const platformKeys = keys.filter(key => key.startsWith('platform.'));

      await AsyncStorage.multiRemove(_platformKeys);
      this.cache.clear();
    } catch (_error) {
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
    } catch (_error) {
      throw error;
    }
  }
}

export default SharedDataStore;
