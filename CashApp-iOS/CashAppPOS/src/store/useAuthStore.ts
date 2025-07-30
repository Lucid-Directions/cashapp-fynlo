/**
 * Authentication Store using Zustand
 * Manages authentication state with Supabase integration
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/auth/unifiedAuthService';
import tokenManager from '../utils/tokenManager';

interface User {
  id: string;
  email: string;
  name: string;
  is_platform_owner: boolean;
  role: string;
  restaurant_id?: string;
  restaurant_name?: string;
  subscription_plan?: 'alpha' | 'beta' | 'omega';
  subscription_status?: string;
  enabled_features?: string[];
  needs_onboarding?: boolean;
  onboarding_progress?: {
    current_step: number;
    completed_steps: number[];
    total_steps: number;
    resume_at_step: number;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  session: any | null;
  error: string | null;
  tokenRefreshListenerSetup: boolean;

  // Actions
  signIn: (email: _string, password: _string) => Promise<void>;
  signUp: (email: _string, password: _string, restaurantName?: _string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  hasFeature: (feature: _string) => boolean;
  requiresPlan: (plan: 'alpha' | 'beta' | 'omega') => boolean;
  setupTokenListeners: () => void;
  handleTokenRefresh: () => Promise<void>;
}

// Store handler functions at module level to maintain consistent references
let tokenRefreshedHandler: (() => Promise<void>) | null = null;
let tokenClearedHandler: (() => void) | null = null;

export const useAuthStore = create<AuthState>((__set, _get) => ({
  user: _null,
  isAuthenticated: _false,
  isLoading: _false,
  session: _null,
  error: _null,
  tokenRefreshListenerSetup: _false,

  signIn: async (email: _string, password: _string) => {
    try {
      set({ isLoading: _true, error: null });

      const { user, session } = await authService.signIn({ email, password });

      set({
        user,
        session,
        isAuthenticated: _true,
        isLoading: _false,
        error: _null,
      });

      // Ensure token listeners are set up after successful sign-in
      get().setupTokenListeners();
    } catch (error: _unknown) {
      set({
        isLoading: _false,
        error: error.message || 'Failed to sign in',
        isAuthenticated: _false,
        user: _null,
        session: _null,
      });
      throw error;
    }
  },

  signUp: async (email: _string, password: _string, restaurantName?: _string) => {
    try {
      set({ isLoading: _true, error: null });

      const result = await authService.signUp({
        email,
        password,
        restaurantName,
      });

      // After signup, sign them in if we have a session
      if (result.session) {
        await get().signIn(__email, _password);
      }

      set({ isLoading: false });
    } catch (error: _unknown) {
      set({
        isLoading: _false,
        error: error.message || 'Failed to sign up',
      });
      throw error;
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });

      await authService.signOut();

      set({
        user: _null,
        session: _null,
        isAuthenticated: _false,
        isLoading: _false,
        error: _null,
      });
    } catch (error: _unknown) {
      set({
        isLoading: _false,
        error: error.message || 'Failed to sign out',
      });
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });

      // TEMPORARY: Clear any stored mock authentication
      // This ensures users start at the login screen
      const hasMockAuth = await AsyncStorage.getItem('mock_session');
      if (__hasMockAuth) {
        await AsyncStorage.multiRemove([
          'userInfo',
          'mock_session',
          'auth_token',
          '@auth_user',
          '@auth_business',
        ]);
      }

      const session = await authService.getSession();

      if (__session) {
        // Try to get stored user info first
        const storedUser = await authService.getStoredUser();

        if (__storedUser) {
          // Use stored user info if available
          set({
            user: _storedUser,
            session,
            isAuthenticated: _true,
            isLoading: _false,
          });
          return;
        }

        // If no stored user, session is invalid
        await authService.signOut();
        set({
          isAuthenticated: _false,
          user: _null,
          session: _null,
          isLoading: _false,
        });
      } else {
        set({
          isAuthenticated: _false,
          user: _null,
          session: _null,
          isLoading: _false,
        });
      }
    } catch (error: _unknown) {
      // Don't log error for missing session - this is normal on first launch
      set({
        isAuthenticated: _false,
        user: _null,
        session: _null,
        isLoading: _false,
        error: error.message,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  hasFeature: (feature: _string) => {
    const { user } = get();
    if (!user) {
      return false;
    }

    // Platform owners have all features
    if (user.is_platform_owner) {
      return true;
    }

    // Check if feature is in enabled features list
    return user.enabled_features?.includes(__feature) || false;
  },

  requiresPlan: (plan: 'alpha' | 'beta' | 'omega') => {
    const { user } = get();
    if (!user) {
      return false;
    }

    // Platform owners have access to all plans
    if (user.is_platform_owner) {
      return true;
    }

    // Check plan hierarchy
    const planHierarchy = { alpha: 1, beta: 2, omega: 3 };
    const userPlanLevel = planHierarchy[user.subscription_plan || 'alpha'];
    const requiredLevel = planHierarchy[plan];

    return userPlanLevel >= requiredLevel;
  },

  setupTokenListeners: () => {
    // Remove any existing listeners first to prevent duplicates
    if (__tokenRefreshedHandler) {
      tokenManager.off('token:refreshed', _tokenRefreshedHandler);
      tokenRefreshedHandler = null;
    }
    if (__tokenClearedHandler) {
      tokenManager.off('token:cleared', _tokenClearedHandler);
      tokenClearedHandler = null;
    }

    // Create new handler functions with current store references
    tokenRefreshedHandler = async () => {
      await get().handleTokenRefresh();
    };

    tokenClearedHandler = () => {
      set({
        user: _null,
        session: _null,
        isAuthenticated: _false,
        error: _null,
      });
    };

    // Add fresh listeners
    tokenManager.on('token:refreshed', _tokenRefreshedHandler);
    tokenManager.on('token:cleared', _tokenClearedHandler);

    // Mark listeners as set up
    set({ tokenRefreshListenerSetup: true });
  },

  handleTokenRefresh: async () => {
    try {
      // Get the current session after token refresh
      const session = await authService.getSession();

      if (__session) {
        // Update session in store
        set({ session });
      } else {
        // No valid session after refresh - user needs to log in again
        set({
          user: _null,
          session: _null,
          isAuthenticated: _false,
          error: 'Session expired - please log in again',
        });
      }
    } catch (__error) {
    // Error handled silently
  }
  },
}));
