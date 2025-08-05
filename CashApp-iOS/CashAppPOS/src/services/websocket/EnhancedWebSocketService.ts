import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { ExponentialBackoff } from '@fynlo/shared/src/utils/exponentialBackoff';

import API_CONFIG from '../../config/api';
import { WebSocketEvent } from '../../types/websocket';
import tokenManager from '../../utils/enhancedTokenManager';
import logger from '../../utils/logger';

import type { WebSocketMessage, WebSocketConfig } from '../../types/websocket';

type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'AUTHENTICATING'
  | 'CONNECTED'
  | 'RECONNECTING';

export class EnhancedWebSocketService {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'DISCONNECTED';
  private config: WebSocketConfig;

  // Heartbeat mechanism
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private missedPongs: number = 0;
  private maxMissedPongs: number = 3;

  // Reconnection logic
  private reconnectTimer: NodeJS.Timeout | null = null;
  private exponentialBackoff: ExponentialBackoff;

  // Message queue for offline/reconnecting
  private messageQueue: WebSocketMessage[] = [];
  private maxQueueSize: number = 100; // Prevent unbounded growth
  private listeners: Map<string, Set<Function>> = new Map();

  // Network monitoring
  private networkUnsubscribe: (() => void) | null = null;

  // Refresh timer
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      heartbeatInterval: 15000, // 15 seconds
      pongTimeout: 5000, // 5 seconds
      maxReconnectAttempts: 10,
      authTimeout: 10000, // 10 seconds
      ...config,
    };

    // Initialize exponential backoff with proper configuration
    this.exponentialBackoff = new ExponentialBackoff(
      1000, // baseDelay: 1 second
      30000, // maxDelay: 30 seconds max
      10, // maxAttempts
      0.3 // jitterFactor: 30%
    );

    this.setupNetworkMonitoring();
    this.setupTokenRefreshListener();
  }

  private setupNetworkMonitoring(): void {
    this.networkUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        if (this.state === 'DISCONNECTED') {
          logger.info('📱 Network restored, reconnecting WebSocket...');
          this.connect();
        }
      } else if (this.state === 'CONNECTED') {
        logger.info('📱 Network lost, WebSocket will reconnect when available');
        this.handleDisconnect(4001, 'Network unavailable');
      }
    });
  }

  async connect(): Promise<void> {
    if (this.state !== 'DISCONNECTED' && this.state !== 'RECONNECTING') {
      logger.info(`⚠️ WebSocket already ${this.state}`);
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
      // Allow users without restaurants to connect (for onboarding)
      const restaurantId = user.restaurant_id || 'onboarding';

      // Build WebSocket URL (no token in URL for security)
      const wsProtocol = API_CONFIG.BASE_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_CONFIG.BASE_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/v1/websocket/ws/pos/${restaurantId}`;

      logger.info('🔌 Connecting to WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.state === 'CONNECTING') {
          logger.error('❌ WebSocket connection timeout');
          this.ws?.close();
          this.scheduleReconnect();
        }
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        logger.info('✅ WebSocket connected, authenticating...');
        this.authenticate();
      };
    } catch (error) {
      logger.error('❌ WebSocket connection failed:', error);
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
          token,
          user_id: user.id,
          restaurant_id: user.restaurant_id || 'onboarding',
          client_type: 'mobile_pos',
          client_version: '1.0.0',
        },
        restaurant_id: user.restaurant_id || 'onboarding',
        timestamp: new Date().toISOString(),
      };

      // Send auth message
      this.ws?.send(JSON.stringify(authMessage));

      // Set authentication timeout
      const authTimeout = setTimeout(() => {
        if (this.state === 'AUTHENTICATING') {
          logger.error('❌ WebSocket authentication timeout');
          this.handleDisconnect(4002, 'Authentication timeout');
        }
      }, this.config.authTimeout);

      // Store timeout to clear on success
      this.once(WebSocketEvent.AUTHENTICATED, () => {
        clearTimeout(authTimeout);
      });
    } catch (error) {
      logger.error('❌ WebSocket authentication failed:', error);
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
        logger.error('❌ Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      logger.info(`🔌 WebSocket disconnected: ${event.code} - ${event.reason}`);
      this.handleDisconnect(event.code, event.reason);
    };

    this.ws.onerror = (error) => {
      logger.error('❌ WebSocket error:', error);
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
          timestamp: new Date().toISOString(),
        });
        break;

      case WebSocketEvent.AUTH_ERROR:
        logger.error('❌ WebSocket auth error:', message.data);
        this.handleAuthError(message);
        break;
      
      case WebSocketEvent.TOKEN_EXPIRED:
        logger.warn('⚠️ WebSocket token expiring:', message.data);
        this.handleTokenExpired(message);
        break;

      default:
        // Business event, emit to listeners
        this.emit(message.type, message.data);
        break;
    }
  }

  private handleAuthenticated(): void {
    logger.info('✅ WebSocket authenticated successfully');
    this.setState('CONNECTED');
    
    // Reset exponential backoff on successful connection
    this.exponentialBackoff.reset();

    // Start heartbeat
    this.startHeartbeat();

    // Process queued messages
    this.processMessageQueue();

    // Emit connected event
    this.emit(WebSocketEvent.CONNECT, { timestamp: Date.now() });
  }

  private handleAuthError(message: WebSocketMessage): void {
    logger.error('❌ Authentication error:', message.data);

    // Try to refresh token and reconnect
    tokenManager
      .forceRefresh()
      .then(() => {
        this.scheduleReconnect();
      })
      .catch(() => {
        this.emit(WebSocketEvent.AUTH_ERROR, message.data);
        this.setState('DISCONNECTED');
      });
  }
  
  private setupTokenRefreshListener(): void {
    // Listen for token refresh events from tokenManager
    tokenManager.on('token:refreshed', async (newToken: string) => {
      if (this.state === 'CONNECTED' && this.ws?.readyState === WebSocket.OPEN) {
        logger.info('🔄 Token refreshed, re-authenticating WebSocket...');
        await this.reauthenticate(newToken);
      }
    });
  }
  
  private async handleTokenExpired(message: WebSocketMessage): Promise<void> {
    const secondsUntilExpiry = message.data?.seconds_until_expiry || 0;
    logger.warn(`⚠️ Token expiring in ${secondsUntilExpiry} seconds`);
    
    // Refresh token proactively
    try {
      const newToken = await tokenManager.forceRefresh();
      if (newToken && this.state === 'CONNECTED') {
        await this.reauthenticate(newToken);
      }
    } catch (error) {
      logger.error('❌ Failed to refresh token:', error);
      this.handleDisconnect(4005, 'Token refresh failed');
    }
  }
  
  private async reauthenticate(newToken: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('⚠️ Cannot re-authenticate, WebSocket not connected');
      return;
    }
    
    try {
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (!userInfo) return;
      
      const user = JSON.parse(userInfo);
      
      // Send re-authentication message
      const reauthMessage: WebSocketMessage = {
        id: this.generateMessageId(),
        type: WebSocketEvent.REAUTH,
        data: {
          token: newToken,
          user_id: user.id,
          restaurant_id: user.restaurant_id || 'onboarding',
        },
        restaurant_id: user.restaurant_id || 'onboarding',
        timestamp: new Date().toISOString(),
      };
      
      this.ws.send(JSON.stringify(reauthMessage));
      logger.info('✅ Re-authentication message sent');
    } catch (error) {
      logger.error('❌ Re-authentication failed:', error);
    }
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
          timestamp: new Date().toISOString(),
        };

        this.send(pingMessage);

        // Set pong timeout
        this.pongTimer = setTimeout(() => {
          this.missedPongs++;
          logger.warn(`⚠️ Missed pong ${this.missedPongs}/${this.maxMissedPongs}`);

          if (this.missedPongs >= this.maxMissedPongs) {
            logger.error('❌ Too many missed pongs, reconnecting...');
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

    const currentAttempt = this.exponentialBackoff.getAttemptCount();
    
    if (currentAttempt >= this.config.maxReconnectAttempts) {
      logger.error('❌ Max reconnection attempts reached');
      this.emit('max_reconnect_attempts', {
        attempts: currentAttempt,
      });
      return;
    }

    const delay = this.exponentialBackoff.getNextDelay();
    const nextAttempt = currentAttempt + 1;

    logger.info(`🔄 Reconnecting in ${delay}ms (attempt ${nextAttempt})`);
    this.setState('RECONNECTING');

    // Emit reconnection status for UI feedback
    this.emit('reconnection_status', {
      attempt: nextAttempt,
      maxAttempts: this.config.maxReconnectAttempts,
      nextDelay: delay,
      timestamp: Date.now(),
    });

    this.reconnectTimer = setTimeout(() => {
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
      timestamp: message.timestamp || new Date().toISOString(),
    };

    if (this.state === 'CONNECTED' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      // Queue message for later (with size limit)
      if (this.messageQueue.length < this.maxQueueSize) {
        this.messageQueue.push(fullMessage);
        logger.info(`📦 Message queued (${this.messageQueue.length} in queue)`);
      } else {
        logger.warn(`⚠️ Message queue full (${this.maxQueueSize} messages), dropping oldest`);
        this.messageQueue.shift(); // Remove oldest
        this.messageQueue.push(fullMessage);
      }
    }
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    logger.info(`📤 Processing ${this.messageQueue.length} queued messages`);

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }
  }

  disconnect(): void {
    logger.info('👋 Disconnecting WebSocket...');

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

    // Reset exponential backoff when disconnecting
    this.exponentialBackoff.reset();

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
    const onceWrapper = (...args: unknown[]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }

  off(event: string, listener: Function): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        logger.error(`Error in WebSocket listener for ${event}:`, error);
      }
    });
  }

  private removeAllListeners(): void {
    this.listeners.clear();
  }

  // Utilities
  private setState(newState: ConnectionState): void {
    // Validate state transitions
    const validTransitions: Record<ConnectionState, ConnectionState[]> = {
      DISCONNECTED: ['CONNECTING', 'RECONNECTING'],
      CONNECTING: ['AUTHENTICATING', 'DISCONNECTED', 'RECONNECTING'],
      AUTHENTICATING: ['CONNECTED', 'DISCONNECTED', 'RECONNECTING'],
      CONNECTED: ['DISCONNECTED', 'RECONNECTING'],
      RECONNECTING: ['CONNECTING', 'DISCONNECTED'],
    };

    if (this.state !== newState) {
      if (!validTransitions[this.state]?.includes(newState)) {
        logger.warn(`⚠️ Invalid state transition: ${this.state} → ${newState}`);
        return;
      }

      logger.info(`🔄 WebSocket state: ${this.state} → ${newState}`);
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
