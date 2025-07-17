import React, { useEffect, useState } from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { UpgradePrompt } from './UpgradePrompt';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Store, Users, TrendingUp, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Restaurant {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  owner_id: string;
  currency?: string;
  timezone?: string;
}

interface LocationStats {
  total_orders: number;
  total_revenue: number;
  staff_count: number;
  table_count: number;
}

export const LocationManagement = () => {
  const { hasFeature } = useFeatureAccess();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [locationStats, setLocationStats] = useState<Record<string, LocationStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch restaurants
      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (restaurantsError) throw restaurantsError;
      setRestaurants(restaurantsData || []);

      // Fetch stats for each location
      const stats: Record<string, LocationStats> = {};
      
      for (const restaurant of restaurantsData || []) {
        // Get orders count and revenue
        const { data: ordersData } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('restaurant_id', restaurant.id);

        // Get staff count
        const { data: staffData } = await supabase
          .from('staff_members')
          .select('id')
          .eq('restaurant_id', restaurant.id)
          .eq('is_active', true);

        // Get tables count
        const { data: tablesData } = await supabase
          .from('restaurant_tables')
          .select('id')
          .eq('restaurant_id', restaurant.id)
          .eq('is_active', true);

        stats[restaurant.id] = {
          total_orders: ordersData?.length || 0,
          total_revenue: ordersData?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0,
          staff_count: staffData?.length || 0,
          table_count: tablesData?.length || 0,
        };
      }

      setLocationStats(stats);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load location data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleLocationStatus = async (restaurantId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_active: !currentStatus })
        .eq('id', restaurantId);

      if (error) throw error;

      await fetchData();
      toast({
        title: "Success",
        description: `Location ${!currentStatus ? 'activated' : 'deactivated'} successfully.`,
      });
    } catch (error) {
      console.error('Error updating location status:', error);
      toast({
        title: "Error",
        description: "Failed to update location status. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!hasFeature('multi_location')) {
    return (
      <UpgradePrompt
        title="Multi-Location Management"
        description="Manage multiple restaurant locations from a single dashboard."
        requiredPlan="omega"
        features={[
          'Multiple location support',
          'Centralized management',
          'Location-specific analytics',
          'Cross-location reporting',
          'Inventory synchronization'
        ]}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Location Management</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const activeLocations = restaurants.filter(r => r.is_active);
  const totalLocations = restaurants.length;
  const totalRevenue = Object.values(locationStats).reduce((sum, stats) => sum + stats.total_revenue, 0);
  const totalOrders = Object.values(locationStats).reduce((sum, stats) => sum + stats.total_orders, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Location Management</h1>
          <p className="text-muted-foreground">Manage all restaurant locations across the platform</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Location
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLocations}</div>
            <p className="text-xs text-muted-foreground">
              {activeLocations.length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Across all locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              All-time orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLocations.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Locations List */}
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Locations</CardTitle>
          <CardDescription>
            {totalLocations > 0 
              ? `Manage all ${totalLocations} restaurant locations`
              : "No restaurant locations found. Add locations to see them here."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalLocations === 0 ? (
            <div className="text-center py-8">
              <Store className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No locations</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started by adding your first restaurant location to the platform.
              </p>
              <div className="mt-6">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Location
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {restaurants.map((restaurant) => {
                const stats = locationStats[restaurant.id] || {
                  total_orders: 0,
                  total_revenue: 0,
                  staff_count: 0,
                  table_count: 0,
                };
                
                return (
                  <div key={restaurant.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium">{restaurant.name}</h4>
                        <Badge variant={restaurant.is_active ? "default" : "secondary"}>
                          {restaurant.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      
                      {restaurant.address && (
                        <p className="text-sm text-muted-foreground mb-1">
                          <MapPin className="inline h-3 w-3 mr-1" />
                          {restaurant.address}
                        </p>
                      )}
                      
                      <div className="flex space-x-4 text-sm text-muted-foreground">
                        <span>{stats.total_orders} orders</span>
                        <span>£{stats.total_revenue.toFixed(2)} revenue</span>
                        <span>{stats.staff_count} staff</span>
                        <span>{stats.table_count} tables</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleLocationStatus(restaurant.id, restaurant.is_active)}
                      >
                        {restaurant.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};