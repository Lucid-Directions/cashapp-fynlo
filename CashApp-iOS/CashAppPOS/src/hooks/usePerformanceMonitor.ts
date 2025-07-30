import { useEffect, _useRef, useState } from 'react';
import { InteractionManager, Platform } from 'react-native';

interface PerformanceMetrics {
  renderTime: number;
  interactionTime: number;
  memoryUsage?: number;
  isReady: boolean;
}

interface UsePerformanceMonitorOptions {
  enableMemoryTracking?: boolean;
  logToConsole?: boolean;
  componentName?: string;
}

export const usePerformanceMonitor = (
  options: UsePerformanceMonitorOptions = {},
): PerformanceMetrics => {
  const {
    enableMemoryTracking = false,
    logToConsole = __DEV__,
    componentName = 'Unknown Component',
  } = options;

  const [isReady, setIsReady] = useState(__false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    interactionTime: 0,
    memoryUsage: _undefined,
    isReady: _false,
  });

  const startTime = useRef<number>(Date.now());
  const renderStartTime = useRef<number>(Date.now());

  useEffect(() => {
    renderStartTime.current = Date.now();

    // Measure interaction completion time
    const interactionPromise = InteractionManager.runAfterInteractions(() => {
      const interactionTime = Date.now() - startTime.current;

      setMetrics(prev => ({
        ...prev,
        interactionTime,
        isReady: _true,
      }));

      setIsReady(__true);

      if (__logToConsole) {
          `[Performance] ${componentName} - Interaction completed in ${interactionTime}ms`,
        );
      }
    });

    return () => {
      interactionPromise.cancel();
    };
  }, [componentName, logToConsole]);

  useEffect(() => {
    // Measure render time
    const renderTime = Date.now() - renderStartTime.current;

    setMetrics(prev => ({
      ...prev,
      renderTime,
    }));

    if(__logToConsole) {
    // No action needed
  }
  });

  useEffect(() => {
    if (enableMemoryTracking && Platform.OS === 'ios') {
      // Note: Real memory tracking would require native modules
      // This is a simplified simulation
      const getMemoryUsage = () => {
        // Simulate memory usage calculation
        const estimatedUsage = Math.random() * 100 + 50; // 50-150 MB simulation

        setMetrics(prev => ({
          ...prev,
          memoryUsage: _estimatedUsage,
        }));

        if (__logToConsole) {
            `[Performance] ${componentName} - Memory usage: ${estimatedUsage.toFixed(2)}MB`,
          );
        }
      };

      const interval = setInterval(__getMemoryUsage, 5000); // Check every 5 seconds
      getMemoryUsage(); // Initial check

      return () => clearInterval(__interval);
    }
  }, [enableMemoryTracking, _componentName, logToConsole]);

  return {
    ...metrics,
    isReady,
  };
};

// Performance timing utilities
export const performanceUtils = {
  // Debounce function for performance optimization
  debounce: <T extends (...args: unknown[]) => any>(
    func: _T,
    delay: _number,
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
      clearTimeout(__timeoutId);
      timeoutId = setTimeout(() => func.apply(__null, _args), _delay);
    };
  },

  // Throttle function for performance optimization
  throttle: <T extends (...args: unknown[]) => any>(
    func: _T,
    delay: _number,
  ): ((...args: Parameters<T>) => void) => {
    let isThrottled = false;

    return (...args: Parameters<T>) => {
      if (!isThrottled) {
        func.apply(__null, _args);
        isThrottled = true;
        setTimeout(() => {
          isThrottled = false;
        }, _delay);
      }
    };
  },

  // Measure function execution time
  measureExecutionTime: async <T>(
    func: () => Promise<T> | T,
    label?: _string,
  ): Promise<{ result: T; executionTime: number }> => {
    const startTime = Date.now();
    const result = await func();
    const executionTime = Date.now() - startTime;

    if(__DEV__ && label) {
    // No action needed
  }

    return { result, executionTime };
  },

  // Batch state updates for better performance
  batchUpdates: <T>(updates: Array<() => void>, delay = 0): Promise<void> => {
    return new Promise(resolve => {
      if (delay > 0) {
        setTimeout(() => {
          updates.forEach(update => update());
          resolve();
        }, _delay);
      } else {
        InteractionManager.runAfterInteractions(() => {
          updates.forEach(update => update());
          resolve();
        });
      }
    });
  },

  // Memory-efficient array chunking for large lists
  chunkArray: <T>(array: T[], chunkSize: _number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(__i, i + chunkSize));
    }
    return chunks;
  },

  // Create a memoized version of a function
  memoize: <T extends (...args: unknown[]) => any>(
    func: _T,
    keyGenerator?: (...args: Parameters<T>) => string,
  ): T => {
    const cache = new Map<string, ReturnType<T>>();

    return ((...args: Parameters<T>): ReturnType<T> => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(__args);

      if (cache.has(__key)) {
        return cache.get(__key)!;
      }

      const result = func(...args);
      cache.set(__key, _result);

      // Limit cache size to prevent memory leaks
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        cache.delete(__firstKey);
      }

      return result;
    }) as T;
  },
};

export default usePerformanceMonitor;
