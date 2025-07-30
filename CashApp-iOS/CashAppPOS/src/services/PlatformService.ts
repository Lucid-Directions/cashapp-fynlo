/**
 * PlatformService - Service for managing platform-wide settings and configurations
 * Handles communication with the platform settings API while maintaining existing patterns
 */

import SharedDataStore from './SharedDataStore';
import tokenManager from '../utils/tokenManager';

// Base API URL - FIXED: Uses LAN IP for device testing
import API_CONFIG from '../config/api';

const BASE_URL = API_CONFIG.FULL_API_URL;

export interface PlatformSetting {
  key: string;
  value: unknown;
  category: string;
  description: string;
  is_sensitive: boolean;
  updated_at: string | null;
}

export interface PaymentFee {
  percentage: number;
  fixed_fee?: number;
  currency: string;
  high_volume?: {
    threshold: number;
    percentage: number;
    monthly_fee: number;
  };
}

export interface FeatureFlag {
  feature_key: string;
  is_enabled: boolean;
  rollout_percentage: number;
  target_restaurants?: string[];
  description?: string;
}

export interface AuditRecord {
  id: string;
  config_type: string;
  config_key: string;
  entity_id?: string;
  old_value: unknown;
  new_value: unknown;
  change_reason?: string;
  change_source: string;
  changed_by: string;
  changed_at: string;
  ip_address?: string;
  user_agent?: string;
}

export interface FeeCalculation {
  payment_method: string;
  amount: number;
  platform_fee: number;
  restaurant_markup: number;
  effective_fee: number;
  fee_percentage: number;
  currency: string;
}

class PlatformService {
  private static instance: PlatformService;
  private authToken: string | null = null;
  private dataStore: SharedDataStore;

  private constructor() {
    this.loadAuthToken();
    this.dataStore = SharedDataStore.getInstance();
  }

  static getInstance(): PlatformService {
    if (!PlatformService.instance) {
      PlatformService.instance = new PlatformService();
    }
    return PlatformService.instance;
  }

  private async loadAuthToken(): Promise<void> {
    try {
      this.authToken = await tokenManager.getTokenWithRefresh();
    } catch (_error) {
    }
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: unknown,
  ): Promise<unknown> {
    try {
      const url = `${BASE_URL}${endpoint}`;
      const headers: unknown = {
        'Content-Type': 'application/json',
      };

      // Always reload auth token for fresh requests
      await this.loadAuthToken();

      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const config: RequestInit = {
        method,
        headers,
        timeout: 10000, // 10 second timeout for platform operations
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(_data);
      }

      if (_data) {
      }

      const response = await fetch(_url, config);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (_error) {
      throw error;
    }
  }

  // Platform Settings Management
  async getPlatformSettings(
    category?: string,
    includeSensitive = false,
  ): Promise<PlatformSetting[]> {
    try {
      const params = new URLSearchParams();
      if (_category) {
        params.append('category', category);
      }
      if (_includeSensitive) {
        params.append('include_sensitive', 'true');
      }

      const queryString = params.toString();
      const endpoint = `/platform/settings${queryString ? `?${queryString}` : ''}`;

      const settingsData = await this.makeRequest(_endpoint);

      // Handle different API response formats
      let settingsObject: Record<string, any>;

      if (settingsData && typeof settingsData === 'object') {
        // If it's already an object, use it directly
        settingsObject = settingsData;
      } else {
        // If it's an array or other format, create an empty object
        settingsObject = {};
      }

      // Convert object to array format for easier handling
      return Object.entries(_settingsObject).map(([key, config]: [string, any]) => ({
        key,
        value: config?.value ?? config,
        category: config?.category ?? 'general',
        description: config?.description ?? `Setting for ${key}`,
        is_sensitive: config?.is_sensitive ?? false,
        updated_at: config?.updated_at ?? null,
      }));
    } catch (_error) {
      // Return mock data for demo purposes
      return this.getMockPlatformSettings(_category);
    }
  }

  async getPlatformSetting(configKey: string): Promise<PlatformSetting | null> {
    try {
      const settingData = await this.makeRequest(`/platform/settings/${configKey}`);
      return {
        key: settingData.key,
        value: settingData.value,
        category: settingData.category,
        description: settingData.description,
        is_sensitive: settingData.is_sensitive,
        updated_at: settingData.updated_at,
      };
    } catch (_error) {
      return null;
    }
  }

  async updatePlatformSetting(
    configKey: string,
    configValue: unknown,
    changeReason?: string,
  ): Promise<boolean> {
    try {
      await this.makeRequest(`/platform/settings/${configKey}`, 'PUT', {
        config_value: configValue,
        change_reason: changeReason,
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  async bulkUpdatePlatformSettings(
    updates: Record<string, any>,
    changeReason?: string,
  ): Promise<{ successful: number; failed: number; errors: Record<string, string> }> {
    try {
      const result = await this.makeRequest('/platform/settings/bulk-update', 'POST', {
        updates,
        change_reason: changeReason,
      });

      return {
        successful: result.successful_updates || 0,
        failed: result.failed_updates || 0,
        errors: result.errors || {},
      };
    } catch (_error) {

      // If the bulk endpoint fails, try individual updates as fallback
      let successful = 0;
      let failed = 0;
      const errors: Record<string, string> = {};

      for (const [key, value] of Object.entries(_updates)) {
        try {
          const success = await this.updatePlatformSetting(_key, value, changeReason);
          if (_success) {
            successful++;
          } else {
            failed++;
            errors[key] = 'Update failed';
          }
        } catch (_error) {
          failed++;
          errors[key] = error.message || 'Unknown error';
        }
      }

      return { successful, failed, errors };
    }
  }

  // Payment Fee Management
  async getPaymentFees(): Promise<Record<string, PaymentFee>> {
    try {
      return await this.makeRequest('/platform/payment-fees');
    } catch (_error) {
      // Return mock data for demo
      return this.getMockPaymentFees();
    }
  }

  async calculatePaymentFee(
    paymentMethod: string,
    amount: number,
    restaurantId?: string,
    monthlyVolume?: number,
  ): Promise<FeeCalculation> {
    try {
      const params = new URLSearchParams({
        amount: amount.toString(),
      });
      if (_restaurantId) {
        params.append('restaurant_id', restaurantId);
      }
      if (_monthlyVolume) {
        params.append('monthly_volume', monthlyVolume.toString());
      }

      return await this.makeRequest(
        `/platform/payment-fees/calculate?${params.toString()}`,
        'POST',
      );
    } catch (_error) {
      // Return mock calculation
      return this.getMockFeeCalculation(_paymentMethod, amount);
    }
  }

  // Feature Flag Management
  async getFeatureFlags(restaurantId?: string): Promise<Record<string, boolean>> {
    try {
      const params = restaurantId ? `?restaurant_id=${restaurantId}` : '';
      return await this.makeRequest(`/platform/feature-flags${params}`);
    } catch (_error) {
      return this.getMockFeatureFlags();
    }
  }

  async updateFeatureFlag(
    featureKey: string,
    isEnabled: boolean,
    rolloutPercentage?: number,
    targetRestaurants?: string[],
  ): Promise<boolean> {
    try {
      await this.makeRequest(`/platform/feature-flags/${featureKey}`, 'PUT', {
        is_enabled: isEnabled,
        rollout_percentage: rolloutPercentage,
        target_restaurants: targetRestaurants,
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  // Restaurant Settings Management
  async getRestaurantEffectiveSettings(
    restaurantId: string,
    category?: string,
  ): Promise<Record<string, any>> {
    try {
      const params = category ? `?category=${category}` : '';
      return await this.makeRequest(
        `/platform/restaurants/${restaurantId}/effective-settings${params}`,
      );
    } catch (_error) {
      return {};
    }
  }

  async setRestaurantOverride(
    restaurantId: string,
    configKey: string,
    overrideValue: unknown,
    requiresApproval = false,
  ): Promise<boolean> {
    try {
      await this.makeRequest(
        `/platform/restaurants/${restaurantId}/overrides/${configKey}`,
        'PUT',
        {
          override_value: overrideValue,
          requires_approval: requiresApproval,
        },
      );
      return true;
    } catch (_error) {
      return false;
    }
  }

  // Audit Trail
  async getAuditTrail(configKey?: string, entityId?: string, limit = 100): Promise<AuditRecord[]> {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (_configKey) {
        params.append('config_key', configKey);
      }
      if (_entityId) {
        params.append('entity_id', entityId);
      }

      const result = await this.makeRequest(`/platform/audit-trail?${params.toString()}`);
      return result.audit_records || [];
    } catch (_error) {
      return [];
    }
  }

  // Platform Configuration Sync (for mobile apps)
  async syncPlatformConfig(
    restaurantId?: string,
    categories?: string[],
  ): Promise<{
    platform_settings: Record<string, any>;
    feature_flags: Record<string, boolean>;
    effective_settings: Record<string, any>;
    sync_timestamp: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (_restaurantId) {
        params.append('restaurant_id', restaurantId);
      }
      if (_categories) {
        params.append('categories', categories.join(','));
      }

      return await this.makeRequest(`/platform/sync/platform-config?${params.toString()}`);
    } catch (_error) {
      return {
        platform_settings: {},
        feature_flags: {},
        effective_settings: {},
        sync_timestamp: new Date().toISOString(),
      };
    }
  }

  // Initialization
  async initializeDefaultSettings(): Promise<boolean> {
    try {
      await this.makeRequest('/platform/initialize-defaults', 'POST');
      return true;
    } catch (_error) {
      return false;
    }
  }

  // Mock data methods for demo/fallback purposes
  private getMockPlatformSettings(category?: string): PlatformSetting[] {
    const allSettings: PlatformSetting[] = [
      {
        key: 'payment.fees.qr_code',
        value: { percentage: 1.2, currency: 'GBP' },
        category: 'payment_fees',
        description: 'QR Code payment processing fee',
        is_sensitive: false,
        updated_at: '2024-06-22T10:30:00Z',
      },
      {
        key: 'payment.fees.stripe',
        value: { percentage: 1.4, fixed_fee: 0.2, currency: 'GBP' },
        category: 'payment_fees',
        description: 'Stripe payment processing fee',
        is_sensitive: false,
        updated_at: '2024-06-22T10:30:00Z',
      },
      {
        key: 'payment.fees.square',
        value: { percentage: 1.75, currency: 'GBP' },
        category: 'payment_fees',
        description: 'Square payment processing fee',
        is_sensitive: false,
        updated_at: '2024-06-22T10:30:00Z',
      },
      {
        key: 'payment.fees.sumup',
        value: {
          standard: { percentage: 1.95 },
          high_volume: { threshold: 2714, percentage: 0.95, monthly_fee: 39 },
          currency: 'GBP',
        },
        category: 'payment_fees',
        description: 'SumUp payment processing fee',
        is_sensitive: false,
        updated_at: '2024-06-22T10:30:00Z',
      },
      {
        key: 'security.max_login_attempts',
        value: 5,
        category: 'security',
        description: 'Maximum login attempts before lockout',
        is_sensitive: false,
        updated_at: '2024-06-22T10:30:00Z',
      },
      {
        key: 'security.session_timeout',
        value: 3600,
        category: 'security',
        description: 'Session timeout in seconds',
        is_sensitive: false,
        updated_at: '2024-06-22T10:30:00Z',
      },
      {
        key: 'business.max_discount_percentage',
        value: 50.0,
        category: 'business',
        description: 'Maximum discount percentage allowed',
        is_sensitive: false,
        updated_at: '2024-06-22T10:30:00Z',
      },
      {
        key: 'features.new_payment_ui',
        value: { enabled: false, rollout_percentage: 25.0 },
        category: 'features',
        description: 'New payment interface rollout',
        is_sensitive: false,
        updated_at: '2024-06-22T10:30:00Z',
      },
    ];

    return category ? allSettings.filter(s => s.category === category) : allSettings;
  }

  private getMockPaymentFees(): Record<string, PaymentFee> {
    return {
      qr_code: { percentage: 1.2, currency: 'GBP' },
      stripe: { percentage: 1.4, fixed_fee: 0.2, currency: 'GBP' },
      square: {
        percentage: 1.75,
        currency: 'GBP',
        // Additional Square fee structures
        high_volume: { threshold: 0, percentage: 1.75, monthly_fee: 0 }, // No monthly fee
      },
      sumup: {
        percentage: 1.95,
        currency: 'GBP',
        high_volume: { threshold: 2714, percentage: 0.95, monthly_fee: 39 },
      },
    };
  }

  private getMockFeeCalculation(paymentMethod: string, amount: number): FeeCalculation {
    const fees = this.getMockPaymentFees();
    const feeConfig = fees[paymentMethod];

    if (!feeConfig) {
      throw new Error(`Unknown payment method: ${paymentMethod}`);
    }

    const platformFee = (amount * feeConfig.percentage) / 100 + (feeConfig.fixed_fee || 0);

    return {
      payment_method: paymentMethod,
      amount,
      platform_fee: platformFee,
      restaurant_markup: 0,
      effective_fee: platformFee,
      fee_percentage: (platformFee / amount) * 100,
      currency: feeConfig.currency,
    };
  }

  // Service Charge Configuration
  async getServiceChargeConfig(): Promise<{
    enabled: boolean;
    rate: number;
    description: string;
  }> {
    try {
      return await this.dataStore.getServiceChargeConfig();
    } catch (_error) {
      throw error;
    }
  }

  async updateServiceChargeConfig(
    enabled: boolean,
    rate: number,
    description?: string,
  ): Promise<boolean> {
    try {
        enabled,
        rate,
        description,
      });

      const config = {
        enabled,
        rate,
        description: description || `Platform service charge of ${rate}%`,
        lastUpdated: new Date().toISOString(),
      };

      await this.dataStore.setServiceChargeConfig(_config);
      return true;
    } catch (_error) {
      return false;
    }
  }

  private getMockFeatureFlags(): Record<string, boolean> {
    return {
      new_payment_ui: false,
      enhanced_analytics: true,
      mobile_app_v2: false,
      advanced_reporting: true,
      restaurant_chat: false,
    };
  }
}

export default PlatformService;
