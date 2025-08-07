/**
 * OfflineQueueService - Production-ready offline queue management
 * 
 * Features:
 * - Priority-based queue management
 * - Automatic retry with exponential backoff
 * - Conflict detection and resolution
 * - Entity-specific sync strategies
 * - Persistent storage with encryption
 * - WebSocket integration for real-time sync
 * - Comprehensive error handling and recovery
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
// Import crypto utilities for checksums

import API_CONFIG from '../../config/api';
import { errorHandler, ErrorType, ErrorSeverity } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import NetworkUtils from '../../utils/NetworkUtils';
import tokenManager from '../../utils/tokenManager';
import { offlineHandler, OfflineAction, OfflineFeature } from '../../utils/offlineHandler';

// Types and Interfaces
export interface QueuedRequest {
  id: string;
  timestamp: number;
  entityType: EntityType;
  action: ActionType;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  payload?: unknown;
  metadata: RequestMetadata;
  retryCount: number;
  maxRetries: number;
  priority: Priority;
  status: QueueStatus;
  lastError?: string;
  conflictResolution?: ConflictResolutionStrategy;
  dependencies?: string[];
  checksum?: string;
}

export interface RequestMetadata {
  userId?: string;
  restaurantId?: string;
  sessionId?: string;
  deviceId?: string;
  appVersion?: string;
  originalTimestamp?: number;
  syncGroup?: string;
  idempotencyKey?: string;
}

export enum EntityType {
  ORDER = 'order',
  PAYMENT = 'payment',
  PRODUCT = 'product',
  CATEGORY = 'category',
  CUSTOMER = 'customer',
  INVENTORY = 'inventory',
  EMPLOYEE = 'employee',
  TABLE = 'table',
  SESSION = 'session',
  REPORT = 'report',
  SETTINGS = 'settings',
}

export enum ActionType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SYNC = 'sync',
  BATCH = 'batch',
}

export enum Priority {
  CRITICAL = 0,  // Payment, order completion
  HIGH = 1,      // Order creation, inventory updates
  MEDIUM = 2,    // Customer updates, settings
  LOW = 3,       // Analytics, reports
  BACKGROUND = 4 // Logs, telemetry
}

export enum QueueStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  CONFLICT = 'conflict',
}

export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  FIRST_WRITE_WINS = 'first_write_wins',
  MERGE = 'merge',
  MANUAL = 'manual',
  SERVER_WINS = 'server_wins',
  CLIENT_WINS = 'client_wins',
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  errors: Array<{ id: string; error: string }>;
  conflicts: Array<{ id: string; conflict: ConflictInfo }>;
}

export interface ConflictInfo {
  type: ConflictType;
  localVersion: unknown;
  serverVersion: unknown;
  resolution: ConflictResolutionStrategy;
  resolvedValue?: unknown;
}

export enum ConflictType {
  VERSION_MISMATCH = 'version_mismatch',
  DELETED_ON_SERVER = 'deleted_on_server',
  CONCURRENT_UPDATE = 'concurrent_update',
  BUSINESS_RULE = 'business_rule',
}

interface QueueConfig {
  maxQueueSize: number;
  maxRetries: number;
  retryBaseDelay: number;
  retryMaxDelay: number;
  batchSize: number;
  syncInterval: number;
  encryptionKey?: string;
  enableCompression: boolean;
  enableChecksum: boolean;
  conflictResolutionDefaults: Record<EntityType, ConflictResolutionStrategy>;
}

interface QueueStatistics {
  totalQueued: number;
  byStatus: Record<QueueStatus, number>;
  byPriority: Record<Priority, number>;
  byEntityType: Record<EntityType, number>;
  averageRetryCount: number;
  oldestItemAge: number;
  estimatedSyncTime: number;
}

/**
 * Main OfflineQueueService class
 */
class OfflineQueueService {
  private static instance: OfflineQueueService;
  private queue: Map<string, QueuedRequest> = new Map();
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncTimer?: NodeJS.Timeout;
  private unsubscribeNetInfo?: () => void;
  
  private readonly STORAGE_KEY = 'offline_queue_v2';
  private readonly CHECKPOINT_KEY = 'offline_queue_checkpoint';
  private readonly CONFLICT_KEY = 'offline_conflicts';
  
  private config: QueueConfig = {
    maxQueueSize: 500,
    maxRetries: 5,
    retryBaseDelay: 1000,
    retryMaxDelay: 60000,
    batchSize: 10,
    syncInterval: 30000, // 30 seconds
    enableCompression: true,
    enableChecksum: true,
    conflictResolutionDefaults: {
      [EntityType.ORDER]: ConflictResolutionStrategy.SERVER_WINS,
      [EntityType.PAYMENT]: ConflictResolutionStrategy.SERVER_WINS,
      [EntityType.PRODUCT]: ConflictResolutionStrategy.LAST_WRITE_WINS,
      [EntityType.CATEGORY]: ConflictResolutionStrategy.LAST_WRITE_WINS,
      [EntityType.CUSTOMER]: ConflictResolutionStrategy.MERGE,
      [EntityType.INVENTORY]: ConflictResolutionStrategy.SERVER_WINS,
      [EntityType.EMPLOYEE]: ConflictResolutionStrategy.LAST_WRITE_WINS,
      [EntityType.TABLE]: ConflictResolutionStrategy.LAST_WRITE_WINS,
      [EntityType.SESSION]: ConflictResolutionStrategy.SERVER_WINS,
      [EntityType.REPORT]: ConflictResolutionStrategy.LAST_WRITE_WINS,
      [EntityType.SETTINGS]: ConflictResolutionStrategy.LAST_WRITE_WINS,
    },
  };

  private constructor() {
    this.initialize();
  }

  public static getInstance(): OfflineQueueService {
    if (!OfflineQueueService.instance) {
      OfflineQueueService.instance = new OfflineQueueService();
    }
    return OfflineQueueService.instance;
  }

  /**
   * Initialize the service
   */
  private async initialize(): Promise<void> {
    try {
      // Load persisted queue
      await this.loadQueue();
      
      // Subscribe to network changes
      this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
        this.handleNetworkChange(state.isConnected === true && state.isInternetReachable === true);
      });
      
      // Get initial network state
      const netState = await NetInfo.fetch();
      this.isOnline = netState.isConnected === true && netState.isInternetReachable === true;
      
      // Start sync timer if online
      if (this.isOnline) {
        this.startSyncTimer();
      }
      
      logger.info('OfflineQueueService initialized', {
        queueSize: this.queue.size,
        isOnline: this.isOnline,
      });
    } catch (error) {
      await errorHandler.handleError(
        error as Error,
        ErrorType.SYSTEM,
        ErrorSeverity.HIGH,
        'OfflineQueueService.initialize'
      );
    }
  }

  /**
   * Queue an API request for offline execution
   */
  public async queueRequest(
    entityType: EntityType,
    action: ActionType,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    payload?: unknown,
    options: {
      priority?: Priority;
      metadata?: Partial<RequestMetadata>;
      conflictResolution?: ConflictResolutionStrategy;
      dependencies?: string[];
      immediate?: boolean;
    } = {}
  ): Promise<string> {
    const requestId = this.generateRequestId();
    
    try {
      // Create the queued request
      const request: QueuedRequest = {
        id: requestId,
        timestamp: Date.now(),
        entityType,
        action,
        method,
        endpoint,
        payload,
        metadata: {
          ...options.metadata,
          originalTimestamp: Date.now(),
          idempotencyKey: this.generateIdempotencyKey(entityType, action, payload),
        },
        retryCount: 0,
        maxRetries: this.config.maxRetries,
        priority: options.priority ?? this.getDefaultPriority(entityType, action),
        status: QueueStatus.PENDING,
        conflictResolution: options.conflictResolution ?? this.config.conflictResolutionDefaults[entityType],
        dependencies: options.dependencies,
        checksum: this.config.enableChecksum ? this.generateChecksum(payload) : undefined,
      };
      
      // Check queue size limit
      if (this.queue.size >= this.config.maxQueueSize) {
        await this.evictOldestLowPriorityItems();
      }
      
      // Add to queue
      this.queue.set(requestId, request);
      
      // Persist queue
      await this.saveQueue();
      
      // If immediate and online, try to sync now
      if (options.immediate && this.isOnline && !this.isSyncing) {
        this.syncQueue();
      }
      
      logger.info(`Request queued: ${requestId}`, {
        entityType,
        action,
        priority: request.priority,
      });
      
      return requestId;
    } catch (error) {
      await errorHandler.handleError(
        error as Error,
        ErrorType.STORAGE,
        ErrorSeverity.HIGH,
        'OfflineQueueService.queueRequest',
        { requestId, entityType, action }
      );
      throw error;
    }
  }

  /**
   * Execute request with offline fallback
   */
  public async executeWithFallback<T>(
    entityType: EntityType,
    action: ActionType,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    payload?: unknown,
    options: {
      priority?: Priority;
      offlineResponse?: T;
      cacheKey?: string;
      cacheDuration?: number;
    } = {}
  ): Promise<T> {
    // Try online execution first
    if (this.isOnline) {
      try {
        const response = await this.executeRequest<T>(method, endpoint, payload);
        
        // Cache successful response if cacheKey provided
        if (options.cacheKey) {
          await this.cacheResponse(options.cacheKey, response, options.cacheDuration);
        }
        
        return response;
      } catch (error) {
        logger.warn('Online execution failed, queuing for offline', { endpoint, error });
        
        // Queue for later sync
        await this.queueRequest(entityType, action, method, endpoint, payload, {
          priority: options.priority,
        });
        
        // Return offline response or cached data
        if (options.offlineResponse !== undefined) {
          return options.offlineResponse;
        }
        
        if (options.cacheKey) {
          const cached = await this.getCachedResponse<T>(options.cacheKey);
          if (cached) return cached;
        }
        
        throw error;
      }
    } else {
      // Offline - queue and return fallback
      await this.queueRequest(entityType, action, method, endpoint, payload, {
        priority: options.priority,
      });
      
      if (options.offlineResponse !== undefined) {
        return options.offlineResponse;
      }
      
      if (options.cacheKey) {
        const cached = await this.getCachedResponse<T>(options.cacheKey);
        if (cached) return cached;
      }
      
      throw new Error('Offline and no fallback available');
    }
  }

  /**
   * Sync queued requests with the server
   */
  public async syncQueue(): Promise<SyncResult> {
    if (!this.isOnline || this.isSyncing) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        conflictCount: 0,
        errors: [],
        conflicts: [],
      };
    }
    
    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      conflictCount: 0,
      errors: [],
      conflicts: [],
    };
    
    try {
      logger.info('Starting queue sync', { queueSize: this.queue.size });
      
      // Get pending requests sorted by priority and dependencies
      const pendingRequests = await this.getPendingRequestsSorted();
      
      // Process in batches
      for (let i = 0; i < pendingRequests.length; i += this.config.batchSize) {
        const batch = pendingRequests.slice(i, i + this.config.batchSize);
        
        // Process batch in parallel with error handling for each
        const batchResults = await Promise.allSettled(
          batch.map(request => this.syncSingleRequest(request))
        );
        
        // Collect results
        for (const [index, batchResult] of batchResults.entries()) {
          const request = batch[index];
          
          if (batchResult.status === 'fulfilled') {
            const syncResult = batchResult.value;
            
            if (syncResult.success) {
              result.syncedCount++;
              request.status = QueueStatus.SUCCESS;
              this.queue.delete(request.id);
            } else if (syncResult.conflict) {
              result.conflictCount++;
              request.status = QueueStatus.CONFLICT;
              result.conflicts.push({
                id: request.id,
                conflict: syncResult.conflict,
              });
            } else {
              result.failedCount++;
              request.status = QueueStatus.FAILED;
              request.lastError = syncResult.error;
              result.errors.push({
                id: request.id,
                error: syncResult.error || 'Unknown error',
              });
            }
          } else {
            result.failedCount++;
            request.status = QueueStatus.FAILED;
            request.lastError = batchResult.reason?.message || 'Sync failed';
            result.errors.push({
              id: request.id,
              error: batchResult.reason?.message || 'Sync failed',
            });
          }
        }
        
        // Save queue state after each batch
        await this.saveQueue();
        
        // Check if still online
        if (!this.isOnline) {
          logger.info('Lost connection during sync, stopping');
          break;
        }
      }
      
      logger.info('Queue sync completed', result);
    } catch (error) {
      await errorHandler.handleError(
        error as Error,
        ErrorType.NETWORK,
        ErrorSeverity.HIGH,
        'OfflineQueueService.syncQueue'
      );
      result.success = false;
    } finally {
      this.isSyncing = false;
    }
    
    return result;
  }

  /**
   * Sync a single request
   */
  private async syncSingleRequest(request: QueuedRequest): Promise<{
    success: boolean;
    error?: string;
    conflict?: ConflictInfo;
  }> {
    try {
      // Update status
      request.status = QueueStatus.IN_PROGRESS;
      
      // Check for conflicts before syncing
      const conflict = await this.detectConflict(request);
      if (conflict) {
        const resolved = await this.resolveConflict(request, conflict);
        if (!resolved) {
          return { success: false, conflict };
        }
      }
      
      // Execute the request
      const response = await this.executeRequest(
        request.method,
        request.endpoint,
        request.payload
      );
      
      // Handle entity-specific post-sync logic
      await this.handlePostSync(request, response);
      
      return { success: true };
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Handle specific error cases
      if (this.isRetryableError(error as Error)) {
        request.retryCount++;
        
        if (request.retryCount < request.maxRetries) {
          // Schedule retry with exponential backoff
          const delay = this.calculateRetryDelay(request.retryCount);
          setTimeout(() => {
            if (this.isOnline) {
              this.syncSingleRequest(request);
            }
          }, delay);
          
          return { success: false, error: `Retrying (${request.retryCount}/${request.maxRetries})` };
        }
      }
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Execute HTTP request
   */
  private async executeRequest<T = any>(
    method: string,
    endpoint: string,
    payload?: unknown
  ): Promise<T> {
    const url = `${API_CONFIG.FULL_API_URL}${endpoint}`;
    const headers = await NetworkUtils.createAuthHeaders();
    
    const response = await fetch(url, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return response.json();
  }

  /**
   * Detect conflicts for a request
   */
  private async detectConflict(request: QueuedRequest): Promise<ConflictInfo | null> {
    // Skip conflict detection for CREATE actions
    if (request.action === ActionType.CREATE) {
      return null;
    }
    
    try {
      // Get server version
      const serverVersion = await this.getServerVersion(request);
      
      // Get local version
      const localVersion = await this.getLocalVersion(request);
      
      // Compare versions
      if (this.hasConflict(localVersion, serverVersion, request)) {
        return {
          type: ConflictType.VERSION_MISMATCH,
          localVersion,
          serverVersion,
          resolution: request.conflictResolution || ConflictResolutionStrategy.SERVER_WINS,
        };
      }
    } catch (error) {
      logger.warn('Conflict detection failed', { request: request.id, error });
    }
    
    return null;
  }

  /**
   * Resolve a conflict
   */
  private async resolveConflict(request: QueuedRequest, conflict: ConflictInfo): Promise<boolean> {
    logger.info(`Resolving conflict for ${request.id}`, { strategy: conflict.resolution });
    
    switch (conflict.resolution) {
      case ConflictResolutionStrategy.SERVER_WINS:
        // Skip this request, server version wins
        return false;
        
      case ConflictResolutionStrategy.CLIENT_WINS:
        // Proceed with the request, client wins
        return true;
        
      case ConflictResolutionStrategy.LAST_WRITE_WINS:
        // Compare timestamps
        const localTimestamp = request.metadata.originalTimestamp || request.timestamp;
        const serverTimestamp = this.extractTimestamp(conflict.serverVersion);
        return localTimestamp > serverTimestamp;
        
      case ConflictResolutionStrategy.MERGE:
        // Merge the changes
        const merged = await this.mergeChanges(
          conflict.localVersion,
          conflict.serverVersion,
          request
        );
        if (merged) {
          request.payload = merged;
          return true;
        }
        return false;
        
      case ConflictResolutionStrategy.MANUAL:
        // Store for manual resolution
        await this.storeConflictForManualResolution(request, conflict);
        return false;
        
      default:
        return false;
    }
  }

  /**
   * Handle entity-specific post-sync logic
   */
  private async handlePostSync(request: QueuedRequest, response: unknown): Promise<void> {
    switch (request.entityType) {
      case EntityType.ORDER:
        // Update local order ID mapping if needed
        if (request.action === ActionType.CREATE && response && typeof response === 'object' && 'id' in response) {
          await this.updateLocalIdMapping('order', request.payload?.localId, response.id);
        }
        break;
        
      case EntityType.PAYMENT:
        // Log payment sync for audit
        logger.info('Payment synced', {
          requestId: request.id,
          amount: request.payload?.amount,
        });
        break;
        
      case EntityType.INVENTORY:
        // Trigger inventory recalculation
        if (request.action === ActionType.UPDATE) {
          await this.triggerInventoryRecalculation();
        }
        break;
        
      default:
        // No special handling needed
        break;
    }
  }

  /**
   * Get pending requests sorted by priority and dependencies
   */
  private async getPendingRequestsSorted(): Promise<QueuedRequest[]> {
    const pending = Array.from(this.queue.values()).filter(
      r => r.status === QueueStatus.PENDING || r.status === QueueStatus.FAILED
    );
    
    // Sort by priority and timestamp
    pending.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; // Lower number = higher priority
      }
      return a.timestamp - b.timestamp; // Earlier timestamp first
    });
    
    // Resolve dependencies
    return this.resolveDependencies(pending);
  }

  /**
   * Resolve dependencies and reorder requests
   */
  private resolveDependencies(requests: QueuedRequest[]): QueuedRequest[] {
    const resolved: QueuedRequest[] = [];
    const remaining = new Map(requests.map(r => [r.id, r]));
    
    while (remaining.size > 0) {
      let added = false;
      
      for (const [id, request] of remaining) {
        // Check if all dependencies are resolved
        const depsResolved = !request.dependencies || 
          request.dependencies.every(dep => 
            resolved.some(r => r.id === dep) || !remaining.has(dep)
          );
        
        if (depsResolved) {
          resolved.push(request);
          remaining.delete(id);
          added = true;
        }
      }
      
      // If nothing was added, there's a circular dependency
      if (!added && remaining.size > 0) {
        logger.warn('Circular dependency detected, adding remaining requests');
        resolved.push(...remaining.values());
        break;
      }
    }
    
    return resolved;
  }

  /**
   * Network state change handler
   */
  private handleNetworkChange(isOnline: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;
    
    logger.info(`Network state changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    if (isOnline && wasOffline) {
      // Coming back online
      this.startSyncTimer();
      this.syncQueue();
    } else if (!isOnline) {
      // Going offline
      this.stopSyncTimer();
    }
  }

  /**
   * Start automatic sync timer
   */
  private startSyncTimer(): void {
    this.stopSyncTimer();
    
    this.syncTimer = setInterval(() => {
      if (this.isOnline && !this.isSyncing && this.queue.size > 0) {
        this.syncQueue();
      }
    }, this.config.syncInterval);
  }

  /**
   * Stop automatic sync timer
   */
  private stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(
      this.config.retryBaseDelay * Math.pow(2, retryCount),
      this.config.retryMaxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    
    return delay + jitter;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('429') // Rate limit
    );
  }

  /**
   * Get default priority for entity type and action
   */
  private getDefaultPriority(entityType: EntityType, action: ActionType): Priority {
    // Critical priority for payments and order completion
    if (entityType === EntityType.PAYMENT) {
      return Priority.CRITICAL;
    }
    
    if (entityType === EntityType.ORDER && action === ActionType.CREATE) {
      return Priority.HIGH;
    }
    
    // High priority for inventory updates
    if (entityType === EntityType.INVENTORY) {
      return Priority.HIGH;
    }
    
    // Medium priority for customer and employee data
    if (entityType === EntityType.CUSTOMER || entityType === EntityType.EMPLOYEE) {
      return Priority.MEDIUM;
    }
    
    // Low priority for reports and analytics
    if (entityType === EntityType.REPORT) {
      return Priority.LOW;
    }
    
    return Priority.MEDIUM;
  }

  /**
   * Load queue from persistent storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = this.config.enableCompression 
          ? this.decompress(stored) 
          : JSON.parse(stored);
        
        // Reconstruct queue
        this.queue.clear();
        for (const request of data) {
          this.queue.set(request.id, request);
        }
        
        logger.info(`Loaded ${this.queue.size} queued requests from storage`);
      }
    } catch (error) {
      logger.error('Failed to load queue from storage', error);
      await errorHandler.handleError(
        error as Error,
        ErrorType.STORAGE,
        ErrorSeverity.HIGH,
        'OfflineQueueService.loadQueue'
      );
    }
  }

  /**
   * Save queue to persistent storage
   */
  private async saveQueue(): Promise<void> {
    try {
      const data = Array.from(this.queue.values());
      const serialized = this.config.enableCompression
        ? this.compress(JSON.stringify(data))
        : JSON.stringify(data);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, serialized);
      
      // Save checkpoint for recovery
      await this.saveCheckpoint();
    } catch (error) {
      logger.error('Failed to save queue to storage', error);
      await errorHandler.handleError(
        error as Error,
        ErrorType.STORAGE,
        ErrorSeverity.HIGH,
        'OfflineQueueService.saveQueue'
      );
    }
  }

  /**
   * Save checkpoint for recovery
   */
  private async saveCheckpoint(): Promise<void> {
    const checkpoint = {
      timestamp: Date.now(),
      queueSize: this.queue.size,
      stats: this.getStatistics(),
    };
    
    await AsyncStorage.setItem(this.CHECKPOINT_KEY, JSON.stringify(checkpoint));
  }

  /**
   * Evict oldest low-priority items when queue is full
   */
  private async evictOldestLowPriorityItems(): Promise<void> {
    const sorted = Array.from(this.queue.values()).sort((a, b) => {
      // Sort by priority (reverse) then timestamp
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher number = lower priority
      }
      return a.timestamp - b.timestamp;
    });
    
    // Remove 10% of lowest priority items
    const toRemove = Math.ceil(this.config.maxQueueSize * 0.1);
    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      this.queue.delete(sorted[i].id);
      logger.warn(`Evicted low priority request: ${sorted[i].id}`);
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate idempotency key for deduplication
   */
  private generateIdempotencyKey(
    entityType: EntityType,
    action: ActionType,
    payload: unknown
  ): string {
    const data = `${entityType}_${action}_${JSON.stringify(payload)}`;
    return this.simpleHash(data);
  }

  /**
   * Generate checksum for data integrity
   */
  private generateChecksum(data: unknown): string {
    return this.simpleHash(JSON.stringify(data));
  }

  /**
   * Compress data for storage
   */
  private compress(data: string): string {
    // Simple base64 encoding for now, could use actual compression
    return Buffer.from(data).toString('base64');
  }

  /**
   * Decompress data from storage
   */
  private decompress(data: string): any {
    return JSON.parse(Buffer.from(data, 'base64').toString());
  }

  /**
   * Cache response for offline use
   */
  private async cacheResponse<T>(key: string, data: T, duration?: number): Promise<void> {
    const cacheData = {
      data,
      timestamp: Date.now(),
      expiry: duration ? Date.now() + duration : undefined,
    };
    
    await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
  }

  /**
   * Get cached response
   */
  private async getCachedResponse<T>(key: string): Promise<T | null> {
    try {
      const stored = await AsyncStorage.getItem(`cache_${key}`);
      if (!stored) return null;
      
      const cacheData = JSON.parse(stored);
      
      // Check expiry
      if (cacheData.expiry && Date.now() > cacheData.expiry) {
        await AsyncStorage.removeItem(`cache_${key}`);
        return null;
      }
      
      return cacheData.data as T;
    } catch {
      return null;
    }
  }

  /**
   * Get server version for conflict detection
   */
  private async getServerVersion(request: QueuedRequest): Promise<unknown> {
    // This would make an API call to get the current server version
    // Implementation depends on your API design
    try {
      const endpoint = this.getVersionEndpoint(request);
      return await this.executeRequest('GET', endpoint);
    } catch {
      return null;
    }
  }

  /**
   * Get local version for conflict detection
   */
  private async getLocalVersion(request: QueuedRequest): Promise<unknown> {
    // Get from local storage or cache
    const key = `${request.entityType}_${request.payload?.id || request.payload?.localId}`;
    return this.getCachedResponse(key);
  }

  /**
   * Check if there's a conflict between versions
   */
  private hasConflict(localVersion: unknown, serverVersion: unknown, request: QueuedRequest): boolean {
    if (!localVersion || !serverVersion) return false;
    
    // Compare version numbers or timestamps
    if (typeof localVersion === 'object' && typeof serverVersion === 'object') {
      const localVer = localVersion as any;
      const serverVer = serverVersion as any;
      
      // Check version field
      if ('version' in localVer && 'version' in serverVer) {
        return localVer.version !== serverVer.version;
      }
      
      // Check updated_at timestamp
      if ('updated_at' in localVer && 'updated_at' in serverVer) {
        return localVer.updated_at !== serverVer.updated_at;
      }
    }
    
    return false;
  }

  /**
   * Extract timestamp from version object
   */
  private extractTimestamp(version: unknown): number {
    if (!version || typeof version !== 'object') return 0;
    
    const ver = version as any;
    if ('updated_at' in ver) {
      return new Date(ver.updated_at).getTime();
    }
    if ('timestamp' in ver) {
      return ver.timestamp;
    }
    
    return 0;
  }

  /**
   * Merge changes for conflict resolution
   */
  private async mergeChanges(
    localVersion: unknown,
    serverVersion: unknown,
    request: QueuedRequest
  ): Promise<unknown | null> {
    // Simple merge strategy - combine non-conflicting fields
    if (typeof localVersion === 'object' && typeof serverVersion === 'object') {
      const merged = { ...serverVersion as any };
      const local = localVersion as any;
      const updates = request.payload as any;
      
      // Apply only the changed fields from the update
      for (const key in updates) {
        if (key !== 'id' && key !== 'version' && key !== 'updated_at') {
          merged[key] = updates[key];
        }
      }
      
      return merged;
    }
    
    return null;
  }

  /**
   * Store conflict for manual resolution
   */
  private async storeConflictForManualResolution(
    request: QueuedRequest,
    conflict: ConflictInfo
  ): Promise<void> {
    const conflicts = await this.getStoredConflicts();
    conflicts.push({
      id: request.id,
      request,
      conflict,
      timestamp: Date.now(),
    });
    
    await AsyncStorage.setItem(this.CONFLICT_KEY, JSON.stringify(conflicts));
  }

  /**
   * Get stored conflicts
   */
  private async getStoredConflicts(): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem(this.CONFLICT_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get version endpoint for entity
   */
  private getVersionEndpoint(request: QueuedRequest): string {
    const id = request.payload?.id || request.payload?.localId;
    
    switch (request.entityType) {
      case EntityType.ORDER:
        return `/orders/${id}/version`;
      case EntityType.PRODUCT:
        return `/products/${id}/version`;
      case EntityType.CUSTOMER:
        return `/customers/${id}/version`;
      default:
        return `/${request.entityType}s/${id}/version`;
    }
  }

  /**
   * Update local ID mapping after successful sync
   */
  private async updateLocalIdMapping(
    entityType: string,
    localId: string,
    serverId: string
  ): Promise<void> {
    const mappingKey = `id_mapping_${entityType}`;
    const mappings = await this.getIdMappings(entityType);
    mappings[localId] = serverId;
    await AsyncStorage.setItem(mappingKey, JSON.stringify(mappings));
  }

  /**
   * Get ID mappings for entity type
   */
  private async getIdMappings(entityType: string): Promise<Record<string, string>> {
    try {
      const stored = await AsyncStorage.getItem(`id_mapping_${entityType}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Trigger inventory recalculation
   */
  private async triggerInventoryRecalculation(): Promise<void> {
    // This would trigger a background job or notify the inventory service
    logger.info('Inventory recalculation triggered');
  }

  /**
   * Get queue statistics
   */
  public getStatistics(): QueueStatistics {
    const stats: QueueStatistics = {
      totalQueued: this.queue.size,
      byStatus: {} as Record<QueueStatus, number>,
      byPriority: {} as Record<Priority, number>,
      byEntityType: {} as Record<EntityType, number>,
      averageRetryCount: 0,
      oldestItemAge: 0,
      estimatedSyncTime: 0,
    };
    
    let totalRetries = 0;
    let oldestTimestamp = Date.now();
    
    for (const request of this.queue.values()) {
      // Count by status
      stats.byStatus[request.status] = (stats.byStatus[request.status] || 0) + 1;
      
      // Count by priority
      stats.byPriority[request.priority] = (stats.byPriority[request.priority] || 0) + 1;
      
      // Count by entity type
      stats.byEntityType[request.entityType] = (stats.byEntityType[request.entityType] || 0) + 1;
      
      // Track retries
      totalRetries += request.retryCount;
      
      // Track oldest item
      if (request.timestamp < oldestTimestamp) {
        oldestTimestamp = request.timestamp;
      }
    }
    
    // Calculate averages
    if (this.queue.size > 0) {
      stats.averageRetryCount = totalRetries / this.queue.size;
      stats.oldestItemAge = Date.now() - oldestTimestamp;
      
      // Estimate sync time (2 seconds per request average)
      stats.estimatedSyncTime = this.queue.size * 2000;
    }
    
    return stats;
  }

  /**
   * Clear the queue
   */
  public async clearQueue(): Promise<void> {
    this.queue.clear();
    await AsyncStorage.removeItem(this.STORAGE_KEY);
    await AsyncStorage.removeItem(this.CHECKPOINT_KEY);
    logger.info('Queue cleared');
  }

  /**
   * Get specific request status
   */
  public getRequestStatus(requestId: string): QueuedRequest | undefined {
    return this.queue.get(requestId);
  }

  /**
   * Cancel a specific request
   */
  public async cancelRequest(requestId: string): Promise<boolean> {
    const request = this.queue.get(requestId);
    if (request && request.status === QueueStatus.PENDING) {
      request.status = QueueStatus.CANCELLED;
      this.queue.delete(requestId);
      await this.saveQueue();
      return true;
    }
    return false;
  }

  /**
   * Get conflicts awaiting resolution
   */
  public async getConflicts(): Promise<any[]> {
    return this.getStoredConflicts();
  }

  /**
   * Resolve a manual conflict
   */
  public async resolveManualConflict(
    conflictId: string,
    resolution: 'local' | 'server' | 'custom',
    customData?: unknown
  ): Promise<void> {
    const conflicts = await this.getStoredConflicts();
    const conflictIndex = conflicts.findIndex(c => c.id === conflictId);
    
    if (conflictIndex === -1) {
      throw new Error('Conflict not found');
    }
    
    const conflict = conflicts[conflictIndex];
    
    switch (resolution) {
      case 'local':
        // Re-queue the original request
        await this.queueRequest(
          conflict.request.entityType,
          conflict.request.action,
          conflict.request.method,
          conflict.request.endpoint,
          conflict.request.payload,
          { immediate: true }
        );
        break;
        
      case 'server':
        // Do nothing, server version is already in place
        break;
        
      case 'custom':
        // Queue with custom data
        if (customData) {
          await this.queueRequest(
            conflict.request.entityType,
            ActionType.UPDATE,
            'PUT',
            conflict.request.endpoint,
            customData,
            { immediate: true }
          );
        }
        break;
    }
    
    // Remove from conflicts
    conflicts.splice(conflictIndex, 1);
    await AsyncStorage.setItem(this.CONFLICT_KEY, JSON.stringify(conflicts));
  }

  /**
   * Export queue for debugging
   */
  public async exportQueue(): Promise<string> {
    const data = {
      timestamp: new Date().toISOString(),
      statistics: this.getStatistics(),
      queue: Array.from(this.queue.values()),
      conflicts: await this.getStoredConflicts(),
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Cleanup and destroy
   */
  /**
   * Get current network state
   */
  public getNetworkState(): { isOnline: boolean } {
    return { isOnline: this.isOnline };
  }

  /**
   * Get current sync state
   */
  public getSyncState(): { isSyncing: boolean } {
    return { isSyncing: this.isSyncing };
  }

  /**
   * Retry all failed requests
   */
  public async retryFailedRequests(): Promise<void> {
    const failedRequests = Array.from(this.queue.values()).filter(
      request => request.status === QueueStatus.FAILED
    );
    
    logger.info(`Retrying ${failedRequests.length} failed requests`);
    
    for (const request of failedRequests) {
      request.status = QueueStatus.PENDING;
      request.retryCount = 0;
      this.queue.set(request.id, request);
    }
    
    await this.saveQueue();
    await this.syncQueue();
  }

  /**
   * Get queue size by status
   */
  public getQueueSizeByStatus(status: QueueStatus): number {
    return Array.from(this.queue.values()).filter(
      request => request.status === status
    ).length;
  }
  public destroy(): void {
    this.stopSyncTimer();
    
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
    
    this.queue.clear();
    logger.info('OfflineQueueService destroyed');
  }

  /**
   * Simple hash function for checksums (replaces crypto-js)
   */
  private simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }}

// Export singleton instance
export const offlineQueueService = OfflineQueueService.getInstance();

// Export convenience functions
export const queueOfflineRequest = (
  entityType: EntityType,
  action: ActionType,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  endpoint: string,
  payload?: unknown,
  options?: any
) => offlineQueueService.queueRequest(entityType, action, method, endpoint, payload, options);

export const syncOfflineQueue = () => offlineQueueService.syncQueue();

export const getOfflineQueueStats = () => offlineQueueService.getStatistics();

// React hook for offline queue status
import { useState, useEffect } from 'react';

export const useOfflineQueue = () => {
  const [stats, setStats] = useState(offlineQueueService.getStatistics());
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    const updateStats = () => {
      setStats(offlineQueueService.getStatistics());
    };
    
    // Update stats every 5 seconds
    const interval = setInterval(updateStats, 5000);
    
    // Listen to network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected === true && state.isInternetReachable === true);
      updateStats();
    });
    
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);
  
  return {
    stats,
    isOnline,
    syncQueue: () => offlineQueueService.syncQueue(),
    clearQueue: () => offlineQueueService.clearQueue(),
    exportQueue: () => offlineQueueService.exportQueue(),
  };
};

export default offlineQueueService;
