import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { RestaurantDashboardLayout } from './RestaurantDashboardLayout';
import { LoadingSpinner } from '../ui/loading-spinner';

// Lazy load restaurant dashboard components for better performance
const RestaurantOverview = lazy(() => import('./dashboard/RestaurantOverview').then(m => ({ default: m.RestaurantOverview })));
const OrderManagement = lazy(() => import('./dashboard/OrderManagement').then(m => ({ default: m.OrderManagement })));
const MenuManagement = lazy(() => import('./dashboard/MenuManagement').then(m => ({ default: m.MenuManagement })));
const TableManagement = lazy(() => import('./dashboard/TableManagement').then(m => ({ default: m.TableManagement })));
const PaymentProcessing = lazy(() => import('./dashboard/PaymentProcessing').then(m => ({ default: m.PaymentProcessing })));
const RestaurantStaffManagement = lazy(() => import('./dashboard/StaffManagement').then(m => ({ default: m.StaffManagement })));
const RestaurantSettings = lazy(() => import('./dashboard/RestaurantSettings').then(m => ({ default: m.RestaurantSettings })));
const AdvancedAnalytics = lazy(() => import('../dashboard/AdvancedAnalytics').then(m => ({ default: m.AdvancedAnalytics })));
const InventoryManagement = lazy(() => import('./dashboard/InventoryManagement').then(m => ({ default: m.InventoryManagement })));
const CustomerDatabase = lazy(() => import('./dashboard/CustomerDatabase').then(m => ({ default: m.CustomerDatabase })));
const LoyaltyProgram = lazy(() => import('./dashboard/LoyaltyProgram').then(m => ({ default: m.LoyaltyProgram })));
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Restaurant } from '../types';

export const RestaurantDashboard = () => {
  const { user, loading } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user && !loading) {
      fetchRestaurant();
    }
  }, [user, loading]);

  const fetchRestaurant = async () => {
    try {
      // First check if user owns a restaurant
      const { data: ownedRestaurant, error: ownerError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', user?.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!ownerError && ownedRestaurant) {
        setRestaurant(ownedRestaurant);
        setRestaurantLoading(false);
        return;
      }

      // If not owner, check if they're a staff member
      const { data: staffMember, error: staffError } = await supabase
        .from('staff_members')
        .select(`
          *,
          restaurants (*)
        `)
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!staffError && staffMember) {
        setRestaurant(staffMember.restaurants as Restaurant);
      } else {
        // No restaurant access found
        setRestaurant(null);
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      toast({
        title: "Error",
        description: "Failed to load restaurant information",
        variant: "destructive",
      });
    } finally {
      setRestaurantLoading(false);
    }
  };

  if (loading || restaurantLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 flex items-center space-x-4">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading restaurant dashboard...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">No Restaurant Access</h2>
            <p className="text-gray-600 mb-4">
              You don't have access to any restaurant. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <RestaurantDashboardLayout restaurant={restaurant}>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><LoadingSpinner /></div>}>
        <Routes>
          <Route path="/" element={<RestaurantOverview restaurant={restaurant} />} />
          <Route path="/orders" element={<OrderManagement restaurant={restaurant} />} />
          <Route path="/menu" element={<MenuManagement restaurant={restaurant} />} />
          <Route path="/tables" element={<TableManagement restaurant={restaurant} />} />
          <Route path="/payments" element={<PaymentProcessing restaurant={restaurant} />} />
          <Route path="/staff" element={<RestaurantStaffManagement restaurant={restaurant} />} />
          <Route path="/analytics" element={<AdvancedAnalytics restaurantId={restaurant.id} />} />
          <Route path="/inventory" element={<InventoryManagement restaurant={restaurant} />} />
          <Route path="/customers" element={<CustomerDatabase restaurant={restaurant} />} />
          <Route path="/loyalty" element={<LoyaltyProgram restaurant={restaurant} />} />
          <Route path="/settings" element={<RestaurantSettings restaurant={restaurant} />} />
        </Routes>
      </Suspense>
    </RestaurantDashboardLayout>
  );
};