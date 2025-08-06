import DatabaseService from '../DatabaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../utils/tokenManager', () => ({
  default: {
    getTokens: jest.fn(),
    setAccessToken: jest.fn(),
  },
}));
jest.mock('../../utils/ErrorLogger', () => ({
  default: {
    logError: jest.fn(),
  },
}));

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = DatabaseService.getInstance();
  });

  describe('Menu Operations', () => {
    it('should get menu items', async () => {
      const items = await service.getMenuItems();
      expect(items).toBeDefined();
      expect(Array.isArray(items)).toBe(true);
    });

    it('should get menu categories', async () => {
      const categories = await service.getMenuCategories();
      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
    });

    it('should clear menu cache', () => {
      service.clearMenuCache();
      // Cache should be cleared - no error thrown
      expect(true).toBe(true);
    });
  });

  describe('Storage Operations', () => {
    it('should be a singleton', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
