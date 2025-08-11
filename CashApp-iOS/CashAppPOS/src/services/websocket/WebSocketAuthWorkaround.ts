/**
 * WebSocketAuthWorkaround - Temporary authentication workarounds for backend issues
 * 
 * This service extends EnhancedWebSocketService to add React Native specific
 * workarounds for WebSocket authentication issues until the backend is fixed.
 * 
 * Key workarounds:
 * 1. Token in Sec-WebSocket-Protocol header (React Native strips query params)
 * 2. Fallback to polling when WebSocket fails
 * 3. Multiple authentication retry strategies
 */

import { EnhancedWebSocketService } from './EnhancedWebSocketService';
import { logger } from '../../utils/logger';
import API_CONFIG from '../../config/api';

interface AuthWorkaroundConfig {
  enableProtocolHeader?: boolean;
  enablePollingFallback?: boolean;
  pollingInterval?: number;
  maxAuthRetries?: number;
}

export class WebSocketAuthWorkaround extends EnhancedWebSocketService {
  private workaroundConfig: AuthWorkaroundConfig;
  private pollingTimer: NodeJS.Timeout | null = null;
  private authRetryCount: number = 0;
  private isUsingFallback: boolean = false;

  constructor(config: any) {
    super(config);
    
    this.workaroundConfig = {
      enableProtocolHeader: true,
      enablePollingFallback: true,
      pollingInterval: 5000,
      maxAuthRetries: 3,
      ...config.workarounds,
    };
  }

  /**
   * Override connect to add protocol header workaround
   */
  async connect(): Promise<void> {
    if (this.workaroundConfig.enableProtocolHeader) {
      return this.connectWithProtocolHeader();
    }
    return super.connect();
  }

  /**
   * Connect using Sec-WebSocket-Protocol header for authentication
   * This works around React Native's query parameter stripping
   */
  private async connectWithProtocolHeader(): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Encode token in base64 for protocol header
      // React Native doesn't have btoa, use Buffer or base64 library
      const encodedToken = this.encodeBase64(token);
      
      // Build WebSocket URL
      const baseUrl = API_CONFIG.WS_URL || 'wss://fynlopos-9eg2c.ondigitalocean.app';
      const restaurantId = this.config.restaurantId || 1;
      const wsUrl = `${baseUrl}/ws/pos/${restaurantId}`;
      
      logger.info('🔌 Attempting WebSocket connection with protocol header workaround');
      
      // Create WebSocket with token in protocol
      // Format: "token, base64_encoded_token"
      this.ws = new WebSocket(wsUrl, ['token', encodedToken]);
      
      this.setupEventHandlers();
      
      // Wait for connection with proper timeout handling
      await new Promise<void>((resolve, reject) => {
        let connectionTimeout: NodeJS.Timeout;
        
        const cleanup = () => {
          clearTimeout(connectionTimeout);
          if (this.ws) {
            this.ws.removeEventListener('open', handleOpen);
            this.ws.removeEventListener('error', handleError);
            this.ws.removeEventListener('close', handleClose);
          }
        };
        
        const handleOpen = () => {
          cleanup();
          logger.info('✅ WebSocket connected (protocol header method)');
          this.state = 'AUTHENTICATING';
          
          // Send backup authentication message
          this.sendAuthMessage(token);
          resolve();
        };
        
        const handleError = (error: Event) => {
          cleanup();
          logger.error('❌ WebSocket error:', error);
          reject(error);
        };
        
        const handleClose = (event: CloseEvent) => {
          cleanup();
          logger.error('❌ WebSocket closed unexpectedly:', event.code, event.reason);
          reject(new Error(`WebSocket closed: ${event.code} ${event.reason}`));
        };
        
        // Set connection timeout
        connectionTimeout = setTimeout(() => {
          cleanup();
          logger.warn('⏱️ Connection timeout, trying fallback');
          reject(new Error('WebSocket connection timeout'));
        }, 10000);
        
        if (this.ws) {
          this.ws.addEventListener('open', handleOpen, { once: true });
          this.ws.addEventListener('error', handleError, { once: true });
          this.ws.addEventListener('close', handleClose, { once: true });
        } else {
          cleanup();
          reject(new Error('WebSocket not initialized'));
        }
      });
      
    } catch (error) {
      logger.error('❌ Protocol header connection failed:', error);
      this.handleConnectionFailure();
    }
  }

  /**
   * Encode string to URL-safe base64 (React Native compatible)
   * Uses URL-safe characters to comply with RFC 6455 WebSocket subprotocol requirements
   */
  private encodeBase64(str: string): string {
    // Use Buffer if available (Node.js environment)
    if (typeof Buffer !== 'undefined') {
      // Use URL-safe base64 encoding (replaces +/ with -_)
      return Buffer.from(str).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');  // Remove padding
    }
    
    // Fallback to manual URL-safe base64 encoding for React Native
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    let i = 0;
    
    while (i < str.length) {
      const a = str.charCodeAt(i++);
      const b = i < str.length ? str.charCodeAt(i++) : 0;
      const c = i < str.length ? str.charCodeAt(i++) : 0;
      
      const bitmap = (a << 16) | (b << 8) | c;
      
      result += chars.charAt((bitmap >> 18) & 63);
      result += chars.charAt((bitmap >> 12) & 63);
      // No padding for URL-safe base64
      if (i - 2 < str.length) result += chars.charAt((bitmap >> 6) & 63);
      if (i - 1 < str.length) result += chars.charAt(bitmap & 63);
    }
    
    return result;
  }

  /**
   * Send authentication message as backup
   */
  private async sendAuthMessage(token: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const authMessage = {
      type: 'authenticate',
      token: token,
      user_id: this.config.userId,
      restaurant_id: this.config.restaurantId,
      timestamp: Date.now(),
    };

    try {
      this.ws.send(JSON.stringify(authMessage));
      logger.info('📤 Sent authentication message');
    } catch (error) {
      logger.error('❌ Failed to send auth message:', error);
    }
  }

  /**
   * Handle connection failure with fallback strategies
   */
  private async handleConnectionFailure(): Promise<void> {
    this.authRetryCount++;
    
    if (this.authRetryCount >= (this.workaroundConfig.maxAuthRetries || 3)) {
      logger.warn('⚠️ Max auth retries reached, switching to polling fallback');
      
      if (this.workaroundConfig.enablePollingFallback) {
        this.startPollingFallback();
      } else {
        // Fall back to parent reconnection logic
        super.handleReconnection();
      }
    } else {
      logger.info(`🔄 Retrying authentication (attempt ${this.authRetryCount})...`);
      
      // Wait before retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, this.authRetryCount), 10000);
      setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  /**
   * Start polling fallback when WebSocket fails
   */
  private startPollingFallback(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    this.isUsingFallback = true;
    logger.info('📊 Starting polling fallback for real-time updates');
    
    // Initial poll
    this.pollForUpdates();
    
    // Set up polling interval
    this.pollingTimer = setInterval(() => {
      this.pollForUpdates();
    }, this.workaroundConfig.pollingInterval || 5000);
  }

  /**
   * Poll for updates when WebSocket is unavailable
   */
  private async pollForUpdates(): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        logger.warn('⚠️ No token for polling');
        return;
      }

      const response = await fetch(
        `${API_CONFIG.API_URL}/api/v1/orders/active?restaurant_id=${this.config.restaurantId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Restaurant-Id': String(this.config.restaurantId),
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Emit update event
        this.emit('order_update', {
          type: 'order_update',
          data: data,
          timestamp: Date.now(),
          source: 'polling',
        });
        
        logger.debug('📊 Polling update received');
      } else if (response.status === 401) {
        logger.warn('⚠️ Polling authentication failed');
        this.stopPollingFallback();
      }
    } catch (error) {
      logger.error('❌ Polling error:', error);
    }
  }

  /**
   * Stop polling fallback
   */
  private stopPollingFallback(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isUsingFallback = false;
    logger.info('📊 Stopped polling fallback');
  }

  /**
   * Get authentication token
   */
  private async getAuthToken(): Promise<string | null> {
    // Try multiple sources for token
    try {
      // 1. From config
      if (this.config.token) {
        return this.config.token;
      }
      
      // 2. From token manager
      const tokenManager = require('../../utils/tokenManager').default;
      const token = await tokenManager.getToken();
      if (token) {
        return token;
      }
      
      // 3. From AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const storedToken = await AsyncStorage.getItem('auth_token');
      if (storedToken) {
        return storedToken;
      }
      
      return null;
    } catch (error) {
      logger.error('❌ Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * Override disconnect to clean up polling
   */
  disconnect(): void {
    this.stopPollingFallback();
    this.authRetryCount = 0;
    super.disconnect();
  }

  /**
   * Check if using fallback mode
   */
  isInFallbackMode(): boolean {
    return this.isUsingFallback;
  }

  /**
   * Get connection status including fallback info
   */
  getStatus(): any {
    const baseStatus = super.getStatus();
    return {
      ...baseStatus,
      isUsingFallback: this.isUsingFallback,
      authRetryCount: this.authRetryCount,
      workaroundsEnabled: this.workaroundConfig,
    };
  }
}

// Export singleton instance
let instance: WebSocketAuthWorkaround | null = null;

export function getWebSocketWithWorkaround(config: any): WebSocketAuthWorkaround {
  if (!instance) {
    instance = new WebSocketAuthWorkaround(config);
  }
  return instance;
}

export default WebSocketAuthWorkaround;