/**
 * useSyncStatus - React hook for monitoring offline queue and sync status
 * Provides real-time updates on queue size, sync progress, and network state
 */

import { useEffect, useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { 
  offlineQueueService,
  type QueueStatistics,
  type SyncResult,
  type QueueStatus
} from '../services/offline';
import { logger } from '../utils/logger';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queueSize: number;
  failedCount: number;
  conflictCount: number;
  oldestItemAge: number | null;
  estimatedSyncTime: number | null;
  lastSyncTime: Date | null;
  lastSyncResult: SyncResult | null;
  statistics: QueueStatistics | null;
  canSync: boolean;
}

export interface UseSyncStatusReturn extends SyncStatus {
  triggerSync: () => Promise<void>;
  clearQueue: () => Promise<void>;
  retryFailed: () => Promise<void>;
}

/**
 * Hook to monitor and control offline queue sync status
 */
export const useSyncStatus = (): UseSyncStatusReturn => {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    queueSize: 0,
    failedCount: 0,
    conflictCount: 0,
    oldestItemAge: null,
    estimatedSyncTime: null,
    lastSyncTime: null,
    lastSyncResult: null,
    statistics: null,
    canSync: false,
  });

  // Update status from queue statistics
  const updateStatus = useCallback(() => {
    try {
      const stats = offlineQueueService.getStatistics();
      
      // Get network and sync state - these methods might not exist yet
      // so we provide fallbacks
      const isOnline = offlineQueueService.getNetworkState?.()?.isOnline ?? status.isOnline;
      const isSyncing = offlineQueueService.getSyncState?.()?.isSyncing ?? false;
      
      setStatus(prev => ({
        ...prev,
        isOnline,
        isSyncing,
        queueSize: stats.totalQueued || 0,
        failedCount: stats.byStatus?.failed || 0,
        conflictCount: stats.byStatus?.conflict || 0,
        oldestItemAge: stats.oldestItemAge > 0 ? stats.oldestItemAge : null,
        estimatedSyncTime: stats.estimatedSyncTime > 0 ? stats.estimatedSyncTime : null,
        statistics: stats,
        canSync: isOnline && !isSyncing && (stats.totalQueued || 0) > 0,
      }));
    } catch (error) {
      logger.error('Failed to update sync status', error);
    }
  }, [status.isOnline]);

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    try {
      logger.info('Manual sync triggered');
      setStatus(prev => ({ ...prev, isSyncing: true }));
      
      const result = await offlineQueueService.syncQueue();
      
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        lastSyncResult: result,
      }));
      
      // Update stats after sync
      updateStatus();
      
      logger.info('Manual sync completed', result);
    } catch (error) {
      logger.error('Manual sync failed', error);
      setStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [updateStatus]);

  // Clear the entire queue
  const clearQueue = useCallback(async () => {
    try {
      logger.info('Clearing offline queue');
      // This method might not exist yet, so we check
      if (offlineQueueService.clearQueue) {
        await offlineQueueService.clearQueue();
      } else {
        logger.warn('clearQueue method not available on offlineQueueService');
      }
      updateStatus();
    } catch (error) {
      logger.error('Failed to clear queue', error);
    }
  }, [updateStatus]);

  // Retry all failed items
  const retryFailed = useCallback(async () => {
    try {
      logger.info('Retrying failed items');
      // This method might not exist yet, so we check
      if (offlineQueueService.retryFailed) {
        await offlineQueueService.retryFailed();
      } else if (offlineQueueService.retryFailedRequests) {
        await offlineQueueService.retryFailedRequests();
      } else {
        // Fallback: trigger a normal sync
        await offlineQueueService.syncQueue();
      }
      updateStatus();
    } catch (error) {
      logger.error('Failed to retry failed items', error);
    }
  }, [updateStatus]);

  // Setup listeners
  useEffect(() => {
    // Initial status update
    updateStatus();

    // Set up polling interval for queue stats
    const interval = setInterval(updateStatus, 2000); // Update every 2 seconds

    // Listen to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      setStatus(prev => ({ ...prev, isOnline: state.isConnected ?? false }));
      updateStatus();
    });

    // Event listeners - these may not exist in the current implementation
    // so we use optional chaining
    const syncStartListener = offlineQueueService.on?.('syncStart', () => {
      setStatus(prev => ({ ...prev, isSyncing: true }));
    });

    const syncCompleteListener = offlineQueueService.on?.('syncComplete', (result: SyncResult) => {
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        lastSyncResult: result,
      }));
      updateStatus();
    });

    const queueChangeListener = offlineQueueService.on?.('queueChange', () => {
      updateStatus();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
      // Clean up event listeners if they exist
      if (syncStartListener && typeof syncStartListener === 'function') {
        offlineQueueService.off?.('syncStart', syncStartListener);
      }
      if (syncCompleteListener && typeof syncCompleteListener === 'function') {
        offlineQueueService.off?.('syncComplete', syncCompleteListener);
      }
      if (queueChangeListener && typeof queueChangeListener === 'function') {
        offlineQueueService.off?.('queueChange', queueChangeListener);
      }
    };
  }, [updateStatus]);

  return {
    ...status,
    triggerSync,
    clearQueue,
    retryFailed,
  };
};

/**
 * Hook to get a simple online/offline status
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [networkType, setNetworkType] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
      setNetworkType(state.type);
    });

    // Get initial state
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected ?? false);
      setNetworkType(state.type);
    });

    return unsubscribe;
  }, []);

  return { isOnline, networkType };
};
EOF < /dev/null