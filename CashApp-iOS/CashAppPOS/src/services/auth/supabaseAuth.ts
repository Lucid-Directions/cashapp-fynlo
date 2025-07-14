/**
 * Supabase Authentication Service for Fynlo POS
 */

import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';
import { AUTH_CONFIG } from '../../config/auth.config';
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
      console.log('🔐 Attempting Supabase sign in for:', email);
      
      // 1. Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('❌ Supabase sign in error:', error);
        throw new Error(error.message || 'Failed to sign in');
      }
      
      if (!data.session) {
        throw new Error('No session returned from Supabase');
      }
      
      console.log('✅ Supabase sign in successful');
      
      // 2. Verify with our backend and get user details
      const verifyResponse = await this.verifyWithBackend(data.session.access_token, email);
      
      // 3. Ensure user has required fields
      const normalizedUser = {
        ...verifyResponse.user,
        name: verifyResponse.user.name || verifyResponse.user.full_name || verifyResponse.user.email || 'User',
        is_platform_owner: verifyResponse.user.is_platform_owner || false
      };
      
      // Store enhanced user info
      await AsyncStorage.setItem('userInfo', JSON.stringify(normalizedUser));
      await AsyncStorage.setItem('supabase_session', JSON.stringify(data.session));
      
      return {
        user: normalizedUser,
        session: data.session
      };
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error.message || 'Failed to sign in');
    }
  }
  
  /**
   * Sign up new user
   */
  async signUp({ email, password, restaurantName, firstName, lastName }: SignUpParams) {
    try {
      console.log('📝 Attempting Supabase sign up for:', email);
      
      // 1. Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName || '',
            last_name: lastName || '',
            restaurant_name: restaurantName
          }
        }
      });
      
      if (error) {
        console.error('❌ Supabase sign up error:', error);
        throw new Error(error.message || 'Failed to sign up');
      }
      
      console.log('✅ Supabase sign up successful');
      
      // 2. If restaurant name provided and we have a session, register it
      if (restaurantName && data.session) {
        await this.registerRestaurant(data.session.access_token, restaurantName);
      }
      
      return data;
    } catch (error: any) {
      console.error('Sign up error:', error);
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
      console.log('👋 Signing out...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Sign out error:', error);
      }
      
      // Clear all stored data
      await AsyncStorage.multiRemove([
        'userInfo',
        'supabase_session',
        'auth_token',
        '@auth_user',
        '@auth_business'
      ]);
      
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('Sign out error:', error);
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
    
    const { data: { session } } = await supabase.auth.getSession();
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
      console.error('Error getting stored user:', error);
      return null;
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
    
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    return session;
  }
  
  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
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
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user?.id || null;
    } catch (error) {
      console.error('Error getting session user ID:', error);
      return null;
    }
  }
  
  /**
   * Verify token with backend and get user info
   */
  private async verifyWithBackend(accessToken: string, email?: string): Promise<{ user: UserInfo }> {
    console.log('🔍 Verifying with backend...');
    
    const response = await fetch(`${API_CONFIG.FULL_API_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Backend verification failed:', error);
      
      // Fallback data for when backend is not available
      // In production, this would come from the backend based on the user's actual restaurant
      console.log('⚠️ Using fallback authentication data');
      
      // Use Supabase user ID if available, otherwise create a UUID
      const supabaseUserId = await this.getCurrentSessionUserId();
      const userData = {
        id: supabaseUserId || `user-${Date.now()}`,
        email: email,
        full_name: 'Restaurant User',
        role: 'restaurant_owner', // Default role for testing
        restaurant_id: 'default-restaurant',
        restaurant_name: 'Restaurant', // Generic name - should be fetched from backend
        subscription_plan: 'beta',
        enabled_features: ['pos', 'orders', 'inventory', 'analytics', 'table_management', 'online_ordering'],
        created_at: new Date().toISOString()
      };
      
      // Map full_name to name for compatibility with auth store
      return { 
        user: {
          ...userData,
          name: userData.full_name,
          is_platform_owner: userData.role === 'platform_owner'
        }
      };
    }
    
    const data = await response.json();
    console.log('✅ Backend verification successful');
    return data;
  }
  
  /**
   * Register restaurant after signup
   */
  private async registerRestaurant(accessToken: string, restaurantName: string) {
    console.log('🏪 Registering restaurant:', restaurantName);
    
    const response = await fetch(`${API_CONFIG.FULL_API_URL}/auth/register-restaurant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        restaurant_name: restaurantName
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Restaurant registration failed:', error);
      throw new Error('Failed to register restaurant');
    }
    
    console.log('✅ Restaurant registered successfully');
    return response.json();
  }
}

export const authService = new SupabaseAuthService();