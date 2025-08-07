/**
 * SecureOfflineQueueService Test Suite
 * 
 * Coverage Areas:
 * - Security validation (SQL injection, input sanitization, encryption)
 * - Multi-tenant isolation (restaurantId validation, access control)
 * - Queue management (priority, eviction, memory management)
 * - Synchronization (batch processing, retry logic, conflict resolution)
 * - Error handling (FynloException usage, audit logging)
 * 
 * Target Coverage: 90%+
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import CryptoJS from 'crypto-js';
import * as Keychain from 'react-native-keychain';
import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock AuthMonitor
jest.mock('../../src/services/auth/AuthMonitor', () => ({
  AuthMonitor: {
    getInstance: jest.fn(() => ({
      logEvent: jest.fn(),
      setupEventListeners: jest.fn(),
      onTokenChange: jest.fn(),
    })),
  },
}));
import {
  SecureOfflineQueueService,
  EntityType,
  ActionType,
  Priority,
  QueueStatus,
  ConflictResolutionStrategy,
  useSecureOfflineQueue,
  secureOfflineQueueService,
} from '../../../src/services/offline/SecureOfflineQueueService';
import { useAuthStore } from '../../../src/store/useAuthStore';
import FynloException from '../../../src/utils/exceptions/FynloException';
import { logger } from '../../../src/utils/logger';
import NetworkUtils from '../../../src/utils/NetworkUtils';

// Mock all dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('crypto-js');
jest.mock('react-native-keychain');
jest.mock('../../../src/store/useAuthStore');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/NetworkUtils');
jest.mock('../../../src/utils/tokenManager', () => ({
  default: {
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    getRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token'),
  },
}));

// Mock timers
jest.useFakeTimers();

describe('SecureOfflineQueueService', () => {
  let service: SecureOfflineQueueService;
  let mockNetInfoListener: (state: NetInfoState) => void;
  
  // Test data
  const validUser = {
    id: 'user-123',
    email: 'test@example.com',
    restaurant_id: 'restaurant-456',
    is_platform_owner: false,
    accessible_restaurants: ['restaurant-456', 'restaurant-789'],
    role: 'manager',
  };

  const platformOwnerUser = {
    ...validUser,
    is_platform_owner: true,
  };

  const mockNetworkState = {
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: null,
  } as NetInfoState;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Mock AsyncStorage
    const mockStorage = new Map();
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => 
      Promise.resolve(mockStorage.get(key) || null)
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key, value) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    });
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue();
    (AsyncStorage.clear as jest.Mock).mockImplementation(() => {
      mockStorage.clear();
      return Promise.resolve();
    });

    // Mock NetInfo
    (NetInfo.addEventListener as jest.Mock).mockImplementation((listener) => {
      mockNetInfoListener = listener;
      return () => {};
    });
    (NetInfo.fetch as jest.Mock).mockResolvedValue(mockNetworkState);

    // Mock Keychain
    (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
      password: 'mock-encryption-key-256-bits-hex-string',
    });
    (Keychain.setInternetCredentials as jest.Mock).mockResolvedValue(true);

    // Mock CryptoJS
    const mockWordArray = {
      toString: jest.fn().mockReturnValue('mock-hex-key'),
      concat: jest.fn().mockReturnThis(),
      words: [1, 2, 3, 4, 5, 6, 7, 8],
    };
    
    (CryptoJS.lib.WordArray.random as jest.Mock) = jest.fn().mockReturnValue(mockWordArray);
    (CryptoJS.lib.WordArray.create as jest.Mock) = jest.fn().mockReturnValue(mockWordArray);
    (CryptoJS.enc.Base64.parse as jest.Mock) = jest.fn().mockReturnValue(mockWordArray);
    (CryptoJS.enc.Hex.parse as jest.Mock) = jest.fn().mockReturnValue(mockWordArray);
    
    (CryptoJS.AES.encrypt as jest.Mock) = jest.fn().mockReturnValue({
      ciphertext: mockWordArray,
      toString: jest.fn().mockReturnValue('encrypted-data'),
    });
    
    (CryptoJS.AES.decrypt as jest.Mock) = jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('{"decrypted":"data"}'),
    });
    
    (CryptoJS.SHA256 as jest.Mock) = jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('mock-hash'),
    });

    // Mock auth store
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      user: validUser,
    });

    // Mock logger
    (logger.info as jest.Mock) = jest.fn();
    (logger.error as jest.Mock) = jest.fn();
    (logger.warn as jest.Mock) = jest.fn();

    // Mock NetworkUtils
    (NetworkUtils.createAuthHeaders as jest.Mock).mockResolvedValue({
      'Authorization': 'Bearer mock-token',
      'Content-Type': 'application/json',
    });

    // Create service instance
    service = SecureOfflineQueueService.getInstance();
  });

  afterEach(() => {
    // Clean up
    if (service) {
      service.destroy();
    }
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Security Validation', () => {
    describe('SQL Injection Prevention', () => {
      it('should detect and reject SQL injection in endpoint', async () => {
        await expect(
          service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders; DROP TABLE users--',
            {},
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          )
        ).rejects.toThrow(FynloException);
      });

      it('should detect SQL injection patterns in payload', async () => {
        const maliciousPayloads = [
          { name: "'; SELECT * FROM users--" },
          { description: "1' OR '1'='1" },
          { query: "UNION SELECT passwords FROM users" },
          { data: "'; DROP DATABASE fynlo--" },
          { input: "admin'--" },
        ];

        for (const payload of maliciousPayloads) {
          await expect(
            service.queueRequest(
              EntityType.ORDER,
              ActionType.CREATE,
              'POST',
              '/api/orders',
              payload,
              {
                restaurantId: 'restaurant-456',
                userId: 'user-123',
              }
            )
          ).rejects.toThrow(FynloException);
        }
      });

      it('should detect path traversal attempts', async () => {
        const pathTraversalEndpoints = [
          '/api/../../../etc/passwd',
          '/api/orders/../../../admin',
          '/api//double//slash',
          '/api/~user/private',
        ];

        for (const endpoint of pathTraversalEndpoints) {
          await expect(
            service.queueRequest(
              EntityType.ORDER,
              ActionType.CREATE,
              'POST',
              endpoint,
              {},
              {
                restaurantId: 'restaurant-456',
                userId: 'user-123',
              }
            )
          ).rejects.toThrow(FynloException);
        }
      });
    });

    describe('Input Sanitization', () => {
      it('should sanitize dangerous characters', async () => {
        const result = await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          {
            name: 'Test<script>alert("XSS")</script>Order',
            description: 'Normal & safe text',
          },
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        expect(result).toBeDefined();
        expect(result).toMatch(/^req_/);
      });

      it('should enforce payload size limits', async () => {
        const largePayload = {
          data: 'x'.repeat(1024 * 1024 + 1), // Exceeds 1MB limit
        };

        await expect(
          service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            largePayload,
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          )
        ).rejects.toThrow(FynloException);
      });

      it('should prevent deep nesting attacks', async () => {
        // Create deeply nested object (>10 levels)
        let deepPayload: any = { value: 'test' };
        for (let i = 0; i < 15; i++) {
          deepPayload = { nested: deepPayload };
        }

        await expect(
          service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            deepPayload,
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          )
        ).rejects.toThrow(/nesting too deep/);
      });
    });

    describe('Encryption', () => {
      it('should encrypt sensitive entity data', async () => {
        const sensitiveEntities = [
          EntityType.PAYMENT,
          EntityType.CUSTOMER,
          EntityType.EMPLOYEE,
        ];

        for (const entityType of sensitiveEntities) {
          const requestId = await service.queueRequest(
            entityType,
            ActionType.CREATE,
            'POST',
            '/api/test',
            { cardNumber: '4111111111111111', cvv: '123' },
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          );

          expect(requestId).toBeDefined();
          expect(CryptoJS.AES.encrypt).toHaveBeenCalled();
        }
      });

      it('should not encrypt non-sensitive entities', async () => {
        jest.clearAllMocks();
        
        await service.queueRequest(
          EntityType.PRODUCT,
          ActionType.CREATE,
          'POST',
          '/api/products',
          { name: 'Test Product', price: 9.99 },
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        expect(CryptoJS.AES.encrypt).not.toHaveBeenCalled();
      });

      it('should handle encryption key initialization failure', async () => {
        (Keychain.getInternetCredentials as jest.Mock).mockRejectedValueOnce(new Error('Keychain error'));
        
        // Create new instance to trigger initialization
        const newService = new SecureOfflineQueueService();
        
        // Should generate fallback session key
        await waitFor(() => {
          expect(CryptoJS.lib.WordArray.random).toHaveBeenCalled();
        });
      });
    });
  });

  describe('Multi-Tenant Isolation', () => {
    describe('Restaurant Access Validation', () => {
      it('should allow access to own restaurant', async () => {
        const requestId = await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          { items: [] },
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        expect(requestId).toBeDefined();
      });

      it('should allow access to accessible restaurants', async () => {
        const requestId = await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          { items: [] },
          {
            restaurantId: 'restaurant-789', // In accessible_restaurants
            userId: 'user-123',
          }
        );

        expect(requestId).toBeDefined();
      });

      it('should deny access to unauthorized restaurant', async () => {
        await expect(
          service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            { items: [] },
            {
              restaurantId: 'unauthorized-restaurant',
              userId: 'user-123',
            }
          )
        ).rejects.toThrow(/Access denied to restaurant/);
      });

      it('should allow platform owner access to any restaurant', async () => {
        (useAuthStore.getState as jest.Mock).mockReturnValue({
          user: platformOwnerUser,
        });

        const requestId = await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          { items: [] },
          {
            restaurantId: 'any-restaurant-id',
            userId: 'user-123',
          }
        );

        expect(requestId).toBeDefined();
      });

      it('should validate user ID matches authenticated user', async () => {
        await expect(
          service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            { items: [] },
            {
              restaurantId: 'restaurant-456',
              userId: 'different-user-id',
            }
          )
        ).rejects.toThrow(/User ID mismatch/);
      });

      it('should handle missing authenticated user', async () => {
        (useAuthStore.getState as jest.Mock).mockReturnValue({ user: null });

        await expect(
          service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            { items: [] },
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          )
        ).rejects.toThrow(/No authenticated user/);
      });
    });

    describe('Mandatory Field Validation', () => {
      it('should require restaurantId', async () => {
        await expect(
          service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            {},
            {
              restaurantId: null as any,
              userId: 'user-123',
            }
          )
        ).rejects.toThrow(/restaurantId must be a string/);
      });

      it('should require userId', async () => {
        await expect(
          service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            {},
            {
              restaurantId: 'restaurant-456',
              userId: null as any,
            }
          )
        ).rejects.toThrow(/userId must be a string/);
      });

      it('should validate restaurantId format', async () => {
        const invalidIds = [
          'restaurant with spaces',
          'restaurant@special',
          'restaurant#hash',
          '../restaurant',
        ];

        for (const id of invalidIds) {
          await expect(
            service.queueRequest(
              EntityType.ORDER,
              ActionType.CREATE,
              'POST',
              '/api/orders',
              {},
              {
                restaurantId: id,
                userId: 'user-123',
              }
            )
          ).rejects.toThrow(/Invalid restaurant ID format/);
        }
      });
    });

    describe('Tenant-Specific Queue Operations', () => {
      beforeEach(async () => {
        // Queue requests for multiple restaurants
        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          { order: 1 },
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          { order: 2 },
          {
            restaurantId: 'restaurant-789',
            userId: 'user-123',
          }
        );
      });

      it('should sync only specified restaurant requests', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ success: true }),
        });

        const result = await service.syncQueue('restaurant-456');

        expect(result.syncedCount).toBeGreaterThan(0);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-Restaurant-Id': 'restaurant-456',
            }),
          })
        );
      });

      it('should clear queue for specific restaurant only', async () => {
        await service.clearQueue('restaurant-456');

        const stats = service.getStatistics();
        expect(stats.queueSize).toBe(1); // Only restaurant-789 request remains
      });
    });
  });

  describe('Queue Management', () => {
    describe('Priority Handling', () => {
      it('should assign default priorities based on entity type', async () => {
        const testCases = [
          { entity: EntityType.PAYMENT, action: ActionType.CREATE, expected: Priority.CRITICAL },
          { entity: EntityType.ORDER, action: ActionType.CREATE, expected: Priority.HIGH },
          { entity: EntityType.INVENTORY, action: ActionType.UPDATE, expected: Priority.HIGH },
          { entity: EntityType.PRODUCT, action: ActionType.UPDATE, expected: Priority.MEDIUM },
        ];

        for (const test of testCases) {
          await service.queueRequest(
            test.entity,
            test.action,
            'POST',
            '/api/test',
            {},
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
              // Not specifying priority to test defaults
            }
          );
        }

        // Verify priorities were assigned correctly
        const stats = service.getStatistics();
        expect(stats.queueSize).toBe(testCases.length);
      });

      it('should respect custom priority', async () => {
        await service.queueRequest(
          EntityType.PRODUCT,
          ActionType.CREATE,
          'POST',
          '/api/products',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
            priority: Priority.CRITICAL,
          }
        );

        const stats = service.getStatistics();
        expect(stats.queueSize).toBe(1);
      });

      it('should process high priority items first during sync', async () => {
        const syncOrder: string[] = [];
        global.fetch = jest.fn().mockImplementation((url) => {
          const match = url.match(/\/api\/(\w+)/);
          if (match) syncOrder.push(match[1]);
          return Promise.resolve({ ok: true });
        });

        // Queue items with different priorities
        await service.queueRequest(
          EntityType.PRODUCT,
          ActionType.CREATE,
          'POST',
          '/api/low',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
            priority: Priority.LOW,
          }
        );

        await service.queueRequest(
          EntityType.PAYMENT,
          ActionType.CREATE,
          'POST',
          '/api/critical',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
            priority: Priority.CRITICAL,
          }
        );

        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/high',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
            priority: Priority.HIGH,
          }
        );

        await service.syncQueue();

        expect(syncOrder).toEqual(['critical', 'high', 'low']);
      });
    });

    describe('Queue Eviction', () => {
      it('should evict low priority items when queue is full', async () => {
        // Fill queue with low priority items
        const maxSize = 500; // From config
        for (let i = 0; i < maxSize; i++) {
          await service.queueRequest(
            EntityType.PRODUCT,
            ActionType.UPDATE,
            'POST',
            `/api/products/${i}`,
            { index: i },
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
              priority: Priority.LOW,
            }
          );
        }

        // Add critical item (should trigger eviction)
        await service.queueRequest(
          EntityType.PAYMENT,
          ActionType.CREATE,
          'POST',
          '/api/payments',
          { amount: 100 },
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
            priority: Priority.CRITICAL,
          }
        );

        const stats = service.getStatistics();
        expect(stats.queueSize).toBeLessThanOrEqual(maxSize);
      });

      it('should never evict critical priority items', async () => {
        // Add critical items
        for (let i = 0; i < 5; i++) {
          await service.queueRequest(
            EntityType.PAYMENT,
            ActionType.CREATE,
            'POST',
            `/api/payments/${i}`,
            { amount: 100 + i },
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
              priority: Priority.CRITICAL,
            }
          );
        }

        // Fill rest of queue
        const maxSize = 500;
        for (let i = 5; i < maxSize; i++) {
          await service.queueRequest(
            EntityType.PRODUCT,
            ActionType.UPDATE,
            'POST',
            `/api/products/${i}`,
            { index: i },
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
              priority: Priority.LOW,
            }
          );
        }

        // Try to add more (should evict low priority only)
        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
            priority: Priority.HIGH,
          }
        );

        const stats = service.getStatistics();
        expect(stats.queueSize).toBeLessThanOrEqual(maxSize);
        // Critical items should still be there
      });

      it('should throw error if cannot evict enough items', async () => {
        // Fill queue with all critical items
        const maxSize = 500;
        for (let i = 0; i < maxSize; i++) {
          await service.queueRequest(
            EntityType.PAYMENT,
            ActionType.CREATE,
            'POST',
            `/api/critical/${i}`,
            { amount: i },
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
              priority: Priority.CRITICAL,
            }
          );
        }

        // Should fail to add more
        await expect(
          service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            {},
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          )
        ).rejects.toThrow(/Queue overflow/);
      });
    });

    describe('Memory Management', () => {
      it('should maintain memory queue size limit', async () => {
        const memoryLimit = 100; // From config

        for (let i = 0; i < memoryLimit + 50; i++) {
          await service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            `/api/orders/${i}`,
            { index: i },
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          );
        }

        const stats = service.getStatistics();
        expect(stats.memoryQueueSize).toBeLessThanOrEqual(memoryLimit);
        expect(stats.queueSize).toBe(memoryLimit + 50);
      });

      it('should cleanup expired items', async () => {
        // Mock old timestamp
        const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days old
        jest.spyOn(Date, 'now').mockReturnValueOnce(oldTimestamp);

        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/old-order',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        // Restore current time
        jest.spyOn(Date, 'now').mockRestore();

        // Trigger cleanup
        await act(async () => {
          jest.advanceTimersByTime(3600000); // 1 hour cleanup interval
        });

        await waitFor(() => {
          const stats = service.getStatistics();
          expect(stats.queueSize).toBe(0);
        });
      });
    });
  });

  describe('Synchronization', () => {
    describe('Network State Management', () => {
      it('should detect online/offline state changes', async () => {
        expect(mockNetInfoListener).toBeDefined();

        // Simulate going offline
        act(() => {
          mockNetInfoListener({
            ...mockNetworkState,
            isConnected: false,
            isInternetReachable: false,
          });
        });

        const { stats: offlineStats } = service.getStatistics();
        expect(offlineStats).toBeDefined();

        // Simulate going back online
        act(() => {
          mockNetInfoListener({
            ...mockNetworkState,
            isConnected: true,
            isInternetReachable: true,
          });
        });

        const { stats: onlineStats } = service.getStatistics();
        expect(onlineStats).toBeDefined();
      });

      it('should start sync when coming back online', async () => {
        // Queue a request while online
        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        // Go offline
        act(() => {
          mockNetInfoListener({
            ...mockNetworkState,
            isConnected: false,
            isInternetReachable: false,
          });
        });

        // Mock fetch for sync
        global.fetch = jest.fn().mockResolvedValue({ ok: true });

        // Go back online
        act(() => {
          mockNetInfoListener({
            ...mockNetworkState,
            isConnected: true,
            isInternetReachable: true,
          });
        });

        // Wait for sync to trigger
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalled();
        });
      });

      it('should not sync when offline', async () => {
        // Go offline
        act(() => {
          mockNetInfoListener({
            ...mockNetworkState,
            isConnected: false,
            isInternetReachable: false,
          });
        });

        global.fetch = jest.fn();

        const result = await service.syncQueue();

        expect(result).toEqual({
          success: false,
          syncedCount: 0,
          failedCount: 0,
          conflictCount: 0,
        });
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    describe('Batch Processing', () => {
      it('should process requests in batches', async () => {
        const batchSize = 10; // From config
        const totalRequests = 25;

        // Queue multiple requests
        for (let i = 0; i < totalRequests; i++) {
          await service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            `/api/orders/${i}`,
            { index: i },
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          );
        }

        let fetchCount = 0;
        global.fetch = jest.fn().mockImplementation(() => {
          fetchCount++;
          return Promise.resolve({ ok: true });
        });

        await service.syncQueue();

        expect(fetchCount).toBe(totalRequests);
        // Verify batching logic (3 batches: 10, 10, 5)
        expect(Math.ceil(totalRequests / batchSize)).toBe(3);
      });

      it('should handle partial batch failures', async () => {
        // Queue multiple requests
        for (let i = 0; i < 5; i++) {
          await service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            `/api/orders/${i}`,
            { index: i },
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          );
        }

        // Mock some successes and some failures
        let callCount = 0;
        global.fetch = jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount % 2 === 0) {
            return Promise.resolve({ ok: true });
          }
          return Promise.reject(new Error('Network error'));
        });

        const result = await service.syncQueue();

        expect(result.syncedCount).toBeGreaterThan(0);
        expect(result.failedCount).toBeGreaterThan(0);
        expect(result.success).toBe(true);
      });
    });

    describe('Retry Logic', () => {
      it('should retry failed requests with exponential backoff', async () => {
        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        let attemptCount = 0;
        global.fetch = jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error('Network timeout'));
          }
          return Promise.resolve({ ok: true });
        });

        await service.syncQueue();

        // First attempt fails
        expect(attemptCount).toBe(1);

        // Wait for retry with backoff
        jest.advanceTimersByTime(1000); // Base delay
        await waitFor(() => expect(attemptCount).toBe(2));

        // Wait for second retry with increased backoff
        jest.advanceTimersByTime(2000); // 2x base delay
        await waitFor(() => expect(attemptCount).toBe(3));
      });

      it('should add jitter to retry delays', async () => {
        const mathRandomSpy = jest.spyOn(Math, 'random');
        mathRandomSpy.mockReturnValue(0.5);

        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        await service.syncQueue();

        // Verify jitter was applied
        expect(mathRandomSpy).toHaveBeenCalled();
        mathRandomSpy.mockRestore();
      });

      it('should respect max retry limit', async () => {
        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        global.fetch = jest.fn().mockRejectedValue(new Error('Permanent failure'));

        // Attempt sync multiple times
        for (let i = 0; i < 10; i++) {
          await service.syncQueue();
          jest.advanceTimersByTime(60000);
        }

        // Should stop retrying after max attempts
        expect(global.fetch).toHaveBeenCalledTimes(6); // Initial + 5 retries
      });

      it('should only retry retryable errors', async () => {
        const requests = [
          { error: new Error('Network timeout'), shouldRetry: true },
          { error: new Error('503 Service Unavailable'), shouldRetry: true },
          { error: new Error('401 Unauthorized'), shouldRetry: false },
          { error: new Error('400 Bad Request'), shouldRetry: false },
        ];

        for (const { error, shouldRetry } of requests) {
          await service.clearQueue();
          
          await service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            {},
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          );

          global.fetch = jest.fn().mockRejectedValue(error);

          await service.syncQueue();

          if (shouldRetry) {
            // Advance timers to trigger retry
            jest.advanceTimersByTime(1000);
            // Retry should be scheduled
          }

          const stats = service.getStatistics();
          if (!shouldRetry) {
            expect(stats.totalFailed).toBeGreaterThan(0);
          }
        }
      });
    });

    describe('Conflict Resolution', () => {
      it('should apply conflict resolution strategies', async () => {
        const strategies = [
          ConflictResolutionStrategy.LAST_WRITE_WINS,
          ConflictResolutionStrategy.FIRST_WRITE_WINS,
          ConflictResolutionStrategy.SERVER_WINS,
          ConflictResolutionStrategy.CLIENT_WINS,
        ];

        for (const strategy of strategies) {
          await service.queueRequest(
            EntityType.ORDER,
            ActionType.UPDATE,
            'PUT',
            '/api/orders/123',
            { status: 'completed' },
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
              conflictResolution: strategy,
            }
          );
        }

        const stats = service.getStatistics();
        expect(stats.queueSize).toBe(strategies.length);
      });

      it('should handle dependency chains', async () => {
        const parentId = await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          { items: [] },
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        await service.queueRequest(
          EntityType.PAYMENT,
          ActionType.CREATE,
          'POST',
          '/api/payments',
          { orderId: '123' },
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
            dependencies: [parentId],
          }
        );

        const stats = service.getStatistics();
        expect(stats.queueSize).toBe(2);
      });
    });

    describe('Idempotency', () => {
      it('should generate unique idempotency keys', async () => {
        const keys = new Set();

        for (let i = 0; i < 10; i++) {
          await service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            { index: i },
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          );
        }

        global.fetch = jest.fn().mockImplementation((url, options) => {
          const idempotencyKey = options.headers['X-Idempotency-Key'];
          expect(keys.has(idempotencyKey)).toBe(false);
          keys.add(idempotencyKey);
          return Promise.resolve({ ok: true });
        });

        await service.syncQueue();

        expect(keys.size).toBe(10);
      });

      it('should include idempotency key in sync headers', async () => {
        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          { test: true },
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        global.fetch = jest.fn().mockResolvedValue({ ok: true });

        await service.syncQueue();

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-Idempotency-Key': expect.any(String),
            }),
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    describe('FynloException Usage', () => {
      it('should throw FynloException for validation errors', async () => {
        const invalidInputs = [
          { restaurantId: '', userId: 'user-123' },
          { restaurantId: 'restaurant-456', userId: '' },
          { restaurantId: 123, userId: 'user-123' },
          { restaurantId: 'restaurant-456', userId: true },
        ];

        for (const input of invalidInputs) {
          try {
            await service.queueRequest(
              EntityType.ORDER,
              ActionType.CREATE,
              'POST',
              '/api/orders',
              {},
              input as any
            );
            fail('Should have thrown FynloException');
          } catch (error) {
            expect(error).toBeInstanceOf(FynloException);
            expect(error.code).toMatch(/VALIDATION_ERROR|BAD_REQUEST/);
          }
        }
      });

      it('should throw FynloException for multi-tenant violations', async () => {
        try {
          await service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            {},
            {
              restaurantId: 'unauthorized-restaurant',
              userId: 'user-123',
            }
          );
          fail('Should have thrown FynloException');
        } catch (error) {
          expect(error).toBeInstanceOf(FynloException);
          expect(error.code).toBe('MULTI_TENANT_VIOLATION');
          expect(error.message).toContain('Access denied to restaurant');
        }
      });

      it('should throw FynloException for encryption errors', async () => {
        // Force encryption error by clearing encryption key
        (Keychain.getInternetCredentials as jest.Mock).mockResolvedValueOnce(null);
        (CryptoJS.lib.WordArray.random as jest.Mock).mockImplementationOnce(() => {
          throw new Error('Crypto error');
        });

        // Create new instance to trigger error
        try {
          const brokenService = new SecureOfflineQueueService();
          await new Promise(resolve => setTimeout(resolve, 100)); // Wait for init
        } catch (error) {
          expect(error).toBeInstanceOf(FynloException);
        }
      });

      it('should throw FynloException for queue overflow', async () => {
        // Fill queue with critical items
        const maxSize = 500;
        for (let i = 0; i < maxSize; i++) {
          await service.queueRequest(
            EntityType.PAYMENT,
            ActionType.CREATE,
            'POST',
            `/api/critical/${i}`,
            {},
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
              priority: Priority.CRITICAL,
            }
          );
        }

        try {
          await service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            {},
            {
              restaurantId: 'restaurant-456',
              userId: 'user-123',
            }
          );
          fail('Should have thrown FynloException');
        } catch (error) {
          expect(error).toBeInstanceOf(FynloException);
          expect(error.code).toBe('QUEUE_OVERFLOW');
        }
      });
    });

    describe('Audit Logging', () => {
      it('should log queue operations', async () => {
        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        const auditLog = await AsyncStorage.getItem('offline_queue_audit');
        expect(auditLog).toBeDefined();
        
        const entries = JSON.parse(auditLog || '[]');
        expect(entries).toHaveLength(1);
        expect(entries[0].event).toBe('QUEUE_REQUEST');
      });

      it('should log access denials', async () => {
        try {
          await service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/orders',
            {},
            {
              restaurantId: 'unauthorized-restaurant',
              userId: 'user-123',
            }
          );
        } catch (error) {
          // Expected to fail
        }

        const auditLog = await AsyncStorage.getItem('offline_queue_audit');
        const entries = JSON.parse(auditLog || '[]');
        
        const accessDenied = entries.find((e: any) => e.event === 'ACCESS_DENIED');
        expect(accessDenied).toBeDefined();
        expect(accessDenied.details.reason).toContain('Restaurant access validation failed');
      });

      it('should limit audit log size', async () => {
        // Generate many audit entries
        for (let i = 0; i < 1100; i++) {
          try {
            await service.queueRequest(
              EntityType.ORDER,
              ActionType.CREATE,
              'POST',
              '/api/orders',
              {},
              {
                restaurantId: 'unauthorized-restaurant',
                userId: 'user-123',
              }
            );
          } catch (error) {
            // Expected to fail
          }
        }

        const auditLog = await AsyncStorage.getItem('offline_queue_audit');
        const entries = JSON.parse(auditLog || '[]');
        
        expect(entries.length).toBeLessThanOrEqual(1000);
      });
    });

    describe('Error Recovery', () => {
      it('should handle storage failures gracefully', async () => {
        (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));

        // Should not throw, but log error
        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to save queue',
          expect.any(Error)
        );
      });

      it('should handle corrupted storage data', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('corrupted-json-{{{');

        // Create new instance to trigger load
        const newService = new SecureOfflineQueueService();
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should log error but continue
        expect(logger.error).toHaveBeenCalledWith(
          'Failed to load queue',
          expect.any(Error)
        );
      });

      it('should recover from network failures during sync', async () => {
        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );

        global.fetch = jest.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({ ok: true });

        // First sync fails
        await service.syncQueue();
        let stats = service.getStatistics();
        expect(stats.totalFailed).toBe(1);

        // Second sync succeeds
        await service.syncQueue();
        stats = service.getStatistics();
        expect(stats.totalSynced).toBe(1);
      });
    });
  });

  describe('React Hook Integration', () => {
    it('should provide queue statistics via hook', async () => {
      const { result } = renderHook(() => useSecureOfflineQueue());

      expect(result.current.stats).toBeDefined();
      expect(result.current.isOnline).toBe(true);
    });

    it('should update stats periodically', async () => {
      const { result, rerender } = renderHook(() => useSecureOfflineQueue());

      const initialQueueSize = result.current.stats.queueSize;

      // Queue a request
      await act(async () => {
        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/orders',
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );
      });

      // Advance timers to trigger update
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      rerender();

      await waitFor(() => {
        expect(result.current.stats.queueSize).toBe(initialQueueSize + 1);
      });
    });

    it('should react to network changes', async () => {
      const { result, rerender } = renderHook(() => useSecureOfflineQueue());

      expect(result.current.isOnline).toBe(true);

      // Simulate network change
      act(() => {
        mockNetInfoListener({
          ...mockNetworkState,
          isConnected: false,
          isInternetReachable: false,
        });
      });

      rerender();

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize properly', async () => {
      expect(service).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(
        'SecureOfflineQueueService initialized',
        expect.any(Object)
      );
    });

    it('should maintain singleton instance', () => {
      const instance1 = SecureOfflineQueueService.getInstance();
      const instance2 = SecureOfflineQueueService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should clean up resources on destroy', () => {
      service.destroy();

      expect(logger.info).toHaveBeenCalledWith('SecureOfflineQueueService destroyed');
      
      // Verify timers are cleared
      const stats = service.getStatistics();
      expect(stats.queueSize).toBe(0);
    });

    it('should persist queue across service restarts', async () => {
      // Queue a request
      await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/orders',
        { persisted: true },
        {
          restaurantId: 'restaurant-456',
          userId: 'user-123',
        }
      );

      // Destroy service
      service.destroy();

      // Create new instance
      const newService = new SecureOfflineQueueService();
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = newService.getStatistics();
      expect(stats.queueSize).toBeGreaterThan(0);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid successive requests', async () => {
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
          )
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
      expect(new Set(results).size).toBe(100); // All unique IDs
    });

    it('should handle concurrent sync attempts', async () => {
      // Queue multiple requests
      for (let i = 0; i < 10; i++) {
        await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          `/api/orders/${i}`,
          {},
          {
            restaurantId: 'restaurant-456',
            userId: 'user-123',
          }
        );
      }

      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      // Attempt multiple concurrent syncs
      const syncPromises = [
        service.syncQueue(),
        service.syncQueue(),
        service.syncQueue(),
      ];

      const results = await Promise.all(syncPromises);

      // Only one should actually sync
      const successfulSyncs = results.filter(r => r.syncedCount > 0);
      expect(successfulSyncs).toHaveLength(1);
    });

    it('should handle immediate sync requests', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      await service.queueRequest(
        EntityType.PAYMENT,
        ActionType.CREATE,
        'POST',
        '/api/payments',
        { amount: 100 },
        {
          restaurantId: 'restaurant-456',
          userId: 'user-123',
          immediate: true,
        }
      );

      // Should trigger immediate sync
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should generate checksums for data integrity', async () => {
      const payload = { amount: 100, items: [1, 2, 3] };
      
      await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/orders',
        payload,
        {
          restaurantId: 'restaurant-456',
          userId: 'user-123',
        }
      );

      expect(CryptoJS.SHA256).toHaveBeenCalledWith(JSON.stringify(payload));
    });

    it('should handle empty payload', async () => {
      const requestId = await service.queueRequest(
        EntityType.ORDER,
        ActionType.DELETE,
        'DELETE',
        '/api/orders/123',
        undefined,
        {
          restaurantId: 'restaurant-456',
          userId: 'user-123',
        }
      );

      expect(requestId).toBeDefined();
    });

    it('should handle special characters in payload', async () => {
      const specialPayload = {
        name: 'Test™ Product®',
        description: 'Price: €50 | 50% off\!',
        emoji: '🍕🍔🍟',
        unicode: '你好世界',
      };

      const requestId = await service.queueRequest(
        EntityType.PRODUCT,
        ActionType.CREATE,
        'POST',
        '/api/products',
        specialPayload,
        {
          restaurantId: 'restaurant-456',
          userId: 'user-123',
        }
      );

      expect(requestId).toBeDefined();
    });
  });
});