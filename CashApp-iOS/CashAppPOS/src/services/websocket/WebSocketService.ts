/**
 * WebSocket Service for real-time updates in Fynlo POS Mobile App
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';
import tokenManager from '../../utils/tokenManager';

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
  private isAuthError: boolean = false;
  private tokenRefreshListener: (() => void) | null = null;
  private connectionStartTime: number = 0;
  
  constructor() {
    super();
    
    // Listen to token refresh events
    this.tokenRefreshListener = () => {
      console.log('🔄 Token refreshed, reconnecting WebSocket...');
      this.handleTokenRefresh();
    };
    
    tokenManager.on('token:refreshed', this.tokenRefreshListener);
  }
  
  /**
   * Connect to WebSocket server
   */
  async connect(options: ConnectionOptions = {}): Promise<void> {
    try {
      // Get authentication details
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (!userInfo) {
        const error = new Error('No user authentication found');
        console.warn('❌ WebSocket:', error.message);
        throw error;
      }
      
      const user = JSON.parse(userInfo);
      const restaurantId = user.restaurant_id;
      const userId = user.id;
      
      // Get the auth token using unified token manager
      const authToken = await tokenManager.getTokenWithRefresh();
      if (!authToken) {
        const error = new Error('No authentication token found');
        console.warn('❌ WebSocket:', error.message);
        throw error;
      }
      
      if (!restaurantId) {
        const error = new Error('No restaurant associated with user');
        console.warn('❌ WebSocket:', error.message);
        throw error;
      }
      
      // Configure options
      this.shouldReconnect = options.reconnect !== false;
      this.reconnectInterval = options.reconnectInterval || 5000;
      this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
      
      // Build WebSocket URL with authentication token
      const wsProtocol = API_CONFIG.BASE_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_CONFIG.BASE_URL.replace(/^https?:\/\//, '');
      
      // URL encode parameters to handle special characters safely
      const encodedRestaurantId = encodeURIComponent(restaurantId);
      const encodedUserId = encodeURIComponent(userId);
      const encodedToken = encodeURIComponent(authToken);
      
      // Build connection URL with encoded parameters
      this.connectionUrl = `${wsProtocol}://${wsHost}/ws/pos/${encodedRestaurantId}?user_id=${encodedUserId}&token=${encodedToken}`;
      
      // Log connection attempt without exposing the token
      console.log('🔌 Connecting to WebSocket:', `${wsProtocol}://${wsHost}/ws/pos/${encodedRestaurantId}?user_id=${encodedUserId}&token=***`);
      
      // Create WebSocket connection
      this.connectionStartTime = Date.now();
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
   * Handle token refresh by reconnecting with new token
   */
  private async handleTokenRefresh(): Promise<void> {
    // If we're currently connected or had an auth error, reconnect with new token
    if (this.isConnected() || this.isAuthError) {
      console.log('🔄 Reconnecting WebSocket with refreshed token...');
      
      // Disconnect current connection
      await this.disconnect();
      
      // Reset auth error flag
      this.isAuthError = false;
      
      // Wait a moment to ensure clean disconnect
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconnect with new token
      try {
        await this.connect({
          reconnect: true,
          reconnectInterval: this.reconnectInterval,
          maxReconnectAttempts: this.maxReconnectAttempts
        });
      } catch (error) {
        console.error('❌ Failed to reconnect after token refresh:', error);
      }
    }
  }
  
  /**
   * Cleanup method to remove event listeners
   */
  destroy(): void {
    // Remove token refresh listener
    if (this.tokenRefreshListener) {
      tokenManager.off('token:refreshed', this.tokenRefreshListener);
      this.tokenRefreshListener = null;
    }
    
    // Disconnect WebSocket
    this.disconnect();
    
    // Remove all event listeners
    this.removeAllListeners();
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
      this.isAuthError = false; // Clear auth error on successful connection
      
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
      
      // Check if the error message indicates authentication failure
      // The error event doesn't provide much detail, but we can infer from the close event
      this.emit(WebSocketEventType.ERROR, error);
    };
    
    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket closed:', event.code, event.reason);
      
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      
      this.emit(WebSocketEventType.DISCONNECTED);
      
      // Detect authentication errors based on various indicators:
      // 1. Code 1008 (Policy Violation) - often used for auth failures
      // 2. Code 4000-4999 - Application-specific error codes
      // 3. Specific reason text indicating auth failure
      // 4. Quick failure (connection closed within 2 seconds of opening)
      const connectionDuration = Date.now() - this.connectionStartTime;
      const isQuickFailure = connectionDuration < 2000; // Failed within 2 seconds
      const isPolicyViolation = event.code === 1008;
      const isAppSpecificError = event.code >= 4000 && event.code <= 4999;
      const hasAuthKeywords = event.reason && (
        event.reason.toLowerCase().includes('auth') ||
        event.reason.toLowerCase().includes('unauthorized') ||
        event.reason.toLowerCase().includes('forbidden') ||
        event.reason.toLowerCase().includes('401') ||
        event.reason.toLowerCase().includes('403') ||
        event.reason.toLowerCase().includes('invalid token') ||
        event.reason.toLowerCase().includes('token expired')
      );
      
      // For debugging, log all close events with timing
      console.log(`🔌 WebSocket connection closed after ${connectionDuration}ms`);
      
      // Consider it an auth error if:
      // - It's a policy violation (1008) or app-specific error (4000-4999)
      // - The reason contains auth-related keywords
      // - It's a 1006 (abnormal closure) that happened very quickly (likely rejected on connect)
      if (isPolicyViolation || isAppSpecificError || hasAuthKeywords || 
          (event.code === 1006 && isQuickFailure && !event.reason)) {
        console.log('🔐 Authentication error detected, will retry after token refresh');
        console.log('  Close code:', event.code);
        console.log('  Close reason:', event.reason || '(empty)');
        console.log('  Connection duration:', connectionDuration, 'ms');
        this.isAuthError = true;
        
        // Don't attempt immediate reconnect for auth errors
        // Wait for token refresh event instead
        return;
      }
      
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