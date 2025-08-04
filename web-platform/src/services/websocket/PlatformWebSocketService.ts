import { 
  WebSocketMessage, 
  WebSocketConfig, 
  WebSocketEvent,
  ConnectionStatus,
  Restaurant,
  Order,
  User
} from '../../types';
import { API_CONFIG } from '@/config/api.config';
import { supabase } from '@/integrations/supabase/client';
import { ExponentialBackoff } from '@fynlo/shared/src/utils/exponentialBackoff';

/**
 * Platform WebSocket Service
 * Handles real-time updates for the platform dashboard
 * Uses shared types and events from @fynlo/shared
 */
export class PlatformWebSocketService {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private config: WebSocketConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private exponentialBackoff: ExponentialBackoff;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      heartbeatInterval: 15000,
      pongTimeout: 5000,
      maxReconnectAttempts: 10,
      authTimeout: 10000,
      maxMessageQueueSize: 100,
      ...config
    };

    // Initialize exponential backoff with configuration
    this.exponentialBackoff = new ExponentialBackoff(
      1000,  // baseDelay: 1 second
      30000, // maxDelay: 30 seconds
      this.config.maxReconnectAttempts || 10,
      0.3    // jitterFactor: ±30%
    );
  }

  async connect(): Promise<void> {
    if (this.status \!== 'disconnected' && this.status \!== 'reconnecting') {
      return;
    }

    try {
      this.setStatus('connecting');
      
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (\!session) {
        throw new Error('No authentication session found');
      }

      // Get user details
      const { data: { user } } = await supabase.auth.getUser();
      if (\!user) {
        throw new Error('No user found');
      }

      // Build WebSocket URL for platform
      const wsProtocol = API_CONFIG.BASE_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_CONFIG.BASE_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/v1/websocket/ws/platform`;
      
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
      
      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.status === 'connecting') {
          this.ws?.close();
          this.scheduleReconnect();
        }
      }, 10000);
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        this.authenticate(session.access_token, user);
      };
      
    } catch (error) {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private async authenticate(token: string, user: any): Promise<void> {
    this.setStatus('authenticated');
    
    const authMessage: WebSocketMessage = {
      id: this.generateMessageId(),
      type: WebSocketEvent.AUTHENTICATE,
      data: {
        user_id: user.id,
        client_type: 'platform_dashboard',
        client_version: '1.0.0'
      },
      restaurant_id: '', // Platform level, no specific restaurant
      timestamp: new Date().toISOString(),
      token
    };
    
    this.ws?.send(JSON.stringify(authMessage));
    
    // Set authentication timeout
    const authTimeout = setTimeout(() => {
      if (this.status === 'authenticated') {
        this.handleDisconnect(4002, 'Authentication timeout');
      }
    }, this.config.authTimeout);
    
    // Clear timeout on success
    this.once(WebSocketEvent.AUTHENTICATED, () => {
      clearTimeout(authTimeout);
      this.handleAuthenticated();
    });
  }

  private setupEventHandlers(): void {
    if (\!this.ws) return;
    
    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    this.ws.onclose = (event) => {
      this.handleDisconnect(event.code, event.reason);
    };
    
    this.ws.onerror = (error) => {
      this.emit(WebSocketEvent.ERROR, error);
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case WebSocketEvent.AUTHENTICATED:
        this.handleAuthenticated();
        break;
        
      case WebSocketEvent.PONG:
        this.handlePong();
        break;
        
      case WebSocketEvent.PING:
        this.send({
          id: this.generateMessageId(),
          type: WebSocketEvent.PONG,
          data: { timestamp: Date.now() },
          restaurant_id: '',
          timestamp: new Date().toISOString()
        });
        break;
        
      case WebSocketEvent.AUTH_ERROR:
        this.handleAuthError(message);
        break;
        
      // Platform-specific events
      case 'restaurant.created':
      case 'restaurant.updated':
      case 'restaurant.deleted':
        this.emit(message.type, message.data as Restaurant);
        break;
        
      case 'platform.metrics':
      case 'platform.alert':
        this.emit(message.type, message.data);
        break;
        
      default:
        // Generic event emission
        this.emit(message.type, message.data);
        break;
    }
  }

  private handleAuthenticated(): void {
    this.setStatus('connected');
    
    // Reset exponential backoff on successful authentication
    this.exponentialBackoff.reset();
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Process queued messages
    this.processMessageQueue();
    
    // Emit connected event
    this.emit(WebSocketEvent.CONNECT, { timestamp: Date.now() });
  }

  private handleAuthError(message: WebSocketMessage): void {
    this.emit(WebSocketEvent.AUTH_ERROR, message.data);
    this.setStatus('disconnected');
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const pingMessage: WebSocketMessage = {
          id: this.generateMessageId(),
          type: WebSocketEvent.PING,
          data: { timestamp: Date.now() },
          restaurant_id: '',
          timestamp: new Date().toISOString()
        };
        
        this.send(pingMessage);
        
        // Set pong timeout
        this.pongTimer = setTimeout(() => {
          this.handleDisconnect(4004, 'Heartbeat timeout');
        }, this.config.pongTimeout);
      }
    }, this.config.heartbeatInterval);
  }

  private handlePong(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private handleDisconnect(code: number, reason: string): void {
    this.stopHeartbeat();
    this.setStatus('disconnected');
    
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws = null;
    }
    
    this.emit(WebSocketEvent.DISCONNECT, { code, reason });
    
    // Schedule reconnect for non-normal closures
    if (code \!== 1000) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Check if max attempts reached
    if (this.exponentialBackoff.hasReachedMaxAttempts()) {
      this.emit('max_reconnect_attempts', {
        attempts: this.exponentialBackoff.getAttemptCount(),
        maxAttempts: this.config.maxReconnectAttempts
      });
      
      // Emit final reconnection status
      this.emit('reconnection_status', {
        status: 'failed',
        attemptNumber: this.exponentialBackoff.getAttemptCount(),
        remainingAttempts: 0,
        nextDelay: null,
        message: 'Maximum reconnection attempts reached'
      });
      return;
    }
    
    try {
      // Get next delay from exponential backoff
      const delay = this.exponentialBackoff.getNextDelay();
      const attemptNumber = this.exponentialBackoff.getAttemptCount();
      const remainingAttempts = this.exponentialBackoff.getRemainingAttempts();
      
      // Emit reconnection status event for UI feedback
      this.emit('reconnection_status', {
        status: 'scheduled',
        attemptNumber,
        remainingAttempts,
        nextDelay: delay,
        message: `Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${attemptNumber}/${this.config.maxReconnectAttempts})`
      });
      
      console.log(`Platform WebSocket: Scheduling reconnect in ${delay}ms (attempt ${attemptNumber}/${this.config.maxReconnectAttempts})`);
      this.setStatus('reconnecting');
      
      this.reconnectTimer = setTimeout(() => {
        // Emit attempting status
        this.emit('reconnection_status', {
          status: 'attempting',
          attemptNumber,
          remainingAttempts,
          nextDelay: null,
          message: `Attempting reconnection (${attemptNumber}/${this.config.maxReconnectAttempts})`
        });
        
        this.connect();
      }, delay);
    } catch (error) {
      // This should only happen if max attempts exceeded
      this.emit('reconnection_status', {
        status: 'failed',
        attemptNumber: this.exponentialBackoff.getAttemptCount(),
        remainingAttempts: 0,
        nextDelay: null,
        message: 'Failed to schedule reconnection'
      });
    }
  }

  send(message: Partial<WebSocketMessage>): void {
    const fullMessage: WebSocketMessage = {
      id: message.id || this.generateMessageId(),
      type: message.type\!,
      data: message.data,
      restaurant_id: message.restaurant_id || '',
      timestamp: message.timestamp || new Date().toISOString()
    };
    
    if (this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      // Queue message for later
      if (this.messageQueue.length < (this.config.maxMessageQueueSize || 100)) {
        this.messageQueue.push(fullMessage);
        console.log(`Platform WebSocket: Message queued (${this.messageQueue.length} in queue)`);
      } else {
        console.warn('Platform WebSocket: Message queue full, dropping message');
      }
    }
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;
    
    console.log(`Platform WebSocket: Processing ${this.messageQueue.length} queued messages`);
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()\!;
      this.send(message);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Reset exponential backoff when manually disconnecting
    this.exponentialBackoff.reset();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
    }
    
    this.setStatus('disconnected');
    this.removeAllListeners();
  }

  // Event emitter methods
  on(event: string, listener: Function): void {
    if (\!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)\!.add(listener);
  }

  once(event: string, listener: Function): void {
    const onceWrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }

  off(event: string, listener: Function): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Platform WebSocket: Error in event listener for '${event}':`, error);
      }
    });
  }

  private removeAllListeners(): void {
    this.listeners.clear();
  }

  // Utilities
  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status \!== newStatus) {
      this.status = newStatus;
      console.log(`Platform WebSocket: Status changed to ${newStatus}`);
    }
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'connected';
  }

  // Platform-specific methods
  subscribeToRestaurant(restaurantId: string): void {
    this.send({
      type: 'platform.subscribe',
      data: { restaurant_id: restaurantId }
    });
  }

  unsubscribeFromRestaurant(restaurantId: string): void {
    this.send({
      type: 'platform.unsubscribe',
      data: { restaurant_id: restaurantId }
    });
  }

  requestPlatformMetrics(): void {
    this.send({
      type: 'platform.metrics.request',
      data: { timestamp: Date.now() }
    });
  }
}

// Export singleton instance
export const platformWebSocket = new PlatformWebSocketService();
export default platformWebSocket;
