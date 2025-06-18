import { InteractionManager } from 'react-native';
import { cacheManager, cacheUtils } from './cacheManager';
import { performanceUtils } from '../hooks/usePerformanceMonitor';

export interface PrefetchConfig {
  key: string;
  fetchFn: () => Promise<any>;
  priority: 'high' | 'medium' | 'low';
  dependencies?: string[];
  cacheTTL?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

class DataPrefetcher {
  private prefetchQueue: Map<string, PrefetchConfig> = new Map();
  private inProgress: Set<string> = new Set();
  private completed: Set<string> = new Set();
  private failed: Map<string, Error> = new Map();

  /**
   * Add data to prefetch queue
   */
  addToPrefetchQueue(config: PrefetchConfig): void {
    this.prefetchQueue.set(config.key, config);
  }

  /**
   * Start prefetching process
   */
  async startPrefetching(): Promise<void> {
    // Wait for interactions to complete before starting
    await new Promise(resolve => 
      InteractionManager.runAfterInteractions(resolve)
    );

    // Sort by priority
    const sortedConfigs = Array.from(this.prefetchQueue.values())
      .sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));

    // Process high priority items first
    const highPriorityItems = sortedConfigs.filter(config => config.priority === 'high');
    await this.processBatch(highPriorityItems);

    // Then process medium and low priority items
    const remainingItems = sortedConfigs.filter(config => config.priority !== 'high');
    this.processBatchAsync(remainingItems);
  }

  /**
   * Prefetch specific data immediately
   */
  async prefetchImmediate(key: string): Promise<any> {
    const config = this.prefetchQueue.get(key);
    if (!config) {
      throw new Error(`Prefetch config not found for key: ${key}`);
    }

    return this.executeWithRetry(config);
  }

  /**
   * Check if data is available (cached or prefetched)
   */
  async isDataAvailable(key: string): Promise<boolean> {
    if (this.completed.has(key)) {
      return true;
    }

    const cached = await cacheManager.has(key);
    return cached;
  }

  /**
   * Get prefetched data
   */
  async getPrefetchedData<T>(key: string): Promise<T | null> {
    // Check if prefetching is in progress
    if (this.inProgress.has(key)) {
      // Wait for completion
      await this.waitForCompletion(key);
    }

    // Try to get from cache
    const cached = await cacheManager.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // If not cached and not in queue, return null
    if (!this.prefetchQueue.has(key)) {
      return null;
    }

    // Execute immediately if not yet started
    const config = this.prefetchQueue.get(key)!;
    return this.executeWithRetry(config);
  }

  /**
   * Clear prefetch cache and queue
   */
  async clearAll(): Promise<void> {
    this.prefetchQueue.clear();
    this.inProgress.clear();
    this.completed.clear();
    this.failed.clear();
    await cacheManager.clear();
  }

  /**
   * Get prefetching statistics
   */
  getStats(): {
    queued: number;
    inProgress: number;
    completed: number;
    failed: number;
    successRate: number;
  } {
    const total = this.completed.size + this.failed.size;
    const successRate = total > 0 ? (this.completed.size / total) * 100 : 0;

    return {
      queued: this.prefetchQueue.size,
      inProgress: this.inProgress.size,
      completed: this.completed.size,
      failed: this.failed.size,
      successRate,
    };
  }

  private async processBatch(configs: PrefetchConfig[]): Promise<void> {
    const promises = configs.map(config => this.executeWithRetry(config));
    await Promise.allSettled(promises);
  }

  private async processBatchAsync(configs: PrefetchConfig[]): Promise<void> {
    // Process in smaller chunks to avoid overwhelming the system
    const chunks = performanceUtils.chunkArray(configs, 3);
    
    for (const chunk of chunks) {
      await this.processBatch(chunk);
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async executeWithRetry(config: PrefetchConfig): Promise<any> {
    const { key, fetchFn, retryAttempts = 3, retryDelay = 1000, cacheTTL } = config;

    // Check dependencies first
    if (config.dependencies) {
      const dependenciesReady = await Promise.all(
        config.dependencies.map(dep => this.isDataAvailable(dep))
      );
      
      if (!dependenciesReady.every(ready => ready)) {
        throw new Error(`Dependencies not ready for ${key}`);
      }
    }

    this.inProgress.add(key);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        const data = await fetchFn();
        
        // Cache the result
        await cacheManager.set(key, data, {
          ttl: cacheTTL,
          persistToStorage: true,
        });

        this.inProgress.delete(key);
        this.completed.add(key);
        this.failed.delete(key);

        if (__DEV__) {
          console.log(`[DataPrefetcher] Successfully prefetched: ${key}`);
        }

        return data;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retryAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    this.inProgress.delete(key);
    this.failed.set(key, lastError!);

    if (__DEV__) {
      console.warn(`[DataPrefetcher] Failed to prefetch ${key}:`, lastError);
    }

    throw lastError!;
  }

  private async waitForCompletion(key: string, timeout: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (this.inProgress.has(key) && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private getPriorityWeight(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }
}

// Export singleton instance
export const dataPrefetcher = new DataPrefetcher();

// Predefined prefetch configurations for common data
export const commonPrefetchConfigs = {
  // Menu items - high priority as they're frequently accessed
  menuItems: {
    key: 'menu_items',
    fetchFn: async () => {
      // This would be replaced with actual API call
      const { generateMenuItems } = await import('../utils/mockDataGenerator');
      return generateMenuItems();
    },
    priority: 'high' as const,
    cacheTTL: 10 * 60 * 1000, // 10 minutes
  },

  // User profile data
  userProfile: {
    key: 'user_profile',
    fetchFn: async () => {
      // This would be replaced with actual API call
      return { id: 1, name: 'Demo User', role: 'manager' };
    },
    priority: 'high' as const,
    cacheTTL: 60 * 60 * 1000, // 1 hour
  },

  // Sales reports - medium priority
  salesReports: {
    key: 'sales_reports',
    fetchFn: async () => {
      const { generateSalesHistory } = await import('../utils/mockDataGenerator');
      return generateSalesHistory(30);
    },
    priority: 'medium' as const,
    cacheTTL: 30 * 60 * 1000, // 30 minutes
  },

  // Customer data - low priority for background loading
  customerData: {
    key: 'customer_data',
    fetchFn: async () => {
      const { generateCustomers } = await import('../utils/mockDataGenerator');
      return generateCustomers(100);
    },
    priority: 'low' as const,
    cacheTTL: 60 * 60 * 1000, // 1 hour
  },

  // Employee schedules
  employeeSchedules: {
    key: 'employee_schedules',
    fetchFn: async () => {
      const { generateScheduleData } = await import('../utils/mockDataGenerator');
      return generateScheduleData();
    },
    priority: 'medium' as const,
    dependencies: ['user_profile'],
    cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
  },
};

// Utility function to setup common prefetching
export const setupCommonPrefetching = async (): Promise<void> => {
  // Add all common configurations to the queue
  Object.values(commonPrefetchConfigs).forEach(config => {
    dataPrefetcher.addToPrefetchQueue(config);
  });

  // Start prefetching
  await dataPrefetcher.startPrefetching();
};

// Hook for components to easily prefetch data
export const usePrefetchedData = <T>(key: string) => {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await dataPrefetcher.getPrefetchedData<T>(key);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [key]);

  return { data, loading, error };
};

// Add React import for the hook
import React from 'react';

export default dataPrefetcher;