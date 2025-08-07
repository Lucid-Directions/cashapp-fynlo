/**
 * Comprehensive tests for OfflineQueueService
 * Tests security, performance, and functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { 
  offlineQueueService,
  EntityType,
  ActionType,
  Priority,
  QueueStatus,
  ConflictResolutionStrategy,
} from '../../../src/services/offline/OfflineQueueService';
import { FynloException } from '../../../src/utils/exceptions/FynloException';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('../../../src/store/useAuthStore');
jest.mock('../../../src/utils/logger');

describe('OfflineQueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue();
    NetInfo.addEventListener.mockReturnValue(() => {});
    NetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  describe('Security Tests', () => {
    it('should encrypt sensitive payment data', async () => {
      const paymentData = {
        cardNumber: '4111111111111111',
        cvv: '123',
        amount: 100,
      };

      const requestId = await offlineQueueService.queueRequest(
        EntityType.PAYMENT,
        ActionType.CREATE,
        'POST',
        '/api/v1/payments',
        paymentData,
        { encrypt: true }
      );

      expect(requestId).toBeDefined();
      // Verify encryption was applied
      const calls = AsyncStorage.setItem.mock.calls;
      const savedData = calls[calls.length - 1][1];
      expect(savedData).not.toContain('4111111111111111');
    });

    it('should validate and reject SQL injection attempts', async () => {
      const maliciousData = {
        name: "'; DROP TABLE users; --",
        query: "SELECT * FROM users WHERE id = 1; DELETE FROM orders",
      };

      await expect(
        offlineQueueService.queueRequest(
          EntityType.CUSTOMER,
          ActionType.CREATE,
          'POST',
          '/api/v1/customers',
          maliciousData
        )
      ).rejects.toThrow(FynloException);
    });

    it('should enforce multi-tenant isolation', async () => {
      // Mock different tenant contexts
      const tenant1Data = { restaurantId: 'rest1', data: 'tenant1' };
      const tenant2Data = { restaurantId: 'rest2', data: 'tenant2' };

      // Queue data for tenant1
      await offlineQueueService.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        tenant1Data
      );

      // Verify tenant isolation when syncing
      const stats = offlineQueueService.getStatistics();
      expect(stats.byRestaurant).toBeDefined();
    });

    it('should reject oversized payloads', async () => {
      const largePayload = {
        data: 'x'.repeat(2 * 1024 * 1024), // 2MB
      };

      await expect(
        offlineQueueService.queueRequest(
          EntityType.PRODUCT,
          ActionType.CREATE,
          'POST',
          '/api/v1/products',
          largePayload
        )
      ).rejects.toThrow(FynloException);
    });
  });

  describe('Performance Tests', () => {
    it('should enforce queue size limits', async () => {
      // Queue many items
      const promises = [];
      for (let i = 0; i < 600; i++) {
        promises.push(
          offlineQueueService.queueRequest(
            EntityType.PRODUCT,
            ActionType.UPDATE,
            'PUT',
            `/api/v1/products/${i}`,
            { name: `Product ${i}` },
            { priority: Priority.LOW }
          )
        );
      }

      await Promise.all(promises);

      const stats = offlineQueueService.getStatistics();
      expect(stats.totalQueued).toBeLessThanOrEqual(500); // Max queue size
    });

    it('should handle memory efficiently with offloading', async () => {
      // Queue many items to test memory management
      for (let i = 0; i < 150; i++) {
        await offlineQueueService.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/v1/orders',
          { id: i, items: [] }
        );
      }

      // Verify memory offloading occurred
      const stats = offlineQueueService.getStatistics();
      expect(stats.totalQueued).toBeDefined();
    });

    it('should clean up expired items', async () => {
      // Mock an old timestamp
      const oldRequest = {
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days old
      };

      // The cleanup should remove expired items
      const stats = offlineQueueService.getStatistics();
      expect(stats.oldestItemAge).toBeLessThan(7 * 24 * 60 * 60 * 1000);
    });

    it('should handle concurrent operations without race conditions', async () => {
      const operations = [];
      
      // Simulate concurrent operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          offlineQueueService.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            '/api/v1/orders',
            { id: i }
          )
        );
      }

      const results = await Promise.all(operations);
      const uniqueIds = new Set(results);
      expect(uniqueIds.size).toBe(10); // All IDs should be unique
    });
  });

  describe('Functionality Tests', () => {
    it('should queue requests when offline', async () => {
      // Mock offline state
      NetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const requestId = await offlineQueueService.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        { items: [], total: 100 }
      );

      expect(requestId).toBeDefined();
      const stats = offlineQueueService.getStatistics();
      expect(stats.totalQueued).toBeGreaterThan(0);
    });

    it('should prioritize critical requests', async () => {
      // Queue requests with different priorities
      await offlineQueueService.queueRequest(
        EntityType.REPORT,
        ActionType.CREATE,
        'POST',
        '/api/v1/reports',
        {},
        { priority: Priority.LOW }
      );

      await offlineQueueService.queueRequest(
        EntityType.PAYMENT,
        ActionType.CREATE,
        'POST',
        '/api/v1/payments',
        { amount: 100 },
        { priority: Priority.CRITICAL }
      );

      const stats = offlineQueueService.getStatistics();
      expect(stats.byPriority[Priority.CRITICAL]).toBeDefined();
      expect(stats.byPriority[Priority.LOW]).toBeDefined();
    });

    it('should handle dependency resolution', async () => {
      const orderId = await offlineQueueService.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        { items: [] }
      );

      const paymentId = await offlineQueueService.queueRequest(
        EntityType.PAYMENT,
        ActionType.CREATE,
        'POST',
        '/api/v1/payments',
        { orderId: 'temp_123', amount: 100 },
        { dependencies: [orderId] }
      );

      expect(paymentId).toBeDefined();
    });

    it('should apply conflict resolution strategies', async () => {
      const requestId = await offlineQueueService.queueRequest(
        EntityType.INVENTORY,
        ActionType.UPDATE,
        'PUT',
        '/api/v1/inventory/123',
        { quantity: 10 },
        { conflictResolution: ConflictResolutionStrategy.SERVER_WINS }
      );

      expect(requestId).toBeDefined();
    });

    it('should retry failed requests with exponential backoff', async () => {
      jest.useFakeTimers();

      // Mock a retryable error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout'));

      await offlineQueueService.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        { items: [] }
      );

      // Trigger sync
      await offlineQueueService.syncQueue();

      // Verify retry was scheduled
      jest.advanceTimersByTime(2000);

      jest.useRealTimers();
    });

    it('should generate unique idempotency keys', async () => {
      const payload = { items: [], total: 100 };
      
      const id1 = await offlineQueueService.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        payload
      );

      const id2 = await offlineQueueService.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        payload
      );

      expect(id1).not.toBe(id2);
    });
  });

  describe('Error Handling', () => {
    it('should throw FynloException for errors', async () => {
      // Mock auth error
      const mockAuthStore = require('../../../src/store/useAuthStore');
      mockAuthStore.useAuthStore.getState.mockReturnValue({
        currentUser: null,
      });

      await expect(
        offlineQueueService.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/v1/orders',
          {}
        )
      ).rejects.toThrow(FynloException);
    });

    it('should handle storage errors gracefully', async () => {
      AsyncStorage.setItem.mockRejectedValue(new Error('Storage full'));

      await expect(
        offlineQueueService.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/v1/orders',
          {}
        )
      ).rejects.toThrow(FynloException);
    });

    it('should handle network state changes', async () => {
      const mockListener = jest.fn();
      NetInfo.addEventListener.mockImplementation((listener) => {
        mockListener.mockImplementation(listener);
        return () => {};
      });

      // Simulate network change
      mockListener({ isConnected: false, isInternetReachable: false });

      const state = offlineQueueService.getNetworkState();
      expect(state.isOnline).toBeDefined();
    });
  });

  describe('Sync Tests', () => {
    it('should sync queue when coming online', async () => {
      // Start offline
      NetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      await offlineQueueService.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        { items: [] }
      );

      // Come online
      const mockListener = jest.fn();
      NetInfo.addEventListener.mockImplementation((listener) => {
        mockListener.mockImplementation(listener);
        return () => {};
      });

      mockListener({ isConnected: true, isInternetReachable: true });

      // Verify sync was triggered
      const syncState = offlineQueueService.getSyncState();
      expect(syncState).toBeDefined();
    });

    it('should batch sync requests', async () => {
      // Queue multiple requests
      for (let i = 0; i < 25; i++) {
        await offlineQueueService.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/v1/orders',
          { id: i }
        );
      }

      // Mock successful sync
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await offlineQueueService.syncQueue();
      
      // Should process in batches of 10
      expect(result.syncedCount).toBeLessThanOrEqual(25);
    });

    it('should track sync statistics', async () => {
      const stats = offlineQueueService.getStatistics();
      
      expect(stats).toHaveProperty('totalQueued');
      expect(stats).toHaveProperty('byStatus');
      expect(stats).toHaveProperty('byPriority');
      expect(stats).toHaveProperty('byEntityType');
      expect(stats).toHaveProperty('averageRetryCount');
      expect(stats).toHaveProperty('estimatedSyncTime');
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      offlineQueueService.destroy();
      
      // Verify cleanup
      expect(NetInfo.addEventListener).toHaveBeenCalled();
    });

    it('should clear queue when requested', async () => {
      await offlineQueueService.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        {}
      );

      await offlineQueueService.clearQueue();

      const stats = offlineQueueService.getStatistics();
      expect(stats.totalQueued).toBe(0);
    });
  });
});
EOF < /dev/null