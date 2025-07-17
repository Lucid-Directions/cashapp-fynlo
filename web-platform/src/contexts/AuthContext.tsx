
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface FynloUserData {
  is_platform_owner: boolean;
  restaurant_id?: string;
  restaurant_name?: string;
  subscription_plan: 'alpha' | 'beta' | 'omega';
  enabled_features: string[];
  permissions?: string[];
  role?: 'admin' | 'customer' | 'staff' | 'manager';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  fynloUserData: FynloUserData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [fynloUserData, setFynloUserData] = useState<FynloUserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      let role = 'customer';
      if (!error && data) {
        role = data.role;
      } else if (error) {
        console.error('Error fetching user role:', error);
      }
      
      setUserRole(role);
      await setDefaultFynloUserData(role, userId);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('customer');
      await setDefaultFynloUserData('customer', userId);
    }
  };

  const setDefaultFynloUserData = async (userRole: string | null, userId: string) => {
    // For Supabase-only setup, determine platform owner status from user role
    const isPlatformOwner = userRole === 'admin';
    
    let restaurantId: string | undefined;
    let isRestaurantOwner = false;
    
    // Check if user owns a restaurant directly
    if (userId) {
      try {
        const { data: ownedRestaurants } = await supabase
          .from('restaurants')
          .select('id')
          .eq('owner_id', userId)
          .eq('is_active', true);
        
        if (ownedRestaurants && ownedRestaurants.length > 0) {
          restaurantId = ownedRestaurants[0].id;
          isRestaurantOwner = true;
        } else {
          // If not a restaurant owner, check if they're associated with a restaurant as staff
          const { data } = await supabase
            .rpc('get_user_restaurant_id', { _user_id: userId });
          restaurantId = data;
        }
      } catch (error) {
        console.error('Error fetching restaurant data:', error);
      }
    }
    
    // Restaurant owners get Omega plan, platform owners get Omega, others get Beta
    const subscriptionPlan = isPlatformOwner || isRestaurantOwner ? 'omega' : 'beta';
    
    setFynloUserData({
      is_platform_owner: isPlatformOwner,
      restaurant_id: restaurantId,
      subscription_plan: subscriptionPlan,
      enabled_features: isPlatformOwner ? [
        'business_management',
        'subscription_management', 
        'system_health',
        'advanced_analytics',
        'payment_settings'
      ] : isRestaurantOwner ? [
        'inventory_management',
        'staff_management',
        'customer_database',
        'advanced_reports',
        'menu_management',
        'order_management',
        'payment_processing',
        'table_management'
      ] : [
        'inventory_management',
        'staff_management',
        'customer_database',
        'advanced_reports'
      ],
    });
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer Supabase calls to prevent deadlocks
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
          setFynloUserData(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchUserRole(session.user.id);
        }, 0);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    userRole,
    fynloUserData,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
