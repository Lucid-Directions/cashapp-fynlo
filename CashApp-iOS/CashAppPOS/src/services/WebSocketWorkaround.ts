/**
 * WebSocketWorkaround - Temporary fixes for backend WebSocket issues
 * 
 * This service provides workarounds for the current WebSocket authentication
 * problems until the backend is fixed. It implements fallback mechanisms
 * and retry logic to maintain real-time functionality.
 */

import { logger } from '../utils/logger';

interface WebSocketConfig {
  url: string;
  token: string;
  restaurantId: number;
  userId: number;
  maxRetries?: number;
  retryDelay?: number;
  heartbeatInterval?: number;
}

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export class WebSocketWorkaround {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private retryCount: number = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isConnected: boolean = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = {
      maxRetries: 5,
      retryDelay: 1000,
      heartbeatInterval: 15000,
      ...config,
    };
  }

  /**
   * Connect with multiple authentication strategies
   */
  async connect(): Promise<void> {
    try {
      logger.info('🔌 Attempting WebSocket connection with workarounds');
      
      // Strategy 1: Try with token in Sec-WebSocket-Protocol header
      // This works around React Native's query parameter stripping
      await this.connectWithProtocolHeader();
      
    } catch (error) {
      logger.error('❌ WebSocket connection failed:', error);
      
      // Strategy 2: Fall back to polling if WebSocket fails
      if (this.retryCount >= (this.config.maxRetries || 5)) {
        logger.warn('⚠️ WebSocket failed, falling back to polling');
        this.startPolling();
      } else {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Connect using Sec-WebSocket-Protocol header for authentication
   */
  private async connectWithProtocolHeader(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Encode token in base64 for protocol header
        const encodedToken = btoa(this.config.token);
        
        // Create WebSocket with token in protocol
        // Format: "token, base64_encoded_token"
        this.ws = new WebSocket(this.config.url, ['token', encodedToken]);
        
        // Set up event handlers
        this.ws.onopen = () => {
          logger.info('✅ WebSocket connected (protocol header method)');
          this.onOpen();
          resolve();
        };
        
        this.ws.onerror = (error) => {
          logger.error('❌ WebSocket error:', error);
          reject(error);
        };
        
        this.ws.onclose = (event) => {
          logger.warn(`⚠️ WebSocket closed: ${event.code} - ${event.reason}`);
          this.onClose(event);
        };
        
        this.ws.onmessage = (event) => {
          this.onMessage(event);
        };
        
        // Timeout connection attempt
        setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle connection open
   */
  private onOpen(): void {
    this.isConnected = true;
    this.retryCount = 0;
    
    // Send authentication message as backup
    this.send({
      type: 'authenticate',
      token: this.config.token,
      user_id: this.config.userId,
      restaurant_id: this.config.restaurantId,
    });
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Send queued messages
    this.flushMessageQueue();
    
    // Notify listeners
    this.emit('connected', null);
  }

  /**
   * Handle connection close
   */
  private onClose(event: CloseEvent): void {
    this.isConnected = false;
    this.stopHeartbeat();
    
    // Check close code
    if (event.code === 4003) {
      logger.error('❌ Authentication failed - invalid token');
      this.emit('auth_error', { code: event.code, reason: event.reason });
      return;
    }
    
    // Schedule reconnect for other close reasons
    if (this.retryCount < (this.config.maxRetries || 5)) {
      this.scheduleReconnect();
    } else {
      logger.error('❌ Max reconnection attempts reached');
      this.startPolling();
    }
  }

  /**
   * Handle incoming messages
   */
  private onMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      logger.debug('📨 Received message:', message.type);
      
      // Handle different message types
      switch (message.type) {
        case 'connection_established':
          logger.info('✅ Authentication successful');
          this.emit('authenticated', message);
          break;
          
        case 'heartbeat':
          // Heartbeat response received
          break;
          
        case 'order_update':
          this.emit('order_update', message.data);
          break;
          
        case 'error':
          logger.error('❌ Server error:', message.data);
          this.emit('error', message.data);
          break;
          
        default:
          // Emit generic message event
          this.emit(message.type, message.data);
      }
    } catch (error) {
      logger.error('❌ Failed to parse message:', error);
    }
  }

  /**
   * Send a message
   */
  send(message: WebSocketMessage): void {
    const messageWithTimestamp = {
      ...message,
      timestamp: Date.now(),
    };
    
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(messageWithTimestamp));
        logger.debug('📤 Sent message:', message.type);
      } catch (error) {
        logger.error('❌ Failed to send message:', error);
        this.messageQueue.push(messageWithTimestamp);
      }
    } else {
      // Queue message for later
      this.messageQueue.push(messageWithTimestamp);
      logger.debug('📦 Message queued:', message.type);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'heartbeat',
          timestamp: Date.now(),
        });
      }
    }, this.config.heartbeatInterval || 15000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    const delay = Math.min(
      (this.config.retryDelay || 1000) * Math.pow(2, this.retryCount),
      30000
    );
    
    logger.info(`⏱️ Reconnecting in ${delay}ms (attempt ${this.retryCount + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.retryCount++;
      this.connect();
    }, delay);
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * Start polling fallback
   */
  private startPolling(): void {
    logger.info('📊 Starting polling fallback');
    
    // Poll for updates every 5 seconds
    setInterval(async () => {
      try {
        const response = await fetch(
          `https://fynlopos-9eg2c.ondigitalocean.app/api/v1/orders/active?restaurant_id=${this.config.restaurantId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.config.token}`,
              'X-Restaurant-Id': this.config.restaurantId.toString(),
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          this.emit('order_update', data);
        }
      } catch (error) {
        logger.error('❌ Polling error:', error);
      }
    }, 5000);
  }

  /**
   * Subscribe to events
   */
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)?.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit an event
   */
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`❌ Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    logger.info('🔌 Disconnecting WebSocket');
    
    this.isConnected = false;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.listeners.clear();
    this.messageQueue = [];
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    retryCount: number;
    queuedMessages: number;
  } {
    return {
      connected: this.isConnected,
      retryCount: this.retryCount,
      queuedMessages: this.messageQueue.length,
    };
  }
}

// Singleton instance manager
class WebSocketManager {
  private static instances: Map<string, WebSocketWorkaround> = new Map();

  static getConnection(config: WebSocketConfig): WebSocketWorkaround {
    const key = `${config.restaurantId}_${config.userId}`;
    
    if (!this.instances.has(key)) {
      const instance = new WebSocketWorkaround(config);
      this.instances.set(key, instance);
      instance.connect();
    }
    
    return this.instances.get(key)!;
  }

  static disconnectAll(): void {
    this.instances.forEach(instance => instance.disconnect());
    this.instances.clear();
  }
}

export default WebSocketManager;