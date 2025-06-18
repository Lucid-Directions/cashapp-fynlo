// DataService.test.ts - Comprehensive tests for dual data system
import AsyncStorage from '@react-native-async-storage/async-storage';
import DataService from '../DataService';
import DatabaseService from '../DatabaseService';
import MockDataService from '../MockDataService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock fetch for backend availability checks
global.fetch = jest.fn();

// Mock the service dependencies
jest.mock('../DatabaseService');
jest.mock('../MockDataService');

describe('DataService', () => {
  let dataService: DataService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockMockDataService: jest.Mocked<MockDataService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mocked instances
    mockDatabaseService = {
      getProducts: jest.fn(),
      getCategories: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      createOrder: jest.fn(),
      processPayment: jest.fn(),
    } as any;

    mockMockDataService = {
      getProducts: jest.fn(),
      getCategories: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      createOrder: jest.fn(),
      processPayment: jest.fn(),
    } as any;

    // Mock the getInstance methods
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDatabaseService);
    (MockDataService.getInstance as jest.Mock).mockReturnValue(mockMockDataService);

    dataService = DataService.getInstance();
  });

  describe('Feature Flags', () => {
    it('should load default feature flags', () => {
      const flags = dataService.getFeatureFlags();
      
      expect(flags).toEqual({
        USE_REAL_API: false,
        ENABLE_PAYMENTS: false,
        ENABLE_HARDWARE: false,
        SHOW_DEV_MENU: expect.any(Boolean),
        MOCK_AUTHENTICATION: true,
      });
    });

    it('should update feature flags', async () => {
      await dataService.updateFeatureFlag('USE_REAL_API', true);
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'feature_flags',
        expect.stringContaining('"USE_REAL_API":true')
      );
    });
  });

  describe('Backend Availability', () => {
    it('should detect when backend is available', async () => {
      // Mock successful fetch
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await dataService.updateFeatureFlag('USE_REAL_API', true);
      
      // Wait for backend check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = dataService.getConnectionStatus();
      expect(status.backend).toBe(true);
    });

    it('should handle backend unavailable', async () => {
      // Mock failed fetch
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      await dataService.updateFeatureFlag('USE_REAL_API', true);
      
      // Wait for backend check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = dataService.getConnectionStatus();
      expect(status.backend).toBe(false);
    });
  });

  describe('Product Operations', () => {
    it('should use mock data when USE_REAL_API is false', async () => {
      const mockProducts = [
        { id: 1, name: 'Test Product', price: 10.99, category: 'Test' }
      ];
      
      mockMockDataService.getProducts.mockResolvedValue(mockProducts);
      
      const products = await dataService.getProducts();
      
      expect(mockMockDataService.getProducts).toHaveBeenCalled();
      expect(mockDatabaseService.getProducts).not.toHaveBeenCalled();
      expect(products).toEqual(mockProducts);
    });

    it('should use real API when USE_REAL_API is true and backend available', async () => {
      const realProducts = [
        { id: 1, name: 'Real Product', price: 15.99, category: 'Real' }
      ];
      
      // Enable real API
      await dataService.updateFeatureFlag('USE_REAL_API', true);
      
      // Mock backend available
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      
      mockDatabaseService.getProducts.mockResolvedValue(realProducts);
      
      const products = await dataService.getProducts();
      
      expect(mockDatabaseService.getProducts).toHaveBeenCalled();
      expect(products).toEqual(realProducts);
    });

    it('should fallback to mock data when real API fails', async () => {
      const mockProducts = [
        { id: 1, name: 'Fallback Product', price: 12.99, category: 'Mock' }
      ];
      
      // Enable real API
      await dataService.updateFeatureFlag('USE_REAL_API', true);
      
      // Mock backend available but API call fails
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      mockDatabaseService.getProducts.mockRejectedValue(new Error('API Error'));
      mockMockDataService.getProducts.mockResolvedValue(mockProducts);
      
      const products = await dataService.getProducts();
      
      expect(mockDatabaseService.getProducts).toHaveBeenCalled();
      expect(mockMockDataService.getProducts).toHaveBeenCalled();
      expect(products).toEqual(mockProducts);
    });
  });

  describe('Authentication', () => {
    it('should use mock authentication when MOCK_AUTHENTICATION is true', async () => {
      mockMockDataService.login.mockResolvedValue(true);
      
      const result = await dataService.login('demo', 'demo');
      
      expect(mockMockDataService.login).toHaveBeenCalledWith('demo', 'demo');
      expect(result).toBe(true);
    });

    it('should use real authentication when MOCK_AUTHENTICATION is false', async () => {
      await dataService.updateFeatureFlag('MOCK_AUTHENTICATION', false);
      await dataService.updateFeatureFlag('USE_REAL_API', true);
      
      // Mock backend available
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      
      mockDatabaseService.login.mockResolvedValue(true);
      
      const result = await dataService.login('real@user.com', 'password');
      
      expect(mockDatabaseService.login).toHaveBeenCalledWith('real@user.com', 'password');
      expect(result).toBe(true);
    });
  });

  describe('Payment Processing', () => {
    it('should always succeed when ENABLE_PAYMENTS is false', async () => {
      const result = await dataService.processPayment(123, 'card', 25.99);
      
      expect(result).toBe(true);
      expect(mockDatabaseService.processPayment).not.toHaveBeenCalled();
    });

    it('should use real payment processing when ENABLE_PAYMENTS is true', async () => {
      await dataService.updateFeatureFlag('ENABLE_PAYMENTS', true);
      await dataService.updateFeatureFlag('USE_REAL_API', true);
      
      // Mock backend available
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      
      mockDatabaseService.processPayment.mockResolvedValue(true);
      
      const result = await dataService.processPayment(123, 'card', 25.99);
      
      expect(mockDatabaseService.processPayment).toHaveBeenCalledWith(123, 'card', 25.99);
      expect(result).toBe(true);
    });
  });

  describe('Quick Actions', () => {
    it('should reset to mock data correctly', async () => {
      await dataService.resetToMockData();
      
      const flags = dataService.getFeatureFlags();
      
      expect(flags.USE_REAL_API).toBe(false);
      expect(flags.ENABLE_PAYMENTS).toBe(false);
      expect(flags.ENABLE_HARDWARE).toBe(false);
    });

    it('should enable real API correctly', async () => {
      await dataService.enableRealAPI();
      
      const flags = dataService.getFeatureFlags();
      
      expect(flags.USE_REAL_API).toBe(true);
    });
  });

  describe('Connection Status', () => {
    it('should return correct status information', () => {
      const status = dataService.getConnectionStatus();
      
      expect(status).toHaveProperty('mode');
      expect(status).toHaveProperty('backend');
      expect(status).toHaveProperty('flags');
      expect(typeof status.mode).toBe('string');
      expect(typeof status.backend).toBe('boolean');
      expect(typeof status.flags).toBe('object');
    });
  });
});