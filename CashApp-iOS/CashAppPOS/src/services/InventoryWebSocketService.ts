/**
 * InventoryWebSocketService - Real-time inventory updates and synchronization
 * Provides WebSocket-based real-time inventory tracking, stock alerts, and multi-user sync
 */

import { EventEmitter } from 'events';
import { InventoryItem, StockMovement, InventoryAlert } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface InventoryWebSocketEvent {
  type: 'STOCK_UPDATE' | 'STOCK_ALERT' | 'RECIPE_CHANGE' | 'COST_UPDATE' | 'SYNC_STATUS';
  data: any;
  timestamp: number;
  sourceDeviceId?: string;
}

export interface StockUpdateEvent {
  sku: string;
  previousQuantity: number;
  newQuantity: number;
  changeType: 'restock' | 'deduction' | 'adjustment' | 'waste';
  reason: string;
  userId: string;
  orderId?: number;
}

export interface StockAlertEvent {
  sku: string;
  itemName: string;
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'REORDER_NEEDED' | 'EXPIRED';
  currentStock: number;
  parLevel?: number;
  expiryDate?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface SyncStatusEvent {
  status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  lastSync: number;
  pendingChanges: number;
  message?: string;
}

class InventoryWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 5000; // 5 seconds
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private deviceId: string = '';
  private userId: string = '';
  private pendingEvents: InventoryWebSocketEvent[] = [];
  private subscriptions: Set<string> = new Set();

  constructor() {
    super();
    this.initializeDeviceId();
    this.setupEventHandlers();
  }

  private async initializeDeviceId() {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = this.generateDeviceId();
        await AsyncStorage.setItem('device_id', deviceId);
      }
      this.deviceId = deviceId;
    } catch (error) {
      console.error('Failed to initialize device ID:', error);
      this.deviceId = this.generateDeviceId();
    }
  }

  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventHandlers() {
    this.on('STOCK_UPDATE', this.handleStockUpdate.bind(this));
    this.on('STOCK_ALERT', this.handleStockAlert.bind(this));
    this.on('RECIPE_CHANGE', this.handleRecipeChange.bind(this));
    this.on('COST_UPDATE', this.handleCostUpdate.bind(this));
  }

  /**
   * Connect to WebSocket server with authentication
   */
  async connect(userId: string, authToken: string): Promise<void> {
    this.userId = userId;
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      const wsUrl = this.getWebSocketUrl();
      this.ws = new WebSocket(`${wsUrl}?token=${authToken}&deviceId=${this.deviceId}&userId=${userId}`);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.emitSyncStatus('error', `Connection failed: ${error}`);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.emitSyncStatus('disconnected');
  }

  /**
   * Subscribe to specific inventory item updates
   */
  subscribeToItem(sku: string): void {
    this.subscriptions.add(sku);
    if (this.isConnected) {
      this.sendMessage({
        type: 'SUBSCRIBE',
        data: { sku },
        timestamp: Date.now(),
        sourceDeviceId: this.deviceId,
      });
    }
  }

  /**
   * Unsubscribe from inventory item updates
   */
  unsubscribeFromItem(sku: string): void {
    this.subscriptions.delete(sku);
    if (this.isConnected) {
      this.sendMessage({
        type: 'UNSUBSCRIBE',
        data: { sku },
        timestamp: Date.now(),
        sourceDeviceId: this.deviceId,
      });
    }
  }

  /**
   * Broadcast stock update to other connected devices
   */
  broadcastStockUpdate(update: StockUpdateEvent): void {
    const event: InventoryWebSocketEvent = {
      type: 'STOCK_UPDATE',
      data: update,
      timestamp: Date.now(),
      sourceDeviceId: this.deviceId,
    };

    this.sendMessage(event);
  }

  /**
   * Broadcast stock alert to management devices
   */
  broadcastStockAlert(alert: StockAlertEvent): void {
    const event: InventoryWebSocketEvent = {
      type: 'STOCK_ALERT',
      data: alert,
      timestamp: Date.now(),
      sourceDeviceId: this.deviceId,
    };

    this.sendMessage(event);
  }

  /**
   * Request full inventory sync
   */
  requestFullSync(): void {
    const event: InventoryWebSocketEvent = {
      type: 'SYNC_REQUEST',
      data: { 
        lastSync: Date.now(),
        subscriptions: Array.from(this.subscriptions) 
      },
      timestamp: Date.now(),
      sourceDeviceId: this.deviceId,
    };

    this.sendMessage(event);
  }

  private getWebSocketUrl(): string {
    // In production, this would come from environment config
    const baseUrl = __DEV__ ? 'ws://localhost:8000' : 'wss://api.fynlopos.com';
    return `${baseUrl}/ws/inventory`;
  }

  private handleOpen(): void {
    console.log('WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Send pending events
    this.flushPendingEvents();
    
    // Resubscribe to items
    this.resubscribeToItems();
    
    // Start ping interval
    this.startPingInterval();
    
    this.emitSyncStatus('connected');
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: InventoryWebSocketEvent = JSON.parse(event.data);
      
      // Ignore messages from this device to prevent loops
      if (message.sourceDeviceId === this.deviceId) {
        return;
      }

      this.emit(message.type, message.data, message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log('WebSocket disconnected:', event.code, event.reason);
    this.isConnected = false;
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.emitSyncStatus('disconnected', event.reason);

    // Auto-reconnect unless it was a clean disconnect
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event): void {
    console.error('WebSocket error:', error);
    this.emitSyncStatus('error', 'Connection error occurred');
  }

  private sendMessage(message: InventoryWebSocketEvent): void {
    if (this.isConnected && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        this.pendingEvents.push(message);
      }
    } else {
      // Queue message for when connection is restored
      this.pendingEvents.push(message);
      this.emitSyncStatus('disconnected', 'Message queued for sync');
    }
  }

  private flushPendingEvents(): void {
    if (this.pendingEvents.length > 0) {
      console.log(`Sending ${this.pendingEvents.length} pending events`);
      
      for (const event of this.pendingEvents) {
        this.sendMessage(event);
      }
      
      this.pendingEvents = [];
    }
  }

  private resubscribeToItems(): void {
    for (const sku of this.subscriptions) {
      this.subscribeToItem(sku);
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.emitSyncStatus('error', 'Failed to reconnect after maximum attempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.emitSyncStatus('reconnecting', `Attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      if (!this.isConnected) {
        try {
          // Re-authenticate and connect
          const authToken = await AsyncStorage.getItem('auth_token');
          if (authToken) {
            await this.connect(this.userId, authToken);
          }
        } catch (error) {
          console.error('Reconnection failed:', error);
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  private emitSyncStatus(status: SyncStatusEvent['status'], message?: string): void {
    const syncStatus: SyncStatusEvent = {
      status,
      lastSync: Date.now(),
      pendingChanges: this.pendingEvents.length,
      message,
    };

    this.emit('SYNC_STATUS', syncStatus);
  }

  private handleStockUpdate(update: StockUpdateEvent, event: InventoryWebSocketEvent): void {
    console.log('Received stock update:', update);
    // This will be handled by components that subscribe to this service
  }

  private handleStockAlert(alert: StockAlertEvent, event: InventoryWebSocketEvent): void {
    console.log('Received stock alert:', alert);
    
    // Show notification for critical alerts
    if (alert.priority === 'critical') {
      // This would integrate with a notification service
      console.warn(`CRITICAL ALERT: ${alert.itemName} - ${alert.alertType}`);
    }
  }

  private handleRecipeChange(data: any, event: InventoryWebSocketEvent): void {
    console.log('Received recipe change:', data);
    // Handle recipe updates
  }

  private handleCostUpdate(data: any, event: InventoryWebSocketEvent): void {
    console.log('Received cost update:', data);
    // Handle cost calculation updates
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): SyncStatusEvent {
    return {
      status: this.isConnected ? 'connected' : 'disconnected',
      lastSync: Date.now(),
      pendingChanges: this.pendingEvents.length,
    };
  }

  /**
   * Force immediate sync attempt
   */
  async forceSync(): Promise<void> {
    if (!this.isConnected) {
      const authToken = await AsyncStorage.getItem('auth_token');
      if (authToken) {
        await this.connect(this.userId, authToken);
      }
    } else {
      this.requestFullSync();
    }
  }

  /**
   * Get pending changes count
   */
  getPendingChangesCount(): number {
    return this.pendingEvents.length;
  }

  /**
   * Clear all pending events (use with caution)
   */
  clearPendingEvents(): void {
    this.pendingEvents = [];
    this.emitSyncStatus(this.isConnected ? 'connected' : 'disconnected');
  }
}

// Create singleton instance
export const inventoryWebSocketService = new InventoryWebSocketService();

export default InventoryWebSocketService;