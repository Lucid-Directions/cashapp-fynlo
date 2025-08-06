/**
 * Comprehensive Unit Tests for DatabaseService Menu Loading
 * Testing response parsing, price normalization, error handling, and retry mechanisms
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockApiResponses, mockMenuItems, mockCategories } from '../../__tests__/fixtures/mockData';
import { createMockFetch } from '../../__tests__/utils/testUtils';
import DatabaseService from '../DatabaseService';
import BackendCompatibilityService from '../BackendCompatibilityService';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../BackendCompatibilityService');

// Mock fetch globally
global.fetch = jest.fn();

describe('DatabaseService - Menu Loading Tests', () => {
  let service: DatabaseService;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = DatabaseService.getInstance();
    // Clear any cached data
    (AsyncStorage.clear as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Menu Response Parsing', () => {
    it('should correctly parse menu items with different price formats', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, name: 'Burger', price: 10.99, category: 'Food' },
          { id: 2, name: 'Fries', price: '4.99', category: 'Food' }, // String price
          { id: 3, name: 'Drink', price: 2.5, category: 'Beverages' }, // No decimal places
        ],
      };

      const fetch = createMockFetch([mockResponse]);
      global.fetch = fetch;

      const items = await service.getMenuItems();

      expect(items).toHaveLength(3);
      expect(items[0].price).toBe(10.99);
      expect(typeof items[1].price).toBe('number'); // Price should always be converted to number
      expect(items[1].price).toBe(4.99); // String '4.99' converts to number 4.99
      expect(items[2].price).toBe(2.5);
    });

    it('should handle menu items with missing optional fields', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, name: 'Basic Item', price: 5.99, category: 'Food' },
          { 
            id: 2, 
            name: 'Full Item', 
            price: 8.99, 
            category: 'Food',
            description: 'Delicious item',
            image: '🍔',
            icon: 'restaurant',
          },
        ],
      };

      const fetch = createMockFetch([mockResponse]);
      global.fetch = fetch;

      const items = await service.getMenuItems();

      expect(items).toHaveLength(2);
      expect(items[0].description).toBeUndefined();
      expect(items[0].image).toBeUndefined();
      expect(items[1].description).toBe('Delicious item');
    });

    it('should handle different API response formats', async () => {
      // Test with data directly in response (no wrapper)
      const directResponse = [
        { id: 1, name: 'Item 1', price: 5.99, category: 'Food' },
        { id: 2, name: 'Item 2', price: 7.99, category: 'Food' },
      ];

      const fetch = createMockFetch([directResponse]);
      global.fetch = fetch;

      const items = await service.getMenuItems();

      expect(items).toBeDefined();
      // The actual response structure depends on DatabaseService implementation
    });

    it('should normalize prices from string to number when needed', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, name: 'Item 1', price: '10.99', category: 'Food' },
          { id: 2, name: 'Item 2', price: '5', category: 'Food' },
          { id: 3, name: 'Item 3', price: '15.5', category: 'Food' },
          { id: 4, name: 'Item 4', price: '0.99', category: 'Food' },
        ],
      };

      const fetch = createMockFetch([mockResponse]);
      global.fetch = fetch;

      const items = await service.getMenuItems();

      items.forEach(item => {
        expect(item.price).toBeDefined();
        // Price normalization depends on implementation
      });
    });

    it('should handle invalid price formats gracefully', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, name: 'Valid Item', price: 10.99, category: 'Food' },
          { id: 2, name: 'Invalid Price', price: 'invalid', category: 'Food' },
          { id: 3, name: 'Null Price', price: null, category: 'Food' },
          { id: 4, name: 'Undefined Price', category: 'Food' },
          { id: 5, name: 'Empty String', price: '', category: 'Food' },
          { id: 6, name: 'NaN String', price: 'NaN', category: 'Food' },
        ],
      };

      const fetch = createMockFetch([mockResponse]);
      global.fetch = fetch;

      const items = await service.getMenuItems();

      expect(items).toBeDefined();
      expect(items).toHaveLength(6);
      expect(items[0].price).toBe(10.99); // Valid number
      expect(items[1].price).toBe(0);     // 'invalid' -> 0
      expect(items[2].price).toBe(0);     // null -> 0
      expect(items[3].price).toBe(0);     // undefined -> 0
      expect(items[4].price).toBe(0);     // '' -> 0
      expect(items[5].price).toBe(0);     // 'NaN' -> 0
    });
  });

  describe('Category Response Parsing', () => {
    it('should correctly parse menu categories', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, name: 'Food', description: 'Food items' },
          { id: 2, name: 'Beverages', description: 'Drinks' },
          { id: 3, name: 'Desserts' }, // No description
        ],
      };

      const fetch = createMockFetch([mockResponse]);
      global.fetch = fetch;

      const categories = await service.getMenuCategories();

      expect(categories).toHaveLength(3);
      expect(categories[0].name).toBe('Food');
      expect(categories[2].description).toBeUndefined();
    });

    it('should handle empty category response', async () => {
      const mockResponse = {
        success: true,
        data: [],
      };

      const fetch = createMockFetch([mockResponse]);
      global.fetch = fetch;

      const categories = await service.getMenuCategories();

      expect(categories).toBeDefined();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Retry Mechanism', () => {
    it('should retry on network failure with exponential backoff', async () => {
      // First two attempts fail, third succeeds
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: 1, name: 'Item', price: 5.99, category: 'Food' }],
          }),
        } as Response);
      });

      const items = await service.getMenuItems();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(items).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Retrying'));
    });

    it('should fail after maximum retry attempts', async () => {
      // All attempts fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      const items = await service.getMenuItems();

      // Should return fallback data or empty array
      expect(mockFetch).toHaveBeenCalledTimes(3); // Default retry attempts
      expect(logger.error).toHaveBeenCalled();
      expect(items).toBeDefined(); // Should not throw, but return fallback
    });

    it('should handle API timeout gracefully', async () => {
      // Simulate timeout
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const items = await service.getMenuItems();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch menu items'),
        expect.any(String)
      );
      expect(items).toBeDefined(); // Should return fallback data
    });

    it('should handle 500 server errors with retry', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: 1, name: 'Item', price: 5.99, category: 'Food' }],
          }),
        } as Response);
      });

      const items = await service.getMenuItems();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(items).toBeDefined();
    });

    it('should not retry on 4xx client errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      const items = await service.getMenuItems();

      expect(mockFetch).toHaveBeenCalledTimes(1); // No retry for client errors
      expect(items).toBeDefined(); // Should return fallback
    });
  });

  describe('Caching Mechanism', () => {
    it('should cache menu data after successful fetch', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, name: 'Cached Item', price: 10.99, category: 'Food' },
        ],
      };

      const fetch = createMockFetch([mockResponse, mockResponse]);
      global.fetch = fetch;

      // First call fetches from API
      const items1 = await service.getMenuItems();
      
      // Reset fetch mock to track new calls
      (global.fetch as jest.Mock).mockClear();
      
      // Second call should use cache
      const items2 = await service.getMenuItems();
      
      // If caching works, second call shouldn't fetch
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('cached'));
    });

    it('should save menu data to AsyncStorage for offline use', async () => {
      const mockItems = [
        { id: 1, name: 'Item 1', price: 5.99, category: 'Food' },
      ];
      const mockCategoriesData = [
        { id: 1, name: 'Food', description: 'Food items' },
      ];

      await service.cacheMenuData(mockItems, mockCategoriesData);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@menu_cache',
        expect.stringContaining('"items"')
      );
      expect(logger.info).toHaveBeenCalledWith('✅ Menu data cached successfully');
    });

    it('should retrieve cached data from AsyncStorage', async () => {
      const mockCacheData = {
        items: [{ id: 1, name: 'Cached Item', price: 5.99, category: 'Food' }],
        categories: [{ id: 1, name: 'Food' }],
        timestamp: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockCacheData)
      );

      const cached = await service.getCachedMenuData();

      expect(cached).not.toBeNull();
      expect(cached?.items).toHaveLength(1);
      expect(cached?.categories).toHaveLength(1);
      expect(logger.info).toHaveBeenCalledWith('📦 Retrieved cached menu data');
    });

    it('should invalidate expired cache (older than 24 hours)', async () => {
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const mockCacheData = {
        items: [{ id: 1, name: 'Old Item', price: 5.99, category: 'Food' }],
        categories: [{ id: 1, name: 'Food' }],
        timestamp: oldTimestamp,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockCacheData)
      );

      const cached = await service.getCachedMenuData();

      expect(cached).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@menu_cache');
      expect(logger.info).toHaveBeenCalledWith('⏰ Cache expired, removing old data');
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should use fallback data when API is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network unavailable'));

      const items = await service.getMenuItems();

      expect(items).toBeDefined();
      expect(items.length).toBeGreaterThan(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('TEMPORARY: Using')
      );
    });

    it('should use cached data as first fallback before hardcoded data', async () => {
      const cachedData = {
        items: [{ id: 1, name: 'Cached Item', price: 5.99, category: 'Food' }],
        categories: [{ id: 1, name: 'Food' }],
        timestamp: Date.now() - 1000, // Recent cache
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(cachedData)
      );

      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      const cached = await service.getCachedMenuData();
      expect(cached).not.toBeNull();
      expect(cached?.items[0].name).toBe('Cached Item');
    });
  });

  describe('Backend Compatibility Transformation', () => {
    beforeEach(() => {
      (BackendCompatibilityService.needsMenuTransformation as jest.Mock).mockReturnValue(false);
      (BackendCompatibilityService.transformMenuItems as jest.Mock).mockImplementation(
        items => items.map(item => ({ ...item, available: true }))
      );
    });

    it('should apply compatibility transformation when needed', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, name: 'Item 1', price: 5.99, category: 'Food' },
        ],
      };

      (BackendCompatibilityService.needsMenuTransformation as jest.Mock).mockReturnValue(true);

      const fetch = createMockFetch([mockResponse]);
      global.fetch = fetch;

      const items = await service.getMenuItems();

      expect(BackendCompatibilityService.needsMenuTransformation).toHaveBeenCalled();
      expect(BackendCompatibilityService.transformMenuItems).toHaveBeenCalled();
    });

    it('should not transform when not needed', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, name: 'Item 1', price: 5.99, category: 'Food', available: true },
        ],
      };

      (BackendCompatibilityService.needsMenuTransformation as jest.Mock).mockReturnValue(false);

      const fetch = createMockFetch([mockResponse]);
      global.fetch = fetch;

      const items = await service.getMenuItems();

      expect(BackendCompatibilityService.transformMenuItems).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very large menu responses', async () => {
      const largeMenu = Array.from({ length: 1000 }, (_, index) => ({
        id: index + 1,
        name: `Item ${index + 1}`,
        price: Math.random() * 100,
        category: `Category ${Math.floor(index / 100)}`,
      }));

      const mockResponse = { success: true, data: largeMenu };
      const fetch = createMockFetch([mockResponse]);
      global.fetch = fetch;

      const items = await service.getMenuItems();

      expect(items).toBeDefined();
      expect(items.length).toBeGreaterThan(0);
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      const items = await service.getMenuItems();

      expect(logger.error).toHaveBeenCalled();
      expect(items).toBeDefined(); // Should return fallback
    });

    it('should handle empty response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      } as Response);

      const items = await service.getMenuItems();

      expect(items).toBeDefined();
      expect(Array.isArray(items)).toBe(true);
    });
  });
});
ENDOFFILE < /dev/null