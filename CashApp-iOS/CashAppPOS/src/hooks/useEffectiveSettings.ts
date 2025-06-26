import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SettingsResolver, { EffectiveSettings } from '../services/SettingsResolver';

/**
 * Hook for accessing effective settings with platform-restaurant inheritance
 * 
 * This hook automatically resolves the correct settings based on:
 * 1. Platform-level defaults
 * 2. Restaurant-specific overrides (where allowed)
 * 3. User context and permissions
 */

interface UseEffectiveSettingsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseEffectiveSettingsReturn {
  settings: EffectiveSettings | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateSetting: (key: string, value: any) => Promise<boolean>;
  getPlatformControlledSettings: () => Promise<Record<string, any>>;
  canOverrideSetting: (key: string) => boolean;
  isSettingPlatformControlled: (key: string) => boolean;
  getSettingSource: (key: string) => 'platform' | 'restaurant' | 'unknown';
}

export const useEffectiveSettings = (
  options: UseEffectiveSettingsOptions = {}
): UseEffectiveSettingsReturn => {
  const { autoRefresh = true, refreshInterval = 300000 } = options; // 5 minutes default
  const { user, business } = useAuth();
  
  const [settings, setSettings] = useState<EffectiveSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Platform-controlled settings that cannot be overridden by restaurants
  const platformControlledSettings = [
    'serviceTaxRate',
    'serviceTaxEnabled', 
    'paymentMethods',
    'minimumOrderValue',
    'maximumOrderValue',
    'enableAdvancedReporting',
    'enableCustomBranding',
    'enableAPIAccess'
  ];

  // Settings that restaurants can override (if allowed by platform)
  const restaurantOverridableSettings = [
    'vatRate',
    'vatInclusive',
    'currency',
    'timezone',
    'language',
    // Branding settings (only if custom branding enabled)
    'logoUrl',
    'primaryColor', 
    'brandName'
  ];

  /**
   * Load effective settings
   */
  const loadSettings = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const effectiveSettings = await SettingsResolver.getEffectiveSettings(
        business?.id,
        forceRefresh
      );

      setSettings(effectiveSettings);
      
      console.log('Effective settings loaded:', {
        source: effectiveSettings.source,
        overrides: Object.keys(effectiveSettings.overrides),
        businessId: business?.id,
        userRole: user?.role
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      // Use warn instead of error for network failures to avoid red error banners
      console.warn('Error loading effective settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [business?.id, user?.role]);

  /**
   * Refresh settings manually
   */
  const refresh = useCallback(async () => {
    await loadSettings(true);
  }, [loadSettings]);

  /**
   * Update a specific setting (if allowed)
   */
  const updateSetting = useCallback(async (key: string, value: any): Promise<boolean> => {
    try {
      if (!canOverrideSetting(key)) {
        console.warn(`Setting '${key}' is platform-controlled and cannot be overridden`);
        return false;
      }

      const success = await SettingsResolver.updateRestaurantSetting(
        key, 
        value, 
        business?.id
      );

      if (success) {
        // Refresh settings to reflect changes
        await refresh();
      }

      return success;
    } catch (error) {
      console.error('Error updating setting:', error);
      return false;
    }
  }, [business?.id, refresh]);

  /**
   * Get platform-controlled settings
   */
  const getPlatformControlledSettings = useCallback(async (): Promise<Record<string, any>> => {
    return await SettingsResolver.getPlatformControlledSettings();
  }, []);

  /**
   * Check if a setting can be overridden by the restaurant
   */
  const canOverrideSetting = useCallback((key: string): boolean => {
    // Platform owners can modify anything
    if (user?.role === 'platform_owner') {
      return true;
    }

    // Restaurant users can only override certain settings
    if (restaurantOverridableSettings.includes(key)) {
      // Check if custom branding is enabled for branding settings
      if (['logoUrl', 'primaryColor', 'brandName'].includes(key)) {
        return settings?.enableCustomBranding ?? false;
      }
      return true;
    }

    return false;
  }, [user?.role, settings?.enableCustomBranding]);

  /**
   * Check if a setting is platform-controlled
   */
  const isSettingPlatformControlled = useCallback((key: string): boolean => {
    return platformControlledSettings.includes(key);
  }, []);

  /**
   * Get the source of a specific setting value
   */
  const getSettingSource = useCallback((key: string): 'platform' | 'restaurant' | 'unknown' => {
    if (!settings) return 'unknown';

    if (settings.overrides[`restaurant_${key}`] !== undefined) {
      return 'restaurant';
    }

    if (settings.overrides[`platform_${key}`] !== undefined) {
      return 'platform';
    }

    // Default source based on setting type
    if (platformControlledSettings.includes(key)) {
      return 'platform';
    }

    return settings.source === 'merged' ? 'restaurant' : 'platform';
  }, [settings]);

  // Load settings on mount and when dependencies change
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Auto-refresh if enabled (but not when there are network errors)
  useEffect(() => {
    if (!autoRefresh || !refreshInterval || error) return;

    const interval = setInterval(() => {
      // Only auto-refresh if we don't have network errors
      if (!error) {
        loadSettings();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadSettings, error]);

  // Clear cache and reload when business changes
  useEffect(() => {
    if (business?.id) {
      SettingsResolver.clearCache();
      loadSettings(true);
    }
  }, [business?.id, loadSettings]);

  return {
    settings,
    isLoading,
    error,
    refresh,
    updateSetting,
    getPlatformControlledSettings,
    canOverrideSetting,
    isSettingPlatformControlled,
    getSettingSource,
  };
};

export default useEffectiveSettings;