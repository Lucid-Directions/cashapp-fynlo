/**
 * WebSocket Service for Real-time Communication
 * Provides version-aware WebSocket connections with automatic path resolution
 */

import DataService from './DataService';
import API_CONFIG from '../config/api';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  restaurant_id?: string;
}

export interface WebSocketConfig {
  baseUrl: string;
  restaurantId: string;
  userId?: string;
  connectionType: 'pos' | 'kitchen' | 'management' | 'customer';
  autoReconnect: boolean;
  heartbeatInterval: number;
  maxReconnectAttempts: number;
}

export enum WebSocketEvent {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  MESSAGE = 'message',
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  PAYMENT_PROCESSED = 'payment_processed',
  INVENTORY_UPDATED = 'inventory_updated',
  KITCHEN_STATUS = 'kitchen_status',
  POS_SYNC = 'pos_sync'
}

export class WebSocketService {
  private static instance: WebSocketService;
  private socket: WebSocket | null = null;
  private config: WebSocketConfig;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectTimeout: number | null = null;
  private heartbeatTimeout: number | null = null;
  private dataService: DataService;

  private constructor() {
    this.dataService = DataService.getInstance();
    this.config = {
      baseUrl: API_CONFIG.BASE_URL.replace('http', 'ws'),
      restaurantId: 'default-restaurant',
      connectionType: 'pos',
      autoReconnect: true,
      heartbeatInterval: 30000, // 30 seconds
      maxReconnectAttempts: 5
    };
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Configure WebSocket connection
   */
  public configure(config: Partial<WebSocketConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Connect to WebSocket with version-aware path resolution
   */
  public async connect(): Promise<boolean> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return true;
    }

    if (this.isConnecting) {
      console.log('WebSocket connection already in progress');
      return false;
    }

    this.isConnecting = true;

    try {
      const wsUrl = this.buildWebSocketUrl();
      console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

      this.socket = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Failed to create WebSocket'));
          return;
        }

        const connectTimeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.socket.onopen = () => {
          clearTimeout(connectTimeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          console.log('✅ WebSocket connected');
          this.emit(WebSocketEvent.CONNECTED, { timestamp: new Date().toISOString() });
          this.startHeartbeat();
          
          resolve(true);
        };

        this.socket.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.socket.onclose = (event) => {
          clearTimeout(connectTimeout);
          this.isConnecting = false;
          this.stopHeartbeat();
          
          console.log(`🔌 WebSocket disconnected: ${event.code} - ${event.reason}`);
          this.emit(WebSocketEvent.DISCONNECTED, { 
            code: event.code, 
            reason: event.reason,
            timestamp: new Date().toISOString()
          });

          if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
          }

          resolve(false);
        };

        this.socket.onerror = (error) => {
          clearTimeout(connectTimeout);
          this.isConnecting = false;
          
          console.error('🚨 WebSocket error:', error);
          this.emit(WebSocketEvent.ERROR, { 
            error: error.toString(),
            timestamp: new Date().toISOString()
          });

          reject(error);
        };
      });

    } catch (error) {
      this.isConnecting = false;
      console.error('Failed to create WebSocket connection:', error);
      throw error;
    }
  }

  /**
   * Build version-aware WebSocket URL with fallback paths
   */
  private buildWebSocketUrl(): string {
    const { baseUrl, restaurantId, userId, connectionType } = this.config;
    
    // Try different WebSocket path formats for maximum compatibility
    let path: string;
    
    if (connectionType === 'pos') {
      // Use version-aware path that will be normalized by middleware
      path = `/ws/${restaurantId}`;
    } else {
      // Use specific connection type path
      path = `/ws/${connectionType}/${restaurantId}`;
    }

    // Add user ID if available
    const queryParams = new URLSearchParams();
    if (userId) {
      queryParams.append('user_id', userId);
    }
    queryParams.append('connection_type', connectionType);

    const queryString = queryParams.toString();
    const fullPath = queryString ? `${path}?${queryString}` : path;

    return `${baseUrl}${fullPath}`;
  }

  /**
   * Send message to WebSocket
   */
  public send(type: string, data: any): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString(),
      restaurant_id: this.config.restaurantId
    };

    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  public subscribe(event: WebSocketEvent | string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Disconnect WebSocket
   */
  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();
    this.config.autoReconnect = false;

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }

    console.log('🔌 WebSocket disconnected by client');
  }

  /**
   * Check if WebSocket is connected
   */
  public isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection status
   */
  public getStatus(): string {
    if (!this.socket) return 'disconnected';
    
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: WebSocketMessage): void {
    console.log('📨 WebSocket message received:', message.type);

    // Emit generic message event
    this.emit(WebSocketEvent.MESSAGE, message);

    // Emit specific event type
    this.emit(message.type, message.data);

    // Handle system messages
    if (message.type === 'pong') {
      // Heartbeat response received
      return;
    }

    // Handle business logic messages
    switch (message.type) {
      case 'order_created':
      case 'order_updated':
        this.emit(WebSocketEvent.ORDER_UPDATED, message.data);
        break;
      
      case 'payment_processed':
        this.emit(WebSocketEvent.PAYMENT_PROCESSED, message.data);
        break;
      
      case 'inventory_updated':
        this.emit(WebSocketEvent.INVENTORY_UPDATED, message.data);
        break;
      
      case 'kitchen_status':
        this.emit(WebSocketEvent.KITCHEN_STATUS, message.data);
        break;
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s

    console.log(`🔄 Scheduling WebSocket reconnection attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('WebSocket reconnection failed:', error);
      }
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimeout = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send('ping', { timestamp: new Date().toISOString() });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimeout) {
      clearInterval(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Test WebSocket connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const success = await this.connect();
      if (success) {
        // Send test message
        this.send('test', { message: 'Connection test' });
        
        // Disconnect after test
        setTimeout(() => {
          this.disconnect();
        }, 1000);
      }
      return success;
    } catch (error) {
      console.error('WebSocket test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const webSocketService = WebSocketService.getInstance(); 