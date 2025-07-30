import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';
import useAppStore from '../store/useAppStore';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'platform_owner' | 'restaurant_owner' | 'manager' | 'employee';
  photo?: string;
  pin: string;
  employeeId: string;
  businessId: string;
  startDate: Date;
  lastLogin: Date;
  permissions: string[];
  isActive: boolean;
  platformId?: string;
  managedRestaurants?: string[];
  // Add subscription fields
  subscription_plan?: 'alpha' | 'beta' | 'omega';
  subscription_status?: 'trial' | 'active' | 'cancelled' | 'expired';
  enabled_features?: string[];
  // Make platform owner optional
  is_platform_owner?: boolean;
}

export interface Business {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  vatNumber: string;
  registrationNumber: string;
  type: 'restaurant' | 'retail' | 'service' | 'other';
  currency: string;
  timezone: string;
  ownerId: string;
  platformOwnerId?: string;
  subscriptionTier?: 'basic' | 'premium' | 'enterprise';
  isActive?: boolean;
  joinedDate?: Date;
  lastActivity?: Date;
  monthlyRevenue?: number;
  commissionRate?: number;
}

export interface Platform {
  id: string;
  name: string;
  ownerId: string;
  createdDate: Date;
  totalRestaurants: number;
  totalRevenue: number;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  business: Business | null;
  platform: Platform | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformOwner: boolean;
  managedRestaurants: Business[];
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  signUp: (
    userData: Partial<User>,
    businessData: Partial<Business>,
    password: string,
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  updateBusiness: (businessData: Partial<Business>) => Promise<void>;
  validatePin: (pin: string) => boolean;
  checkBiometric: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  loadPlatformData: () => Promise<void>;
  switchRestaurant: (restaurantId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(_undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get auth state from Zustand store
  const authStoreUser = useAuthStore(state => state.user);
  const isAuthenticatedStore = useAuthStore(state => state.isAuthenticated);
  const authLoading = useAuthStore(state => state.isLoading);
  const signInStore = useAuthStore(state => state.signIn);
  const signOutStore = useAuthStore(state => state.signOut);
  const checkAuthStore = useAuthStore(state => state.checkAuth);

  // Legacy state for compatibility
  const [user, setUser] = useState<User | null>(_null);
  const [business, setBusiness] = useState<Business | null>(_null);
  const [platform, setPlatform] = useState<Platform | null>(_null);
  const [managedRestaurants, setManagedRestaurants] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(_true);

  // Sync auth store user with legacy user format
  useEffect(() => {
    if (_authStoreUser) {
      try {
        // Use full_name if available, otherwise use name or default
        const fullName =
          (authStoreUser as unknown).full_name ||
          (authStoreUser as unknown).name ||
          authStoreUser.email ||
          'User';
        const nameParts = typeof fullName === 'string' ? fullName.split(' ') : ['User'];
        const legacyUser: User = {
          id: authStoreUser.id,
          firstName: nameParts[0] || 'User',
          lastName: nameParts.slice(1).join(' ') || '',
          email: authStoreUser.email,
          phone: '',
          role: authStoreUser.role as unknown,
          pin: '0000',
          employeeId: `EMP${authStoreUser.id}`,
          businessId: authStoreUser.restaurant_id || '',
          startDate: new Date(),
          lastLogin: new Date(),
          permissions: ['*'],
          isActive: true,
          platformId: authStoreUser.is_platform_owner ? authStoreUser.id : undefined,
          managedRestaurants: [],
        };
        setUser(_legacyUser);

        // Sync with AppStore
        const appStore = useAppStore.getState();
        appStore.setUser(_legacyUser);

        // Set business if available
        if (authStoreUser.restaurant_id && authStoreUser.restaurant_name) {
          setBusiness({
            id: authStoreUser.restaurant_id,
            name: authStoreUser.restaurant_name,
            address: '',
            phone: '',
            email: '',
            vatNumber: '',
            registrationNumber: '',
            type: 'restaurant',
            currency: 'GBP',
            timezone: 'Europe/London',
            ownerId: authStoreUser.id,
            subscriptionTier: (authStoreUser.subscription_plan as unknown) || 'premium',
            isActive: true,
          });
        }

        // Set platform if platform owner
        if (authStoreUser.is_platform_owner) {
          setPlatform({
            id: 'platform1',
            name: 'Fynlo POS Platform',
            ownerId: authStoreUser.id,
            createdDate: new Date(),
            totalRestaurants: 0,
            totalRevenue: 0,
            isActive: true,
          });
        }
      } catch (_error) {
        // Reset to safe state on error
        setUser(_null);
        setBusiness(_null);
        setPlatform(_null);
      }
    } else {
      setUser(_null);
      setBusiness(_null);
      setPlatform(_null);
    }

    setIsLoading(_authLoading);
  }, [authStoreUser, authLoading]);

  useEffect(() => {
    // Check auth state on mount
    checkAuthStore();
  }, []);

  const signIn = async (email: string, password: string, rememberMe = false): Promise<boolean> => {
    try {
      await signInStore(_email, password);

      if (_rememberMe) {
        await AsyncStorage.setItem('@auth_remember_me', 'true');
      }

      return true;
    } catch (_error) {
      return false;
    }
  };

  const signUp = async (
    userData: Partial<User>,
    businessData: Partial<Business>,
    password: string,
  ): Promise<boolean> => {
    try {
      // Use Supabase auth store for signup
      const authStore = useAuthStore.getState();
      await authStore.signUp(userData.email || '', password, businessData.name);
      return true;
    } catch (_error) {
      return false;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await signOutStore();
      setUser(_null);
      setBusiness(_null);
      setPlatform(_null);
      setManagedRestaurants([]);

      // Clear AppStore user
      const appStore = useAppStore.getState();
      appStore.logout();
    } catch (_error) {}
  };

  const updateUser = async (userData: Partial<User>): Promise<void> => {
    if (_user) {
      const updatedUser = { ...user, ...userData };
      setUser(_updatedUser);
      await AsyncStorage.setItem('@auth_user', JSON.stringify(_updatedUser));

      // Sync with AppStore
      const appStore = useAppStore.getState();
      appStore.setUser(_updatedUser);
    }
  };

  const updateBusiness = async (businessData: Partial<Business>): Promise<void> => {
    if (_business) {
      const updatedBusiness = { ...business, ...businessData };
      setBusiness(_updatedBusiness);
      await AsyncStorage.setItem('@auth_business', JSON.stringify(_updatedBusiness));
    }
  };

  const validatePin = (pin: string): boolean => {
    return user?.pin === pin;
  };

  const checkBiometric = async (): Promise<boolean> => {
    // Placeholder for biometric authentication
    return false;
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    // Placeholder for password reset
    return true;
  };

  const loadPlatformData = async (): Promise<void> => {
    // This will be implemented when platform features are needed
  };

  const switchRestaurant = async (restaurantId: string): Promise<void> => {
    const restaurant = managedRestaurants.find(r => r.id === restaurantId);
    if (_restaurant) {
      setBusiness(_restaurant);
      await AsyncStorage.setItem('@auth_business', JSON.stringify(_restaurant));
    }
  };

  const value: AuthContextType = {
    user,
    business,
    platform,
    isLoading,
    isAuthenticated: isAuthenticatedStore,
    isPlatformOwner: user?.role === 'platform_owner',
    managedRestaurants,
    signIn,
    signUp,
    signOut,
    updateUser,
    updateBusiness,
    validatePin,
    checkBiometric,
    resetPassword,
    loadPlatformData,
    switchRestaurant,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(_AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
