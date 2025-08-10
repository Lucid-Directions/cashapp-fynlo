import { useState, useEffect, useCallback } from 'react';

import RestaurantConfigService from '../services/RestaurantConfigService';
import type { RestaurantConfig } from '../services/RestaurantConfigService';

export interface UseRestaurantConfigReturn {
  config: RestaurantConfig | null;
  loading: boolean;
  error: string | null;
  displayName: string;
  isOnboardingCompleted: boolean;
  setupProgress: number;
  nextSetupStep: keyof RestaurantConfig['setupSteps'] | null;

  // Actions
  updateConfig: (updates: Partial<RestaurantConfig>) => Promise<void>;
  completeSetupStep: (step: keyof RestaurantConfig['setupSteps']) => Promise<void>;
  resetConfig: () => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Hook for accessing and managing restaurant configuration
 */
export const useRestaurantConfig = (): UseRestaurantConfigReturn => {
  const [config, setConfig] = useState<RestaurantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configService = RestaurantConfigService.getInstance();

  // Load configuration on mount
  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const loadedConfig = await configService.loadConfig();
        if (mounted) {
          setConfig(loadedConfig);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load configuration');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadConfig();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to configuration changes
  useEffect(() => {
    const unsubscribe = configService.subscribe((updatedConfig) => {
      setConfig(updatedConfig);
    });

    return unsubscribe;
  }, []);

  // Update configuration
  const updateConfig = useCallback(async (updates: Partial<RestaurantConfig>) => {
    try {
      setError(null);
      const updatedConfig = await configService.updateConfig(updates);
      setConfig(updatedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
      throw err;
    }
  }, []);

  // Complete setup step
  const completeSetupStep = useCallback(async (step: keyof RestaurantConfig['setupSteps']) => {
    try {
      setError(null);
      await configService.completeSetupStep(step);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup step');
      throw err;
    }
  }, []);

  // Reset configuration
  const resetConfig = useCallback(async () => {
    try {
      setError(null);
      await configService.resetConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset configuration');
      throw err;
    }
  }, []);

  // Reload configuration
  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const reloadedConfig = await configService.loadConfig();
      setConfig(reloadedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reload configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    config,
    loading,
    error,
    displayName: configService.getDisplayName(),
    isOnboardingCompleted: configService.isOnboardingCompleted(),
    setupProgress: configService.getSetupProgress(),
    nextSetupStep: configService.getNextSetupStep(),

    // Actions
    updateConfig,
    completeSetupStep,
    resetConfig,
    reload,
  };
};

/**
 * Hook for just getting the restaurant display name (optimized for headers)
 */
export const useRestaurantDisplayName = (): string => {
  const [displayName, setDisplayName] = useState('Fynlo POS');
  const configService = RestaurantConfigService.getInstance();

  useEffect(() => {
    const loadDisplayName = async () => {
      await configService.loadConfig();
      setDisplayName(configService.getDisplayName());
    };

    loadDisplayName();

    const unsubscribe = configService.subscribe((config) => {
      setDisplayName(config.displayName || config.restaurantName || 'Fynlo POS');
    });

    return unsubscribe;
  }, []);

  return displayName;
};

/**
 * Hook for checking onboarding status
 */
export const useOnboardingStatus = () => {
  const [status, setStatus] = useState({
    completed: false,
    progress: 0,
    nextStep: null as keyof RestaurantConfig['setupSteps'] | null,
  });

  const configService = RestaurantConfigService.getInstance();

  useEffect(() => {
    const loadStatus = async () => {
      await configService.loadConfig();
      setStatus({
        completed: configService.isOnboardingCompleted(),
        progress: configService.getSetupProgress(),
        nextStep: configService.getNextSetupStep(),
      });
    };

    loadStatus();

    const unsubscribe = configService.subscribe(() => {
      setStatus({
        completed: configService.isOnboardingCompleted(),
        progress: configService.getSetupProgress(),
        nextStep: configService.getNextSetupStep(),
      });
    });

    return unsubscribe;
  }, []);

  return status;
};
