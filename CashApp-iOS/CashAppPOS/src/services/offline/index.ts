/**
 * Offline Services Module
 * Export all offline-related services and utilities
 */

// Export from the new secure implementation with backward-compatible aliases
export {
  // Main service (aliased for backward compatibility)
  secureOfflineQueueService as offlineQueueService,
  SecureOfflineQueueService as OfflineQueueService,

  // Types and enums
  EntityType,
  ActionType,
  Priority,
  QueueStatus,
  ConflictResolutionStrategy,
  ConflictType,

  // React hook (aliased for backward compatibility)
  useSecureOfflineQueue as useOfflineQueue,
} from './SecureOfflineQueueService';

// Re-export types with backward-compatible aliases
export type {
  SecureQueuedRequest as QueuedRequest,
  SecureRequestMetadata as RequestMetadata,
  HttpMethod,
} from './SecureOfflineQueueService';

// Import types for properly typed convenience functions
import type {
  EntityType,
  ActionType,
  HttpMethod,
  Priority,
  ConflictType as _ConflictType,
  ConflictResolutionStrategy as _ConflictResolutionStrategy,
} from './SecureOfflineQueueService';

// Export convenience functions for backward compatibility with proper types
export const queueOfflineRequest = async (
  entityType: EntityType,
  action: ActionType,
  method: HttpMethod,
  endpoint: string,
  payload: unknown,
  options: {
    priority?: Priority;
    restaurantId: string;
    userId: string;
    conflictResolution?: _ConflictResolutionStrategy;
    dependencies?: string[];
    immediate?: boolean;
  }
) => {
  const { secureOfflineQueueService } = await import('./SecureOfflineQueueService');
  return secureOfflineQueueService.queueRequest(
    entityType,
    action,
    method,
    endpoint,
    payload,
    options
  );
};

export const syncOfflineQueue = async (restaurantId?: string) => {
  const { secureOfflineQueueService } = await import('./SecureOfflineQueueService');
  return secureOfflineQueueService.syncQueue(restaurantId);
};

export const getOfflineQueueStats = () => {
  const { secureOfflineQueueService } = require('./SecureOfflineQueueService');
  return secureOfflineQueueService.getStatistics();
};

// Type exports for backward compatibility
export type SyncResult = {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
};

export type ConflictInfo = {
  type: _ConflictType;
  localVersion: unknown;
  serverVersion: unknown;
  resolution: _ConflictResolutionStrategy;
};

export type QueueStatistics = {
  totalQueued: number;
  totalSynced: number;
  totalFailed: number;
  totalEncrypted: number;
  bytesTransferred: number;
  queueSize: number;
  memoryQueueSize: number;
  isOnline: boolean;
  isSyncing: boolean;
};

// Re-export from existing offline handler for backward compatibility
export {
  offlineHandler,
  OfflineAction,
  OfflineConfig,
  OfflineFeature,
  useOfflineStatus,
} from '../../utils/offlineHandler';
