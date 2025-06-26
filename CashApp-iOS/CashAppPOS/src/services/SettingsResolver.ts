import PlatformService from './PlatformService';
import RestaurantConfigService from './RestaurantConfigService';
import { useAuth } from '../contexts/AuthContext';

/**
 * SettingsResolver - Manages the inheritance hierarchy between platform and restaurant settings
 * 
 * Hierarchy:
 * 1. Platform Settings (defaults)
 * 2. Restaurant Overrides (if allowed)
 * 3. User/Session Overrides (temporary)
 */

export interface EffectiveSettings {
  // Tax Configuration
  vatEnabled: boolean;
  vatRate: number;
  vatInclusive: boolean;
  serviceTaxRate: number;
  serviceTaxEnabled: boolean;
  
  // Payment Settings
  paymentMethods: Record<string, any>;
  minimumOrderValue: number;
  maximumOrderValue: number;
  
  // Business Settings
  currency: string;
  timezone: string;
  language: string;
  
  // Feature Flags (Platform Controlled)
  enableAdvancedReporting: boolean;
  enableCustomBranding: boolean;
  enableAPIAccess: boolean;
  
  // Branding
  logoUrl?: string;
  primaryColor: string;
  brandName: string;
  
  // Metadata
  source: 'platform' | 'restaurant' | 'merged';
  lastUpdated: Date;
  overrides: Record<string, any>;
}

class SettingsResolverService {
  private platformService: PlatformService;
  private restaurantConfigService: RestaurantConfigService;
  private effectiveSettingsCache: EffectiveSettings | null = null;
  private cacheExpiry: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.platformService = PlatformService.getInstance();
    this.restaurantConfigService = RestaurantConfigService.getInstance();
  }

  /**
   * Get effective settings for the current restaurant with platform inheritance
   */
  async getEffectiveSettings(restaurantId?: string, forceRefresh = false): Promise<EffectiveSettings> {
    // Check cache first
    if (!forceRefresh && this.isValidCache()) {
      return this.effectiveSettingsCache!;
    }

    try {
      // Quick timeout for network requests to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout')), 2000);
      });

      // Get platform settings with timeout (base layer)
      let platformSettings = null;
      try {
        platformSettings = await Promise.race([
          this.platformService.getSettings(),
          timeoutPromise
        ]);
      } catch (error) {
        console.warn('Platform service unavailable, using fallback settings');
        return this.getFallbackSettings();
      }
      
      // Get restaurant config (override layer)
      const restaurantConfig = await this.restaurantConfigService.getConfig();
      
      // Get restaurant-specific platform settings if available
      let restaurantPlatformSettings = null;
      if (restaurantId) {
        try {
          restaurantPlatformSettings = await Promise.race([
            this.platformService.getRestaurantEffectiveSettings(restaurantId),
            timeoutPromise
          ]);
        } catch (error) {
          console.warn('Could not get restaurant platform settings:', error);
        }
      }

      // Merge settings with proper hierarchy
      const effectiveSettings = this.mergeSettings(
        platformSettings,
        restaurantPlatformSettings,
        restaurantConfig
      );

      // Cache the result
      this.effectiveSettingsCache = effectiveSettings;
      this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION);

      return effectiveSettings;
    } catch (error) {
      console.error('Error resolving effective settings:', error);
      
      // Return fallback settings and cache them to prevent repeated failures
      const fallbackSettings = this.getFallbackSettings();
      this.effectiveSettingsCache = fallbackSettings;
      this.cacheExpiry = new Date(Date.now() + (this.CACHE_DURATION * 2)); // Cache fallback longer
      
      return fallbackSettings;
    }
  }

  /**
   * Merge settings from platform and restaurant with proper inheritance
   */
  private mergeSettings(
    platformSettings: any,
    restaurantPlatformSettings: any,
    restaurantConfig: any
  ): EffectiveSettings {
    const overrides: Record<string, any> = {};

    // Start with platform defaults
    const baseSettings = {
      // Tax Configuration - can be overridden by restaurant
      vatEnabled: platformSettings?.tax?.vatEnabled ?? true,
      vatRate: platformSettings?.tax?.vatRate ?? 20,
      vatInclusive: platformSettings?.tax?.vatInclusive ?? true,
      serviceTaxRate: platformSettings?.fees?.serviceTaxRate ?? 12.5,
      serviceTaxEnabled: platformSettings?.fees?.serviceTaxEnabled ?? true,

      // Payment Settings - controlled by platform
      paymentMethods: platformSettings?.payment?.methods ?? {},
      minimumOrderValue: platformSettings?.limits?.minimumOrderValue ?? 0,
      maximumOrderValue: platformSettings?.limits?.maximumOrderValue ?? 10000,

      // Business Settings - can be overridden by restaurant
      currency: platformSettings?.business?.currency ?? 'GBP',
      timezone: platformSettings?.business?.timezone ?? 'Europe/London',
      language: platformSettings?.business?.language ?? 'en-GB',

      // Feature Flags - platform controlled (cannot be overridden)
      enableAdvancedReporting: platformSettings?.features?.enableAdvancedReporting ?? false,
      enableCustomBranding: platformSettings?.features?.enableCustomBranding ?? false,
      enableAPIAccess: platformSettings?.features?.enableAPIAccess ?? false,

      // Branding - restaurant can override if custom branding enabled
      logoUrl: platformSettings?.branding?.logoUrl,
      primaryColor: platformSettings?.branding?.primaryColor ?? '#00A651',
      brandName: platformSettings?.branding?.brandName ?? 'fynlo',
    };

    // Apply restaurant-specific platform settings (if any)
    if (restaurantPlatformSettings) {
      Object.keys(restaurantPlatformSettings).forEach(key => {
        if (restaurantPlatformSettings[key] !== undefined) {
          overrides[`platform_${key}`] = baseSettings[key];
          baseSettings[key] = restaurantPlatformSettings[key];
        }
      });
    }

    // Apply restaurant overrides (only for allowed settings)
    if (restaurantConfig) {
      const allowedOverrides = [
        'vatRate',
        'vatInclusive', 
        'currency',
        'timezone',
        'language'
      ];

      // Apply branding overrides only if custom branding is enabled
      if (baseSettings.enableCustomBranding) {
        allowedOverrides.push('logoUrl', 'primaryColor', 'brandName');
      }

      allowedOverrides.forEach(key => {
        if (restaurantConfig[key] !== undefined && restaurantConfig[key] !== baseSettings[key]) {
          overrides[`restaurant_${key}`] = baseSettings[key];
          baseSettings[key] = restaurantConfig[key];
        }
      });
    }

    return {
      ...baseSettings,
      source: Object.keys(overrides).length > 0 ? 'merged' : 'platform',
      lastUpdated: new Date(),
      overrides,
    } as EffectiveSettings;
  }

  /**
   * Get fallback settings when all else fails
   */
  private getFallbackSettings(): EffectiveSettings {
    console.warn('⚠️ Using fallback settings - platform service unavailable');
    return {
      vatEnabled: true,
      vatRate: 20,
      vatInclusive: true,
      serviceTaxRate: 12.5, // Default fallback - should be loaded from platform
      serviceTaxEnabled: true,
      paymentMethods: {},
      minimumOrderValue: 0,
      maximumOrderValue: 10000,
      currency: 'GBP',
      timezone: 'Europe/London',
      language: 'en-GB',
      enableAdvancedReporting: false,
      enableCustomBranding: false,
      enableAPIAccess: false,
      primaryColor: '#00A651',
      brandName: 'fynlo',
      source: 'platform',
      lastUpdated: new Date(),
      overrides: {},
    };
  }

  /**
   * Check if cached settings are still valid
   */
  private isValidCache(): boolean {
    return this.effectiveSettingsCache !== null && 
           this.cacheExpiry !== null && 
           new Date() < this.cacheExpiry;
  }

  /**
   * Clear the settings cache (force refresh on next access)
   */
  clearCache(): void {
    this.effectiveSettingsCache = null;
    this.cacheExpiry = null;
  }

  /**
   * Update a restaurant setting (if override is allowed)
   */
  async updateRestaurantSetting(key: string, value: any, restaurantId?: string): Promise<boolean> {
    try {
      const effectiveSettings = await this.getEffectiveSettings(restaurantId);
      
      // Check if this setting can be overridden by restaurant
      const allowedOverrides = ['vatRate', 'vatInclusive', 'currency', 'timezone', 'language'];
      
      if (effectiveSettings.enableCustomBranding) {
        allowedOverrides.push('logoUrl', 'primaryColor', 'brandName');
      }

      if (!allowedOverrides.includes(key)) {
        console.warn(`Setting '${key}' cannot be overridden by restaurant (platform controlled)`);
        return false;
      }

      // Update the restaurant config
      await this.restaurantConfigService.updateConfig({ [key]: value });
      
      // Clear cache to force refresh
      this.clearCache();
      
      return true;
    } catch (error) {
      console.error('Error updating restaurant setting:', error);
      return false;
    }
  }

  /**
   * Get platform-controlled settings that cannot be overridden
   */
  async getPlatformControlledSettings(): Promise<Record<string, any>> {
    const effectiveSettings = await this.getEffectiveSettings();
    
    return {
      serviceTaxRate: effectiveSettings.serviceTaxRate,
      serviceTaxEnabled: effectiveSettings.serviceTaxEnabled,
      paymentMethods: effectiveSettings.paymentMethods,
      minimumOrderValue: effectiveSettings.minimumOrderValue,
      maximumOrderValue: effectiveSettings.maximumOrderValue,
      enableAdvancedReporting: effectiveSettings.enableAdvancedReporting,
      enableCustomBranding: effectiveSettings.enableCustomBranding,
      enableAPIAccess: effectiveSettings.enableAPIAccess,
    };
  }

  /**
   * Initialize settings for a new restaurant (inherit platform defaults)
   */
  async initializeRestaurantSettings(restaurantId: string): Promise<void> {
    try {
      // Get platform defaults
      const platformSettings = await this.platformService.getSettings();
      
      // Create initial restaurant config with platform defaults
      const initialConfig = {
        vatEnabled: platformSettings?.tax?.vatEnabled ?? true,
        vatRate: platformSettings?.tax?.vatRate ?? 20,
        vatInclusive: platformSettings?.tax?.vatInclusive ?? true,
        currency: platformSettings?.business?.currency ?? 'GBP',
        timezone: platformSettings?.business?.timezone ?? 'Europe/London',
        language: platformSettings?.business?.language ?? 'en-GB',
        lastUpdated: new Date(),
        inheritedFromPlatform: true,
      };

      // Save to restaurant config
      await this.restaurantConfigService.updateConfig(initialConfig);
      
      console.log(`Initialized restaurant ${restaurantId} with platform defaults`);
    } catch (error) {
      console.error('Error initializing restaurant settings:', error);
    }
  }
}

export const SettingsResolver = new SettingsResolverService();
export default SettingsResolver;