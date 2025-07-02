/**
 * InventoryOfflineSync - Robust offline-first inventory synchronization
 * Provides conflict resolution, queue management, and seamless online/offline transitions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/lib/types';
import { InventoryItem, StockMovement, Recipe, Order } from '../types';
import * as InventoryApiService from './InventoryApiService';
import { inventoryAuditService } from './InventoryAuditService';
import { inventoryWebSocketService } from './InventoryWebSocketService';

export interface OfflineAction {
  id: string;
  timestamp: number;
  type: OfflineActionType;
  entityType: 'inventory' | 'recipe' | 'order';
  entityId: string;
  action: string;
  data: any;
  metadata: {
    userId: string;
    deviceId: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    retryCount: number;
    maxRetries: number;
    conflictResolution?: 'client_wins' | 'server_wins' | 'merge' | 'manual';
  };
  dependencies?: string[]; // Other action IDs this depends on
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict';
}

export type OfflineActionType = 
  | 'STOCK_UPDATE'
  | 'STOCK_ADJUSTMENT' 
  | 'RECIPE_CREATE'
  | 'RECIPE_UPDATE'
  | 'RECIPE_DELETE'
  | 'ORDER_COMPLETE'
  | 'COST_UPDATE';

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: number;
  pendingActions: number;
  failedActions: number;
  conflictActions: number;
  syncInProgress: boolean;
  estimatedSyncTime?: number;
}

export interface ConflictResolution {
  actionId: string;
  conflictType: 'version_mismatch' | 'concurrent_modification' | 'dependency_missing';
  localData: any;
  serverData: any;
  recommendedResolution: 'client_wins' | 'server_wins' | 'merge';
  userChoice?: 'client_wins' | 'server_wins' | 'merge' | 'skip';
}

export interface SyncResult {
  success: boolean;
  syncedActions: number;
  failedActions: number;
  conflicts: ConflictResolution[];
  errors: string[];
  syncDuration: number;
}

class InventoryOfflineSync {
  private syncQueue: OfflineAction[] = [];
  private isOnline: boolean = false;
  private syncInProgress: boolean = false;
  private lastSyncTime: number = 0;
  private syncInterval: NodeJS.Timeout | null = null;
  private maxRetries: number = 3;
  private batchSize: number = 10;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor() {
    this.initializeSync();
    this.setupNetworkListener();
    this.loadPersistedQueue();
  }

  private async initializeSync() {
    try {
      const lastSync = await AsyncStorage.getItem('last_sync_time');
      this.lastSyncTime = lastSync ? parseInt(lastSync) : 0;
      
      // Start periodic sync
      this.startPeriodicSync();
    } catch (error) {
      console.error('Failed to initialize offline sync:', error);
    }
  }

  private setupNetworkListener() {
    // In a real React Native app, this would use NetInfo
    // For now, simulating network status detection
    this.isOnline = true; // Assume online initially
    
    // Simulate network changes
    setInterval(() => {
      const wasOnline = this.isOnline;
      // In real implementation: NetInfo.addEventListener(this.handleNetworkChange);
      
      if (!wasOnline && this.isOnline) {
        this.onBackOnline();
      }
    }, 5000);
  }

  private async loadPersistedQueue() {
    try {
      const persistedQueue = await AsyncStorage.getItem('sync_queue');
      if (persistedQueue) {
        this.syncQueue = JSON.parse(persistedQueue);
        console.log(`Loaded ${this.syncQueue.length} pending actions from storage`);
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Failed to load persisted sync queue:', error);
    }
  }

  private async persistQueue() {
    try {
      await AsyncStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to persist sync queue:', error);
    }
  }

  private startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.syncInProgress && this.syncQueue.length > 0) {
        this.syncToServer();
      }
    }, 30000); // Sync every 30 seconds
  }

  private onBackOnline() {
    console.log('Back online - triggering sync');
    if (!this.syncInProgress && this.syncQueue.length > 0) {
      this.syncToServer();
    }
  }

  /**
   * Add action to offline queue
   */
  async queueAction(
    type: OfflineActionType,
    entityType: OfflineAction['entityType'],
    entityId: string,
    action: string,
    data: any,
    options: {
      priority?: OfflineAction['metadata']['priority'];
      conflictResolution?: OfflineAction['metadata']['conflictResolution'];
      dependencies?: string[];
    } = {}
  ): Promise<string> {
    const actionId = this.generateActionId();
    
    const offlineAction: OfflineAction = {
      id: actionId,
      timestamp: Date.now(),
      type,
      entityType,
      entityId,
      action,
      data,
      metadata: {
        userId: await this.getCurrentUserId(),
        deviceId: await this.getDeviceId(),
        priority: options.priority || 'medium',
        retryCount: 0,
        maxRetries: this.maxRetries,
        conflictResolution: options.conflictResolution || 'server_wins',
      },
      dependencies: options.dependencies,
      status: 'pending',
    };

    // Insert in priority order
    this.insertInQueue(offlineAction);
    
    await this.persistQueue();
    this.notifyListeners();

    // Try immediate sync if online
    if (this.isOnline && !this.syncInProgress) {
      setTimeout(() => this.syncToServer(), 100);
    }

    return actionId;
  }

  /**
   * Queue stock update
   */
  async queueStockUpdate(
    item: InventoryItem,
    previousQuantity: number,
    newQuantity: number,
    reason: string,
    orderId?: number
  ): Promise<string> {
    return this.queueAction(
      'STOCK_UPDATE',
      'inventory',
      item.sku,
      `Update stock: ${item.name}`,
      {
        sku: item.sku,
        previousQuantity,
        newQuantity,
        reason,
        orderId,
        timestamp: Date.now(),
      },
      {
        priority: orderId ? 'high' : 'medium', // Order-related updates are high priority
        conflictResolution: 'server_wins', // Server wins for stock conflicts
      }
    );
  }

  /**
   * Queue recipe changes
   */
  async queueRecipeChange(
    recipeId: string,
    changeType: 'create' | 'update' | 'delete',
    recipeData: Recipe | null,
    previousData?: Recipe
  ): Promise<string> {
    const actionType = `RECIPE_${changeType.toUpperCase()}` as OfflineActionType;
    
    return this.queueAction(
      actionType,
      'recipe',
      recipeId,
      `${changeType} recipe: ${recipeData?.item_name || 'Unknown'}`,
      {
        recipe: recipeData,
        previousRecipe: previousData,
        timestamp: Date.now(),
      },
      {
        priority: changeType === 'delete' ? 'high' : 'medium',
        conflictResolution: 'manual', // Recipe conflicts need manual resolution
      }
    );
  }

  /**
   * Queue order completion
   */
  async queueOrderCompletion(
    order: Order,
    inventoryDeductions: { sku: string; quantity: number }[]
  ): Promise<string> {
    return this.queueAction(
      'ORDER_COMPLETE',
      'order',
      order.id?.toString() || 'unknown',
      `Complete order: ${order.items.length} items`,
      {
        order,
        inventoryDeductions,
        timestamp: Date.now(),
      },
      {
        priority: 'critical', // Order completion is critical
        conflictResolution: 'client_wins', // Client order data takes precedence
        dependencies: inventoryDeductions.map(d => d.sku), // Depends on inventory items
      }
    );
  }

  /**
   * Sync queued actions to server
   */
  async syncToServer(): Promise<SyncResult> {
    if (this.syncInProgress || !this.isOnline) {
      return {
        success: false,
        syncedActions: 0,
        failedActions: 0,
        conflicts: [],
        errors: ['Sync already in progress or offline'],
        syncDuration: 0,
      };
    }

    const startTime = Date.now();
    this.syncInProgress = true;
    this.notifyListeners();

    try {
      const result = await this.processSyncBatch();
      
      this.lastSyncTime = Date.now();
      await AsyncStorage.setItem('last_sync_time', this.lastSyncTime.toString());
      
      return {
        ...result,
        syncDuration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Sync failed:', error);
      return {
        success: false,
        syncedActions: 0,
        failedActions: this.syncQueue.filter(a => a.status === 'pending').length,
        conflicts: [],
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
        syncDuration: Date.now() - startTime,
      };
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }
  }

  private async processSyncBatch(): Promise<Omit<SyncResult, 'syncDuration'>> {
    const pendingActions = this.syncQueue
      .filter(action => action.status === 'pending')
      .sort((a, b) => this.getPriorityWeight(a.metadata.priority) - this.getPriorityWeight(b.metadata.priority))
      .slice(0, this.batchSize);

    let syncedActions = 0;
    let failedActions = 0;
    const conflicts: ConflictResolution[] = [];
    const errors: string[] = [];

    for (const action of pendingActions) {
      try {
        action.status = 'syncing';
        this.notifyListeners();

        const result = await this.syncSingleAction(action);
        
        if (result.success) {
          action.status = 'completed';
          syncedActions++;
          
          // Remove completed action from queue
          this.syncQueue = this.syncQueue.filter(a => a.id !== action.id);
        } else if (result.conflict) {
          action.status = 'conflict';
          conflicts.push(result.conflict);
        } else {
          action.metadata.retryCount++;
          if (action.metadata.retryCount >= action.metadata.maxRetries) {
            action.status = 'failed';
            failedActions++;
            errors.push(`Action ${action.id} failed after ${action.metadata.maxRetries} retries`);
          } else {
            action.status = 'pending';
          }
        }
      } catch (error) {
        action.metadata.retryCount++;
        if (action.metadata.retryCount >= action.metadata.maxRetries) {
          action.status = 'failed';
          failedActions++;
        } else {
          action.status = 'pending';
        }
        
        errors.push(`Action ${action.id} error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    await this.persistQueue();
    
    return {
      success: errors.length === 0,
      syncedActions,
      failedActions,
      conflicts,
      errors,
    };
  }

  private async syncSingleAction(action: OfflineAction): Promise<{
    success: boolean;
    conflict?: ConflictResolution;
  }> {
    try {
      switch (action.type) {
        case 'STOCK_UPDATE':
          return await this.syncStockUpdate(action);
        case 'RECIPE_CREATE':
        case 'RECIPE_UPDATE':
        case 'RECIPE_DELETE':
          return await this.syncRecipeChange(action);
        case 'ORDER_COMPLETE':
          return await this.syncOrderCompletion(action);
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('conflict')) {
        return {
          success: false,
          conflict: await this.createConflictResolution(action, error),
        };
      }
      throw error;
    }
  }

  private async syncStockUpdate(action: OfflineAction): Promise<{ success: boolean }> {
    const { sku, newQuantity, reason, orderId } = action.data;
    
    try {
      await InventoryApiService.adjustStock(sku, newQuantity, reason, orderId);
      
      // Log audit event
      await inventoryAuditService.logStockMovement(
        { sku, name: 'Unknown' } as InventoryItem,
        action.data.previousQuantity,
        newQuantity,
        'ADJUSTMENT',
        {
          reason,
          orderId,
          automaticAction: !!orderId,
        }
      );

      return { success: true };
    } catch (error) {
      throw new Error(`Stock update failed: ${error}`);
    }
  }

  private async syncRecipeChange(action: OfflineAction): Promise<{ success: boolean }> {
    const { recipe, previousRecipe } = action.data;
    
    try {
      switch (action.type) {
        case 'RECIPE_CREATE':
          await InventoryApiService.createRecipe(recipe);
          break;
        case 'RECIPE_UPDATE':
          await InventoryApiService.updateRecipe(recipe.item_id, recipe);
          break;
        case 'RECIPE_DELETE':
          await InventoryApiService.deleteRecipe(recipe.item_id);
          break;
      }

      // Log audit event
      await inventoryAuditService.logRecipeChange(
        recipe?.item_id || action.entityId,
        action.type.split('_')[1] as 'CREATED' | 'UPDATED' | 'DELETED',
        previousRecipe,
        recipe
      );

      return { success: true };
    } catch (error) {
      throw new Error(`Recipe ${action.type.toLowerCase()} failed: ${error}`);
    }
  }

  private async syncOrderCompletion(action: OfflineAction): Promise<{ success: boolean }> {
    const { order, inventoryDeductions } = action.data;
    
    try {
      // Process inventory deductions
      for (const deduction of inventoryDeductions) {
        await InventoryApiService.adjustStock(
          deduction.sku,
          -deduction.quantity,
          `Order completion: ${order.id}`,
          order.id
        );
      }

      // Log audit event
      await inventoryAuditService.logOrderCompletion(
        order,
        inventoryDeductions.map(d => ({ ...d, cost: 0 })), // Cost would be calculated
        {
          orderId: order.id,
          automaticAction: true,
        }
      );

      return { success: true };
    } catch (error) {
      throw new Error(`Order completion failed: ${error}`);
    }
  }

  private async createConflictResolution(
    action: OfflineAction,
    error: Error
  ): Promise<ConflictResolution> {
    return {
      actionId: action.id,
      conflictType: 'concurrent_modification',
      localData: action.data,
      serverData: null, // Would be fetched from server
      recommendedResolution: action.metadata.conflictResolution || 'server_wins',
    };
  }

  private insertInQueue(action: OfflineAction) {
    const priorityWeight = this.getPriorityWeight(action.metadata.priority);
    
    let insertIndex = this.syncQueue.length;
    for (let i = 0; i < this.syncQueue.length; i++) {
      const existingWeight = this.getPriorityWeight(this.syncQueue[i].metadata.priority);
      if (priorityWeight < existingWeight) {
        insertIndex = i;
        break;
      }
    }
    
    this.syncQueue.splice(insertIndex, 0, action);
  }

  private getPriorityWeight(priority: OfflineAction['metadata']['priority']): number {
    switch (priority) {
      case 'critical': return 1;
      case 'high': return 2;
      case 'medium': return 3;
      case 'low': return 4;
      default: return 3;
    }
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getCurrentUserId(): Promise<string> {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      return userInfo ? JSON.parse(userInfo).id : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch {
      return `device_fallback_${Date.now()}`;
    }
  }

  /**
   * Resolve conflict manually
   */
  async resolveConflict(
    actionId: string,
    resolution: 'client_wins' | 'server_wins' | 'merge' | 'skip'
  ): Promise<void> {
    const action = this.syncQueue.find(a => a.id === actionId);
    if (!action || action.status !== 'conflict') {
      throw new Error('Action not found or not in conflict state');
    }

    if (resolution === 'skip') {
      this.syncQueue = this.syncQueue.filter(a => a.id !== actionId);
    } else {
      action.metadata.conflictResolution = resolution;
      action.status = 'pending';
      action.metadata.retryCount = 0; // Reset retry count
    }

    await this.persistQueue();
    this.notifyListeners();
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    const pendingActions = this.syncQueue.filter(a => a.status === 'pending').length;
    const failedActions = this.syncQueue.filter(a => a.status === 'failed').length;
    const conflictActions = this.syncQueue.filter(a => a.status === 'conflict').length;

    return {
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      pendingActions,
      failedActions,
      conflictActions,
      syncInProgress: this.syncInProgress,
      estimatedSyncTime: pendingActions > 0 ? pendingActions * 2000 : undefined, // 2s per action estimate
    };
  }

  /**
   * Subscribe to sync status updates
   */
  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const status = this.getSyncStatus();
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error notifying sync status listener:', error);
      }
    });
  }

  /**
   * Force sync all pending actions
   */
  async forceSyncAll(): Promise<SyncResult> {
    this.batchSize = this.syncQueue.length; // Process all actions
    const result = await this.syncToServer();
    this.batchSize = 10; // Reset to normal batch size
    return result;
  }

  /**
   * Clear all failed actions
   */
  async clearFailedActions(): Promise<void> {
    this.syncQueue = this.syncQueue.filter(a => a.status !== 'failed');
    await this.persistQueue();
    this.notifyListeners();
  }

  /**
   * Get failed actions for manual review
   */
  getFailedActions(): OfflineAction[] {
    return this.syncQueue.filter(a => a.status === 'failed');
  }

  /**
   * Get conflict actions for manual resolution
   */
  getConflictActions(): OfflineAction[] {
    return this.syncQueue.filter(a => a.status === 'conflict');
  }

  /**
   * Cleanup - stop periodic sync
   */
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
  }
}

// Create singleton instance
export const inventoryOfflineSync = new InventoryOfflineSync();

export default InventoryOfflineSync;