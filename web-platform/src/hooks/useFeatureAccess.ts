import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export const useFeatureAccess = () => {
  const { user, userRole, fynloUserData } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState<{
    subscription_plan: 'alpha' | 'beta' | 'omega';
    is_platform_owner: boolean;
    enabled_features: string[];
  } | null>(null);

  useEffect(() => {
    // Use the fynloUserData from AuthContext instead of making separate API calls
    if (fynloUserData) {
      setSubscriptionData({
        subscription_plan: fynloUserData.subscription_plan,
        is_platform_owner: fynloUserData.is_platform_owner,
        enabled_features: fynloUserData.enabled_features
      });
    } else if (user) {
      // Fallback to default if no fynloUserData
      setSubscriptionData({
        subscription_plan: 'alpha',
        is_platform_owner: false,
        enabled_features: []
      });
    }
  }, [user, fynloUserData]);

  const hasFeature = (featureKey: string): boolean => {
    if (!subscriptionData) return false;
    
    // Platform owners have access to all features
    if (subscriptionData.is_platform_owner) return true;
    
    // Check if feature is in enabled_features array
    return subscriptionData.enabled_features.includes(featureKey);
  };

  const hasSubscriptionLevel = (level: 'alpha' | 'beta' | 'omega'): boolean => {
    if (!subscriptionData) return false;
    
    // Platform owners always have access
    if (subscriptionData.is_platform_owner) return true;
    
    const levelHierarchy = { alpha: 1, beta: 2, omega: 3 };
    return levelHierarchy[subscriptionData.subscription_plan] >= levelHierarchy[level];
  };

  const isPlatformOwner = (): boolean => {
    return subscriptionData?.is_platform_owner || isAdmin();
  };

  const getSubscriptionPlan = () => {
    return subscriptionData?.subscription_plan || 'alpha';
  };

  const getRestaurantId = () => {
    return fynloUserData?.restaurant_id || null;
  };

  const isAdmin = (): boolean => {
    return userRole === 'admin' || subscriptionData?.is_platform_owner || false;
  };

  return {
    hasFeature,
    hasSubscriptionLevel,
    isPlatformOwner,
    getSubscriptionPlan,
    getRestaurantId,
    isAdmin,
    fynloUserData: subscriptionData,
  };
};