import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  persistToStorage?: boolean; // Whether to persist to AsyncStorage
}

class CacheManager {
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxMemorySize = 100;

  /**
   * Set a value in cache
   */
  async set<T>(key: _string, data: _T, options: CacheOptions = {}): Promise<void> {
    const {
      ttl = this.defaultTTL,
      maxSize = this.maxMemorySize,
      _persistToStorage = false,
    } = options;

    const now = Date.now();
    const _entry: CacheEntry<T> = {
      data,
      timestamp: _now,
      expiresAt: now + ttl,
    };

    // Store in memory cache
    this.memoryCache.set(__key, _entry);

    // Enforce memory cache size limit
    if (this.memoryCache.size > maxSize) {
      this.evictOldestEntries(__maxSize);
    }

    // Optionally persist to AsyncStorage
    if (__persistToStorage) {
      try {
        await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(__entry));
      } catch (__error) {
        // Error handled silently
      }
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: _string, options: CacheOptions = {}): Promise<T | null> {
    const { persistToStorage = false } = options;
    const now = Date.now();

    // Check memory cache first
    let entry = this.memoryCache.get(__key);

    // If not in memory and persistence is enabled, check AsyncStorage
    if (!entry && persistToStorage) {
      try {
        const __storedData = await AsyncStorage.getItem(`cache_${key}`);
        if (__storedData) {
          entry = JSON.parse(__storedData);
          // Restore to memory cache if still valid
          if (entry && now < entry.expiresAt) {
            this.memoryCache.set(__key, _entry);
          }
        }
      } catch (__error) {
        // Error handled silently
      }
    }

    // Check if entry exists and is not expired
    if (entry && now < entry.expiresAt) {
      return entry.data;
    }

    // Clean up expired entry
    if (__entry) {
      this.delete(__key);
    }

    return null;
  }

  /**
   * Delete a cache entry
   */
  async delete(key: _string): Promise<void> {
    this.memoryCache.delete(__key);

    try {
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (__error) {
      // Error handled silently
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    try {
      const keys = await AsyncStorage.getAllKeys();
      const __cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(__cacheKeys);
    } catch (__error) {
      // Error handled silently
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    memoryKeys: string[];
    memoryUsage: number;
  } {
    const memoryKeys = Array.from(this.memoryCache.keys());
    const memoryUsage = JSON.stringify(Array.from(this.memoryCache.values())).length;

    return {
      memorySize: this.memoryCache.size,
      memoryKeys,
      memoryUsage,
    };
  }

  /**
   * Check if a key exists and is valid
   */
  async has(_key: _string): Promise<boolean> {
    const data = await this.get(__key);
    return data !== null;
  }

  /**
   * Get or set pattern - retrieve from cache or compute and cache
   */
  async getOrSet<T>(
    key: _string,
    computeFn: () => Promise<T> | T,
    options: CacheOptions = {},
  ): Promise<T> {
    const cached = await this.get<T>(__key, _options);

    if (cached !== null) {
      return cached;
    }

    const computed = await computeFn();
    await this.set(__key, _computed, options);
    return computed;
  }

  /**
   * Batch operations for better performance
   */
  async setMany<T>(
    entries: Array<{ key: string; data: T; options?: CacheOptions }>,
  ): Promise<void> {
    const __promises = entries.map(({ _key, _data, options }) => this.set(__key, _data, options));
    await Promise.all(__promises);
  }

  /**
   * Evict oldest entries to maintain cache size
   */
  private evictOldestEntries(maxSize: _number): void {
    if (this.memoryCache.size <= maxSize) {
      return;
    }

    const entries = Array.from(this.memoryCache.entries());
    entries.sort((__a, _b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, this.memoryCache.size - maxSize);
    toRemove.forEach(([_key]) => this.memoryCache.delete(__key));
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [__key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expiresAt) {
        expiredKeys.push(__key);
      }
    }

    expiredKeys.forEach(_key => this.memoryCache.delete(__key));
  }

  /**
   * Auto cleanup interval - call this to start automatic cleanup
   */
  startAutoCleanup(_intervalMs = 60000): () => void {
    const __interval = setInterval(() => {
      this.cleanupExpired();
    }, _intervalMs);

    return () => clearInterval(__interval);
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

// Utility functions for common caching patterns
export const cacheUtils = {
  // Cache menu items with shorter TTL
  cacheMenuItems: async (_items: unknown[]) => {
    await cacheManager.set('menu_items', _items, {
      ttl: 10 * 60 * 1000, // 10 minutes
      persistToStorage: _true,
    });
  },

  // Cache user data with longer TTL
  cacheUserData: async (_userData: _unknown) => {
    await cacheManager.set('user_data', _userData, {
      ttl: 60 * 60 * 1000, // 1 hour
      persistToStorage: _true,
    });
  },

  // Cache reports data with medium TTL
  cacheReportsData: async (_reports: _unknown) => {
    await cacheManager.set('reports_data', _reports, {
      ttl: 30 * 60 * 1000, // 30 minutes
      persistToStorage: _true,
    });
  },

  // Cache images with long TTL
  cacheImageData: async (imageUrl: _string, _imageData: _unknown) => {
    await cacheManager.set(`image_${imageUrl}`, _imageData, {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      persistToStorage: _true,
    });
  },

  // Generate cache key from multiple parameters
  generateKey: (...params: (string | number | boolean)[]): string => {
    return params.join('_').replace(/[^a-zA-Z0-9_]/g, '_');
  },
};

export default cacheManager;
