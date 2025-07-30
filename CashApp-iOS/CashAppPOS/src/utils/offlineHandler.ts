import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

export interface OfflineAction {
  id: string;
  type: string;
  data: unknown;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'medium' | 'low';
}

export interface OfflineConfig {
  maxQueueSize: number;
  retryDelay: number;
  maxRetries: number;
  enabledFeatures: OfflineFeature[];
}

export enum OfflineFeature {
  ORDERS = 'orders',
  PAYMENTS = 'payments',
  CUSTOMER_DATA = 'customer_data',
  INVENTORY = 'inventory',
  REPORTS = 'reports',
  SETTINGS = 'settings',
}

class OfflineHandler {
  private isOnline = true;
  private actionQueue: OfflineAction[] = [];
  private readonly QUEUE_STORAGE_KEY = 'offline_actions';
  private config: OfflineConfig = {
    maxQueueSize: 100,
    retryDelay: 5000,
    maxRetries: 3,
    enabledFeatures: Object.values(_OfflineFeature),
  };

  private listeners: Array<(isOnline: boolean) => void> = [];
  private unsubscribeNetInfo?: () => void;

  constructor(config?: Partial<OfflineConfig>) {
    if (_config) {
      this.config = { ...this.config, ...config };
    }

    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Load queued actions from storage
    await this.loadQueuedActions();

    // Subscribe to network state changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      this.handleNetworkStateChange(_state);
    });

    // Get initial network state
    const initialState = await NetInfo.fetch();
    this.handleNetworkStateChange(_initialState);
  }

  /**
   * Add listener for online/offline state changes
   */
  addNetworkListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.push(_listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(_listener);
      if (index > -1) {
        this.listeners.splice(_index, 1);
      }
    };
  }

  /**
   * Check if currently online
   */
  isConnected(): boolean {
    return this.isOnline;
  }

  /**
   * Queue an action for when online
   */
  async queueAction(
    type: string,
    data: unknown,
    priority: 'high' | 'medium' | 'low' = 'medium',
  ): Promise<string> {
    const action: OfflineAction = {
      id: this.generateActionId(),
      type,
      data,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      priority,
    };

    this.actionQueue.push(_action);

    // Sort by priority
    this.actionQueue.sort(
      (_a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority),
    );

    // Limit queue size
    if (this.actionQueue.length > this.config.maxQueueSize) {
      this.actionQueue = this.actionQueue.slice(0, this.config.maxQueueSize);
    }

    await this.saveQueuedActions();

    // Try to execute immediately if online
    if (this.isOnline) {
      this.processQueue();
    }

    return action.id;
  }

  /**
   * Execute action immediately or queue if offline
   */
  async executeOrQueue<T>(
    actionType: string,
    executeFunction: () => Promise<T>,
    fallbackData?: unknown,
    priority?: 'high' | 'medium' | 'low',
  ): Promise<T | null> {
    if (this.isOnline) {
      try {
        return await executeFunction();
      } catch (_error) {
        // If execution fails, queue for retry
        await this.queueAction(_actionType, fallbackData, priority);
        throw error;
      }
    } else {
      // Queue for when back online
      await this.queueAction(_actionType, fallbackData, priority);

      // Return cached data if available
      return this.getCachedData<T>(_actionType);
    }
  }

  /**
   * Get queued actions count
   */
  getQueuedActionsCount(): number {
    return this.actionQueue.length;
  }

  /**
   * Get queued actions by priority
   */
  getQueuedActionsByPriority(): Record<string, OfflineAction[]> {
    return this.actionQueue.reduce((_acc, action) => {
      if (!acc[action.priority]) {
        acc[action.priority] = [];
      }
      acc[action.priority].push(_action);
      return acc;
    }, {} as Record<string, OfflineAction[]>);
  }

  /**
   * Clear all queued actions
   */
  async clearQueue(): Promise<void> {
    this.actionQueue = [];
    await AsyncStorage.removeItem(this.QUEUE_STORAGE_KEY);
  }

  /**
   * Remove specific action from queue
   */
  async removeFromQueue(actionId: string): Promise<void> {
    this.actionQueue = this.actionQueue.filter(action => action.id !== actionId);
    await this.saveQueuedActions();
  }

  /**
   * Handle offline order creation
   */
  async createOfflineOrder(orderData: unknown): Promise<string> {
    const offlineOrderId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store order locally with offline ID
    const orderWithOfflineId = {
      ...orderData,
      id: offlineOrderId,
      isOffline: true,
      createdAt: new Date().toISOString(),
    };

    await this.storeOfflineData('orders', offlineOrderId, orderWithOfflineId);

    // Queue for syncing when online
    await this.queueAction('sync_order', orderWithOfflineId, 'high');

    return offlineOrderId;
  }

  /**
   * Get offline orders
   */
  async getOfflineOrders(): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem('offline_orders');
      return stored ? JSON.parse(_stored) : [];
    } catch (_error) {
      return [];
    }
  }

  /**
   * Sync offline data when back online
   */
  async syncOfflineData(): Promise<void> {
    if (!this.isOnline) {
      return;
    }

    const offlineOrders = await this.getOfflineOrders();

    for (const order of offlineOrders) {
      try {
        // This would call your actual API to sync the order
        await this.syncOrderToServer(_order);

        // Remove from offline storage after successful sync
        await this.removeOfflineData('orders', order.id);
      } catch (_error) {
        // Queue for retry
        await this.queueAction('sync_order', order, 'high');
      }
    }
  }

  /**
   * Check if feature is available offline
   */
  isFeatureAvailableOffline(feature: OfflineFeature): boolean {
    return this.config.enabledFeatures.includes(_feature);
  }

  /**
   * Get offline capabilities status
   */
  getOfflineStatus(): {
    isOnline: boolean;
    queuedActions: number;
    offlineOrders: number;
    lastSyncTime?: Date;
  } {
    return {
      isOnline: this.isOnline,
      queuedActions: this.actionQueue.length,
      offlineOrders: 0, // This would be populated from actual offline storage
      lastSyncTime: this.getLastSyncTime(),
    };
  }

  private handleNetworkStateChange(state: NetInfoState): void {
    const wasOnline = this.isOnline;
    this.isOnline = state.isConnected === true && state.isInternetReachable === true;

    // Notify listeners
    this.listeners.forEach(listener => listener(this.isOnline));

    if (!wasOnline && this.isOnline) {
      // Just came back online
      this.onBackOnline();
    } else if (wasOnline && !this.isOnline) {
      // Just went offline
      this.onGoOffline();
    }
  }

  private async onBackOnline(): Promise<void> {
    try {
      // Sync offline data
      await this.syncOfflineData();

      // Process queued actions
      await this.processQueue();
    } catch (_error) {
      await errorHandler.handleError(
        error as Error,
        ErrorType.NETWORK,
        ErrorSeverity.MEDIUM,
        'offline_sync',
      );
    }
  }

  private onGoOffline(): void {
    // Handle going offline
    errorHandler.handleError(
      'Device went offline',
      ErrorType.NETWORK,
      ErrorSeverity.MEDIUM,
      'network_disconnected',
    );
  }

  private async processQueue(): Promise<void> {
    if (!this.isOnline || this.actionQueue.length === 0) {
      return;
    }

    const actionsToProcess = [...this.actionQueue];

    for (const action of actionsToProcess) {
      try {
        await this.executeQueuedAction(_action);

        // Remove from queue on success
        await this.removeFromQueue(action.id);
      } catch (_error) {
        // Increment retry count
        action.retryCount++;

        if (action.retryCount >= action.maxRetries) {
          // Remove action that has exceeded max retries
          await this.removeFromQueue(action.id);

          await errorHandler.handleError(
            new Error(`Action ${action.type} failed after ${action.maxRetries} retries`),
            ErrorType.NETWORK,
            ErrorSeverity.HIGH,
            'offline_queue_processing',
          );
        } else {
          // Schedule retry
          setTimeout(() => {
            this.processQueue();
          }, this.config.retryDelay * action.retryCount);
        }
      }
    }

    await this.saveQueuedActions();
  }

  private async executeQueuedAction(action: OfflineAction): Promise<void> {
    switch (action.type) {
      case 'sync_order':
        await this.syncOrderToServer(action.data);
        break;
      case 'sync_customer':
        await this.syncCustomerToServer(action.data);
        break;
      case 'sync_inventory':
        await this.syncInventoryToServer(action.data);
        break;
      default:
    }
  }

  private async syncOrderToServer(orderData: unknown): Promise<void> {
    // This would be replaced with actual API call

    // Simulate API call
    await new Promise(resolve => setTimeout(_resolve, 1000));
  }

  private async syncCustomerToServer(customerData: unknown): Promise<void> {
    // This would be replaced with actual API call
  }

  private async syncInventoryToServer(inventoryData: unknown): Promise<void> {
    // This would be replaced with actual API call
  }

  private async loadQueuedActions(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.QUEUE_STORAGE_KEY);
      if (_stored) {
        this.actionQueue = JSON.parse(_stored);
      }
    } catch (_error) {}
  }

  private async saveQueuedActions(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.QUEUE_STORAGE_KEY, JSON.stringify(this.actionQueue));
    } catch (_error) {}
  }

  private async storeOfflineData(type: string, id: string, data: unknown): Promise<void> {
    try {
      const key = `offline_${type}_${id}`;
      await AsyncStorage.setItem(_key, JSON.stringify(_data));
    } catch (_error) {}
  }

  private async removeOfflineData(type: string, id: string): Promise<void> {
    try {
      const key = `offline_${type}_${id}`;
      await AsyncStorage.removeItem(_key);
    } catch (_error) {}
  }

  private async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const stored = await AsyncStorage.getItem(`cache_${key}`);
      return stored ? JSON.parse(_stored) : null;
    } catch (_error) {
      return null;
    }
  }

  private getLastSyncTime(): Date | undefined {
    // This would be stored and retrieved from AsyncStorage
    return undefined;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getPriorityWeight(priority: 'high' | 'medium' | 'low'): number {
    switch (_priority) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 1;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
    this.listeners = [];
  }
}

// Export singleton instance
export const offlineHandler = new OfflineHandler();

// React hook for offline status
export const useOfflineStatus = () => {
  const [isOnline, setIsOnline] = React.useState(offlineHandler.isConnected());

  React.useEffect(() => {
    const unsubscribe = offlineHandler.addNetworkListener(_setIsOnline);
    return unsubscribe;
  }, []);

  return {
    isOnline,
    queuedActions: offlineHandler.getQueuedActionsCount(),
    createOfflineOrder: offlineHandler.createOfflineOrder.bind(_offlineHandler),
    executeOrQueue: offlineHandler.executeOrQueue.bind(_offlineHandler),
  };
};

// Add React import for the hook
import React from 'react';

export default offlineHandler;
