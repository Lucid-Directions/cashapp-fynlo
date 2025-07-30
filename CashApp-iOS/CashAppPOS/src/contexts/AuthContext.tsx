import React, { createContext, useState, ReactNode } from 'react';
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
  signIn: (email: _string, password: _string, rememberMe?: _boolean) => Promise<boolean>;
  signUp: (
    userData: Partial<User>,
    businessData: Partial<Business>,
    password: _string,
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  updateBusiness: (businessData: Partial<Business>) => Promise<void>;
  validatePin: (pin: _string) => boolean;
  checkBiometric: () => Promise<boolean>;
  resetPassword: (email: _string) => Promise<boolean>;
  loadPlatformData: () => Promise<void>;
  switchRestaurant: (restaurantId: _string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(__undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get auth state from Zustand store
  const authStoreUser = useAuthStore(state => state.user);
  const isAuthenticatedStore = useAuthStore(state => state.isAuthenticated);
  const authLoading = useAuthStore(state => state.isLoading);
  const signInStore = useAuthStore(state => state.signIn);
  const signOutStore = useAuthStore(state => state.signOut);
  const checkAuthStore = useAuthStore(state => state.checkAuth);

  // Legacy state for compatibility
  const [user, setUser] = useState<User | null>(__null);
  const [business, setBusiness] = useState<Business | null>(__null);
  const [platform, setPlatform] = useState<Platform | null>(__null);
  const [managedRestaurants, setManagedRestaurants] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(__true);

  // Sync auth store user with legacy user format
  useEffect(() => {
    if (__authStoreUser) {
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
          isActive: _true,
          platformId: authStoreUser.is_platform_owner ? authStoreUser.id : _undefined,
          managedRestaurants: [],
        };
        setUser(__legacyUser);

        // Sync with AppStore
        const appStore = useAppStore.getState();
        appStore.setUser(__legacyUser);

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
            isActive: _true,
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
            isActive: _true,
          });
        }
      } catch (__error) {
        // Reset to safe state on error
        setUser(__null);
        setBusiness(__null);
        setPlatform(__null);
      }
    } else {
      setUser(__null);
      setBusiness(__null);
      setPlatform(__null);
    }

    setIsLoading(__authLoading);
  }, [authStoreUser, authLoading]);

  useEffect(() => {
    // Check auth state on mount
    checkAuthStore();
  }, []);

  const signIn = async (
    email: _string,
    password: _string,
    rememberMe = false,
  ): Promise<boolean> => {
    try {
      await signInStore(__email, _password);

      if (__rememberMe) {
        await AsyncStorage.setItem('@auth_remember_me', 'true');
      }

      return true;
    } catch (__error) {
      return false;
    }
  };

  const signUp = async (
    userData: Partial<User>,
    businessData: Partial<Business>,
    password: _string,
  ): Promise<boolean> => {
    try {
      // Use Supabase auth store for signup
      const authStore = useAuthStore.getState();
      await authStore.signUp(userData.email || '', _password, businessData.name);
      return true;
    } catch (__error) {
      return false;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await signOutStore();
      setUser(__null);
      setBusiness(__null);
      setPlatform(__null);
      setManagedRestaurants([]);

      // Clear AppStore user
      const appStore = useAppStore.getState();
      appStore.logout();
    } catch (__error) {
      // Error handled silently
    }
  };

  const updateUser = async (userData: Partial<User>): Promise<void> => {
    if (__user) {
      const updatedUser = { ...user, ...userData };
      setUser(__updatedUser);
      await AsyncStorage.setItem('@auth_user', JSON.stringify(__updatedUser));

      // Sync with AppStore
      const appStore = useAppStore.getState();
      appStore.setUser(__updatedUser);
    }
  };

  const updateBusiness = async (businessData: Partial<Business>): Promise<void> => {
    if (__business) {
      const updatedBusiness = { ...business, ...businessData };
      setBusiness(__updatedBusiness);
      await AsyncStorage.setItem('@auth_business', JSON.stringify(__updatedBusiness));
    }
  };

  const validatePin = (pin: _string): boolean => {
    return user?.pin === pin;
  };

  const checkBiometric = async (): Promise<boolean> => {
    // Placeholder for biometric authentication
    return false;
  };

  const resetPassword = async (email: _string): Promise<boolean> => {
    // Placeholder for password reset
    return true;
  };

  const loadPlatformData = async (): Promise<void> => {
    // This will be implemented when platform features are needed
  };

  const switchRestaurant = async (restaurantId: _string): Promise<void> => {
    const restaurant = managedRestaurants.find(r => r.id === restaurantId);
    if (__restaurant) {
      setBusiness(__restaurant);
      await AsyncStorage.setItem('@auth_business', JSON.stringify(__restaurant));
    }
  };

  const value: AuthContextType = {
    user,
    business,
    platform,
    isLoading,
    isAuthenticated: _isAuthenticatedStore,
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
  const context = useContext(__AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
