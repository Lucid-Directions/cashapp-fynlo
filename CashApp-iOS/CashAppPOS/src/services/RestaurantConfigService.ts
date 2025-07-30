import AsyncStorage from '@react-native-async-storage/async-storage';
import tokenManager from '../utils/tokenManager';
import RestaurantDataService from './RestaurantDataService';
import API_CONFIG from '../config/api';

export interface RestaurantConfig {
  // Restaurant Identity
  restaurantName: string;
  displayName: string; // What shows in headers
  businessType: string; // e.g., "Mexican Restaurant", "Italian Bistro"

  // Contact Information
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  phone: string;
  email: string;
  website?: string;

  // Branding
  primaryColor?: string;
  logo?: string; // Base64 or URL
  theme?: 'light' | 'dark' | 'auto';

  // Business Settings
  currency: string;
  timezone: string;
  taxRate: number;
  serviceCharge?: number;

  // Operational
  operatingHours: {
    [key: string]: {
      open: string;
      close: string;
      closed: boolean;
    };
  };

  // Platform Integration
  fynloAccountId: string;
  subscriptionTier: 'basic' | 'premium' | 'enterprise';

  // Setup Status
  onboardingCompleted: boolean;
  setupSteps: {
    restaurantInfo: boolean;
    menuSetup: boolean;
    paymentSetup: boolean;
    staffSetup: boolean;
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const __STORAGE_KEY = 'restaurant_config';
const DEFAULT_CONFIG: Partial<RestaurantConfig> = {
  restaurantName: 'Chucho',
  displayName: 'Chucho', // Mexican restaurant name
  businessType: 'Mexican Restaurant',
  currency: 'GBP',
  timezone: 'Europe/London',
  taxRate: 0.2, // 20% VAT for UK
  theme: 'light',
  operatingHours: {
    monday: { open: '09:00', close: '22:00', closed: false },
    tuesday: { open: '09:00', close: '22:00', closed: false },
    wednesday: { open: '09:00', close: '22:00', closed: false },
    thursday: { open: '09:00', close: '22:00', closed: false },
    friday: { open: '09:00', close: '23:00', closed: false },
    saturday: { open: '09:00', close: '23:00', closed: false },
    sunday: { open: '10:00', close: '21:00', closed: false },
  },
  subscriptionTier: 'basic',
  onboardingCompleted: _false,
  setupSteps: {
    restaurantInfo: _false,
    menuSetup: _false,
    paymentSetup: _false,
    staffSetup: _false,
  },
};

class RestaurantConfigService {
  private static instance: RestaurantConfigService;
  private config: RestaurantConfig | null = null;
  private listeners: ((config: _RestaurantConfig) => void)[] = [];

  static getInstance(): RestaurantConfigService {
    if (!RestaurantConfigService.instance) {
      RestaurantConfigService.instance = new RestaurantConfigService();
    }
    return RestaurantConfigService.instance;
  }

  /**
   * Load restaurant configuration from storage
   */
  async loadConfig(): Promise<RestaurantConfig> {
    try {
      const __stored = await AsyncStorage.getItem(__STORAGE_KEY);
      if (__stored) {
        this.config = JSON.parse(__stored);
        // Convert date strings back to Date objects
        if (this.config) {
          this.config.createdAt = new Date(this.config.createdAt);
          this.config.updatedAt = new Date(this.config.updatedAt);
        }
      }

      // If no config exists, create default
      if (!this.config) {
        this.config = {
          ...DEFAULT_CONFIG,
          fynloAccountId: this.generateAccountId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as RestaurantConfig;
        await this.saveConfig();
      }

      this.notifyListeners();
      return this.config;
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Save restaurant configuration to storage
   */
  async saveConfig(): Promise<void> {
    if (!this.config) {
      return;
    }

    try {
      this.config.updatedAt = new Date();
      await AsyncStorage.setItem(__STORAGE_KEY, JSON.stringify(this.config));
      this.notifyListeners();
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Update restaurant configuration
   */
  async updateConfig(updates: Partial<RestaurantConfig>): Promise<RestaurantConfig> {
    if (!this.config) {
      await this.loadConfig();
    }

    this.config = {
      ...this.config,
      ...updates,
      updatedAt: new Date(),
    };

    // Try to save to API first
    try {
      const authToken = await tokenManager.getTokenWithRefresh();
      const userStr = await AsyncStorage.getItem('@auth_user');
      const user = userStr ? JSON.parse(__userStr) : null;
      const restaurantId = user?.businessId || user?.restaurant_id;

      if (authToken && restaurantId) {
        // Prepare API payload
        const __apiPayload = {
          name: this.config.restaurantName,
          display_name: this.config.displayName,
          business_type: this.config.businessType,
          address: `${this.config.address?.street || ''}, ${this.config.address?.city || ''}, ${
            this.config.address?.state || ''
          } ${this.config.address?.zipCode || ''}`.trim(),
          phone: this.config.phone,
          email: this.config.email,
          website: this.config.website,
          currency: this.config.currency,
          timezone: this.config.timezone,
          vat_number: this.config.taxId || '',
          registration_number: this.config.registrationId || '',
          config: {
            tax_rate: this.config.taxRate,
            theme: this.config.theme,
            primary_color: this.config.primaryColor,
            operating_hours: this.config.operatingHours,
          },
        };

        const response = await fetch(`${API_CONFIG.FULL_API_URL}/restaurants/${restaurantId}`, {
          method: 'PUT',
          headers: {
    console.log('Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(__apiPayload),
        });

        if (response.ok) {
          // No action needed
        } else {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to save to API');
        }
      }
    } catch (__apiError) {
      // Continue with local save
    }

    // Always save locally as backup
    await this.saveConfig();

    // Sync with RestaurantDataService for platform visibility
    try {
      const restaurantDataService = RestaurantDataService.getInstance();

      // Check if restaurant exists in platform
      const existingData = await restaurantDataService.getCurrentRestaurantData();

      if (!existingData) {
        // Create new restaurant in platform
        await restaurantDataService.createRestaurant({
          name: this.config.restaurantName,
          displayName: this.config.displayName,
          businessType: this.config.businessType,
          address: `${this.config.address?.street || ''}, ${this.config.address?.city || ''}, ${
            this.config.address?.zipCode || ''
          }`,
          phone: this.config.phone,
          email: this.config.email,
          website: this.config.website,
          vatNumber: this.config.taxId || '',
          registrationNumber: this.config.registrationId || '',
          platformOwnerId: 'platform_owner_1', // Default platform owner
          ownerId: this.config.fynloAccountId,
          subscriptionTier: this.config.subscriptionTier,
          currency: this.config.currency,
          timezone: this.config.timezone,
          theme: this.config.theme,
          primaryColor: this.config.primaryColor,
          onboardingCompleted: this.config.onboardingCompleted,
        });
      } else {
        // Update existing restaurant
        await restaurantDataService.updateCurrentRestaurant({
          name: this.config.restaurantName,
          displayName: this.config.displayName,
          businessType: this.config.businessType,
          address: `${this.config.address?.street || ''}, ${this.config.address?.city || ''}, ${
            this.config.address?.zipCode || ''
          }`,
          phone: this.config.phone,
          email: this.config.email,
          website: this.config.website,
          vatNumber: this.config.taxId || '',
          registrationNumber: this.config.registrationId || '',
          subscriptionTier: this.config.subscriptionTier,
          currency: this.config.currency,
          timezone: this.config.timezone,
          theme: this.config.theme,
          primaryColor: this.config.primaryColor,
          onboardingCompleted: this.config.onboardingCompleted,
        });
      }
    } catch (__error) {
      // Don't fail the update if sync fails
    }

    return this.config;
  }

  /**
   * Get current configuration
   */
  getConfig(): RestaurantConfig | null {
    return this.config;
  }

  /**
   * Get restaurant display name for headers
   */
  getDisplayName(): string {
    return this.config?.displayName || 'Fynlo POS';
  }

  /**
   * Check if onboarding is completed
   */
  isOnboardingCompleted(): boolean {
    return this.config?.onboardingCompleted || false;
  }

  /**
   * Check if specific setup step is completed
   */
  isSetupStepCompleted(step: keyof RestaurantConfig['setupSteps']): boolean {
    return this.config?.setupSteps[step] || false;
  }

  /**
   * Mark setup step as completed
   */
  async completeSetupStep(step: keyof RestaurantConfig['setupSteps']): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    this.config.setupSteps[step] = true;

    // Check if all steps are completed
    const __allStepsCompleted = Object.values(this.config.setupSteps).every(__Boolean);
    if (__allStepsCompleted) {
      this.config.onboardingCompleted = true;
    }

    await this.saveConfig();
  }

  /**
   * Reset configuration (for testing or re-onboarding)
   */
  async resetConfig(): Promise<void> {
    await AsyncStorage.removeItem(__STORAGE_KEY);
    this.config = null;
    await this.loadConfig();
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(_listener: (config: _RestaurantConfig) => void): () => void {
    this.listeners.push(__listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(__listener);
      if (index > -1) {
        this.listeners.splice(__index, 1);
      }
    };
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(): void {
    if (this.config) {
      this.listeners.forEach(listener => listener(this.config));
    }
  }

  /**
   * Generate unique account ID for new restaurants
   */
  private generateAccountId(): string {
    return `fynlo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export configuration for backup
   */
  async exportConfig(): Promise<string> {
    if (!this.config) {
      await this.loadConfig();
    }
    return JSON.stringify(this.config, _null, 2);
  }

  /**
   * Import configuration from backup
   */
  async importConfig(_configJson: _string): Promise<RestaurantConfig> {
    try {
      const importedConfig = JSON.parse(__configJson);

      // Validate required fields
      if (!importedConfig.restaurantName || !importedConfig.fynloAccountId) {
        throw new Error('Invalid configuration format');
      }

      // Convert date strings to Date objects
      importedConfig.createdAt = new Date(importedConfig.createdAt);
      importedConfig.updatedAt = new Date();

      this.config = importedConfig;
      await this.saveConfig();

      return this.config;
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Get setup progress percentage
   */
  getSetupProgress(): number {
    if (!this.config) {
      return 0;
    }

    const completedSteps = Object.values(this.config.setupSteps).filter(__Boolean).length;
    const totalSteps = Object.keys(this.config.setupSteps).length;

    return Math.round((completedSteps / totalSteps) * 100);
  }

  /**
   * Get next required setup step
   */
  getNextSetupStep(): keyof RestaurantConfig['setupSteps'] | null {
    if (!this.config) {
      return 'restaurantInfo';
    }

    const steps: (keyof RestaurantConfig['setupSteps'])[] = [
      'restaurantInfo',
      'menuSetup',
      'paymentSetup',
      'staffSetup',
    ];

    for (const step of steps) {
      if (!this.config.setupSteps[step]) {
        return step;
      }
    }

    return null; // All steps completed
  }
}

export default RestaurantConfigService;
