import AsyncStorage from '@react-native-async-storage/async-storage';

import API_CONFIG from '../config/api';
import tokenManager from '../utils/tokenManager';

import RestaurantDataService from './RestaurantDataService';

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

const STORAGE_KEY = 'restaurant_config';
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
  onboardingCompleted: false,
  setupSteps: {
    restaurantInfo: false,
    menuSetup: false,
    paymentSetup: false,
    staffSetup: false,
  },
};

class RestaurantConfigService {
  private static instance: RestaurantConfigService;
  private config: RestaurantConfig | null = null;
  private listeners: ((config: RestaurantConfig) => void)[] = [];

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
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.config = JSON.parse(stored);
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
    } catch (error) {
      logger.error('Error loading restaurant config:', error);
      throw error;
    }
  }

  /**
   * Save restaurant configuration to storage
   */
  async saveConfig(): Promise<void> {
    if (!this.config) return;

    try {
      this.config.updatedAt = new Date();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      this.notifyListeners();
    } catch (error) {
      logger.error('Error saving restaurant config:', error);
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
      ...this.config!,
      ...updates,
      updatedAt: new Date(),
    };

    // Try to save to API first
    try {
      const authToken = await tokenManager.getTokenWithRefresh();
      const userStr = await AsyncStorage.getItem('@auth_user');
      const user = userStr ? JSON.parse(userStr) : null;
      const restaurantId = user?.businessId || user?.restaurant_id;

      if (authToken && restaurantId) {
        // Prepare API payload
        const apiPayload = {
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
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(apiPayload),
        });

        if (response.ok) {
          logger.info('✅ Restaurant config saved to API');
        } else {
          const errorData = await response.json();
          logger.error('❌ API save failed:', errorData);
          throw new Error(errorData.detail || 'Failed to save to API');
        }
      }
    } catch (apiError) {
      logger.error('❌ Failed to save to API, saving locally:', apiError);
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

      logger.info('✅ Restaurant config synced to platform');
    } catch (error) {
      logger.error('❌ Failed to sync restaurant to platform:', error);
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

    this.config!.setupSteps[step] = true;

    // Check if all steps are completed
    const allStepsCompleted = Object.values(this.config!.setupSteps).every(Boolean);
    if (allStepsCompleted) {
      this.config!.onboardingCompleted = true;
    }

    await this.saveConfig();
  }

  /**
   * Reset configuration (for testing or re-onboarding)
   */
  async resetConfig(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.config = null;
    await this.loadConfig();
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(listener: (config: RestaurantConfig) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(): void {
    if (this.config) {
      this.listeners.forEach((listener) => listener(this.config!));
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
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from backup
   */
  async importConfig(configJson: string): Promise<RestaurantConfig> {
    try {
      const importedConfig = JSON.parse(configJson);

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
    } catch (error) {
      logger.error('Error importing configuration:', error);
      throw error;
    }
  }

  /**
   * Get setup progress percentage
   */
  getSetupProgress(): number {
    if (!this.config) return 0;

    const completedSteps = Object.values(this.config.setupSteps).filter(Boolean).length;
    const totalSteps = Object.keys(this.config.setupSteps).length;

    return Math.round((completedSteps / totalSteps) * 100);
  }

  /**
   * Get next required setup step
   */
  getNextSetupStep(): keyof RestaurantConfig['setupSteps'] | null {
    if (!this.config) return 'restaurantInfo';

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
