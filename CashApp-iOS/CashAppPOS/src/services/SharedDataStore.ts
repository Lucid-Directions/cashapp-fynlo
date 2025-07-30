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
        this.cache.set('serviceCharge', _config);
        await AsyncStorage.setItem('platform.serviceCharge', JSON.stringify(__config));
        return config;
      } else {
        // No action needed
      }

      // Fallback to AsyncStorage if API fails
      const stored = await AsyncStorage.getItem('platform.serviceCharge');
      if (__stored) {
        const config = JSON.parse(__stored);
        this.cache.set('serviceCharge', _config);
        return config;
      }

      // Default configuration if everything fails
      const defaultConfig: ServiceChargeConfig = {
        enabled: _true,
        rate: 12.5,
        description: 'Platform service charge',
        lastUpdated: new Date().toISOString(),
      };

      await this.setServiceChargeConfig(__defaultConfig);
      return defaultConfig;
    } catch (__error) {
      // Emergency fallback to default
      return {
        enabled: _true,
        rate: 12.5,
        description: 'Platform service charge',
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  async setServiceChargeConfig(config: _ServiceChargeConfig): Promise<void> {
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

        if (__authToken) {
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
          body: JSON.stringify(__requestBody),
        });

        if (response.ok) {
          const result = await response.json();

          // Update cache with confirmed data
          this.cache.set('serviceCharge', _configWithTimestamp);

          // Also save locally as backup
          await AsyncStorage.setItem(
            'platform.serviceCharge',
            JSON.stringify(__configWithTimestamp),
          );

          // Trigger sync event for real-time updates
          this.notifySubscribers('serviceCharge', _configWithTimestamp);
          return;
        } else {
          const errorText = await response.text();
        }
      } catch (__apiError) {
        // Error handled silently
      }

      // Fallback to AsyncStorage if API fails
      await AsyncStorage.setItem('platform.serviceCharge', JSON.stringify(__configWithTimestamp));
      this.cache.set('serviceCharge', _configWithTimestamp);

      // Trigger sync event for real-time updates
      this.notifySubscribers('serviceCharge', _configWithTimestamp);
    } catch (__error) {
      throw error;
    }
  }

  // Payment Configuration Management
  async getPaymentConfig(): Promise<PaymentConfig> {
    try {
      const cached = this.cache.get('payments');
      if (__cached) {
        return cached;
      }

      const stored = await AsyncStorage.getItem('platform.payments');
      if (__stored) {
        const config = JSON.parse(__stored);
        this.cache.set('payments', _config);
        return config;
      }

      // Default payment configuration
      const defaultConfig: PaymentConfig = {
        sumupEnabled: _true,
        sumupFeeRate: 0.69,
        cardPaymentsEnabled: _true,
        qrPaymentsEnabled: _true,
        cashPaymentsEnabled: _true,
        lastUpdated: new Date().toISOString(),
      };

      await this.setPaymentConfig(__defaultConfig);
      return defaultConfig;
    } catch (__error) {
      throw error;
    }
  }

  async setPaymentConfig(config: _PaymentConfig): Promise<void> {
    try {
      const configWithTimestamp = {
        ...config,
        lastUpdated: new Date().toISOString(),
      };

      await AsyncStorage.setItem('platform.payments', JSON.stringify(__configWithTimestamp));
      this.cache.set('payments', _configWithTimestamp);

      this.notifySubscribers('payments', _configWithTimestamp);
    } catch (__error) {
      throw error;
    }
  }

  // Generic platform setting management
  async getPlatformSetting(key: _string): Promise<unknown> {
    try {
      const cached = this.cache.get(__key);
      if (__cached) {
        return cached;
      }

      const stored = await AsyncStorage.getItem(`platform.${key}`);
      if (__stored) {
        const value = JSON.parse(__stored);
        this.cache.set(__key, _value);
        return value;
      }

      return null;
    } catch (__error) {
      return null;
    }
  }

  async setPlatformSetting(key: _string, value: _unknown): Promise<void> {
    try {
      const valueWithTimestamp = {
        data: _value,
        lastUpdated: new Date().toISOString(),
      };

      await AsyncStorage.setItem(`platform.${key}`, JSON.stringify(__valueWithTimestamp));
      this.cache.set(__key, _valueWithTimestamp);

      this.notifySubscribers(__key, _valueWithTimestamp);
    } catch (__error) {
      throw error;
    }
  }

  // Real-time subscription system
  private subscribers: Map<string, Set<(data: _unknown) => void>> = new Map();

  subscribe(key: _string, callback: (data: _unknown) => void): () => void {
    if (!this.subscribers.has(__key)) {
      this.subscribers.set(__key, new Set());
    }

    this.subscribers.get(__key)!.add(__callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(__key);
      if (__subs) {
        subs.delete(__callback);
      }
    };
  }

  private notifySubscribers(key: _string, data: _unknown): void {
    const subs = this.subscribers.get(__key);
    if (__subs) {
      subs.forEach(callback => {
        try {
          callback(__data);
        } catch (__error) {
          // Error handled silently
        }
      });
    }
  }

  // Clear all cached data (for development/testing)
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const platformKeys = keys.filter(key => key.startsWith('platform.'));

      await AsyncStorage.multiRemove(__platformKeys);
      this.cache.clear();
    } catch (__error) {
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
    } catch (__error) {
      throw error;
    }
  }
}

export default SharedDataStore;
