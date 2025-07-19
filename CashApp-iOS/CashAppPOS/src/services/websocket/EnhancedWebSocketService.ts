import { WebSocketMessage, WebSocketConfig, WebSocketEvent, WebSocketEventType } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import tokenManager from '../../utils/enhancedTokenManager';
import API_CONFIG from '../../config/api';

type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'AUTHENTICATING' | 'CONNECTED' | 'RECONNECTING';

export class EnhancedWebSocketService {
  private static instance: EnhancedWebSocketService;
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'DISCONNECTED';
  private config: WebSocketConfig;
  
  static getInstance(): EnhancedWebSocketService {
    if (!EnhancedWebSocketService.instance) {
      EnhancedWebSocketService.instance = new EnhancedWebSocketService();
    }
    return EnhancedWebSocketService.instance;
  }
  
  // Heartbeat mechanism
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private missedPongs: number = 0;
  private maxMissedPongs: number = 3;
  
  // Reconnection logic
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectBackoff: number[] = [1000, 2000, 4000, 8000, 16000, 30000];
  
  // Message queue for offline/reconnecting
  private messageQueue: WebSocketMessage[] = [];
  private listeners: Map<string, Set<Function>> = new Map();
  
  // Network monitoring
  private networkUnsubscribe: (() => void) | null = null;
  
  // Refresh timer
  private refreshTimer: NodeJS.Timeout | null = null;
  
  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      heartbeatInterval: 15000, // 15 seconds
      pongTimeout: 5000,        // 5 seconds
      maxReconnectAttempts: 10,
      authTimeout: 10000,       // 10 seconds
      ...config
    };
    
    this.setupNetworkMonitoring();
  }
  
  private setupNetworkMonitoring(): void {
    this.networkUnsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        if (this.state === 'DISCONNECTED') {
          console.log('📱 Network restored, reconnecting WebSocket...');
          this.connect();
        }
      } else if (this.state === 'CONNECTED') {
        console.log('📱 Network lost, WebSocket will reconnect when available');
        this.handleDisconnect(4001, 'Network unavailable');
      }
    });
  }
  
  async connect(): Promise<void> {
    if (this.state !== 'DISCONNECTED' && this.state !== 'RECONNECTING') {
      console.log(`⚠️ WebSocket already ${this.state}`);
      return;
    }
    
    try {
      this.setState('CONNECTING');
      
      // Get connection parameters
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (!userInfo) {
        throw new Error('No user authentication found');
      }
      
      const user = JSON.parse(userInfo);
      if (!user.restaurant_id) {
        throw new Error('No restaurant associated with user');
      }
      
      // Build WebSocket URL (no token in URL for security)
      const wsProtocol = API_CONFIG.BASE_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_CONFIG.BASE_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/v1/websocket/ws/pos/${user.restaurant_id}`;
      
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
      
      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.state === 'CONNECTING') {
          console.error('❌ WebSocket connection timeout');
          this.ws?.close();
          this.scheduleReconnect();
        }
      }, 10000);
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connected, authenticating...');
        this.authenticate();
      };
      
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      this.setState('DISCONNECTED');
      this.scheduleReconnect();
    }
  }
  
  private async authenticate(): Promise<void> {
    this.setState('AUTHENTICATING');
    
    try {
      const token = await tokenManager.getTokenWithRefresh();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const userInfo = await AsyncStorage.getItem('userInfo');
      const user = JSON.parse(userInfo!);
      
      const authMessage: WebSocketMessage = {
        id: this.generateMessageId(),
        type: WebSocketEvent.AUTHENTICATE,
        data: {
          token: token,
          user_id: user.id,
          restaurant_id: user.restaurant_id,
          client_type: 'mobile_pos',
          client_version: '1.0.0'
        },
        restaurant_id: user.restaurant_id,
        timestamp: new Date().toISOString()
      };
      
      // Send auth message
      this.ws?.send(JSON.stringify(authMessage));
      
      // Set authentication timeout
      const authTimeout = setTimeout(() => {
        if (this.state === 'AUTHENTICATING') {
          console.error('❌ WebSocket authentication timeout');
          this.handleDisconnect(4002, 'Authentication timeout');
        }
      }, this.config.authTimeout);
      
      // Store timeout to clear on success
      this.once(WebSocketEvent.AUTHENTICATED, () => {
        clearTimeout(authTimeout);
      });
      
    } catch (error) {
      console.error('❌ WebSocket authentication failed:', error);
      this.handleDisconnect(4003, 'Authentication failed');
    }
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
        // Server ping, respond with pong
        this.send({
          id: this.generateMessageId(),
          type: WebSocketEvent.PONG,
          data: { timestamp: Date.now() },
          restaurant_id: message.restaurant_id,
          timestamp: new Date().toISOString()
        });
        break;
        
      case WebSocketEvent.AUTH_ERROR:
        console.error('❌ WebSocket auth error:', message.data);
        this.handleAuthError(message);
        break;
        
      default:
        // Business event, emit to listeners
        this.emit(message.type, message.data);
        break;
    }
  }
  
  private handleAuthenticated(): void {
    console.log('✅ WebSocket authenticated successfully');
    this.setState('CONNECTED');
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
    
    // Try to refresh token and reconnect
    tokenManager.forceRefresh().then(() => {
      this.scheduleReconnect();
    }).catch(() => {
      this.emit(WebSocketEvent.AUTH_ERROR, message.data);
      this.setState('DISCONNECTED');
    });
  }
  
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const pingMessage: WebSocketMessage = {
          id: this.generateMessageId(),
          type: WebSocketEvent.PING,
          data: { timestamp: Date.now() },
          restaurant_id: '', // Will be set by send()
          timestamp: new Date().toISOString()
        };
        
        this.send(pingMessage);
        
        // Set pong timeout
        this.pongTimer = setTimeout(() => {
          this.missedPongs++;
          console.warn(`⚠️ Missed pong ${this.missedPongs}/${this.maxMissedPongs}`);
          
          if (this.missedPongs >= this.maxMissedPongs) {
            console.error('❌ Too many missed pongs, reconnecting...');
            this.handleDisconnect(4004, 'Heartbeat timeout');
          }
        }, this.config.pongTimeout);
      }
    }, this.config.heartbeatInterval);
  }
  
  private handlePong(): void {
    this.missedPongs = 0;
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
    this.missedPongs = 0;
  }
  
  private handleDisconnect(code: number, reason: string): void {
    this.stopHeartbeat();
    this.setState('DISCONNECTED');
    
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
    
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('max_reconnect_attempts', {
        attempts: this.reconnectAttempts
      });
      return;
    }
    
    const backoffIndex = Math.min(
      this.reconnectAttempts,
      this.reconnectBackoff.length - 1
    );
    const delay = this.reconnectBackoff[backoffIndex];
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.setState('RECONNECTING');
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  send(message: Partial<WebSocketMessage>): void {
    // Fill in required fields
    const fullMessage: WebSocketMessage = {
      id: message.id || this.generateMessageId(),
      type: message.type!,
      data: message.data,
      restaurant_id: message.restaurant_id || '',
      timestamp: message.timestamp || new Date().toISOString()
    };
    
    if (this.state === 'CONNECTED' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      // Queue message for later
      this.messageQueue.push(fullMessage);
      console.log(`📦 Message queued (${this.messageQueue.length} in queue)`);
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
    console.log('👋 Disconnecting WebSocket...');
    
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
    }
    
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    
    this.setState('DISCONNECTED');
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
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      console.log(`🔄 WebSocket state: ${this.state} → ${newState}`);
      this.state = newState;
    }
  }
  
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  getState(): ConnectionState {
    return this.state;
  }
  
  isConnected(): boolean {
    return this.state === 'CONNECTED';
  }
}

// Export singleton instance
export const webSocketService = new EnhancedWebSocketService();
export default webSocketService;

// Re-export types for convenience
export { WebSocketEventType } from './types';