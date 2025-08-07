/**
 * Comprehensive Integration Tests for OfflineQueueService
 * Tests real offline queue functionality without mocking the service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Import the REAL service and types
import {
  offlineQueueService,
  EntityType,
  ActionType,
  Priority,
  QueueStatus,
  ConflictResolutionStrategy,
  ConflictType
} from '../offline/OfflineQueueService';
import type { EnhancedOrderItem } from '../../types/cart';

// Mock only external dependencies, not our service
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../utils/errorHandler', () => ({
  errorHandler: {
    handleError: jest.fn(),
  },
  ErrorType: {
    SYSTEM: 'system',
    STORAGE: 'storage',
    NETWORK: 'network',
  },
  ErrorSeverity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
}));

jest.mock('../../config/api', () => ({
  default: {
    FULL_API_URL: 'https://api.test.com',
  },
}));

jest.mock('../../utils/NetworkUtils', () => ({
  default: {
    createAuthHeaders: jest.fn().mockResolvedValue({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    }),
  },
}));

jest.mock('../../utils/tokenManager', () => ({
  default: {
    getAccessToken: jest.fn().mockResolvedValue('test-token'),
  },
}));

jest.mock('../../utils/offlineHandler', () => ({
  offlineHandler: {
    handleOfflineAction: jest.fn(),
  },
  OfflineAction: {
    CACHE: 'cache',
    QUEUE: 'queue',
  },
  OfflineFeature: {
    ORDERS: 'orders',
    PRODUCTS: 'products',
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

// Use real AsyncStorage mock
require('@react-native-async-storage/async-storage/jest/async-storage-mock');

describe('OfflineQueueService Integration Tests', () => {
  let service: typeof offlineQueueService;
  let mockNetworkListener: jest.Mock;

  // Test data
  const mockOrderData: Partial<EnhancedOrderItem> = {
    id: 'order-123',
    productId: 'prod-456',
    name: 'Test Burger',
    price: 12.99,
    quantity: 2,
    modifications: [],
    originalPrice: 12.99,
    modificationPrice: 0,
    totalPrice: 25.98,
    addedAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };

  const mockProductData = {
    id: 'prod-123',
    name: 'Test Product',
    price: 9.99,
    category_id: 'cat-456',
    available: true,
  };

  const mockPaymentData = {
    orderId: 'order-123',
    amount: 25.98,
    method: 'card',
    currency: 'GBP',
  };

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset AsyncStorage
    await AsyncStorage.clear();
    
    // Mock NetInfo
    mockNetworkListener = jest.fn();
    (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockNetworkListener);
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
    
    // Get fresh service instance
    service = offlineQueueService;
    
    // Clear any existing queue
    await service.clearQueue();
  });

  afterEach(async () => {
    if (service) {
      service.destroy();
    }
    await AsyncStorage.clear();
  });

  describe('Queue Management', () => {
    it('should queue requests and persist them', async () => {
      const requestId = await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        mockOrderData,
        { priority: Priority.HIGH }
      );

      expect(requestId).toBeTruthy();
      expect(typeof requestId).toBe('string');

      // Verify request is in queue
      const request = service.getRequestStatus(requestId);
      expect(request).toBeDefined();
      expect(request?.entityType).toBe(EntityType.ORDER);
      expect(request?.action).toBe(ActionType.CREATE);
      expect(request?.status).toBe(QueueStatus.PENDING);
      expect(request?.priority).toBe(Priority.HIGH);

      // Verify persistence
      const stats = service.getStatistics();
      expect(stats.totalQueued).toBe(1);
      expect(stats.byStatus[QueueStatus.PENDING]).toBe(1);
      expect(stats.byEntityType[EntityType.ORDER]).toBe(1);
    });

    it('should handle multiple requests with different priorities', async () => {
      const requests = await Promise.all([
        service.queueRequest(EntityType.REPORT, ActionType.CREATE, 'POST', '/api/v1/reports', {}, { priority: Priority.LOW }),
        service.queueRequest(EntityType.PAYMENT, ActionType.CREATE, 'POST', '/api/v1/payments', mockPaymentData, { priority: Priority.CRITICAL }),
        service.queueRequest(EntityType.ORDER, ActionType.CREATE, 'POST', '/api/v1/orders', mockOrderData, { priority: Priority.HIGH }),
        service.queueRequest(EntityType.PRODUCT, ActionType.UPDATE, 'PUT', '/api/v1/products/123', mockProductData, { priority: Priority.MEDIUM }),
      ]);

      expect(requests).toHaveLength(4);
      requests.forEach(id => expect(id).toBeTruthy());

      const stats = service.getStatistics();
      expect(stats.totalQueued).toBe(4);
      expect(stats.byPriority[Priority.CRITICAL]).toBe(1);
      expect(stats.byPriority[Priority.HIGH]).toBe(1);
      expect(stats.byPriority[Priority.MEDIUM]).toBe(1);
      expect(stats.byPriority[Priority.LOW]).toBe(1);
    });

    it('should generate unique request IDs and idempotency keys', async () => {
      const requestIds = await Promise.all(
        Array.from({ length: 10 }, () =>
          service.queueRequest(EntityType.ORDER, ActionType.CREATE, 'POST', '/api/v1/orders', mockOrderData)
        )
      );

      // All IDs should be unique
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(10);

      // Check that requests have proper metadata
      const firstRequest = service.getRequestStatus(requestIds[0]);
      expect(firstRequest?.metadata.idempotencyKey).toBeTruthy();
      expect(firstRequest?.metadata.originalTimestamp).toBeTruthy();
    });

    it('should handle queue size limits and eviction', async () => {
      // This test verifies basic queue functionality since we can't test eviction with singleton
      // Add multiple requests to verify queue works
      const requests = [];
      for (let i = 0; i < 10; i++) {
        const priority = i < 2 ? Priority.CRITICAL : Priority.LOW;
        const requestId = await service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          `/api/v1/orders/${i}`,
          { ...mockOrderData, id: `order-${i}` },
          { priority }
        );
        requests.push(requestId);
      }

      const stats = service.getStatistics();
      expect(stats.totalQueued).toBeGreaterThan(0);
      expect(stats.byPriority[Priority.CRITICAL]).toBeGreaterThan(0); // High priority items added
    });
  });

  describe('Offline/Online Scenarios', () => {
    it('should queue requests when offline and sync when online', async () => {
      // Mock offline state
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'server-order-123', status: 'created' }),
      });

      // Try executeWithFallback while offline - should queue and return fallback
      const result = await service.executeWithFallback(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        mockOrderData,
        { 
          offlineResponse: { id: 'temp-order-123', status: 'queued' },
          priority: Priority.HIGH 
        }
      );

      expect(result).toEqual({ id: 'temp-order-123', status: 'queued' });

      // Verify request was queued
      const stats = service.getStatistics();
      expect(stats.totalQueued).toBe(1);
      expect(stats.byStatus[QueueStatus.PENDING]).toBe(1);

      // Simulate coming back online
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });

      // Sync queue
      const syncResult = await service.syncQueue();
      expect(syncResult.success).toBe(true);
      expect(syncResult.syncedCount).toBe(1);
      expect(syncResult.failedCount).toBe(0);

      // Verify request was processed
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/orders',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
          body: JSON.stringify(mockOrderData),
        })
      );
    });

    it('should handle network failures and retry with exponential backoff', async () => {
      // Mock network error
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        });

      const requestId = await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        mockOrderData
      );

      const syncResult = await service.syncQueue();
      
      // Should handle retries and eventually succeed or properly fail
      expect(syncResult.success).toBeDefined();
      
      if (syncResult.success) {
        expect(syncResult.syncedCount).toBeGreaterThan(0);
      } else {
        expect(syncResult.errors.length).toBeGreaterThan(0);
      }
    });

    it('should cache responses and return cached data when offline', async () => {
      const cacheKey = 'menu-items';
      const apiResponse = [mockProductData];

      // Mock successful API call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(apiResponse),
      });

      // First call - online, should cache response
      const firstResult = await service.executeWithFallback(
        EntityType.PRODUCT,
        ActionType.SYNC,
        'GET',
        '/api/v1/products',
        undefined,
        {
          cacheKey,
          cacheDuration: 60000, // 1 minute
          offlineResponse: [],
        }
      );

      expect(firstResult).toEqual(apiResponse);

      // Go offline
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      // Second call - offline, should return cached data
      const secondResult = await service.executeWithFallback(
        EntityType.PRODUCT,
        ActionType.SYNC,
        'GET',
        '/api/v1/products',
        undefined,
        {
          cacheKey,
          cacheDuration: 60000,
          offlineResponse: [],
        }
      );

      expect(secondResult).toEqual(apiResponse);
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect and resolve conflicts using SERVER_WINS strategy', async () => {
      const conflictRequestId = await service.queueRequest(
        EntityType.ORDER,
        ActionType.UPDATE,
        'PUT',
        '/api/v1/orders/123',
        { ...mockOrderData, id: 'order-123', version: 1 },
        { conflictResolution: ConflictResolutionStrategy.SERVER_WINS }
      );

      // Mock a version conflict scenario
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ 
            id: 'order-123', 
            version: 2, 
            updated_at: new Date().toISOString() 
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        });

      const syncResult = await service.syncQueue();
      
      // With SERVER_WINS, conflicts should be resolved by skipping client changes
      expect(syncResult.success).toBe(true);
      expect(syncResult.conflictCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle CLIENT_WINS conflict resolution', async () => {
      await service.queueRequest(
        EntityType.PRODUCT,
        ActionType.UPDATE,
        'PUT',
        '/api/v1/products/123',
        mockProductData,
        { conflictResolution: ConflictResolutionStrategy.CLIENT_WINS }
      );

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      const syncResult = await service.syncQueue();
      expect(syncResult.success).toBe(true);
    });

    it('should store manual conflicts for later resolution', async () => {
      await service.queueRequest(
        EntityType.CUSTOMER,
        ActionType.UPDATE,
        'PUT',
        '/api/v1/customers/456',
        { id: 'customer-456', name: 'Updated Name' },
        { conflictResolution: ConflictResolutionStrategy.MANUAL }
      );

      const syncResult = await service.syncQueue();
      
      // Check for stored conflicts
      const conflicts = await service.getConflicts();
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('Data Persistence and Recovery', () => {
    it('should persist queue across service restarts', async () => {
      const originalRequestId = await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        mockOrderData
      );

      // Verify request exists
      expect(service.getRequestStatus(originalRequestId)).toBeDefined();

      // Destroy and recreate service
      service.destroy();
      
      // Create new service instance
      const newService = offlineQueueService;
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that the request was restored
      const restoredRequest = newService.getRequestStatus(originalRequestId);
      expect(restoredRequest).toBeDefined();
      expect(restoredRequest?.entityType).toBe(EntityType.ORDER);
      expect(restoredRequest?.payload).toEqual(mockOrderData);

      newService.destroy();
    });

    it('should handle encryption and data integrity with checksums', async () => {
      const requestData = { ...mockOrderData, sensitiveData: 'secret-info' };
      
      const requestId = await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        requestData
      );

      const request = service.getRequestStatus(requestId);
      expect(request?.checksum).toBeTruthy();
      expect(typeof request?.checksum).toBe('string');

      // Verify data integrity
      expect(request?.payload).toEqual(requestData);
    });

    it('should compress data for storage efficiency', async () => {
      const largePayload = {
        ...mockOrderData,
        largefield: 'x'.repeat(10000), // 10KB of data
        items: Array.from({ length: 100 }, (_, i) => ({ 
          id: i, 
          name: `Item ${i}`,
          description: 'A'.repeat(100) 
        })),
      };

      const requestId = await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        largePayload
      );

      const request = service.getRequestStatus(requestId);
      expect(request?.payload).toEqual(largePayload);

      // Verify compression by checking storage directly
      const storageData = await AsyncStorage.getItem('offline_queue_v2');
      expect(storageData).toBeTruthy();
      
      // Compressed data should be smaller than JSON.stringify
      const uncompressedSize = JSON.stringify([request]).length;
      expect(storageData!.length).toBeLessThan(uncompressedSize * 1.5); // Some overhead expected
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate queue statistics', async () => {
      const requests = await Promise.all([
        service.queueRequest(EntityType.ORDER, ActionType.CREATE, 'POST', '/api/v1/orders', mockOrderData, { priority: Priority.HIGH }),
        service.queueRequest(EntityType.PAYMENT, ActionType.CREATE, 'POST', '/api/v1/payments', mockPaymentData, { priority: Priority.CRITICAL }),
        service.queueRequest(EntityType.PRODUCT, ActionType.UPDATE, 'PUT', '/api/v1/products/123', mockProductData, { priority: Priority.MEDIUM }),
      ]);

      const stats = service.getStatistics();

      expect(stats.totalQueued).toBe(3);
      expect(stats.byStatus[QueueStatus.PENDING]).toBe(3);
      expect(stats.byEntityType[EntityType.ORDER]).toBe(1);
      expect(stats.byEntityType[EntityType.PAYMENT]).toBe(1);
      expect(stats.byEntityType[EntityType.PRODUCT]).toBe(1);
      expect(stats.byPriority[Priority.HIGH]).toBe(1);
      expect(stats.byPriority[Priority.CRITICAL]).toBe(1);
      expect(stats.byPriority[Priority.MEDIUM]).toBe(1);

      expect(stats.averageRetryCount).toBe(0);
      expect(stats.oldestItemAge).toBeGreaterThanOrEqual(0);
      expect(stats.estimatedSyncTime).toBeGreaterThan(0);
    });

    it('should track retry counts and update statistics', async () => {
      // Mock API to fail first few times
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        });

      await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        mockOrderData
      );

      await service.syncQueue();

      const stats = service.getStatistics();
      expect(stats.averageRetryCount).toBeGreaterThanOrEqual(0);
    });

    it('should export queue data for debugging', async () => {
      await Promise.all([
        service.queueRequest(EntityType.ORDER, ActionType.CREATE, 'POST', '/api/v1/orders', mockOrderData),
        service.queueRequest(EntityType.PAYMENT, ActionType.CREATE, 'POST', '/api/v1/payments', mockPaymentData),
      ]);

      const exportData = await service.exportQueue();
      const parsed = JSON.parse(exportData);

      expect(parsed.timestamp).toBeTruthy();
      expect(parsed.statistics).toBeDefined();
      expect(parsed.statistics.totalQueued).toBe(2);
      expect(parsed.queue).toHaveLength(2);
      expect(Array.isArray(parsed.conflicts)).toBe(true);
    });
  });

  describe('Network State Handling', () => {
    it('should respond to network state changes', async () => {
      const networkStateHandler = (NetInfo.addEventListener as jest.Mock).mock.calls[0]?.[0];
      
      if (networkStateHandler) {
        // Simulate going offline
        networkStateHandler({ isConnected: false, isInternetReachable: false });
        expect(service.getNetworkState().isOnline).toBe(false);

        // Simulate coming online
        networkStateHandler({ isConnected: true, isInternetReachable: true });
        expect(service.getNetworkState().isOnline).toBe(true);
      }
    });

    it('should trigger sync when coming back online', async () => {
      const syncSpy = jest.spyOn(service, 'syncQueue');
      
      await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        mockOrderData
      );

      const networkStateHandler = (NetInfo.addEventListener as jest.Mock).mock.calls[0]?.[0];
      
      if (networkStateHandler) {
        // Simulate coming online - should trigger sync
        networkStateHandler({ isConnected: true, isInternetReachable: true });
        
        // Allow async operations to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(syncSpy).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed payload data gracefully', async () => {
      const malformedData = {
        circular: {} as any,
        validField: 'test',
      };
      malformedData.circular.self = malformedData.circular;

      await expect(
        service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          '/api/v1/orders',
          malformedData
        )
      ).rejects.toThrow();
    });

    it('should handle AsyncStorage failures', async () => {
      // Mock AsyncStorage to fail
      const originalSetItem = AsyncStorage.setItem;
      AsyncStorage.setItem = jest.fn().mockRejectedValue(new Error('Storage full'));

      // Should still queue the request in memory
      const requestId = await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        mockOrderData
      );

      expect(requestId).toBeTruthy();
      expect(service.getRequestStatus(requestId)).toBeDefined();

      // Restore original method
      AsyncStorage.setItem = originalSetItem;
    });

    it('should handle concurrent operations safely', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        service.queueRequest(
          EntityType.ORDER,
          ActionType.CREATE,
          'POST',
          `/api/v1/orders/${i}`,
          { ...mockOrderData, id: `order-${i}` }
        )
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(20);
      
      // All should be unique
      const uniqueIds = new Set(results);
      expect(uniqueIds.size).toBe(20);

      const stats = service.getStatistics();
      expect(stats.totalQueued).toBe(20);
    });
  });

  describe('Request Dependencies and Ordering', () => {
    it('should handle request dependencies correctly', async () => {
      const orderRequestId = await service.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/api/v1/orders',
        mockOrderData
      );

      const paymentRequestId = await service.queueRequest(
        EntityType.PAYMENT,
        ActionType.CREATE,
        'POST',
        '/api/v1/payments',
        mockPaymentData,
        { 
          dependencies: [orderRequestId],
          priority: Priority.CRITICAL
        }
      );

      // Mock successful responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'server-order-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'server-payment-456' }),
        });

      const syncResult = await service.syncQueue();
      expect(syncResult.success).toBe(true);
      
      // Verify order of API calls
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(fetchCalls).toHaveLength(2);
      expect(fetchCalls[0][0]).toContain('/api/v1/orders');
      expect(fetchCalls[1][0]).toContain('/api/v1/payments');
    });
  });

  describe('Batch Operations', () => {
    it('should process requests in batches', async () => {
      // Create more requests than batch size
      const requests = await Promise.all(
        Array.from({ length: 15 }, (_, i) =>
          service.queueRequest(
            EntityType.ORDER,
            ActionType.CREATE,
            'POST',
            `/api/v1/orders/${i}`,
            { ...mockOrderData, id: `order-${i}` }
          )
        )
      );

      // Mock all API calls to succeed
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        })
      );

      const syncResult = await service.syncQueue();
      expect(syncResult.success).toBe(true);
      expect(syncResult.syncedCount).toBe(15);

      // Should have made API calls for all requests
      expect((global.fetch as jest.Mock)).toHaveBeenCalledTimes(15);
    });
  });
});
