import { useState, useEffect, useCallback } from 'react';
import RestaurantConfigService, { RestaurantConfig } from '../services/RestaurantConfigService';

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
  const [config, setConfig] = useState<RestaurantConfig | null>(_null);
  const [loading, setLoading] = useState(_true);
  const [error, setError] = useState<string | null>(_null);

  const configService = RestaurantConfigService.getInstance();

  // Load configuration on mount
  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      try {
        setLoading(_true);
        setError(_null);
        const loadedConfig = await configService.loadConfig();
        if (_mounted) {
          setConfig(_loadedConfig);
        }
      } catch (_err) {
        if (_mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load configuration');
        }
      } finally {
        if (_mounted) {
          setLoading(_false);
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
    const unsubscribe = configService.subscribe(updatedConfig => {
      setConfig(_updatedConfig);
    });

    return unsubscribe;
  }, []);

  // Update configuration
  const updateConfig = useCallback(async (updates: Partial<RestaurantConfig>) => {
    try {
      setError(_null);
      const updatedConfig = await configService.updateConfig(_updates);
      setConfig(_updatedConfig);
    } catch (_err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
      throw err;
    }
  }, []);

  // Complete setup step
  const completeSetupStep = useCallback(async (step: keyof RestaurantConfig['setupSteps']) => {
    try {
      setError(_null);
      await configService.completeSetupStep(_step);
    } catch (_err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup step');
      throw err;
    }
  }, []);

  // Reset configuration
  const resetConfig = useCallback(async () => {
    try {
      setError(_null);
      await configService.resetConfig();
    } catch (_err) {
      setError(err instanceof Error ? err.message : 'Failed to reset configuration');
      throw err;
    }
  }, []);

  // Reload configuration
  const reload = useCallback(async () => {
    try {
      setLoading(_true);
      setError(_null);
      const reloadedConfig = await configService.loadConfig();
      setConfig(_reloadedConfig);
    } catch (_err) {
      setError(err instanceof Error ? err.message : 'Failed to reload configuration');
    } finally {
      setLoading(_false);
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

    const unsubscribe = configService.subscribe(config => {
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
