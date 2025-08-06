/**
 * Unit Tests for DatabaseService
 * Testing API interactions, error handling, and data management
 */

import DatabaseService from '../DatabaseService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Simple mock fetch helper
function createMockFetch(responses: any[]) {
  let callIndex = 0;
  return jest.fn().mockImplementation(() => {
    if (callIndex < responses.length) {
      const response = responses[callIndex++];
      return Promise.resolve({
        ok: response.ok !== false,
        status: response.status || 200,
        json: () => Promise.resolve(response),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
  });
}

// Mock data
const mockApiResponses = {
  loginSuccess: { ok: true, success: true, data: { token: 'test-token', user: { id: 1 } } },
  loginFailure: { ok: false, success: false, error: 'Invalid credentials' },
  productsSuccess: { ok: true, success: true, data: [{ id: 1, name: 'Test Product', price: 10.00 }] },
  categoriesSuccess: { ok: true, success: true, data: [{ id: 1, name: 'Test Category' }] },
  paymentSuccess: { ok: true, success: true, data: { payment_id: 'pay_123' } },
  paymentFailure: { ok: false, success: false, error: 'Payment failed' },
};

const mockMenuItems = [
  { id: 1, name: 'Test Product', price: 10.00, categoryId: 1 }
];

const mockCategories = [
  { id: 1, name: 'Test Category' }
];

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
    it('should return the same instance', async () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Authentication', () => {
    it('should login successfully with valid credentials', async () => {
      const mockFetch = createMockFetch([mockApiResponses.loginSuccess]);
      global.fetch = mockFetch;

      const result = await service.login('test@example.com', 'password123');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/web/session/authenticate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should fail login with invalid credentials', async () => {
      const mockFetch = createMockFetch([mockApiResponses.loginFailure]);
      global.fetch = mockFetch;

      const result = await service.login('wrong@example.com', 'wrongpassword');

      expect(result).toBe(false);
    });

    it('should handle network errors during login', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.login('test@example.com', 'password123');

      expect(result).toBe(false);
    });
  });

  describe('Products API', () => {
    it('should fetch products successfully', async () => {
      const mockFetch = createMockFetch([mockApiResponses.productsSuccess]);
      global.fetch = mockFetch;

      const products = await service.getProducts();

      expect(products).toEqual(mockMenuItems);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/products/mobile'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return mock data when API fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));

      const products = await service.getProducts();

      // Should return mock data as fallback
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      expect(products[0]).toHaveProperty('id');
      expect(products[0]).toHaveProperty('name');
      expect(products[0]).toHaveProperty('price');
    });
  });

  describe('Payment Processing', () => {
    it('should process payment successfully', async () => {
      const mockFetch = createMockFetch([mockApiResponses.paymentSuccess]);
      global.fetch = mockFetch;

      const result = await service.processPayment(1, 'card', 25.99);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/payments'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            order_id: 1,
            payment_method: 'card',
            amount: 25.99,
          }),
        })
      );
    });

    it('should handle payment failure', async () => {
      const mockFetch = createMockFetch([mockApiResponses.paymentFailure]);
      global.fetch = mockFetch;

      const result = await service.processPayment(1, 'card', 25.99);

      expect(result).toBe(false);
    });
  });
});
