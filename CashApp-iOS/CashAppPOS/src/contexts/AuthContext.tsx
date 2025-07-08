import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RestaurantDataService from '../services/RestaurantDataService';
import API_CONFIG from '../config/api';

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

// Mock data for development
const MOCK_USERS: User[] = [
  {
    id: 'platform_owner_1',
    firstName: 'Platform',
    lastName: 'Owner',
    email: 'owner@fynlopos.com',
    phone: '+44 7700 900100',
    role: 'platform_owner',
    pin: '0001',
    employeeId: 'PLATFORM001',
    businessId: 'platform1',
    startDate: new Date(2024, 0, 1),
    lastLogin: new Date(),
    permissions: ['*'], // Platform owner has all permissions
    isActive: true,
    platformId: 'platform1',
    managedRestaurants: ['restaurant1', 'restaurant2', 'restaurant3', 'restaurant4'],
  },
  {
    id: 'user1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john@fynlopos.com',
    phone: '+44 7700 900123',
    role: 'restaurant_owner',
    pin: '1234',
    employeeId: 'EMP001',
    businessId: 'restaurant1',
    startDate: new Date(2024, 0, 15),
    lastLogin: new Date(),
    permissions: ['*'], // Restaurant owner has all permissions for their restaurant
    isActive: true,
  },
  {
    id: 'user2',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah@fynlopos.com',
    phone: '+44 7700 900124',
    role: 'manager',
    pin: '5678',
    employeeId: 'EMP002',
    businessId: 'restaurant1',
    startDate: new Date(2024, 1, 1),
    lastLogin: new Date(Date.now() - 3600000),
    permissions: ['manage_staff', 'view_reports', 'process_returns'],
    isActive: true,
  },
  {
    id: 'user3',
    firstName: 'Mike',
    lastName: 'Davis',
    email: 'mike@fynlopos.com',
    phone: '+44 7700 900125',
    role: 'employee',
    pin: '9999',
    employeeId: 'EMP003',
    businessId: 'restaurant1',
    startDate: new Date(2024, 2, 15),
    lastLogin: new Date(Date.now() - 7200000),
    permissions: ['process_sales', 'clock_in_out'],
    isActive: true,
  },
  {
    id: 'user4',
    firstName: 'Demo',
    lastName: 'User',
    email: 'demo@fynlopos.com',
    phone: '+44 7700 900126',
    role: 'manager',
    pin: '0000',
    employeeId: 'EMP004',
    businessId: 'restaurant1',
    startDate: new Date(2024, 3, 1),
    lastLogin: new Date(Date.now() - 1800000),
    permissions: ['manage_staff', 'view_reports', 'process_returns', 'process_sales'],
    isActive: true,
  },
  // Quick sign-in test users
  {
    id: 'test_restaurant_owner',
    firstName: 'Maria',
    lastName: 'Rodriguez',
    email: 'restaurant_owner',
    phone: '+44 7700 900200',
    role: 'restaurant_owner',
    pin: '1111',
    employeeId: 'OWNER001',
    businessId: 'restaurant1',
    startDate: new Date(2024, 0, 1),
    lastLogin: new Date(),
    permissions: ['manage_menu', 'view_reports', 'manage_employees', 'manage_settings', 'process_orders', 'handle_payments'],
    isActive: true,
  },
  {
    id: 'test_platform_owner',
    firstName: 'Alex',
    lastName: 'Thompson',
    email: 'platform_owner',
    phone: '+44 7700 900201',
    role: 'platform_owner',
    pin: '2222',
    employeeId: 'PLAT001',
    businessId: 'platform1',
    startDate: new Date(2024, 0, 1),
    lastLogin: new Date(),
    permissions: ['*'],
    isActive: true,
    platformId: 'platform1',
  },
  {
    id: 'test_manager',
    firstName: 'Sofia',
    lastName: 'Hernandez',
    email: 'manager',
    phone: '+44 7700 900202',
    role: 'manager',
    pin: '3333',
    employeeId: 'MGR001',
    businessId: 'restaurant1',
    startDate: new Date(2024, 0, 1),
    lastLogin: new Date(),
    permissions: ['process_orders', 'handle_payments', 'view_reports', 'manage_employees', 'view_menu', 'access_pos'],
    isActive: true,
  },
  {
    id: 'test_cashier',
    firstName: 'Carlos',
    lastName: 'Garcia',
    email: 'cashier',
    phone: '+44 7700 900203',
    role: 'employee',
    pin: '4444',
    employeeId: 'CASH001',
    businessId: 'restaurant1',
    startDate: new Date(2024, 0, 1),
    lastLogin: new Date(),
    permissions: ['process_orders', 'handle_payments', 'view_menu', 'access_pos'],
    isActive: true,
  }
];

// Mock platform data
const MOCK_PLATFORM: Platform = {
  id: 'platform1',
  name: 'Fynlo POS Platform',
  ownerId: 'platform_owner_1',
  createdDate: new Date(2024, 0, 1),
  totalRestaurants: 4,
  totalRevenue: 125400,
  isActive: true,
};

// Mock restaurants data
const MOCK_RESTAURANTS: Business[] = [
  {
    id: 'restaurant1',
    name: 'Chucho',
    address: '123 Camden High Street, London, NW1 7JR',
    phone: '+44 20 7946 0958',
    email: 'hola@chucho.com',
    vatNumber: 'GB123456789',
    registrationNumber: '12345678',
    type: 'restaurant',
    currency: 'GBP',
    timezone: 'Europe/London',
    ownerId: 'user1',
    platformOwnerId: 'platform_owner_1',
    subscriptionTier: 'premium',
    isActive: true,
    joinedDate: new Date(2024, 0, 15),
    lastActivity: new Date(),
    monthlyRevenue: 45200,
    commissionRate: 2.5,
  },
  {
    id: 'restaurant2',
    name: 'Fynlo Pizza Palace',
    address: '456 Main Street, Manchester, M1 2AB',
    phone: '+44 161 234 5678',
    email: 'pizza@fynlopos.com',
    vatNumber: 'GB987654321',
    registrationNumber: '87654321',
    type: 'restaurant',
    currency: 'GBP',
    timezone: 'Europe/London',
    ownerId: 'user5',
    platformOwnerId: 'platform_owner_1',
    subscriptionTier: 'basic',
    isActive: true,
    joinedDate: new Date(2024, 1, 1),
    lastActivity: new Date(Date.now() - 3600000),
    monthlyRevenue: 32800,
    commissionRate: 2.5,
  },
  {
    id: 'restaurant3',
    name: 'Fynlo Burger Bar',
    address: '789 Broadway, Birmingham, B1 3CD',
    phone: '+44 121 987 6543',
    email: 'burgers@fynlopos.com',
    vatNumber: 'GB456789123',
    registrationNumber: '45678912',
    type: 'restaurant',
    currency: 'GBP',
    timezone: 'Europe/London',
    ownerId: 'user6',
    platformOwnerId: 'platform_owner_1',
    subscriptionTier: 'enterprise',
    isActive: true,
    joinedDate: new Date(2024, 1, 15),
    lastActivity: new Date(Date.now() - 1800000),
    monthlyRevenue: 38900,
    commissionRate: 2.0,
  },
  {
    id: 'restaurant4',
    name: 'Fynlo Fine Dining',
    address: '321 Oxford Street, London, W1A 4EF',
    phone: '+44 20 1234 5678',
    email: 'finedining@fynlopos.com',
    vatNumber: 'GB789123456',
    registrationNumber: '78912345',
    type: 'restaurant',
    currency: 'GBP',
    timezone: 'Europe/London',
    ownerId: 'user7',
    platformOwnerId: 'platform_owner_1',
    subscriptionTier: 'premium',
    isActive: false, // Temporarily offline for maintenance
    joinedDate: new Date(2024, 2, 1),
    lastActivity: new Date(Date.now() - 86400000), // 1 day ago
    monthlyRevenue: 8500,
    commissionRate: 1.8,
  },
];

// Mock credentials for testing
const MOCK_CREDENTIALS = [
  { email: 'owner@fynlopos.com', password: 'platformowner123' }, // Platform owner
  { email: 'john@fynlopos.com', password: 'password123' },
  { email: 'sarah@fynlopos.com', password: 'password123' },
  { email: 'mike@fynlopos.com', password: 'password123' },
  { email: 'demo@fynlopos.com', password: 'demo' }, // Demo account
  // Quick sign-in test users
  { email: 'restaurant_owner', password: 'owner123' },
  { email: 'platform_owner', password: 'platform123' },
  { email: 'manager', password: 'manager123' },
  { email: 'cashier', password: 'cashier123' },
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [managedRestaurants, setManagedRestaurants] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      setIsLoading(true);
      
      const [storedUser, storedBusiness, rememberMe] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.BUSINESS),
        AsyncStorage.getItem(STORAGE_KEYS.REMEMBER_ME),
      ]);

      if (storedUser && (rememberMe === 'true')) {
        let userData;
        try {
          userData = JSON.parse(storedUser);
        } catch (parseError) {
          console.error('Error parsing stored user data:', parseError);
          // Clear corrupted data and fall back to demo user
          await AsyncStorage.removeItem(STORAGE_KEYS.USER);
          const demoUser = MOCK_USERS.find(u => u.email === 'demo@fynlopos.com');
          const demoBusiness = MOCK_RESTAURANTS.find(b => b.id === 'restaurant1');
          
          if (demoUser && demoBusiness) {
            setUser({ ...demoUser, lastLogin: new Date() });
            setBusiness(demoBusiness);
          }
          return;
        }
        // Convert date strings back to Date objects with error handling
        try {
          userData.startDate = userData.startDate ? new Date(userData.startDate) : new Date();
          userData.lastLogin = userData.lastLogin ? new Date(userData.lastLogin) : new Date();
          
          // Validate date objects
          if (isNaN(userData.startDate.getTime())) {
            userData.startDate = new Date();
          }
          if (isNaN(userData.lastLogin.getTime())) {
            userData.lastLogin = new Date();
          }
        } catch (error) {
          console.error('Error parsing user dates:', error);
          userData.startDate = new Date();
          userData.lastLogin = new Date();
        }
        
        setUser(userData);
        
        if (storedBusiness) {
          setBusiness(JSON.parse(storedBusiness));
        }
      } else {
        // Auto-login with demo user for development
        const demoUser = MOCK_USERS.find(u => u.email === 'demo@fynlopos.com');
        const demoBusiness = MOCK_RESTAURANTS.find(b => b.id === 'restaurant1');
        
        if (demoUser && demoBusiness) {
          setUser({ ...demoUser, lastLogin: new Date() });
          setBusiness(demoBusiness);
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string, rememberMe = false): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Try real API authentication first
      try {
        console.log('🔐 Attempting API authentication for:', email);
        console.log('🌐 API URL:', `${API_CONFIG.FULL_API_URL}/auth/login`);
        
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

        console.log('📡 Response status:', response.status);
        const responseText = await response.text();
        console.log('📄 Response:', responseText.substring(0, 200));

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
              console.log('Failed to load restaurant data, using defaults');
            }
          }

          await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
          await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, rememberMe.toString());

          return true;
        } else {
          // Parse error response
          try {
            const errorData = JSON.parse(responseText);
            console.log('❌ API error:', errorData.error?.message || errorData.message || 'Unknown error');
          } catch {
            console.log('❌ API error: Could not parse response');
          }
        }
      } catch (apiError) {
        console.error('🚨 AUTHENTICATION FAILED: Backend unavailable', apiError);
        throw new Error('Backend authentication service unavailable. Please check your connection.');
      }

      // PRODUCTION MODE: No mock fallbacks allowed
      console.error('🚨 NO MOCK AUTHENTICATION: App requires working backend');
      return false;

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
            console.log('🏗️ Initializing platform restaurants - no restaurants found, adding mock data');
            
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
            console.log(`✅ Initialized ${restaurantDataList.length} restaurants for platform owner`);
            
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
        console.log(`✅ Platform data loaded with REAL data: ${Array.isArray(realRestaurants) ? realRestaurants.length : 0} restaurants, £${totalRevenue} total revenue`);
        
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
        console.log('🏢 Loading REAL platform data for platform owner');
        
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
        console.log(`✅ Platform data loaded: ${realRestaurants.length} restaurants, £${totalRevenue} total revenue`);
      }
    } catch (error) {
      console.error('Error loading platform data:', error);
    }
  };

  const switchRestaurant = async (restaurantId: string): Promise<void> => {
    try {
      if (user?.role === 'platform_owner') {
        console.log(`🔄 Switching to restaurant: ${restaurantId}`);
        
        // Find restaurant in the REAL managed restaurants data
        const restaurant = managedRestaurants.find(r => r.id === restaurantId);
        if (restaurant) {
          setBusiness(restaurant);
          await AsyncStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(restaurant));
          console.log(`✅ Switched to restaurant: ${restaurant.name}`);
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
          console.log('🔄 Platform restaurants updated in real-time:', updatedRestaurants.length);
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