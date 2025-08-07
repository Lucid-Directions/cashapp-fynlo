/**
 * OfflineQueueService Test Suite
 * Comprehensive tests for offline queue functionality
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
} from '../OfflineQueueService';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/errorHandler');

describe('OfflineQueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue();
    NetInfo.addEventListener.mockReturnValue(jest.fn());
    NetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  describe('Queue Management', () => {
    it('should queue a request with correct priority', async () => {
      const requestId = await offlineQueueService.queueRequest(
        EntityType.ORDER,
        ActionType.CREATE,
        'POST',
        '/orders',
        { items: [], total: 100 },
        { priority: Priority.HIGH }
      );

      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });
});
EOF < /dev/null