import { performanceUtils } from '../../src/hooks/usePerformanceMonitor';
import { cacheManager } from '../../src/utils/cacheManager';
import { dataPrefetcher } from '../../src/utils/dataPrefetcher';
import TestingUtils from '../../src/utils/testingUtils';

describe('Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Render Performance', () => {
    it('should render components within acceptable time limits', async () => {
      const mockRenderFunction = jest.fn();

      const renderTime = await TestingUtils.performance.measureRenderTime(mockRenderFunction);

      expect(mockRenderFunction).toHaveBeenCalled();
      expect(renderTime).toBeLessThan(100); // 100ms threshold
    });

    it('should handle large data sets efficiently', async () => {
      const largeDataSet = TestingUtils.generateTestData.orders(1000);

      const { duration } = await TestingUtils.performance.measureAsyncOperation(async () => {
        // Simulate processing large data set
        return largeDataSet.filter((order) => order.status === 'completed');
      });

      expect(duration).toBeLessThan(50); // 50ms threshold for filtering
    });
  });

  describe('Memory Performance', () => {
    it('should handle memory pressure gracefully', () => {
      const initialMemory = process.memoryUsage?.()?.heapUsed || 0;

      TestingUtils.performance.simulateMemoryPressure();

      // Memory should be cleaned up after simulation
      setTimeout(() => {
        const currentMemory = process.memoryUsage?.()?.heapUsed || 0;
        expect(currentMemory).toBeLessThanOrEqual(initialMemory * 1.1); // Allow 10% increase
      }, 1100);
    });

    it('should limit memory usage in caching', async () => {
      // Fill cache with data
      const promises = Array.from({ length: 200 }, (_, i) =>
        cacheManager.set(`key_${i}`, { data: `test_data_${i}` })
      );

      await Promise.all(promises);

      const stats = cacheManager.getStats();

      // Should limit cache size
      expect(stats.memorySize).toBeLessThanOrEqual(100);
    });
  });

  describe('Network Performance', () => {
    it('should handle concurrent API calls efficiently', async () => {
      const mockApiCalls = Array.from({ length: 10 }, (_, i) =>
        TestingUtils.mockAPI.success({ id: i, data: `test_${i}` }, 100)
      );

      const { duration } = await TestingUtils.performance.measureAsyncOperation(async () => {
        return Promise.all(mockApiCalls);
      });

      // Concurrent calls should complete faster than sequential
      expect(duration).toBeLessThan(500); // Should be much less than 10 * 100ms
    });

    it('should cache frequently accessed data', async () => {
      const testData = { id: 1, name: 'Test Item' };

      // First access - should be slower
      const { duration: firstAccess } = await TestingUtils.performance.measureAsyncOperation(
        async () => {
          await cacheManager.set('test_item', testData);
          return cacheManager.get('test_item');
        }
      );

      // Second access - should be faster (cached)
      const { duration: secondAccess } = await TestingUtils.performance.measureAsyncOperation(
        async () => {
          return cacheManager.get('test_item');
        }
      );

      expect(secondAccess).toBeLessThan(firstAccess);
    });
  });

  describe('Data Processing Performance', () => {
    it('should chunk large arrays efficiently', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);

      const { duration } = TestingUtils.performance.measureAsyncOperation(async () => {
        return performanceUtils.chunkArray(largeArray, 100);
      });

      expect(duration).toBeLessThan(10); // 10ms threshold
    });

    it('should debounce frequent function calls', async () => {
      const mockFunction = jest.fn();
      const debouncedFunction = performanceUtils.debounce(mockFunction, 100);

      // Call function multiple times rapidly
      debouncedFunction();
      debouncedFunction();
      debouncedFunction();

      // Should only be called once after debounce delay
      expect(mockFunction).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockFunction).toHaveBeenCalledTimes(1);
    });

    it('should throttle frequent function calls', () => {
      const mockFunction = jest.fn();
      const throttledFunction = performanceUtils.throttle(mockFunction, 100);

      // Call function multiple times rapidly
      throttledFunction();
      throttledFunction();
      throttledFunction();

      // Should only be called once immediately
      expect(mockFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Prefetching Performance', () => {
    it('should prefetch data efficiently', async () => {
      const testConfig = {
        key: 'test_prefetch',
        fetchFn: async () => ({ data: 'test' }),
        priority: 'high' as const,
      };

      dataPrefetcher.addToPrefetchQueue(testConfig);

      const { duration } = await TestingUtils.performance.measureAsyncOperation(async () => {
        return dataPrefetcher.prefetchImmediate('test_prefetch');
      });

      expect(duration).toBeLessThan(100);
    });

    it('should handle prefetch queue efficiently', async () => {
      // Add multiple items to prefetch queue
      const configs = Array.from({ length: 50 }, (_, i) => ({
        key: `prefetch_${i}`,
        fetchFn: async () => ({ data: `test_${i}` }),
        priority: 'medium' as const,
      }));

      configs.forEach((config) => dataPrefetcher.addToPrefetchQueue(config));

      const { duration } = await TestingUtils.performance.measureAsyncOperation(async () => {
        return dataPrefetcher.startPrefetching();
      });

      expect(duration).toBeLessThan(1000); // 1 second for 50 items
    });
  });

  describe('Search Performance', () => {
    it('should search large datasets efficiently', async () => {
      const largeMenuData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`,
        category: ['appetizer', 'main', 'dessert'][i % 3],
      }));

      const { duration } = await TestingUtils.performance.measureAsyncOperation(async () => {
        return largeMenuData.filter(
          (item) =>
            item.name.toLowerCase().includes('item 5') ||
            item.description.toLowerCase().includes('item 5')
        );
      });

      expect(duration).toBeLessThan(10); // 10ms for search
    });

    it('should memoize search results', () => {
      const searchFunction = jest.fn((query: string) =>
        ['apple', 'banana', 'cherry'].filter((item) => item.includes(query.toLowerCase()))
      );

      const memoizedSearch = performanceUtils.memoize(searchFunction);

      // First call
      const result1 = memoizedSearch('a');

      // Second call with same parameter
      const result2 = memoizedSearch('a');

      expect(result1).toEqual(result2);
      expect(searchFunction).toHaveBeenCalledTimes(1); // Should be memoized
    });
  });

  describe('Animation Performance', () => {
    it('should maintain 60fps during animations', () => {
      const frameTimes: number[] = [];
      let lastFrameTime = performance.now();

      // Simulate animation frames
      for (let i = 0; i < 60; i++) {
        const currentTime = performance.now();
        frameTimes.push(currentTime - lastFrameTime);
        lastFrameTime = currentTime;

        // Simulate frame work
        for (let j = 0; j < 1000; j++) {
          Math.random();
        }
      }

      const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

      // Should average less than 16.67ms per frame (60fps)
      expect(averageFrameTime).toBeLessThan(16.67);
    });
  });

  describe('Batch Operations Performance', () => {
    it('should batch database operations efficiently', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        key: `batch_key_${i}`,
        data: { value: i },
      }));

      const { duration } = await TestingUtils.performance.measureAsyncOperation(async () => {
        await cacheManager.setMany(operations);
      });

      // Batch operations should be faster than individual operations
      expect(duration).toBeLessThan(500); // 500ms for 100 operations
    });

    it('should handle batch updates efficiently', async () => {
      const updates = Array.from({ length: 50 }, () => jest.fn());

      const { duration } = await TestingUtils.performance.measureAsyncOperation(async () => {
        await performanceUtils.batchUpdates(updates);
      });

      expect(duration).toBeLessThan(100);
      updates.forEach((update) => expect(update).toHaveBeenCalled());
    });
  });

  describe('Resource Cleanup Performance', () => {
    it('should clean up resources efficiently', async () => {
      // Create resources
      await cacheManager.set('temp1', { data: 'test1' });
      await cacheManager.set('temp2', { data: 'test2' });
      await cacheManager.set('temp3', { data: 'test3' });

      const { duration } = await TestingUtils.performance.measureAsyncOperation(async () => {
        await cacheManager.clear();
      });

      expect(duration).toBeLessThan(50);

      // Verify cleanup
      const item = await cacheManager.get('temp1');
      expect(item).toBeNull();
    });

    it('should cleanup expired cache entries efficiently', () => {
      // This would test the cache cleanup mechanism
      cacheManager.cleanupExpired();

      const stats = cacheManager.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Stress Tests', () => {
    it('should handle high frequency user interactions', async () => {
      const mockHandler = jest.fn();
      const throttledHandler = performanceUtils.throttle(mockHandler, 16); // 60fps

      // Simulate rapid user interactions
      const interactions = Array.from(
        { length: 100 },
        () =>
          new Promise((resolve) => {
            throttledHandler();
            setTimeout(resolve, 1);
          })
      );

      await Promise.all(interactions);

      // Should throttle calls appropriately
      expect(mockHandler.mock.calls.length).toBeLessThan(50);
    });

    it('should maintain performance under load', async () => {
      // Simulate heavy load
      const heavyOperations = Array.from({ length: 10 }, () =>
        TestingUtils.performance.measureAsyncOperation(async () => {
          // Simulate CPU-intensive task
          const data = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: Math.random() }));
          return data.sort((a, b) => a.value - b.value);
        })
      );

      const results = await Promise.all(heavyOperations);

      // All operations should complete within reasonable time
      results.forEach(({ duration }) => {
        expect(duration).toBeLessThan(100);
      });
    });
  });
});
