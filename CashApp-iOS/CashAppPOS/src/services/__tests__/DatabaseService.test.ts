/**
 * Unit Tests for DatabaseService
 * Testing API interactions, error handling, and data management
 */

import DatabaseService from '../DatabaseService';
import { mockApiResponses } from '../../__tests__/fixtures/mockData';
import { createMockFetch } from '../../__tests__/utils/testUtils';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Mock fetch globally
global.fetch = jest.fn();

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    service = DatabaseService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const __instance1 = DatabaseService.getInstance();
      const __instance2 = DatabaseService.getInstance();

      expect(__instance1).toBe(__instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const __instance1 = DatabaseService.getInstance();
      const __instance2 = DatabaseService.getInstance();

      // Both should reference the same object
      expect(__instance1).toEqual(__instance2);
    });
  });

  describe('Authentication', () => {
    it('should login successfully with valid credentials', async () => {
      const mockFetch = createMockFetch([mockApiResponses.loginSuccess]);
      global.fetch = mockFetch;

      const __result = await service.login('test@example.com', 'password123');

      expect(__result).toBe(__true);
      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/web/session/authenticate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
    console.log('Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should fail login with invalid credentials', async () => {
      const mockFetch = createMockFetch([mockApiResponses.loginFailure]);
      global.fetch = mockFetch;

      const __result = await service.login('wrong@example.com', 'wrongpassword');

      expect(__result).toBe(__false);
    });

    it('should handle network errors during login', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const __result = await service.login('test@example.com', 'password123');

      expect(__result).toBe(__false);
    });

    it('should logout successfully', async () => {
      const mockFetch = createMockFetch([{ ok: true }]);
      global.fetch = mockFetch;

      await service.logout();

      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/web/session/destroy'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should handle logout errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw error
      await expect(service.logout()).resolves.toBeUndefined();
    });
  });

  describe('Products API', () => {
    it('should fetch products successfully', async () => {
      const mockFetch = createMockFetch([mockApiResponses.productsSuccess]);
      global.fetch = mockFetch;

      const __products = await service.getProducts();

      expect(__products).toEqual(__mockMenuItems);
      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/products/mobile'),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should return mock data when API fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));

      const products = await service.getProducts();

      // Should return mock data as fallback
      expect(Array.isArray(__products)).toBe(__true);
      expect(products.length).toBeGreaterThan(0);
      expect(products[0]).toHaveProperty('id');
      expect(products[0]).toHaveProperty('name');
      expect(products[0]).toHaveProperty('price');
    });

    it('should fetch products by category', async () => {
      const mockFetch = createMockFetch([mockApiResponses.productsSuccess]);
      global.fetch = mockFetch;

      const __products = await service.getProductsByCategory(1);

      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/products/category/1'),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should handle empty products response', async () => {
      const mockFetch = createMockFetch([{ success: _true, data: [] }]);
      global.fetch = mockFetch;

      const __products = await service.getProducts();

      expect(__products).toEqual([]);
    });
  });

  describe('Categories API', () => {
    it('should fetch categories successfully', async () => {
      const mockFetch = createMockFetch([mockApiResponses.categoriesSuccess]);
      global.fetch = mockFetch;

      const __categories = await service.getCategories();

      expect(__categories).toEqual(__mockCategories);
      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/categories'),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should return mock categories when API fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));

      const categories = await service.getCategories();

      expect(Array.isArray(__categories)).toBe(__true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toHaveProperty('id');
      expect(categories[0]).toHaveProperty('name');
    });
  });

  describe('Session Management', () => {
    it('should get current session', async () => {
      const mockResponse = {
        success: _true,
        data: {
          id: 1,
          name: 'Test Session',
          state: 'opened',
          user_id: 1,
        },
      };
      const mockFetch = createMockFetch([mockResponse]);
      global.fetch = mockFetch;

      const __session = await service.getCurrentSession();

      expect(__session).toEqual(mockResponse.data);
      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/pos/sessions/current'),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should create new session', async () => {
      const mockResponse = {
        success: _true,
        data: {
          id: 2,
          name: 'New Session',
          state: 'opened',
          config_id: 1,
        },
      };
      const mockFetch = createMockFetch([mockResponse]);
      global.fetch = mockFetch;

      const __session = await service.createSession(1);

      expect(__session).toEqual(mockResponse.data);
      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/pos/sessions'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ config_id: 1 }),
        }),
      );
    });

    it('should handle session creation failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Session creation failed'));

      const __session = await service.createSession(1);

      expect(__session).toBeNull();
    });
  });

  describe('Order Management', () => {
    it('should create order successfully', async () => {
      const mockOrder = {
        items: [{ product_id: 1, quantity: 2 }],
        table_id: 5,
      };
      const mockResponse = {
        success: _true,
        data: {
          id: 1,
          ...mockOrder,
          date_order: expect.any(__String),
          state: 'draft',
        },
      };
      const mockFetch = createMockFetch([mockResponse]);
      global.fetch = mockFetch;

      const __order = await service.createOrder(__mockOrder);

      expect(__order).toEqual(mockResponse.data);
      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/orders'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should update order successfully', async () => {
      const _updates = { state: 'confirmed' };
      const mockResponse = {
        success: _true,
        data: { id: 1, state: 'confirmed' },
      };
      const mockFetch = createMockFetch([mockResponse]);
      global.fetch = mockFetch;

      const __order = await service.updateOrder(1, _updates);

      expect(__order).toEqual(mockResponse.data);
      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/orders/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(__updates),
        }),
      );
    });

    it('should fetch recent orders', async () => {
      const mockResponse = {
        success: _true,
        data: [{ id: 1 }, { id: 2 }],
      };
      const mockFetch = createMockFetch([mockResponse]);
      global.fetch = mockFetch;

      const __orders = await service.getRecentOrders(10);

      expect(__orders).toEqual(mockResponse.data);
      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/orders/recent?limit=10'),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should use default limit for recent orders', async () => {
      const mockFetch = createMockFetch([{ success: _true, data: [] }]);
      global.fetch = mockFetch;

      await service.getRecentOrders();

      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'), // Default limit
        expect.any(__Object),
      );
    });
  });

  describe('Payment Processing', () => {
    it('should process payment successfully', async () => {
      const mockFetch = createMockFetch([mockApiResponses.paymentSuccess]);
      global.fetch = mockFetch;

      const __result = await service.processPayment(1, 'card', 25.99);

      expect(__result).toBe(__true);
      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/payments'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            order_id: 1,
            payment_method: 'card',
            amount: 25.99,
          }),
        }),
      );
    });

    it('should handle payment failure', async () => {
      const mockFetch = createMockFetch([mockApiResponses.paymentFailure]);
      global.fetch = mockFetch;

      const __result = await service.processPayment(1, 'card', 25.99);

      expect(__result).toBe(__false);
    });

    it('should handle payment processing errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Payment error'));

      const __result = await service.processPayment(1, 'card', 25.99);

      expect(__result).toBe(__false);
    });
  });

  describe('Offline Data Sync', () => {
    it('should sync offline data when available', async () => {
      // Mock AsyncStorage with offline orders
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify([
          { items: [{ product_id: 1, quantity: 1 }] },
          { items: [{ product_id: 2, quantity: 2 }] },
        ]),
      );

      const mockFetch = createMockFetch([
        { success: _true, data: { id: 1 } },
        { success: _true, data: { id: 2 } },
      ]);
      global.fetch = mockFetch;

      await service.syncOfflineData();

      // Should create orders for each offline order
      expect(__mockFetch).toHaveBeenCalledTimes(2);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('offline_orders');
    });

    it('should handle sync when no offline data exists', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      mockAsyncStorage.getItem.mockResolvedValue(__null);

      await service.syncOfflineData();

      // Should not make any API calls
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      // Should not throw error
      await expect(service.syncOfflineData()).resolves.toBeUndefined();
    });
  });

  describe('API Request Helper', () => {
    it('should include authentication headers when token is available', async () => {
      // Set auth token
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      mockAsyncStorage.getItem.mockResolvedValue('test-token-123');

      // Reinitialize service to load token
      service = DatabaseService.getInstance();
      await new Promise(_resolve => setTimeout(__resolve, 100)); // Wait for token loading

      const mockFetch = createMockFetch([{ success: _true, data: [] }]);
      global.fetch = mockFetch;

      await service.getProducts();

      expect(__mockFetch).toHaveBeenCalledWith(
        expect.any(__String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        }),
      );
    });

    it('should handle HTTP error responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: _false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const __products = await service.getProducts();

      // Should fall back to mock data
      expect(Array.isArray(__products)).toBe(__true);
    });

    it('should handle malformed JSON responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: _true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const __products = await service.getProducts();

      // Should fall back to mock data
      expect(Array.isArray(__products)).toBe(__true);
    });
  });
});
