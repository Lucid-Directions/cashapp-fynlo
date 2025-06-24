/**
 * PlatformService - Service for managing platform-wide settings and configurations
 * Handles communication with the platform settings API while maintaining existing patterns
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Base API URL - will use existing pattern from DataService
const BASE_URL = 'http://localhost:8000/api/v1';

export interface PlatformSetting {
  key: string;
  value: any;
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
  old_value: any;
  new_value: any;
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

  private constructor() {
    this.loadAuthToken();
  }

  static getInstance(): PlatformService {
    if (!PlatformService.instance) {
      PlatformService.instance = new PlatformService();
    }
    return PlatformService.instance;
  }

  private async loadAuthToken(): Promise<void> {
    try {
      this.authToken = await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.log('No auth token found');
    }
  }

  private async makeRequest(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    try {
      const url = `${BASE_URL}${endpoint}`;
      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const config: RequestInit = {
        method,
        headers,
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Platform Settings Management
  async getPlatformSettings(category?: string, includeSensitive: boolean = false): Promise<PlatformSetting[]> {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (includeSensitive) params.append('include_sensitive', 'true');
      
      const queryString = params.toString();
      const endpoint = `/platform-settings/settings${queryString ? `?${queryString}` : ''}`;
      
      const settingsData = await this.makeRequest(endpoint);
      
      // Convert object to array format for easier handling
      return Object.entries(settingsData).map(([key, config]: [string, any]) => ({
        key,
        value: config.value,
        category: config.category,
        description: config.description,
        is_sensitive: config.is_sensitive,
        updated_at: config.updated_at,
      }));
    } catch (error) {
      console.error('Failed to fetch platform settings:', error);
      // Return mock data for demo purposes
      return this.getMockPlatformSettings(category);
    }
  }

  async getPlatformSetting(configKey: string): Promise<PlatformSetting | null> {
    try {
      const settingData = await this.makeRequest(`/platform-settings/settings/${configKey}`);
      return {
        key: settingData.key,
        value: settingData.value,
        category: settingData.category,
        description: settingData.description,
        is_sensitive: settingData.is_sensitive,
        updated_at: settingData.updated_at,
      };
    } catch (error) {
      console.error(`Failed to fetch setting ${configKey}:`, error);
      return null;
    }
  }

  async updatePlatformSetting(
    configKey: string, 
    configValue: any, 
    changeReason?: string
  ): Promise<boolean> {
    try {
      await this.makeRequest(`/platform-settings/settings/${configKey}`, 'PUT', {
        config_value: configValue,
        change_reason: changeReason,
      });
      return true;
    } catch (error) {
      console.error(`Failed to update setting ${configKey}:`, error);
      return false;
    }
  }

  async bulkUpdatePlatformSettings(
    updates: Record<string, any>, 
    changeReason?: string
  ): Promise<{ successful: number; failed: number; errors: Record<string, string> }> {
    try {
      const result = await this.makeRequest('/platform-settings/settings/bulk-update', 'POST', {
        updates,
        change_reason: changeReason,
      });
      
      return {
        successful: result.successful_updates,
        failed: result.failed_updates,
        errors: result.errors || {},
      };
    } catch (error) {
      console.error('Failed to bulk update settings:', error);
      return { successful: 0, failed: Object.keys(updates).length, errors: { general: 'API request failed' } };
    }
  }

  // Payment Fee Management
  async getPaymentFees(): Promise<Record<string, PaymentFee>> {
    try {
      return await this.makeRequest('/platform-settings/payment-fees');
    } catch (error) {
      console.error('Failed to fetch payment fees:', error);
      // Return mock data for demo
      return this.getMockPaymentFees();
    }
  }

  async calculatePaymentFee(
    paymentMethod: string,
    amount: number,
    restaurantId?: string,
    monthlyVolume?: number
  ): Promise<FeeCalculation> {
    try {
      const params = new URLSearchParams({
        amount: amount.toString(),
      });
      if (restaurantId) params.append('restaurant_id', restaurantId);
      if (monthlyVolume) params.append('monthly_volume', monthlyVolume.toString());

      return await this.makeRequest(
        `/platform-settings/payment-fees/calculate?${params.toString()}`,
        'POST'
      );
    } catch (error) {
      console.error('Failed to calculate payment fee:', error);
      // Return mock calculation
      return this.getMockFeeCalculation(paymentMethod, amount);
    }
  }

  // Feature Flag Management
  async getFeatureFlags(restaurantId?: string): Promise<Record<string, boolean>> {
    try {
      const params = restaurantId ? `?restaurant_id=${restaurantId}` : '';
      return await this.makeRequest(`/platform-settings/feature-flags${params}`);
    } catch (error) {
      console.error('Failed to fetch feature flags:', error);
      return this.getMockFeatureFlags();
    }
  }

  async updateFeatureFlag(
    featureKey: string,
    isEnabled: boolean,
    rolloutPercentage?: number,
    targetRestaurants?: string[]
  ): Promise<boolean> {
    try {
      await this.makeRequest(`/platform-settings/feature-flags/${featureKey}`, 'PUT', {
        is_enabled: isEnabled,
        rollout_percentage: rolloutPercentage,
        target_restaurants: targetRestaurants,
      });
      return true;
    } catch (error) {
      console.error(`Failed to update feature flag ${featureKey}:`, error);
      return false;
    }
  }

  // Restaurant Settings Management
  async getRestaurantEffectiveSettings(
    restaurantId: string,
    category?: string
  ): Promise<Record<string, any>> {
    try {
      const params = category ? `?category=${category}` : '';
      return await this.makeRequest(
        `/platform-settings/restaurants/${restaurantId}/effective-settings${params}`
      );
    } catch (error) {
      console.error('Failed to fetch restaurant effective settings:', error);
      return {};
    }
  }

  async setRestaurantOverride(
    restaurantId: string,
    configKey: string,
    overrideValue: any,
    requiresApproval: boolean = false
  ): Promise<boolean> {
    try {
      await this.makeRequest(
        `/platform-settings/restaurants/${restaurantId}/overrides/${configKey}`,
        'PUT',
        {
          override_value: overrideValue,
          requires_approval: requiresApproval,
        }
      );
      return true;
    } catch (error) {
      console.error('Failed to set restaurant override:', error);
      return false;
    }
  }

  // Audit Trail
  async getAuditTrail(
    configKey?: string,
    entityId?: string,
    limit: number = 100
  ): Promise<AuditRecord[]> {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (configKey) params.append('config_key', configKey);
      if (entityId) params.append('entity_id', entityId);

      const result = await this.makeRequest(`/platform-settings/audit-trail?${params.toString()}`);
      return result.audit_records || [];
    } catch (error) {
      console.error('Failed to fetch audit trail:', error);
      return [];
    }
  }

  // Platform Configuration Sync (for mobile apps)
  async syncPlatformConfig(
    restaurantId?: string,
    categories?: string[]
  ): Promise<{
    platform_settings: Record<string, any>;
    feature_flags: Record<string, boolean>;
    effective_settings: Record<string, any>;
    sync_timestamp: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (restaurantId) params.append('restaurant_id', restaurantId);
      if (categories) params.append('categories', categories.join(','));

      return await this.makeRequest(`/platform-settings/sync/platform-config?${params.toString()}`);
    } catch (error) {
      console.error('Failed to sync platform config:', error);
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
      await this.makeRequest('/platform-settings/initialize-defaults', 'POST');
      return true;
    } catch (error) {
      console.error('Failed to initialize default settings:', error);
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
        value: { percentage: 1.4, fixed_fee: 0.20, currency: 'GBP' },
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
          currency: 'GBP'
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
      stripe: { percentage: 1.4, fixed_fee: 0.20, currency: 'GBP' },
      square: { 
        percentage: 1.75, 
        currency: 'GBP',
        // Additional Square fee structures
        high_volume: { threshold: 0, percentage: 1.75, monthly_fee: 0 } // No monthly fee
      },
      sumup: {
        percentage: 1.95,
        currency: 'GBP',
        high_volume: { threshold: 2714, percentage: 0.95, monthly_fee: 39 }
      },
    };
  }

  private getMockFeeCalculation(paymentMethod: string, amount: number): FeeCalculation {
    const fees = this.getMockPaymentFees();
    const feeConfig = fees[paymentMethod];
    
    if (!feeConfig) {
      throw new Error(`Unknown payment method: ${paymentMethod}`);
    }

    const platformFee = (amount * feeConfig.percentage / 100) + (feeConfig.fixed_fee || 0);
    
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
      // Check DataService feature flags to determine if we should use real API
      const dataService = await import('./DataService');
      const flags = dataService.default.getInstance().getFeatureFlags();
      
      if (flags.USE_REAL_API) {
        return await this.makeRequest('/platform-settings/service-charge');
      } else {
        console.log('Using mock service charge config (demo mode)');
        return this.getMockServiceChargeConfig();
      }
    } catch (error) {
      console.log('API not available, using mock service charge config');
      // Return mock data for development/demo
      return this.getMockServiceChargeConfig();
    }
  }

  async updateServiceChargeConfig(
    enabled: boolean,
    rate: number,
    description?: string
  ): Promise<boolean> {
    try {
      await this.makeRequest('/platform-settings/service-charge', 'PUT', {
        enabled,
        rate,
        description: description || `Platform service charge of ${rate}%`,
      });
      return true;
    } catch (error) {
      console.error('Failed to update service charge config:', error);
      return false;
    }
  }

  private getMockServiceChargeConfig() {
    return {
      enabled: true,
      rate: 12.5,
      description: 'Platform service charge',
    };
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