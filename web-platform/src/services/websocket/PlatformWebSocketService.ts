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

/**
 * Platform WebSocket Service
 * Handles real-time updates for the platform dashboard
 * Uses shared types and events from @fynlo/shared
 */
export class PlatformWebSocketService {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private messageQueue: WebSocketMessage[] = [];

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      heartbeatInterval: 15000,
      pongTimeout: 5000,
      maxReconnectAttempts: 10,
      authTimeout: 10000,
      reconnectBackoff: [1000, 2000, 4000, 8000, 16000, 30000],
      maxMessageQueueSize: 100,
      ...config
    };
  }

  async connect(): Promise<void> {
    if (this.status !== 'disconnected' && this.status !== 'reconnecting') {
      console.log(`⚠️ WebSocket already ${this.status}`);
      return;
    }

    try {
      this.setStatus('connecting');
      
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authentication session found');
      }

      // Get user details
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No user found');
      }

      // Build WebSocket URL for platform
      const wsProtocol = API_CONFIG.BASE_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_CONFIG.BASE_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/v1/websocket/ws/platform`;
      
      console.log('🔌 Connecting to Platform WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
      
      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.status === 'connecting') {
          console.error('❌ WebSocket connection timeout');
          this.ws?.close();
          this.scheduleReconnect();
        }
      }, 10000);
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connected, authenticating...');
        this.authenticate(session.access_token, user);
      };
      
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
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
        console.error('❌ WebSocket authentication timeout');
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
    if (!this.ws) return;
    
    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    };
    
    this.ws.onclose = (event) => {
      console.log(`🔌 WebSocket disconnected: ${event.code} - ${event.reason}`);
      this.handleDisconnect(event.code, event.reason);
    };
    
    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
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
        console.error('❌ WebSocket auth error:', message.data);
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
    console.log('✅ Platform WebSocket authenticated successfully');
    this.setStatus('connected');
    this.reconnectAttempts = 0;
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Process queued messages
    this.processMessageQueue();
    
    // Emit connected event
    this.emit(WebSocketEvent.CONNECT, { timestamp: Date.now() });
  }

  private handleAuthError(message: WebSocketMessage): void {
    console.error('❌ Authentication error:', message.data);
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
          console.warn('⚠️ Missed pong, reconnecting...');
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
    if (code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('max_reconnect_attempts', {
        attempts: this.reconnectAttempts
      });
      return;
    }
    
    const backoffIndex = Math.min(
      this.reconnectAttempts,
      (this.config.reconnectBackoff?.length || 6) - 1
    );
    const delay = this.config.reconnectBackoff?.[backoffIndex] || 30000;
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.setStatus('reconnecting');
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  send(message: Partial<WebSocketMessage>): void {
    const fullMessage: WebSocketMessage = {
      id: message.id || this.generateMessageId(),
      type: message.type!,
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
        console.log(`📦 Message queued (${this.messageQueue.length} in queue)`);
      } else {
        console.warn('⚠️ Message queue full, dropping message');
      }
    }
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;
    
    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }
  }

  disconnect(): void {
    console.log('👋 Disconnecting Platform WebSocket...');
    
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
    }
    
    this.setStatus('disconnected');
    this.removeAllListeners();
  }

  // Event emitter methods
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
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
        console.error(`Error in WebSocket listener for ${event}:`, error);
      }
    });
  }

  private removeAllListeners(): void {
    this.listeners.clear();
  }

  // Utilities
  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      console.log(`🔄 Platform WebSocket status: ${this.status} → ${newStatus}`);
      this.status = newStatus;
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