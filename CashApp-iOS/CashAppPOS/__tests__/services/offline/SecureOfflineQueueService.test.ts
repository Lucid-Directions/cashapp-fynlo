/**
 * SecureOfflineQueueService Test Suite
 * 
 * Tests for new security features:
 * - Rate limiting per restaurant
 * - Mandatory field validation  
 * - Restaurant access caching
 * - Audit logging for security violations
 */

// Mock all external dependencies before imports
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default),
  },
}));

jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '1'),
  getUniqueId: jest.fn(() => 'test-device-id'),
  isEmulator: jest.fn(() => true),
}));

jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('crypto-js');
jest.mock('react-native-keychain');

jest.mock('../../../src/services/auth/unifiedAuthService', () => ({
  authService: {
    getCurrentUser: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  }
}));

jest.mock('../../../src/services/auth/AuthMonitor', () => ({
  AuthMonitor: {
    getInstance: jest.fn(() => ({
      logEvent: jest.fn(),
      setupEventListeners: jest.fn(),
      onTokenChange: jest.fn(),
    })),
  },
}));

jest.mock('../../../src/store/useAuthStore');
jest.mock('../../../src/utils/NetworkUtils');
jest.mock('../../../src/utils/tokenManager', () => ({
  default: {
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    getRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token'),
  },
}));

// Now import after all mocks
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import CryptoJS from 'crypto-js';
import * as Keychain from 'react-native-keychain';
import {
  SecureOfflineQueueService,
  EntityType,
  ActionType,
} from '../../../src/services/offline/SecureOfflineQueueService';
import { useAuthStore } from '../../../src/store/useAuthStore';
import FynloException from '../../../src/utils/exceptions/FynloException';
import NetworkUtils from '../../../src/utils/NetworkUtils';

jest.useFakeTimers();

describe('SecureOfflineQueueService - Security Features', () => {
  let service: SecureOfflineQueueService;
  
  const validUser = {
    id: 'user-123',
    email: 'test@example.com',
    restaurant_id: 'restaurant-456',
    is_platform_owner: false,
    accessible_restaurants: ['restaurant-456', 'restaurant-789'],
    role: 'manager',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    const mockStorage = new Map();
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => 
      Promise.resolve(mockStorage.get(key) || null)
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key, value) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    });

    (NetInfo.addEventListener as jest.Mock).mockImplementation(() => () => {});
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
      password: 'mock-key',
    });

    const mockWordArray = {
      toString: jest.fn().mockReturnValue('mock-hex'),
      words: [1, 2, 3, 4],
    };
    
    (CryptoJS.lib.WordArray.random as jest.Mock) = jest.fn().mockReturnValue(mockWordArray);
    (CryptoJS.AES.encrypt as jest.Mock) = jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('encrypted'),
    });
    (CryptoJS.SHA256 as jest.Mock) = jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('hash'),
    });

    (useAuthStore.getState as jest.Mock).mockReturnValue({
      user: validUser,
    });

    (NetworkUtils.createAuthHeaders as jest.Mock).mockResolvedValue({
      'Authorization': 'Bearer token',
    });

    service = SecureOfflineQueueService.getInstance();
  });

  afterEach(() => {
    if (service) {
      service.destroy();
    }
  });

  test('should enforce rate limits per restaurant', async () => {
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          `/api/orders/${i}`,
          { index: i },
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        ).catch(err => err)
      );
    }

    const results = await Promise.all(promises);
    const errors = results.filter(r => r instanceof FynloException);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].code).toBe('RATE_LIMIT_EXCEEDED');
  });

  test('should validate mandatory fields', async () => {
    await expect(
      service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/orders',
        {},
        {
          restaurantId: 123 as any,
          userId: 'user-123',
        }
      )
    ).rejects.toThrow(FynloException);
  });

  test('should cache restaurant access', async () => {
    await service.queueRequest(
      EntityType.ORDER,
      ActionType.CREATE,
      'POST',
      '/api/orders/1',
      {},
      {
        restaurantId: 'restaurant-456',
        userId: 'user-123',
      }
    );

    (useAuthStore.getState as jest.Mock).mockReturnValue({ user: null });

    const requestId = await service.queueRequest(
      EntityType.ORDER,
      ActionType.CREATE,
      'POST',
      '/api/orders/2',
      {},
      {
        restaurantId: 'restaurant-456',
        userId: 'user-123',
      }
    );

    expect(requestId).toBeDefined();
  });

  test('should log security violations', async () => {
    try {
      await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/orders',
        {
          name: "'; DROP TABLE users--",
        },
        {
          restaurantId: 'restaurant-456',
          userId: 'user-123',
        }
      );
    } catch (error) {
      // Expected
    }

    const auditLog = await AsyncStorage.getItem('offline_queue_audit');
    const entries = JSON.parse(auditLog || '[]');
    
    const securityEntry = entries.find((e: any) => 
      e.event === 'SECURITY_VIOLATION' || e.event === 'SQL_INJECTION_ATTEMPT'
    );
    
    expect(securityEntry).toBeDefined();
    expect(securityEntry.severity).toBe('CRITICAL');
  });
});
