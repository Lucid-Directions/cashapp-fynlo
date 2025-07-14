/**
 * WebSocket Service for real-time updates in Fynlo POS Mobile App
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';

// Simple EventEmitter replacement for React Native
class SimpleEventEmitter {
  private listeners: { [key: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== listener);
  }

  emit(event: string, ...args: any[]) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(listener => listener(...args));
  }

  removeAllListeners(event?: string) {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }
}

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: string;
}

interface ConnectionOptions {
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export enum WebSocketEventType {
  // Connection events
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
  
  // Business events
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_STATUS_CHANGED = 'order.status_changed',
  PAYMENT_PROCESSED = 'payment.processed',
  INVENTORY_UPDATED = 'inventory.updated',
  MENU_UPDATED = 'menu.updated',
  STAFF_UPDATE = 'staff.update',
  SETTINGS_UPDATED = 'settings.updated',
  SYSTEM_NOTIFICATION = 'system.notification'
}

class WebSocketService extends SimpleEventEmitter {
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 5000;
  private maxReconnectAttempts: number = 10;
  private reconnectAttempts: number = 0;
  private isReconnecting: boolean = false;
  private shouldReconnect: boolean = true;
  private pingInterval: NodeJS.Timeout | null = null;
  private connectionUrl: string | null = null;
  
  constructor() {
    super();
  }
  
  /**
   * Connect to WebSocket server
   */
  async connect(options: ConnectionOptions = {}): Promise<void> {
    try {
      // Get authentication details
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (!userInfo) {
        throw new Error('No user authentication found');
      }
      
      const user = JSON.parse(userInfo);
      const restaurantId = user.restaurant_id;
      const userId = user.id;
      
      // Get the auth token from AsyncStorage
      const authToken = await AsyncStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error('No authentication token found');
      }
      
      if (!restaurantId) {
        throw new Error('No restaurant associated with user');
      }
      
      // Configure options
      this.shouldReconnect = options.reconnect !== false;
      this.reconnectInterval = options.reconnectInterval || 5000;
      this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
      
      // Build WebSocket URL with authentication token
      const wsProtocol = API_CONFIG.BASE_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_CONFIG.BASE_URL.replace(/^https?:\/\//, '');
      // Remove /api/v1 prefix as backend expects /ws/pos directly
      // Include auth token in query parameters for WebSocket authentication
      this.connectionUrl = `${wsProtocol}://${wsHost}/ws/pos/${restaurantId}?user_id=${userId}&token=${authToken}`;
      
      console.log('🔌 Connecting to WebSocket:', this.connectionUrl);
      
      // Create WebSocket connection
      this.ws = new WebSocket(this.connectionUrl);
      
      // Set up event handlers
      this.setupEventHandlers();
      
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      this.emit(WebSocketEventType.ERROR, error);
      throw error;
    }
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    
    this.shouldReconnect = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.emit(WebSocketEventType.DISCONNECTED);
  }
  
  /**
   * Send message through WebSocket
   */
  send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not connected, cannot send message');
      return;
    }
    
    try {
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
      console.log('📤 Sent WebSocket message:', message.type);
    } catch (error) {
      console.error('❌ Error sending WebSocket message:', error);
      this.emit(WebSocketEventType.ERROR, error);
    }
  }
  
  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get connection state
   */
  getState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
  
  /**
   * Subscribe to specific event types
   */
  subscribe(eventTypes: string[]): void {
    if (!this.isConnected()) {
      console.warn('⚠️ Cannot subscribe - WebSocket not connected');
      return;
    }
    
    this.send({
      type: 'subscribe',
      data: { events: eventTypes }
    });
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;
    
    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      
      this.emit(WebSocketEventType.CONNECTED);
      
      // Start ping interval to keep connection alive
      this.startPingInterval();
      
      // Subscribe to relevant events
      this.subscribe([
        WebSocketEventType.ORDER_CREATED,
        WebSocketEventType.ORDER_UPDATED,
        WebSocketEventType.ORDER_STATUS_CHANGED,
        WebSocketEventType.PAYMENT_PROCESSED,
        WebSocketEventType.INVENTORY_UPDATED,
        WebSocketEventType.MENU_UPDATED,
        WebSocketEventType.STAFF_UPDATE,
        WebSocketEventType.SYSTEM_NOTIFICATION
      ]);
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        console.log('📥 Received WebSocket message:', message.type);
        
        // Handle different message types
        this.handleMessage(message);
        
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.emit(WebSocketEventType.ERROR, error);
    };
    
    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket closed:', event.code, event.reason);
      
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      
      this.emit(WebSocketEventType.DISCONNECTED);
      
      // Attempt reconnection if enabled
      if (this.shouldReconnect && !this.isReconnecting) {
        this.attemptReconnect();
      }
    };
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'pong':
        // Pong received, connection is alive
        break;
        
      case 'connection_established':
        console.log('✅ Connection established:', message.data);
        break;
        
      case 'subscription_confirmed':
        console.log('✅ Subscription confirmed:', message.data);
        break;
        
      case 'error':
        console.error('❌ Server error:', message.data);
        this.emit(WebSocketEventType.ERROR, message.data);
        break;
        
      default:
        // Emit business events
        if (message.type && message.data) {
          this.emit(message.type, message.data);
        }
        break;
    }
  }
  
  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({
          type: 'ping',
          data: { timestamp: new Date().toISOString() }
        });
      }
    }, 30000); // Ping every 30 seconds
  }
  
  /**
   * Attempt to reconnect to WebSocket
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit(WebSocketEventType.ERROR, new Error('Max reconnection attempts reached'));
      return;
    }
    
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
    this.emit(WebSocketEventType.RECONNECTING, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    });
    
    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, this.reconnectInterval));
    
    // Attempt to connect again
    try {
      await this.connect({
        reconnect: true,
        reconnectInterval: this.reconnectInterval,
        maxReconnectAttempts: this.maxReconnectAttempts
      });
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      // Will retry automatically through onclose handler
    }
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// Export service class for testing
export { WebSocketService };