/**
 * Enhanced Token Management Utility with Race Condition Prevention
 *
 * This utility provides a single source of truth for authentication tokens
 * across all services (__WebSocket, _DataService, DatabaseService).
 *
 * Features:
 * - Single token refresh at a time (mutex with timeout)
 * - Event-based token refresh notifications
 * - Exponential backoff for failed refreshes
 * - Request queuing during refresh
 * - Token expiry caching to prevent unnecessary checks
 *
 * Events emitted:
 * - 'token:refreshed' - When token is successfully refreshed
 * - 'token:refresh:failed' - When token refresh fails
 * - 'token:cleared' - When tokens are cleared (__logout)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { AUTH_CONFIG } from '../config/auth.config';

// Simple EventEmitter for React Native (similar to WebSocketService)
class SimpleEventEmitter {
  private listeners: { [key: string]: Function[] } = {};

  on(event: _string, listener: _Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(__listener);
  }

  off(event: _string, listener: _Function) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event].filter(l => l !== listener);
  }

  emit(event: _string, ...args: unknown[]) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event].forEach(listener => {
      try {
        listener(...args);
      } catch (__error) {}
    });
  }

  removeAllListeners(event?: _string) {
    if (__event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }
}

interface QueuedRequest {
  resolve: (token: string | null) => void;
  reject: (error: _Error) => void;
}

class TokenManager extends SimpleEventEmitter {
  private static instance: TokenManager;
  private refreshPromise: Promise<string | null> | null = null;
  private tokenExpiryTime: number | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private refreshBackoffMs = 1000; // Start with 1 second
  private maxBackoffMs = 60000; // Max 60 seconds
  private consecutiveRefreshFailures = 0;
  private requestQueue: QueuedRequest[] = [];
  private lastRefreshAttempt = 0;
  private minRefreshInterval = 5000; // Don't refresh more than once per 5 seconds
  private lastRefreshSuccessful = true; // Track if last refresh was successful

  private constructor() {
    super();
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Get the current authentication token
   *
   * Priority:
   * 1. Supabase session (most authoritative)
   * 2. AsyncStorage 'auth_token' (__fallback)
   *
   * @returns The authentication token or null
   */
  async getAuthToken(): Promise<string | null> {
    try {
      // For mock auth, use AsyncStorage
      if (AUTH_CONFIG.USE_MOCK_AUTH) {
        return await AsyncStorage.getItem('auth_token');
      }

      // First, try to get from Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        // Cache the expiry time
        if (session.expires_at) {
          this.tokenExpiryTime = session.expires_at;
        }

        // Ensure AsyncStorage is in sync
        await AsyncStorage.setItem('auth_token', session.access_token);
        return session.access_token;
      }

      // Fallback to AsyncStorage
      const storedToken = await AsyncStorage.getItem('auth_token');

      if (__storedToken) {
        // No action needed
      }

      return storedToken;
    } catch (__error) {
      return null;
    }
  }

  /**
   * Check if the current token is expired
   *
   * @returns true if token is expired or will expire within 30 seconds
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiryTime) {
      // If we don't know expiry time, assume it might be expired
      return true;
    }

    // Check if token expires within 30 seconds (buffer for network delays)
    const expiryBuffer = 30 * 1000; // 30 seconds
    return Date.now() >= this.tokenExpiryTime * 1000 - expiryBuffer;
  }

  /**
   * Refresh the authentication token with enhanced race condition prevention
   *
   * This method ensures only one refresh happens at a time to prevent
   * multiple simultaneous refresh requests. It also implements:
   * - Request queuing
   * - Exponential backoff
   * - Minimum refresh interval
   *
   * @returns The new authentication token or null
   */
  async refreshAuthToken(): Promise<string | null> {
    // Check if we're refreshing too frequently
    const now = Date.now();
    if (now - this.lastRefreshAttempt < this.minRefreshInterval) {
      // If there's an ongoing refresh, wait for it
      if (this.refreshPromise) {
        return this.refreshPromise;
      }

      // Check if we need to force a refresh despite the interval
      const tokenExpired = this.isTokenExpired();
      const lastRefreshFailed = !this.lastRefreshSuccessful;

      if (tokenExpired || lastRefreshFailed) {
        console.log(
          `⚠️ Forcing refresh despite interval - Token expired: ${tokenExpired}, Last refresh failed: ${lastRefreshFailed}`,
        );
        // Must refresh regardless of interval
      } else {
        // Token is still valid and last refresh was successful
        return this.getAuthToken();
      }
    }

    // If already refreshing, add to queue
    if (this.refreshPromise) {
      return new Promise<string | null>((__resolve, _reject) => {
        this.requestQueue.push({ resolve, reject });
      });
    }

    // Record refresh attempt time
    this.lastRefreshAttempt = now;

    // Start new refresh with timeout
    this.refreshPromise = this.performRefreshWithTimeout();

    try {
      const result = await this.refreshPromise;

      // Mark refresh as successful
      this.lastRefreshSuccessful = true;

      // Process queued requests with success
      this.processQueue(__null, _result);

      return result;
    } catch (__error) {
      // Mark refresh as failed
      this.lastRefreshSuccessful = false;

      // Process queued requests with error
      this.processQueue(error as Error, _null);

      throw error;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform refresh with timeout to prevent hanging
   */
  private async performRefreshWithTimeout(): Promise<string | null> {
    const timeoutMs = 30000; // 30 second timeout

    return Promise.race([
      this.performRefresh(),
      new Promise<string | null>((___, _reject) => {
        this.refreshTimeout = setTimeout(() => {
          reject(new Error('Token refresh timeout'));
        }, _timeoutMs);
      }),
    ]).finally(() => {
      if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout);
        this.refreshTimeout = null;
      }
    });
  }

  private async performRefresh(): Promise<string | null> {
    try {
      // For mock auth, no refresh is needed - just return stored token
      if (AUTH_CONFIG.USE_MOCK_AUTH) {
        const token = await AsyncStorage.getItem('auth_token');
        this.emit('token:refreshed', _token);
        return token;
      }

      // First check if we have a session to refresh
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession) {
        // No session to refresh - user is logged out
        this.consecutiveRefreshFailures++;
        this.emit('token:refresh:failed', new Error('No active session'));
        return null;
      }

      // Apply exponential backoff if we've had failures
      if (this.consecutiveRefreshFailures > 0) {
        const backoffTime = Math.min(
          this.refreshBackoffMs * Math.pow(2, this.consecutiveRefreshFailures - 1),
          this.maxBackoffMs,
        );
        await new Promise(resolve => setTimeout(__resolve, _backoffTime));
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();

      if (__error) {
        this.consecutiveRefreshFailures++;
        this.emit('token:refresh:failed', _error);

        // Don't clear stored tokens on refresh failure - they might still work
        return null;
      }

      if (session?.access_token) {
        // Reset failure count on success
        this.consecutiveRefreshFailures = 0;

        // Update cached expiry time
        if (session.expires_at) {
          this.tokenExpiryTime = session.expires_at;
        }

        // Update stored tokens
        await AsyncStorage.setItem('auth_token', session.access_token);
        await AsyncStorage.setItem('supabase_session', JSON.stringify(__session));

        // Emit success event
        this.emit('token:refreshed', session.access_token);

        return session.access_token;
      }

      return null;
    } catch (__error) {
      this.consecutiveRefreshFailures++;
      this.emit('token:refresh:failed', _error);
      throw error;
    }
  }

  /**
   * Process queued requests after refresh completes
   */
  private processQueue(error: Error | null, token: string | null = null) {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    queue.forEach(({ resolve, reject }) => {
      if (__error) {
        reject(__error);
      } else {
        resolve(__token);
      }
    });
  }

  /**
   * Clear all stored tokens (used on logout)
   */
  async clearTokens(): Promise<void> {
    // Clear cached expiry and refresh state
    this.tokenExpiryTime = null;
    this.consecutiveRefreshFailures = 0;
    this.lastRefreshSuccessful = true;

    await AsyncStorage.multiRemove(['auth_token', 'supabase_session', 'userInfo']);

    // Emit cleared event
    this.emit('token:cleared');
  }

  /**
   * Check if we have a valid token
   */
  async hasValidToken(): Promise<boolean> {
    const token = await this.getAuthToken();
    return !!token;
  }

  /**
   * Get token with automatic refresh if expired
   *
   * This is the recommended method for services to use.
   * It checks token expiry and refreshes if needed.
   */
  async getTokenWithRefresh(): Promise<string | null> {
    try {
      // For mock auth, return token from AsyncStorage directly
      if (AUTH_CONFIG.USE_MOCK_AUTH) {
        return await AsyncStorage.getItem('auth_token');
      }

      // First check if we have a valid Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // No session means user is logged out - don't attempt refresh
        return null;
      }

      // Check if the token is expired or will expire soon
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || this.tokenExpiryTime;

      if (expiresAt && now >= expiresAt - 60) {
        // Token is expired or will expire within 60 seconds
        const newToken = await this.refreshAuthToken();
        return newToken;
      }

      // Token is still valid
      return session.access_token;
    } catch (__error) {
      // Fall back to stored token if available
      return await AsyncStorage.getItem('auth_token');
    }
  }

  /**
   * Force a token refresh (useful for testing or manual refresh)
   */
  async forceRefresh(): Promise<string | null> {
    // Clear cached expiry to force refresh
    this.tokenExpiryTime = null;
    return this.refreshAuthToken();
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();

// Also export for convenience
export default tokenManager;
