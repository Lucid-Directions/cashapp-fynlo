/**
 * Supabase Authentication Service for Fynlo POS
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import API_CONFIG from '../../config/api';
import { AUTH_CONFIG } from '../../config/auth.config';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

import { authMonitor } from './AuthMonitor';
import { mockAuthService } from './mockAuth';

interface SignInParams {
  email: string;
  password: string;
}

interface SignUpParams extends SignInParams {
  restaurantName?: string;
  firstName?: string;
  lastName?: string;
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
  is_platform_owner: boolean;
  role: string;
  restaurant_id?: string;
  restaurant_name?: string;
  subscription_plan?: string;
  subscription_status?: string;
  enabled_features?: string[];
}

class SupabaseAuthService {
  /**
   * Sign in with email and password
   */
  async signIn({ email, password }: SignInParams) {
    // Use mock auth if configured
    if (AUTH_CONFIG.USE_MOCK_AUTH) {
      return mockAuthService.signIn({ email, password });
    }

    try {
      logger.info('🔐 Attempting Supabase sign in for:', email);

      // 1. Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error('❌ Supabase sign in error:', error);
        throw new Error(error.message || 'Failed to sign in');
      }

      if (!data.session) {
        throw new Error('No session returned from Supabase');
      }

      logger.info('✅ Supabase sign in successful');

      // 2. Verify with our backend and get user details
      const verifyResponse = await this.verifyWithBackend(data.session.access_token, email);

      // 3. Ensure user has required fields
      const normalizedUser = {
        ...verifyResponse.user,
        name:
          verifyResponse.user.name ||
          verifyResponse.user.full_name ||
          verifyResponse.user.email ||
          'User',
        is_platform_owner: verifyResponse.user.is_platform_owner || false,
        subscription_plan: verifyResponse.user.subscription_plan,
        subscription_status: verifyResponse.user.subscription_status,
        enabled_features: verifyResponse.user.enabled_features,
      };

      // Store enhanced user info
      await AsyncStorage.setItem('userInfo', JSON.stringify(normalizedUser));
      await AsyncStorage.setItem('supabase_session', JSON.stringify(data.session));
      // CRITICAL: Store auth token for WebSocket and API services
      await AsyncStorage.setItem('auth_token', data.session.access_token);

      logger.info('✅ Stored auth token for services');

      // Log successful login
      authMonitor.logEvent('login', `User ${email} logged in successfully`, {
        userId: normalizedUser.id,
        email: normalizedUser.email,
        role: normalizedUser.role,
      });

      return {
        user: normalizedUser,
        session: data.session,
      };
    } catch (error: unknown) {
      logger.error('Sign in error:', error);

      // Log failed login
      authMonitor.logEvent('auth_error', `Login failed for ${email}`, {
        error: error.message || 'Unknown error',
      });

      throw new Error(error.message || 'Failed to sign in');
    }
  }

  /**
   * Sign up new user
   */
  async signUp({ email, password, restaurantName, firstName, lastName }: SignUpParams) {
    try {
      logger.info('📝 Attempting Supabase sign up for:', email);

      // 1. Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName || '',
            last_name: lastName || '',
            restaurant_name: restaurantName,
          },
        },
      });

      if (error) {
        logger.error('❌ Supabase sign up error:', error);
        throw new Error(error.message || 'Failed to sign up');
      }

      logger.info('✅ Supabase sign up successful');

      // 2. If restaurant name provided and we have a session, register it
      if (restaurantName && data.session) {
        await this.registerRestaurant(data.session.access_token, restaurantName);
      }

      return data;
    } catch (error: unknown) {
      logger.error('Sign up error:', error);
      throw new Error(error.message || 'Failed to sign up');
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    // Use mock auth if configured
    if (AUTH_CONFIG.USE_MOCK_AUTH) {
      return mockAuthService.signOut();
    }

    try {
      logger.info('👋 Signing out...');

      const { error } = await supabase.auth.signOut();

      if (error) {
        logger.error('❌ Sign out error:', error);
      }

      // Clear all stored data
      await AsyncStorage.multiRemove([
        'userInfo',
        'supabase_session',
        'auth_token',
        '@auth_user',
        '@auth_business',
      ]);

      logger.info('✅ Sign out successful');

      // Log successful logout
      authMonitor.logEvent('logout', 'User logged out successfully');
    } catch (error) {
      logger.error('Sign out error:', error);

      // Log logout error
      authMonitor.logEvent('auth_error', 'Logout error', {
        error: error.message || 'Unknown error',
      });
    }
  }

  /**
   * Get current session
   */
  async getSession() {
    // Use mock auth if configured
    if (AUTH_CONFIG.USE_MOCK_AUTH) {
      return mockAuthService.getSession();
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  }

  /**
   * Get stored user info from AsyncStorage
   */
  async getStoredUser() {
    // Use mock auth if configured
    if (AUTH_CONFIG.USE_MOCK_AUTH) {
      return mockAuthService.getStoredUser();
    }

    try {
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (userInfo) {
        return JSON.parse(userInfo);
      }
      return null;
    } catch (error) {
      logger.error('Error getting stored user:', error);
      return null;
    }
  }

  /**
   * Clear stored tokens without signing out from Supabase
   */
  async clearStoredTokens() {
    try {
      logger.info('🔄 Clearing stored tokens...');
      await AsyncStorage.multiRemove([
        'userInfo',
        'supabase_session',
        'auth_token',
        '@auth_user',
        '@auth_business',
      ]);
      logger.info('✅ Stored tokens cleared');
    } catch (error) {
      logger.error('Error clearing stored tokens:', error);
    }
  }

  /**
   * Refresh session
   */
  async refreshSession() {
    // Use mock auth if configured
    if (AUTH_CONFIG.USE_MOCK_AUTH) {
      return mockAuthService.refreshSession();
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.refreshSession();
    if (error) throw error;

    // CRITICAL: Update stored auth token when refreshed
    if (session) {
      await AsyncStorage.setItem('auth_token', session.access_token);
      await AsyncStorage.setItem('supabase_session', JSON.stringify(session));
      logger.info('✅ Updated auth token after refresh');
    }

    return session;
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    // Use mock auth if configured
    if (AUTH_CONFIG.USE_MOCK_AUTH) {
      return mockAuthService.onAuthStateChange(callback);
    }

    return supabase.auth.onAuthStateChange(callback);
  }

  /**
   * Get current session user ID
   */
  private async getCurrentSessionUserId(): Promise<string | null> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.user?.id || null;
    } catch (error) {
      logger.error('Error getting session user ID:', error);
      return null;
    }
  }

  /**
   * Verify token with backend and get user info
   */
  private async verifyWithBackend(
    accessToken: string,
    email?: string
  ): Promise<{ user: UserInfo }> {
    logger.info('🔍 Verifying with backend...');

    const response = await fetch(`${API_CONFIG.FULL_API_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('❌ Backend verification failed:', errorText);

      // Parse error details if available
      let errorDetail = 'Backend verification failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.detail || errorJson.message || errorDetail;
      } catch {
        // Use raw error text if not JSON
        errorDetail = errorText || errorDetail;
      }

      // Clear any stored tokens on backend verification failure
      await this.clearStoredTokens();

      throw new Error(errorDetail);
    }

    const data = await response.json();
    logger.info('✅ Backend verification successful');
    return data;
  }

  /**
   * Register restaurant after signup
   */
  private async registerRestaurant(accessToken: string, restaurantName: string) {
    logger.info('🏪 Registering restaurant:', restaurantName);

    const response = await fetch(`${API_CONFIG.FULL_API_URL}/auth/register-restaurant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        restaurant_name: restaurantName,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('❌ Restaurant registration failed:', error);
      throw new Error('Failed to register restaurant');
    }

    logger.info('✅ Restaurant registered successfully');
    return response.json();
  }
}

export const authService = new SupabaseAuthService();
