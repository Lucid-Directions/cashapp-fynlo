/**
 * Data Prefetcher Service
 * Optimizes app performance by preloading commonly used data
 */

export class DataPrefetcher {
  private cache: Map<string, any> = new Map();
  private pendingFetches: Map<string, Promise<any>> = new Map();

  /**
   * Prefetch data and cache it
   */
  async prefetch(key: string, fetcher: () => Promise<any>): Promise<void> {
    // Check if already cached
    if (this.cache.has(key)) {
      return;
    }

    // Check if fetch is already in progress
    if (this.pendingFetches.has(key)) {
      await this.pendingFetches.get(key);
      return;
    }

    // Start new fetch
    const fetchPromise = fetcher()
      .then((data) => {
        this.cache.set(key, data);
        this.pendingFetches.delete(key);
        return data;
      })
      .catch((error) => {
        this.pendingFetches.delete(key);
        throw error;
      });

    this.pendingFetches.set(key, fetchPromise);
    await fetchPromise;
  }

  /**
   * Get cached data
   */
  get(key: string): any {
    return this.cache.get(key);
  }

  /**
   * Check if data is cached
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
    this.pendingFetches.delete(key);
  }

  /**
   * Clear all cached data
   */
  clearAll(): void {
    this.cache.clear();
    this.pendingFetches.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const dataPrefetcher = new DataPrefetcher();

export default dataPrefetcher;
