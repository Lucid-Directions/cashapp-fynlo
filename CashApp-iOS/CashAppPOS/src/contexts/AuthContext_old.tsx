import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RestaurantDataService from '../services/RestaurantDataService';
import API_CONFIG from '../config/api';
import { useAuthStore } from '../store/useAuthStore';
import { logger } from '../utils/logger';

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
  platformId?: string; // For platform owners
  managedRestaurants?: string[]; // Array of restaurant IDs for platform owners
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
  platformOwnerId?: string; // For multi-tenant support
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
  signUp: (userData: Partial<User>, businessData: Partial<Business>, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  updateBusiness: (businessData: Partial<Business>) => Promise<void>;
  validatePin: (pin: string) => boolean;
  checkBiometric: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  loadPlatformData: () => Promise<void>;
  switchRestaurant: (restaurantId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: '@auth_user',
  BUSINESS: '@auth_business',
  REMEMBER_ME: '@auth_remember_me',
  BIOMETRIC_ENABLED: '@auth_biometric',
};

// Removed all mock data - now using Supabase authentication

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get auth state from Zustand store
  const authStoreUser = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const authLoading = useAuthStore(state => state.isLoading);
  const signInStore = useAuthStore(state => state.signIn);
  const signOutStore = useAuthStore(state => state.signOut);
  const checkAuthStore = useAuthStore(state => state.checkAuth);
  
  // Legacy state for compatibility
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [managedRestaurants, setManagedRestaurants] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync auth store user with legacy user format
  useEffect(() => {
    if (authStoreUser) {
      const legacyUser: User = {
        id: authStoreUser.id,
        firstName: authStoreUser.name.split(' ')[0] || 'User',
        lastName: authStoreUser.name.split(' ')[1] || '',
        email: authStoreUser.email,
        phone: '',
        role: authStoreUser.role as any,
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
      setUser(legacyUser);
      
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
          subscriptionTier: 'premium',
          isActive: true,
        });
      }
    } else {
      setUser(null);
      setBusiness(null);
    }
  }, [authStoreUser]);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      setIsLoading(true);
      
      // Check auth state from Supabase
      logger.info('🔐 Checking Supabase authentication state...');
      await checkAuthStore();
      
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string, rememberMe = false): Promise<boolean> => {
    try {
      // Use Supabase auth store
      await signInStore(email, password);
      
      if (rememberMe) {
        await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
      }
      
      return true;
    } catch (error) {
      console.error('Sign in error:', error);
      return false;
    }
  };
        logger.info('🌐 API URL:', `${API_CONFIG.FULL_API_URL}/auth/login`);
        
        const authToken = await AsyncStorage.getItem('auth_token');
        const response = await fetch(`${API_CONFIG.FULL_API_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            password: password,
          }),
        });

        logger.info('📡 Response status:', response.status);
        const responseText = await response.text();
        logger.info('📄 Response:', responseText.substring(0, 200));

        if (response.ok) {
          const data = JSON.parse(responseText);
          
          // Store JWT token
          if (data.access_token) {
            await AsyncStorage.setItem('auth_token', data.access_token);
          }

          // Convert API user data to our User interface
          const apiUser = data.user;
          if (!apiUser) {
            throw new Error('User data not found in API response');
          }
          
          const updatedUser: User = {
            id: apiUser.id || apiUser.user_id,
            firstName: apiUser.first_name || apiUser.firstName || 'User',
            lastName: apiUser.last_name || apiUser.lastName || '',
            email: apiUser.email,
            phone: apiUser.phone || '',
            role: apiUser.role || 'employee',
            pin: apiUser.pin || '0000',
            employeeId: apiUser.employee_id || `EMP${apiUser.id}`,
            businessId: apiUser.restaurant_id || apiUser.business_id || 'restaurant1',
            startDate: apiUser.created_at ? new Date(apiUser.created_at) : new Date(),
            lastLogin: new Date(),
            permissions: apiUser.permissions || ['*'],
            isActive: apiUser.is_active !== false,
            platformId: apiUser.platform_id,
            managedRestaurants: apiUser.managed_restaurants,
          };

          setUser(updatedUser);

          // Handle platform owner vs restaurant user
          if (updatedUser.role === 'platform_owner') {
            // Continue with platform owner logic...
          } else {
            // Load restaurant data from API
            try {
              const restaurantResponse = await fetch(`${API_CONFIG.FULL_API_URL}/restaurants/${updatedUser.businessId}`, {
                headers: {
                  'Authorization': `Bearer ${data.access_token}`,
                },
              });

              if (restaurantResponse.ok) {
                const restaurantData = await restaurantResponse.json();
                const businessData: Business = {
                  id: restaurantData.id,
                  name: restaurantData.name,
                  address: restaurantData.address || '',
                  phone: restaurantData.phone || '',
                  email: restaurantData.email || '',
                  vatNumber: restaurantData.vat_number || '',
                  registrationNumber: restaurantData.registration_number || '',
                  type: 'restaurant',
                  currency: restaurantData.currency || 'GBP',
                  timezone: restaurantData.timezone || 'Europe/London',
                  ownerId: restaurantData.owner_id || updatedUser.id,
                };
                setBusiness(businessData);
                await AsyncStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(businessData));
              }
            } catch (restaurantError) {
              logger.info('Failed to load restaurant data, using defaults');
            }
          }

          await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
          await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, rememberMe.toString());

          return true;
        } else {
          // Parse error response
          try {
            const errorData = JSON.parse(responseText);
            logger.info('❌ API error:', errorData.error?.message || errorData.message || 'Unknown error');
          } catch {
            logger.info('❌ API error: Could not parse response');
          }
        }
      } catch (apiError) {
        logger.info('API authentication failed, falling back to mock for demo accounts:', apiError);
      }

      // Fallback to mock authentication for demo accounts only
      const credentials = MOCK_CREDENTIALS.find(
        cred => cred.email.toLowerCase() === email.toLowerCase() && cred.password === password
      );

      if (!credentials) {
        return false;
      }

      // Find user data
      const userData = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!userData || !userData.isActive) {
        return false;
      }

      // Update last login
      const updatedUser = {
        ...userData,
        lastLogin: new Date(),
      };

      setUser(updatedUser);

      // Handle platform owner vs restaurant user
      if (updatedUser.role === 'platform_owner') {
        try {
          // Load REAL restaurant data from RestaurantDataService
          const restaurantDataService = RestaurantDataService.getInstance();
          let realRestaurants = await restaurantDataService.getPlatformRestaurants('platform_owner_1');
        
          // INITIALIZE: If no restaurants exist, populate with mock data for the Mexican restaurant
          if (!Array.isArray(realRestaurants) || realRestaurants.length === 0) {
            logger.info('🏗️ Initializing platform restaurants - no restaurants found, adding mock data');
            
            // Convert MOCK_RESTAURANTS to RestaurantData format for RestaurantDataService
            const restaurantDataList = MOCK_RESTAURANTS.map(business => ({
              id: business.id,
              name: business.name,
              displayName: business.name,
              businessType: business.type,
              address: business.address,
              phone: business.phone,
              email: business.email,
              website: '', // Not in Business type
              vatNumber: business.vatNumber,
              registrationNumber: business.registrationNumber,
              platformOwnerId: business.platformOwnerId,
              ownerId: business.ownerId,
              subscriptionTier: business.subscriptionTier,
              currency: business.currency,
              monthlyRevenue: business.monthlyRevenue,
              commissionRate: business.commissionRate,
              isActive: business.isActive,
              onboardingCompleted: true,
              joinedDate: business.joinedDate,
              lastActivity: business.lastActivity,
              timezone: business.timezone,
              theme: 'default',
              primaryColor: '#FF6B35',
              todayTransactions: 0,
              todayRevenue: 0,
              activeOrders: 0,
              averageOrderValue: 0,
            }));
            
            // Save to RestaurantDataService
            await restaurantDataService.savePlatformRestaurants('platform_owner_1', restaurantDataList);
            logger.info(`✅ Initialized ${restaurantDataList.length} restaurants for platform owner`);
            
            // Reload the restaurants after initialization
            realRestaurants = await restaurantDataService.getPlatformRestaurants('platform_owner_1');
          }
        
        // Convert to Business type - ADD SAFETY CHECK for array
        const businesses = Array.isArray(realRestaurants) 
          ? realRestaurants.map(r => restaurantDataService.toBusinessType(r))
          : [];
        setManagedRestaurants(businesses);
        
        // Create REAL platform data based on actual restaurants - ADD SAFETY CHECK for array
        const totalRevenue = Array.isArray(realRestaurants) 
          ? realRestaurants.reduce((sum, r) => sum + (r.monthlyRevenue || 0), 0)
          : 0;
        const realPlatformData: Platform = {
          id: 'platform1',
          name: 'Fynlo POS Platform',
          ownerId: updatedUser.id,
          createdDate: new Date(2024, 0, 1),
          totalRestaurants: Array.isArray(realRestaurants) ? realRestaurants.length : 0, // REAL count from data
          totalRevenue: totalRevenue, // REAL revenue from restaurants
          isActive: true,
        };
        
        setPlatform(realPlatformData);
        logger.info(`✅ Platform data loaded with REAL data: ${Array.isArray(realRestaurants) ? realRestaurants.length : 0} restaurants, £${totalRevenue} total revenue`);
        
        // Set first restaurant as default if exists
        if (businesses.length > 0) {
          setBusiness(businesses[0]);
        }
        
        // Store platform data
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        await AsyncStorage.setItem('platform_data', JSON.stringify(realPlatformData));
        await AsyncStorage.setItem('managed_restaurants', JSON.stringify(businesses));
        if (businesses.length > 0) {
          await AsyncStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(businesses[0]));
        }
        } catch (platformError) {
          console.error('❌ Error loading platform owner data:', platformError);
          // Fallback to empty state but still allow login
          setManagedRestaurants([]);
          setPlatform({
            id: 'platform1',
            name: 'Fynlo POS Platform',
            ownerId: updatedUser.id,
            createdDate: new Date(2024, 0, 1),
            totalRestaurants: 0,
            totalRevenue: 0,
            isActive: true,
          });
        }
      } else {
        // Regular restaurant user
        const businessData = MOCK_RESTAURANTS.find(r => r.id === updatedUser.businessId) || MOCK_RESTAURANTS[0];
        setBusiness(businessData);
        
        // Store business data
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        await AsyncStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(businessData));
      }

      await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, rememberMe.toString());

      return true;
    } catch (error) {
      console.error('Error signing in:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    userData: Partial<User>, 
    businessData: Partial<Business>, 
    password: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check if email already exists
      const existingUser = MOCK_USERS.find(u => u.email.toLowerCase() === userData.email?.toLowerCase());
      if (existingUser) {
        return false;
      }

      // Create new user
      const newUser: User = {
        id: Date.now().toString(),
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        role: 'owner', // First user is always owner
        pin: userData.pin || '1234',
        employeeId: `EMP${Date.now()}`,
        businessId: Date.now().toString(),
        startDate: new Date(),
        lastLogin: new Date(),
        permissions: ['*'],
        isActive: true,
      };

      // Create new business
      const newBusiness: Business = {
        id: Date.now().toString(),
        name: businessData.name || '',
        address: businessData.address || '',
        phone: businessData.phone || '',
        email: businessData.email || newUser.email,
        vatNumber: businessData.vatNumber || '',
        registrationNumber: businessData.registrationNumber || '',
        type: businessData.type || 'retail',
        currency: 'GBP',
        timezone: 'Europe/London',
        ownerId: newUser.id,
      };

      newUser.businessId = newBusiness.id;

      setUser(newUser);
      setBusiness(newBusiness);

      // Store authentication data
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      await AsyncStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(newBusiness));
      await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');

      return true;
    } catch (error) {
      console.error('Error signing up:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Clear stored data including JWT token
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.USER),
        AsyncStorage.removeItem(STORAGE_KEYS.BUSINESS),
        AsyncStorage.removeItem(STORAGE_KEYS.REMEMBER_ME),
        AsyncStorage.removeItem('auth_token'), // Clear JWT token for API calls
      ]);

      setUser(null);
      setBusiness(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (userData: Partial<User>): Promise<void> => {
    if (!user) return;

    try {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const updateBusiness = async (businessData: Partial<Business>): Promise<void> => {
    if (!business) return;

    try {
      const updatedBusiness = { ...business, ...businessData };
      setBusiness(updatedBusiness);
      await AsyncStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(updatedBusiness));
    } catch (error) {
      console.error('Error updating business:', error);
    }
  };

  const validatePin = (pin: string): boolean => {
    return user?.pin === pin;
  };

  const checkBiometric = async (): Promise<boolean> => {
    try {
      // In a real app, this would use biometric authentication
      // For now, we'll simulate a successful biometric check
      const biometricEnabled = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
      return biometricEnabled === 'true';
    } catch (error) {
      console.error('Error checking biometric:', error);
      return false;
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if email exists
      const userExists = MOCK_CREDENTIALS.find(
        cred => cred.email.toLowerCase() === email.toLowerCase()
      );

      return !!userExists;
    } catch (error) {
      console.error('Error resetting password:', error);
      return false;
    }
  };

  const loadPlatformData = async (): Promise<void> => {
    try {
      if (user?.role === 'platform_owner') {
        logger.info('🏢 Loading REAL platform data for platform owner');
        
        // Load REAL restaurant data first
        const restaurantDataService = RestaurantDataService.getInstance();
        const realRestaurants = await restaurantDataService.getPlatformRestaurants('platform_owner_1');
        const businesses = realRestaurants.map(r => restaurantDataService.toBusinessType(r));
        setManagedRestaurants(businesses);
        
        // Generate REAL platform data based on actual restaurants
        const totalRevenue = realRestaurants.reduce((sum, r) => sum + (r.monthlyRevenue || 0), 0);
        const realPlatformData: Platform = {
          id: 'platform1',
          name: 'Fynlo POS Platform',
          ownerId: 'platform_owner_1', 
          createdDate: new Date(2024, 0, 1),
          totalRestaurants: realRestaurants.length, // REAL count from backend
          totalRevenue: totalRevenue, // REAL revenue from backend
          isActive: true,
        };
        
        setPlatform(realPlatformData);
        logger.info(`✅ Platform data loaded: ${realRestaurants.length} restaurants, £${totalRevenue} total revenue`);
      }
    } catch (error) {
      console.error('Error loading platform data:', error);
    }
  };

  const switchRestaurant = async (restaurantId: string): Promise<void> => {
    try {
      if (user?.role === 'platform_owner') {
        logger.info(`🔄 Switching to restaurant: ${restaurantId}`);
        
        // Find restaurant in the REAL managed restaurants data
        const restaurant = managedRestaurants.find(r => r.id === restaurantId);
        if (restaurant) {
          setBusiness(restaurant);
          await AsyncStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(restaurant));
          logger.info(`✅ Switched to restaurant: ${restaurant.name}`);
        } else {
          console.error(`❌ Restaurant ${restaurantId} not found in managed restaurants`);
        }
      }
    } catch (error) {
      console.error('Error switching restaurant:', error);
    }
  };

  // Subscribe to real-time restaurant updates for platform owners
  useEffect(() => {
    if (user?.role === 'platform_owner') {
      const restaurantDataService = RestaurantDataService.getInstance();
      
      // Subscribe to platform restaurants changes
      const unsubscribe = restaurantDataService.subscribeToPlatformRestaurants(
        'platform_owner_1',
        (updatedRestaurants) => {
          logger.info('🔄 Platform restaurants updated in real-time:', updatedRestaurants.length);
          const businesses = updatedRestaurants.map(r => restaurantDataService.toBusinessType(r));
          setManagedRestaurants(businesses);
        }
      );
      
      return () => {
        unsubscribe();
      };
    }
  }, [user?.role]);

  const value: AuthContextType = {
    user,
    business,
    platform,
    isLoading,
    isAuthenticated: !!user,
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};