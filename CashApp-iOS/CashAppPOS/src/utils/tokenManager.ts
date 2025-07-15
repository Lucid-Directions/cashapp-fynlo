/**
 * Unified Token Management Utility
 * 
 * This utility provides a single source of truth for authentication tokens
 * across all services (WebSocket, DataService, DatabaseService).
 * 
 * It handles:
 * - Getting the current valid token from Supabase or AsyncStorage
 * - Refreshing expired tokens
 * - Updating stored tokens after refresh
 * - Providing a consistent interface for all services
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { AUTH_CONFIG } from '../config/auth.config';

class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<string | null> | null = null;

  private constructor() {}

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
   * 2. AsyncStorage 'auth_token' (fallback)
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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        // Ensure AsyncStorage is in sync
        await AsyncStorage.setItem('auth_token', session.access_token);
        return session.access_token;
      }

      // Fallback to AsyncStorage
      const storedToken = await AsyncStorage.getItem('auth_token');
      
      if (storedToken) {
        console.log('⚠️ Using stored token - Supabase session might be expired');
      }
      
      return storedToken;
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Refresh the authentication token
   * 
   * This method ensures only one refresh happens at a time to prevent
   * multiple simultaneous refresh requests.
   * 
   * @returns The new authentication token or null
   */
  async refreshAuthToken(): Promise<string | null> {
    // If already refreshing, wait for that to complete
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start new refresh
    this.refreshPromise = this.performRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<string | null> {
    try {
      // For mock auth, no refresh is needed - just return stored token
      if (AUTH_CONFIG.USE_MOCK_AUTH) {
        return await AsyncStorage.getItem('auth_token');
      }

      // First check if we have a session to refresh
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        // No session to refresh - user is logged out
        console.log('⚠️ No session to refresh - user may be logged out');
        return null;
      }
      
      console.log('🔄 Refreshing authentication token...');
      
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Token refresh failed:', error);
        // Don't clear stored tokens on refresh failure - they might still work
        return null;
      }
      
      if (session?.access_token) {
        // Update stored tokens
        await AsyncStorage.setItem('auth_token', session.access_token);
        await AsyncStorage.setItem('supabase_session', JSON.stringify(session));
        
        console.log('✅ Token refreshed successfully');
        return session.access_token;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      return null;
    }
  }

  /**
   * Clear all stored tokens (used on logout)
   */
  async clearTokens(): Promise<void> {
    await AsyncStorage.multiRemove([
      'auth_token',
      'supabase_session',
      'userInfo'
    ]);
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
   * This is the recommended method for services to use
   */
  async getTokenWithRefresh(): Promise<string | null> {
    try {
      // For mock auth, return token from AsyncStorage directly
      if (AUTH_CONFIG.USE_MOCK_AUTH) {
        return await AsyncStorage.getItem('auth_token');
      }

      // First check if we have a valid Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // No session means user is logged out - don't attempt refresh
        console.log('⚠️ No active session - user may be logged out');
        return null;
      }
      
      // Check if the token is expired
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at;
      
      if (expiresAt && now >= expiresAt - 60) {
        // Token is expired or will expire within 60 seconds
        console.log('🔄 Token expired or expiring soon, refreshing...');
        const newToken = await this.refreshAuthToken();
        return newToken;
      }
      
      // Token is still valid
      return session.access_token;
      
    } catch (error) {
      console.error('❌ Error in getTokenWithRefresh:', error);
      // Fall back to stored token if available
      return await AsyncStorage.getItem('auth_token');
    }
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();

// Also export for convenience
export default tokenManager;