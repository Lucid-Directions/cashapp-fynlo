import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { AUTH_CONFIG } from '../config/auth.config';

interface TokenCache {
  token: string | null;
  expiresAt: number | null;
  lastRefresh: number;
}

interface QueuedRequest {
  resolve: (token: string | null) => void;
  reject: (error: Error) => void;
}

class EnhancedTokenManager {
  private static instance: EnhancedTokenManager;

  // Mutex for token refresh
  private refreshPromise: Promise<string | null> | null = null;
  private requestQueue: QueuedRequest[] = [];

  // Token cache
  private tokenCache: TokenCache = {
    token: null,
    expiresAt: null,
    lastRefresh: 0,
  };

  // Configuration
  private readonly refreshBuffer = 60; // Refresh 60 seconds before expiry
  private readonly minRefreshInterval = 5000; // Don't refresh more than once per 5s

  // Event listeners
  private listeners: Map<string, Set<Function>> = new Map();

  // Refresh timer
  private refreshTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.loadCachedToken();
    this.setupTokenRefreshTimer();
  }

  static getInstance(): EnhancedTokenManager {
    if (!EnhancedTokenManager.instance) {
      EnhancedTokenManager.instance = new EnhancedTokenManager();
    }
    return EnhancedTokenManager.instance;
  }

  private async loadCachedToken(): Promise<void> {
    try {
      const [token, sessionData] = await Promise.all([
        AsyncStorage.getItem('auth_token'),
        AsyncStorage.getItem('supabase_session'),
      ]);

      if (token && sessionData) {
        const session = JSON.parse(_sessionData);
        this.tokenCache = {
          token,
          expiresAt: session.expires_at,
          lastRefresh: Date.now(),
        };
      }
    } catch (_error) {}
  }

  async getTokenWithRefresh(): Promise<string | null> {
    // Mock auth bypass
    if (AUTH_CONFIG.USE_MOCK_AUTH) {
      return await AsyncStorage.getItem('auth_token');
    }

    // Check if token is valid
    if (this.isTokenValid()) {
      return this.tokenCache.token;
    }

    // If refresh is in progress, queue this request
    if (this.refreshPromise) {
      return new Promise((_resolve, reject) => {
        this.requestQueue.push({ resolve, reject });
      });
    }

    // Check minimum refresh interval
    const now = Date.now();
    if (now - this.tokenCache.lastRefresh < this.minRefreshInterval) {
      return this.tokenCache.token;
    }

    // Perform refresh
    return this.performRefresh();
  }

  private isTokenValid(): boolean {
    if (!this.tokenCache.token || !this.tokenCache.expiresAt) {
      return false;
    }

    // Validate JWT structure
    try {
      const parts = this.tokenCache.token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      // Decode and validate payload
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);

      // Check expiration with buffer
      const expiresAt = Math.min(payload.exp || Infinity, this.tokenCache.expiresAt);

      return now < expiresAt - this.refreshBuffer;
    } catch (_error) {
      return false;
    }
  }

  private async performRefresh(): Promise<string | null> {
    // Set refresh promise to prevent concurrent refreshes
    this.refreshPromise = this.doRefresh();

    try {
      const token = await this.refreshPromise;

      // Process queued requests
      this.processQueue(_null, token);

      return token;
    } catch (_error) {
      // Process queue with error
      this.processQueue(error as Error, null);
      throw error;
    } finally {
      // Clear refresh promise
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<string | null> {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (_error) {
        this.emit('token:refresh:failed', error);
        throw error;
      }

      if (!data.session) {
        const noSessionError = new Error('No session after refresh');
        this.emit('token:refresh:failed', noSessionError);
        throw noSessionError;
      }

      // Update cache
      this.tokenCache = {
        token: data.session.access_token,
        expiresAt: data.session.expires_at,
        lastRefresh: Date.now(),
      };

      // Persist to storage
      await Promise.all([
        AsyncStorage.setItem('auth_token', data.session.access_token),
        AsyncStorage.setItem('supabase_session', JSON.stringify(data.session)),
      ]);

      this.emit('token:refreshed', data.session.access_token);

      // Reset refresh timer
      this.setupTokenRefreshTimer();

      return data.session.access_token;
    } catch (_error) {
      this.emit('token:refresh:failed', error);

      // Clear invalid token
      this.tokenCache = {
        token: null,
        expiresAt: null,
        lastRefresh: Date.now(),
      };

      throw error;
    }
  }

  private processQueue(error: Error | null, token: string | null): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    queue.forEach(({ resolve, reject }) => {
      if (_error) {
        reject(_error);
      } else {
        resolve(_token);
      }
    });
  }

  private setupTokenRefreshTimer(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.tokenCache.expiresAt) {
      return;
    }

    // Calculate time until refresh needed
    const now = Math.floor(Date.now() / 1000);
    const refreshAt = this.tokenCache.expiresAt - this.refreshBuffer;
    const delaySeconds = Math.max(refreshAt - now, 0);

    if (delaySeconds > 0) {
      this.refreshTimer = setTimeout(() => {
        this.getTokenWithRefresh().catch(error => {});
      }, delaySeconds * 1000);
    }
  }

  async forceRefresh(): Promise<string | null> {
    // Clear cache to force refresh
    this.tokenCache.expiresAt = 0;

    return this.getTokenWithRefresh();
  }

  async clearTokens(): Promise<void> {
    // Clear cache
    this.tokenCache = {
      token: null,
      expiresAt: null,
      lastRefresh: 0,
    };

    // Clear storage
    await AsyncStorage.multiRemove(['auth_token', 'supabase_session', 'userInfo']);

    // Clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.emit('token:cleared');
  }

  // Event emitter methods
  on(event: string, listener: Function): void {
    if (!this.listeners.has(_event)) {
      this.listeners.set(_event, new Set());
    }
    this.listeners.get(_event)!.add(_listener);
  }

  off(event: string, listener: Function): void {
    this.listeners.get(_event)?.delete(_listener);
  }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(_event)?.forEach(listener => {
      try {
        listener(...args);
      } catch (_error) {}
    });
  }

  // Singleton cleanup
  destroy(): void {
    this.clearTokens();
    this.listeners.clear();
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }
}

// Export singleton instance
export const tokenManager = EnhancedTokenManager.getInstance();
export default tokenManager;
