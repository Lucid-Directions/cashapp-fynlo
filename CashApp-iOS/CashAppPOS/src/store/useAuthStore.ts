/**
 * Authentication Store using Zustand
 * Manages authentication state with Supabase integration
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/auth/supabaseAuth';

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
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  session: any | null;
  error: string | null;
  
  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, restaurantName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  hasFeature: (feature: string) => boolean;
  requiresPlan: (plan: 'alpha' | 'beta' | 'omega') => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      session: null,
      error: null,
      
      signIn: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const { user, session } = await authService.signIn({ email, password });
          
          set({
            user,
            session,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
        } catch (error: any) {
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to sign in',
            isAuthenticated: false,
            user: null,
            session: null
          });
          throw error;
        }
      },
      
      signUp: async (email: string, password: string, restaurantName?: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const result = await authService.signUp({ 
            email, 
            password, 
            restaurantName 
          });
          
          // After signup, sign them in if we have a session
          if (result.session) {
            await get().signIn(email, password);
          }
          
          set({ isLoading: false });
        } catch (error: any) {
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to sign up'
          });
          throw error;
        }
      },
      
      signOut: async () => {
        try {
          set({ isLoading: true });
          
          await authService.signOut();
          
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        } catch (error: any) {
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to sign out'
          });
        }
      },
      
      checkAuth: async () => {
        try {
          set({ isLoading: true });
          
          // TEMPORARY: Clear any stored mock authentication
          // This ensures users start at the login screen
          const hasMockAuth = await AsyncStorage.getItem('mock_session');
          if (hasMockAuth) {
            console.log('Clearing stored mock authentication...');
            await AsyncStorage.multiRemove([
              'userInfo',
              'mock_session',
              'auth_token',
              '@auth_user',
              '@auth_business'
            ]);
          }
          
          const session = await authService.getSession();
          
          if (session) {
            // Try to get stored user info first
            const storedUser = await authService.getStoredUser();
            
            if (storedUser) {
              // Use stored user info if available
              set({
                user: storedUser,
                session,
                isAuthenticated: true,
                isLoading: false
              });
              return;
            }
            
            // If no stored user, session is invalid
            await authService.signOut();
            set({ 
              isAuthenticated: false,
              user: null,
              session: null,
              isLoading: false
            });
          } else {
            set({ 
              isAuthenticated: false,
              user: null,
              session: null,
              isLoading: false
            });
          }
        } catch (error: any) {
          // Don't log error for missing session - this is normal on first launch
          set({ 
            isAuthenticated: false,
            user: null,
            session: null,
            isLoading: false,
            error: error.message
          });
        }
      },
      
      clearError: () => {
        set({ error: null });
      },
      
      hasFeature: (feature: string) => {
        const { user } = get();
        if (!user) return false;
        
        // Platform owners have all features
        if (user.is_platform_owner) return true;
        
        // Check if feature is in enabled features list
        return user.enabled_features?.includes(feature) || false;
      },
      
      requiresPlan: (plan: 'alpha' | 'beta' | 'omega') => {
        const { user } = get();
        if (!user) return false;
        
        // Platform owners have access to all plans
        if (user.is_platform_owner) return true;
        
        // Check plan hierarchy
        const planHierarchy = { alpha: 1, beta: 2, omega: 3 };
        const userPlanLevel = planHierarchy[user.subscription_plan || 'alpha'];
        const requiredLevel = planHierarchy[plan];
        
        return userPlanLevel >= requiredLevel;
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Clear old user data that might have wrong structure
          return {
            user: null,
            isAuthenticated: false
          };
        }
        return persistedState;
      }
    }
  )
);