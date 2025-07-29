import { supabase } from '@/integrations/supabase/client';

interface PaymentProvider {
  enabled: boolean;
  apiKey?: string;
  priority: number;
  testMode?: boolean;
}

interface RestaurantPaymentConfig {
  sumup: PaymentProvider;
  stripe: PaymentProvider;
  square: PaymentProvider;
  cash: PaymentProvider;
  primaryProvider: 'sumup' | 'stripe' | 'square' | 'cash';
  fallbackProvider?: 'sumup' | 'stripe' | 'square' | 'cash';
}

interface RestaurantFeatureFlags {
  // POS Features
  posEnabled: boolean;
  kitchenDisplayEnabled: boolean;
  tableManagementEnabled: boolean;
  qrOrderingEnabled: boolean;
  
  // Payment Features
  contactlessPaymentEnabled: boolean;
  splitBillEnabled: boolean;
  tipsEnabled: boolean;
  
  // Management Features
  inventoryManagementEnabled: boolean;
  staffManagementEnabled: boolean;
  analyticsEnabled: boolean;
  
  // Integration Features
  accountingIntegrationEnabled: boolean;
  loyaltyProgramEnabled: boolean;
  deliveryIntegrationEnabled: boolean;
  
  // Override subscription limits
  overrideTransactionLimit?: number;
  overrideStaffLimit?: number;
  overrideLocationLimit?: number;
  overrideMenuItemLimit?: number;
}

interface RestaurantSettings {
  restaurantId: string;
  restaurantName: string;
  paymentConfig: RestaurantPaymentConfig;
  featureFlags: RestaurantFeatureFlags;
  customMessage?: string;
  maintenanceMode: boolean;
  lastModified: string;
  modifiedBy: string;
}

interface PlatformSettings {
  // Global API Keys
  sumupPlatformApiKey?: string;
  sumupRestaurantApiKey?: string;
  stripeSecretKey?: string;
  squareAccessToken?: string;
  
  // Global Settings
  globalMaintenanceMode: boolean;
  registrationEnabled: boolean;
  emailVerificationRequired: boolean;
  
  // Restaurant-specific configurations
  restaurantConfigs: Record<string, RestaurantSettings>;
}

class PlatformSettingsService {
  private apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

  async getSettings(): Promise<PlatformSettings> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.apiUrl}/platform/settings`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch platform settings');
    }

    return response.json();
  }

  async updateSettings(settings: Partial<PlatformSettings>): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.apiUrl}/platform/settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      throw new Error('Failed to update platform settings');
    }
  }

  async getRestaurantSettings(restaurantId: string): Promise<RestaurantSettings | null> {
    const settings = await this.getSettings();
    return settings.restaurantConfigs?.[restaurantId] || null;
  }

  async updateRestaurantSettings(restaurantId: string, config: Partial<RestaurantSettings>): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.apiUrl}/platform/restaurants/${restaurantId}/settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      throw new Error('Failed to update restaurant settings');
    }
  }

  async togglePaymentMethod(restaurantId: string, provider: string, enabled: boolean): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.apiUrl}/platform/restaurants/${restaurantId}/payment/${provider}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled })
    });

    if (!response.ok) {
      throw new Error('Failed to toggle payment method');
    }
  }

  async toggleFeature(restaurantId: string, feature: keyof RestaurantFeatureFlags, enabled: boolean): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.apiUrl}/platform/restaurants/${restaurantId}/features/${feature}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled })
    });

    if (!response.ok) {
      throw new Error('Failed to toggle feature');
    }
  }

  async applyEmergencyOverride(restaurantId: string, override: {
    paymentProvider?: string;
    features?: Partial<RestaurantFeatureFlags>;
    message?: string;
  }): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.apiUrl}/platform/restaurants/${restaurantId}/emergency-override`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(override)
    });

    if (!response.ok) {
      throw new Error('Failed to apply emergency override');
    }
  }
}

export const platformSettingsService = new PlatformSettingsService();
export type { PlatformSettings, RestaurantSettings, RestaurantPaymentConfig, RestaurantFeatureFlags };